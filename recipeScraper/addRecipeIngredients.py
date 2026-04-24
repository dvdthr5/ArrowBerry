from __future__ import annotations

import json
import os
import sys
import re
from pathlib import Path
from typing import Any

from supabase import Client, create_client


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_FILE = Path(__file__).resolve().parent / "recipes.jsonl"
RECIPE_TABLE = "recipes"
RECIPE_INGREDIENTS_TABLE = "recipe_ingredients"
BATCH_SIZE = 200

KNOWN_UNITS = {
    "teaspoon", "teaspoons", "tsp", "tsp.",
    "tablespoon", "tablespoons", "tbsp", "tbsp.",
    "cup", "cups",
    "ounce", "ounces", "oz", "oz.",
    "fluid ounce", "fluid ounces", "fl oz", "fl. oz.",
    "pint", "pints", "pt", "pt.",
    "quart", "quarts", "qt", "qt.",
    "gallon", "gallons", "gal", "gal.",
    "pound", "pounds", "lb", "lb.", "lbs", "lbs.",
    "gram", "grams", "g", "g.",
    "kilogram", "kilograms", "kg", "kg.",
    "milligram", "milligrams", "mg", "mg.",
    "liter", "liters", "litre", "litres", "l", "l.",
    "milliliter", "milliliters", "millilitre", "millilitres", "ml", "ml.",
    "clove", "cloves",
    "slice", "slices",
    "can", "cans",
    "package", "packages", "pkg", "pkg.",
    "packet", "packets",
    "bunch", "bunches",
    "stalk", "stalks",
    "sprig", "sprigs",
    "piece", "pieces",
    "inch", "inches",
    "pinch", "pinches",
    "dash", "dashes",
}

QUANTITY_TOKEN_RE = re.compile(r"^(?:\d+(?:\.\d+)?|\d+/\d+)$")

PREPARATION_TERMS = {
    "chopped", "diced", "minced", "sliced", "cubed", "peeled", "grated",
    "shredded", "softened", "melted", "beaten", "whisked", "crushed",
    "drained", "rinsed", "halved", "quartered", "trimmed", "divided",
    "room-temperature", "room", "temperature", "large", "medium", "small",
    "extra-large", "extra", "thinly", "thickly", "roughly", "finely", "coarsely",
    "fresh", "freshly", "toasted", "ground", "boneless", "skinless", "optional",
    "packed", "unsalted", "salted", "warm", "cold",
}

PREPARATION_PHRASE_PATTERNS = [
    re.compile(r",\s*(finely|roughly|thinly|thickly|coarsely)\s+[^,]+$", re.IGNORECASE),
    re.compile(r",\s*(chopped|diced|minced|sliced|cubed|peeled|grated|shredded|crushed|drained|rinsed|softened|melted|beaten|whisked|halved|quartered|trimmed|divided)\b[^,]*$", re.IGNORECASE),
    re.compile(r",\s*(at room temperature|room temperature|softened|melted|drained|rinsed|beaten|whisked|to taste)\b[^,]*$", re.IGNORECASE),
]


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


def normalize_key(value: str | None) -> str | None:
    cleaned = clean_text(value)
    if not cleaned:
        return None
    return cleaned.casefold()


def extract_ingredient_names(recipe: dict[str, Any]) -> list[str]:
    raw_ingredients = recipe.get("ingredients") or recipe.get("recipeIngredient") or []

    if isinstance(raw_ingredients, str):
        raw_ingredients = [raw_ingredients]
    elif not isinstance(raw_ingredients, list):
        raw_ingredients = []

    ingredient_names: list[str] = []
    seen: set[str] = set()

    for ingredient in raw_ingredients:
        cleaned = clean_text(ingredient)
        normalized = normalize_key(cleaned)
        if not cleaned or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ingredient_names.append(cleaned)

    return ingredient_names


def normalize_unit(value: str | None) -> str | None:
    cleaned = clean_text(value)
    if not cleaned:
        return None
    return cleaned.lower().replace(".", "")


def split_preparation_note(ingredient_name: str) -> tuple[str, str | None]:
    text = clean_text(ingredient_name) or ""
    if not text:
        return "", None

    note_parts: list[str] = []

    while True:
        matched = False
        for pattern in PREPARATION_PHRASE_PATTERNS:
            match = pattern.search(text)
            if not match:
                continue

            note = clean_text(match.group(0).lstrip(", "))
            if note:
                note_parts.insert(0, note)
            text = clean_text(text[:match.start()]) or ""
            matched = True
            break

        if not matched:
            break

    words = text.split()
    descriptor_tokens: list[str] = []
    ingredient_start = 0

    for index, word in enumerate(words):
        normalized_word = word.lower().strip(",")
        if normalized_word in PREPARATION_TERMS:
            descriptor_tokens.append(word.strip(","))
            continue

        ingredient_start = index
        break
    else:
        ingredient_start = len(words)

    if descriptor_tokens:
        note_parts.insert(0, " ".join(descriptor_tokens))
        text = " ".join(words[ingredient_start:])

    cleaned_name = clean_text(text) or (clean_text(ingredient_name) or "")
    prep_note = "; ".join(part for part in note_parts if part) or None
    return cleaned_name, prep_note


