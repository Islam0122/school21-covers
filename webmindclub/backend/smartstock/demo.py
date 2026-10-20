"""Creates the SmartStock AI demo project inside a workspace (idempotent per workspace)."""
import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from builder.registry import default_block as b, validate_content
from builder.models import ThemeConfiguration, WebsitePage
from builder.registry import PRESETS_BY_KEY
from collaboration.activity import log_activity
from collaboration.models import Task
from projects.models import Project, ProjectMembership, unique_project_slug
from workspaces.models import WorkspaceMembership, WorkspaceRole

from .models import InventoryMovement, Product, Store, StoreRole, StoreStaff, Supplier
from .services import apply_movement, regenerate_recommendations

User = get_user_model()

DEMO_MEMBERS = [
    ("Amina Karimova", "amina.designer@demo.webmindclub.local", WorkspaceRole.DESIGNER, "editor"),
    ("Daniyar Asanov", "daniyar.dev@demo.webmindclub.local", WorkspaceRole.DEVELOPER, "editor"),
    ("Mira Chen", "mira.pm@demo.webmindclub.local", WorkspaceRole.PROJECT_MANAGER, "lead"),
    ("Leo Petrov", "leo.viewer@demo.webmindclub.local", WorkspaceRole.VIEWER, "viewer"),
]

SUPPLIERS = [("FreshFarm Distribution", 2), ("Global Foods Wholesale", 6), ("HomeCare Supply Co.", 4), ("Daily Bakery", 1)]

# name, sku, category, purchase, sale, stock, min, expiry_days, supplier_idx, daily_sales
PRODUCTS = [
    ("Whole Milk 1L", "DAI-001", "Dairy", "0.65", "1.19", 28, 30, 6, 0, 9.0),
    ("Greek Yogurt 500g", "DAI-002", "Dairy", "1.10", "2.29", 64, 20, 4, 0, 3.0),
    ("Cheddar Cheese 200g", "DAI-003", "Dairy", "1.80", "3.49", 45, 15, 40, 0, 2.0),
    ("Free-range Eggs (12)", "DAI-004", "Dairy", "1.90", "3.79", 12, 25, 14, 0, 6.5),
    ("Sourdough Bread", "BAK-001", "Bakery", "1.20", "3.20", 18, 10, 2, 3, 7.0),
    ("Croissant (4 pack)", "BAK-002", "Bakery", "1.40", "3.90", 30, 8, 1, 3, 4.0),
    ("Basmati Rice 2kg", "PAN-001", "Pantry", "2.40", "4.99", 410, 40, 365, 1, 3.0),
    ("Olive Oil 750ml", "PAN-002", "Pantry", "4.20", "8.49", 36, 12, 300, 1, 1.5),
    ("Spaghetti 500g", "PAN-003", "Pantry", "0.55", "1.29", 140, 50, 400, 1, 6.0),
    ("Canned Tomatoes 400g", "PAN-004", "Pantry", "0.45", "0.99", 22, 40, 500, 1, 5.0),
    ("Ground Coffee 250g", "BEV-001", "Beverages", "3.10", "6.99", 55, 15, 200, 1, 2.5),
    ("Green Tea (20 bags)", "BEV-002", "Beverages", "1.20", "2.79", 260, 20, 420, 1, 0.8),
    ("Sparkling Water 1.5L", "BEV-003", "Beverages", "0.30", "0.89", 96, 48, 240, 1, 12.0),
    ("Orange Juice 1L", "BEV-004", "Beverages", "1.05", "2.49", 20, 18, 9, 0, 3.5),
    ("Bananas (1kg)", "PRO-001", "Produce", "0.70", "1.49", 40, 25, 5, 0, 10.0),
    ("Avocados (2 pack)", "PRO-002", "Produce", "1.30", "2.99", 35, 12, 3, 0, 2.0),
    ("Dish Soap 500ml", "HOM-001", "Household", "0.90", "2.19", 75, 15, 0, 2, 1.2),
    ("Paper Towels (6 rolls)", "HOM-002", "Household", "3.20", "6.49", 8, 12, 0, 2, 2.2),
    ("Laundry Detergent 2L", "HOM-003", "Household", "5.10", "10.99", 140, 10, 0, 2, 0.6),
    ("Dark Chocolate 100g", "SNK-001", "Snacks", "0.95", "2.39", 70, 20, 120, 1, 2.8),
]

