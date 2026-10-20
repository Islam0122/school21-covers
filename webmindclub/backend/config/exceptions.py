"""Uniform API error format: ``{"detail": str, "errors": {field: [msg]}}``."""
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import exceptions
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
    response = exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    if isinstance(exc, exceptions.ValidationError):
        if isinstance(data, dict):
            errors = {k: v if isinstance(v, list) else [v] for k, v in data.items()}
            non_field = errors.pop("non_field_errors", None) or errors.pop("detail", None)
            detail = str(non_field[0]) if non_field else "Please correct the highlighted fields."
            if non_field and not errors:
                errors = {}
            response.data = {"detail": detail, "errors": errors}
        else:
            response.data = {"detail": str(data[0]) if data else "Invalid input.", "errors": {}}
    elif isinstance(data, dict) and "detail" in data:
        response.data = {"detail": str(data["detail"]), "errors": {}}
    return response

