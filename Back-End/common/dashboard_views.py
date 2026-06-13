"""
Aggregated dashboard endpoint.

Returns 5 KPI numbers + every chart series in a single payload so the
frontend can paint the whole dashboard from one request.

Query params:
    period   = week | month | year   (default: month)

Response shape:
{
  "success": true,
  "message": "...",
  "data": {
    "period": "month",
    "range": { "start": "...", "end": "..." },
    "kpis": {
        "deposits_count":    int,
        "withdrawals_count": int,
        "withdrawals_amount": float,
        "pending_tickets":   int,
        "closed_tickets":    int,
        "active_channels":   int,
        "deposits_delta_pct":    float,
        "withdrawals_delta_pct": float,
    },
    "deposit_status":    [{ "status": "...", "label": "...", "count": int }],
    "withdrawal_status": [{ "status": "...", "label": "...", "count": int, "amount": float }],
    "brand_deposits":    [{ "brand": "...", "count": int }],          # top 8
    "brand_withdrawals": [{ "brand": "...", "amount": float, "count": int }], # top 8
    "channel_mix":       [{ "channel": "qr|upi|bank", "label": "...", "count": int }],
    "ticket_split":      [{ "type": "pending|closed", "count": int }],
    "trend":             [{ "label": "...", "deposits": int,
                            "withdrawals_count": int,
                            "withdrawals_amount": float }],
    "gateway_volume":    [{ "gateway": "...", "deposits": int,
                            "withdrawals_count": int,
                            "withdrawals_amount": float }]
  },
  "errors": null
}
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncDay, TruncMonth
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from common.permissions import has_any_module_permission, has_module_permission, is_admin_user, resolve_module_scope

from brands.models import Brand
from deposits.models import DepositLog
from master.models import Gateway
from payments.models import BankAccount, QRCode, UPISource
from withdrawals.models import Withdrawal

from .responses import success_response


DEPOSIT_STATUS_LABEL = {
    'pending':     'Pending',
    'for_review':  'For Review',
    'in_progress': 'In Progress',
    'completed':   'Completed',
    'approved':    'Approved',
    'rejected':    'Rejected',
}

WITHDRAWAL_STATUS_LABEL = {
    'pending':                'Pending',
    'slip_uploaded':          'Slip Uploaded',
    'bank_followup_required': 'Follow-Up Required',
    'email_sent_to_bank':     'Email Sent',
    'closed':                 'Closed',
    'approved':               'Approved',
    'rejected':               'Rejected',
}

CHANNEL_LABEL = {'qr': 'QR Code', 'upi': 'UPI', 'bank': 'Bank Account'}

PENDING_DEPOSIT_STATUSES   = ['pending', 'for_review', 'in_progress']
CLOSED_DEPOSIT_STATUSES    = ['completed', 'approved']
PENDING_WITHDRAWAL_STATUSES = ['pending', 'slip_uploaded', 'bank_followup_required', 'email_sent_to_bank']
CLOSED_WITHDRAWAL_STATUSES  = ['closed', 'approved']


def _period_window(period: str):
    """Return (start, end, prev_start, prev_end, bucket, label_fmt) tuples for the requested period."""
    now = timezone.now()
    if period == 'week':
        start = now - timedelta(days=6)        # last 7 days incl. today
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
        prev_start = start - timedelta(days=7)
        prev_end   = start
        bucket    = 'day'
        label_fmt = '%a %d'                    # "Mon 09"
    elif period == 'year':
        start = (now - timedelta(days=365)).replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
        prev_start = start - timedelta(days=365)
        prev_end   = start
        bucket    = 'month'
        label_fmt = '%b %Y'                    # "Jun 2025"
    else:  # month (default) = last 30 days
        start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
        prev_start = start - timedelta(days=30)
        prev_end   = start
        bucket    = 'day'
        label_fmt = '%d %b'                    # "09 Jun"
    return start, end, prev_start, prev_end, bucket, label_fmt


def _percent_delta(current: float, previous: float) -> float:
    if not previous:
        return 100.0 if current else 0.0
    return round(((current - previous) / previous) * 100.0, 1)


def _deposit_brand_label(deposit: DepositLog) -> str | None:
    """Resolve the brand for a deposit via whichever channel FK is set."""
    if deposit.qr_code_id and deposit.qr_code and deposit.qr_code.brand:
        return deposit.qr_code.brand.name
    if deposit.upi_source_id and deposit.upi_source and deposit.upi_source.brand:
        return deposit.upi_source.brand.name
    if deposit.bank_account_id and deposit.bank_account and deposit.bank_account.brand:
        return deposit.bank_account.brand.name
    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    period = (request.query_params.get('period') or 'month').lower()
    if period not in ('week', 'month', 'year'):
        period = 'month'

    start, end, prev_start, prev_end, bucket, label_fmt = _period_window(period)

    # ── Resolve caller's role ─────────────────────────────────────────────
    user       = request.user
    dep_scope  = resolve_module_scope(user, 'deposits')
    wd_scope   = resolve_module_scope(user, 'withdrawals')

    # ── Base querysets, scoped to the period ──────────────────────────────
    dep_qs = DepositLog.objects.filter(created_at__gte=start, created_at__lte=end)
    wd_qs  = Withdrawal.objects.filter(created_at__gte=start, created_at__lte=end)

    dep_prev_qs = DepositLog.objects.filter(created_at__gte=prev_start, created_at__lt=prev_end)
    wd_prev_qs  = Withdrawal.objects.filter(created_at__gte=prev_start, created_at__lt=prev_end)

    # ── Scope to own submissions for RM users ─────────────────────────────
    if dep_scope == 'own':
        dep_qs      = dep_qs.filter(submitted_by=user)
        dep_prev_qs = dep_prev_qs.filter(submitted_by=user)
    elif dep_scope == 'brand':
        brand_scope = user.brands.all()
        dep_qs = dep_qs.filter(
            Q(submitted_by__brands__in=brand_scope)
        ).distinct()
        dep_prev_qs = dep_prev_qs.filter(
            Q(submitted_by__brands__in=brand_scope)
        ).distinct()

    if wd_scope == 'own':
        wd_qs       = wd_qs.filter(submitted_by=user)
        wd_prev_qs  = wd_prev_qs.filter(submitted_by=user)
    elif wd_scope == 'brand':
        brand_scope = user.brands.all()
        wd_qs = wd_qs.filter(brand__in=brand_scope)
        wd_prev_qs = wd_prev_qs.filter(brand__in=brand_scope)

    # ── KPI numbers ───────────────────────────────────────────────────────
    deposits_count    = dep_qs.count()
    withdrawals_agg   = wd_qs.aggregate(c=Count('id'), s=Sum('amount'))
    withdrawals_count = withdrawals_agg['c'] or 0
    withdrawals_amount = float(withdrawals_agg['s'] or Decimal('0'))

    pending_tickets = (
        dep_qs.filter(status__in=PENDING_DEPOSIT_STATUSES).count()
        + wd_qs.filter(status__in=PENDING_WITHDRAWAL_STATUSES).count()
    )
    closed_tickets = (
        dep_qs.filter(status__in=CLOSED_DEPOSIT_STATUSES).count()
        + wd_qs.filter(status__in=CLOSED_WITHDRAWAL_STATUSES).count()
    )

    # ── Active channels count (scoped by brand) ─────────────────────────────
    if is_admin_user(user):
        active_channels = (
            QRCode.objects.filter(is_active=True).count()
            + UPISource.objects.filter(is_active=True).count()
            + BankAccount.objects.filter(is_active=True).count()
        )
    elif user.brands.exists():
        brand_scope = user.brands.all()
        active_channels = (
            QRCode.objects.filter(is_active=True, brand__in=brand_scope).count()
            + UPISource.objects.filter(is_active=True, brand__in=brand_scope).count()
            + BankAccount.objects.filter(is_active=True, brand__in=brand_scope).count()
        )
    else:
        active_channels = 0

    dep_delta = _percent_delta(deposits_count, dep_prev_qs.count())
    wd_delta  = _percent_delta(
        float(wd_qs.aggregate(s=Sum('amount'))['s'] or 0),
        float(wd_prev_qs.aggregate(s=Sum('amount'))['s'] or 0),
    )

    kpis = {
        'deposits_count':         deposits_count,
        'withdrawals_count':      withdrawals_count,
        'withdrawals_amount':     withdrawals_amount,
        'pending_tickets':        pending_tickets,
        'closed_tickets':         closed_tickets,
        'active_channels':        active_channels,
        'deposits_delta_pct':     dep_delta,
        'withdrawals_delta_pct':  wd_delta,
    }

    # ── Deposit status donut ──────────────────────────────────────────────
    dep_status_rows = dep_qs.values('status').annotate(count=Count('id'))
    deposit_status = [
        {
            'status': r['status'],
            'label':  DEPOSIT_STATUS_LABEL.get(r['status'], r['status']),
            'count':  r['count'],
        }
        for r in dep_status_rows
    ]

    # ── Withdrawal status donut ───────────────────────────────────────────
    wd_status_rows = wd_qs.values('status').annotate(count=Count('id'), amount=Sum('amount'))
    withdrawal_status = [
        {
            'status': r['status'],
            'label':  WITHDRAWAL_STATUS_LABEL.get(r['status'], r['status']),
            'count':  r['count'],
            'amount': float(r['amount'] or 0),
        }
        for r in wd_status_rows
    ]

    # ── Brand-wise deposits (top 8) ───────────────────────────────────────
    brand_dep_counter: dict[str, int] = {}
    for dep in dep_qs.select_related('qr_code__brand', 'upi_source__brand', 'bank_account__brand'):
        label = _deposit_brand_label(dep)
        if label:
            brand_dep_counter[label] = brand_dep_counter.get(label, 0) + 1
    brand_deposits = sorted(
        ({'brand': k, 'count': v} for k, v in brand_dep_counter.items()),
        key=lambda x: x['count'], reverse=True,
    )[:8]

    # ── Brand-wise withdrawals (top 8 by amount) ──────────────────────────
    brand_wd_rows = (
        wd_qs.exclude(brand__isnull=True)
        .values('brand__name')
        .annotate(amount=Sum('amount'), count=Count('id'))
        .order_by('-amount')[:8]
    )
    brand_withdrawals = [
        {'brand': r['brand__name'], 'amount': float(r['amount'] or 0), 'count': r['count']}
        for r in brand_wd_rows
    ]

    # ── Channel mix (deposit counts per channel) ──────────────────────────
    chan_rows = dep_qs.exclude(channel_type__isnull=True).values('channel_type').annotate(count=Count('id'))
    channel_mix = [
        {'channel': r['channel_type'], 'label': CHANNEL_LABEL.get(r['channel_type'], r['channel_type']), 'count': r['count']}
        for r in chan_rows
    ]

    # ── Ticket split (pending vs closed) ──────────────────────────────────
    ticket_split = [
        {'type': 'pending', 'count': pending_tickets},
        {'type': 'closed',  'count': closed_tickets},
    ]

    # ── Trend line: deposits + withdrawal (count & amount) per bucket ─────
    if bucket == 'day':
        dep_trend = (
            dep_qs.annotate(b=TruncDay('created_at'))
            .values('b').annotate(c=Count('id')).order_by('b')
        )
        wd_trend = (
            wd_qs.annotate(b=TruncDay('created_at'))
            .values('b').annotate(c=Count('id'), s=Sum('amount')).order_by('b')
        )
        delta_step  = timedelta(days=1)
    else:  # month buckets for yearly view
        dep_trend = (
            dep_qs.annotate(b=TruncMonth('created_at'))
            .values('b').annotate(c=Count('id')).order_by('b')
        )
        wd_trend = (
            wd_qs.annotate(b=TruncMonth('created_at'))
            .values('b').annotate(c=Count('id'), s=Sum('amount')).order_by('b')
        )
        delta_step  = None  # month buckets are not equally spaced

    dep_map = {r['b']: r['c'] for r in dep_trend if r['b']}
    wd_map  = {r['b']: r       for r in wd_trend  if r['b']}

    trend: list[dict] = []
    if delta_step:
        # Fill the entire range to avoid gaps in the line chart.
        cursor = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end_day = end.replace(hour=0, minute=0, second=0, microsecond=0)
        while cursor <= end_day:
            wd_row = wd_map.get(cursor)
            trend.append({
                'label':              cursor.strftime(label_fmt),
                'deposits':           dep_map.get(cursor, 0),
                'withdrawals_count':  (wd_row['c'] if wd_row else 0),
                'withdrawals_amount': float(wd_row['s'] or 0) if wd_row else 0.0,
            })
            cursor += delta_step
    else:
        keys = sorted(set(dep_map.keys()) | set(wd_map.keys()))
        for k in keys:
            wd_row = wd_map.get(k)
            trend.append({
                'label':              k.strftime(label_fmt),
                'deposits':           dep_map.get(k, 0),
                'withdrawals_count':  (wd_row['c'] if wd_row else 0),
                'withdrawals_amount': float(wd_row['s'] or 0) if wd_row else 0.0,
            })

    # ── Gateway volume (deposits per gateway) + withdrawals separate ──────
    gw_dep_rows = (
        dep_qs.exclude(gateway__isnull=True)
        .values('gateway__name')
        .annotate(count=Count('id'))
        .order_by('-count')[:10]
    )
    gateway_volume = [
        {'gateway': r['gateway__name'], 'deposits': r['count'],
         'withdrawals_count': 0, 'withdrawals_amount': 0.0}
        for r in gw_dep_rows
    ]

    payload = {
        'period':            period,
        'range':             {'start': start.isoformat(), 'end': end.isoformat()},
        'kpis':              kpis,
        'deposit_status':    deposit_status,
        'withdrawal_status': withdrawal_status,
        'brand_deposits':    brand_deposits,
        'brand_withdrawals': brand_withdrawals,
        'channel_mix':       channel_mix,
        'ticket_split':      ticket_split,
        'trend':             trend,
        'gateway_volume':    gateway_volume,
    }
    return success_response('Dashboard summary fetched', payload)
