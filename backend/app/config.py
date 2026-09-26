from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    max_upload_size_mb: int = Field(default=10, ge=1)
    dataset_ttl_seconds: int = Field(default=3600, ge=1)
    max_datasets_in_memory: int = Field(default=20, ge=1)
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


settings = Settings()
