"""File logging for the app process."""

from __future__ import annotations

import logging
from pathlib import Path

from app.config import APP_LOG_FILE


def setup_file_logging() -> None:
    """Append INFO file handler for ``APP_LOG_FILE`` if missing."""
    path = Path(APP_LOG_FILE)
    path.parent.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    resolved = str(path.resolve())
    if any(getattr(h, "baseFilename", None) == resolved for h in root.handlers if hasattr(h, "baseFilename")):
        return
    fh = logging.FileHandler(path, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root.addHandler(fh)
