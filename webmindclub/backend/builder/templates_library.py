"""Starter templates used by the Create Project wizard."""
from .registry import default_block as b

TEMPLATES = {
    "blank": {"name": "Blank Project", "description": "Start from an empty page.", "preset": "minimal-light"},
    "saas_dashboard": {"name": "SaaS Dashboard", "description": "Product marketing site for a SaaS app.", "preset": "indigo-saas"},
    "ecommerce": {"name": "E-commerce Store", "description": "Storefront with product grid.", "preset": "retail-fresh"},
    "landing": {"name": "Landing Page", "description": "Single page focused on conversion.", "preset": "tech-blue"},
    "portfolio": {"name": "Portfolio", "description": "Showcase work and contact details.", "preset": "minimal-light"},
}


def _nav(brand, links):
    return b("navbar", props={"brand": brand, "links": [{"label": l, "href": h} for l, h in links]})


def template_pages(template: str, brand: str) -> list[dict]:
    """Return a list of page dicts (title, slug, is_home, blocks) for the template."""
    footer = b("footer", props={"brand": brand, "text": f"© 2026 {brand}. All rights reserved."})
    if template == "blank":
        return [{"title": "Home", "slug": "home", "is_home": True, "blocks": []}]
    if template == "saas_dashboard":
        nav = _nav(brand, [("Home", "/"), ("Pricing", "/pricing"), ("Contact", "/contact")])
        return [
            {"title": "Home", "slug": "home", "is_home": True, "blocks": [
                nav, b("hero", props={"heading": f"{brand} helps teams move faster", "eyebrow": "SaaS platform"}),
                b("stats"), b("features"), b("testimonials"), footer]},
            {"title": "Pricing", "slug": "pricing", "is_home": False, "blocks": [nav, b("pricing"), b("faq"), footer]},
            {"title": "Contact", "slug": "contact", "is_home": False, "blocks": [nav, b("contact"), footer]},
        ]
    if template == "ecommerce":
        nav = _nav(brand, [("Home", "/"), ("Products", "/products"), ("Contact", "/contact")])
        return [
            {"title": "Home", "slug": "home", "is_home": True, "blocks": [
                nav, b("hero", props={"heading": f"Shop the {brand} collection", "eyebrow": "New season"}),
                b("products"), b("features", props={"title": "Why shop with us"}), footer]},
            {"title": "Products", "slug": "products", "is_home": False, "blocks": [nav, b("products", props={"title": "All products"}), footer]},
            {"title": "Contact", "slug": "contact", "is_home": False, "blocks": [nav, b("contact"), footer]},
        ]
    if template == "landing":
        return [{"title": "Home", "slug": "home", "is_home": True, "blocks": [
            _nav(brand, [("Features", "#features"), ("Pricing", "#pricing"), ("FAQ", "#faq")]),
            b("hero", props={"heading": f"Meet {brand}"}), b("features"), b("pricing"), b("faq"), footer]}]
    if template == "portfolio":
        nav = _nav(brand, [("Work", "/"), ("About", "/about"), ("Contact", "/contact")])
        return [
            {"title": "Work", "slug": "home", "is_home": True, "blocks": [
                nav, b("hero", props={"heading": "Design & development portfolio", "eyebrow": brand,
                                      "secondaryLabel": "", "primaryLabel": "Contact me", "primaryHref": "/contact"}),
                b("products", props={"title": "Selected work"}), footer]},
            {"title": "About", "slug": "about", "is_home": False, "blocks": [
                nav, b("heading", props={"text": "About me", "level": "h1"}), b("paragraph"), footer]},
            {"title": "Contact", "slug": "contact", "is_home": False, "blocks": [nav, b("contact"), footer]},
        ]
    raise KeyError(template)
