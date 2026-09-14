from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

THUMB_EDGE = 400
DISPLAY_EDGE = 1600
WEBP_QUALITY = 80


class ImageProcessError(Exception):
    pass


def _save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="WEBP", quality=WEBP_QUALITY, method=6)


def _fit(image: Image.Image, max_edge: int) -> Image.Image:
    clone = image.copy()
    clone.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return clone


def _prepared(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image) or image
    if image.mode in {"RGBA", "P"}:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (12, 12, 12))
        background.paste(rgba, mask=rgba.split()[-1] if "A" in rgba.getbands() else None)
        return background
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def process_image(input_path: Path, output_dir: Path, *, make_display: bool = True) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(input_path) as raw:
            image = _prepared(raw)
            image.load()
    except Exception as exc:
        raise ImageProcessError(str(exc) or "Could not read image") from exc

    outputs = {"thumb": output_dir / "thumb.webp"}
    _save_webp(_fit(image, THUMB_EDGE), outputs["thumb"])
    if make_display:
        outputs["display"] = output_dir / "display.webp"
        _save_webp(_fit(image, DISPLAY_EDGE), outputs["display"])
    return outputs
