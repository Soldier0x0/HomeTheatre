"""Admin secret handling: scrypt hashing, verification rate limiting, audit-adjacent helpers.

The submitted password never enters the database, logs, or audit records.
"""
import hashlib
import hmac
import secrets
import threading
import time

_PARAMS = {"n": 1 << 15, "r": 8, "p": 1, "dklen": 64, "maxmem": 64 << 20}


def hash_secret(secret: str) -> tuple[str, str, str]:
    """Return (hash_hex, salt_hex, params_json)."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(secret.encode("utf-8"), salt=salt, **_PARAMS)
    import json
    persisted = {k: v for k, v in _PARAMS.items() if k != "maxmem"}
    return digest.hex(), salt.hex(), json.dumps(persisted)


def verify_secret(secret: str, hash_hex: str, salt_hex: str, params_json: str) -> bool:
    import json
    params = json.loads(params_json)
    try:
        candidate = hashlib.scrypt(
            secret.encode("utf-8"), salt=bytes.fromhex(salt_hex),
            n=params["n"], r=params["r"], p=params["p"], dklen=params["dklen"],
            maxmem=64 << 20,
        )
    except (ValueError, KeyError):
        return False
    return hmac.compare_digest(candidate, bytes.fromhex(hash_hex))


class RateLimiter:
    """Sliding-window limiter, per key. In-memory; fine for one home server process."""

    def __init__(self, max_events: int, window_sec: float = 60.0):
        self.max_events = max_events
        self.window = window_sec
        self._events: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = [t for t in self._events.get(key, []) if now - t < self.window]
            if len(bucket) >= self.max_events:
                self._events[key] = bucket
                return False
            bucket.append(now)
            self._events[key] = bucket
            return True


def audit_details_safe(details: dict) -> dict:
    """Defense-in-depth: strip anything that looks like a submitted secret."""
    blocked = {"password", "admin_password", "secret", "token"}
    return {k: v for k, v in details.items() if k.lower() not in blocked}
