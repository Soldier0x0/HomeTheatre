"""Local sidecar subtitle discovery and SRT→WebVTT conversion.

Policy (ADR-0006): sidecar files next to the video only (``<stem>[.<lang>].srt``).
No external subtitle provider is integrated; none is contacted.
"""
from __future__ import annotations

import re
from pathlib import Path

_KNOWN_LANG_WORDS = {"english", "eng", "en", "es", "spanish", "spa", "fr", "french", "fre", "de",
                     "german", "ger", "it", "italian", "ita", "pt", "portuguese", "por", "ru",
                     "russian", "rus", "ja", "japanese", "jpn", "ko", "korean", "kor", "zh",
                     "chinese", "chi", "hi", "hindi", "ta", "tamil", "te", "telugu", "kn",
                     "kannada", "ml", "malayalam", "ar", "arabic", "ara", "nl", "dutch", "dut"}


def find_sidecar_subtitles(video_path: Path) -> list[dict]:
    """Return [{index, lang, label, path}] for .srt files beside the video, sorted by index.

    Matches ``<stem>.srt`` and ``<stem>.<lang>.srt`` naming.
    """
    base = video_path.stem.lower()
    found: list[dict] = []
    if not video_path.parent.is_dir():
        return found
    for candidate in sorted(video_path.parent.glob("*.srt")):
        stem = candidate.stem.lower()
        if not (stem == base or stem.startswith(base + ".")):
            continue
        tail = candidate.stem[len(video_path.stem) + 1:] if stem != base else ""
        lang = tail.lower() if tail and tail.lower() in _KNOWN_LANG_WORDS else "und"
        label = lang.upper() if len(lang) <= 3 else lang.capitalize()
        if not tail:
            label = f"Subtitle {len(found) + 1}"
        found.append({"index": len(found), "lang": lang, "label": label,
                      "path": str(candidate)})
    return found


def srt_to_vtt(text: str) -> str:
    """Minimal, lossless-enough SRT→WebVTT conversion using the stdlib only."""
    text = text.replace("\ufeff", "")
    text = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", text)
    # strip SRT sequence numbers that are not part of cue text
    text = re.sub(r"(?m)^\d+\s*$", "", text)
    return "WEBVTT\n\n" + text.strip() + "\n"
