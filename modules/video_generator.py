import subprocess
import os
import tempfile
import shutil
# We import the function from the module we just created
from .narration_generator import create_narration_audio

def render_manim_video(manim_code: str, scene_name: str, narration_text: str) -> str | None:
    """
    Renders a silent Manim video, generates narration audio, and merges them.
    The final video is saved in an 'output' directory.

    Args:
        manim_code: The Python script for the Manim scene.
        scene_name: The name of the Manim class to render (e.g., "Scene1").
        narration_text: The text script for the audio narration.

    Returns:
        The file path to the final video with audio, or None if it fails.
    """
    # --- Setup: Create an output directory for final videos ---
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    final_video_path = os.path.join(output_dir, f"{scene_name}.mp4")

    # --- Step 1: Generate the Narration Audio ---
    print("--- [1/3] Generating Narration Audio ---")
    audio_path = create_narration_audio(narration_text)
    if not audio_path:
        print("Warning: Could not generate narration audio. Video will be silent.")

    # --- Step 2: Render the Silent Manim Video ---
    print("--- [2/3] Rendering Silent Manim Video ---")
    # A temporary directory is used for intermediate manim files
    with tempfile.TemporaryDirectory() as temp_dir:
        script_path = os.path.join(temp_dir, "manim_script.py")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(manim_code)

        manim_command = [
            "manim", script_path, scene_name, "-ql",
            "--media_dir", temp_dir,
        ]

        try:
            # Run the Manim command to render the video
            print("Running Manim command...")
            manim_process = subprocess.run(manim_command, capture_output=True, text=True, check=True, timeout=300)
            print("Manim process finished.")
            
            silent_video_path = os.path.join(temp_dir, "videos", "manim_script", "480p15", f"{scene_name}.mp4")

            if not os.path.exists(silent_video_path):
                print(f"❌ FATAL ERROR: Manim did not produce the expected video file.")
                print(f"Manim STDERR: {manim_process.stderr}")
                return None

            # --- Step 3: Merge Video and Audio with FFmpeg ---
            print("--- [3/3] Merging Video and Audio ---")
            
            if audio_path:
                merge_command = [
                    "ffmpeg",
                    "-y", # Overwrite output file if it exists
                    "-i", silent_video_path,
                    "-i", audio_path,
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-shortest",
                    final_video_path # Output directly to the final destination
                ]
                print("Running FFmpeg merge command...")
                subprocess.run(merge_command, capture_output=True, text=True, check=True)
                os.remove(audio_path) # Clean up the temporary audio file
            else:
                # If no audio, just copy the silent video to the output folder
                shutil.copy(silent_video_path, final_video_path)
            
            print("FFmpeg process finished.")
            return final_video_path

        except subprocess.CalledProcessError as e:
            print(f"FATAL ERROR: A subprocess failed during video generation.")
            print(f"COMMAND: {' '.join(e.cmd)}")
            print(f"STDERR: {e.stderr}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            return None

# This block allows us to test the entire video generation chain
if __name__ == '__main__':
    print("--- Testing Video Generator Module ---")
    # A simple, guaranteed-to-work Manim script for testing
    test_manim_code = """
from manim import *
class TestScene(Scene):
    def construct(self):
        circle = Circle(color=BLUE, fill_opacity=0.5)
        square = Square(color=RED, fill_opacity=0.5)
        self.play(Create(circle))
        self.wait(1)
        self.play(Transform(circle, square))
        self.wait(1)
    """
    test_narration = "First, we see a circle. Then, it transforms into a square."
    
    final_video = render_manim_video(test_manim_code, "TestScene", test_narration)

    if final_video and os.path.exists(final_video) and os.path.getsize(final_video) > 0:
        print(f"\nFinal video with audio generated successfully!")
        print(f"File saved at: {final_video}")
        print("You can find this file in the 'output' folder in your project directory.")
    else:
        print("\nVideo generation failed or resulted in a zero-byte file.")
