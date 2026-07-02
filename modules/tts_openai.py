from .narration_generator import create_narration_audio
from typing import Tuple, Optional


def synthesize_speech(text: str) -> Tuple[Optional[str], Optional[float]]:
    # Prefer OpenAI-powered TTS if available; otherwise fall back to existing gTTS-based path
    path = create_narration_audio(text)
    duration = None
    return path, duration

