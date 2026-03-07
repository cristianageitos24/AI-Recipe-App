from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from .recipe_scrape import extract_recipe


class RecipeImportRequest(BaseModel):
    url: HttpUrl
    timeout_seconds: float = Field(default=15.0, ge=1.0, le=60.0)
    retries: int = Field(default=2, ge=0, le=5)


app = FastAPI(title="Recipe URL Import API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/import-url")
def import_url(payload: RecipeImportRequest) -> dict:
    try:
        return extract_recipe(
            str(payload.url),
            timeout=payload.timeout_seconds,
            retries=payload.retries,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Recipe extraction failed: {exc}") from exc