TASKS = [
    ("Design SmartStock AI dashboard", "done", "high", 1, -10),
    ("Implement inventory CRUD API", "done", "high", 2, -6),
    ("Build explainable recommendation engine", "review", "urgent", 2, 2),
    ("Purchase order receiving flow", "in_progress", "high", 2, 4),
    ("Marketing site: hero & features", "in_progress", "medium", 1, 5),
    ("Write onboarding copy", "todo", "low", 3, 9),
    ("Usability test with 5 store owners", "todo", "medium", 3, 12),
    ("Prepare launch checklist", "todo", "medium", 3, 15),
]


def _ensure_demo_user(full_name, email):
    user, created = User.objects.get_or_create(email=email, defaults={"full_name": full_name, "is_demo": True})
    if created:
        user.set_unusable_password()
        user.save()
    return user


def _site_pages(brand):
    nav = b("navbar", props={"brand": brand, "links": [
        {"label": "Home", "href": "/"}, {"label": "Features", "href": "/features"},
        {"label": "Pricing", "href": "/pricing"}, {"label": "Contact", "href": "/contact"}],
        "ctaLabel": "Request demo", "ctaHref": "/contact"})
    footer = b("footer", props={"brand": brand, "text": "© 2026 SmartStock AI — a WebMindClub product."})
    return [
        ("Home", "home", True, [
            nav,
            b("hero", props={"eyebrow": "AI-powered retail management", "heading": "Inventory intelligence for modern retail",
                             "subheading": "SmartStock AI predicts stockouts, flags overstock and expiry risk, and tells you exactly what to order — with a clear reason for every recommendation.",
                             "primaryLabel": "Request a demo", "primaryHref": "/contact",
                             "secondaryLabel": "See features", "secondaryHref": "/features"}),
            b("stats", props={"items": [{"value": "−32%", "label": "Stockouts"}, {"value": "−18%", "label": "Waste from expiry"},
                                        {"value": "4h", "label": "Saved per week"}]}),
            b("features", props={"title": "Everything a store needs", "items": [
                {"icon": "package", "title": "Live inventory", "text": "Track stock, prices and expiry dates for every SKU."},
                {"icon": "sparkles", "title": "Explainable insights", "text": "Each recommendation shows the numbers behind it."},
                {"icon": "shopping-cart", "title": "Purchase orders", "text": "Turn insights into orders and receive stock in one click."}]}),
            b("testimonials", props={"title": "Loved by store owners", "items": [
                {"quote": "We stopped running out of milk on Saturdays.", "author": "Store owner", "role": "Neighbourhood grocery"},
                {"quote": "The expiry alerts paid for themselves in a month.", "author": "Operations lead", "role": "Mini-market chain"}]}),
            footer]),
        ("Features", "features", False, [
            nav, b("heading", props={"text": "Features", "level": "h1"}, style={"align": "center"}),
            b("features", props={"title": "", "columns": "2", "items": [
                {"icon": "trending-up", "title": "Stockout prediction", "text": "Days-of-cover vs. supplier lead time."},
                {"icon": "box", "title": "Overstock detection", "text": "Find capital tied up in slow movers."},
                {"icon": "clock", "title": "Expiry risk", "text": "Projected sell-through before the expiry date."},
                {"icon": "bar-chart", "title": "Sales analytics", "text": "30-day revenue and category breakdowns."}]}),
            footer]),
        ("Pricing", "pricing", False, [nav, b("pricing", props={"items": [
            {"name": "Starter", "price": "$0", "period": "/month", "features": "1 store\n200 products\nAI insights",
             "highlighted": False, "ctaLabel": "Start free", "ctaHref": "/contact"},
            {"name": "Business", "price": "$39", "period": "/month", "features": "3 stores\nUnlimited products\nPurchase orders\nPriority support",
             "highlighted": True, "ctaLabel": "Request demo", "ctaHref": "/contact"}]}), b("faq"), footer]),
        ("Contact", "contact", False, [nav, b("contact", props={"title": "Request a demo"}), footer]),
    ]


