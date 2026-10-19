from datetime import date, timedelta
from decimal import Decimal

import pytest

from smartstock.models import AIRecommendation, Product, Store, StoreStaff, Supplier
from smartstock.services import analyse_product
from workspaces.models import WorkspaceMembership

pytestmark = pytest.mark.django_db


@pytest.fixture
def store(api, project):
    res = api.post("/api/smartstock/stores/", {"project": project.pk, "name": "Test Market"}, format="json")
    assert res.status_code == 201, res.data
    return Store.objects.get(pk=res.data["id"])


@pytest.fixture
def supplier(api, store):
    res = api.post("/api/smartstock/suppliers/", {"store": store.pk, "name": "Acme", "lead_time_days": 3}, format="json")
    return Supplier.objects.get(pk=res.data["id"])


def make_product(api, store, supplier=None, **kw):
    data = {"store": store.pk, "name": "Milk", "sku": "mil-1", "category": "Dairy", "purchase_price": "0.50",
            "sale_price": "1.00", "stock": 10, "min_stock": 5, **kw}
    if supplier:
        data["supplier"] = supplier.pk
    return api.post("/api/smartstock/products/", data, format="json")


def test_product_crud_search_filter_export(api, store, supplier):
    res = make_product(api, store, supplier)
    assert res.status_code == 201, res.data
    pid = res.data["id"]
    assert res.data["sku"] == "MIL-1" and res.data["inventory_value"] == "5.00"
    assert make_product(api, store).status_code == 400  # duplicate SKU
    assert make_product(api, store, sku="X", sale_price="0.10").status_code == 400  # sale < purchase
    make_product(api, store, name="Bread", sku="BRD-1", category="Bakery", stock=0)
    listed = api.get(f"/api/smartstock/products/?store={store.pk}&search=bread").data["results"]
    assert [p["name"] for p in listed] == ["Bread"]
    out = api.get(f"/api/smartstock/products/?store={store.pk}&stock_status=out").data["results"]
    assert [p["sku"] for p in out] == ["BRD-1"]
    by_stock = api.get(f"/api/smartstock/products/?store={store.pk}&ordering=-stock").data["results"]
    assert by_stock[0]["sku"] == "MIL-1"
    upd = api.patch(f"/api/smartstock/products/{pid}/", {"sale_price": "1.20"}, format="json")
    assert upd.data["sale_price"] == "1.20"
    assert api.patch(f"/api/smartstock/products/{pid}/", {"stock": 99}, format="json").status_code == 400
    csv = api.get(f"/api/smartstock/products/export/?store={store.pk}")
    assert csv.status_code == 200 and b"MIL-1" in csv.content
    assert api.delete(f"/api/smartstock/products/{pid}/").status_code == 204


def test_csv_export_neutralises_formulas(api, store):
    make_product(api, store, name="=HYPERLINK(\"http://x\")", sku="EVIL")
    body = api.get(f"/api/smartstock/products/export/?store={store.pk}").content.decode()
    assert "'=HYPERLINK" in body


def test_stock_adjustment_and_audit(api, store):
    pid = make_product(api, store).data["id"]
    res = api.post(f"/api/smartstock/products/{pid}/adjust/", {"kind": "sale", "quantity": 4}, format="json")
    assert res.data["stock"] == 6
    res = api.post(f"/api/smartstock/products/{pid}/adjust/", {"kind": "adjustment", "quantity": -2, "reason": "count"}, format="json")
    assert res.data["stock"] == 4
    too_many = api.post(f"/api/smartstock/products/{pid}/adjust/", {"kind": "sale", "quantity": 50}, format="json")
    assert too_many.status_code == 400 and "Insufficient" in too_many.data["errors"]["quantity"][0]
    moves = api.get(f"/api/smartstock/movements/?store={store.pk}&product={pid}").data["results"]
    assert [m["kind"] for m in moves] == ["adjustment", "sale", "initial"]
    assert [m["stock_after"] for m in moves] == [4, 6, 10]


def test_purchase_order_receive_updates_stock(api, store, supplier):
    pid = make_product(api, store, supplier).data["id"]
    res = api.post("/api/smartstock/orders/", {"store": store.pk, "supplier": supplier.pk, "expected_delivery": "2026-11-01",
                                               "items": [{"product": pid, "quantity": 20, "unit_price": "0.45"}]}, format="json")
    assert res.status_code == 201, res.data
    oid = res.data["id"]
    assert res.data["total"] == "9.00"
    assert api.post(f"/api/smartstock/orders/{oid}/receive/").status_code == 400  # must be ordered first
    assert api.post(f"/api/smartstock/orders/{oid}/place/").data["status"] == "ordered"
    assert api.patch(f"/api/smartstock/orders/{oid}/", {"notes": "x"}, format="json").status_code == 400
    received = api.post(f"/api/smartstock/orders/{oid}/receive/")
    assert received.data["status"] == "received"
    product = Product.objects.get(pk=pid)
    assert product.stock == 30 and product.purchase_price == Decimal("0.45")
    assert api.post(f"/api/smartstock/orders/{oid}/receive/").status_code == 400  # no double receipt
    assert api.post(f"/api/smartstock/orders/{oid}/cancel/").status_code == 400


