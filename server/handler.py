import time
from pathlib import Path
from typing import Dict, Union

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from config import cfg
import kafka
import logger

router = APIRouter()


@router.post("/log")
async def log_handler(request: Request) -> Response:
    """Receive logs"""
    body = await request.body()

    if not body:
        return JSONResponse(
            status_code=400,
            content={"code": 400, "message": "Empty request body"},
        )

    client_ip = request.client.host if request.client else "unknown"

    # Choose processing method based on Kafka status
    if kafka.is_enabled():
        try:
            await kafka.send_log(client_ip, body)
        except Exception as e:
            if logger.error_logger:
                logger.error_logger.error(f"Failed to send to kafka: {e}")
            return JSONResponse(
                status_code=500,
                content={"code": 500, "message": "Failed to process log"},
            )
    else:
        try:
            logger.write_sdk_log(body)
        except Exception as e:
            if logger.error_logger:
                logger.error_logger.error(f"Failed to write log: {e}")
            return JSONResponse(
                status_code=500,
                content={"code": 500, "message": "Failed to process log"},
            )

    return JSONResponse(content={"code": 0, "message": "success"})


@router.get("/health")
async def health_handler() -> Response:
    """Health check"""
    status: Dict[str, Union[int, str, Dict[str, Dict[str, str]]]] = {
        "status": "ok",
        "timestamp": int(time.time()),
        "services": {
            "kafka": _check_kafka_health(),
            "disk": _check_disk_space(),
        },
    }
    return JSONResponse(content=status)


def _check_kafka_health() -> Dict[str, str]:
    """Check Kafka connection status"""
    if not kafka.is_enabled():
        return {
            "status": "disabled",
            "message": "Kafka is disabled, using direct file write",
        }

    healthy = kafka.is_healthy()
    return {"status": "ok" if healthy else "error"}


def _check_disk_space() -> Dict[str, str]:
    """Check disk space"""
    log_dir = cfg.log.dir

    # Check if log directory is accessible
    log_path = Path(log_dir)
    if not log_path.exists():
        return {"status": "error", "error": f"Directory not found: {log_dir}"}

    if not log_path.is_dir():
        return {"status": "error", "error": "log path is not a directory"}

    # Create temp file to check if writable
    test_file = log_path / ".health_check"
    try:
        test_file.touch()
        test_file.unlink()
    except Exception as _:
        return {"status": "warning", "error": "directory not writable"}

    return {"status": "ok", "path": log_dir}
