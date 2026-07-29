import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from app.config import settings

_LOGGING_CONFIGURED = False


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "service": settings.service_name,
            "environment": settings.environment,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for field in ("request_id", "method", "path", "status_code", "duration_ms"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value

        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__ if record.exc_info[0] else None

        return json.dumps(payload, ensure_ascii=False)


def setup_logging(log_level: str) -> None:
    global _LOGGING_CONFIGURED

    level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    if _LOGGING_CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root_logger.addHandler(handler)

    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.access").propagate = True

    _LOGGING_CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
