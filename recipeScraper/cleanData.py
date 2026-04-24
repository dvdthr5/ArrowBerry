from __future__ import annotations

import argparse
import os
import re
from pathlib import Path
from typing import Any

from supabase import Client, create_client


REPO_ROOT = Path(__file__).resolve().parents[1]
RECIPE_INGREDIENTS_TABLE = "recipe_ingredients"
FETCH_BATCH_SIZE = 1000
WRITE_BATCH_SIZE = 200

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

LEADING_DESCRIPTOR_TERMS = {
    "chopped", "diced", "minced", "sliced", "cubed", "peeled", "grated",
    "shredded", "softened", "melted", "beaten", "whisked", "crushed",
    "drained", "rinsed", "halved", "quartered", "trimmed", "divided",
    "room-temperature", "room", "temperature", "large", "medium", "small",
    "extra-large", "extra", "thinly", "thickly", "roughly", "finely", "coarsely",
    "toasted", "boneless", "skinless", "optional",
    "packed", "unsalted", "salted", "warm", "cold", "crumbled", "hulled",
}

TRAILING_NOTE_PATTERNS = [
    re.compile(r",\s*.*$", re.IGNORECASE),
]

QUANTITY_TOKEN_RE = re.compile(r"^(?:\d+(?:\.\d+)?|\d+/\d+)$")
APPROXIMATION_WORDS = {"about", "approximately", "approx", "around", "roughly"}
UNICODE_FRACTIONS = {
    "¼": "1/4",
    "½": "1/2",
    "¾": "3/4",
    "⅐": "1/7",
    "⅑": "1/9",
    "⅒": "1/10",
    "⅓": "1/3",
    "⅔": "2/3",
    "⅕": "1/5",
    "⅖": "2/5",
    "⅗": "3/5",
    "⅘": "4/5",
    "⅙": "1/6",
    "⅚": "5/6",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
}
AND_SPLIT_EXCEPTIONS = {
    "mac and cheese",
    "half and half",
    "fish and chips seasoning",
    "salt and vinegar seasoning",
    "salt and pepper",
    "salt and black pepper",
    "chicken thighs and legs",
}


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


def normalize_unit(value: str | None) -> str | None:
    cleaned = clean_text(value)
    if not cleaned:
        return None
    return cleaned.lower().replace(".", "")


def expand_unicode_fractions(text: str) -> str:
    expanded = text
    for fraction, replacement in UNICODE_FRACTIONS.items():
        expanded = expanded.replace(fraction, replacement)
    return expanded


def strip_trailing_notes(text: str) -> str:
    stripped = text
    while True:
        matched = False
        for pattern in TRAILING_NOTE_PATTERNS:
            match = pattern.search(stripped)
            if not match:
                continue
            stripped = stripped[:match.start()].rstrip(" ,")
            matched = True
            break
        if not matched:
            break
    return stripped

def strip_or_alternatives(text: str) -> str:
    cleaned = clean_text(text) or ""
    if not cleaned:
        return ""

    stripped = re.split(r"\s+or\s+", cleaned, maxsplit=1, flags=re.IGNORECASE)[0]
    return clean_text(stripped) or cleaned

