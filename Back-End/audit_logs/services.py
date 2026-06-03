import json
import logging

from django.core.serializers.json import DjangoJSONEncoder

logger = logging.getLogger(__name__)


def _to_json_safe(value):
    """Convert a value to a plain JSON-serialisable structure."""
    if value is None:
        return None
    try:
        return json.loads(json.dumps(value, cls=DjangoJSONEncoder))
    except (TypeError, ValueError):
        return str(value)


class AuditLogService:
    """Utility for creating audit log entries without raising on failure."""

    @staticmethod
    def log(
        user,
        action: str,
        module: str,
        old_data=None,
        new_data=None,
        ip_address: str = None,
    ):
        from .models import AuditLog  # local import avoids circular issues at module load

        try:
            return AuditLog.objects.create(
                user=user,
                action=action,
                module=module,
                old_data=_to_json_safe(old_data),
                new_data=_to_json_safe(new_data),
                ip_address=ip_address,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning('Failed to create audit log entry: %s', exc)
            return None