@transaction.atomic
def create_smartstock_demo(workspace, owner, rng_seed=21) -> Project:
    rng = random.Random(rng_seed)
    WorkspaceMembership.objects.get_or_create(workspace=workspace, user=owner, defaults={"role": WorkspaceRole.OWNER})
    project = Project.objects.create(
        workspace=workspace, name="SmartStock AI", slug=unique_project_slug(workspace.pk, "smartstock-ai"),
        description="AI-powered inventory intelligence for modern retail. Predicts stockouts, overstock and expiry risk "
                    "and recommends purchase quantities with explainable reasoning.",
        project_type=Project.Type.SAAS, status=Project.Status.IN_PROGRESS, visibility=Project.Visibility.WORKSPACE,
        template="saas_dashboard", owner=owner)
    ProjectMembership.objects.create(project=project, user=owner, role=ProjectMembership.Role.LEAD)

    members = [owner]
    for full_name, email, ws_role, project_role in DEMO_MEMBERS:
        user = _ensure_demo_user(full_name, email)
        WorkspaceMembership.objects.get_or_create(workspace=workspace, user=user, defaults={"role": ws_role})
        ProjectMembership.objects.get_or_create(project=project, user=user, defaults={"role": project_role})
        members.append(user)

    tokens = dict(PRESETS_BY_KEY["modern-dark"]["tokens"])
    tokens.update({"primary": "#2563EB", "secondary": "#06B6D4"})
    ThemeConfiguration.objects.create(project=project, preset="custom", tokens=tokens)
    for i, (title, slug, is_home, blocks) in enumerate(_site_pages("SmartStock AI")):
        WebsitePage.objects.create(project=project, title=title, slug=slug, is_home=is_home, position=i,
                                   seo_title=f"{title} · SmartStock AI", seo_description="AI-powered inventory intelligence for modern retail.",
                                   content=validate_content({"blocks": blocks}))

    today = timezone.localdate()
    for title, status, priority, member_idx, due in TASKS:
        Task.objects.create(project=project, title=title, status=status, priority=priority, assignee=members[member_idx],
                            due_date=today + timedelta(days=due), created_by=owner)

    store = Store.objects.create(project=project, name="SmartStock Demo Market", currency="USD")
    StoreStaff.objects.create(store=store, user=owner, role=StoreRole.MANAGER)
    StoreStaff.objects.create(store=store, user=members[2], role=StoreRole.CLERK)
    StoreStaff.objects.create(store=store, user=members[3], role=StoreRole.ANALYST)
    suppliers = [Supplier.objects.create(store=store, name=n, lead_time_days=lt) for n, lt in SUPPLIERS]

    now = timezone.now()
    for name, sku, cat, buy, sell, stock, min_stock, exp_days, sup, daily in PRODUCTS:
        product = Product.objects.create(
            store=store, name=name, sku=sku, category=cat, purchase_price=Decimal(buy), sale_price=Decimal(sell),
            stock=0, min_stock=min_stock, supplier=suppliers[sup],
            expiry_date=today + timedelta(days=exp_days) if exp_days else None)
        total_sales = [max(0, round(rng.gauss(daily, daily * 0.35))) for _ in range(30)]
        apply_movement(product, kind=InventoryMovement.Kind.INITIAL, quantity=stock + sum(total_sales), user=owner,
                       reason="Opening balance", at=now - timedelta(days=31))
        for day, units in enumerate(total_sales):
            if units:
                apply_movement(product, kind=InventoryMovement.Kind.SALE, quantity=units, user=owner, reason="POS sales",
                               at=now - timedelta(days=30 - day, hours=rng.randint(0, 8)))
    regenerate_recommendations(store)
    log_activity(actor=owner, workspace=workspace, project=project, verb="created", target=project,
                 message="created the SmartStock AI demo project")
    return project