def canonical_and_exception_key(text: str) -> str | None:
    cleaned = clean_text(text)
    if not cleaned:
        return None

    cleaned = strip_trailing_notes(cleaned)
    cleaned = strip_or_alternatives(cleaned)
    cleaned = re.sub(r"\s*\([^)]*\)", "", cleaned)
    cleaned = re.sub(r"^[^A-Za-z]+", "", cleaned)
    cleaned = re.sub(r"[^A-Za-z\s-]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return normalize_key(cleaned)


def strip_leading_descriptors(text: str) -> str:
    words = text.split()
    ingredient_start = 0

    for index, word in enumerate(words):
        normalized_word = word.lower().strip(",")
        if normalized_word in LEADING_DESCRIPTOR_TERMS:
            ingredient_start = index + 1
            continue
        break

    remaining = " ".join(words[ingredient_start:])
    return clean_text(remaining) or (clean_text(text) or "")


def strip_embedded_measurement_prefix(text: str) -> str:
    cleaned = clean_text(text) or ""
    if not cleaned:
        return ""

    words = cleaned.split()
    index = 0

    while index < len(words) and words[index].lower().strip(",") in APPROXIMATION_WORDS:
        index += 1

    measurement_index = index
    quantity_tokens: list[str] = []

    while measurement_index < len(words):
        candidate = words[measurement_index].lower().strip(",")
        if QUANTITY_TOKEN_RE.match(candidate):
            quantity_tokens.append(words[measurement_index])
            measurement_index += 1
            continue
        break

    if not quantity_tokens:
        return cleaned

    unit_word_count = 0
    if measurement_index + 1 < len(words):
        two_word_unit = normalize_unit(" ".join(words[measurement_index:measurement_index + 2]))
        if two_word_unit in KNOWN_UNITS:
            unit_word_count = 2

    if unit_word_count == 0 and measurement_index < len(words):
        one_word_unit = normalize_unit(words[measurement_index])
        if one_word_unit in KNOWN_UNITS:
            unit_word_count = 1

    if unit_word_count == 0:
        return cleaned

    remaining_words = words[measurement_index + unit_word_count:]
    remaining = clean_text(" ".join(remaining_words))
    return remaining or cleaned


def split_on_and(text: str) -> list[str]:
    cleaned = clean_text(text) or ""
    cleaned = strip_trailing_notes(cleaned)
    cleaned = strip_or_alternatives(cleaned)
    normalized = normalize_key(cleaned)
    canonical_exception = canonical_and_exception_key(cleaned)
    if not cleaned or not normalized:
        return [cleaned] if cleaned else []

    if normalized in AND_SPLIT_EXCEPTIONS or canonical_exception in AND_SPLIT_EXCEPTIONS:
        return [cleaned] if cleaned else []
    if "," in text:
        return [cleaned] if cleaned else []

    explicit_match = re.match(r"^(salt)\s+and\s+(.+)$", cleaned, flags=re.IGNORECASE)
    if explicit_match:
        return [explicit_match.group(1), explicit_match.group(2)]

    seasoning_match = re.match(r"^(.+?)\s+and\s+(.+)$", cleaned, flags=re.IGNORECASE)
    if not seasoning_match:
        return [cleaned]

    left = clean_text(seasoning_match.group(1))
    right = clean_text(seasoning_match.group(2))
    if not left or not right:
        return [cleaned]

    left_has_quantity = bool(QUANTITY_TOKEN_RE.match(left.split()[0].lower())) if left.split() else False
    right_has_quantity = bool(QUANTITY_TOKEN_RE.match(right.split()[0].lower())) if right.split() else False
    left_words = left.split()
    right_words = right.split()

    if left_has_quantity or right_has_quantity:
        return [left, right]

    if len(left_words) <= 2 and len(right_words) <= 3 and normalized.startswith("salt and"):
        return [left, right]

    return [cleaned]


def parse_quantity_unit_name(text: str) -> tuple[str | None, str | None, str]:
    cleaned = clean_text(expand_unicode_fractions(text)) or ""
    if not cleaned:
        return None, None, ""

    cleaned = re.sub(r"^\s*[-•*]+\s*", "", cleaned)
    cleaned = re.sub(r"\s*\([^)]*\)", "", cleaned)
    cleaned = strip_trailing_notes(cleaned)
    cleaned = strip_or_alternatives(cleaned)
    cleaned = cleaned.replace(",", "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    words = cleaned.split()
    if not words:
        return None, None, ""

    quantity_tokens: list[str] = []
    index = 0

    while index < len(words):
        candidate = words[index].lower()
        if QUANTITY_TOKEN_RE.match(candidate):
            quantity_tokens.append(words[index])
            index += 1
            continue
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

    ingredient_name = clean_text(" ".join(remaining_words)) or cleaned
    ingredient_name = strip_embedded_measurement_prefix(ingredient_name)
    ingredient_name = strip_leading_descriptors(ingredient_name)
    ingredient_name = re.sub(r"^[^A-Za-z]+", "", ingredient_name)
    ingredient_name = re.sub(r"[^A-Za-z\s-]+", "", ingredient_name)
    ingredient_name = re.sub(r"\s+", " ", ingredient_name).strip()
    ingredient_name = re.sub(r"[^A-Za-z]+$", "", ingredient_name)
    ingredient_name = clean_text(ingredient_name) or ""
    return quantity, unit, ingredient_name


def transform_row(row: dict[str, Any]) -> list[dict[str, Any]]:
    quantity = clean_text(row.get("quantity"))
    unit = clean_text(row.get("unit"))
    ingredient_name = clean_text(row.get("ingredient_name")) or ""

    combined_text = " ".join(part for part in [quantity, unit, ingredient_name] if part)
    combined_text = clean_text(combined_text) or ingredient_name
    fragments = split_on_and(combined_text)

    transformed: list[dict[str, Any]] = []
    seen: set[tuple[str | None, str | None, str]] = set()

    for fragment in fragments:
        parsed_quantity, parsed_unit, parsed_name = parse_quantity_unit_name(fragment)
        if not parsed_name:
            continue

        key = (
            clean_text(parsed_quantity),
            normalize_unit(parsed_unit),
            normalize_key(parsed_name) or "",
        )
        if key in seen:
            continue
        seen.add(key)

        transformed.append(
            {
                "recipe_id": row.get("recipe_id"),
                "is_core_ingredient": row.get("is_core_ingredient", True),
                "quantity": clean_text(parsed_quantity),
                "unit": normalize_unit(parsed_unit),
                "ingredient_name": parsed_name,
            }
        )

    return transformed


def fetch_all_rows(client: Client) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        response = (
            client.table(RECIPE_INGREDIENTS_TABLE)
            .select("id, recipe_id, ingredient_name, quantity, unit, is_core_ingredient")
            .range(offset, offset + FETCH_BATCH_SIZE - 1)
            .execute()
        )
        batch = response.data or []
        if not batch:
            break

        rows.extend(batch)
        if len(batch) < FETCH_BATCH_SIZE:
            break

        offset += FETCH_BATCH_SIZE

    return rows


def apply_changes(client: Client, operations: list[dict[str, Any]]) -> None:
    for operation in operations:
        row_id = operation["row_id"]
        primary_row = operation["primary_row"]
        additional_rows = operation["additional_rows"]

        client.table(RECIPE_INGREDIENTS_TABLE).update(primary_row).eq("id", row_id).execute()

        if additional_rows:
            for start in range(0, len(additional_rows), WRITE_BATCH_SIZE):
                batch = additional_rows[start:start + WRITE_BATCH_SIZE]
                client.table(RECIPE_INGREDIENTS_TABLE).insert(batch).execute()


def rows_equal(existing: dict[str, Any], transformed: dict[str, Any]) -> bool:
    return (
        clean_text(existing.get("quantity")) == clean_text(transformed.get("quantity"))
        and normalize_unit(existing.get("unit")) == normalize_unit(transformed.get("unit"))
        and normalize_key(existing.get("ingredient_name")) == normalize_key(transformed.get("ingredient_name"))
    )


def build_operations(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    operations: list[dict[str, Any]] = []
    split_rows_created = 0

    for row in rows:
        transformed_rows = transform_row(row)
        if canonical_and_exception_key(clean_text(row.get("ingredient_name"))) == "half and half":
            transformed_rows = [
                {
                    "recipe_id": row.get("recipe_id"),
                    "is_core_ingredient": row.get("is_core_ingredient", True),
                    "quantity": clean_text(row.get("quantity")),
                    "unit": normalize_unit(row.get("unit")),
                    "ingredient_name": "half and half",
                }
            ]
        if not transformed_rows:
            continue

        primary_row = transformed_rows[0]
        additional_rows = transformed_rows[1:]
        if rows_equal(row, primary_row) and not additional_rows:
            continue

        split_rows_created += len(additional_rows)
        operations.append(
            {
                "row_id": row["id"],
                "primary_row": primary_row,
                "additional_rows": additional_rows,
                "before": {
                    "quantity": clean_text(row.get("quantity")),
                    "unit": normalize_unit(row.get("unit")),
                    "ingredient_name": clean_text(row.get("ingredient_name")),
                },
            }
        )

    return operations, split_rows_created


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean ingredient rows in recipe_ingredients.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to Supabase. Without this flag the script runs in preview mode.",
    )
    parser.add_argument(
        "--preview-count",
        type=int,
        default=20,
        help="How many changed rows to preview.",
    )
    args = parser.parse_args()

    client = create_supabase_client()
    rows = fetch_all_rows(client)
    operations, split_rows_created = build_operations(rows)

    print(f"Scanned rows: {len(rows)}")
    print(f"Rows that would be updated: {len(operations)}")
    print(f"Additional rows that would be created from splits: {split_rows_created}")

    preview_limit = max(args.preview_count, 0)
    for operation in operations[:preview_limit]:
        print("---")
        print(f"Row id: {operation['row_id']}")
        print(f"Before: {operation['before']}")
        print(f"After: {operation['primary_row']}")
        if operation["additional_rows"]:
            print(f"Extra rows: {operation['additional_rows']}")

    if not args.apply:
        print("Preview only. Re-run with --apply to write changes.")
        return

    apply_changes(client, operations)
    print("Applied ingredient cleaning changes.")


if __name__ == "__main__":
    main()