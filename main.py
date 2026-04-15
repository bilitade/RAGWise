"""Project entry shim: run the API with `uv run api-server` or `python -m uvicorn app.api.main:app`."""


def main() -> None:
    from app.api.main import main as run_api

    run_api()


if __name__ == "__main__":
    main()
