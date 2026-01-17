import os
from dataclasses import dataclass, field
from typing import List

import yaml


@dataclass
class ServerConfig:
    port: int = 8080
    body_limit: int = 1048576  # 1MB
    allowed_origins: List[str] = field(default_factory=list)

    def get_allowed_origins_string(self) -> str:
        return ",".join(self.allowed_origins)


@dataclass
class KafkaConfig:
    enabled: bool = False
    brokers: List[str] = field(default_factory=lambda: ["localhost:9092"])
    topic: str = "sdk-logs"
    group_id: str = "log-consumer-group"
    retry_max: int = 5
    retry_interval: int = 5  # seconds


@dataclass
class LogConfig:
    dir: str = "./logs"
    max_size: int = 104857600  # 100MB
    file_prefix: str = "sdk"
    rotate_daily: bool = True


@dataclass
class Config:
    server: ServerConfig = field(default_factory=ServerConfig)
    kafka: KafkaConfig = field(default_factory=KafkaConfig)
    log: LogConfig = field(default_factory=LogConfig)


cfg: Config = Config()


def load(path: str) -> None:
    global cfg

    if not os.path.exists(path):
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    server_data = data.get("server", {})
    kafka_data = data.get("kafka", {})
    log_data = data.get("log", {})

    # Parse retry_interval (e.g., "5s" -> 5)
    retry_interval = kafka_data.get("retry_interval", "5s")
    if isinstance(retry_interval, str) and retry_interval.endswith("s"):
        retry_interval = int(retry_interval[:-1])

    cfg = Config(
        server=ServerConfig(
            port=server_data.get("port", 8080),
            body_limit=server_data.get("body_limit", 1048576),
            allowed_origins=server_data.get("allowed_origins", []),
        ),
        kafka=KafkaConfig(
            enabled=kafka_data.get("enabled", False),
            brokers=kafka_data.get("brokers", ["localhost:9092"]),
            topic=kafka_data.get("topic", "sdk-logs"),
            group_id=kafka_data.get("group_id", "log-consumer-group"),
            retry_max=kafka_data.get("retry_max", 5),
            retry_interval=retry_interval,
        ),
        log=LogConfig(
            dir=log_data.get("dir", "./logs"),
            max_size=log_data.get("max_size", 104857600),
            file_prefix=log_data.get("file_prefix", "sdk"),
            rotate_daily=log_data.get("rotate_daily", True),
        ),
    )
