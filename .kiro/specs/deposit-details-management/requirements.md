# Requirements Document

## Introduction

The Deposit Details Management System (DWMS) is a backend REST API that enables enterprise-grade management and display of deposit payment sources — specifically QR Codes, UPI IDs, and Bank Account details — uploaded and maintained by Back Office users. The system does not process payments or integrate with any bank or payment gateway. It provides role-based access control across three user roles (Admin, Back Office, RM), enforces strict brand-level data isolation for Relationship Managers (RMs), and maintains a full audit trail of all data-modifying operations. The API is built using Django 6+, Django REST Framework with function-based views, JWT authentication, and MySQL as the database.

---

## Glossary

- **API**: The REST API exposed by the DWMS backend.
- **Admin**: A privileged user role with full access to all system resources, including user management, brand management, payment sources, and audit logs.
- **Back_Office**: A user role responsible for managing payment sources (QR Codes, UPI IDs, Bank Details) and viewing audit logs.
- **RM**: Relationship Manager — a user role with read-only access to active payment sources for their single assigned brand only.
- **Brand**: An organisational entity (e.g., TK, TB, BFX) to which payment sources and RMs are associated.
- **Payment_Source**: A record representing one of three deposit detail types: QR Code, UPI ID, or Bank Detail.
- **QR_Code**: A payment source record containing a QR image file, brand association, and an amount range.
- **UPI**: A payment source record containing a UPI ID string, brand association, and an amount range.
- **Bank_Detail**: A payment source record containing bank account information, brand association, and an amount range.
- **Audit_Log**: An immutable record capturing who performed what action on which module, including old and new data snapshots, IP address, and timestamp.
- **JWT**: JSON Web Token used for stateless authentication.
- **Access_Token**: A short-lived JWT used to authenticate API requests.
- **Refresh_Token**: A longer-lived JWT used to obtain new access tokens; subject to blacklisting on logout.
- **Status**: A boolean-like field on most records indicating active or inactive state.
- **Range**: A decimal amount range (Range From, Range To) associated with each payment source, indicating the applicable deposit amount window.
- **IFSC_Code**: Indian Financial System Code in the format of four letters, a zero, and six alphanumeric characters (e.g., ABCD0123456).
- **UPI_ID**: A Virtual Payment Address string in the format `localpart@provider` (e.g., `merchant@upi`).
- **Encrypted_Account_Number**: A bank account number stored encrypted in the database and masked (showing only the last four digits) in API responses.
- **FBV**: Function-Based View — a Django view written as a Python function decorated with `@api_view`.
- **Service_Layer**: A Python module containing business logic, keeping views thin.
- **Standard_Response**: The consistent JSON envelope `{"success": bool, "message": str, "data": any, "errors": any}` returned by every API endpoint.

---

## Requirements

### Requirement 1: Project Configuration and Settings

**User Story:** As a developer, I want the Django project fully configured with all required packages and settings, so that the API is ready to run with JWT auth, media uploads, CORS, filtering, and OpenAPI docs enabled.

#### Acceptance Criteria

1. THE API SHALL include `rest_framework`, `rest_framework_simplejwt`, `rest_framework_simplejwt.token_blacklist`, `drf_spectacular`, `django_filters`, `corsheaders`, `accounts`, `brands`, `payments`, `audit_logs`, and `common` in `INSTALLED_APPS`.
2. THE API SHALL configure `DEFAULT_AUTHENTICATION_CLASSES` to `JWTAuthentication` and `DEFAULT_PERMISSION_CLASSES` to `IsAuthenticated` in `REST_FRAMEWORK` settings.
3. THE API SHALL configure `SIMPLE_JWT` with access token lifetime of 60 minutes, refresh token lifetime of 7 days, token rotation enabled, and blacklisting after rotation enabled.
4. THE API SHALL configure `MEDIA_ROOT` to `BASE_DIR / "media"` and `MEDIA_URL` to `/media/`.
5. THE API SHALL configure `CORS_ALLOWED_ORIGINS` and serve media files in development via `urlpatterns`.
6. THE API SHALL configure `DRF_SPECTACULAR_SETTINGS` with title `"DWMS API"`, version `"1.0.0"`, and description of the system.
7. THE API SHALL configure `django-filter` as the default filter backend alongside `SearchFilter` and `OrderingFilter` in `REST_FRAMEWORK` settings.
8. WHEN `DEBUG` is `True`, THE API SHALL serve media files at `MEDIA_URL` using `django.views.static.serve`.

