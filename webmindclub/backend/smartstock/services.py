"""SmartStock business logic: audited stock movements, purchase receipts and the
explainable recommendation engine."""
from __future__ import annotations

import math
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import AIRecommendation, InventoryMovement, Product, PurchaseOrder, Store

SALES_WINDOW_DAYS = 30
COVER_TARGET_DAYS = 14
OVERSTOCK_DAYS = 90
EXPIRY_HORIZON_DAYS = 30
HOLDING_COST_RATE = Decimal("0.25")  # annual carrying cost estimate for overstock

OUTBOUND = {InventoryMovement.Kind.SALE, InventoryMovement.Kind.WRITE_OFF}
INBOUND = {InventoryMovement.Kind.RECEIPT, InventoryMovement.Kind.RETURN, InventoryMovement.Kind.INITIAL}


def money(value) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@transaction.atomic
def apply_movement(product: Product, *, kind: str, quantity: int, user=None, reason="", reference="",
                   unit_price=None, at=None) -> InventoryMovement:
    """Apply a stock change under a row lock and record it in the audit trail.

    ``quantity`` is a positive amount for sales, receipts, returns and write-offs,
    and a signed delta for manual adjustments.
    """
    if kind not in InventoryMovement.Kind.values:
        raise ValidationError({"kind": "Unknown movement type."})
    if not isinstance(quantity, int) or quantity == 0:
        raise ValidationError({"quantity": "Quantity must be a non-zero whole number."})
    if kind != InventoryMovement.Kind.ADJUSTMENT and quantity < 0:
        raise ValidationError({"quantity": "Quantity must be positive for this movement type."})
    delta = -quantity if kind in OUTBOUND else quantity
    locked = Product.objects.select_for_update().get(pk=product.pk)
    new_stock = locked.stock + delta
    if new_stock < 0:
        raise ValidationError({"quantity": f"Insufficient stock: only {locked.stock} units available."})
    locked.stock = new_stock
    locked.save(update_fields=["stock", "updated_at"])
    if unit_price is None and kind == InventoryMovement.Kind.SALE:
        unit_price = locked.sale_price
    movement = InventoryMovement.objects.create(
        product=locked, kind=kind, quantity=delta, stock_after=new_stock, unit_price=unit_price,
        reason=reason[:200], reference=reference[:60], created_by=user if user and user.is_authenticated else None,
        created_at=at or timezone.now(),
    )
    product.stock = new_stock
    return movement


@transaction.atomic
def receive_order(order: PurchaseOrder, user) -> PurchaseOrder:
    order = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != PurchaseOrder.Status.ORDERED:
        raise ValidationError({"status": "Only orders with status 'Ordered' can be received."})
    for item in order.items.select_related("product"):
        apply_movement(item.product, kind=InventoryMovement.Kind.RECEIPT, quantity=item.quantity, user=user,
                       unit_price=item.unit_price, reference=f"PO-{order.pk}", reason=f"Received from {order.supplier.name}")
        if item.product.purchase_price != item.unit_price:
            Product.objects.filter(pk=item.product_id).update(purchase_price=item.unit_price)
    order.status = PurchaseOrder.Status.RECEIVED
    order.received_at = timezone.now()
    order.received_by = user
    order.save(update_fields=["status", "received_at", "received_by", "updated_at"])
    return order


def sales_by_product(store: Store, days=SALES_WINDOW_DAYS) -> dict[int, int]:
    since = timezone.now() - timedelta(days=days)
    rows = (InventoryMovement.objects.filter(product__store=store, kind=InventoryMovement.Kind.SALE, created_at__gte=since)
            .values("product_id").annotate(units=Sum("quantity")))
    return {r["product_id"]: -r["units"] for r in rows}


def on_order_by_product(store: Store) -> dict[int, int]:
    rows = (PurchaseOrder.objects.filter(store=store, status=PurchaseOrder.Status.ORDERED)
            .values("items__product_id").annotate(units=Sum("items__quantity")))
    return {r["items__product_id"]: r["units"] for r in rows if r["items__product_id"]}


