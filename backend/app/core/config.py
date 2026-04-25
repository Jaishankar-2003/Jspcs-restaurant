from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Restaurant Management MVP"
    app_mode: str = "hybrid"  # fast_food | restaurant | hybrid
    secret_key: str = "change-me"
    access_token_minutes: int = 720
    database_url: str = "postgresql+psycopg2://postgres:postgres@postgres:5432/restaurant"


settings = Settings()
