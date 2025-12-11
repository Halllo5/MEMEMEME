import boto3
from botocore.exceptions import ClientError
from io import BytesIO
from typing import Optional

from config import settings


class S3Manager:
    """Manages S3 operations for meme files.
    
    Handles downloading original memes and uploading optimized versions.
    File paths follow the pattern: /memes/{uploader_id}/{id}.{ext}
    - .org for original files
    - .opt for optimized/processed files
    """
    
    def __init__(self):
        self._client = boto3.client(
            "s3",
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region,
            endpoint_url=settings.s3_endpoint,
        )
        self._bucket = settings.s3_bucket_name
    
    def _get_original_key(self, uploader_id: str, meme_id: str) -> str:
        """Generate the S3 key for an original meme file."""
        return f"memes/{uploader_id}/{meme_id}.org"
    
    def _get_optimized_key(self, uploader_id: str, meme_id: str) -> str:
        """Generate the S3 key for an optimized meme file."""
        return f"memes/{uploader_id}/{meme_id}.opt"
    
    def get_original(self, uploader_id: str, meme_id: str) -> Optional[bytes]:
        """Download an original meme file from S3.
        
        Args:
            uploader_id: The ID of the user who uploaded the meme.
            meme_id: The unique ID of the meme.
            
        Returns:
            The file contents as bytes, or None if the file doesn't exist.
        """
        key = self._get_original_key(uploader_id, meme_id)
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise
    
    def upload_optimized(
        self,
        uploader_id: str,
        meme_id: str,
        data: bytes,
        content_type: str = "image/webp",
    ) -> str:
        """Upload an optimized meme file to S3.
        
        Args:
            uploader_id: The ID of the user who uploaded the meme.
            meme_id: The unique ID of the meme.
            data: The optimized image data as bytes.
            content_type: The MIME type of the image (default: image/webp).
            
        Returns:
            The S3 key where the file was uploaded.
        """
        key = self._get_optimized_key(uploader_id, meme_id)
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=BytesIO(data),
            ContentType=content_type,
        )
        return key


# Singleton instance for convenience
s3_manager = S3Manager()
