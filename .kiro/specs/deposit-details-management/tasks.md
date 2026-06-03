# Implementation Plan: Deposit Details Management System (DWMS) Backend API

## Overview

This task list breaks down the DWMS backend API implementation into granular, actionable steps following Clean Architecture principles. Tasks are organized by phase, with each task designed to be completable in 30-60 minutes. The implementation relies on the Django 6+ + DRF architecture defined in the design document, with function-based views, service layer business logic, and JWT authentication.

## Phase 1: Infrastructure & Configuration

- [x] 1.1 Configure Django project settings (INSTALLED_APPS, REST_FRAMEWORK, SIMPLE_JWT)
  - Update `config/settings.py` to include all required apps: `rest_framework`, `rest_framework_simplejwt`, `rest_framework_simplejwt.token_blacklist`, `drf_spectacular`, `django_filters`, `corsheaders`, `accounts`, `brands`, `payments`, `audit_logs`, `common`
  - Configure `DEFAULT_AUTHENTICATION_CLASSES` to use `JWTAuthentication`
  - Configure `DEFAULT_PERMISSION_CLASSES` to `IsAuthenticated`
  - Set up `SIMPLE_JWT` with 60-minute access token lifetime, 7-day refresh token lifetime, token rotation, and blacklist-after-rotation
  - _Requirements: 1.1, 1.2_

- [x] 1.2 Configure media files and CORS settings
  - Set `MEDIA_ROOT` to `BASE_DIR / "media"` and `MEDIA_URL` to `/media/`
  - Configure `CORS_ALLOWED_ORIGINS` for frontend domain(s)
  - Add media file serving in `config/urls.py` for development (via `django.views.static.serve`)
  - _Requirements: 1.4, 1.5_

- [x] 1.3 Configure DRF Spectacular for OpenAPI documentation
  - Update `DRF_SPECTACULAR_SETTINGS` in `config/settings.py` with title "DWMS API", version "1.0.0"
  - Add system description and contact information
  - Set `SPECTACULAR_SETTINGS['SCHEMA_PATH_PREFIX']` to `/api/`
  - _Requirements: 1.6, 13.1_

- [x] 1.4 Configure django-filter as default filter backend
  - Set `DEFAULT_FILTER_BACKENDS` in `REST_FRAMEWORK` to include `DjangoFilterBackend`, `SearchFilter`, and `OrderingFilter`
  - Set default pagination class to `PageNumberPagination` with default page size 20
  - _Requirements: 1.7_

- [x] 1.5 Create common utility functions (common/utils.py)
  - Implement `success_response(message, data=None, status_code=200)` function returning standard success JSON envelope
  - Implement `error_response(message, errors=None, status_code=400)` function returning standard error JSON envelope
  - Implement `get_client_ip(request)` function extracting client IP from request (handles X-Forwarded-For header)
  - _Requirements: 2.3, 2.4_

- [x] 1.6 Create custom exception handler (common/exceptions.py)
  - Implement custom exception handler intercepting `ValidationError`, `AuthenticationFailed`, `NotAuthenticated`, `PermissionDenied`, `NotFound`, and `IntegrityError`
  - Map each exception type to appropriate HTTP status code and Standard_Response format
  - Register handler in `config/settings.py` via `EXCEPTION_HANDLER` setting
  - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [x] 1.7 Create pagination class (common/pagination.py)
  - Create `StandardPagination` class extending `PageNumberPagination` with default page size of 20
  - Configure page size query parameter name to `page_size`
  - _Requirements: 1.7_

- [x] 1.8 Create filter classes (common/filters.py)
  - Create `BrandFilterSet` for filtering Brand by name (search) and status
  - Create `UserFilterSet` for filtering User by role, brand, is_active (filter) and full_name, username, email (search)
  - Create `QRCodeFilterSet` for filtering QRCode by brand, status, range_from, range_to (filter) and qr_name (search), with ordering by created_at and qr_name
  - Create `UPIFilterSet` for filtering UPI by brand, status, range_from, range_to (filter) and upi_id (search), with ordering by created_at and upi_id
  - Create `BankDetailFilterSet` for filtering BankDetail by brand, status, range_from, range_to (filter) and bank_name, account_holder_name, ifsc_code (search), with ordering by created_at and bank_name
  - Create `AuditLogFilterSet` for filtering by user, action, module (filter) and date range on timestamp (filter), with ordering by timestamp
  - _Requirements: 5.8, 6.9, 7.9, 8.8, 9.9, 11.7_

## Phase 2: Create Data Models and Migrations

- [-] 2.1 Create User model and UserManager (accounts/models.py)
  - Define `UserManager` class with `create_user()` and `create_superuser()` methods
  - Define `User` model extending `AbstractBaseUser` with fields: full_name, username (unique), email (unique), mobile, role (choices: admin, back_office, rm), brand (FK, nullable), is_active, created_at, updated_at
  - Implement `clean()` method validating brand requirement for RM role
  - Set `USERNAME_FIELD` to 'username' and `REQUIRED_FIELDS` to ['email', 'full_name']
  - Configure `META.ordering` to ['-created_at']
  - Set `AUTH_USER_MODEL = 'accounts.User'` in `config/settings.py`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 2.2 Create Brand model (brands/models.py)
  - Define `Brand` model with fields: id, name (unique, max 100 chars), status (boolean, default True), created_at, updated_at
  - Set `Meta.ordering` to ['name']
  - _Requirements: 5.1_

- [-] 2.3 Create QRCode model (payments/models.py)
  - Define `QRCode` model with fields: id, qr_name (max 200), qr_image (FileField, upload_to='qr_codes/'), brand (FK), range_from, range_to (DecimalField, max_digits=12, decimal_places=2), status (boolean, default True), created_by (FK to User, nullable), created_at, updated_at
  - Implement `clean()` method validating range_from < range_to
  - Set `Meta.ordering` to ['-created_at']
  - _Requirements: 7.1_

- [-] 2.4 Create UPI model (payments/models.py)
  - Define `UPI` model with fields: id, upi_id (unique, max 100, with regex validator), brand (FK), range_from, range_to (DecimalField), status (boolean, default True), created_by (FK to User, nullable), created_at, updated_at
  - Add regex validator on upi_id: `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`
  - Implement `clean()` method validating range_from < range_to
  - Set `Meta.ordering` to ['-created_at']
  - _Requirements: 8.1_

