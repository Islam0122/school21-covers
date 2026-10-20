"""Allow-listed component registry for the Website Builder.

This module is the single source of truth for which components exist, which
properties they accept and their default values. Page content submitted by
clients is validated and normalised against it: unknown component types or
properties are rejected, strings are length-limited, links are restricted to
safe schemes and nothing executable is ever stored. The frontend renders all
text as plain text (never as HTML).
"""
from __future__ import annotations

import re
import uuid
from copy import deepcopy

from rest_framework.exceptions import ValidationError

ICONS = [
    "sparkles", "zap", "shield", "layers", "rocket", "bar-chart", "users", "globe", "box",
    "shopping-cart", "heart", "star", "clock", "settings", "smartphone", "cpu", "package", "trending-up",
]
FONTS = ["Inter", "Manrope", "Poppins", "Space Grotesk", "DM Sans", "Playfair Display", "Lora", "Roboto"]

HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
SAFE_LINK_RE = re.compile(r"^(?:/(?!/)[^\s]*|#[\w\-]*|https?://[^\s]+|mailto:[^\s]+|tel:[+\d\-\s()]+)?$", re.I)
SAFE_IMAGE_RE = re.compile(r"^(?:https?://[^\s\"'<>]+|/media/[\w\-./]+)?$", re.I)


def f(type_, label, default="", **extra):
    return {"type": type_, "label": label, "default": default, **extra}


def lst(label, item_fields, default, max_items=12):
    return {"type": "list", "label": label, "fields": item_fields, "default": default, "max": max_items}


LINK_ITEM = {"label": f("text", "Label", max=40), "href": f("url", "Link")}

