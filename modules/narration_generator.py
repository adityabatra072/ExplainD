from gtts import gTTS
import tempfile
import os

def create_narration_audio(text: str) -> str | None:
    """
    Converts a string of text into an MP3 audio file using gTTS.

    Args:
        text: The text to be converted to speech.

    Returns:
        The file path to the generated MP3 audio file, or None if it fails.
    """
    if not text.strip():
        print("Warning: No text provided for narration.")
        return None
        
    try:
        # Create a temporary file to save the audio to.
        # We give it a .mp3 suffix and ensure it's not deleted automatically.
        temp_audio_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        temp_audio_file.close()

        # Create the gTTS object with the text, specifying English language
        tts = gTTS(text=text, lang='en', slow=False)
        
        # Save the generated speech to our temporary file path
        tts.save(temp_audio_file.name)
        
        # Return the path to the created audio file
        return temp_audio_file.name

    except Exception as e:
        print(f"ERROR: Failed to create narration audio: {e}")
        return None

# This block allows us to test the file directly
if __name__ == '__main__':
    print("--- Testing Narration Generator Module ---")
    test_text = "Hello, this is a test of the narration module."
    print(f"Generating audio for text: '{test_text}'")

    audio_path = create_narration_audio(test_text)

    if audio_path and os.path.exists(audio_path):
        print(f"\nAudio file generated successfully!")
        print(f"File saved at: {audio_path}")
        print("You can play this file with a media player to verify.")
    else:
        print("\nAudio generation failed.")
