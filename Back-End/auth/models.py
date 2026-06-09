from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Custom manager for the User model."""

    def create_user(self, username: str, password: str = None, **extra_fields):
        if not username:
            raise ValueError('Username is required')
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username: str, password: str = None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        user = self.create_user(username, password, **extra_fields)
        # Assign the 'admin' role if it already exists in the database
        try:
            from roles.models import Role as RoleModel
            admin_role = RoleModel.objects.filter(name='admin').first()
            if admin_role:
                user.role = admin_role
                user.save(update_fields=['role'])
        except Exception:
            pass
        return user


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model for DWMS.
    Role is a dynamic FK to roles.Role (replaces the old CharField choices).
    RM users must be assigned to exactly one Brand.
    """

    username  = models.CharField(max_length=50, unique=True, db_index=True)
    role = models.ForeignKey(
        'roles.Role',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
        db_index=True,
    )
    brands = models.ManyToManyField(
        'brands.Brand',
        blank=True,
        related_name='users',
        db_table='user_brands',
    )
    is_active  = models.BooleanField(default=True, db_index=True)
    is_staff   = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['role', 'is_active'], name='users_role_a8f2ba_idx'),
        ]

    def __str__(self) -> str:
        return self.username

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    @property
    def role_name(self) -> str | None:
        """Return the role name string, or None if no role is assigned."""
        return self.role.name if self.role_id else None

    def has_perm_for(self, module: str, action: str = 'view') -> bool:
        """
        Check whether this user's role grants the given action on a module.

        action: 'view' | 'create' | 'edit' | 'delete' | 'activate'
        """
        if not self.role_id:
            return False
        try:
            perm = self.role.permissions.get(module=module)
            return bool(getattr(perm, f'can_{action}', False))
        except Exception:
            return False