---

### Requirement 2: Standard API Response Format

**User Story:** As a frontend developer, I want every API response to follow a consistent JSON envelope, so that I can write a single response handler for all endpoints.

#### Acceptance Criteria

1. THE API SHALL return every successful response in the format `{"success": true, "message": "<description>", "data": <payload>, "errors": null}` where `success` is exactly `true`, `data` contains the payload, and `errors` is exactly `null`.
2. THE API SHALL return every error response in the format `{"success": false, "message": "<description>", "data": null, "errors": {"<field>": ["<error>"]}}` where `success` is exactly `false`, `data` is exactly `null`, and `errors` is a non-null object mapping field names to error lists.
3. THE API SHALL provide a utility function `success_response(message, data, status_code)` in `common/utils.py` that constructs and returns a DRF `Response` conforming to the success format.
4. THE API SHALL provide a utility function `error_response(message, errors, status_code)` in `common/utils.py` that constructs and returns a DRF `Response` conforming to the error format.
5. WHEN an unhandled exception occurs, THE API SHALL return a `500` error response in the Standard_Response format with `"message": "An unexpected error occurred."`.
6. WHEN a `ValidationError` is raised, THE API SHALL return a `400` error response in the Standard_Response format mapping field names to their error lists.
7. WHEN an `AuthenticationFailed` or `NotAuthenticated` error is raised, THE API SHALL return a `401` error response in the Standard_Response format.
8. WHEN a `PermissionDenied` error is raised, THE API SHALL return a `403` error response in the Standard_Response format.
9. WHEN a `NotFound` error is raised, THE API SHALL return a `404` error response in the Standard_Response format.
10. WHEN a database `IntegrityError` is raised, THE API SHALL return a `409` error response in the Standard_Response format with message `"A record with this data already exists."`.

---

### Requirement 3: Custom User Model and Authentication

**User Story:** As a system admin, I want a custom user model with roles and brand assignment, so that access control can be enforced based on role and brand throughout the system.

#### Acceptance Criteria

1. THE API SHALL define a custom user model in `accounts/models.py` extending `AbstractBaseUser` with fields: `full_name`, `username` (unique), `email` (unique), `mobile`, `role` (choices: `admin`, `back_office`, `rm`), `brand` (FK to Brand, nullable, only applicable for RM role), `is_active` (boolean, default `True`), `created_at`, and `updated_at`.
2. THE API SHALL set `AUTH_USER_MODEL` to `accounts.User` in settings.
3. WHEN a user is created with role `rm`, THE User_Model SHALL require a non-null `brand` foreign key.
4. WHEN a user is created with role `admin` or `back_office`, THE User_Model SHALL store `brand` as null.
5. THE API SHALL store passwords as hashed values using Django's password hashing framework; plaintext passwords SHALL NOT be stored.
6. THE API SHALL provide `POST /api/auth/login/` which accepts `username` and `password`; WHEN credentials are valid and the account is active, THE Auth_Service SHALL generate and return `access` and `refresh` JWT tokens in the Standard_Response `data` field with HTTP `200`.
7. WHEN invalid credentials are supplied to `POST /api/auth/login/`, THE Auth_Service SHALL return a `401` error response with message `"Invalid username or password."` and SHALL NOT generate any JWT tokens.
8. WHEN a deactivated user attempts login via `POST /api/auth/login/`, THE Auth_Service SHALL return a `401` error response with message `"Your account has been deactivated."` and SHALL NOT generate any JWT tokens.
9. THE API SHALL provide `POST /api/auth/refresh/` which accepts a valid `refresh` token and returns a new `access` token.
10. THE API SHALL provide `POST /api/auth/logout/` which accepts a `refresh` token and blacklists it, preventing future use.
11. WHEN a blacklisted refresh token is submitted to `POST /api/auth/refresh/`, THE Auth_Service SHALL return a `401` error response.
12. THE API SHALL provide `POST /api/auth/change-password/` for authenticated users, accepting `old_password`, `new_password`, and `confirm_new_password`, and updating the password on successful validation.
13. WHEN `new_password` and `confirm_new_password` do not match in `POST /api/auth/change-password/`, THE Auth_Service SHALL return a `400` error response with field error `"Passwords do not match."`.
14. WHEN `old_password` is incorrect in `POST /api/auth/change-password/`, THE Auth_Service SHALL return a `400` error response with field error `"Old password is incorrect."`.
15. THE new password SHALL satisfy all configured Django `AUTH_PASSWORD_VALIDATORS`; IF validation fails, THEN THE Auth_Service SHALL return a `400` error response with the validator's error messages.

