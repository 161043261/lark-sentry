from io import TextIOWrapper
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

from config import cfg

# System loggers
info_logger: Optional[logging.Logger] = None
error_logger: Optional[logging.Logger] = None

# SDK log state
_sdk_file: Optional[TextIOWrapper] = None
_sdk_lock = threading.Lock()
_current_month: str = ""
_current_day: str = ""
_current_size: int = 0


def init() -> None:
    global info_logger, error_logger, _current_month, _current_day

    log_cfg = cfg.log

    # Create month directory
    _current_month = datetime.now().strftime("%Y-%m")
    _current_day = datetime.now().strftime("%Y-%m-%d")
    month_dir = Path(log_cfg.dir) / _current_month
    month_dir.mkdir(parents=True, exist_ok=True)

    # Setup system loggers
    formatter = logging.Formatter(
        "[%(levelname)s] %(asctime)s %(filename)s:%(lineno)d - %(message)s"
    )

    # Info logger
    info_logger = logging.getLogger("info")
    info_logger.setLevel(logging.INFO)
    info_logger.handlers.clear()

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    info_logger.addHandler(console_handler)

    sys_log_path = month_dir / "system.log"
    file_handler = logging.FileHandler(sys_log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    info_logger.addHandler(file_handler)

    # Error logger
    error_logger = logging.getLogger("error")
    error_logger.setLevel(logging.ERROR)
    error_logger.handlers.clear()

    error_console = logging.StreamHandler()
    error_console.setFormatter(formatter)
    error_logger.addHandler(error_console)
    error_logger.addHandler(file_handler)

    # Initialize SDK log file
    _open_sdk_log_file()


def _open_sdk_log_file() -> None:
    global _sdk_file, _current_size

    log_cfg = cfg.log
    month_dir = Path(log_cfg.dir) / _current_month
    month_dir.mkdir(parents=True, exist_ok=True)

    # Filename: sdk_20060102_150405.log
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{log_cfg.file_prefix}_{timestamp}.log"
    file_path = month_dir / filename

    _sdk_file = open(file_path, "a", encoding="utf-8")
    _current_size = file_path.stat().st_size if file_path.exists() else 0

    if info_logger:
        info_logger.info(f"Opened SDK log file: {file_path}")


def _rotate_if_needed() -> None:
    global _current_month, _current_day

    log_cfg = cfg.log
    now = datetime.now()
    now_month = now.strftime("%Y-%m")
    now_day = now.strftime("%Y-%m-%d")

    # Check month change
    if now_month != _current_month:
        _current_month = now_month
        _current_day = now_day
        _rotate()
        return

    # Check day change (if daily rotation enabled)
    if log_cfg.rotate_daily and now_day != _current_day:
        _current_day = now_day
        _rotate()
        return

    # Check file size
    if _current_size >= log_cfg.max_size:
        _rotate()


def _rotate() -> None:
    global _sdk_file, _current_size

    if _sdk_file:
        _sdk_file.close()
    _current_size = 0
    _open_sdk_log_file()


def write_sdk_log(data: bytes) -> None:
    global _current_size

    with _sdk_lock:
        _rotate_if_needed()

        if _sdk_file:
            content = data.decode("utf-8") if isinstance(data, bytes) else data
            _sdk_file.write(str(content) + "\n")
            _sdk_file.flush()
            _current_size += len(content) + 1


def close() -> None:
    global _sdk_file

    with _sdk_lock:
        if _sdk_file:
            _sdk_file.flush()
            _sdk_file.close()
            _sdk_file = None
