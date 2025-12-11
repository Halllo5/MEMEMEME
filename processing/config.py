from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    api_key: str = "key"
    
    # S3 Configuration (flattened for simpler .env usage)
    s3_access_key_id: str
    s3_secret_access_key: str
    s3_bucket_name: str
    s3_region: str
    s3_endpoint: str
    
    # Callback Configuration
    backend_url: str


settings = Settings()