---

### Requirement 4: Custom Permission Classes

**User Story:** As a security architect, I want role-based DRF permission classes, so that each endpoint enforces the correct access level without duplicating logic in views.

#### Acceptance Criteria

1. THE API SHALL provide a `IsAdmin` DRF permission class in `accounts/permissions.py` that grants access only to authenticated users with role `admin`.
2. THE API SHALL provide a `IsBackOffice` DRF permission class that grants access only to authenticated users with role `back_office`.
3. THE API SHALL provide a `IsAdminOrBackOffice` DRF permission class that grants access to authenticated users with role `admin` or `back_office`.
4. THE API SHALL provide a `IsRM` DRF permission class that grants access only to authenticated users with role `rm`.
5. THE API SHALL provide a `IsAdminOrBackOfficeOrRM` DRF permission class that grants access to all authenticated users regardless of role.
6. WHEN a user without the required role attempts to access a permission-protected endpoint, THE Permission_Class SHALL return a `403` error response in the Standard_Response format.

---

### Requirement 5: Brand Management (Admin Only)

**User Story:** As an Admin, I want to create and manage brands, so that payment sources and RMs can be organised and isolated by brand.

#### Acceptance Criteria

1. THE API SHALL define a `Brand` model in `brands/models.py` with fields: `name` (unique, max 100 chars), `status` (boolean, default `True`), `created_at`, and `updated_at`.
2. THE API SHALL provide `GET /api/brands/` accessible only by Admin, returning a paginated list of all brands in Standard_Response format.
3. THE API SHALL provide `POST /api/brands/` accessible only by Admin, creating a new brand; THE Brand_Service SHALL verify the requesting user has role `admin` before processing, SHALL return the created record in Standard_Response format, and SHALL respond with HTTP `201` on success.
4. THE API SHALL provide `GET /api/brands/{id}/` accessible only by Admin, returning the detail of the specified brand.
5. THE API SHALL provide `PUT /api/brands/{id}/` and `PATCH /api/brands/{id}/` accessible only by Admin; WHEN a non-Admin user attempts to call these endpoints, THE Permission_Class SHALL block the operation and return a `403` error response; WHEN called by an Admin, THE Brand_Service SHALL update the specified brand and return the updated record in Standard_Response format.
6. THE API SHALL provide `DELETE /api/brands/{id}/` accessible only by Admin, soft-deleting or deactivating the specified brand.
7. WHEN a brand `name` that already exists is submitted to `POST /api/brands/`, THE Brand_Service SHALL return a `409` error response.
8. WHEN `GET /api/brands/` is called, THE Brand_Service SHALL support filtering by `status`, searching by `name`, and ordering by `name` or `created_at`.
9. WHEN a non-Admin user accesses any `/api/brands/` endpoint, THE Permission_Class SHALL return a `403` error response.
10. THE Brand model SHALL trigger an Audit_Log entry on create, update, and delete operations recording the acting user, action type, old data, new data, and request IP address.

