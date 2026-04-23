

import argparse
import json
from urllib.parse import urlparse


def to_wprm_print_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.netloc not in ("natashaskitchen.com", "www.natashaskitchen.com"):
        raise ValueError(f"Unsupported domain for print conversion: {url}")

    slug = parsed.path.strip("/")
    if not slug:
        raise ValueError(f"Cannot convert homepage URL to print view: {url}")

    if slug.startswith("wprm_print/"):
        return f"https://natashaskitchen.com/{slug.rstrip('/')}/"

    return f"https://natashaskitchen.com/wprm_print/{slug.rstrip('/')}/"



def build_print_url_file(input_path: str, output_path: str) -> None:
    with open(input_path, "r", encoding="utf-8") as f:
        urls = json.load(f)

    if not isinstance(urls, list):
        raise ValueError("Input JSON file must contain a list of URLs.")

    print_urls = []
    for url in urls:
        if not isinstance(url, str):
            print(f"[skip] Non-string entry: {url}")
            continue

        try:
            print_urls.append(to_wprm_print_url(url))
        except ValueError as e:
            print(f"[skip] {e}")

    unique_urls = sorted(set(print_urls))

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(unique_urls, f, indent=2)

    print(f"Saved {len(unique_urls)} print URLs to {output_path}")



def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert Natasha's Kitchen recipe URLs into wprm_print URLs."
    )
    parser.add_argument(
        "--input",
        default="discovered_urls.json",
        help="Input JSON file containing a list of recipe URLs",
    )
    parser.add_argument(
        "--output",
        default="discovered_print_urls.json",
        help="Output JSON file for converted print URLs",
    )
    args = parser.parse_args()

    build_print_url_file(args.input, args.output)


if __name__ == "__main__":
    main()