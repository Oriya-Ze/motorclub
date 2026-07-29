from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://motorclub:motorclub_dev@localhost:5432/motorclub"
    auth_provider: str = "local"
    jwt_secret: str = "dev-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    aws_region: str = "eu-west-1"
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_client_secret: str = ""
    backend_cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost"
    upload_dir: str = "./uploads"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.backend_cors_origins.split(",") if o.strip()]


settings = Settings()