COMPONENTS: dict[str, dict] = {
    "navbar": {
        "label": "Navbar", "category": "Navigation",
        "props": {
            "brand": f("text", "Brand name", "Brand", max=60),
            "links": lst("Links", LINK_ITEM, [
                {"label": "Home", "href": "/"}, {"label": "About", "href": "/about"}, {"label": "Contact", "href": "/contact"},
            ], 8),
            "ctaLabel": f("text", "Button label", "Get started", max=40),
            "ctaHref": f("url", "Button link", "#"),
        },
    },
    "hero": {
        "label": "Hero", "category": "Sections",
        "props": {
            "eyebrow": f("text", "Eyebrow", "New release", max=60),
            "heading": f("text", "Heading", "Build something people love", max=140),
            "subheading": f("textarea", "Subheading", "A short sentence that explains the value of your product.", max=400),
            "primaryLabel": f("text", "Primary button", "Get started", max=40),
            "primaryHref": f("url", "Primary link", "#"),
            "secondaryLabel": f("text", "Secondary button", "Learn more", max=40),
            "secondaryHref": f("url", "Secondary link", "#"),
            "image": f("image", "Image", ""),
        },
    },
    "heading": {
        "label": "Heading", "category": "Basic",
        "props": {
            "text": f("text", "Text", "Section heading", max=160),
            "level": f("select", "Level", "h2", options=["h1", "h2", "h3"]),
        },
    },
    "paragraph": {
        "label": "Paragraph", "category": "Basic",
        "props": {"text": f("textarea", "Text", "Write a short paragraph that tells your story.", max=3000)},
    },
    "image": {
        "label": "Image", "category": "Basic",
        "props": {
            "src": f("image", "Image", ""),
            "alt": f("text", "Alt text", "Image", max=160),
            "caption": f("text", "Caption", "", max=200),
            "height": f("number", "Height (px)", 320, min=80, max=900),
        },
    },
    "button": {
        "label": "Button", "category": "Basic",
        "props": {
            "label": f("text", "Label", "Click me", max=40),
            "href": f("url", "Link", "#"),
            "variant": f("select", "Variant", "primary", options=["primary", "secondary", "outline"]),
        },
    },
    "features": {
        "label": "Feature Cards", "category": "Sections",
        "props": {
            "title": f("text", "Title", "Everything you need", max=120),
            "subtitle": f("textarea", "Subtitle", "", max=300),
            "columns": f("select", "Columns", "3", options=["2", "3", "4"]),
            "items": lst("Features", {
                "icon": f("icon", "Icon", "sparkles", options=ICONS),
                "title": f("text", "Title", max=80),
                "text": f("textarea", "Text", max=300),
            }, [
                {"icon": "zap", "title": "Fast", "text": "Optimised for speed from day one."},
                {"icon": "shield", "title": "Secure", "text": "Built with security best practices."},
                {"icon": "layers", "title": "Flexible", "text": "Adapts to the way your team works."},
            ]),
        },
    },
    "products": {
        "label": "Product Grid", "category": "Commerce",
        "props": {
            "title": f("text", "Title", "Featured products", max=120),
            "items": lst("Products", {
                "name": f("text", "Name", max=80),
                "price": f("text", "Price", max=30),
                "image": f("image", "Image"),
                "badge": f("text", "Badge", max=24),
            }, [
                {"name": "Product one", "price": "$29", "image": "", "badge": "New"},
                {"name": "Product two", "price": "$49", "image": "", "badge": ""},
                {"name": "Product three", "price": "$19", "image": "", "badge": ""},
            ], 16),
        },
    },
    "stats": {
        "label": "Statistics", "category": "Sections",
        "props": {
            "items": lst("Stats", {"value": f("text", "Value", max=20), "label": f("text", "Label", max=60)}, [
                {"value": "10k+", "label": "Customers"}, {"value": "99.9%", "label": "Uptime"}, {"value": "24/7", "label": "Support"},
            ], 6),
        },
    },
    "testimonials": {
        "label": "Testimonials", "category": "Sections",
        "props": {
            "title": f("text", "Title", "What customers say", max=120),
            "items": lst("Testimonials", {
                "quote": f("textarea", "Quote", max=400), "author": f("text", "Author", max=60), "role": f("text", "Role", max=80),
            }, [
                {"quote": "It changed how our team works.", "author": "Alex Doe", "role": "Product Lead"},
                {"quote": "Simple, fast and reliable.", "author": "Sam Lee", "role": "Founder"},
            ], 9),
        },
    },
    "pricing": {
        "label": "Pricing", "category": "Commerce",
        "props": {
            "title": f("text", "Title", "Simple pricing", max=120),
            "items": lst("Plans", {
                "name": f("text", "Plan", max=40), "price": f("text", "Price", max=20), "period": f("text", "Period", max=20),
                "features": f("textarea", "Features (one per line)", max=600),
                "highlighted": f("boolean", "Highlighted", False),
                "ctaLabel": f("text", "Button label", max=30), "ctaHref": f("url", "Button link"),
            }, [
                {"name": "Starter", "price": "$0", "period": "/month", "features": "1 project\nCommunity support",
                 "highlighted": False, "ctaLabel": "Start free", "ctaHref": "#"},
                {"name": "Pro", "price": "$29", "period": "/month", "features": "Unlimited projects\nPriority support\nAnalytics",
                 "highlighted": True, "ctaLabel": "Go Pro", "ctaHref": "#"},
            ], 4),
        },
    },
    "faq": {
        "label": "FAQ", "category": "Sections",
        "props": {
            "title": f("text", "Title", "Frequently asked questions", max=120),
            "items": lst("Questions", {"question": f("text", "Question", max=160), "answer": f("textarea", "Answer", max=800)}, [
                {"question": "How do I get started?", "answer": "Create an account and follow the onboarding steps."},
                {"question": "Can I cancel anytime?", "answer": "Yes, there are no long-term contracts."},
            ], 12),
        },
    },
    "contact": {
        "label": "Contact", "category": "Sections",
        "props": {
            "title": f("text", "Title", "Get in touch", max=120),
            "text": f("textarea", "Text", "We usually reply within one business day.", max=400),
            "email": f("text", "Email", "hello@example.com", max=120),
            "phone": f("text", "Phone", "+1 (555) 000-0000", max=40),
            "address": f("text", "Address", "123 Example Street", max=160),
            "buttonLabel": f("text", "Button label", "Send an email", max=40),
        },
    },
    "footer": {
        "label": "Footer", "category": "Navigation",
        "props": {
            "brand": f("text", "Brand", "Brand", max=60),
            "text": f("text", "Text", "© 2026 Brand. All rights reserved.", max=200),
            "links": lst("Links", LINK_ITEM, [{"label": "Privacy", "href": "#"}, {"label": "Terms", "href": "#"}], 8),
        },
    },
    "spacer": {"label": "Spacer", "category": "Layout", "props": {"height": f("number", "Height (px)", 48, min=8, max=400)}},
    "divider": {"label": "Divider", "category": "Layout", "props": {"thickness": f("number", "Thickness (px)", 1, min=1, max=8)}},
}

