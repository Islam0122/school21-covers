from .models import ActivityLog


def log_activity(*, actor, workspace, verb, target, message, project=None, metadata=None) -> ActivityLog:
    return ActivityLog.objects.create(
        workspace=workspace,
        project=project,
        actor=actor if actor and actor.is_authenticated else None,
        verb=verb,
        target_type=target.__class__.__name__.lower(),
        target_id=str(getattr(target, "pk", "") or ""),
        message=message[:300],
        metadata=metadata or {},
    )
