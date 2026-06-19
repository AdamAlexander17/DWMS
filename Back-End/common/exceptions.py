import logging
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError
from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import (
    ValidationError,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    NotFound,
    MethodNotAllowed,
    Throttled,
)

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Centralized exception handler returning a consistent JSON response format:
    {
        "success": false,
        "message": "...",
        "data": null,
        "errors": { ... }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        if isinstance(exc, ValidationError):
            return Response(
                {
                    'success': False,
                    'message': 'Validation failed',
                    'data': None,
                    'errors': response.data,
                },
                status=response.status_code,
            )

        if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
            return Response(
                {
                    'success': False,
                    'message': 'Authentication credentials were not provided or are invalid',
                    'data': None,
                    'errors': {'detail': response.data.get('detail', str(exc))},
                },
                status=response.status_code,
            )

        if isinstance(exc, PermissionDenied):
            return Response(
                {
                    'success': False,
                    'message': 'You do not have permission to perform this action',
                    'data': None,
                    'errors': {'detail': response.data.get('detail', str(exc))},
                },
                status=response.status_code,
            )

        if isinstance(exc, NotFound):
            return Response(
                {
                    'success': False,
                    'message': 'The requested resource was not found',
                    'data': None,
                    'errors': {'detail': response.data.get('detail', str(exc))},
                },
                status=response.status_code,
            )

        if isinstance(exc, MethodNotAllowed):
            return Response(
                {
                    'success': False,
                    'message': 'Method not allowed',
                    'data': None,
                    'errors': {'detail': response.data.get('detail', str(exc))},
                },
                status=response.status_code,
            )

        if isinstance(exc, Throttled):
            return Response(
                {
                    'success': False,
                    'message': 'Too many requests. Please slow down.',
                    'data': None,
                    'errors': {'detail': response.data.get('detail', str(exc))},
                },
                status=response.status_code,
            )

        # Fallback for any other DRF exception
        return Response(
            {
                'success': False,
                'message': 'An error occurred',
                'data': None,
                'errors': response.data,
            },
            status=response.status_code,
        )

    # Handle Django ORM exceptions not caught by DRF
    if isinstance(exc, ObjectDoesNotExist):
        return Response(
            {
                'success': False,
                'message': 'The requested resource was not found',
                'data': None,
                'errors': {'detail': str(exc)},
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(exc, IntegrityError):
        return Response(
            {
                'success': False,
                'message': 'A database constraint was violated',
                'data': None,
                'errors': {'detail': 'Duplicate or conflicting data provided'},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, (ProtectedError, RestrictedError)):
        protected = [str(obj) for obj in getattr(exc, 'protected_objects', [])]
        return Response(
            {
                'success': False,
                'message': 'Cannot delete this record because it has linked data',
                'data': None,
                'errors': {'detail': f'Linked records: {", ".join(protected[:5])}' if protected else 'Has dependent records'},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Server error fallback
    logger.error('Unhandled exception in API', exc_info=exc)
    return Response(
        {
            'success': False,
            'message': 'Internal server error',
            'data': None,
            'errors': {'detail': 'An unexpected error occurred. Please try again later.'},
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
