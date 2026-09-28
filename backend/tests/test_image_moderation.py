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


def test_aws_permission_failure_retries_then_records_error(monkeypatch):
    from app.config import settings
    from app.services.image_moderation import scan_bytes

    monkeypatch.setattr(settings, "rekognition_mode", "aws")
    monkeypatch.setattr(settings, "aws_region", "eu-central-1")
    attempts = {"count": 0}

    class Denied:
        def detect_moderation_labels(self, **kwargs):
            attempts["count"] += 1
            raise RuntimeError("AccessDeniedException: not authorized to perform rekognition:DetectModerationLabels")

    monkeypatch.setattr("boto3.client", lambda *args, **kwargs: Denied())
    monkeypatch.setattr("time.sleep", lambda _seconds: None)
    result = scan_bytes(b"jpeg-bytes")
    assert attempts["count"] == 3
    assert result.decision == "error"
    assert "AccessDeniedException" in (result.error_message or "")


def test_rejected_wins_over_review():
    assert combine([
        ScanDecision("needs_review", [], None),
        ScanDecision("rejected", [], None),
    ]) == "rejected"