STYLE_FIELDS = {
    "paddingTop": f("number", "Padding top", 64, min=0, max=240),
    "paddingBottom": f("number", "Padding bottom", 64, min=0, max=240),
    "background": f("color", "Background", ""),
    "textColor": f("color", "Text color", ""),
    "align": f("select", "Alignment", "left", options=["left", "center", "right"]),
    "fontScale": f("number", "Font size (%)", 100, min=70, max=160),
    "borderWidth": f("number", "Border width", 0, min=0, max=8),
    "borderColor": f("color", "Border color", ""),
    "radius": f("number", "Corner radius", 0, min=0, max=48),
    "width": f("select", "Content width", "normal", options=["narrow", "normal", "wide", "full"]),
}
DEVICES = ["desktop", "tablet", "mobile"]

COMPONENT_STYLE_DEFAULTS = {
    "navbar": {"paddingTop": 16, "paddingBottom": 16, "width": "wide"},
    "hero": {"paddingTop": 112, "paddingBottom": 112, "align": "center"},
    "heading": {"paddingTop": 32, "paddingBottom": 8},
    "paragraph": {"paddingTop": 8, "paddingBottom": 24, "width": "narrow"},
    "button": {"paddingTop": 16, "paddingBottom": 16},
    "stats": {"align": "center"},
    "footer": {"paddingTop": 40, "paddingBottom": 40, "width": "wide"},
    "spacer": {"paddingTop": 0, "paddingBottom": 0},
    "divider": {"paddingTop": 16, "paddingBottom": 16},
}

THEME_FIELDS = {
    "primary": f("color", "Primary color", "#2563EB"),
    "secondary": f("color", "Secondary color", "#7C3AED"),
    "background": f("color", "Background", "#FFFFFF"),
    "surface": f("color", "Surface", "#F8FAFC"),
    "text": f("color", "Text color", "#0F172A"),
    "mutedText": f("color", "Muted text", "#64748B"),
    "headingFont": f("select", "Heading font", "Inter", options=FONTS),
    "bodyFont": f("select", "Body font", "Inter", options=FONTS),
    "radius": f("number", "Border radius", 12, min=0, max=32),
    "buttonStyle": f("select", "Button style", "solid", options=["solid", "outline", "pill"]),
    "containerWidth": f("number", "Container width", 1200, min=880, max=1600),
}


def _preset(key, name, **tokens):
    base = {k: v["default"] for k, v in THEME_FIELDS.items()}
    base.update(tokens)
    return {"key": key, "name": name, "tokens": base}


