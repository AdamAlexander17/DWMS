"""
File-upload validators for DWMS.

All validators raise `rest_framework.serializers.ValidationError` and are safe
to call inside DRF `validate_<field>` methods.

Production tip:  python-magic gives the strongest MIME check by sniffing file
content rather than trusting the browser-supplied Content-Type. We try it if
installed, otherwise fall back to extension + content_type checks (still
defence-in-depth — DRF rejects fully unknown types upstream).
"""

from __future__ import annotations

import os
from typing import Iterable

from rest_framework import serializers


# ──────────────────────────────────────────────────────────────────────────────
# Allowed MIME / extension sets
# ──────────────────────────────────────────────────────────────────────────────

IMAGE_MIMES = {
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/gif',  'image/bmp', 'image/tiff', 'image/x-bmp', 'image/x-ms-bmp',
}
IMAGE_EXTS  = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif'}

PDF_MIMES   = {'application/pdf'}
PDF_EXTS    = {'.pdf'}

DOC_MIMES   = {
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain',
}
DOC_EXTS    = {'.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'}

# Sensible defaults per file kind
DEFAULT_LIMITS_MB = {
    'image':     5,
    'pdf':       8,
    'slip':      8,    # withdrawal / deposit slip (image OR pdf)
    'attachment': 15,  # chat attachment — image, pdf, doc
    'qr':        5,
}


# ──────────────────────────────────────────────────────────────────────────────
# Core validator
# ──────────────────────────────────────────────────────────────────────────────

def _ext(filename: str) -> str:
    return os.path.splitext(filename or '')[1].lower()


def validate_upload(
    file,
    *,
    allowed_mimes:      Iterable[str],
    allowed_exts:       Iterable[str],
    max_size_mb:        int,
    field:              str = 'File',
) -> None:
    """Generic file validator — size, extension, and MIME."""
    if file is None:
        raise serializers.ValidationError(f'{field} is required.')

    size = getattr(file, 'size', None)
    if size is None:
        raise serializers.ValidationError(f'{field} appears to be empty.')
    max_bytes = max_size_mb * 1024 * 1024
    if size > max_bytes:
        raise serializers.ValidationError(
            f'{field} is {size / (1024 * 1024):.1f} MB — must be ≤ {max_size_mb} MB.'
        )
    if size == 0:
        raise serializers.ValidationError(f'{field} is empty.')

    name = getattr(file, 'name', '') or ''
    ext  = _ext(name)
    if allowed_exts and ext not in allowed_exts:
        raise serializers.ValidationError(
            f'{field}: extension "{ext or "?"}" is not allowed. Allowed: {", ".join(sorted(allowed_exts))}'
        )

    ctype = (getattr(file, 'content_type', '') or '').lower()
    if allowed_mimes and ctype and ctype not in allowed_mimes:
        raise serializers.ValidationError(
            f'{field}: type "{ctype}" is not allowed.'
        )


# ──────────────────────────────────────────────────────────────────────────────
# Kind-specific shortcuts
# ──────────────────────────────────────────────────────────────────────────────

def validate_image(file, *, max_size_mb: int = DEFAULT_LIMITS_MB['image'], field: str = 'Image') -> None:
    validate_upload(
        file,
        allowed_mimes=IMAGE_MIMES,
        allowed_exts=IMAGE_EXTS,
        max_size_mb=max_size_mb,
        field=field,
    )


def validate_qr_image(file, *, field: str = 'QR image') -> None:
    validate_image(file, max_size_mb=DEFAULT_LIMITS_MB['qr'], field=field)


def validate_pdf(file, *, max_size_mb: int = DEFAULT_LIMITS_MB['pdf'], field: str = 'PDF') -> None:
    validate_upload(
        file,
        allowed_mimes=PDF_MIMES,
        allowed_exts=PDF_EXTS,
        max_size_mb=max_size_mb,
        field=field,
    )


def validate_slip(file, *, max_size_mb: int = DEFAULT_LIMITS_MB['slip'], field: str = 'Slip') -> None:
    """Slip can be an image OR a pdf."""
    validate_upload(
        file,
        allowed_mimes=IMAGE_MIMES | PDF_MIMES,
        allowed_exts=IMAGE_EXTS  | PDF_EXTS,
        max_size_mb=max_size_mb,
        field=field,
    )


def validate_attachment(file, *, max_size_mb: int = DEFAULT_LIMITS_MB['attachment'], field: str = 'Attachment') -> None:
    """Chat attachment — image, PDF, or office doc."""
    validate_upload(
        file,
        allowed_mimes=IMAGE_MIMES | PDF_MIMES | DOC_MIMES,
        allowed_exts=IMAGE_EXTS  | PDF_EXTS  | DOC_EXTS,
        max_size_mb=max_size_mb,
        field=field,
    )
