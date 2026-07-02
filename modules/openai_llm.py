import os
import json
import requests
from typing import Optional

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"


def _api_headers() -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable not set.")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def generate(prompt: str, model: str = "gpt-4o", temperature: float = 0.7, max_tokens: Optional[int] = None) -> Optional[str]:
    """Simple OpenAI chat-completion wrapper. Returns text or None on failure."""
    payload: dict = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if temperature is not None:
        payload["temperature"] = temperature

    try:
        resp = requests.post(OPENAI_API_URL, headers=_api_headers(), json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return content.strip()
    except Exception as e:
        print(f"OPENAI ERROR: {e}")
        return None


def chat_completion(messages: list[dict], model: str = "gpt-4o") -> Optional[str]:
    """Lightweight chat-style interface for OpenAI models."""
    payload = {"model": model, "messages": messages}
    try:
        resp = requests.post(OPENAI_API_URL, headers=_api_headers(), json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        print(f"OPENAI ERROR: {e}")
        return None

__all__ = ["generate", "chat_completion"]