def parse_ingredient_parts(ingredient_text: str) -> tuple[str | None, str | None, str, str | None]:
    text = clean_text(ingredient_text) or ""
    if not text:
        return None, None, "", None

    text = re.sub(r"^\s*[-•*]\s*", "", text)
    text = re.sub(r"\s*\([^)]*\)", "", text)
    text = re.sub(r"\s+", " ", text).strip()

    words = text.split()
    if not words:
        return None, None, "", None

    quantity_tokens: list[str] = []
    index = 0

    while index < len(words):
        candidate = words[index].lower()
        if QUANTITY_TOKEN_RE.match(candidate):
            quantity_tokens.append(words[index])
            index += 1
            continue
        break

    if index < len(words) and words[index].lower() in {"to", "or"} and quantity_tokens:
        range_start = index
        index += 1
        while index < len(words) and QUANTITY_TOKEN_RE.match(words[index].lower()):
            quantity_tokens.append(words[range_start])
            quantity_tokens.append(words[index])
            index += 1
            break

    quantity = " ".join(quantity_tokens) if quantity_tokens else None

    remaining_words = words[index:]
    unit: str | None = None

    if len(remaining_words) >= 2:
        two_word_unit = normalize_unit(" ".join(remaining_words[:2]))
        if two_word_unit in KNOWN_UNITS:
            unit = two_word_unit
            remaining_words = remaining_words[2:]

    if unit is None and remaining_words:
        one_word_unit = normalize_unit(remaining_words[0])
        if one_word_unit in KNOWN_UNITS:
            unit = one_word_unit
            remaining_words = remaining_words[1:]

    ingredient_name = clean_text(" ".join(remaining_words)) or text
    cleaned_ingredient_name, prep_note = split_preparation_note(ingredient_name)
    return quantity, unit, cleaned_ingredient_name, prep_note