def test_order_rejects_foreign_products(api, store, supplier, make_user, client_for):
    other = make_user(email="other@example.com", name="Other")
    oc = client_for(other)
    ws = other.workspaces.first()
    p = oc.post("/api/projects/", {"workspace": ws.pk, "name": "Other"}, format="json").data["id"]
    s2 = oc.post("/api/smartstock/stores/", {"project": p, "name": "S2"}, format="json").data["id"]
    foreign = oc.post("/api/smartstock/products/", {"store": s2, "name": "F", "sku": "F", "category": "c",
                                                    "purchase_price": "1", "sale_price": "2"}, format="json").data["id"]
    res = api.post("/api/smartstock/orders/", {"store": store.pk, "supplier": supplier.pk,
                                               "items": [{"product": foreign, "quantity": 1, "unit_price": "1"}]}, format="json")
    assert res.status_code == 400
    assert api.get(f"/api/smartstock/products/{foreign}/").status_code == 404
    assert api.get(f"/api/smartstock/products/?store={s2}").status_code == 404


def test_store_roles_are_separate_from_workspace_roles(api, store, workspace, project, make_user, client_for):
    admin = make_user(email="admin@example.com", with_workspace=False)
    WorkspaceMembership.objects.create(workspace=workspace, user=admin, role="admin")
    c = client_for(admin)
    assert c.get(f"/api/projects/{project.pk}/").status_code == 200  # workspace admin sees project
    assert c.get(f"/api/smartstock/stores/{store.pk}/").status_code == 404  # but not store data
    api.post(f"/api/smartstock/stores/{store.pk}/staff/", {"user_id": admin.pk, "role": "analyst"}, format="json")
    assert c.get(f"/api/smartstock/stores/{store.pk}/dashboard/").status_code == 200
    assert make_product(c, store, sku="NEW").status_code == 403  # analyst is read-only


def test_recommendation_engine_is_explainable():
    sup = Supplier(name="Acme", lead_time_days=5)
    p = Product(name="Milk", sku="M", category="Dairy", purchase_price=Decimal("1"), sale_price=Decimal("2"),
                stock=10, min_stock=5, supplier=sup)
    recs = analyse_product(p, units_sold=90, on_order=0, default_lead_time=5, today=date(2026, 1, 1))
    stockout = recs[0]
    assert stockout["kind"] == AIRecommendation.Kind.STOCKOUT and stockout["severity"] == "high"
    # avg 3/day; target = 3 * (5 + 14) + 5 = 62; order 62 - 10 = 52
    assert stockout["recommended_quantity"] == 52
    assert "3.0 units/day" in stockout["reason"] and "Order 52 units from Acme" in stockout["action"]

    over = Product(name="Rice", sku="R", category="Pantry", purchase_price=Decimal("2"), sale_price=Decimal("4"),
                   stock=500, min_stock=10)
    recs = analyse_product(over, units_sold=30, on_order=0, default_lead_time=5, today=date(2026, 1, 1))
    assert recs[0]["kind"] == AIRecommendation.Kind.OVERSTOCK
    assert recs[0]["metrics"]["excess_units"] == 500 - 60 - 10

    exp = Product(name="Yogurt", sku="Y", category="Dairy", purchase_price=Decimal("1"), sale_price=Decimal("2"),
                  stock=40, min_stock=5, expiry_date=date(2026, 1, 5))
    recs = analyse_product(exp, units_sold=60, on_order=0, default_lead_time=5, today=date(2026, 1, 1))
    expiry = next(r for r in recs if r["kind"] == AIRecommendation.Kind.EXPIRY)
    assert expiry["metrics"]["units_at_risk"] == 40 - 8 and expiry["severity"] == "high"


def test_insights_to_purchase_order(api, store, supplier):
    pid = make_product(api, store, supplier, stock=1, min_stock=10).data["id"]
    recs = api.post(f"/api/smartstock/stores/{store.pk}/regenerate-insights/").data
    rec = next(r for r in recs if r["product"] == pid and r["recommended_quantity"] > 0)
    order = api.post(f"/api/smartstock/recommendations/{rec['id']}/create-order/")
    assert order.status_code == 201 and order.data["status"] == "draft"
    assert order.data["items"][0]["quantity"] == rec["recommended_quantity"]
    assert AIRecommendation.objects.get(pk=rec["id"]).status == "applied"


def test_demo_seed(owner, workspace, client_for):
    from smartstock.demo import create_smartstock_demo

    project = create_smartstock_demo(workspace, owner)
    c = client_for(owner)
    dash = c.get(f"/api/smartstock/stores/{project.store.pk}/dashboard/").data
    assert dash["products"] == 20 and Decimal(dash["sales_30d"]) > 0 and dash["open_insights"] > 0
    kinds = set(project.store.recommendations.values_list("kind", flat=True))
    assert {"stockout", "overstock", "expiry"} <= kinds
    assert project.pages.count() == 4 and project.tasks.count() == 8
    assert StoreStaff.objects.filter(store=project.store).count() == 3
    assert c.post(f"/api/workspaces/{workspace.pk}/load-demo/").status_code == 400  # already exists
