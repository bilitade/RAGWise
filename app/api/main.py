from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.routers import chat, files, health, ingestion, retrieval
from app.config import API_CORS_ORIGINS, API_HOST, API_PORT


app = FastAPI(
    title="Banking RAG API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=API_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(ingestion.router, prefix="/api")
app.include_router(retrieval.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


def main() -> None:
    uvicorn.run("app.api.main:app", host=API_HOST, port=API_PORT, reload=False)


if __name__ == "__main__":
    main()
