import json
import re
import time
from typing import Any

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "ArrowBerryRecipeResearchBot/0.1 (educational project; respectful rate limiting)"
}


def polite_get(url: str, delay: float = 2.0) -> requests.Response:
    time.sleep(delay)
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned or None


# --- new helper functions for slug/url-title matching ---
def slugify_for_match(value: str | None) -> str:
    text = clean_text(value)
    if not text:
        return ""

    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def title_matches_url(url: str, title: str | None) -> bool:
    slug = url.rstrip("/").split("/")[-1].lower()
    normalized_title = slugify_for_match(title)

    if not slug or not normalized_title:
        return False

    if slug == normalized_title:
        return True

    slug_tokens = {token for token in slug.split("-") if token}
    title_tokens = {token for token in normalized_title.split("-") if token}

    if not slug_tokens or not title_tokens:
        return False

    overlap = len(slug_tokens & title_tokens)
    required_overlap = max(2, min(len(slug_tokens), len(title_tokens)) - 1)
    return overlap >= required_overlap


def extract_minutes(value: str | None) -> str | None:
    text = clean_text(value)
    if not text:
        return None

    match = re.search(r"(\d+)", text)
    return match.group(1) if match else text


def extract_json_ld_recipe(soup: BeautifulSoup) -> dict[str, Any] | None:
    for script in soup.select("script[type='application/ld+json']"):
        raw = script.string or script.get_text(strip=True)
        if not raw:
            continue

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        candidates = data if isinstance(data, list) else [data]

        for item in candidates:
            if isinstance(item, dict):
                if item.get("@type") == "Recipe":
                    return item
                if "@graph" in item and isinstance(item["@graph"], list):
                    for sub in item["@graph"]:
                        if isinstance(sub, dict) and sub.get("@type") == "Recipe":
                            return sub
    return None


def parse_wprm_print_recipe(url: str, soup: BeautifulSoup) -> dict[str, Any] | None:
    title = clean_text(
        (soup.select_one(".wprm-recipe-name") or soup.select_one("h2") or soup.select_one("h1")).get_text(" ", strip=True)
        if (soup.select_one(".wprm-recipe-name") or soup.select_one("h2") or soup.select_one("h1"))
        else None
    )

    description_el = (
        soup.select_one(".wprm-recipe-summary")
        or soup.select_one(".wprm-recipe-description")
        or soup.select_one(".wprm-recipe-details")
    )
    description = clean_text(description_el.get_text(" ", strip=True) if description_el else None)

    author_el = soup.select_one(".wprm-recipe-author")
    author = clean_text(author_el.get_text(" ", strip=True) if author_el else None)

    servings_el = soup.select_one(".wprm-recipe-servings")
    recipe_yield = clean_text(servings_el.get_text(" ", strip=True) if servings_el else None)

    prep_time_el = (
        soup.select_one(".wprm-recipe-prep_time")
        or soup.select_one(".wprm-recipe-prep-time")
    )
    cook_time_el = (
        soup.select_one(".wprm-recipe-cook_time")
        or soup.select_one(".wprm-recipe-cook-time")
    )
    total_time_el = (
        soup.select_one(".wprm-recipe-total_time")
        or soup.select_one(".wprm-recipe-total-time")
    )

    image_el = soup.select_one(".wprm-recipe-image img") or soup.select_one("img")
    image_url = image_el.get("src") if image_el else None

    ingredient_els = soup.select(
        ".wprm-recipe-ingredient, .wprm-recipe-ingredient-text, .wprm-recipe-ingredients li"
    )
    ingredients = []
    for ingredient in ingredient_els:
        text = clean_text(ingredient.get_text(" ", strip=True))
        if text:
            ingredients.append(text)

    instruction_els = soup.select(
        ".wprm-recipe-instruction-text, .wprm-recipe-instructions li, .wprm-recipe-instruction"
    )
    instructions = []
    for step in instruction_els:
        text = clean_text(step.get_text(" ", strip=True))
        if text:
            instructions.append(text)

    if not title:
        return None

    if not title_matches_url(url, title):
        print(f"  skipped title/url mismatch: {url} -> {title}")
        return None

    return {
        "source_url": url,
        "title": title,
        "description": description,
        "image": image_url,
        "prep_time": extract_minutes(prep_time_el.get_text(" ", strip=True) if prep_time_el else None),
        "cook_time": extract_minutes(cook_time_el.get_text(" ", strip=True) if cook_time_el else None),
        "total_time": extract_minutes(total_time_el.get_text(" ", strip=True) if total_time_el else None),
        "yield": recipe_yield,
        "category": None,
        "cuisine": None,
        "ingredients": ingredients,
        "instructions": instructions,
        "author": author,
    }


def normalize_recipe(url: str, recipe: dict[str, Any]) -> dict[str, Any]:
    instructions = recipe.get("recipeInstructions", [])
    steps = []

    if isinstance(instructions, list):
        for entry in instructions:
            if isinstance(entry, str):
                text = clean_text(entry)
                if text:
                    steps.append(text)
            elif isinstance(entry, dict):
                text = clean_text(entry.get("text"))
                if text:
                    steps.append(text)
    elif isinstance(instructions, str):
        text = clean_text(instructions)
        if text:
            steps.append(text)

    ingredients = []
    for ingredient in recipe.get("recipeIngredient", []) or []:
        text = clean_text(ingredient)
        if text:
            ingredients.append(text)

    image_value = recipe.get("image")
    if isinstance(image_value, list):
        image_value = image_value[0] if image_value else None
    elif isinstance(image_value, dict):
        image_value = image_value.get("url")

    author_value = recipe.get("author")
    if isinstance(author_value, list) and author_value:
        first_author = author_value[0]
        if isinstance(first_author, dict):
            author_value = first_author.get("name")
        else:
            author_value = str(first_author)
    elif isinstance(author_value, dict):
        author_value = author_value.get("name")

    normalized = {
        "source_url": url,
        "title": clean_text(recipe.get("name")),
        "description": clean_text(recipe.get("description")),
        "image": clean_text(image_value),
        "prep_time": clean_text(recipe.get("prepTime")),
        "cook_time": clean_text(recipe.get("cookTime")),
        "total_time": clean_text(recipe.get("totalTime")),
        "yield": clean_text(recipe.get("recipeYield")),
        "category": clean_text(recipe.get("recipeCategory")),
        "cuisine": clean_text(recipe.get("recipeCuisine")),
        "ingredients": ingredients,
        "instructions": steps,
        "author": clean_text(author_value),
    }

    if not title_matches_url(url, normalized["title"]):
        print(f"  skipped title/url mismatch: {url} -> {normalized['title']}")
        return None

    return normalized


def scrape_recipe(url: str) -> dict[str, Any] | None:
    print(f"[recipe] {url}")
    resp = polite_get(url)
    soup = BeautifulSoup(resp.text, "lxml")

    print_recipe = parse_wprm_print_recipe(url, soup)
    if print_recipe is not None:
        return print_recipe

    recipe = extract_json_ld_recipe(soup)
    if recipe is None:
        print(f"  no recipe content found: {url}")
        return None

    return normalize_recipe(url, recipe)


def main():
    with open("discovered_print_urls.json", "r", encoding="utf-8") as f:
        urls = json.load(f)

    with open("recipes.jsonl", "a", encoding="utf-8") as out:
        for url in urls:
            try:
                recipe = scrape_recipe(url)
                if recipe is not None:
                    out.write(json.dumps(recipe, ensure_ascii=False) + "\n")
                    out.flush()
            except Exception as e:
                print(f"  failed: {url} -> {e}")


if __name__ == "__main__":
    main()