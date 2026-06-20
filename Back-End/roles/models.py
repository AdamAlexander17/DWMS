from django.db import models


class Module(models.TextChoices):
    ROLES              = 'roles',              'Roles'
    USERS              = 'users',              'Users'
    BRANDS             = 'brands',             'Brands'
    AUDIT_LOGS         = 'audit_logs',         'Audit Logs'

    # Parent modules
    MASTER             = 'master',             'Master'
    PAYMENT_METHODS    = 'payment_methods',    'Payment Methods'
    TRANSACTIONS       = 'transactions',       'Transactions'

    # Master children
    GATEWAYS           = 'gateways',           'Gateways'
    QR_CODES           = 'qr_codes',           'QR Codes'
    UPI_SOURCES        = 'upi_sources',        'UPI Sources'
    BANK_ACCOUNTS      = 'bank_accounts',      'Bank Accounts'

    # Transactions children
    DEPOSITS           = 'deposits',           'Deposits'
    DEPOSIT_HISTORY    = 'deposit_history',    'Deposit History'
    WITHDRAWALS        = 'withdrawals',        'Withdrawals'
    WITHDRAWAL_HISTORY = 'withdrawal_history', 'Withdrawal History'


# Parent-child module hierarchy
MODULE_HIERARCHY = {
    'master': ['gateways', 'qr_codes', 'upi_sources', 'bank_accounts'],
    'transactions': ['deposits', 'deposit_history', 'withdrawals', 'withdrawal_history'],
    'payment_methods': [],  # Ready for future children
}


class Role(models.Model):
    name        = models.CharField(max_length=50, unique=True, db_index=True)
    description = models.TextField(blank=True, default='')
    is_active   = models.BooleanField(default=True, db_index=True)
    is_system   = models.BooleanField(default=False)          # system roles cannot be deleted
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'roles'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name

    def get_permissions_map(self) -> dict:
        """Return {module: {action: bool}} for fast lookup."""
        return {
            p.module: {
                'view':             p.can_view,
                'create':           p.can_create,
                'edit':             p.can_edit,
                'delete':           p.can_delete,
                'activate':         p.can_activate,
                'review':           p.can_review,
                'complete':         p.can_complete,
                'upload_slip':      p.can_upload_slip,
                'confirm_received': p.can_confirm_received,
                'not_received':     p.can_not_received,
                'email_bank':       p.can_email_bank,
                'close_ticket':     p.can_close_ticket,
                'chat':             p.can_chat,
                'view_details':     p.can_view_details,
            }
            for p in self.permissions.all()
        }


class RolePermission(models.Model):
    role       = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='permissions')
    module     = models.CharField(max_length=50, choices=Module.choices)
    can_view   = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit   = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    can_activate = models.BooleanField(default=False)
    can_review = models.BooleanField(default=False)
    can_complete = models.BooleanField(default=False)
    # Withdrawal/Deposit specific actions
    can_upload_slip      = models.BooleanField(default=False)
    can_confirm_received = models.BooleanField(default=False)
    can_not_received     = models.BooleanField(default=False)
    can_email_bank       = models.BooleanField(default=False)
    can_close_ticket     = models.BooleanField(default=False)
    can_chat             = models.BooleanField(default=False)
    can_view_details     = models.BooleanField(default=False)

    class Meta:
        db_table        = 'role_permissions'
        ordering        = ['module']
        unique_together = ('role', 'module')

    def __str__(self) -> str:
        return f'{self.role.name} — {self.module}'
