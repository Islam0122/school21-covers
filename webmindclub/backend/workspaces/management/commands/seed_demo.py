from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from smartstock.demo import create_smartstock_demo
from workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole

User = get_user_model()


class Command(BaseCommand):
    help = ("Create the 'WebMindClub' demo workspace with the SmartStock AI project, pages, themes, products, "
            "AI insights, tasks and demo team members. The given user (who must already exist) becomes owner.")

    def add_arguments(self, parser):
        parser.add_argument("--owner-email", required=True, help="Email of an existing user to own the demo workspace.")

    def handle(self, *args, owner_email, **options):
        owner = User.objects.filter(email=owner_email.lower(), is_demo=False).first()
        if owner is None:
            raise CommandError(f"No user with email {owner_email}. Create one first (sign up or createsuperuser).")
        ws = Workspace.objects.filter(slug="webmindclub").first()
        if ws is None:
            ws = Workspace.objects.create(name="WebMindClub", slug="webmindclub", owner=owner)
        WorkspaceMembership.objects.update_or_create(workspace=ws, user=owner, defaults={"role": WorkspaceRole.OWNER})
        if ws.projects.filter(slug__startswith="smartstock-ai", store__isnull=False).exists():
            self.stdout.write(self.style.WARNING("Demo workspace already seeded — nothing to do."))
            return
        project = create_smartstock_demo(ws, owner)
        self.stdout.write(self.style.SUCCESS(f"Seeded workspace '{ws.name}' with project '{project.name}' (id {project.pk})."))
