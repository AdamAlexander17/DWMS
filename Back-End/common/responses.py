from rest_framework.response import Response
from rest_framework import status


def success_response(
    message: str,
    data=None,
    status_code: int = status.HTTP_200_OK,
) -> Response:
    """Return a standardised success response."""
    return Response(
        {
            'success': True,
            'message': message,
            'data': data,
            'errors': None,
        },
        status=status_code,
    )


def error_response(
    message: str,
    errors=None,
    status_code: int = status.HTTP_400_BAD_REQUEST,
) -> Response:
    """Return a standardised error response."""
    return Response(
        {
            'success': False,
            'message': message,
            'data': None,
            'errors': errors,
        },
        status=status_code,
    )