---

### Requirement 6: User Management (Admin Only)

**User Story:** As an Admin, I want to create and manage system users with role assignments, so that Back Office users and RMs can access the system with the correct permissions.

#### Acceptance Criteria

1. THE API SHALL provide `GET /api/users/` accessible only by Admin, returning a paginated list of all users (excluding password fields) in Standard_Response format.
2. THE API SHALL provide `POST /api/users/` accessible only by Admin, creating a new user and returning the created record with HTTP `201`; the request body SHALL include `full_name`, `username`, `email`, `mobile`, `role`, `brand` (required when role is `rm`), and `password`.
3. THE API SHALL provide `GET /api/users/{id}/` accessible only by Admin, returning the user detail (excluding password).
4. THE API SHALL provide `PUT /api/users/{id}/` and `PATCH /api/users/{id}/` accessible only by Admin, updating the specified user's fields.
5. THE API SHALL provide `DELETE /api/users/{id}/` accessible only by Admin, deactivating (setting `is_active=False`) the specified user.
6. THE API SHALL provide `POST /api/users/{id}/reset-password/` accessible only by Admin, setting a new password for the specified user supplied in the request body as `new_password`.
7. WHEN `POST /api/users/` is submitted with role `rm` and no `brand`, THE User_Service SHALL return a `400` error response with field error `"Brand is required for RM role."`.
8. WHEN `POST /api/users/` is submitted with a `username` or `email` that already exists, THE User_Service SHALL return a `409` error response.
9. WHEN `GET /api/users/` is called, THE User_Service SHALL support filtering by `role`, `brand`, and `is_active`, plus searching by `full_name`, `username`, and `email`.
10. WHEN a non-Admin user accesses any `/api/users/` endpoint, THE Permission_Class SHALL return a `403` error response; unauthorized access attempts SHALL NOT be logged to the audit system.
11. THE User_Service SHALL trigger an Audit_Log entry on user create, update, deactivate, and password-reset operations.

---

### Requirement 7: QR Code Payment Source Management

**User Story:** As a Back Office user, I want to upload and manage QR Code payment sources per brand, so that RMs can retrieve the correct QR images for their assigned brand.

#### Acceptance Criteria

1. THE API SHALL define a `QRCode` model in `payments/models.py` with fields: `qr_name` (max 200 chars), `qr_image` (file path, stored under `media/qr_codes/`), `brand` (FK to Brand), `range_from` (decimal, max digits 12, decimal places 2), `range_to` (decimal, max digits 12, decimal places 2), `status` (boolean, default `True`), `created_by` (FK to User), `created_at`, and `updated_at`.
2. THE API SHALL provide `GET /api/payments/qr/` accessible by Admin and Back_Office returning all QR records, and by RM returning only active QR records for the RM's assigned brand; both return paginated results in Standard_Response format.
3. THE API SHALL provide `POST /api/payments/qr/` accessible only by Admin and Back_Office, accepting a multipart form request with `qr_name`, `qr_image`, `brand`, `range_from`, `range_to`, and optional `status`; THE QR_Service SHALL verify that the authenticated user has role `admin` or `back_office` before processing the request and SHALL return HTTP `201` with the created record on success.
4. THE API SHALL provide `GET /api/payments/qr/{id}/`, `PUT /api/payments/qr/{id}/`, `PATCH /api/payments/qr/{id}/`, and `DELETE /api/payments/qr/{id}/` accessible only by Admin and Back_Office.
5. WHEN a QR image file is uploaded, THE QR_Service SHALL validate that the file extension is one of `jpg`, `jpeg`, `png`, `gif`, or `webp`; IF the extension is invalid, THEN THE QR_Service SHALL return a `400` error response with field error `"Unsupported file type. Allowed: jpg, jpeg, png, gif, webp."`.
6. WHEN a QR image file is uploaded, THE QR_Service SHALL validate that the file size does not exceed 5 MB; IF the size is exceeded, THEN THE QR_Service SHALL return a `400` error response with field error `"File size must not exceed 5 MB."`.
7. THE QR_Service SHALL store uploaded images with a unique filename (using UUID prefix) to prevent collisions.
8. WHEN `range_from` is greater than or equal to `range_to` in a QR create or update request, THE QR_Service SHALL return a `400` error response with field error `"range_from must be less than range_to."`.
9. WHEN `GET /api/payments/qr/` is called by an Admin or Back_Office user, THE QR_Service SHALL support filtering by `brand`, `status`, `range_from`, `range_to`, searching by `qr_name`, and ordering by `created_at` and `qr_name`.
10. WHEN `GET /api/payments/qr/` is called by an RM, THE QR_Service SHALL automatically filter results to `status=active` and `brand=<RM's assigned brand>` regardless of query parameters.
11. THE QR_Service SHALL trigger an Audit_Log entry on create, update, delete, activate, and deactivate operations for QR records.
12. WHEN a QR record is deleted via `DELETE /api/payments/qr/{id}/`, THE QR_Service SHALL delete the associated image file from storage and remove the database record.

