"""Periodic background rescanning (extension of ADR-0007's scan model).

Enabled when HOME_THEATER_AUTOSCAN_SEC is set to a positive number of seconds
(0 or unset = off). One pass scans every configured source incrementally —
unchanged files are skipped cheaply, so a pass is fast on a quiet library and
newly copied files are picked up without anyone pressing "Scan".

Design notes:
- A single dedicated daemon thread scans sources one at a time; it never runs
  concurrently with itself.
- The loop must never die: every error is swallowed for that pass only. A scan
  failure shows up in the source status, not as a crash.
- Auto-scans are audited only when they actually indexed something, so a quiet
  library does not spam the audit log.
"""
from __future__ import annotations

import threading

from .db import Database
from .scanner import scan_source
from .security import audit_details_safe

MIN_INTERVAL_SEC = 0.05  # tests use tiny intervals; production guidance is >= 30


class AutoScanner:
    def __init__(self, db: Database, interval_sec: float):
        if interval_sec <= 0:
            raise ValueError("AutoScanner requires a positive interval")
        self.db = db
        self.interval = max(MIN_INTERVAL_SEC, float(interval_sec))
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_pass: dict | None = None  # summary of the most recent pass

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, daemon=True,
                                        name="home-theater-autoscan")
        self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=timeout)

    def _run(self) -> None:
        while not self._stop.is_set():
            summary = {"sources": 0, "indexed": 0, "errors": 0}
            try:
                ids = [r["id"] for r in self.db.query("SELECT id FROM media_sources")]
                for sid in ids:
                    if self._stop.is_set():
                        break
                    result = scan_source(self.db, sid, force=False)
                    summary["sources"] += 1
                    summary["indexed"] += result.get("indexed", 0)
                    summary["errors"] += result.get("errors", 0)
                    if result.get("indexed"):
                        self.db.audit("source_scan", target_type="media_source",
                                      target_id=sid, details=audit_details_safe(result))
            except Exception:
                summary["errors"] += 1  # keep the loop alive, whatever happened
            self.last_pass = summary
            self._stop.wait(self.interval)
