"""
Common reusable validators for DWMS.

All validators raise `rest_framework.serializers.ValidationError` so they can be
used directly inside DRF serializer `validate_*` / `validate()` methods.

Each validator returns the cleaned / normalised value on success — apply on the
write path with `value = validate_xxx(value)`.

Naming convention:
    validate_<thing>(value, *, allow_blank=False) -> str | Decimal | ...

Indian-fintech focused; safe defaults; conservative regexes (rejects clearly
invalid inputs, not "creative-but-plausible" ones).
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Optional

from rest_framework import serializers


# ──────────────────────────────────────────────────────────────────────────────
# Regex constants (compiled once)
# ──────────────────────────────────────────────────────────────────────────────

_RE_USERNAME      = re.compile(r'^[A-Za-z][A-Za-z0-9._-]{2,49}$')
_RE_PASSWORD_LOW  = re.compile(r'[a-z]')
_RE_PASSWORD_UP   = re.compile(r'[A-Z]')
_RE_PASSWORD_DIG  = re.compile(r'\d')
_RE_PASSWORD_SYM  = re.compile(r'[^A-Za-z0-9]')

_RE_INDIAN_MOBILE = re.compile(r'^[6-9]\d{9}$')             # 10-digit, starts 6-9
_RE_PAN           = re.compile(r'^[A-Z]{5}\d{4}[A-Z]$')
_RE_IFSC          = re.compile(r'^[A-Z]{4}0[A-Z0-9]{6}$')   # 11 chars, 5th is 0
_RE_GSTIN         = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z\d]$')
_RE_UPI_VPA       = re.compile(r'^[a-zA-Z0-9._-]{2,50}@[a-zA-Z][a-zA-Z0-9.-]{1,40}$')
_RE_ACCOUNT_NO    = re.compile(r'^\d{9,18}$')
_RE_SAFE_NAME     = re.compile(r"^[A-Za-z0-9 .,'&()\-_/]+$")
_RE_BRAND_NAME    = re.compile(r'^[A-Z0-9 _-]{2,50}$')
_RE_ROLE_NAME     = re.compile(r'^[A-Za-z][A-Za-z0-9 _-]{1,49}$')
_RE_CLIENT_ARC    = re.compile(r'^[A-Za-z0-9_-]{3,50}$')


# ──────────────────────────────────────────────────────────────────────────────
# Generic helpers
# ──────────────────────────────────────────────────────────────────────────────

def _clean(value, *, allow_blank: bool = False, field: str = 'value') -> str:
    if value is None:
        if allow_blank:
            return ''
        raise serializers.ValidationError(f'{field} is required.')
    s = str(value).strip()
    if not s and not allow_blank:
        raise serializers.ValidationError(f'{field} cannot be blank.')
    return s


# ──────────────────────────────────────────────────────────────────────────────
# Identity / contact validators
# ──────────────────────────────────────────────────────────────────────────────

def validate_username(value: str) -> str:
    """3–50 chars, letters/digits/._- only, must start with a letter."""
    s = _clean(value, field='Username')
    if not _RE_USERNAME.match(s):
        raise serializers.ValidationError(
            'Username must be 3–50 characters, start with a letter, and contain only letters, digits, dot, underscore or hyphen.'
        )
    return s


def validate_indian_mobile(value: Optional[str], *, allow_blank: bool = True) -> str:
    """10-digit Indian mobile starting with 6-9. Accepts +91 / 91 / 0 prefixes; returns the 10-digit form."""
    if value in (None, ''):
        if allow_blank:
            return ''
        raise serializers.ValidationError('Mobile number is required.')
    digits = re.sub(r'\D', '', str(value))
    # strip leading country code / trunk prefix
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith('0'):
        digits = digits[1:]
    if not _RE_INDIAN_MOBILE.match(digits):
        raise serializers.ValidationError(
            'Enter a valid 10-digit Indian mobile number (starting with 6-9).'
        )
    return digits


def validate_password_strength(value: str, *, min_length: int = 8) -> str:
    """Strong password: ≥ min_length, has upper, lower, digit, and symbol."""
    if value is None or len(value) < min_length:
        raise serializers.ValidationError(
            f'Password must be at least {min_length} characters long.'
        )
    checks = [
        (_RE_PASSWORD_LOW, 'at least one lowercase letter'),
        (_RE_PASSWORD_UP,  'at least one uppercase letter'),
        (_RE_PASSWORD_DIG, 'at least one digit'),
        (_RE_PASSWORD_SYM, 'at least one symbol'),
    ]
    missing = [label for rx, label in checks if not rx.search(value)]
    if missing:
        raise serializers.ValidationError(
            'Password must include ' + ', '.join(missing) + '.'
        )
    if ' ' in value:
        raise serializers.ValidationError('Password must not contain spaces.')
    return value


# ──────────────────────────────────────────────────────────────────────────────
# Government / banking identifiers (India)
# ──────────────────────────────────────────────────────────────────────────────

def validate_pan(value: str) -> str:
    """PAN: 5 letters + 4 digits + 1 letter (uppercase). Returns upper-cased."""
    s = _clean(value, field='PAN').upper()
    if not _RE_PAN.match(s):
        raise serializers.ValidationError('Enter a valid PAN (e.g. ABCDE1234F).')
    return s


def validate_ifsc(value: str) -> str:
    """IFSC: 11 chars — 4 letters + 0 + 6 alphanumeric. Returns upper-cased."""
    s = _clean(value, field='IFSC code').upper().replace(' ', '')
    if not _RE_IFSC.match(s):
        raise serializers.ValidationError(
            'Enter a valid 11-character IFSC code (e.g. HDFC0001234).'
        )
    return s


def validate_gstin(value: str) -> str:
    s = _clean(value, field='GSTIN').upper().replace(' ', '')
    if not _RE_GSTIN.match(s):
        raise serializers.ValidationError('Enter a valid 15-character GSTIN.')
    return s


def validate_upi_vpa(value: str) -> str:
    """UPI VPA / handle, e.g. name@bank."""
    s = _clean(value, field='UPI ID').lower().replace(' ', '')
    if not _RE_UPI_VPA.match(s):
        raise serializers.ValidationError(
            'Enter a valid UPI ID (e.g. name@bank).'
        )
    return s


def validate_account_number(value: str) -> str:
    """Bank account number — digits only, 9–18 characters."""
    s = re.sub(r'\D', '', _clean(value, field='Account number'))
    if not _RE_ACCOUNT_NO.match(s):
        raise serializers.ValidationError(
            'Enter a valid bank account number (9 to 18 digits).'
        )
    return s


# ──────────────────────────────────────────────────────────────────────────────
# Domain name validators (brands / roles / clients)
# ──────────────────────────────────────────────────────────────────────────────

def validate_brand_name(value: str) -> str:
    """Brand code/name: uppercase letters/digits/space/_/-, 2–50 chars."""
    s = _clean(value, field='Brand name').upper().strip()
    if not _RE_BRAND_NAME.match(s):
        raise serializers.ValidationError(
            'Brand name must be 2–50 uppercase characters (letters, digits, space, underscore or hyphen).'
        )
    return s


def validate_role_name(value: str) -> str:
    s = _clean(value, field='Role name').strip()
    if not _RE_ROLE_NAME.match(s):
        raise serializers.ValidationError(
            'Role name must be 2–50 characters, start with a letter, and contain only letters, digits, space, underscore or hyphen.'
        )
    return s


def validate_safe_name(value: str, *, field: str = 'Name', max_length: int = 150) -> str:
    """Generic safe name — letters/digits and a few common punctuation."""
    s = _clean(value, field=field)
    if len(s) > max_length:
        raise serializers.ValidationError(f'{field} must be at most {max_length} characters.')
    if not _RE_SAFE_NAME.match(s):
        raise serializers.ValidationError(
            f'{field} contains invalid characters.'
        )
    return s


def validate_client_arc_id(value: str) -> str:
    s = _clean(value, field='Client ARC ID')
    if not _RE_CLIENT_ARC.match(s):
        raise serializers.ValidationError(
            'Client ARC ID must be 3–50 chars: letters, digits, underscore or hyphen.'
        )
    return s


# ──────────────────────────────────────────────────────────────────────────────
# Numeric / amount validators
# ──────────────────────────────────────────────────────────────────────────────

def validate_positive_amount(value, *, field: str = 'Amount', max_value: Optional[Decimal] = Decimal('10000000.00')) -> Decimal:
    """Positive decimal amount, ≤ max_value (default 1 crore)."""
    if value is None:
        raise serializers.ValidationError(f'{field} is required.')
    try:
        amt = Decimal(str(value))
    except Exception:
        raise serializers.ValidationError(f'{field} must be a valid number.')
    if amt <= 0:
        raise serializers.ValidationError(f'{field} must be greater than zero.')
    if max_value is not None and amt > max_value:
        raise serializers.ValidationError(f'{field} cannot exceed {max_value:,.2f}.')
    if amt.as_tuple().exponent < -2:
        raise serializers.ValidationError(f'{field} can have at most 2 decimal places.')
    return amt


def validate_range(range_from, range_to, *, field_to: str = 'range_to') -> None:
    """Ensure range_from < range_to (both Decimal-ish)."""
    if range_from is None or range_to is None:
        return
    try:
        a, b = Decimal(str(range_from)), Decimal(str(range_to))
    except Exception:
        raise serializers.ValidationError({field_to: 'Range values must be valid numbers.'})
    if a < 0 or b < 0:
        raise serializers.ValidationError({field_to: 'Range values cannot be negative.'})
    if a >= b:
        raise serializers.ValidationError({field_to: f'{field_to} must be greater than range_from.'})


# ──────────────────────────────────────────────────────────────────────────────
# Text / message validators
# ──────────────────────────────────────────────────────────────────────────────

def validate_text(value, *, field: str = 'Text', max_length: int = 1000, allow_blank: bool = True, min_length: int = 0) -> str:
    """Trim, length-check generic free-text input."""
    s = _clean(value, allow_blank=allow_blank, field=field)
    if allow_blank and not s:
        return s
    if len(s) < min_length:
        raise serializers.ValidationError(f'{field} must be at least {min_length} characters.')
    if len(s) > max_length:
        raise serializers.ValidationError(f'{field} must be at most {max_length} characters.')
    return s
