import json
import re
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://natashaskitchen.com"
HEADERS = {
    "User-Agent": "ArrowBerryRecipeResearchBot/0.1 (educational project; respectful rate limiting)"
}

RECIPE_PATH_RE = re.compile(r"^/[a-z0-9-]+/?$")

def polite_get(url: str, delay: float = .4) -> requests.Response:
    time.sleep(delay)
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp

def is_recipe_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.netloc not in ("natashaskitchen.com", "www.natashaskitchen.com"):
        return False

    path = parsed.path.rstrip("/") + "/"

    # Reject obvious non-recipe sections.
    blocked_prefixes = (
        "/category/",
        "/about/",
        "/contact/",
        "/privacy-policy/",
        "/shop/",
        "/amazon/",
        "/cookbook/",
        "/videos/",
        "/meal-plans/",
        "/newsletter/",
        "/wp-",
        "/tag/",
    )
    if any(path.startswith(prefix) for prefix in blocked_prefixes):
        return False

    return bool(RECIPE_PATH_RE.match(parsed.path.rstrip("/")))

def extract_recipe_links(html: str, page_url: str) -> set[str]:
    soup = BeautifulSoup(html, "lxml")
    found = set()

    for a in soup.select("a[href]"):
        href = a.get("href", "").strip()
        absolute = urljoin(page_url, href)
        if is_recipe_url(absolute):
            found.add(absolute.rstrip("/") + "/")

    return found

def find_next_page(html: str, page_url: str) -> str | None:
    soup = BeautifulSoup(html, "lxml")

    # Common "next" patterns
    selectors = [
        "a.next.page-numbers",
        "a[rel='next']",
        ".pagination a.next",
    ]
    for sel in selectors:
        el = soup.select_one(sel)
        if el and el.get("href"):
            return urljoin(page_url, el["href"])

    return None

def crawl_category(start_url: str, max_pages: int = 20) -> list[str]:
    seen_pages = set()
    recipe_urls = set()
    url = start_url
    pages = 0

    while url and url not in seen_pages and pages < max_pages:
        print(f"[category] {url}")
        seen_pages.add(url)
        resp = polite_get(url)
        html = resp.text

        recipe_urls |= extract_recipe_links(html, url)
        url = find_next_page(html, url)
        pages += 1

    return sorted(recipe_urls)

def main():
    with open("urls.txt", "r", encoding="utf-8") as f:
        category_urls = [line.strip() for line in f if line.strip()]

    all_recipes = set()
    for category_url in category_urls:
        all_recipes |= set(crawl_category(category_url))

    with open("discovered_urls.json", "w", encoding="utf-8") as f:
        json.dump(sorted(all_recipes), f, indent=2)

    print(f"Saved {len(all_recipes)} recipe URLs")

if __name__ == "__main__":
    main()