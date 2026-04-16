# Run from repo root (directory containing this Makefile).
.PHONY: lint test check
lint:
	uv run ruff check app tests

test:
	uv run pytest -q

check: lint test
