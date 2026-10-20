import csv
from datetime import timedelta

import django_filters
from django.db import transaction
from django.db.models import F
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from collaboration.activity import log_activity
from workspaces.access import accessible_projects, can_manage_project, membership

from . import services
from .models import AIRecommendation, InventoryMovement, Product, PurchaseOrder, PurchaseOrderItem, Store, StoreRole, StoreStaff, Supplier
from .permissions import accessible_stores, can_admin_staff, get_store, require_manager, require_write
from .serializers import (
    AIRecommendationSerializer, InventoryMovementSerializer, ProductSerializer, PurchaseOrderSerializer,
    StockAdjustmentSerializer, StoreCreateSerializer, StoreSerializer, StoreStaffSerializer, SupplierSerializer,
)


def _store_from_request(request) -> Store:
    store_id = request.query_params.get("store")
    if not store_id or not store_id.isdigit():
        raise ValidationError({"store": "The store query parameter is required."})
    return get_store(request.user, int(store_id))


def _audit(request, store, verb, target, message):
    log_activity(actor=request.user, workspace=store.project.workspace, project=store.project, verb=verb,
                 target=target, message=f"[SmartStock] {message}")


class StoreViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                   mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = Store.objects.none()
    pagination_class = None
    filterset_fields = ["project"]

    def get_queryset(self):
        return accessible_stores(self.request.user).select_related("project", "project__workspace")

    def get_serializer_class(self):
        return StoreCreateSerializer if self.action == "create" else StoreSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        if not accessible_projects(self.request.user).filter(pk=project.pk).exists():
            raise ValidationError({"project": "Project not found."})
        if not can_manage_project(self.request.user, project):
            raise PermissionDenied("Only workspace admins or the project lead can enable SmartStock.")
        if Store.objects.filter(project=project).exists():
            raise ValidationError({"project": "This project already has a SmartStock store."})
        store = serializer.save()
        StoreStaff.objects.create(store=store, user=self.request.user, role=StoreRole.MANAGER)
        _audit(self.request, store, "created", store, f"enabled SmartStock store {store.name}")

    def perform_update(self, serializer):
        require_manager(self.request.user, serializer.instance)
        serializer.save()

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"])
    def dashboard(self, request, pk=None):
        store = self.get_object()
        if not store.recommendations.exists():
            services.regenerate_recommendations(store)
        data = services.dashboard(store)
        top = store.recommendations.filter(status=AIRecommendation.Status.OPEN).select_related("product")
        severity_rank = {"high": 0, "medium": 1, "low": 2}
        top = sorted(top, key=lambda r: (severity_rank[r.severity], -r.potential_savings))[:5]
        data["top_insights"] = AIRecommendationSerializer(top, many=True).data
        return Response(data)

    @extend_schema(request=StoreStaffSerializer, responses=StoreStaffSerializer(many=True))
    @action(detail=True, methods=["get", "post"])
    def staff(self, request, pk=None):
        store = self.get_object()
        if request.method == "POST":
            if not can_admin_staff(request.user, store):
                raise PermissionDenied("Only store managers can manage SmartStock roles.")
            s = StoreStaffSerializer(data=request.data, context={"request": request})
            s.is_valid(raise_exception=True)
            user = s.validated_data["user"]
            if membership(user, store.project.workspace_id) is None:
                raise ValidationError({"user_id": "User must belong to the project's workspace."})
            staff, _ = StoreStaff.objects.update_or_create(store=store, user=user, defaults={"role": s.validated_data["role"]})
            _audit(request, store, "role_changed", staff, f"set {user.display_name} as {staff.get_role_display()}")
        qs = store.staff.select_related("user")
        return Response(StoreStaffSerializer(qs, many=True, context={"request": request}).data)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=["delete"], url_path=r"staff/(?P<staff_id>\d+)")
    def remove_staff(self, request, pk=None, staff_id=None):
        store = self.get_object()
        if not can_admin_staff(request.user, store):
            raise PermissionDenied("Only store managers can manage SmartStock roles.")
        staff = store.staff.filter(pk=staff_id).first()
        if staff is None:
            raise ValidationError({"detail": "Staff member not found."})
        if staff.role == StoreRole.MANAGER and store.staff.filter(role=StoreRole.MANAGER).count() == 1:
            raise ValidationError({"detail": "A store must keep at least one manager."})
        staff.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses=AIRecommendationSerializer(many=True))
    @action(detail=True, methods=["post"], url_path="regenerate-insights")
    def regenerate_insights(self, request, pk=None):
        store = self.get_object()
        require_write(request.user, store)
        services.regenerate_recommendations(store)
        qs = store.recommendations.filter(status=AIRecommendation.Status.OPEN).select_related("product")
        return Response(AIRecommendationSerializer(qs, many=True).data)


