from django.contrib.auth import get_user_model

User = get_user_model()


class UserService:
    """Handles user management business logic."""

    @staticmethod
    def activate(user: User) -> User:
        user.is_active = True
        user.save(update_fields=['is_active', 'updated_at'])
        return user

    @staticmethod
    def deactivate(user: User) -> User:
        user.is_active = False
        user.save(update_fields=['is_active', 'updated_at'])
        return user

    @staticmethod
    def reset_password(user: User, new_password: str) -> None:
        user.set_password(new_password)
        user.save(update_fields=['password', 'updated_at'])
