"""Safe handling of uploaded images: raster formats only, size-limited, verified with Pillow."""
from pathlib import Path

from django.conf import settings
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP", "GIF"}


def validate_image_upload(upload):
    if not upload:
        return upload
    if upload.size > settings.MAX_ASSET_SIZE:
        raise serializers.ValidationError(f"Files must be smaller than {settings.MAX_ASSET_SIZE // (1024 * 1024)} MB.")
    if Path(upload.name).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise serializers.ValidationError("Only PNG, JPEG, WebP and GIF images are allowed.")
    try:
        upload.seek(0)
        with Image.open(upload) as img:
            img.verify()
            fmt = img.format
        upload.seek(0)
        with Image.open(upload) as img:
            upload.image_size = img.size
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise serializers.ValidationError("The file is not a valid image.")
    finally:
        upload.seek(0)
    if fmt not in ALLOWED_FORMATS:
        raise serializers.ValidationError("Only PNG, JPEG, WebP and GIF images are allowed.")
    return upload