def analyse_product(product: Product, units_sold: int, on_order: int, default_lead_time: int, today=None,
                    currency: str = "USD") -> list[dict]:
    """Pure function producing explainable recommendations for one product."""
    today = today or timezone.localdate()
    recs: list[dict] = []
    avg = units_sold / SALES_WINDOW_DAYS
    supplier_obj = product.supplier
    lead = supplier_obj.lead_time_days if supplier_obj else default_lead_time
    supplier = supplier_obj.name if supplier_obj else "your supplier"
    cover = product.stock / avg if avg > 0 else math.inf
    reorder_point = math.ceil(avg * lead) + product.min_stock
    metrics = {"avg_daily_sales": round(avg, 2), "units_sold_30d": units_sold, "stock": product.stock,
               "min_stock": product.min_stock, "lead_time_days": lead, "on_order": on_order,
               "days_of_cover": None if math.isinf(cover) else round(cover, 1), "reorder_point": reorder_point}

    available = product.stock + on_order
    if available <= reorder_point and (avg > 0 or product.stock < product.min_stock):
        target = math.ceil(avg * (lead + COVER_TARGET_DAYS)) + product.min_stock
        qty = max(target - available, 0)
        if qty > 0:
            urgent = avg > 0 and cover < lead
            cover_txt = f"covers about {cover:.1f} days" if avg > 0 else "has no recent sales"
            recs.append({
                "kind": AIRecommendation.Kind.STOCKOUT if urgent else AIRecommendation.Kind.REORDER,
                "severity": AIRecommendation.Severity.HIGH if urgent or product.stock == 0 else AIRecommendation.Severity.MEDIUM,
                "title": f"{'Stockout risk' if urgent else 'Reorder'}: {product.name}",
                "reason": (f"Sells ~{avg:.1f} units/day ({units_sold} in the last {SALES_WINDOW_DAYS} days). "
                           f"Current stock of {product.stock} {cover_txt}"
                           f"{f' plus {on_order} already on order' if on_order else ''}; "
                           f"supplier lead time is {lead} days and minimum stock is {product.min_stock}."),
                "action": (f"Order {qty} units from {supplier} to cover the lead time plus {COVER_TARGET_DAYS} days "
                           f"of demand and restore the minimum stock level."),
                "recommended_quantity": qty,
                "potential_savings": money(min(qty, math.ceil(avg * lead)) * (product.sale_price - product.purchase_price))
                if urgent else money(0),
                "metrics": {**metrics, "target_stock": target},
            })

    if product.stock > 0 and cover > OVERSTOCK_DAYS and product.stock > max(product.min_stock * 3, 10):
        keep = math.ceil(avg * 60) + product.min_stock
        excess = product.stock - keep
        if excess > 0:
            capital = money(excess * product.purchase_price)
            savings = money(capital * HOLDING_COST_RATE)
            cover_txt = f"~{cover:.0f} days of stock" if avg > 0 else "stock with no sales in 30 days"
            recs.append({
                "kind": AIRecommendation.Kind.OVERSTOCK, "severity": AIRecommendation.Severity.MEDIUM if capital > 200 else AIRecommendation.Severity.LOW,
                "title": f"Overstock: {product.name}",
                "reason": (f"{product.stock} units on hand is {cover_txt} at the current sales rate ({avg:.1f}/day). "
                           f"About {excess} units ({capital} {currency} of capital) exceed a 60-day supply."),
                "action": (f"Pause reordering and run a 10–15% promotion to sell down ~{excess} units. "
                           f"Releasing this stock avoids an estimated {savings} {currency} in yearly carrying cost (25% rate)."),
                "recommended_quantity": 0, "potential_savings": savings,
                "metrics": {**metrics, "excess_units": excess, "capital_tied": str(capital)},
            })

    if product.expiry_date and product.stock > 0:
        days_left = (product.expiry_date - today).days
        if days_left <= EXPIRY_HORIZON_DAYS:
            sellable = math.floor(avg * max(days_left, 0))
            at_risk = product.stock - sellable
            if at_risk > 0:
                loss = money(at_risk * product.purchase_price)
                expired = days_left < 0
                recs.append({
                    "kind": AIRecommendation.Kind.EXPIRY,
                    "severity": AIRecommendation.Severity.HIGH if days_left <= 7 else AIRecommendation.Severity.MEDIUM,
                    "title": f"{'Expired' if expired else 'Expiry risk'}: {product.name}",
                    "reason": (f"{'Expired ' + str(-days_left) + ' days ago' if expired else f'Expires in {days_left} days'} "
                               f"({product.expiry_date.isoformat()}). At ~{avg:.1f} units/day only ~{sellable} of "
                               f"{product.stock} units are expected to sell in time, leaving {at_risk} at risk."),
                    "action": ("Remove expired units from sale and record a write-off." if expired else
                               f"Discount by 20–30% and move to a high-visibility shelf; do not reorder before "
                               f"the batch is sold. Up to {loss} {currency} in purchase cost can be recovered."),
                    "recommended_quantity": 0, "potential_savings": money(0) if expired else loss,
                    "metrics": {**metrics, "days_to_expiry": days_left, "units_at_risk": at_risk},
                })
    return recs


