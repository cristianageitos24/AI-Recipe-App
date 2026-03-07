#!/usr/bin/env python3
"""Extract recipe metadata from a recipe URL.

Usage:
    ./venv/bin/python recipe-scrape.py "https://example.com/recipe" --pretty
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from numbers import Number
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from recipe_scrapers import scrape_html

try:
    import requests
except Exception:  # pragma: no cover - fallback path
    requests = None


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Extract recipe title, image, instructions, ingredients, and optional "
            "cook time/calories from a URL."
        )
    )
    parser.add_argument("url", help="Recipe URL to scrape")
    parser.add_argument("--timeout", type=float, default=15.0, help="HTTP timeout in seconds")
    parser.add_argument("--retries", type=int, default=2, help="Number of retry attempts")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    return parser.parse_args()


def validate_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URL must be a valid http(s) URL")


def fetch_html(url: str, timeout: float, retries: int) -> str:
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            if requests is not None:
                response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
                response.raise_for_status()
                return response.text

            req = Request(url, headers=DEFAULT_HEADERS)
            with urlopen(req, timeout=timeout) as response:  # nosec B310
                return response.read().decode("utf-8", errors="replace")

        except Exception as exc:  # pragma: no cover - network behavior varies
            last_error = exc
            if attempt < retries:
                # Small linear backoff to smooth out transient network failures.
                time.sleep(0.6 * (attempt + 1))

    raise RuntimeError(f"Failed to fetch URL after {retries + 1} attempt(s): {last_error}")


def safe_call(scraper: Any, method_name: str, default: Any = None) -> Any:
    method = getattr(scraper, method_name, None)
    if method is None:
        return default

    try:
        value = method()
        return default if value in (None, "") else value
    except Exception:
        return default


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        parts = [str(v).strip() for v in value if str(v).strip()]
        return "\n".join(parts) if parts else None

    text = str(value).strip()
    return text or None


def normalize_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [str(value).strip()] if str(value).strip() else []


def parse_calories(nutrients: dict[str, Any] | None) -> str | None:
    if not nutrients:
        return None

    for key in ("calories", "calorieContent", "energy"):
        raw = nutrients.get(key)
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue

        # Return a normalized human-readable calories field.
        match = re.search(r"\d+[\d,.]*", text)
        if match:
            return f"{match.group(0)} kcal"
        return text

    return None


def parse_minutes(value: Any) -> int | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, Number):
        minutes = int(float(value))
        return minutes if minutes >= 0 else None

    text = str(value).strip()
    if not text:
        return None

    upper = text.upper()
    if upper.startswith("PT"):
        hours = re.search(r"(\d+)\s*H", upper)
        mins = re.search(r"(\d+)\s*M", upper)
        secs = re.search(r"(\d+)\s*S", upper)
        days = re.search(r"(\d+)\s*D", upper)
        total = 0
        if days:
            total += int(days.group(1)) * 1440
        if hours:
            total += int(hours.group(1)) * 60
        if mins:
            total += int(mins.group(1))
        if secs and not (hours or mins or days):
            total += 1
        return total if total > 0 else None

    matches = re.findall(r"(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?", text)
    if not matches:
        return None

    total = 0.0
    used_units = False
    for amount_text, unit in matches:
        amount = float(amount_text)
        unit = (unit or "").lower()
        if unit.startswith(("h", "hr")) or "hour" in unit:
            total += amount * 60
            used_units = True
        elif unit.startswith(("m", "min")) or "minute" in unit:
            total += amount
            used_units = True
        elif unit.startswith(("s", "sec")) or "second" in unit:
            total += amount / 60
            used_units = True
        elif unit.startswith(("d", "day")):
            total += amount * 1440
            used_units = True

    if used_units:
        parsed = int(round(total))
        return parsed if parsed >= 0 else None

    if len(matches) == 1:
        parsed = int(float(matches[0][0]))
        return parsed if parsed >= 0 else None

    return None


def collect_time_values(obj: Any, bucket: list[Any]) -> None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            key_l = str(key).lower()
            if "time" in key_l or "duration" in key_l:
                bucket.append(value)
            collect_time_values(value, bucket)
        return

    if isinstance(obj, list):
        for item in obj:
            collect_time_values(item, bucket)


def best_cooktime_minutes(scraper: Any) -> int | None:
    candidates: list[Any] = []

    candidates.extend(
        [
            safe_call(scraper, "cook_time"),
            safe_call(scraper, "prep_time"),
            safe_call(scraper, "total_time"),
        ]
    )

    raw_json = safe_call(scraper, "to_json", default={})
    if isinstance(raw_json, dict):
        collect_time_values(raw_json, candidates)

    schema = getattr(scraper, "schema", None)
    schema_data = getattr(schema, "data", None)
    collect_time_values(schema_data, candidates)

    parsed = [minutes for value in candidates if (minutes := parse_minutes(value)) is not None]
    return max(parsed) if parsed else None


def extract_recipe(url: str, timeout: float, retries: int) -> dict[str, Any]:
    html = fetch_html(url, timeout=timeout, retries=retries)
    try:
        # Newer versions support selecting the best image.
        scraper = scrape_html(html, org_url=url, supported_only=False, best_image=True)
    except TypeError:
        # Backward compatibility for versions without `best_image`.
        scraper = scrape_html(html, org_url=url, supported_only=False)

    instructions_list = normalize_list(safe_call(scraper, "instructions_list", default=[]))
    instructions_text = normalize_text(safe_call(scraper, "instructions"))
    if not instructions_text and instructions_list:
        instructions_text = "\n".join(instructions_list)

    nutrients = safe_call(scraper, "nutrients", default={})
    if not isinstance(nutrients, dict):
        nutrients = {}

    return {
        "source_url": url,
        "title": normalize_text(safe_call(scraper, "title")),
        "image": normalize_text(safe_call(scraper, "image")),
        "ingredients": normalize_list(safe_call(scraper, "ingredients", default=[])),
        "instructions": instructions_text,
        "instructions_list": instructions_list,
        "cooktime_minutes": best_cooktime_minutes(scraper),
        "prep_time_minutes": safe_call(scraper, "prep_time"),
        "total_time_minutes": safe_call(scraper, "total_time"),
        "calories": parse_calories(nutrients),
        "yields": normalize_text(safe_call(scraper, "yields")),
    }


def main() -> int:
    args = parse_args()

    try:
        validate_url(args.url)
        recipe = extract_recipe(args.url, timeout=args.timeout, retries=max(0, args.retries))
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.pretty:
        print(json.dumps(recipe, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(recipe, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