- [-] 2.5 Create BankDetail model with encryption (payments/models.py)
  - Define `BankDetail` model with fields: id, bank_name (max 200), account_holder_name (max 200), account_number (CharField, max 255, encrypted), ifsc_code (max 11, with regex validator), branch_name (max 200), brand (FK), range_from, range_to (DecimalField), status (boolean, default True), created_by (FK to User, nullable), created_at, updated_at
  - Add regex validator on ifsc_code: `^[A-Z]{4}0[A-Z0-9]{6}$`
  - Implement `clean()` method validating range_from < range_to
  - Implement `encrypt_account_number(account_number)` using Fernet encryption from `cryptography` library with key from `settings.ENCRYPTION_KEY`
  - Implement `decrypt_account_number()` method
  - Implement `get_masked_account_number()` method showing only last 4 digits (e.g., ********1234)
  - Set `Meta.ordering` to ['-created_at']
  - Set `ENCRYPTION_KEY` in `config/settings.py` (generate via Fernet.generate_key())
  - _Requirements: 9.1, 9.5, 9.6, 9.7_

- [-] 2.6 Create AuditLog model (audit_logs/models.py)
  - Define `AuditLog` model with fields: id, user (FK to User, nullable), action (choices: created, updated, deleted, activated, deactivated), module (choices: brand, user, qr, upi, bank), object_id (BigIntegerField), old_data (JSONField, nullable), new_data (JSONField, nullable), ip_address (max 45 chars), timestamp (auto_now_add)
  - Set `Meta.ordering` to ['-timestamp']
  - Add database indexes on timestamp, (module, timestamp), (user, timestamp)
  - Override `save()` to prevent updates; raise exception if pk is not None
  - Override `delete()` to raise exception; prevent deletion
  - Set all fields to `editable=False`
  - _Requirements: 11.1, 11.9_

- [~] 2.7 Create initial migrations for all models
  - Run `python manage.py makemigrations` for accounts, brands, payments, audit_logs, common
  - Run `python manage.py migrate` to apply migrations
  - Verify no migration conflicts or circular dependencies
  - _Requirements: 3.1, 5.1, 7.1, 8.1, 9.1, 11.1_

## Phase 3: Create Serializers

- [~] 3.1 Create Brand serializers (brands/serializers.py)
  - Create `BrandCreateUpdateSerializer` with fields: id, name, status; include unique name validation
  - Create `BrandListSerializer` with fields: id, name, status, created_at, updated_at
  - Create `BrandDetailSerializer` with fields: id, name, status, created_at, updated_at
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [~] 3.2 Create User serializers (accounts/serializers.py)
  - Create `UserCreateSerializer` with fields: id, full_name, username, email, mobile, role, brand, password (write_only); implement brand validation for RM role
  - Create `UserUpdateSerializer` with fields: id, full_name, username, email, mobile, role, brand, is_active; implement brand validation for RM role
  - Create `UserListSerializer` with fields: id, full_name, username, email, mobile, role, brand, is_active, created_at, updated_at (exclude password)
  - Create `UserDetailSerializer` with fields: id, full_name, username, email, mobile, role, brand, is_active, created_at, updated_at (exclude password)
  - Create `ChangePasswordSerializer` with fields: old_password, new_password, confirm_new_password (write_only); validate matching passwords
  - Create `ResetPasswordSerializer` with field: new_password (write_only)
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [~] 3.3 Create QRCode serializers (payments/serializers.py)
  - Create `QRCodeCreateUpdateSerializer` with fields: id, qr_name, qr_image, brand, range_from, range_to, status
  - Implement file type validation (jpg, jpeg, png, gif, webp only)
  - Implement file size validation (max 5 MB)
  - Implement range validation (range_from < range_to)
  - Create `QRCodeListSerializer` with fields: id, qr_name, qr_image, brand, range_from, range_to, status, created_at
  - Create `QRCodeDetailSerializer` with fields: id, qr_name, qr_image, brand, range_from, range_to, status, created_by, created_at, updated_at
  - _Requirements: 7.3, 7.5, 7.6, 7.7, 7.8_

- [~] 3.4 Create UPI serializers (payments/serializers.py)
  - Create `UPICreateUpdateSerializer` with fields: id, upi_id, brand, range_from, range_to, status
  - Implement range validation (range_from < range_to)
  - Create `UPIListSerializer` with fields: id, upi_id, brand, range_from, range_to, status, created_at
  - Create `UPIDetailSerializer` with fields: id, upi_id, brand, range_from, range_to, status, created_by, created_at, updated_at
  - _Requirements: 8.3, 8.7_

- [~] 3.5 Create BankDetail serializers (payments/serializers.py)
  - Create `BankDetailCreateUpdateSerializer` with fields: id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, brand, range_from, range_to, status
  - Implement range validation (range_from < range_to)
  - Create `BankDetailListSerializer` displaying masked account number using `get_masked_account_number()`
  - Create `BankDetailDetailSerializer` with masked account number in all responses; never expose plaintext or encrypted account_number
  - _Requirements: 9.3, 9.5, 9.8, 9.11_

- [~] 3.6 Create AuditLog serializer (audit_logs/serializers.py)
  - Create `AuditLogListSerializer` with fields: id, user, action, module, object_id, old_data, new_data, ip_address, timestamp
  - Create `AuditLogDetailSerializer` with same fields
  - _Requirements: 11.6_

## Phase 4: Create Service Layer

- [~] 4.1 Create AuthService (accounts/services.py)
  - Implement `authenticate_user(username, password)` method: validate credentials, check is_active status, return user object or raise error
  - Implement `generate_tokens(user)` method: generate access and refresh JWT tokens using rest_framework_simplejwt
  - Implement `validate_refresh_token(refresh_token)` method: validate token and check blacklist status
  - Implement `logout_user(refresh_token, user)` method: add refresh token to blacklist
  - Implement `change_password(user, old_password, new_password)` method: validate old password, run Django password validators, update password
  - _Requirements: 3.6, 3.7, 3.8, 3.9, 3.10, 3.12, 3.13, 3.14, 3.15_

- [~] 4.2 Create BrandService (brands/services.py)
  - Implement `get_all_brands(user, filters, search, ordering, page)` method: return paginated queryset, apply filters
  - Implement `create_brand(user, data, ip_address)` method: verify user is Admin, create brand, trigger audit log, return created brand
  - Implement `get_brand_detail(user, brand_id)` method: return brand detail or raise 404
  - Implement `update_brand(user, brand_id, data, ip_address)` method: verify Admin, update brand, trigger audit log
  - Implement `delete_brand(user, brand_id, ip_address)` method: verify Admin, deactivate brand (soft delete), trigger audit log
  - Implement `activate_brand(user, brand_id, ip_address)` method: set status=True, trigger audit log
  - Implement `deactivate_brand(user, brand_id, ip_address)` method: set status=False, trigger audit log
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.10_