THEME_PRESETS = [
    _preset("modern-dark", "Modern Dark", primary="#2563EB", secondary="#06B6D4", background="#080B16",
            surface="#101525", text="#F8FAFC", mutedText="#94A3B8", headingFont="Space Grotesk", bodyFont="Inter"),
    _preset("minimal-light", "Minimal Light", primary="#111827", secondary="#6B7280", background="#FFFFFF",
            surface="#F9FAFB", text="#111827", mutedText="#6B7280", headingFont="Manrope", bodyFont="Inter", radius=8),
    _preset("tech-blue", "Tech Blue", primary="#0EA5E9", secondary="#2563EB", background="#F0F9FF",
            surface="#FFFFFF", text="#0C1A2B", mutedText="#4B6582", headingFont="Space Grotesk", bodyFont="DM Sans"),
    _preset("indigo-saas", "Indigo SaaS", primary="#4F46E5", secondary="#7C3AED", background="#FFFFFF",
            surface="#EEF2FF", text="#1E1B4B", mutedText="#6366F1", headingFont="Poppins", bodyFont="Inter",
            buttonStyle="pill", radius=16),
    _preset("retail-fresh", "Retail Fresh", primary="#16A34A", secondary="#F59E0B", background="#FFFFFF",
            surface="#F0FDF4", text="#14532D", mutedText="#4D7C5B", headingFont="DM Sans", bodyFont="DM Sans"),
    _preset("summer", "Summer", primary="#F97316", secondary="#EC4899", background="#FFF7ED",
            surface="#FFEDD5", text="#431407", mutedText="#9A3412", headingFont="Poppins", bodyFont="DM Sans",
            buttonStyle="pill", radius=20),
    _preset("winter", "Winter", primary="#0284C7", secondary="#64748B", background="#F8FAFC",
            surface="#E0F2FE", text="#0F172A", mutedText="#475569", headingFont="Playfair Display", bodyFont="Lora", radius=6),
]
PRESETS_BY_KEY = {p["key"]: p for p in THEME_PRESETS}


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _clean_value(field: dict, value, path: str):
    t = field["type"]
    if t in {"text", "textarea"}:
        if value is None:
            return ""
        if not isinstance(value, str):
            raise ValidationError({path: "Must be text."})
        limit = field.get("max", 500)
        if len(value) > limit:
            raise ValidationError({path: f"Must be at most {limit} characters."})
        return value.replace("\x00", "")
    if t == "url":
        value = (value or "").strip()
        if not isinstance(value, str) or len(value) > 500 or not SAFE_LINK_RE.match(value):
            raise ValidationError({path: "Links must be relative paths, #anchors, http(s), mailto: or tel: URLs."})
        return value
    if t == "image":
        value = (value or "").strip()
        if not isinstance(value, str) or len(value) > 500 or not SAFE_IMAGE_RE.match(value):
            raise ValidationError({path: "Images must be uploaded assets or http(s) URLs."})
        return value
    if t == "color":
        value = (value or "").strip()
        if value and not HEX_RE.match(value):
            raise ValidationError({path: "Colors must be hex values like #2563EB."})
        return value
    if t == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValidationError({path: "Must be a number."})
        if not field["min"] <= value <= field["max"]:
            raise ValidationError({path: f"Must be between {field['min']} and {field['max']}."})
        return int(value)
    if t in {"select", "icon"}:
        if value not in field["options"]:
            raise ValidationError({path: f"Must be one of: {', '.join(map(str, field['options']))}."})
        return value
    if t == "boolean":
        if not isinstance(value, bool):
            raise ValidationError({path: "Must be true or false."})
        return value
    if t == "list":
        if not isinstance(value, list):
            raise ValidationError({path: "Must be a list."})
        if len(value) > field["max"]:
            raise ValidationError({path: f"At most {field['max']} items allowed."})
        items = []
        for i, item in enumerate(value):
            if not isinstance(item, dict):
                raise ValidationError({f"{path}[{i}]": "Must be an object."})
            unknown = set(item) - set(field["fields"])
            if unknown:
                raise ValidationError({f"{path}[{i}]": f"Unknown properties: {', '.join(sorted(unknown))}."})
            items.append({
                key: _clean_value(sub, item.get(key, sub["default"]), f"{path}[{i}].{key}")
                for key, sub in field["fields"].items()
            })
        return items
    raise ValidationError({path: "Unsupported field type."})  # pragma: no cover


