

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from supabase import Client, create_client


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_FILE = Path(__file__).resolve().parent / "recipes.jsonl"
TABLE_NAME = "recipes"
BATCH_SIZE = 100


def load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}

    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def get_env_value(name: str, env_values: dict[str, str]) -> str | None:
    runtime_value = os.getenv(name)
    if runtime_value:
        return runtime_value

    return env_values.get(name)


def create_supabase_client() -> Client:
    env_values = load_env_file(REPO_ROOT / ".env")

    url = (
        get_env_value("SUPABASE_URL", env_values)
        or get_env_value("EXPO_PUBLIC_SUPABASE_URL", env_values)
    )
    key = (
        get_env_value("SUPABASE_SERVICE_ROLE_KEY", env_values)
        or get_env_value("SUPABASE_ANON_KEY", env_values)
        or get_env_value("EXPO_PUBLIC_SUPABASE_ANON_KEY", env_values)
    )

    if not url or not key:
        raise RuntimeError(
            "Missing Supabase credentials. Expected .env in the repo root with SUPABASE_URL or "
            "EXPO_PUBLIC_SUPABASE_URL, and a key such as SUPABASE_SERVICE_ROLE_KEY, "
            "SUPABASE_ANON_KEY, or EXPO_PUBLIC_SUPABASE_ANON_KEY."
        )

    return create_client(url, key)


def clean_text(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, list):
        value = " ".join(str(item) for item in value)

    text = str(value).strip()
    if not text:
        return None

    text = " ".join(text.split())
    return text or None


def parse_minutes(value: Any) -> int | None:
    if value is None:
        return None

    if isinstance(value, int):
        return value

    text = str(value).strip()
    if not text:
        return None

    upper_text = text.upper()
    if upper_text.startswith("PT"):
        hours = 0
        minutes = 0
        current = ""

        for char in upper_text[2:]:
            if char.isdigit():
                current += char
            elif char == "H" and current:
                hours = int(current)
                current = ""
            elif char == "M" and current:
                minutes = int(current)
                current = ""

        total = hours * 60 + minutes
        return total if total > 0 else None

    digits = "".join(char for char in text if char.isdigit())
    if not digits:
        return None

    return int(digits)


def format_instructions(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, str):
        cleaned = clean_text(value)
        return cleaned

    if not isinstance(value, list):
        return clean_text(value)

    steps: list[str] = []
    for item in value:
        cleaned = clean_text(item)
        if cleaned:
            steps.append(cleaned)

    if not steps:
        return None

    return "\n\n".join(f"{index}. {step}" for index, step in enumerate(steps, start=1))


def recipe_to_row(recipe: dict[str, Any]) -> dict[str, Any] | None:
    title = clean_text(recipe.get("title") or recipe.get("name"))
    source = clean_text(recipe.get("source_url") or recipe.get("source"))

    if not title or not source:
        return None

    return {
        "title": title,
        "description": clean_text(recipe.get("description")),
        "instructions": format_instructions(recipe.get("instructions")),
        "image_url": clean_text(recipe.get("image") or recipe.get("image_url")),
        "prep_time_minutes": parse_minutes(recipe.get("prep_time") or recipe.get("prep_time_minute")),
        "cook_time_minutes": parse_minutes(recipe.get("cook_time") or recipe.get("cook_time_minute")),
        "source": source,
    }


def load_recipes(input_path: Path) -> list[dict[str, Any]]:
    raw_text = input_path.read_text(encoding="utf-8").strip()
    if not raw_text:
        return []

    if input_path.suffix.lower() == ".json":
        parsed = json.loads(raw_text)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
        if isinstance(parsed, dict):
            return [parsed]
        raise ValueError("JSON file must contain either an object or a list of objects.")

    recipes: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(raw_text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        try:
            parsed_line = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON on line {line_number}: {exc}") from exc

        if isinstance(parsed_line, dict):
            recipes.append(parsed_line)

    return recipes


def chunked(rows: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [rows[index:index + size] for index in range(0, len(rows), size)]


def insert_rows(client: Client, rows: list[dict[str, Any]]) -> None:
    for batch_index, batch in enumerate(chunked(rows, BATCH_SIZE), start=1):
        client.table(TABLE_NAME).insert(batch).execute()
        print(f"Inserted batch {batch_index} containing {len(batch)} recipe rows.")


def main() -> None:
    input_path = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else DEFAULT_INPUT_FILE

    if not input_path.exists():
        raise FileNotFoundError(
            f"Input file not found: {input_path}\n"
            f"Pass a file path explicitly, for example: python3 recipeScraper/jsonToRecipes.py recipeScraper/scraped_recipes.jsonl"
        )

    raw_recipes = load_recipes(input_path)
    rows: list[dict[str, Any]] = []
    skipped = 0

    for recipe in raw_recipes:
        row = recipe_to_row(recipe)
        if row is None:
            skipped += 1
            continue
        rows.append(row)

    if not rows:
        print("No valid recipe rows found to insert.")
        print(f"Skipped recipes: {skipped}")
        return

    client = create_supabase_client()
    insert_rows(client, rows)

    print(f"Finished inserting {len(rows)} recipes into '{TABLE_NAME}'.")
    print(f"Skipped recipes: {skipped}")
    print(f"Input file: {input_path}")


if __name__ == "__main__":
    main()