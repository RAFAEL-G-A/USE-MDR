from __future__ import annotations

import io
import json
import os
import sys
import uuid
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageOps


SUPABASE_URL = os.environ.get("MIGRATION_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("MIGRATION_SUPABASE_SERVICE_KEY", "")
MAX_DIMENSION = 1600
TARGET_BYTES = 700 * 1024


def request(method: str, url: str, *, headers=None, data=None, json_body=None):
    headers = dict(headers or {})
    headers.update({"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"})
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request_value = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request_value, timeout=60) as response:
            return response.read()
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail}") from error


def download(url: str) -> bytes:
    with urlopen(url, timeout=60) as response:
        return response.read()


def storage_path_from_url(image_url: str) -> str | None:
    marker = "/storage/v1/object/public/products/"
    parsed = urlparse(image_url)
    if marker not in parsed.path:
        return None
    return unquote(parsed.path.split(marker, 1)[1])


def convert_to_webp(content: bytes) -> tuple[bytes, int, int]:
    with Image.open(io.BytesIO(content)) as source:
        image = ImageOps.exif_transpose(source)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
        best = b""
        for quality in (82, 74, 68):
            output = io.BytesIO()
            image.save(output, "WEBP", quality=quality, method=6)
            best = output.getvalue()
            if len(best) <= TARGET_BYTES:
                break
        return best, image.width, image.height


def main() -> int:
    if not SUPABASE_URL or not SERVICE_KEY:
        print("Migração não configurada.", file=sys.stderr)
        return 2

    products = json.loads(request(
        "GET",
        f"{SUPABASE_URL}/rest/v1/products?select=id,name,image_url&order=created_at.asc",
    ))
    converted = 0
    original_total = 0
    webp_total = 0

    for product in products:
        image_url = product.get("image_url") or ""
        old_path = storage_path_from_url(image_url)
        if not old_path or old_path.lower().endswith(".webp"):
            continue

        source_content = download(image_url)
        webp_content, width, height = convert_to_webp(source_content)
        new_path = f"catalog/{uuid.uuid4()}.webp"

        request(
            "POST",
            f"{SUPABASE_URL}/storage/v1/object/products/{quote(new_path, safe='/')}",
            headers={"Content-Type": "image/webp", "Cache-Control": "31536000", "x-upsert": "false"},
            data=webp_content,
        )
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/products/{new_path}"
        try:
            request(
                "PATCH",
                f"{SUPABASE_URL}/rest/v1/products?id=eq.{quote(str(product['id']), safe='')}",
                headers={"Content-Type": "application/json", "Prefer": "return=minimal"},
                json_body={"image_url": public_url},
            )
        except Exception:
            request("DELETE", f"{SUPABASE_URL}/storage/v1/object/products/{quote(new_path, safe='/')}")
            raise

        request("DELETE", f"{SUPABASE_URL}/storage/v1/object/products/{quote(old_path, safe='/')}")
        converted += 1
        original_total += len(source_content)
        webp_total += len(webp_content)
        print(f"Produto {product['id']}: {len(source_content) // 1024} KB -> {len(webp_content) // 1024} KB ({width}x{height})")

    reduction = round((1 - webp_total / original_total) * 100) if original_total else 0
    print(f"Convertidas: {converted}; antes: {original_total // 1024} KB; depois: {webp_total // 1024} KB; redução: {reduction}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
