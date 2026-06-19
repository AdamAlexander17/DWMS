# =============================================================================
# Gunicorn Configuration for DWMS (fallback HTTP workers)
# =============================================================================
# Note: Daphne handles ASGI (WebSockets + HTTP).
# This file is for reference if you want gunicorn for HTTP-only workers.
# =============================================================================

import multiprocessing

bind = "127.0.0.1:8000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gthread"
threads = 4
timeout = 120
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
accesslog = "/var/log/dwms/gunicorn-access.log"
errorlog = "/var/log/dwms/gunicorn-error.log"
loglevel = "info"
