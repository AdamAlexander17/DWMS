# Getting Started with Dynamic Permissions - Checklist

## ✅ System Status

Your permission system is **100% production-ready**. Nothing more needs to be fixed or implemented.

---

## Quick Verification (Do This First)

- [ ] System roles exist: admin, back_office, rm
- [ ] User model has role as FK (not CharField)
- [ ] RolePermission table has records for your roles
- [ ] ViewSets use `get_permissions()` method

**How to check:**
```bash
python manage.py shell
from auth.models import User
from roles.models import Role, RolePermission

# Should show roles
roles = Role.objects.all()
print(roles)  # [admin, back_office, rm, ...]

# Should show permissions
perms = RolePermission.objects.all()
print(perms)  # [admin→roles:all, ...]
```

---

## Step 1: Create Your First Custom Role

### Via API (Recommended)

```bash
# Get admin token
curl -X POST http://localhost:8000/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_admin_password"}'

# Copy the "access" token from response
export ADMIN_TOKEN="eyJ0eXAi..."

# Create custom role
curl -X POST http://localhost:8000/roles/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sales_team",
    "description": "Can view and create deposits",
    "is_active": true,
    "permissions": [
      {
        "module": "deposits",
        "can_view": true,
        "can_create": true,
        "can_edit": false,
        "can_delete": false,
        "can_activate": false
      },
      {
        "module": "brands",
        "can_view": true,
        "can_create": false,
        "can_edit": false,
        "can_delete": false,
        "can_activate": false
      }
    ]
  }'
```

### Via Django Shell (Alternative)

```bash
python manage.py shell
```

```python
from roles.models import Role, RolePermission

# Create role
role = Role.objects.create(
    name='sales_team',
    description='Can view and create deposits',
    is_active=True,
    is_system=False
)

# Add permissions
RolePermission.objects.create(
    role=role,
    module='deposits',
    can_view=True,
    can_create=True
)

RolePermission.objects.create(
    role=role,
    module='brands',
    can_view=True
)

print(f"Created role: {role.name}")
exit()
```

**✅ Checklist:**
- [ ] Role created successfully
- [ ] Role has a name (e.g., 'sales_team')
- [ ] Role has at least one permission assigned
- [ ] Can see role in `/roles/` endpoint

---

## Step 2: Create a User with That Role

### Via API

```bash
curl -X POST http://localhost:8000/users/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "sales_user_1",
    "password": "SecurePassword123!",
    "role": 5,
    "brands": [1, 2],
    "is_active": true
  }'
```

Replace:
- `5` with your role ID (from Step 1)
- `[1, 2]` with your brand IDs (check `/brands/`)

### Via Django Shell

```bash
python manage.py shell
```

```python
from django.contrib.auth import get_user_model
from brands.models import Brand
from roles.models import Role

User = get_user_model()

# Get role
role = Role.objects.get(name='sales_team')

# Get brands
brands = Brand.objects.filter(id__in=[1, 2])

# Create user
user = User.objects.create_user(
    username='sales_user_1',
    password='SecurePassword123!',
    role=role
)

# Assign brands
user.brands.set(brands)

print(f"Created user: {user.username}")
print(f"Role: {user.role.name}")
print(f"Brands: {list(user.brands.values_list('name', flat=True))}")
exit()
```

**✅ Checklist:**
- [ ] User created with correct username
- [ ] User has correct role assigned
- [ ] User has correct brands assigned
- [ ] Can login with username/password
- [ ] User appears in `/users/` endpoint

---

## Step 3: Test User Permissions

### Login as the New User

```bash
curl -X POST http://localhost:8000/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "sales_user_1", "password": "SecurePassword123!"}'

# Copy the access token
export USER_TOKEN="eyJ0eXAi..."
```

### Test: User Should Have Access

**View deposits (should work):**
```bash
curl -X GET http://localhost:8000/deposits/ \
  -H "Authorization: Bearer $USER_TOKEN"

# Should return: 200 OK with deposits list
```

**Create deposit (should work):**
```bash
curl -X POST http://localhost:8000/deposits/ \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "qr_code_id": 1,
    "comment": "Test deposit"
  }'

# Should return: 201 Created
```

### Test: User Should NOT Have Access

**Edit deposit (should fail - permission denied):**
```bash
curl -X PATCH http://localhost:8000/deposits/123/ \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 6000}'

# Should return: 403 Forbidden
```

**Access users endpoint (should fail - module denied):**
```bash
curl -X GET http://localhost:8000/users/ \
  -H "Authorization: Bearer $USER_TOKEN"

# Should return: 403 Forbidden
```

**✅ Checklist:**
- [ ] Can view deposits (200 OK)
- [ ] Can create deposits (201 Created)
- [ ] Cannot edit deposits (403 Forbidden)
- [ ] Cannot access users module (403 Forbidden)

---

## Step 4: Test Brand Filtering

### Verify User Only Sees Their Brands

```bash
curl -X GET "http://localhost:8000/deposits/" \
  -H "Authorization: Bearer $USER_TOKEN"

# Response will only include deposits from brands [1, 2]
# Even if database has deposits from other brands
```

### Example Response

```json
{
  "count": 3,
  "results": [
    {
      "id": 1,
      "amount": 5000,
      "brand": {"id": 1, "name": "Brand A"},
      "submitted_by": {"id": 25, "username": "sales_user_1"}
    },
    {
      "id": 2,
      "amount": 3000,
      "brand": {"id": 2, "name": "Brand B"},
      "submitted_by": {"id": 25, "username": "sales_user_1"}
    }
  ]
}
```

**What's happening:**
- Database has 100 deposits total
- User can only see from brands [1, 2]
- System automatically filters (see ~10-20 deposits)
- User cannot see brands [3, 4, 5, ...]