class ProductFilter(django_filters.FilterSet):
    stock_status = django_filters.ChoiceFilter(choices=[("out", "Out"), ("low", "Low"), ("ok", "OK")], method="filter_status")
    expiring_within = django_filters.NumberFilter(method="filter_expiring")

    class Meta:
        model = Product
        fields = ["store", "category", "supplier"]

    def filter_status(self, qs, name, value):
        if value == "out":
            return qs.filter(stock=0)
        if value == "low":
            return qs.filter(stock__lte=F("min_stock"), stock__gt=0)
        return qs.filter(stock__gt=F("min_stock"))

    def filter_expiring(self, qs, name, value):
        return qs.filter(expiry_date__isnull=False, expiry_date__lte=timezone.localdate() + timedelta(days=int(value)))


def _csv_safe(value) -> str:
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.none()
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    search_fields = ["name", "sku", "category"]
    ordering_fields = ["name", "sku", "category", "stock", "sale_price", "purchase_price", "expiry_date", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        return Product.objects.filter(store__in=accessible_stores(self.request.user)).select_related("supplier", "store__project__workspace")

    def list(self, request, *args, **kwargs):
        _store_from_request(request)
        return super().list(request, *args, **kwargs)

    @transaction.atomic
    def perform_create(self, serializer):
        store = serializer.validated_data["store"]
        require_write(self.request.user, store)
        initial = serializer.validated_data.pop("stock", 0)
        product = serializer.save(stock=0)
        if initial:
            services.apply_movement(product, kind=InventoryMovement.Kind.INITIAL, quantity=initial, user=self.request.user,
                                    reason="Initial stock")
        _audit(self.request, store, "created", product, f"added product {product.name} ({product.sku})")

    def perform_update(self, serializer):
        require_write(self.request.user, serializer.instance.store)
        product = serializer.save()
        _audit(self.request, product.store, "updated", product, f"updated product {product.name}")

    def perform_destroy(self, instance):
        require_manager(self.request.user, instance.store)
        if instance.order_items.filter(order__status=PurchaseOrder.Status.ORDERED).exists():
            raise ValidationError({"detail": "This product is part of an open purchase order."})
        _audit(self.request, instance.store, "deleted", instance, f"deleted product {instance.name}")
        PurchaseOrderItem.objects.filter(product=instance, order__status__in=["draft", "cancelled", "received"]).delete()
        instance.delete()

    @extend_schema(request=StockAdjustmentSerializer, responses=ProductSerializer)
    @action(detail=True, methods=["post"])
    def adjust(self, request, pk=None):
        product = self.get_object()
        require_write(request.user, product.store)
        s = StockAdjustmentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        movement = services.apply_movement(product, user=request.user, **s.validated_data)
        _audit(request, product.store, "stock", product,
               f"{movement.get_kind_display().lower()} {movement.quantity:+d} × {product.name} (stock {movement.stock_after})")
        product.refresh_from_db()
        return Response(ProductSerializer(product, context={"request": request}).data)

    @extend_schema(responses={(200, "text/csv"): str})
    @action(detail=False, methods=["get"])
    def export(self, request):
        _store_from_request(request)
        qs = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="smartstock-inventory.csv"'
        writer = csv.writer(response)
        writer.writerow(["Name", "SKU", "Category", "Purchase price", "Sale price", "Stock", "Minimum stock",
                         "Expiry date", "Supplier", "Inventory value"])
        for p in qs:
            writer.writerow([_csv_safe(v) for v in [p.name, p.sku, p.category, p.purchase_price, p.sale_price, p.stock,
                                                    p.min_stock, p.expiry_date or "", p.supplier.name if p.supplier else "",
                                                    p.inventory_value]])
        return response

    @extend_schema(responses={200: list})
    @action(detail=False, methods=["get"])
    def categories(self, request):
        store = _store_from_request(request)
        return Response(sorted(set(store.products.values_list("category", flat=True))))


class MovementViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = InventoryMovement.objects.none()
    serializer_class = InventoryMovementSerializer
    filterset_fields = ["product", "kind"]
    search_fields = ["product__name", "product__sku", "reason", "reference"]

    def get_queryset(self):
        store = _store_from_request(self.request)
        return InventoryMovement.objects.filter(product__store=store).select_related("product", "created_by")


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.none()
    serializer_class = SupplierSerializer
    filterset_fields = ["store"]
    search_fields = ["name"]
    pagination_class = None

    def get_queryset(self):
        return Supplier.objects.filter(store__in=accessible_stores(self.request.user))

    def list(self, request, *args, **kwargs):
        _store_from_request(request)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        require_write(self.request.user, serializer.validated_data["store"])
        serializer.save()

    def perform_update(self, serializer):
        require_write(self.request.user, serializer.instance.store)
        serializer.save()

    def perform_destroy(self, instance):
        require_manager(self.request.user, instance.store)
        if instance.orders.exists():
            raise ValidationError({"detail": "Suppliers with purchase orders cannot be deleted."})
        instance.delete()


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.none()
    serializer_class = PurchaseOrderSerializer
    filterset_fields = ["store", "status", "supplier"]
    ordering_fields = ["created_at", "expected_delivery"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (PurchaseOrder.objects.filter(store__in=accessible_stores(self.request.user))
                .select_related("supplier", "created_by", "store__project__workspace").prefetch_related("items__product"))

    def list(self, request, *args, **kwargs):
        _store_from_request(request)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        store = serializer.validated_data["store"]
        require_write(self.request.user, store)
        order = serializer.save(created_by=self.request.user)
        _audit(self.request, store, "created", order, f"created purchase order PO-{order.pk}")

    def perform_update(self, serializer):
        require_write(self.request.user, serializer.instance.store)
        serializer.save()

    def perform_destroy(self, instance):
        require_write(self.request.user, instance.store)
        if instance.status != PurchaseOrder.Status.DRAFT:
            raise ValidationError({"detail": "Only draft orders can be deleted. Cancel ordered purchases instead."})
        instance.delete()

    def _transition(self, request, allowed_from, to, verb):
        order = self.get_object()
        require_write(request.user, order.store)
        if order.status not in allowed_from:
            raise ValidationError({"status": f"Cannot {verb} an order with status '{order.get_status_display()}'."})
        order.status = to
        order.save(update_fields=["status", "updated_at"])
        _audit(request, order.store, verb, order, f"{verb} purchase order PO-{order.pk}")
        return Response(PurchaseOrderSerializer(self.get_queryset().get(pk=order.pk), context={"request": request}).data)

    @extend_schema(request=None, responses=PurchaseOrderSerializer)
    @action(detail=True, methods=["post"])
    def place(self, request, pk=None):
        return self._transition(request, {PurchaseOrder.Status.DRAFT}, PurchaseOrder.Status.ORDERED, "placed")

    @extend_schema(request=None, responses=PurchaseOrderSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._transition(request, {PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.ORDERED},
                                PurchaseOrder.Status.CANCELLED, "cancelled")

    @extend_schema(request=None, responses=PurchaseOrderSerializer)
    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        order = self.get_object()
        require_write(request.user, order.store)
        services.receive_order(order, request.user)
        services.regenerate_recommendations(order.store)
        _audit(request, order.store, "received", order, f"received purchase order PO-{order.pk}; stock updated")
        return Response(PurchaseOrderSerializer(self.get_queryset().get(pk=order.pk), context={"request": request}).data)


class RecommendationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = AIRecommendation.objects.none()
    serializer_class = AIRecommendationSerializer
    filterset_fields = ["kind", "severity", "status", "product"]
    pagination_class = None

    def get_queryset(self):
        store = _store_from_request(self.request) if self.action == "list" else None
        qs = AIRecommendation.objects.filter(store__in=accessible_stores(self.request.user)).select_related("product", "store")
        if store:
            qs = qs.filter(store=store)
            if "status" not in self.request.query_params:
                qs = qs.filter(status=AIRecommendation.Status.OPEN)
        return qs

    @extend_schema(request=None, responses=AIRecommendationSerializer)
    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        rec = self.get_object()
        require_write(request.user, rec.store)
        rec.status = AIRecommendation.Status.DISMISSED
        rec.save(update_fields=["status"])
        return Response(AIRecommendationSerializer(rec).data)

    @extend_schema(request=None, responses=PurchaseOrderSerializer)
    @action(detail=True, methods=["post"], url_path="create-order")
    def create_order(self, request, pk=None):
        """Turn a purchase recommendation into a draft purchase order."""
        rec = self.get_object()
        require_write(request.user, rec.store)
        if rec.recommended_quantity <= 0:
            raise ValidationError({"detail": "This insight does not recommend a purchase."})
        supplier = rec.product.supplier
        if supplier is None:
            raise ValidationError({"detail": "Assign a supplier to the product first."})
        with transaction.atomic():
            order = PurchaseOrder.objects.create(
                store=rec.store, supplier=supplier, created_by=request.user,
                expected_delivery=timezone.localdate() + timedelta(days=supplier.lead_time_days),
                notes=f"Created from AI insight: {rec.title}"[:300])
            PurchaseOrderItem.objects.create(order=order, product=rec.product, quantity=rec.recommended_quantity,
                                             unit_price=rec.product.purchase_price)
            rec.status = AIRecommendation.Status.APPLIED
            rec.save(update_fields=["status"])
        _audit(request, rec.store, "created", order, f"created draft PO-{order.pk} from insight")
        order = PurchaseOrder.objects.select_related("supplier", "created_by").prefetch_related("items__product").get(pk=order.pk)
        return Response(PurchaseOrderSerializer(order, context={"request": request}).data, status=status.HTTP_201_CREATED)
