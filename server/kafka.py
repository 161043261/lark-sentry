import asyncio
from typing import Optional

from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from aiokafka.errors import KafkaError

from config import cfg
import logger

# Producer state
_producer: Optional[AIOKafkaProducer] = None
_enabled: bool = False

# Consumer state
_consumer: Optional[AIOKafkaConsumer] = None
_consumer_task: Optional[asyncio.Task] = None


async def init_producer() -> None:
    """Initialize Kafka Producer (if enabled)"""
    global _producer, _enabled

    if not cfg.kafka.enabled:
        if logger.info_logger:
            logger.info_logger.info(
                "Kafka is disabled, logs will be written directly to file"
            )
        _enabled = False
        return

    try:
        _producer = AIOKafkaProducer(
            bootstrap_servers=",".join(cfg.kafka.brokers),
            acks="all",
            retry_backoff_ms=100,
        )
        await _producer.start()
        _enabled = True
        if logger.info_logger:
            logger.info_logger.info("Kafka producer initialized")
    except KafkaError as e:
        if logger.error_logger:
            logger.error_logger.error(
                f"Failed to create Kafka producer: {e}, falling back to direct file write"
            )
        _enabled = False


async def close_producer() -> None:
    """Close Kafka Producer"""
    global _producer

    if _producer:
        await _producer.stop()
        _producer = None


async def send_log(key: str, data: bytes) -> None:
    """Send log to Kafka"""
    global _producer, _enabled

    if not _enabled or not _producer:
        raise RuntimeError("Kafka not available")

    key_bytes = key.encode("utf-8") if key else None
    await _producer.send_and_wait(cfg.kafka.topic, value=data, key=key_bytes)


def is_enabled() -> bool:
    """Return whether Kafka is enabled"""
    return _enabled


def is_healthy() -> bool:
    """Check if Kafka connection is healthy"""
    return _enabled and _producer is not None


async def _disable_kafka() -> None:
    """Disable Kafka, fallback to direct file write"""
    global _enabled, _producer

    _enabled = False
    if _producer:
        await _producer.stop()
        _producer = None


async def _consumer_loop() -> None:
    """Consumer loop running as async task"""
    global _consumer

    try:
        _consumer = AIOKafkaConsumer(
            cfg.kafka.topic,
            bootstrap_servers=",".join(cfg.kafka.brokers),
            group_id=cfg.kafka.group_id,
            auto_offset_reset="latest",
            enable_auto_commit=True,
        )
        await _consumer.start()

        if logger.info_logger:
            logger.info_logger.info("Kafka consumer started")

        async for msg in _consumer:
            try:
                logger.write_sdk_log(msg.value)
            except Exception as e:
                if logger.error_logger:
                    logger.error_logger.error(f"Failed to write log: {e}")

    except asyncio.CancelledError:
        pass
    except Exception as e:
        if logger.error_logger:
            logger.error_logger.error(f"Consumer error: {e}")
    finally:
        if _consumer:
            await _consumer.stop()
            _consumer = None


async def start_consumer_with_retry() -> None:
    """Start Kafka consumer with retry"""
    global _consumer_task

    if not is_enabled():
        if logger.info_logger:
            logger.info_logger.info("Kafka consumer not started (Kafka disabled)")
        return

    kafka_cfg = cfg.kafka
    retry_max = kafka_cfg.retry_max if kafka_cfg.retry_max > 0 else 5
    retry_interval = kafka_cfg.retry_interval if kafka_cfg.retry_interval > 0 else 5

    for i in range(retry_max):
        try:
            # Test connection
            test_consumer = AIOKafkaConsumer(
                bootstrap_servers=",".join(kafka_cfg.brokers),
                group_id=kafka_cfg.group_id,
            )
            await test_consumer.start()
            await test_consumer.stop()

            # Start consumer task
            _consumer_task = asyncio.create_task(_consumer_loop())
            return
        except Exception as e:
            if logger.error_logger:
                logger.error_logger.error(
                    f"Kafka connection failed (attempt {i + 1}/{retry_max}): {e}"
                )
            await asyncio.sleep((i + 1) * retry_interval)

    # Connection failed, fallback to direct file write
    if logger.error_logger:
        logger.error_logger.error(
            f"Failed to connect to Kafka after {retry_max} attempts, falling back to direct file write"
        )
    await _disable_kafka()


async def stop_consumer() -> None:
    """Stop Kafka consumer"""
    global _consumer_task, _consumer

    if _consumer_task:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass
        _consumer_task = None