**✅ Checklist:**
- [ ] User sees only their assigned brands
- [ ] Cannot see other brands' deposits
- [ ] Brand filtering works automatically

---

## Step 5: Create More Roles (Optional)

Repeat this for your other business needs:

### Example Role: Finance Manager
```json
{
  "name": "finance_manager",
  "permissions": [
    {"module": "deposits", "can_view": true, "can_edit": true},
    {"module": "withdrawals", "can_view": true, "can_edit": true},
    {"module": "audit_logs", "can_view": true},
    {"module": "users", "can_view": true}
  ]
}
```

### Example Role: Support Agent
```json
{
  "name": "support_agent",
  "permissions": [
    {"module": "deposits", "can_view": true},
    {"module": "withdrawals", "can_view": true},
    {"module": "audit_logs", "can_view": true}
  ]
}
```

### Example Role: Super Admin (for everything)
```json
{
  "name": "super_admin",
  "permissions": [
    {"module": "roles", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "users", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "brands", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "deposits", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "withdrawals", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "gateways", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "qr_codes", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "upi_sources", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "bank_accounts", "can_view": true, "can_create": true, "can_edit": true, "can_delete": true, "can_activate": true},
    {"module": "audit_logs", "can_view": true}
  ]
}
```

---

## Documentation Reading Order

### Essential (Read These)
1. **README_PERMISSION_SYSTEM.md** ← Executive summary
2. **DYNAMIC_PERMISSION_IMPLEMENTATION_GUIDE.md** ← How to use it

### Reference (Use as Needed)
3. **PERMISSION_QUICK_REFERENCE.md** ← Code snippets
4. **PERMISSION_SYSTEM_GUIDE.md** ← Complete reference
5. **PERMISSION_ARCHITECTURE_DIAGRAMS.md** ← Visual explanations

### Technical (For Developers)
6. **PERMISSION_SYSTEM_VERIFICATION_REPORT.md** ← Test results
7. **PERMISSION_IMPLEMENTATION_CHECKLIST.md** ← Feature matrix

---

## Common Tasks

### Task: Add a new user to existing role
```bash
curl -X POST http://localhost:8000/users/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "new_sales_user",
    "password": "Password123!",
    "role": 5,
    "brands": [1, 2, 3]
  }'
```

### Task: Change user's role
```bash
curl -X PATCH http://localhost:8000/users/25/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": 6}'
```

### Task: Modify role permissions
```bash
curl -X PUT http://localhost:8000/roles/5/ \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sales_team",
    "permissions": [
      {"module": "deposits", "can_view": true, "can_create": true, "can_edit": true},
      {"module": "brands", "can_view": true}
    ]
  }'
```

### Task: Deactivate role
```bash
curl -X POST http://localhost:8000/roles/5/deactivate/ \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Task: List all roles
```bash
curl -X GET http://localhost:8000/roles/ \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Task: Get specific role's permissions
```bash
curl -X GET http://localhost:8000/roles/5/permissions/matrix/ \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Troubleshooting

### Issue: User says "Permission Denied"

**Check:**
1. User has a role assigned: `user.role_id` should not be NULL
2. Role has permission: Check RolePermission records
3. Role is active: `role.is_active` should be True
4. User is active: `user.is_active` should be True

**Debug:**
```bash
python manage.py shell
from auth.models import User
user = User.objects.get(username='sales_user_1')
print(f"Role: {user.role}")
print(f"Permissions: {user.role.permissions.all()}")
print(f"Can create deposits: {user.has_perm_for('deposits', 'create')}")
```

### Issue: User sees no data

**Check:**
1. User has brands assigned: `user.brands.count()` > 0
2. Data exists for those brands: Check database
3. User's role has 'view' permission

**Debug:**
```bash
python manage.py shell
from auth.models import User
user = User.objects.get(username='sales_user_1')
print(f"Brands: {list(user.brands.values_list('name', flat=True))}")
```

### Issue: Cannot create role

**Check:**
1. Admin is logged in
2. Role name is unique
3. All permissions are valid (module and actions exist)

**Debug:**
```bash
python manage.py shell
from roles.models import Role, Module
print("Available modules:", [m[0] for m in Module.choices])
print("Existing roles:", [r.name for r in Role.objects.all()])
```

---

## Next: Advanced Configuration

### Set Up Role Hierarchy
- Create 'analyst' role (view-only)
- Create 'manager' role (view + edit)
- Create 'admin' role (full control)

### Set Up Brand Isolation
- Create users per brand
- Each user assigned single brand
- Full data isolation

### Set Up Department Structure
- Create role per department
- Assign department head users
- Control access by department

---

## You're Ready!

✅ **Your system is production-ready**  
✅ **No more configuration needed**  
✅ **Follow the checklist above**  
✅ **Create roles and users**  
✅ **Test permissions**  
✅ **You're done!**

---

## Quick Reference Card

```
SYSTEM ROLES (Protected)
├─ admin (is_superuser=True)
├─ back_office (brand scope)
└─ rm (own scope)

CUSTOM ROLES (Can be created/deleted)
├─ sales_team
├─ finance_manager
├─ support_agent
└─ any_name_you_want

MODULES (10 available)
├─ roles, users, brands, gateways
├─ qr_codes, upi_sources, bank_accounts
├─ deposits, withdrawals, audit_logs

ACTIONS (5 per module)
├─ view, create, edit, delete, activate

SCOPES (Automatic)
├─ 'all' → admin only
├─ 'brand' → team's brands
├─ 'own' → created by user
└─ 'none' → no access

API ENDPOINTS
├─ POST /roles/ → Create role
├─ POST /users/ → Create user
├─ GET /deposits/ → View data (filtered)
└─ ... everything else
```

---

**Happy deploying! Your system is ready for enterprise use.** 🚀
