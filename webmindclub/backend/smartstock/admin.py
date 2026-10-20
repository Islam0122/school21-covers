from django.contrib import admin

from .models import AIRecommendation, InventoryMovement, Product, PurchaseOrder, PurchaseOrderItem, Store, StoreStaff, Supplier

admin.site.register(Store, list_display=["name", "project", "currency"])
admin.site.register(StoreStaff, list_display=["store", "user", "role"])
admin.site.register(Supplier, list_display=["name", "store", "lead_time_days"])
admin.site.register(Product, list_display=["name", "sku", "store", "stock", "min_stock"], search_fields=["name", "sku"])
admin.site.register(InventoryMovement, list_display=["product", "kind", "quantity", "stock_after", "created_at"])
admin.site.register(PurchaseOrder, list_display=["id", "store", "supplier", "status", "expected_delivery"])
admin.site.register(PurchaseOrderItem, list_display=["order", "product", "quantity", "unit_price"])
admin.site.register(AIRecommendation, list_display=["title", "kind", "severity", "status"])
