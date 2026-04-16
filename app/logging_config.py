"""File logging for the app process."""

from __future__ import annotations

import logging
from pathlib import Path

from app.config import APP_LOG_FILE


def setup_file_logging() -> None:
    """Append INFO file handler for ``APP_LOG_FILE`` if missing."""
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    if not any(
        isinstance(handler, logging.StreamHandler) and not hasattr(handler, "baseFilename")
        for handler in root.handlers
    ):
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root.addHandler(stream_handler)

    path = Path(APP_LOG_FILE)
    if not str(path).strip() or path.is_dir():
        return
    resolved = str(path.resolve())
    if any(getattr(h, "baseFilename", None) == resolved for h in root.handlers if hasattr(h, "baseFilename")):
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fh = logging.FileHandler(path, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root.addHandler(fh)
