from rest_framework.permissions import BasePermission


# ---------------------------------------------------------------------------
# Helpers — fully dynamic, no hardcoded role names
# ---------------------------------------------------------------------------

def is_admin_user(user) -> bool:
    """True if user is a superuser (Django level)."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return bool(getattr(user, 'is_superuser', False))


def has_module_permission(user, module: str, action: str = 'view') -> bool:
    """
    True if the user's role grants `action` on `module`.
    Superusers always pass.
    action: 'view' | 'create' | 'edit' | 'delete' | 'activate'
    """
    if not getattr(user, 'is_authenticated', False):
        return False
    if is_admin_user(user):
        return True
    has_perm_for = getattr(user, 'has_perm_for', None)
    if callable(has_perm_for):
        return has_perm_for(module, action)
    return False


def has_any_module_permission(user, modules, action: str = 'view') -> bool:
    """Check if user has permission for ANY of the given modules.

    Also respects module hierarchy — if checking a child module,
    the parent module must also have view permission.
    """
    from roles.models import MODULE_HIERARCHY

    for module in (modules or []):
        if has_module_permission(user, module, action):
            # If this is a child module, also check parent has view
            for parent, children in MODULE_HIERARCHY.items():
                if module in children:
                    if has_module_permission(user, parent, 'view'):
                        return True
                    else:
                        break  # Parent denied, skip this module
            else:
                # Not a child module (or is a parent/standalone) — direct permission is enough
                return True
    return False


def has_module_write_permission(user, module: str) -> bool:
    return any(has_module_permission(user, module, action) for action in ('create', 'edit', 'delete', 'activate'))


# ---------------------------------------------------------------------------
# Permission classes — fully dynamic
# ---------------------------------------------------------------------------

class IsAdmin(BasePermission):
    """Allow access only to superusers."""

    def has_permission(self, request, view):
        return bool(request.user and is_admin_user(request.user))


# ---------------------------------------------------------------------------
# Dynamic module-permission factory
# ---------------------------------------------------------------------------

def ModulePermission(module: str, action: str = 'view'):
    """
    Factory that returns a DRF permission class checking the user's role
    permission for the given module + action.

    Usage:
        permission_classes = [IsAuthenticated, ModulePermission('brands', 'create')]
    """
    class _DynamicPerm(BasePermission):
        def has_permission(self, request, view):
            return has_module_permission(request.user, module, action)

    _DynamicPerm.__name__ = f'ModulePermission[{module}:{action}]'
    return _DynamicPerm



# ---------------------------------------------------------------------------
# Scope resolver — determines data visibility
# ---------------------------------------------------------------------------

def resolve_module_scope(user, module: str = None) -> str:
    """
    Return the user's data scope: 'all', 'brand', or 'own'.

    Logic:
    - Superusers → 'all'
    - Users with brands assigned → 'brand'
    - All others → 'own'
    """
    if not getattr(user, 'is_authenticated', False):
        return 'none'

    if is_admin_user(user):
        return 'all'

    role = getattr(user, 'role', None)
    if role is None:
        return 'none'

    # If user has brands assigned, scope is brand-level
    if hasattr(user, 'brands') and user.brands.exists():
        return 'brand'

    return 'own'
