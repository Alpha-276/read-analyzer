from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness check: the API responds, regardless of database availability."""
    return {"status": "healthy"}
