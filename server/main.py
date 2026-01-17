import sys
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# Add server directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
import logger
import kafka
from handler import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager"""
    # Startup
    try:
        await kafka.init_producer()
    except Exception as e:
        if logger.error_logger:
            logger.error_logger.warning(f"Kafka producer init warning: {e}")

    await kafka.start_consumer_with_retry()

    yield

    # Shutdown
    if logger.info_logger:
        logger.info_logger.info("Shutting down...")

    await kafka.stop_consumer()
    await kafka.close_producer()
    logger.close()

    if logger.info_logger:
        logger.info_logger.info("Server stopped")


def create_app() -> FastAPI:
    """Create FastAPI application"""
    app = FastAPI(title="lark-sentry Server", lifespan=lifespan)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cfg.server.allowed_origins,
        allow_credentials=False,
        allow_methods=["POST", "OPTIONS", "GET"],
        allow_headers=["Content-Type", "Authorization"],
    )

    # Routes
    app.include_router(api_router, prefix="/api")

    return app


def main() -> None:
    # Load config
    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    try:
        config.load(config_path)
    except Exception as e:
        print(f"Failed to load config: {e}")
        sys.exit(1)

    # Initialize logger
    try:
        logger.init()
    except Exception as e:
        print(f"Failed to init logger: {e}")
        sys.exit(1)

    # Create app
    app = create_app()

    # Start server
    if logger.info_logger:
        logger.info_logger.info(f"Server started on port {config.cfg.server.port}")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=config.cfg.server.port,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
