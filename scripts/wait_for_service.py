"""
Bubsy Service Readiness Waiter
Polls the backend health check endpoint until it reports ready or times out.
"""

import sys
import time
import urllib.request
import urllib.error


def wait_for_service(url: str = "http://127.0.0.1:8000/api/v1/health", max_retries: int = 30, delay: float = 0.5) -> bool:
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Bubsy-HealthCheck"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, ConnectionResetError, OSError):
            pass
        time.sleep(delay)
    return False


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/api/v1/health"
    if wait_for_service(target):
        sys.exit(0)
    else:
        sys.exit(1)