---

### Requirement 8: UPI Payment Source Management

**User Story:** As a Back Office user, I want to manage UPI ID payment sources per brand, so that RMs can retrieve valid UPI payment details for their brand.

#### Acceptance Criteria

1. THE API SHALL define a `UPI` model in `payments/models.py` with fields: `upi_id` (unique, max 100 chars), `brand` (FK to Brand), `range_from` (decimal, max digits 12, decimal places 2), `range_to` (decimal, max digits 12, decimal places 2), `status` (boolean, default `True`), `created_by` (FK to User), `created_at`, and `updated_at`.
2. THE API SHALL provide `GET /api/payments/upi/` accessible by Admin and Back_Office returning all UPI records, and by RM returning only active UPI records for the RM's assigned brand; both return paginated results in Standard_Response format.
3. THE API SHALL provide `POST /api/payments/upi/` accessible only by Admin and Back_Office, accepting `upi_id`, `brand`, `range_from`, `range_to`, and optional `status`; returning the created record with HTTP `201`.
4. THE API SHALL provide `GET /api/payments/upi/{id}/`, `PUT /api/payments/upi/{id}/`, `PATCH /api/payments/upi/{id}/`, and `DELETE /api/payments/upi/{id}/` accessible only by Admin and Back_Office.
5. WHEN a `upi_id` value is submitted, THE UPI_Service SHALL validate that it matches the pattern `[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}`; IF validation fails, THEN THE UPI_Service SHALL return a `400` error response with field error `"Invalid UPI ID format."`.
6. WHEN a duplicate `upi_id` is submitted to `POST /api/payments/upi/`, THE UPI_Service SHALL return a `409` error response.
7. WHEN `range_from` is greater than or equal to `range_to` in a UPI create or update request, THE UPI_Service SHALL return a `400` error response with field error `"range_from must be less than range_to."`.
8. WHEN `GET /api/payments/upi/` is called by an Admin or Back_Office user, THE UPI_Service SHALL support filtering by `brand`, `status`, `range_from`, `range_to`, searching by `upi_id`, and ordering by `created_at` and `upi_id`.
9. WHEN `GET /api/payments/upi/` is called by an RM, THE UPI_Service SHALL automatically filter results to `status=active` and `brand=<RM's assigned brand>` regardless of query parameters.
10. THE UPI_Service SHALL trigger an Audit_Log entry on create, update, delete, activate, and deactivate operations for UPI records.

---

### Requirement 9: Bank Detail Payment Source Management

**User Story:** As a Back Office user, I want to manage Bank Account detail records per brand, so that RMs can retrieve the correct banking information for deposit instructions.

#### Acceptance Criteria

