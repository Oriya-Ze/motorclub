from app.services.image_moderation import ScanLabel, combine, decide
from app.services.image_moderation import ScanDecision


def test_clean_image_is_approved():
    result = decide([])
    assert result.decision == "approved"


def test_high_confidence_violence_is_rejected():
    result = decide([ScanLabel("Violence", "Violence", 95)])
    assert result.decision == "rejected"


def test_borderline_label_needs_review():
    result = decide([ScanLabel("Suggestive", "Suggestive", 82)])
    assert result.decision == "needs_review"


def test_service_error_is_not_approval():
    assert combine([ScanDecision("error", [], None, error_message="timeout")]) == "error"


def _jpeg_bytes(width: int, height: int, color=(20, 120, 40)) -> bytes:
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def test_aws_permission_failure_is_not_retried(monkeypatch):
    from app.config import settings
    from app.services.image_moderation import scan_bytes
    from botocore.exceptions import ClientError

    monkeypatch.setattr(settings, "rekognition_mode", "aws")
    monkeypatch.setattr(settings, "aws_region", "eu-central-1")
    attempts = {"count": 0}

    class Denied:
        def detect_moderation_labels(self, **kwargs):
            attempts["count"] += 1
            raise ClientError(
                {"Error": {"Code": "AccessDeniedException", "Message": "not authorized"}},
                "DetectModerationLabels",
            )

    monkeypatch.setattr("boto3.client", lambda *args, **kwargs: Denied())
    monkeypatch.setattr("time.sleep", lambda _seconds: None)
    result = scan_bytes(_jpeg_bytes(80, 80))
    assert attempts["count"] == 1
    assert result.decision == "error"
    assert "AccessDeniedException" in (result.error_message or "")


def test_throttling_is_retried(monkeypatch):
    from app.config import settings
    from app.services.image_moderation import scan_bytes
    from botocore.exceptions import ClientError

    monkeypatch.setattr(settings, "rekognition_mode", "aws")
    attempts = {"count": 0}

    class Throttled:
        def detect_moderation_labels(self, **kwargs):
            attempts["count"] += 1
            raise ClientError(
                {"Error": {"Code": "ThrottlingException", "Message": "slow down"}},
                "DetectModerationLabels",
            )

    monkeypatch.setattr("boto3.client", lambda *args, **kwargs: Throttled())
    monkeypatch.setattr("time.sleep", lambda _seconds: None)
    result = scan_bytes(_jpeg_bytes(80, 80))
    assert attempts["count"] == 3
    assert result.decision == "error"


def test_corrupt_file_is_not_sent_to_rekognition(monkeypatch):
    from app.config import settings
    from app.services.image_moderation import scan_bytes

    monkeypatch.setattr(settings, "rekognition_mode", "aws")
    calls = {"count": 0}
    monkeypatch.setattr(
        "boto3.client",
        lambda *args, **kwargs: calls.__setitem__("count", calls["count"] + 1),
    )
    result = scan_bytes(b"this is not an image")
    assert result.decision == "error"
    assert result.error_message == "image_unreadable"
    assert calls["count"] == 0


def test_webp_is_converted_to_jpeg_without_cropping():
    from io import BytesIO

    from PIL import Image, features

    from app.services.image_moderation import prepare_image_for_scan

    assert features.check("webp")
    source = Image.new("RGB", (320, 180), (10, 20, 200))
    raw = BytesIO()
    source.save(raw, format="WEBP", quality=80)
    converted = prepare_image_for_scan(raw.getvalue())
    assert converted[:2] == b"\xff\xd8"
    with Image.open(BytesIO(converted)) as decoded:
        assert decoded.size == (320, 180)
        assert decoded.format == "JPEG"


def test_transparent_webp_keeps_visible_pixels_on_white():
    from io import BytesIO

    from PIL import Image

    from app.services.image_moderation import prepare_image_for_scan

    image = Image.new("RGBA", (90, 90), (0, 0, 0, 0))
    for x in range(20, 50):
        for y in range(20, 50):
            image.putpixel((x, y), (200, 10, 10, 255))
    raw = BytesIO()
    image.save(raw, format="WEBP")
    converted = prepare_image_for_scan(raw.getvalue())
    with Image.open(BytesIO(converted)) as decoded:
        assert decoded.getpixel((0, 0)) == (255, 255, 255)
        assert decoded.getpixel((30, 30))[0] > 150


def test_exif_orientation_is_applied_without_cropping():
    from io import BytesIO

    from PIL import Image

    from app.services.image_moderation import prepare_image_for_scan

    image = Image.new("RGB", (120, 40), (255, 0, 0))
    exif = image.getexif()
    exif[274] = 6
    raw = BytesIO()
    image.save(raw, format="JPEG", exif=exif)
    converted = prepare_image_for_scan(raw.getvalue())
    with Image.open(BytesIO(converted)) as decoded:
        assert decoded.size == (80, 240)
        assert decoded.size[1] / decoded.size[0] == 3


def test_large_image_is_scaled_down_without_cropping(monkeypatch):
    from io import BytesIO

    from PIL import Image

    from app.services import image_moderation

    monkeypatch.setattr(image_moderation, "REKOGNITION_MAX_EDGE", 100)
    monkeypatch.setattr(image_moderation, "REKOGNITION_MIN_EDGE", 40)
    raw = BytesIO()
    Image.new("RGB", (400, 200), (1, 2, 3)).save(raw, format="WEBP")
    converted = image_moderation.prepare_image_for_scan(raw.getvalue())
    with Image.open(BytesIO(converted)) as decoded:
        assert decoded.size == (100, 50)
        assert max(decoded.size) <= 100


def test_animated_webp_is_rejected_and_not_scanned(monkeypatch):
    from io import BytesIO

    from PIL import Image

    from app.config import settings
    from app.services.image_moderation import scan_bytes

    frames = [Image.new("RGB", (90, 90), color) for color in ((255, 0, 0), (0, 255, 0))]
    raw = BytesIO()
    frames[0].save(raw, format="WEBP", save_all=True, append_images=frames[1:], duration=100, loop=0)
    monkeypatch.setattr(settings, "rekognition_mode", "aws")
    calls = {"count": 0}
    monkeypatch.setattr("boto3.client", lambda *args, **kwargs: calls.__setitem__("count", calls["count"] + 1))
    result = scan_bytes(raw.getvalue())
    assert result.decision == "rejected"
    assert result.error_message == "animation_not_supported"
    assert calls["count"] == 0


def test_extreme_aspect_ratio_is_not_cropped(monkeypatch):
    from io import BytesIO

    from PIL import Image

    from app.services import image_moderation

    monkeypatch.setattr(image_moderation, "REKOGNITION_MAX_EDGE", 200)
    monkeypatch.setattr(image_moderation, "REKOGNITION_MIN_EDGE", 80)
    raw = BytesIO()
    Image.new("RGB", (1000, 10), (4, 5, 6)).save(raw, format="PNG")
    try:
        image_moderation.prepare_image_for_scan(raw.getvalue())
    except image_moderation.ImagePrepError as exc:
        assert exc.reason == "image_dimensions_unsupported"
    else:
        raise AssertionError("expected the thin image to be rejected instead of cropped")


def test_rejected_wins_over_review():
    assert combine([
        ScanDecision("needs_review", [], None),
        ScanDecision("rejected", [], None),
    ]) == "rejected"
