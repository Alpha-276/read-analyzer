from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    try:
        yield
    finally:
        engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="Read Analyzer API",
        description=(
            "API for analyzing student voice recordings "
            "and identifying speech development anomalies"
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router)

    @application.get("/", tags=["Root"])
    async def root() -> dict[str, str]:
        return {
            "project": "Read Analyzer",
            "version": application.version,
            "status": "online",
            "docs": "/docs",
        }

    return application


app = create_app()