@transaction.atomic
def regenerate_recommendations(store: Store) -> list[AIRecommendation]:
    sold = sales_by_product(store)
    on_order = on_order_by_product(store)
    store.recommendations.filter(status=AIRecommendation.Status.OPEN).delete()
    created = []
    for product in store.products.select_related("supplier"):
        for rec in analyse_product(product, sold.get(product.pk, 0), on_order.get(product.pk, 0), store.default_lead_time_days,
                                   currency=store.currency):
            created.append(AIRecommendation(store=store, product=product, **rec))
    AIRecommendation.objects.bulk_create(created)
    return created


def dashboard(store: Store) -> dict:
    products = list(store.products.all())
    since = timezone.now() - timedelta(days=SALES_WINDOW_DAYS)
    sales = InventoryMovement.objects.filter(product__store=store, kind=InventoryMovement.Kind.SALE, created_at__gte=since)
    revenue = Decimal("0")
    units = 0
    daily: dict[str, Decimal] = {}
    for m in sales.only("quantity", "unit_price", "created_at"):
        amount = -m.quantity * (m.unit_price or 0)
        revenue += amount
        units += -m.quantity
        day = timezone.localtime(m.created_at).date().isoformat()
        daily[day] = daily.get(day, Decimal("0")) + amount
    today = timezone.localdate()
    series = []
    for i in range(SALES_WINDOW_DAYS - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        series.append({"date": d, "revenue": float(daily.get(d, 0))})
    categories: dict[str, Decimal] = {}
    for p in products:
        categories[p.category] = categories.get(p.category, Decimal("0")) + p.inventory_value
    open_recs = store.recommendations.filter(status=AIRecommendation.Status.OPEN)
    return {
        "inventory_value": str(money(sum((p.inventory_value for p in products), Decimal("0")))),
        "retail_value": str(money(sum((p.sale_price * p.stock for p in products), Decimal("0")))),
        "products": len(products),
        "low_stock": sum(1 for p in products if p.stock <= p.min_stock),
        "out_of_stock": sum(1 for p in products if p.stock == 0),
        "sales_30d": str(money(revenue)),
        "units_sold_30d": units,
        "potential_savings": str(money(open_recs.aggregate(s=Sum("potential_savings"))["s"] or 0)),
        "open_insights": open_recs.count(),
        "sales_series": series,
        "category_value": [{"category": k, "value": float(v)} for k, v in sorted(categories.items(), key=lambda x: -x[1])],
    }
