"""
Management command: recrop_qr_images
Re-processes every existing QRCode image through the same crop logic used
during upload, replacing the stored file with a tightly-cropped version
that contains only the QR code.

Usage:
    python manage.py recrop_qr_images
    python manage.py recrop_qr_images --id 3        # single record
    python manage.py recrop_qr_images --dry-run     # no writes
"""

import io
import uuid

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Re-crop existing QR code images to show only the QR matrix.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--id',
            type=int,
            dest='qr_id',
            default=None,
            help='Process only this QRCode pk.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Detect and log without saving.',
        )

    def handle(self, *args, **options):
        from PIL import Image
        from pyzbar.pyzbar import decode
        from payments.models import QRCode

        dry_run = options['dry_run']
        qr_id   = options['qr_id']

        qs = QRCode.objects.all()
        if qr_id:
            qs = qs.filter(pk=qr_id)
            if not qs.exists():
                raise CommandError(f'QRCode with pk={qr_id} not found.')

        total = qs.count()
        self.stdout.write(f'Processing {total} QR code(s)...')

        ok = skipped = failed = 0

        for qr in qs:
            if not qr.qr_image:
                self.stdout.write(self.style.WARNING(f'  [{qr.pk}] No image — skip'))
                skipped += 1
                continue

            try:
                qr.qr_image.seek(0)
                img = Image.open(qr.qr_image).convert('RGB')
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f'  [{qr.pk}] Cannot open image: {exc}'))
                failed += 1
                continue

            decoded = decode(img)
            if not decoded:
                self.stdout.write(self.style.WARNING(
                    f'  [{qr.pk}] {qr.qr_name!r}: no QR detected in stored image — skip'
                ))
                skipped += 1
                continue

            # Crop to the largest detected QR + 15 % padding
            d = max(decoded, key=lambda x: x.rect.width * x.rect.height)
            lft = d.rect.left
            top = d.rect.top
            rgt = d.rect.left + d.rect.width
            bot = d.rect.top  + d.rect.height

            img_w, img_h = img.size
            px = int(d.rect.width  * 0.15)
            py = int(d.rect.height * 0.15)
            lft = max(0,     lft - px)
            top = max(0,     top - py)
            rgt = min(img_w, rgt + px)
            bot = min(img_h, bot + py)

            cropped = img.crop((lft, top, rgt, bot))

            if dry_run:
                self.stdout.write(
                    f'  [{qr.pk}] {qr.qr_name!r}: would crop '
                    f'{img_w}x{img_h} → {rgt-lft}x{bot-top}'
                )
                ok += 1
                continue

            buf = io.BytesIO()
            cropped.save(buf, format='PNG')
            new_name = f'qr_{uuid.uuid4().hex}.png'
            qr.qr_image.save(new_name, ContentFile(buf.getvalue()), save=True)

            self.stdout.write(self.style.SUCCESS(
                f'  [{qr.pk}] {qr.qr_name!r}: cropped {img_w}x{img_h} → {rgt-lft}x{bot-top}'
            ))
            ok += 1

        self.stdout.write('')
        self.stdout.write(f'Done — ok={ok}  skipped={skipped}  failed={failed}')
        if dry_run:
            self.stdout.write(self.style.WARNING('Dry-run: no files were saved.'))
