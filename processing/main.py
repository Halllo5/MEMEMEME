from io import BytesIO
from typing import Annotated

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from PIL import Image
from pydantic import BaseModel

from config import settings
from ocr import ocr
from s3_manager import s3_manager
from vectorizer import vectorizer

app = FastAPI()


@app.get("/health")
def read_root():
    return {"status": "ok"}


class ProcessRequest(BaseModel):
    uploader_id: str
    meme_id: str


def process_and_callback(process_request: ProcessRequest):
    try:
        # Get original image
        original_bytes = s3_manager.get_original(
            process_request.uploader_id, process_request.meme_id
        )
        if not original_bytes:
            print(f"Error: Original meme not found for {process_request.meme_id}")
            # Optionally send error callback here
            return

        try:
            original_image = Image.open(BytesIO(original_bytes))
        except Exception as e:
            print(f"Error: Invalid image data for {process_request.meme_id}: {e}")
            return

        # Optimize and upload as webp
        try:
            with BytesIO() as webp_buffer:
                original_image.save(webp_buffer, format="webp", quality=85)
                webp_bytes = webp_buffer.getvalue()

            s3_manager.upload_optimized(
                uploader_id=process_request.uploader_id,
                meme_id=process_request.meme_id,
                data=webp_bytes,
            )
            print(f"Successfully optimized and uploaded {process_request.meme_id}")
        except Exception as e:
            print(
                f"Error optimizing/uploading image for {process_request.meme_id}: {e}"
            )

        # Run processing
        ocr_result = ocr(original_image)
        vector = vectorizer.vectorize_image(original_image)

        result = {
            "status": "processed",
            "ocr": ocr_result,
            "vector": vector,
            "vector_length": len(vector),
            "uploader_id": process_request.uploader_id,
        }

        # Send callback
        callback_url = f"{settings.backend_url}/api/callback/{process_request.meme_id}"
        headers = {"x-api-key": settings.api_key}
        try:
            with httpx.Client() as client:
                response = client.post(callback_url, json=result, headers=headers)
                response.raise_for_status()
                print(f"Callback sent successfully for {process_request.meme_id}")
        except Exception as e:
            print(f"Failed to send callback for {process_request.meme_id}: {e}")

    except Exception as e:
        print(f"Unexpected error processing {process_request.meme_id}: {e}")


@app.post("/process", status_code=202)
def process_meme(
    process_request: ProcessRequest,
    background_tasks: BackgroundTasks,
    x_api_key: Annotated[str | None, Header()] = None,
):
    """
    Process a meme asynchronously:
    1. Validate API Key
    2. Queue background task
    3. Return 202 Accepted
    """
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    background_tasks.add_task(process_and_callback, process_request)

    return {"status": "processing_started"}


class VectorRequest(BaseModel):
    text: str


@app.post("/vector")
def gen_text_vector(
    vector_request: VectorRequest, x_api_key: Annotated[str | None, Header()] = None
):
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return vectorizer.vectorize_text(vector_request.text)
