import requests
from typing import Optional

OLLAMA_API_URL = "http://localhost:11434/api/generate"

def query_local_model(prompt: str, model_name: str, temperature: float = 0.7, timeout: int = 300) -> Optional[str]:
    """
    Send a prompt to a local Ollama model and return the text response.

    Args:
        prompt (str): The text prompt.
        model_name (str): Ollama model name.
        temperature (float): Sampling temperature.
        timeout (int): HTTP request timeout.

    Returns:
        Optional[str]: Generated text or None if failure.
    """
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature}
    }

    try:
        response = requests.post(
            OLLAMA_API_URL,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=timeout
        )
        response.raise_for_status()
        return response.json().get("response", "").strip()
    except requests.exceptions.ConnectionError:
        print(f"ERROR: Could not connect to Ollama at {OLLAMA_API_URL}")
    except requests.exceptions.Timeout:
        print(f"ERROR: Request to {model_name} timed out.")
    except Exception as e:
        print(f"Unexpected error: {e}")
    return None

if __name__ == "__main__":
    # Models
    EXPLANATION_MODEL = "qwen2.5:7b-instruct-q4_0"
    CODE_MODEL = "starcoder2:3b-q4_0"

    # Explanation prompt example
    explanation_prompt = "Explain how gravity works in simple terms for a high school student."
    explanation = query_local_model(explanation_prompt, EXPLANATION_MODEL)
    if explanation:
        print("\n--- Explanation ---")
        print(explanation)
    else:
        print("Failed to get explanation.")

    # Code generation prompt example
    code_prompt = (
        "Write a Python function using the requests library to fetch JSON data from "
        "'https://api.example.com/data' and print the 'name' field of each item."
    )
    code = query_local_model(code_prompt, CODE_MODEL)
    if code:
        print("\n--- Code Generation ---")
        print(code)
    else:
        print("Failed to get code.")