1. THE API SHALL define a `BankDetail` model in `payments/models.py` with fields: `bank_name` (max 200 chars), `account_holder_name` (max 200 chars), `account_number` (stored encrypted in the database), `ifsc_code` (max 11 chars), `branch_name` (max 200 chars), `brand` (FK to Brand), `range_from` (decimal, max digits 12, decimal places 2), `range_to` (decimal, max digits 12, decimal places 2), `status` (boolean, default `True`), `created_by` (FK to User), `created_at`, and `updated_at`.
2. THE API SHALL provide `GET /api/payments/bank/` accessible by Admin and Back_Office returning all bank detail records without enforced status or brand filters, and by RM returning only active bank detail records for the RM's assigned brand; both return paginated results in Standard_Response format.
3. THE API SHALL provide `POST /api/payments/bank/` accessible only by Admin and Back_Office, accepting `bank_name`, `account_holder_name`, `account_number`, `ifsc_code`, `branch_name`, `brand`, `range_from`, `range_to`, and optional `status`; returning the created record with HTTP `201`.
4. THE API SHALL provide `GET /api/payments/bank/{id}/`, `PUT /api/payments/bank/{id}/`, `PATCH /api/payments/bank/{id}/`, and `DELETE /api/payments/bank/{id}/` accessible only by Admin and Back_Office.
5. WHEN an `ifsc_code` value is submitted, THE Bank_Service SHALL validate it matches the regex `^[A-Z]{4}0[A-Z0-9]{6}$`; IF validation fails, THEN THE Bank_Service SHALL return a `400` error response with field error `"Invalid IFSC code format. Expected format: ABCD0123456."`.
6. WHEN a bank detail record is returned in an API response, THE Bank_Service SHALL mask the `account_number` to display only the last four digits preceded by asterisks (e.g., `********1234`); the full account number SHALL NOT be exposed in any response.
7. THE Bank_Service SHALL encrypt the `account_number` before storing it in the database using a symmetric encryption method configured via a secret key in settings.
8. WHEN `range_from` is greater than or equal to `range_to` in a bank create or update request, THE Bank_Service SHALL return a `400` error response with field error `"range_from must be less than range_to."`.
9. WHEN `GET /api/payments/bank/` is called by an Admin or Back_Office user, THE Bank_Service SHALL support filtering by `brand`, `status`, `range_from`, `range_to`, searching by `bank_name`, `account_holder_name`, and `ifsc_code`, and ordering by `created_at` and `bank_name`.
10. WHEN `GET /api/payments/bank/` is called by an RM, THE Bank_Service SHALL automatically filter results to `status=active` and `brand=<RM's assigned brand>` regardless of query parameters.
11. THE Bank_Service SHALL trigger an Audit_Log entry on create, update, delete, activate, and deactivate operations; the Audit_Log SHALL store the masked (not encrypted, not plaintext) account number in `old_data` and `new_data` JSON fields.

---

### Requirement 10: Payment Source Activation and Deactivation

**User Story:** As a Back Office user, I want to activate or deactivate any payment source, so that only currently valid sources are visible to RMs without permanently deleting the records.

#### Acceptance Criteria

1. THE API SHALL provide `POST /api/payments/qr/{id}/activate/` accessible by Admin and Back_Office, setting the QR record's `status` to `True` and returning the updated record in Standard_Response format.
2. THE API SHALL provide `POST /api/payments/qr/{id}/deactivate/` accessible only by Admin and Back_Office; WHEN a user without role `admin` or `back_office` attempts to call this endpoint, THE Permission_Class SHALL return a `403` error response; WHEN called by an authorised user, THE QR_Service SHALL set the QR record's `status` to `False` and return the updated record.
3. THE API SHALL provide `POST /api/payments/upi/{id}/activate/` and `POST /api/payments/upi/{id}/deactivate/` with the same behaviour for UPI records.
4. THE API SHALL provide `POST /api/payments/bank/{id}/activate/` and `POST /api/payments/bank/{id}/deactivate/` accessible only by Admin and Back_Office; WHEN a user without role `admin` or `back_office` attempts these endpoints, THE Permission_Class SHALL return a `403` error response.
5. WHEN an RM attempts to call any activate or deactivate endpoint, THE Permission_Class SHALL return a `403` error response.
6. WHEN `POST /api/brands/{id}/activate/` or `POST /api/brands/{id}/deactivate/` is called by an Admin, THE Brand_Service SHALL update the brand's `status` accordingly; WHEN both activate and deactivate are signalled in conflict, deactivate SHALL take precedence; WHEN a non-Admin user calls these endpoints, THE Permission_Class SHALL return a `403` error response.
7. WHEN `POST /api/users/{id}/activate/` or `POST /api/users/{id}/deactivate/` is called, THE Permission_Class SHALL verify the requesting user has role `admin` before processing; WHEN authorised, THE User_Service SHALL update the user's `is_active` field accordingly.
8. THE respective service SHALL trigger an Audit_Log entry for every activate and deactivate action.

