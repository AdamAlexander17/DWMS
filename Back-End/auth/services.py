from django.contrib.auth.models import update_last_login
from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import User


class AuthService:
    """Handles authentication-related business logic."""

    @staticmethod
    def login(user: User) -> dict:
        """Generate JWT token pair and return user payload."""
        refresh = RefreshToken.for_user(user)

        # Update last_login timestamp
        update_last_login(None, user)

        role_name = user.role.name if user.role_id else None
        permissions = user.role.get_permissions_map() if user.role_id else {}
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id':                   user.id,
                'username':             user.username,
                'role':                 role_name,
                'role_id':              user.role_id,
                'permissions':          permissions,
                'brand_ids':            list(user.brands.values_list('id', flat=True)),
                'must_change_password': user.must_change_password,
            },
        }

    @staticmethod
    def logout(refresh_token: str) -> None:
        """Blacklist the given refresh token."""
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as exc:
            raise ValueError('Invalid or expired refresh token') from exc

    @staticmethod
    def change_password(user: User, old_password: str, new_password: str) -> None:
        """Verify old password and set a new one."""
        if not user.check_password(old_password):
            raise ValueError('Old password is incorrect')
        user.set_password(new_password)
        user.must_change_password = False
        user.save(update_fields=['password', 'must_change_password', 'updated_at'])