- [~] 4.3 Create UserService (accounts/services.py)
  - Implement `get_all_users(user, filters, search, ordering, page)` method: return paginated queryset excluding password fields, apply filters
  - Implement `create_user(user, data, ip_address)` method: verify Admin, validate brand requirement for RM, create user, hash password, trigger audit log
  - Implement `get_user_detail(user, user_id)` method: return user detail excluding password or raise 404
  - Implement `update_user(user, user_id, data, ip_address)` method: verify Admin, validate brand requirement for RM role, update user, trigger audit log
  - Implement `delete_user(user, user_id, ip_address)` method: verify Admin, deactivate user (set is_active=False), trigger audit log
  - Implement `reset_password(user, user_id, new_password, ip_address)` method: verify Admin, validate password, set new password, trigger audit log
  - Implement `activate_user(user, user_id, ip_address)` method: set is_active=True, trigger audit log
  - Implement `deactivate_user(user, user_id, ip_address)` method: set is_active=False, trigger audit log
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10, 6.11_

- [~] 4.4 Create QRCodeService (payments/services.py)
  - Implement `get_filtered_queryset(user, filters)` method: apply brand filtering for RM (only active, own brand), return queryset
  - Implement `get_all_qr(user, filters, search, ordering, page)` method: call get_filtered_queryset, return paginated results
  - Implement `create_qr(user, data, ip_address)` method: verify Admin/BackOffice, validate file (type, size), validate range, generate UUID filename for image, save record, trigger audit log
  - Implement `get_qr_detail(user, qr_id)` method: check brand access for RM, return detail or 404
  - Implement `update_qr(user, qr_id, data, ip_address)` method: verify Admin/BackOffice, check brand access for RM (403), validate range, update record, trigger audit log
  - Implement `delete_qr(user, qr_id, ip_address)` method: verify Admin/BackOffice, delete image file from storage, delete record, trigger audit log
  - Implement `activate_qr(user, qr_id, ip_address)` method: set status=True, trigger audit log
  - Implement `deactivate_qr(user, qr_id, ip_address)` method: set status=False, trigger audit log
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.7, 7.9, 7.10, 7.11, 7.12, 10.2_

- [~] 4.5 Create UPIService (payments/services.py)
  - Implement `get_filtered_queryset(user, filters)` method: apply brand filtering for RM (only active, own brand), return queryset
  - Implement `get_all_upi(user, filters, search, ordering, page)` method: call get_filtered_queryset, return paginated results
  - Implement `create_upi(user, data, ip_address)` method: verify Admin/BackOffice, validate UPI ID format, validate range, create record, trigger audit log
  - Implement `get_upi_detail(user, upi_id)` method: check brand access for RM, return detail or 404
  - Implement `update_upi(user, upi_id, data, ip_address)` method: verify Admin/BackOffice, check brand access for RM (403), validate range, update record, trigger audit log
  - Implement `delete_upi(user, upi_id, ip_address)` method: verify Admin/BackOffice, delete record, trigger audit log
  - Implement `activate_upi(user, upi_id, ip_address)` method: set status=True, trigger audit log
  - Implement `deactivate_upi(user, upi_id, ip_address)` method: set status=False, trigger audit log
  - _Requirements: 8.2, 8.3, 8.5, 8.6, 8.7, 8.9, 8.10_

- [~] 4.6 Create BankDetailService (payments/services.py)
  - Implement `get_filtered_queryset(user, filters)` method: apply brand filtering for RM (only active, own brand), return queryset
  - Implement `get_all_bank(user, filters, search, ordering, page)` method: call get_filtered_queryset, return paginated results
  - Implement `create_bank(user, data, ip_address)` method: verify Admin/BackOffice, validate IFSC code, validate range, encrypt account_number, create record, trigger audit log
  - Implement `get_bank_detail(user, bank_id)` method: check brand access for RM, return detail with masked account number or 404
  - Implement `update_bank(user, bank_id, data, ip_address)` method: verify Admin/BackOffice, check brand access for RM (403), validate range, re-encrypt account_number if provided, update record, trigger audit log
  - Implement `delete_bank(user, bank_id, ip_address)` method: verify Admin/BackOffice, delete record, trigger audit log
  - Implement `activate_bank(user, bank_id, ip_address)` method: set status=True, trigger audit log
  - Implement `deactivate_bank(user, bank_id, ip_address)` method: set status=False, trigger audit log
  - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.8, 9.10, 9.11, 10.3, 10.4_

- [~] 4.7 Create AuditService (audit_logs/services.py)
  - Implement `log_action(user, action, module, object_id, old_data, new_data, ip_address)` method: create AuditLog record
  - Implement `get_audit_logs(user, filters, ordering, page)` method: verify Admin/BackOffice (deny RM access), return paginated audit logs
  - Implement `serialize_model_instance(instance)` method: convert model instance to JSON-serializable dict (mask account_number for BankDetail)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.8_

## Phase 5: Create Permission Classes

- [~] 5.1 Create permission classes (accounts/permissions.py)
  - Create `IsAdmin` permission class: allow access only to authenticated users with role='admin'
  - Create `IsBackOffice` permission class: allow access only to authenticated users with role='back_office'
  - Create `IsAdminOrBackOffice` permission class: allow access to users with role='admin' or 'back_office'
  - Create `IsRM` permission class: allow access only to authenticated users with role='rm'
  - Create `IsAdminOrBackOfficeOrRM` permission class: allow access to any authenticated user
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

## Phase 6: Create Authentication Views (accounts/views.py)

- [~] 6.1 Implement login view (POST /api/auth/login/)
  - Use FBV with `@api_view(['POST'])`
  - Accept request body: `{"username": "string", "password": "string"}`
  - Call `AuthService.authenticate_user()` to validate credentials
  - If invalid or user inactive, return 401 error response with appropriate message
  - Call `AuthService.generate_tokens()` to create JWT tokens
  - Return 200 success response with `{"access": token, "refresh": token}` in data field
  - Log IP address and action via `AuditService` (non-audit log, just activity tracking)
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 3.6, 3.7, 3.8_

- [~] 6.2 Implement refresh token view (POST /api/auth/refresh/)
  - Use FBV with `@api_view(['POST'])`
  - Accept request body: `{"refresh": "jwt_token"}`
  - Validate refresh token and check blacklist
  - Generate new tokens with rotation enabled
  - Return 200 success response with new tokens or 401 error if blacklisted/invalid
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 3.9, 3.11_

- [~] 6.3 Implement logout view (POST /api/auth/logout/)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAuthenticated])`
  - Accept request body: `{"refresh": "jwt_token"}`
  - Call `AuthService.logout_user()` to blacklist refresh token
  - Return 200 success response or 400 if token invalid
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 3.10_

- [~] 6.4 Implement change-password view (POST /api/auth/change-password/)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAuthenticated])`
  - Accept request body: `{"old_password": "string", "new_password": "string", "confirm_new_password": "string"}`
  - Call `AuthService.change_password()` to validate and update password
  - Validate matching new passwords, run Django password validators
  - Return 200 success response or 400 with field errors
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 3.12, 3.13, 3.14, 3.15_

