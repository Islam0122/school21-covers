from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from common.models import TimeStampedModel

MONEY = {"max_digits": 12, "decimal_places": 2, "validators": [MinValueValidator(Decimal("0"))]}


class Store(TimeStampedModel):
    """A SmartStock AI store. Belongs to a WebMindClub project but keeps its own data and roles."""

    project = models.OneToOneField("projects.Project", on_delete=models.CASCADE, related_name="store")
    name = models.CharField(max_length=120)
    currency = models.CharField(max_length=3, default="USD")
    default_lead_time_days = models.PositiveIntegerField(default=5)


class StoreRole(models.TextChoices):
    MANAGER = "store_manager", "Store Manager"
    CLERK = "inventory_clerk", "Inventory Clerk"
    ANALYST = "analyst", "Analyst (read-only)"


class StoreStaff(TimeStampedModel):
    """SmartStock roles are independent from WebMindClub workspace roles."""

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="staff")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="store_roles")
    role = models.CharField(max_length=20, choices=StoreRole.choices, default=StoreRole.ANALYST)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["store", "user"], name="unique_store_staff")]


class Supplier(TimeStampedModel):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=120)
    contact_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    lead_time_days = models.PositiveIntegerField(default=5)

    class Meta:
        ordering = ["name"]


class Product(TimeStampedModel):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=160)
    sku = models.CharField(max_length=40)
    category = models.CharField(max_length=60)
    purchase_price = models.DecimalField(**MONEY)
    sale_price = models.DecimalField(**MONEY)
    stock = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    min_stock = models.PositiveIntegerField(default=0)
    expiry_date = models.DateField(null=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="products")

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["store", "sku"], name="unique_sku_per_store"),
            models.CheckConstraint(condition=models.Q(stock__gte=0), name="product_stock_non_negative"),
        ]

    @property
    def inventory_value(self) -> Decimal:
        return self.purchase_price * self.stock


class InventoryMovement(models.Model):
    """Append-only audit trail of every stock change."""

    class Kind(models.TextChoices):
        INITIAL = "initial", "Initial stock"
        SALE = "sale", "Sale"
        RECEIPT = "receipt", "Purchase receipt"
        ADJUSTMENT = "adjustment", "Manual adjustment"
        WRITE_OFF = "write_off", "Write-off"
        RETURN = "return", "Customer return"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="movements")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    quantity = models.IntegerField(help_text="Signed change in stock.")
    stock_after = models.IntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    reason = models.CharField(max_length=200, blank=True)
    reference = models.CharField(max_length=60, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class PurchaseOrder(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ORDERED = "ordered", "Ordered"
        RECEIVED = "received", "Received"
        CANCELLED = "cancelled", "Cancelled"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="orders")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    expected_delivery = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    received_at = models.DateTimeField(null=True, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")

    class Meta:
        ordering = ["-created_at"]

    @property
    def total(self) -> Decimal:
        return sum((i.quantity * i.unit_price for i in self.items.all()), Decimal("0"))


class PurchaseOrderItem(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(**MONEY)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["order", "product"], name="unique_product_per_order")]


class AIRecommendation(models.Model):
    class Kind(models.TextChoices):
        STOCKOUT = "stockout", "Risk of stockout"
        OVERSTOCK = "overstock", "Overstock"
        EXPIRY = "expiry", "Expiry risk"
        REORDER = "reorder", "Recommended purchase"

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        DISMISSED = "dismissed", "Dismissed"
        APPLIED = "applied", "Applied"

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="recommendations")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="recommendations")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    severity = models.CharField(max_length=10, choices=Severity.choices)
    title = models.CharField(max_length=200)
    reason = models.TextField()
    action = models.TextField()
    recommended_quantity = models.PositiveIntegerField(default=0)
    potential_savings = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    metrics = models.JSONField(default=dict)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-generated_at", "id"]
