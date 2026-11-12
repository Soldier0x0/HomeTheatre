"""Media probing via ffprobe, with honest degradation.

Binary resolution order: PATH -> static_ffmpeg package (if installed) -> none.
When no ffprobe is available every field reports None and nothing is invented.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

_cache: dict[str, str | None] = {}
# Video codecs browsers can direct-play (ADR-0005 policy; conservative, honest set)
_BROWSER_VIDEO = {"h264", "vp8", "vp9", "av1"}
_BROWSER_AUDIO = {"aac", "mp3", "opus", "flac", "vorbis"}
_BROWSER_CONTAINERS = {"mp4", "m4v", "webm", "mov"}


def ffprobe_binary() -> str | None:
    if "ffprobe" in _cache:
        return _cache["ffprobe"]
    found = shutil.which("ffprobe")
    if not found:
        try:
            import static_ffmpeg.run as sfr
            _, found = sfr.get_or_fetch_platform_executables_else_raise()  # (ffmpeg, ffprobe)
        except Exception:
            found = None
    _cache["ffprobe"] = found
    return found


def probe_file(path: str | Path) -> dict | None:
    """Return a normalized probe dict, or None when ffprobe is unavailable/file unreadable."""
    binary = ffprobe_binary()
    if not binary:
        return None
    try:
        out = subprocess.run(
            [binary, "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams",
             str(path)],
            capture_output=True, timeout=30, check=True,
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return None
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return None

    fmt = data.get("format") or {}
    streams = data.get("streams") or []
    duration = None
    try:
        duration = float(fmt.get("duration"))
    except (TypeError, ValueError):
        for s in streams:
            try:
                duration = float(s.get("duration"))
                break
            except (TypeError, ValueError):
                continue
    video = next((s for s in streams if s.get("codec_type") == "video"), None) or {}
    audio = [s for s in streams if s.get("codec_type") == "audio"]
    subs = [s for s in streams if s.get("codec_type") == "subtitle"]
    vcodec = (video.get("codec_name") or "").lower()
    container = (fmt.get("format_name") or "").split(",")[0].lower()
    audio_codecs = [s.get("codec_name", "").lower() for s in audio]
    audio_langs = [(s.get("tags") or {}).get("language") or "" for s in audio]
    sub_codecs = [s.get("codec_name", "").lower() for s in subs]
    resolution = f"{video.get('width')}x{video.get('height')}" if video.get("width") else None
    compatible = (container in _BROWSER_CONTAINERS
                  and vcodec in _BROWSER_VIDEO
                  and all(c in _BROWSER_AUDIO for c in audio_codecs))
    return {
        "duration_sec": duration,
        "container": container,
        "video_codec": vcodec or None,
        "audio_codecs": audio_codecs,
        "audio_langs": audio_langs,
        "subtitle_codecs": sub_codecs,
        "resolution": resolution,
        "browser_compatible": compatible,
    }


def ffmpeg_binary() -> str | None:
    if "ffmpeg" in _cache:
        return _cache["ffmpeg"]
    found = shutil.which("ffmpeg")
    if not found:
        try:
            import static_ffmpeg.run as sfr
            found, _ = sfr.get_or_fetch_platform_executables_else_raise()  # (ffmpeg, ffprobe)
        except Exception:
            found = None
    _cache["ffmpeg"] = found
    return found
