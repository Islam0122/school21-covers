from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import PublicUserSerializer

from .models import (
    AIRecommendation, InventoryMovement, Product, PurchaseOrder, PurchaseOrderItem, Store, StoreStaff, Supplier,
)
from .permissions import accessible_stores, store_role

User = get_user_model()


class StoreField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        return accessible_stores(self.context["request"].user)


class StoreSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = Store
        fields = ["id", "project", "project_name", "name", "currency", "default_lead_time_days", "role", "created_at"]
        read_only_fields = ["id", "project", "created_at"]

    def get_role(self, obj) -> str | None:
        return store_role(self.context["request"].user, obj)


class StoreCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ["id", "project", "name", "currency", "default_lead_time_days"]


class StoreStaffSerializer(serializers.ModelSerializer):
    user = PublicUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source="user", write_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = StoreStaff
        fields = ["id", "user", "user_id", "role", "role_label", "created_at"]


class SupplierSerializer(serializers.ModelSerializer):
    store = StoreField()

    class Meta:
        model = Supplier
        fields = ["id", "store", "name", "contact_email", "phone", "lead_time_days", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    store = StoreField()
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default=None)
    inventory_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    margin_percent = serializers.SerializerMethodField()
    stock_status = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "store", "name", "sku", "category", "purchase_price", "sale_price", "stock", "min_stock",
                  "expiry_date", "supplier", "supplier_name", "inventory_value", "margin_percent", "stock_status",
                  "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators = []

    def get_margin_percent(self, obj) -> float | None:
        if not obj.sale_price:
            return None
        return float(round((obj.sale_price - obj.purchase_price) / obj.sale_price * 100, 1))

    def get_stock_status(self, obj) -> str:
        if obj.stock == 0:
            return "out"
        if obj.stock <= obj.min_stock:
            return "low"
        return "ok"

    def validate_sku(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("SKU is required.")
        return value

    def validate(self, attrs):
        store = attrs.get("store") or self.instance.store
        if self.instance and "store" in attrs and attrs["store"] != self.instance.store:
            raise serializers.ValidationError({"store": "Products cannot be moved between stores."})
        if self.instance and "stock" in attrs and attrs["stock"] != self.instance.stock:
            raise serializers.ValidationError({"stock": "Use a stock adjustment to change stock levels."})
        sku = attrs.get("sku")
        if sku:
            qs = Product.objects.filter(store=store, sku=sku)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"sku": "A product with this SKU already exists."})
        supplier = attrs.get("supplier")
        if supplier and supplier.store_id != store.pk:
            raise serializers.ValidationError({"supplier": "Supplier must belong to the same store."})
        purchase = attrs.get("purchase_price", getattr(self.instance, "purchase_price", Decimal("0")))
        sale = attrs.get("sale_price", getattr(self.instance, "sale_price", Decimal("0")))
        if sale < purchase:
            raise serializers.ValidationError({"sale_price": "Sale price should not be lower than purchase price."})
        return attrs


class StockAdjustmentSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[
        InventoryMovement.Kind.SALE, InventoryMovement.Kind.ADJUSTMENT, InventoryMovement.Kind.WRITE_OFF,
        InventoryMovement.Kind.RETURN, InventoryMovement.Kind.RECEIPT,
    ])
    quantity = serializers.IntegerField()
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate_quantity(self, value):
        if value == 0:
            raise serializers.ValidationError("Quantity cannot be zero.")
        return value


class InventoryMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    created_by = PublicUserSerializer(read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = InventoryMovement
        fields = ["id", "product", "product_name", "sku", "kind", "kind_label", "quantity", "stock_after",
                  "unit_price", "reason", "reference", "created_by", "created_at"]


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = ["id", "product", "product_name", "sku", "quantity", "unit_price"]
        extra_kwargs = {"product": {"queryset": Product.objects.all()}}


class PurchaseOrderSerializer(serializers.ModelSerializer):
    store = StoreField()
    items = PurchaseOrderItemSerializer(many=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    created_by = PublicUserSerializer(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = ["id", "store", "supplier", "supplier_name", "status", "status_label", "expected_delivery", "notes",
                  "items", "total", "created_by", "received_at", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "received_at", "created_at", "updated_at"]

    def validate(self, attrs):
        store = attrs.get("store") or self.instance.store
        if self.instance:
            if self.instance.status != PurchaseOrder.Status.DRAFT:
                raise serializers.ValidationError({"detail": "Only draft orders can be edited."})
            if "store" in attrs and attrs["store"] != self.instance.store:
                raise serializers.ValidationError({"store": "Orders cannot be moved between stores."})
        supplier = attrs.get("supplier") or self.instance.supplier
        if supplier.store_id != store.pk:
            raise serializers.ValidationError({"supplier": "Supplier must belong to this store."})
        items = attrs.get("items")
        if items is not None:
            if not items:
                raise serializers.ValidationError({"items": "Add at least one product."})
            seen = set()
            for item in items:
                if item["product"].store_id != store.pk:
                    raise serializers.ValidationError({"items": "All products must belong to this store."})
                if item["product"].pk in seen:
                    raise serializers.ValidationError({"items": "Each product can appear only once."})
                seen.add(item["product"].pk)
        return attrs

    def create(self, validated_data):
        items = validated_data.pop("items")
        order = PurchaseOrder.objects.create(**validated_data)
        PurchaseOrderItem.objects.bulk_create(PurchaseOrderItem(order=order, **i) for i in items)
        return order

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        instance = super().update(instance, validated_data)
        if items is not None:
            instance.items.all().delete()
            PurchaseOrderItem.objects.bulk_create(PurchaseOrderItem(order=instance, **i) for i in items)
        return instance


class AIRecommendationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    supplier = serializers.IntegerField(source="product.supplier_id", read_only=True)
    purchase_price = serializers.DecimalField(source="product.purchase_price", max_digits=12, decimal_places=2,
                                              read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = AIRecommendation
        fields = ["id", "store", "product", "product_name", "sku", "supplier", "purchase_price", "kind", "kind_label",
                  "severity", "title", "reason", "action", "recommended_quantity", "potential_savings", "metrics",
                  "status", "generated_at"]
        read_only_fields = fields