## Phase 7: Create Brand Views (brands/views.py)

- [~] 7.1 Implement GET /api/brands/ (list brands)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdmin])`
  - Call `BrandService.get_all_brands()` passing user, filters, search, ordering, page
  - Return 200 success response with paginated brand list
  - Add filtering support: status (boolean)
  - Add search support: name
  - Add ordering support: name, created_at
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 5.2, 5.8_

- [~] 7.2 Implement POST /api/brands/ (create brand)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdmin])`
  - Accept serializer: `BrandCreateUpdateSerializer`
  - Call `BrandService.create_brand()` with request data and IP address
  - Return 201 success response with created brand data
  - Handle duplicate name (409 conflict error)
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 5.3, 5.7, 5.10_

- [~] 7.3 Implement GET /api/brands/{id}/ (brand detail)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdmin])`
  - Call `BrandService.get_brand_detail()` with brand_id
  - Return 200 success response with brand detail or 404 error
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 5.4_

- [~] 7.4 Implement PUT/PATCH /api/brands/{id}/ (update brand)
  - Use FBV with `@api_view(['PUT', 'PATCH'])` and `@permission_classes([IsAdmin])`
  - Accept serializer: `BrandCreateUpdateSerializer`
  - Call `BrandService.update_brand()` with brand_id, data, IP address
  - Return 200 success response with updated brand or 404/409 error
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 5.5, 5.10_

- [~] 7.5 Implement DELETE /api/brands/{id}/ (delete brand)
  - Use FBV with `@api_view(['DELETE'])` and `@permission_classes([IsAdmin])`
  - Call `BrandService.delete_brand()` with brand_id and IP address (soft delete via deactivate)
  - Return 200 success response with message or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 5.6, 5.10_

- [~] 7.6 Implement POST /api/brands/{id}/activate/ (activate brand)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdmin])`
  - Call `BrandService.activate_brand()` with brand_id and IP address
  - Return 200 success response with updated brand or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.6_

- [~] 7.7 Implement POST /api/brands/{id}/deactivate/ (deactivate brand)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdmin])`
  - Call `BrandService.deactivate_brand()` with brand_id and IP address
  - Return 200 success response with updated brand or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.6_

## Phase 8: Create User Views (accounts/views.py)

- [~] 8.1 Implement GET /api/users/ (list users)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdmin])`
  - Call `UserService.get_all_users()` passing user, filters, search, ordering, page
  - Return 200 success response with paginated user list (exclude password)
  - Add filtering support: role, brand, is_active
  - Add search support: full_name, username, email
  - Add ordering support: created_at
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 6.1, 6.9_

- [~] 8.2 Implement POST /api/users/ (create user)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdmin])`
  - Accept serializer: `UserCreateSerializer`
  - Call `UserService.create_user()` with request data and IP address
  - Return 201 success response with created user data
  - Handle duplicate username/email (409 conflict error)
  - Validate brand requirement for RM role (400 error)
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 6.2, 6.7, 6.8, 6.11_

- [~] 8.3 Implement GET /api/users/{id}/ (user detail)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdmin])`
  - Call `UserService.get_user_detail()` with user_id
  - Return 200 success response with user detail (exclude password) or 404 error
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 6.3_

- [~] 8.4 Implement PUT/PATCH /api/users/{id}/ (update user)
  - Use FBV with `@api_view(['PUT', 'PATCH'])` and `@permission_classes([IsAdmin])`
  - Accept serializer: `UserUpdateSerializer`
  - Call `UserService.update_user()` with user_id, data, IP address
  - Return 200 success response with updated user or 404 error
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 6.4, 6.11_

- [~] 8.5 Implement DELETE /api/users/{id}/ (delete/deactivate user)
  - Use FBV with `@api_view(['DELETE'])` and `@permission_classes([IsAdmin])`
  - Call `UserService.delete_user()` with user_id and IP address (deactivate via is_active=False)
  - Return 200 success response with message or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 6.5, 6.11_

- [~] 8.6 Implement POST /api/users/{id}/reset-password/ (reset password)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdmin])`
  - Accept serializer: `ResetPasswordSerializer` with new_password
  - Call `UserService.reset_password()` with user_id, new_password, IP address
  - Return 200 success response or 400 (validation error) or 404 error
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 6.6, 6.11_

- [~] 8.7 Implement POST /api/users/{id}/activate/ (activate user)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdmin])`
  - Call `UserService.activate_user()` with user_id and IP address
  - Return 200 success response with updated user or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.7_

- [~] 8.8 Implement POST /api/users/{id}/deactivate/ (deactivate user)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdmin])`
  - Call `UserService.deactivate_user()` with user_id and IP address
  - Return 200 success response with updated user or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.7_

## Phase 9: Create QR Code Views (payments/views.py)

- [~] 9.1 Implement GET /api/payments/qr/ (list QR codes)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdminOrBackOfficeOrRM])`
  - Call `QRCodeService.get_all_qr()` passing user, filters, search, ordering, page
  - For Admin/BackOffice: return all QR records; for RM: auto-filter to active records of their brand
  - Return 200 success response with paginated QR list
  - Add filtering support: brand, status, range_from, range_to
  - Add search support: qr_name
  - Add ordering support: created_at, qr_name
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 7.2, 7.9, 7.10_

- [~] 9.2 Implement POST /api/payments/qr/ (create QR code)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Accept multipart form data with `QRCodeCreateUpdateSerializer`
  - Call `QRCodeService.create_qr()` with request data and IP address
  - Validate file type (jpg, jpeg, png, gif, webp) and size (max 5 MB)
  - Generate UUID prefix for uploaded filename to prevent collisions
  - Trigger audit log via `AuditService`
  - Return 201 success response with created QR record
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 7.3, 7.5, 7.6, 7.7, 7.11_

