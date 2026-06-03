import os
import uuid
import logging

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_CONTENT_TYPES = {
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
}
MAX_IMAGE_SIZE_MB = 5
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


def get_client_ip(request) -> str:
    """Extract the real client IP address from the request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


def generate_qr_upload_path(instance, filename: str) -> str:
    """Generate a unique, sanitised upload path for QR code images."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        ext = '.jpg'
    unique_name = f"{uuid.uuid4().hex}{ext}"
    return os.path.join('qr_codes', unique_name)


def validate_image_file(file) -> None:
    """
    Validate that the uploaded file is an allowed image type and within the
    size limit.  Raises django.core.exceptions.ValidationError on failure.
    """
    from django.core.exceptions import ValidationError

    content_type = getattr(file, 'content_type', '')
    if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise ValidationError(
            f"Unsupported file type '{content_type}'. "
            f"Allowed types: JPEG, PNG, WebP."
        )

    if file.size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError(
            f"File size {file.size / (1024 * 1024):.1f} MB exceeds "
            f"the maximum allowed size of {MAX_IMAGE_SIZE_MB} MB."
        )
