from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.db import models


class UserManager(DjangoUserManager):
    """Email is the login identifier; ``username`` mirrors it for admin compatibility."""

    def _create_user(self, username, email, password, **extra_fields):
        email = self.normalize_email(email or username).lower()
        return super()._create_user(email, email, password, **extra_fields)

    def create_user(self, email=None, password=None, **extra_fields):
        extra_fields.pop("username", None)
        return super().create_user(email, email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, **extra_fields):
        extra_fields.pop("username", None)
        return super().create_superuser(email, email, password, **extra_fields)


class User(AbstractUser):
    APPEARANCE_CHOICES = [("dark", "Dark"), ("light", "Light"), ("system", "System")]

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    appearance = models.CharField(max_length=10, choices=APPEARANCE_CHOICES, default="dark")
    is_demo = models.BooleanField(default=False, help_text="Seeded demo member without login access.")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def save(self, *args, **kwargs):
        self.email = (self.email or "").lower()
        self.username = self.email
        super().save(*args, **kwargs)

    @property
    def display_name(self) -> str:
        return self.full_name or self.email.split("@")[0]

    def __str__(self) -> str:
        return self.display_name