- [~] 9.3 Implement GET /api/payments/qr/{id}/ (QR code detail)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdminOrBackOfficeOrRM])`
  - Call `QRCodeService.get_qr_detail()` with qr_id and user
  - For RM: check brand match and active status; return 404 if not accessible
  - Return 200 success response with QR detail or 404 error
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 7.4, 12.4_

- [~] 9.4 Implement PUT/PATCH /api/payments/qr/{id}/ (update QR code)
  - Use FBV with `@api_view(['PUT', 'PATCH'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Accept multipart form data with `QRCodeCreateUpdateSerializer`
  - Call `QRCodeService.update_qr()` with qr_id, data, IP address
  - Validate file type and size if image provided
  - For RM attempting access: 403 error
  - Trigger audit log
  - Return 200 success response with updated QR or 404/403 error
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 7.4, 7.11, 12.5_

- [~] 9.5 Implement DELETE /api/payments/qr/{id}/ (delete QR code)
  - Use FBV with `@api_view(['DELETE'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `QRCodeService.delete_qr()` with qr_id and IP address
  - Delete associated image file from storage before deleting record
  - Trigger audit log
  - Return 200 success response or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 7.4, 7.12, 10.2_

- [~] 9.6 Implement POST /api/payments/qr/{id}/activate/ (activate QR code)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `QRCodeService.activate_qr()` with qr_id and IP address
  - Trigger audit log
  - Return 200 success response with updated QR or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.1, 10.2_

- [~] 9.7 Implement POST /api/payments/qr/{id}/deactivate/ (deactivate QR code)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `QRCodeService.deactivate_qr()` with qr_id and IP address
  - Trigger audit log
  - Return 200 success response with updated QR or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.2_

## Phase 10: Create UPI Views (payments/views.py)

- [~] 10.1 Implement GET /api/payments/upi/ (list UPI records)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdminOrBackOfficeOrRM])`
  - Call `UPIService.get_all_upi()` passing user, filters, search, ordering, page
  - For Admin/BackOffice: return all UPI records; for RM: auto-filter to active records of their brand
  - Return 200 success response with paginated UPI list
  - Add filtering support: brand, status, range_from, range_to
  - Add search support: upi_id
  - Add ordering support: created_at, upi_id
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 8.2, 8.8, 8.9_

- [~] 10.2 Implement POST /api/payments/upi/ (create UPI record)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Accept serializer: `UPICreateUpdateSerializer`
  - Call `UPIService.create_upi()` with request data and IP address
  - Validate UPI ID format via model validator
  - Trigger audit log
  - Return 201 success response with created UPI record
  - Handle duplicate upi_id (409 conflict error)
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 8.3, 8.5, 8.6, 8.10_

- [~] 10.3 Implement GET /api/payments/upi/{id}/ (UPI detail)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdminOrBackOfficeOrRM])`
  - Call `UPIService.get_upi_detail()` with upi_id and user
  - For RM: check brand match and active status; return 404 if not accessible
  - Return 200 success response with UPI detail or 404 error
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 8.4, 12.4_

- [~] 10.4 Implement PUT/PATCH /api/payments/upi/{id}/ (update UPI record)
  - Use FBV with `@api_view(['PUT', 'PATCH'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Accept serializer: `UPICreateUpdateSerializer`
  - Call `UPIService.update_upi()` with upi_id, data, IP address
  - For RM attempting access: 403 error
  - Trigger audit log
  - Return 200 success response with updated UPI or 404/403 error
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 8.4, 8.10_

- [~] 10.5 Implement DELETE /api/payments/upi/{id}/ (delete UPI record)
  - Use FBV with `@api_view(['DELETE'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `UPIService.delete_upi()` with upi_id and IP address
  - Trigger audit log
  - Return 200 success response or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 8.4, 8.10_

- [~] 10.6 Implement POST /api/payments/upi/{id}/activate/ (activate UPI record)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `UPIService.activate_upi()` with upi_id and IP address
  - Trigger audit log
  - Return 200 success response with updated UPI or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.3_

- [~] 10.7 Implement POST /api/payments/upi/{id}/deactivate/ (deactivate UPI record)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `UPIService.deactivate_upi()` with upi_id and IP address
  - Trigger audit log
  - Return 200 success response with updated UPI or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.3_

## Phase 11: Create Bank Detail Views (payments/views.py)

- [~] 11.1 Implement GET /api/payments/bank/ (list bank details)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdminOrBackOfficeOrRM])`
  - Call `BankDetailService.get_all_bank()` passing user, filters, search, ordering, page
  - For Admin/BackOffice: return all bank records; for RM: auto-filter to active records of their brand
  - Return 200 success response with paginated bank list (all account numbers masked)
  - Add filtering support: brand, status, range_from, range_to
  - Add search support: bank_name, account_holder_name, ifsc_code
  - Add ordering support: created_at, bank_name
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 9.2, 9.9, 9.10_

- [~] 11.2 Implement POST /api/payments/bank/ (create bank detail)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Accept serializer: `BankDetailCreateUpdateSerializer`
  - Call `BankDetailService.create_bank()` with request data and IP address
  - Validate IFSC code format via model validator
  - Encrypt account_number before storage via `BankDetail.encrypt_account_number()`
  - Trigger audit log with masked account number
  - Return 201 success response with created bank record (account number masked)
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 9.3, 9.5, 9.7, 9.11_

- [~] 11.3 Implement GET /api/payments/bank/{id}/ (bank detail)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdminOrBackOfficeOrRM])`
  - Call `BankDetailService.get_bank_detail()` with bank_id and user
  - For RM: check brand match and active status; return 404 if not accessible
  - Return 200 success response with bank detail (account number masked) or 404 error
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 9.4, 9.6, 12.4_

- [~] 11.4 Implement PUT/PATCH /api/payments/bank/{id}/ (update bank detail)
  - Use FBV with `@api_view(['PUT', 'PATCH'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Accept serializer: `BankDetailCreateUpdateSerializer`
  - Call `BankDetailService.update_bank()` with bank_id, data, IP address
  - If account_number provided: re-encrypt before storage
  - For RM attempting access: 403 error
  - Trigger audit log with masked account number
  - Return 200 success response with updated bank record (masked) or 404/403 error
  - Add `@extend_schema` with operation_id, summary, request/response examples
  - _Requirements: 9.4, 9.11_

- [~] 11.5 Implement DELETE /api/payments/bank/{id}/ (delete bank detail)
  - Use FBV with `@api_view(['DELETE'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `BankDetailService.delete_bank()` with bank_id and IP address
  - Trigger audit log
  - Return 200 success response or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 9.4_

- [~] 11.6 Implement POST /api/payments/bank/{id}/activate/ (activate bank detail)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `BankDetailService.activate_bank()` with bank_id and IP address
  - Trigger audit log
  - Return 200 success response with updated bank record or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.4_

- [~] 11.7 Implement POST /api/payments/bank/{id}/deactivate/ (deactivate bank detail)
  - Use FBV with `@api_view(['POST'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Call `BankDetailService.deactivate_bank()` with bank_id and IP address
  - Trigger audit log
  - Return 200 success response with updated bank record or 404 error
  - Add `@extend_schema` with operation_id, summary
  - _Requirements: 10.4_

## Phase 12: Create Audit Log Views (audit_logs/views.py)

- [~] 12.1 Implement GET /api/audit-logs/ (list audit logs)
  - Use FBV with `@api_view(['GET'])` and `@permission_classes([IsAdminOrBackOffice])`
  - Deny RM access with 403 error
  - Call `AuditService.get_audit_logs()` passing user, filters, ordering, page
  - Return 200 success response with paginated audit log list
  - Add filtering support: user, action, module, timestamp (date range)
  - Add ordering support: timestamp
  - Add `@extend_schema` with operation_id, summary, parameters
  - _Requirements: 11.6, 11.7, 11.8_

## Phase 13: Configure URL Routing

- [~] 13.1 Create auth URL configuration (accounts/auth_urls.py)
  - Create URL patterns for:
    - `POST /api/auth/login/` → login view
    - `POST /api/auth/refresh/` → refresh view
    - `POST /api/auth/logout/` → logout view
    - `POST /api/auth/change-password/` → change-password view
  - Use path() function from django.urls
  - _Requirements: 3.6, 3.9, 3.10, 3.12_

- [~] 13.2 Create user URL configuration (accounts/user_urls.py)
  - Create URL patterns for:
    - `GET/POST /api/users/` → list/create users
    - `GET/PUT/PATCH/DELETE /api/users/{id}/` → user detail/update/delete
    - `POST /api/users/{id}/reset-password/` → reset password
    - `POST /api/users/{id}/activate/` → activate user
    - `POST /api/users/{id}/deactivate/` → deactivate user
  - Use path() and re_path() functions
  - _Requirements: 6.1-6.6_

- [~] 13.3 Create brand URL configuration (brands/urls.py)
  - Create URL patterns for:
    - `GET/POST /api/brands/` → list/create brands
    - `GET/PUT/PATCH/DELETE /api/brands/{id}/` → brand detail/update/delete
    - `POST /api/brands/{id}/activate/` → activate brand
    - `POST /api/brands/{id}/deactivate/` → deactivate brand
  - Use path() and re_path() functions
  - _Requirements: 5.2-5.6, 10.6_

- [~] 13.4 Create payment URLs configuration (payments/urls.py)
  - Create URL patterns for QR codes:
    - `GET/POST /api/payments/qr/` → list/create QR
    - `GET/PUT/PATCH/DELETE /api/payments/qr/{id}/` → QR detail/update/delete
    - `POST /api/payments/qr/{id}/activate/` → activate QR
    - `POST /api/payments/qr/{id}/deactivate/` → deactivate QR
  - Create URL patterns for UPI:
    - `GET/POST /api/payments/upi/` → list/create UPI
    - `GET/PUT/PATCH/DELETE /api/payments/upi/{id}/` → UPI detail/update/delete
    - `POST /api/payments/upi/{id}/activate/` → activate UPI
    - `POST /api/payments/upi/{id}/deactivate/` → deactivate UPI
  - Create URL patterns for bank details:
    - `GET/POST /api/payments/bank/` → list/create bank
    - `GET/PUT/PATCH/DELETE /api/payments/bank/{id}/` → bank detail/update/delete
    - `POST /api/payments/bank/{id}/activate/` → activate bank
    - `POST /api/payments/bank/{id}/deactivate/` → deactivate bank
  - _Requirements: 7.2-7.4, 8.2-8.4, 9.2-9.4_

- [~] 13.5 Create audit log URL configuration (audit_logs/urls.py)
  - Create URL patterns for:
    - `GET /api/audit-logs/` → list audit logs
  - _Requirements: 11.6_

- [~] 13.6 Update main URL configuration (config/urls.py)
  - Include auth URLs at `/api/auth/`
  - Include user URLs at `/api/users/`
  - Include brand URLs at `/api/brands/`
  - Include payment URLs at `/api/payments/`
  - Include audit log URLs at `/api/audit-logs/`
  - Add OpenAPI schema endpoint at `/api/schema/` using drf_spectacular
  - Add Swagger UI endpoint at `/api/docs/` (if using drf_spectacular)
  - Add ReDoc endpoint at `/api/redoc/` (if using drf_spectacular)
  - Configure media file serving for development
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

## Phase 14: Testing

- [~] 14.1 Write unit tests for User model and validators (accounts/tests.py)
  - Test User creation with different roles (admin, back_office, rm)
  - Test brand requirement validation for RM role
  - Test password hashing
  - Test unique constraints on username and email
  - Test is_active flag functionality
  - _Requirements: 3.1-3.5_

- [~] 14.2 Write unit tests for AuthService (accounts/tests.py)
  - Test authenticate_user() with valid credentials
  - Test authenticate_user() with invalid credentials (401)
  - Test authenticate_user() with inactive user (401)
  - Test generate_tokens() creates valid access and refresh tokens
  - Test validate_refresh_token() with valid token
  - Test validate_refresh_token() with blacklisted token (401)
  - Test logout_user() blacklists refresh token
  - Test change_password() with valid old password
  - Test change_password() with invalid old password (400)
  - Test change_password() with mismatched new passwords (400)
  - _Requirements: 3.6-3.15_

- [~] 14.3 Write unit tests for BrandService (brands/tests.py)
  - Test create_brand() by Admin
  - Test create_brand() with duplicate name (409)
  - Test create_brand() by non-Admin (403 should be enforced at permission level)
  - Test update_brand() by Admin
  - Test get_all_brands() filtering, searching, ordering
  - Test delete_brand() soft deletes (sets status=False)
  - Test activate_brand() and deactivate_brand()
  - _Requirements: 5.2-5.10_

- [~] 14.4 Write unit tests for UserService (accounts/tests.py)
  - Test create_user() with all roles
  - Test create_user() with RM but no brand (400)
  - Test create_user() with duplicate username/email (409)
  - Test get_all_users() filtering, searching, ordering (exclude password)
  - Test update_user() with role/brand validation
  - Test delete_user() deactivates user (sets is_active=False)
  - Test reset_password() by Admin
  - Test activate_user() and deactivate_user()
  - _Requirements: 6.1-6.11_

- [~] 14.5 Write unit tests for QRCodeService (payments/tests.py)
  - Test create_qr() with valid image file
  - Test create_qr() with invalid file type (400)
  - Test create_qr() with oversized file (400)
  - Test get_filtered_queryset() for Admin (all records)
  - Test get_filtered_queryset() for BackOffice (all records)
  - Test get_filtered_queryset() for RM (only active, own brand)
  - Test get_all_qr() filtering, searching, ordering
  - Test get_qr_detail() access control for RM
  - Test delete_qr() deletes image file from storage
  - Test activate_qr() and deactivate_qr()
  - _Requirements: 7.2-7.12_

- [~] 14.6 Write unit tests for UPIService (payments/tests.py)
  - Test create_upi() with valid UPI ID format
  - Test create_upi() with invalid UPI ID format (400)
  - Test create_upi() with duplicate upi_id (409)
  - Test get_filtered_queryset() for different roles
  - Test get_all_upi() filtering, searching, ordering
  - Test get_upi_detail() access control for RM
  - Test update_upi() and delete_upi()
  - Test activate_upi() and deactivate_upi()
  - _Requirements: 8.2-8.10_

- [~] 14.7 Write unit tests for BankDetailService (payments/tests.py)
  - Test create_bank() with valid IFSC code
  - Test create_bank() with invalid IFSC code (400)
  - Test account_number encryption/decryption
  - Test get_masked_account_number() returns correct format (********1234)
  - Test get_filtered_queryset() for different roles
  - Test get_all_bank() filtering, searching, ordering
  - Test get_bank_detail() access control for RM
  - Test account_number masking in all API responses (never plaintext/encrypted)
  - Test update_bank() re-encrypts account_number if provided
  - Test activate_bank() and deactivate_bank()
  - _Requirements: 9.2-9.11_

- [~] 14.8 Write unit tests for AuditService (audit_logs/tests.py)
  - Test log_action() creates AuditLog record with correct fields
  - Test audit log captures user, action, module, object_id, old_data, new_data, ip_address, timestamp
  - Test serialize_model_instance() returns JSON-serializable dict
  - Test serialize_model_instance() masks account_number for BankDetail
  - Test AuditLog immutability (prevent updates and deletes)
  - Test get_audit_logs() returns audit logs for Admin/BackOffice
  - Test get_audit_logs() denies RM access (403)
  - _Requirements: 11.1-11.8_

- [~] 14.9 Write integration tests for authentication endpoints
  - Test POST /api/auth/login/ with valid credentials
  - Test POST /api/auth/login/ with invalid credentials (401)
  - Test POST /api/auth/login/ with inactive user (401)
  - Test POST /api/auth/refresh/ with valid token
  - Test POST /api/auth/refresh/ with blacklisted token (401)
  - Test POST /api/auth/logout/ blacklists token
  - Test POST /api/auth/change-password/ with valid old password
  - Test permission enforcement on authenticated endpoints
  - _Requirements: 3.6-3.15_

- [~] 14.10 Write integration tests for brand CRUD endpoints
  - Test GET /api/brands/ returns paginated list (Admin only)
  - Test POST /api/brands/ creates brand (Admin only)
  - Test GET /api/brands/{id}/ returns brand detail (Admin only)
  - Test PUT/PATCH /api/brands/{id}/ updates brand (Admin only)
  - Test DELETE /api/brands/{id}/ deactivates brand (Admin only)
  - Test POST /api/brands/{id}/activate/ and deactivate/ (Admin only)
  - Test permission enforcement (non-Admin gets 403)
  - Test filtering, searching, ordering on list endpoint
  - _Requirements: 5.2-5.10_

- [~] 14.11 Write integration tests for user CRUD endpoints
  - Test GET /api/users/ returns paginated list (Admin only)
  - Test POST /api/users/ creates user (Admin only)
  - Test GET /api/users/{id}/ returns user detail (Admin only)
  - Test PUT/PATCH /api/users/{id}/ updates user (Admin only)
  - Test DELETE /api/users/{id}/ deactivates user (Admin only)
  - Test POST /api/users/{id}/reset-password/ resets password (Admin only)
  - Test POST /api/users/{id}/activate/ and deactivate/ (Admin only)
  - Test permission enforcement (non-Admin gets 403)
  - Test filtering, searching, ordering on list endpoint
  - _Requirements: 6.1-6.11_

- [~] 14.12 Write integration tests for QR code endpoints
  - Test GET /api/payments/qr/ filters by role (Admin: all, BackOffice: all, RM: active own brand only)
  - Test POST /api/payments/qr/ creates QR with multipart form data (Admin/BackOffice only)
  - Test GET /api/payments/qr/{id}/ with access control (RM: own active only)
  - Test PUT/PATCH /api/payments/qr/{id}/ updates QR (Admin/BackOffice only)
  - Test DELETE /api/payments/qr/{id}/ deletes image and record (Admin/BackOffice only)
  - Test POST /api/payments/qr/{id}/activate/ and deactivate/ (Admin/BackOffice only)
  - Test RM cannot create/update/delete QR (403)
  - Test filtering, searching, ordering on list endpoint
  - _Requirements: 7.2-7.12, 12.2, 12.5_

- [~] 14.13 Write integration tests for UPI endpoints
  - Test GET /api/payments/upi/ filters by role (Admin: all, BackOffice: all, RM: active own brand only)
  - Test POST /api/payments/upi/ creates UPI (Admin/BackOffice only)
  - Test GET /api/payments/upi/{id}/ with access control (RM: own active only)
  - Test PUT/PATCH /api/payments/upi/{id}/ updates UPI (Admin/BackOffice only)
  - Test DELETE /api/payments/upi/{id}/ deletes UPI (Admin/BackOffice only)
  - Test POST /api/payments/upi/{id}/activate/ and deactivate/ (Admin/BackOffice only)
  - Test RM cannot create/update/delete UPI (403)
  - Test filtering, searching, ordering on list endpoint
  - _Requirements: 8.2-8.10_

- [~] 14.14 Write integration tests for bank detail endpoints
  - Test GET /api/payments/bank/ filters by role; account_number always masked
  - Test POST /api/payments/bank/ creates bank with encrypted account_number (Admin/BackOffice only)
  - Test GET /api/payments/bank/{id}/ returns masked account_number (RM: own active only)
  - Test PUT/PATCH /api/payments/bank/{id}/ updates bank (Admin/BackOffice only)
  - Test DELETE /api/payments/bank/{id}/ deletes bank (Admin/BackOffice only)
  - Test POST /api/payments/bank/{id}/activate/ and deactivate/ (Admin/BackOffice only)
  - Test RM cannot create/update/delete bank (403)
  - Test account_number never exposed in plain/encrypted form
  - Test filtering, searching, ordering on list endpoint
  - _Requirements: 9.2-9.11_

- [~] 14.15 Write integration tests for audit log endpoints
  - Test GET /api/audit-logs/ returns paginated list (Admin/BackOffice only)
  - Test RM cannot access /api/audit-logs/ (403)
  - Test filtering by user, action, module
  - Test filtering by date range on timestamp
  - Test ordering by timestamp
  - Test audit logs include create, update, delete, activate, deactivate actions
  - _Requirements: 11.6-11.8_

## Phase 15: Documentation & Final Integration

- [~] 15.1 Verify OpenAPI schema generation
  - Run `python manage.py runserver` and verify `/api/schema/` returns valid OpenAPI 3 JSON
  - Verify all endpoints are documented with proper tags, summaries, descriptions
  - Verify all request/response schemas are correctly defined
  - Verify all parameters (filters, search, ordering, pagination) are documented
  - _Requirements: 13.1-13.4_

- [~] 15.2 Test Swagger UI at /api/docs/
  - Navigate to `/api/docs/` in browser
  - Verify all endpoints are visible and interactive
  - Verify authentication dropdown shows JWT token input
  - Verify request/response examples are displayed
  - _Requirements: 13.3, 13.4_

- [~] 15.3 Test ReDoc UI at /api/redoc/
  - Navigate to `/api/redoc/` in browser
  - Verify all endpoints are visible in interactive documentation
  - Verify schemas and models are properly displayed
  - _Requirements: 13.3, 13.4_

- [~] 15.4 Create README.md with setup and usage instructions
  - Document Django project setup and Python version requirement (Django 6+)
  - Document environment variables and `.env` file setup
  - Document database migration instructions
  - Document how to create initial Admin user
  - Document API authentication flow and JWT usage
  - Document role-based access control overview
  - Document example API requests for each endpoint
  - Document media file storage configuration
  - Include troubleshooting section for common issues
  - _Requirements: General documentation_

- [~] 15.5 Create .env.example with required environment variables
  - Include `SECRET_KEY`
  - Include `DEBUG` flag
  - Include `ALLOWED_HOSTS`
  - Include database credentials: `DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
  - Include `ENCRYPTION_KEY` for bank account number encryption (generate via Fernet.generate_key())
  - Include `CORS_ALLOWED_ORIGINS`
  - Include JWT settings if configurable
  - _Requirements: General infrastructure_

- [~] 15.6 Verify all permission classes enforce access control
  - Test IsAdmin blocks non-Admin users (403)
  - Test IsBackOffice blocks non-BackOffice users (403)
  - Test IsAdminOrBackOffice blocks RM users (403)
  - Test IsRM blocks Admin and BackOffice users (403)
  - Test IsAdminOrBackOfficeOrRM allows all authenticated users
  - Test unauthenticated requests get 401 (IsAuthenticated enforced globally)
  - _Requirements: 4.1-4.6_

- [~] 15.7 Verify audit logging on all data-modifying operations
  - Create a Brand and verify AuditLog entry with action='created'
  - Update a Brand and verify AuditLog entry with action='updated', old_data, new_data
  - Activate/Deactivate a Brand and verify AuditLog entries with correct actions
  - Create a User and verify AuditLog entry
  - Create/Update/Delete QRCode, UPI, BankDetail and verify audit trails
  - Verify account_number is masked (not plaintext/encrypted) in AuditLog for BankDetail
  - Verify ip_address is captured correctly
  - _Requirements: 11.1-11.8_

- [~] 15.8 Checkpoint - Ensure all tests pass
  - Run full test suite: `python manage.py test`
  - Verify all unit tests pass (accounts, brands, payments, audit_logs)
  - Verify all integration tests pass
  - Verify no test failures or errors
  - Generate test coverage report and ensure >80% coverage
  - Ask the user if questions arise or if manual testing is needed

## Notes

- **Task Dependencies**: Each phase depends on completion of previous phases. Infrastructure (Phase 1) must be completed before Models (Phase 2), which must be completed before Serializers (Phase 3), and so on.
- **File Operations**: All file creation and modification tasks assume existing Django app directories. Use `python manage.py startapp <appname>` if needed.
- **Environment Setup**: Ensure `.env` file is configured with all required variables before running migrations.
- **Database**: All tasks assume MySQL 8.0+ as the configured database backend via `settings.py`.
- **JWT Configuration**: Ensure `SIMPLE_JWT` settings are correctly configured in Phase 1 before implementing authentication views.
- **Encryption Key**: The `ENCRYPTION_KEY` for bank account number encryption must be generated using `cryptography.fernet.Fernet.generate_key()` and stored securely in environment variables.
- **Media File Handling**: Implement proper cleanup for deleted QR images and ensure media directory permissions are configured for production.
- **Testing**: Use `pytest` or Django's built-in test runner. Create fixtures and factories for common test objects (Brand, User, QRCode, etc.).
- **OpenAPI Documentation**: Every FBV must have `@extend_schema` decorator with all relevant parameters to ensure complete API documentation.
- **Brand Filtering for RM**: Always filter at service layer, not in views, to prevent query parameter bypasses.
- **Account Number Masking**: All serializers and views must mask account numbers in responses. Use `get_masked_account_number()` method for consistency.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]
    },
    {
      "id": 2,
      "tasks": ["2.7"]
    },
    {
      "id": 3,
      "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"]
    },
    {
      "id": 4,
      "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7"]
    },
    {
      "id": 5,
      "tasks": ["5.1"]
    },
    {
      "id": 6,
      "tasks": ["6.1", "6.2", "6.3", "6.4"]
    },
    {
      "id": 7,
      "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7"]
    },
    {
      "id": 8,
      "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8"]
    },
    {
      "id": 9,
      "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7"]
    },
    {
      "id": 10,
      "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7"]
    },
    {
      "id": 11,
      "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "11.7"]
    },
    {
      "id": 12,
      "tasks": ["12.1"]
    },
    {
      "id": 13,
      "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5"]
    },
    {
      "id": 14,
      "tasks": ["13.6"]
    },
    {
      "id": 15,
      "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7", "14.8"]
    },
    {
      "id": 16,
      "tasks": ["14.9", "14.10", "14.11", "14.12", "14.13", "14.14", "14.15"]
    },
    {
      "id": 17,
      "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5", "15.6", "15.7"]
    },
    {
      "id": 18,
      "tasks": ["15.8"]
    }
  ]
}
```

---

## How to Use This Task List

1. **Read This Document First**: Understand the complete implementation plan and task structure.
2. **Start with Phase 1**: Configure the Django project settings, common utilities, and base infrastructure.
3. **Execute Tasks in Order**: Follow the phase sequence; each phase builds on the previous one.
4. **Track Progress**: Mark tasks complete as you finish them. Use task checkboxes to update status.
5. **Reference Design Document**: Keep the `design.md` file open for implementation details and code examples.
6. **Refer to Requirements**: Use the `requirements.md` file to verify acceptance criteria and validate each task.
7. **Run Tests**: Execute automated tests after each major phase to catch issues early.
8. **Deploy Incrementally**: Each wave of the dependency graph can be reviewed and tested independently.

---

## Implementation Complete

This task list provides a comprehensive, granular implementation plan for the DWMS backend API. Once all tasks are completed and all tests pass, the API will be ready for production deployment and integration with frontend applications.

**Total Tasks**: ~100+ individual sub-tasks organized into 15 phases
**Estimated Time**: 40-60 hours for a single developer
**Team Size**: 2-3 developers can work in parallel on different services (Auth, Brand, Payments, Audit)