def clear_recipe_ingredients_table(client: Client) -> int:
    deleted_count = 0

    while True:
        response = (
            client.table(RECIPE_INGREDIENTS_TABLE)
            .select("id")
            .range(0, BATCH_SIZE - 1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            break

        ids_to_delete = [row.get("id") for row in rows if row.get("id") is not None]
        if not ids_to_delete:
            break

        client.table(RECIPE_INGREDIENTS_TABLE).delete().in_("id", ids_to_delete).execute()
        deleted_count += len(ids_to_delete)
        print(f"Deleted batch containing {len(ids_to_delete)} existing recipe ingredient rows.")

    return deleted_count


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


def chunked(values: list[Any], size: int) -> list[list[Any]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def build_recipe_lookup(client: Client) -> dict[str, list[dict[str, Any]]]:
    lookup: dict[str, list[dict[str, Any]]] = {}
    page_size = 1000
    offset = 0

    while True:
        response = (
            client.table(RECIPE_TABLE)
            .select("id, title, source")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            break

        for row in rows:
            normalized_title = normalize_key(row.get("title"))
            recipe_id = row.get("id")
            if not normalized_title or recipe_id is None:
                continue
            lookup.setdefault(normalized_title, []).append(row)

        if len(rows) < page_size:
            break

        offset += page_size

    return lookup


def build_existing_ingredient_lookup(client: Client, recipe_ids: list[str]) -> dict[str, set[str]]:
    existing: dict[str, set[str]] = {}
    unique_ids = sorted({recipe_id for recipe_id in recipe_ids if recipe_id})
    if not unique_ids:
        return existing

    for batch in chunked(unique_ids, BATCH_SIZE):
        response = (
            client.table(RECIPE_INGREDIENTS_TABLE)
            .select("recipe_id, ingredient_name")
            .in_("recipe_id", batch)
            .execute()
        )

        for row in response.data or []:
            recipe_id = row.get("recipe_id")
            ingredient_name = normalize_key(row.get("ingredient_name"))
            if not recipe_id or not ingredient_name:
                continue
            existing.setdefault(recipe_id, set()).add(ingredient_name)

    return existing


def main() -> None:
    input_path = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else DEFAULT_INPUT_FILE

    if not input_path.exists():
        raise FileNotFoundError(
            f"Input file not found: {input_path}\n"
            f"Pass a file path explicitly, for example: python3 recipeScraper/addRecipeIngredients.py recipeScraper/recipes.jsonl"
        )

    raw_recipes = load_recipes(input_path)
    prepared_rows: list[tuple[str, str | None, list[str]]] = []
    recipe_preparation_notes: dict[str, list[str]] = []

    for recipe in raw_recipes:
        title = clean_text(recipe.get("title") or recipe.get("name"))
        source = clean_text(recipe.get("source_url") or recipe.get("source"))
        ingredient_names = extract_ingredient_names(recipe)

        if not title or not ingredient_names:
            continue

        prepared_rows.append((title, source, ingredient_names))

    if not prepared_rows:
        print("No recipes with ingredients were found in the input file.")
        return

    client = create_supabase_client()
    deleted_count = clear_recipe_ingredients_table(client)
    print(f"Cleared {deleted_count} existing rows from '{RECIPE_INGREDIENTS_TABLE}'.")
    recipe_lookup = build_recipe_lookup(client)

    matched_recipe_ids: list[str] = []
    missing_recipe_count = 0
    ambiguous_recipe_count = 0

    for title, _source, _ingredient_names in prepared_rows:
        normalized_title = normalize_key(title)
        if not normalized_title:
            continue

        matches = recipe_lookup.get(normalized_title, [])
        if not matches:
            missing_recipe_count += 1
            print(f"No existing recipe row found for title: {title}")
            continue

        if len(matches) > 1:
            ambiguous_recipe_count += 1
            match_sources = [clean_text(match.get('source')) for match in matches]
            print(
                f"Ambiguous title match for '{title}'. Matching sources: {match_sources}. Skipping this recipe."
            )
            continue

        recipe_id = matches[0].get("id")
        if recipe_id:
            matched_recipe_ids.append(recipe_id)

    existing_lookup = build_existing_ingredient_lookup(client, matched_recipe_ids)

    ingredient_rows_to_insert: list[dict[str, Any]] = []
    recipe_preparation_notes: dict[str, list[str]] = {}
    skipped_existing_count = 0

    for title, _source, ingredient_names in prepared_rows:
        normalized_title = normalize_key(title)
        if not normalized_title:
            continue

        matches = recipe_lookup.get(normalized_title, [])
        if not matches or len(matches) > 1:
            continue

        recipe_id = matches[0].get("id")
        if not recipe_id:
            continue

        existing_ingredients = existing_lookup.setdefault(recipe_id, set())

        for ingredient_name in ingredient_names:
            quantity, unit, parsed_ingredient_name, prep_note = parse_ingredient_parts(ingredient_name)
            normalized_parsed_name = normalize_key(parsed_ingredient_name)
            if not normalized_parsed_name:
                continue

            if prep_note:
                recipe_preparation_notes.setdefault(recipe_id, []).append(
                    f"{parsed_ingredient_name}: {prep_note}"
                )

            if normalized_parsed_name in existing_ingredients:
                skipped_existing_count += 1
                continue

            ingredient_rows_to_insert.append(
                {
                    "recipe_id": recipe_id,
                    "ingredient_name": parsed_ingredient_name,
                    "is_core_ingredient": True,
                    "quantity": quantity,
                    "unit": unit,
                }
            )
            existing_ingredients.add(normalized_parsed_name)

    for recipe_id, prep_notes in recipe_preparation_notes.items():
        unique_notes: list[str] = []
        seen_notes: set[str] = set()

        for note in prep_notes:
            normalized_note = normalize_key(note)
            if not normalized_note or normalized_note in seen_notes:
                continue
            seen_notes.add(normalized_note)
            unique_notes.append(note)

        if not unique_notes:
            continue

        recipe_response = (
            client.table(RECIPE_TABLE)
            .select("instructions")
            .eq("id", recipe_id)
            .limit(1)
            .execute()
        )
        recipe_rows = recipe_response.data or []
        existing_instructions = clean_text(recipe_rows[0].get("instructions")) if recipe_rows else None

        prep_block = "Ingredient prep notes:\n" + "\n".join(f"- {note}" for note in unique_notes)
        updated_instructions = f"{existing_instructions}\n\n{prep_block}" if existing_instructions else prep_block

        client.table(RECIPE_TABLE).update({"instructions": updated_instructions}).eq("id", recipe_id).execute()

    if not ingredient_rows_to_insert:
        print("No new ingredient rows needed to be inserted.")
        print(f"Recipes without a database match: {missing_recipe_count}")
        print(f"Recipes skipped due to ambiguous title matches: {ambiguous_recipe_count}")
        print(f"Skipped existing ingredient rows: {skipped_existing_count}")
        return

    for batch in chunked(ingredient_rows_to_insert, BATCH_SIZE):
        client.table(RECIPE_INGREDIENTS_TABLE).insert(batch).execute()
        print(f"Inserted batch containing {len(batch)} recipe ingredient rows.")

    print(f"Finished inserting {len(ingredient_rows_to_insert)} ingredient rows into '{RECIPE_INGREDIENTS_TABLE}'.")
    print(f"Recipes without a database match: {missing_recipe_count}")
    print(f"Recipes skipped due to ambiguous title matches: {ambiguous_recipe_count}")
    print(f"Skipped existing ingredient rows: {skipped_existing_count}")
    print(f"Input file: {input_path}")


if __name__ == "__main__":
    main()
