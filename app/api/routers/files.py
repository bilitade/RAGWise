from pathlib import Path

from fastapi import APIRouter, File, UploadFile

from app.api.schemas import FileUploadItem, FileUploadResponse
from app.config import UPLOAD_DIR

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", response_model=FileUploadResponse)
async def upload_files(files: list[UploadFile] = File(...)) -> FileUploadResponse:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    uploaded: list[FileUploadItem] = []

    for file in files:
        filename = Path(file.filename or "upload.bin").name
        destination = UPLOAD_DIR / filename
        content = await file.read()
        destination.write_bytes(content)
        uploaded.append(
            FileUploadItem(
                filename=filename,
                path=str(destination),
                size=len(content),
            )
        )
        await file.close()

    return FileUploadResponse(files=uploaded)
