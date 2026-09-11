from __future__ import annotations

import argparse
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps, ImageStat


MAX_DIMENSION = 1600
TARGET_BYTES = 700 * 1024
QUALITIES = (86, 82, 78, 74)


def normalized_image(path: Path) -> Image.Image:
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
        image = image.convert("RGBA" if has_alpha else "RGB")
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
        return image.copy()


def encode_webp(image: Image.Image) -> tuple[bytes, int]:
    best = b""
    selected_quality = QUALITIES[-1]
    for quality in QUALITIES:
        output = io.BytesIO()
        image.save(output, "WEBP", quality=quality, method=6)
        best = output.getvalue()
        selected_quality = quality
        if len(best) <= TARGET_BYTES:
            break
    return best, selected_quality


def comparison_rgb(image: Image.Image) -> Image.Image:
    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        return background
    return image.convert("RGB")


def psnr(original: Image.Image, converted: Image.Image) -> float:
    first = comparison_rgb(original)
    second = comparison_rgb(converted)
    difference = ImageChops.difference(first, second)
    rms = ImageStat.Stat(difference).rms
    mean_square_error = sum(value * value for value in rms) / len(rms)
    return float("inf") if mean_square_error == 0 else 20 * math.log10(255 / math.sqrt(mean_square_error))


def contact_sheet(rows: list[dict[str, object]], destination: Path) -> None:
    cell_width = 760
    cell_height = 300
    columns = 2
    sheet = Image.new("RGB", (cell_width * columns, cell_height * math.ceil(len(rows) / columns)), "#fff7fa")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, row in enumerate(rows):
        left = (index % columns) * cell_width
        top = (index // columns) * cell_height
        original = comparison_rgb(normalized_image(Path(str(row["source"]))))
        with Image.open(Path(str(row["output"]))) as converted_source:
            converted = comparison_rgb(converted_source.copy())
        original.thumbnail((350, 240), Image.Resampling.LANCZOS)
        converted.thumbnail((350, 240), Image.Resampling.LANCZOS)
        sheet.paste(original, (left + 15, top + 42))
        sheet.paste(converted, (left + 390, top + 42))
        label = f"{row['relative_path']} | {row['before_kb']} KB -> {row['after_kb']} KB | PSNR {row['psnr_db']} dB"
        draw.text((left + 15, top + 15), label, fill="#292126", font=font)
        draw.text((left + 15, top + 282), "ORIGINAL", fill="#e91e63", font=font)
        draw.text((left + 390, top + 282), "WEBP", fill="#e91e63", font=font)

    sheet.save(destination, "JPEG", quality=92)


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare PNG Storage images as reviewable WebP files.")
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    args.destination.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, object]] = []
    for source_path in sorted(args.source.rglob("*.png")):
        relative_path = source_path.relative_to(args.source)
        output_path = args.destination / relative_path.with_suffix(".webp")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        original = normalized_image(source_path)
        webp, quality = encode_webp(original)
        output_path.write_bytes(webp)
        with Image.open(io.BytesIO(webp)) as converted_source:
            converted = converted_source.copy()
        rows.append({
            "relative_path": relative_path.as_posix(),
            "source": str(source_path.resolve()),
            "output": str(output_path.resolve()),
            "width": original.width,
            "height": original.height,
            "before_bytes": source_path.stat().st_size,
            "after_bytes": len(webp),
            "before_kb": round(source_path.stat().st_size / 1024),
            "after_kb": round(len(webp) / 1024),
            "quality": quality,
            "psnr_db": round(psnr(original, converted), 2),
        })

    manifest_path = args.destination / "manifest.json"
    manifest_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    contact_sheet(rows, args.destination / "comparison.jpg")
    before_total = sum(int(row["before_bytes"]) for row in rows)
    after_total = sum(int(row["after_bytes"]) for row in rows)
    reduction = round((1 - after_total / before_total) * 100, 1) if before_total else 0
    print(json.dumps({"files": len(rows), "before_bytes": before_total, "after_bytes": after_total, "reduction_percent": reduction}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
