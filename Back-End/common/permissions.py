from rest_framework.permissions import BasePermission


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _role_name(user) -> str | None:
    """Return the user's role name as a lowercase string, or None."""
    role = getattr(user, 'role', None)
    if role is None:
        return None
    # FK object (normal path after migration)
    name = getattr(role, 'name', None)
    if name is not None:
        return str(name).lower()
    # Legacy: raw string value (safety fallback)
    return str(role).lower()


def has_module_permission(user, module: str, action: str = 'view') -> bool:
    """
    Standalone helper — True if the user's role grants `action` on `module`.
    action: 'view' | 'create' | 'edit' | 'delete' | 'activate'
    """
    if not getattr(user, 'is_authenticated', False):
        return False
    has_perm_for = getattr(user, 'has_perm_for', None)
    if callable(has_perm_for):
        return has_perm_for(module, action)
    return False


# ---------------------------------------------------------------------------
# Role-based permission classes
# ---------------------------------------------------------------------------

class IsAdmin(BasePermission):
    """Allow access only to users with the 'admin' role."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and _role_name(request.user) == 'admin'
        )


class IsBackOffice(BasePermission):
    """Allow access only to Back Office users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and _role_name(request.user) == 'back_office'
        )


class IsRM(BasePermission):
    """Allow access only to RM users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and _role_name(request.user) == 'rm'
        )


class IsAdminOrBackOffice(BasePermission):
    """Allow access to Admin and Back Office users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and _role_name(request.user) in ('admin', 'back_office')
        )


class IsAdminOrBackOfficeOrRMReadOnly(BasePermission):
    """
    Admin and Back Office: full access.
    RM: read-only (GET / HEAD / OPTIONS).
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        role = _role_name(request.user)
        if role in ('admin', 'back_office'):
            return True
        if role == 'rm':
            return request.method in ('GET', 'HEAD', 'OPTIONS')
        return False


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
