from __future__ import annotations

import subprocess
from pathlib import Path


class TranscodeError(Exception):
    pass


def _run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise TranscodeError(result.stderr[-2000:] or "ffmpeg failed")


def transcode_video(input_path: Path, output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "1080p": output_dir / "1080p.mp4",
        "720p": output_dir / "720p.mp4",
        "480p": output_dir / "480p.mp4",
        "poster": output_dir / "poster.webp",
        "thumb": output_dir / "thumb.webp",
    }

    _run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-filter_complex",
            "[0:v:0]split=3[v1][v2][v3];"
            "[v1]scale=-2:1080,format=yuv420p[v1out];"
            "[v2]scale=-2:720,format=yuv420p[v2out];"
            "[v3]scale=-2:480,format=yuv420p[v3out]",
            "-map",
            "[v1out]",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-maxrate",
            "6M",
            "-bufsize",
            "12M",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(outputs["1080p"]),
            "-map",
            "[v2out]",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "24",
            "-maxrate",
            "3M",
            "-bufsize",
            "6M",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(outputs["720p"]),
            "-map",
            "[v3out]",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "25",
            "-maxrate",
            "1.5M",
            "-bufsize",
            "3M",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-movflags",
            "+faststart",
            str(outputs["480p"]),
        ]
    )

    _run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "1",
            "-i",
            str(input_path),
            "-frames:v",
            "1",
            "-vf",
            "scale=800:-1",
            "-c:v",
            "libwebp",
            "-quality",
            "80",
            str(outputs["poster"]),
        ]
    )

    _run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "1",
            "-i",
            str(input_path),
            "-frames:v",
            "1",
            "-vf",
            "scale=400:-1",
            "-c:v",
            "libwebp",
            "-quality",
            "80",
            str(outputs["thumb"]),
        ]
    )

    return outputs