---

### Requirement 11: Audit Logging

**User Story:** As an Admin or Back Office user, I want every data-modifying action recorded in an immutable audit log, so that accountability and compliance can be ensured.

#### Acceptance Criteria

1. THE API SHALL define an `AuditLog` model in `audit_logs/models.py` with fields: `user` (FK to User), `action` (choices: `created`, `updated`, `deleted`, `activated`, `deactivated`), `module` (choices: `brand`, `user`, `qr`, `upi`, `bank`), `object_id` (integer, representing the affected record's primary key), `old_data` (JSON field, nullable), `new_data` (JSON field, nullable), `ip_address` (max 45 chars, supports IPv4 and IPv6), and `timestamp` (auto-set on creation).
2. THE Audit_Service SHALL automatically create an `AuditLog` record whenever a Brand, User, QRCode, UPI, or BankDetail record is created, updated, deleted, activated, or deactivated via the API.
3. WHEN an Audit_Log record is created, THE Audit_Service SHALL populate `old_data` with the serialized JSON of the record's state before the action (null for create actions) and `new_data` with the serialized JSON after the action (null for delete actions).
4. THE Audit_Service SHALL capture the authenticated user performing the action in the `user` field.
5. THE Audit_Service SHALL capture the client's IP address from the request metadata in the `ip_address` field.
6. THE API SHALL provide `GET /api/audit-logs/` accessible by Admin and Back_Office, returning a paginated list of all audit log entries in Standard_Response format.
7. WHEN `GET /api/audit-logs/` is called, THE Audit_Service SHALL support filtering by `user`, `action`, `module`, and date range on `timestamp`, plus ordering by `timestamp`.
8. WHEN an RM attempts to access `GET /api/audit-logs/`, THE Permission_Class SHALL return a `403` error response.
9. THE AuditLog model SHALL have `editable=False` on all fields to ensure immutability; audit logs SHALL NOT be updateable or deleteable via the API.

---

### Requirement 12: Role-Based Brand Filtering for RMs

**User Story:** As an RM, I want to automatically see only the active payment sources for my assigned brand, so that I do not need to manually filter and I cannot access data from other brands.

#### Acceptance Criteria

1. WHEN an RM calls `GET /api/payments/qr/`, THE QR_Service SHALL apply a queryset filter restricting results to records where `brand` equals the RM's assigned brand and `status` is `True`.
2. WHEN an RM calls `GET /api/payments/upi/`, THE UPI_Service SHALL apply a queryset filter restricting results to records where `brand` equals the RM's assigned brand and `status` is `True`.
3. WHEN an RM calls `GET /api/payments/bank/`, THE Bank_Service SHALL apply a queryset filter restricting results to records where `brand` equals the RM's assigned brand and `status` is `True`.
4. WHEN an RM attempts to access a detail endpoint (e.g., `GET /api/payments/qr/{id}/`) for a record that does not match their assigned brand or is inactive, THE Payment_Service SHALL return a `404` error response; WHEN the record matches the RM's brand and is active, THE Payment_Service SHALL return the record detail in Standard_Response format.
5. WHEN an RM attempts to create, update, delete, activate, or deactivate a payment source, THE Permission_Class SHALL return a `403` error response.
6. THE brand filter SHALL be enforced at the service layer, not relying solely on URL query parameters or frontend logic.

---

### Requirement 13: OpenAPI Documentation with drf-spectacular

**User Story:** As a frontend developer or API consumer, I want auto-generated OpenAPI 3 documentation with all endpoints, schemas, and authentication details, so that I can integrate with the API without reading source code.

#### Acceptance Criteria

1. THE API SHALL use `@extend_schema` decorators from `drf_spectacular` on every function-based view, specifying `operation_id`, `summary`, `description`, `request` serializer, `responses`, `tags`, and `parameters` as appropriate.
2. THE API SHALL expose `GET /api/schema/` returning the full OpenAPI 3.0 JSON schema.
3. THE API SHALL expose `GET /api/docs/` serving the Swagger UI for interactive API exploration.
4. THE API SHALL expose `GET /api/redoc/` serving the ReDoc alternative documentation UI.
5. THE OpenAPI schema SHALL include the JWT authentication security scheme, marking all protected endpoints with the `BearerAuth` requirement.
6. THE API SHALL group endpoints by tags: `Authentication`, `Brands`, `Users`, `QR Codes`, `UPI`, `Bank Details`, and `Audit Logs`.
7. WHEN a request or response uses the Standard_Response envelope, THE schema SHALL define explicit `SuccessResponse` and `ErrorResponse` components so clients understand the structure.

---

### Requirement 14: Pagination, Filtering, Search, and Ordering

**User Story:** As an API consumer, I want consistent pagination, filtering, search, and ordering on all list endpoints, so that large datasets can be navigated efficiently.

#### Acceptance Criteria

1. THE API SHALL configure a default page size of 20 items and support a `page_size` query parameter (maximum 100) on all list endpoints via DRF's `PageNumberPagination`.
2. THE paginated list response `data` field SHALL include `count` (total records), `next` (URL or null), `previous` (URL or null), and `results` (array of records).
3. WHEN a `search` query parameter is provided on a list endpoint, THE respective Service SHALL perform a case-insensitive contains search across the fields defined per module.
4. WHEN an `ordering` query parameter is provided on a list endpoint, THE respective Service SHALL sort results by the specified field; a leading `-` SHALL indicate descending order.
5. WHEN filter parameters are provided on a list endpoint, THE respective Service SHALL apply them using `django-filter` filtersets.
6. WHEN an invalid filter value is provided, THE API SHALL return a `400` error response with a descriptive field error.

---

### Requirement 15: Architecture and Code Structure

**User Story:** As a developer maintaining this codebase, I want a clean layered architecture with thin views and business logic in services, so that the code is testable, readable, and maintainable.

#### Acceptance Criteria

1. THE API SHALL implement all views as function-based views using `@api_view` and `@permission_classes` decorators; class-based views and ViewSets SHALL NOT be used.
2. THE API SHALL place business logic (data retrieval, validation, persistence, audit log creation) in service modules (e.g., `brands/services.py`, `payments/services.py`) and keep view functions as thin orchestrators.
3. THE API SHALL define URL patterns in per-app `urls.py` files included from `config/urls.py` under the `/api/` prefix.
4. THE API SHALL define serializers in per-app `serializers.py` files, responsible for validation and data transformation only; serializers SHALL NOT contain business logic.
5. THE API SHALL define custom permission classes in `accounts/permissions.py`.
6. THE API SHALL define utility functions (`success_response`, `error_response`, `get_client_ip`) in `common/utils.py`.
7. THE API SHALL define a custom DRF exception handler in `common/exceptions.py` and reference it in `REST_FRAMEWORK["EXCEPTION_HANDLER"]` setting.
8. THE API SHALL use Django migrations for all model changes; no manual SQL modifications to the schema SHALL be required during normal deployment.
9. THE API SHALL configure `DEFAULT_AUTO_FIELD` to `BigAutoField` in settings.
10. WHEN the `created_by` field is set on payment source records, THE Payment_Service SHALL automatically populate it from the authenticated request user; it SHALL NOT be accepted as a user-supplied request field.