def default_block(component_type: str, **overrides) -> dict:
    spec = COMPONENTS[component_type]
    style = {k: v["default"] for k, v in STYLE_FIELDS.items()}
    style.update(COMPONENT_STYLE_DEFAULTS.get(component_type, {}))
    props = {k: deepcopy(v["default"]) for k, v in spec["props"].items()}
    props.update(overrides.pop("props", {}))
    style.update(overrides.pop("style", {}))
    return {"id": f"b_{uuid.uuid4().hex[:10]}", "type": component_type, "props": props, "style": style,
            "hidden": False, "hiddenOn": [], **overrides}


ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,40}$")
MAX_BLOCKS = 80


def validate_content(content) -> dict:
    """Validate and normalise page content. Returns a clean copy."""
    if content in (None, {}):
        return {"version": 1, "blocks": []}
    if not isinstance(content, dict) or not isinstance(content.get("blocks"), list):
        raise ValidationError({"content": "Content must be an object with a 'blocks' list."})
    blocks = content["blocks"]
    if len(blocks) > MAX_BLOCKS:
        raise ValidationError({"content": f"A page can contain at most {MAX_BLOCKS} components."})
    seen, clean = set(), []
    for i, block in enumerate(blocks):
        path = f"blocks[{i}]"
        if not isinstance(block, dict):
            raise ValidationError({path: "Must be an object."})
        ctype = block.get("type")
        if ctype not in COMPONENTS:
            raise ValidationError({path: f"Unknown component type '{ctype}'."})
        bid = str(block.get("id") or f"b_{uuid.uuid4().hex[:10]}")
        if not ID_RE.match(bid) or bid in seen:
            raise ValidationError({path: "Component ids must be unique and alphanumeric."})
        seen.add(bid)
        unknown = set(block) - {"id", "type", "props", "style", "hidden", "hiddenOn"}
        if unknown:
            raise ValidationError({path: f"Unknown keys: {', '.join(sorted(unknown))}."})
        spec = COMPONENTS[ctype]
        props_in = block.get("props") or {}
        style_in = block.get("style") or {}
        if not isinstance(props_in, dict) or not isinstance(style_in, dict):
            raise ValidationError({path: "props and style must be objects."})
        for name, extra in (("props", set(props_in) - set(spec["props"])), ("style", set(style_in) - set(STYLE_FIELDS))):
            if extra:
                raise ValidationError({f"{path}.{name}": f"Unknown properties: {', '.join(sorted(extra))}."})
        defaults = default_block(ctype)
        props = {k: _clean_value(fd, props_in.get(k, defaults["props"][k]), f"{path}.props.{k}") for k, fd in spec["props"].items()}
        style = {k: _clean_value(fd, style_in.get(k, defaults["style"][k]), f"{path}.style.{k}") for k, fd in STYLE_FIELDS.items()}
        hidden_on = block.get("hiddenOn") or []
        if not isinstance(hidden_on, list) or any(d not in DEVICES for d in hidden_on):
            raise ValidationError({f"{path}.hiddenOn": f"Must be a subset of {DEVICES}."})
        clean.append({"id": bid, "type": ctype, "props": props, "style": style,
                      "hidden": bool(block.get("hidden", False)), "hiddenOn": sorted(set(hidden_on))})
    return {"version": 1, "blocks": clean}


def validate_theme(tokens) -> dict:
    if not isinstance(tokens, dict):
        raise ValidationError({"tokens": "Theme tokens must be an object."})
    unknown = set(tokens) - set(THEME_FIELDS)
    if unknown:
        raise ValidationError({"tokens": f"Unknown theme tokens: {', '.join(sorted(unknown))}."})
    return {k: _clean_value(fd, tokens.get(k, fd["default"]), f"tokens.{k}") for k, fd in THEME_FIELDS.items()}


def registry_payload() -> dict:
    return {
        "components": [{"type": k, **v, "styleDefaults": COMPONENT_STYLE_DEFAULTS.get(k, {})} for k, v in COMPONENTS.items()],
        "style": STYLE_FIELDS,
        "theme": THEME_FIELDS,
        "presets": THEME_PRESETS,
        "icons": ICONS,
        "fonts": FONTS,
        "devices": DEVICES,
    }
