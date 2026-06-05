import os
import uuid
import logging

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_CONTENT_TYPES = {
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/x-bmp',
    'image/x-ms-bmp',
}
MAX_IMAGE_SIZE_MB = 10
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif'}


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
            f"Allowed types: JPEG, PNG, WebP, GIF, BMP, TIFF."
        )

    if file.size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError(
            f"File size {file.size / (1024 * 1024):.1f} MB exceeds "
            f"the maximum allowed size of {MAX_IMAGE_SIZE_MB} MB."
        )


def crop_qr_from_image(image_file):
    """
    Detect a QR code in the uploaded image, crop tightly to its bounding box
    (+ 15% padding), and return a new InMemoryUploadedFile containing only
    the QR.  Raises ValidationError if no QR code is detected.
    """
    import io
    from django.core.exceptions import ValidationError
    from django.core.files.uploadedfile import InMemoryUploadedFile
    from PIL import Image
    from pyzbar.pyzbar import decode

    image_file.seek(0)
    try:
        img = Image.open(image_file).convert('RGB')
    except Exception:
        raise ValidationError('Could not open the uploaded image.')

    decoded = decode(img)
    if not decoded:
        raise ValidationError(
            'No QR code detected in the uploaded image. '
            'Please upload an image that clearly contains a QR code.'
        )

    # Pick the largest QR code found
    qr  = max(decoded, key=lambda d: d.rect.width * d.rect.height)
    lft = qr.rect.left
    top = qr.rect.top
    rgt = qr.rect.left + qr.rect.width
    bot = qr.rect.top  + qr.rect.height

    # 15% padding on each side
    px = int(qr.rect.width  * 0.15)
    py = int(qr.rect.height * 0.15)
    img_w, img_h = img.size
    lft = max(0,     lft - px)
    top = max(0,     top - py)
    rgt = min(img_w, rgt + px)
    bot = min(img_h, bot + py)

    cropped = img.crop((lft, top, rgt, bot))

    buf = io.BytesIO()
    cropped.save(buf, format='PNG')
    buf.seek(0)

    return InMemoryUploadedFile(
        file=buf,
        field_name=getattr(image_file, 'field_name', 'qr_image'),
        name=f'qr_{uuid.uuid4().hex}.png',
        content_type='image/png',
        size=buf.getbuffer().nbytes,
        charset=None,
    )
