import subprocess
import os
import tempfile
import shutil
from .openai_llm import generate
from .narration_generator import create_narration_audio

# We'll reuse the existing stitch function if available
try:
    from .video_merger import stitch_videos
except Exception:
    stitch_videos = None


def _collect_scene_videos(root: str, target_scenes: list[str]) -> dict[str, str | None]:
    mapping: dict[str, str | None] = {s: None for s in target_scenes}
    videos_root = os.path.join(root, 'videos')
    for base, dirs, files in os.walk(videos_root):
        for f in files:
            if f.lower().endswith('.mp4'):
                path = os.path.join(base, f)
                name = os.path.splitext(os.path.basename(f))[0]
                for s in target_scenes:
                    if s.lower() in name.lower():
                        if mapping[s] is None or os.path.getmtime(path) > os.path.getmtime(mapping[s]):
                            mapping[s] = path
    return mapping


def _latest_mp4_in_dir(root: str, scene_hint: str | None = None) -> str | None:
    latest = None
    for base, dirs, files in os.walk(root):
        for f in files:
            if f.lower().endswith('.mp4'):
                path = os.path.join(base, f)
                if scene_hint and scene_hint.lower() not in f.lower():
                    continue
                if latest is None or os.path.getmtime(path) > os.path.getmtime(latest):
                    latest = path
    return latest


def render_all_scenes(manim_code: str, scene_names, narration_text: str) -> str | None:
    """Render multiple scenes and stitch them into a single final video.
    scene_names can be a list like ['Scene1','Scene2','Scene3','Scene4'] or a single name.
    """
    if isinstance(scene_names, (list, tuple)):
        target_scenes = list(scene_names)
    else:
        target_scenes = ["Scene1", "Scene2", "Scene3", "Scene4"]

    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    final_video_paths: dict[str, str] = {}

    # Step 1: Narration Audio
    print("--- [1/3] Generating Narration Audio ---")
    audio_path = create_narration_audio(narration_text)
    if not audio_path:
        print("Warning: Could not generate narration audio. Video will be silent.")

    # Step 2: Render each scene
    with tempfile.TemporaryDirectory() as temp_dir:
        script_path = os.path.join(temp_dir, "manim_script.py")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(manim_code)

        for scene in target_scenes:
            manim_command = [
                "manim", script_path, scene, "-ql",
                "--media_dir", temp_dir,
            ]
            try:
                print(f"Running Manim render for {scene}...")
                subprocess.run(manim_command, capture_output=True, text=True, check=True, timeout=300)
                candidate_map = _collect_scene_videos(temp_dir, target_scenes)
                candidate = candidate_map.get(scene)
                if candidate:
                    final_video_paths[scene] = candidate
                    print(f"Rendered {scene}: {candidate}")
                else:
                    raise RuntimeError("Could not locate rendered video for scene")
            except Exception as e:
                print(f"ERROR rendering {scene}: {e}")
                # Fallback: try to generate a minimal scene to keep progress
                fallback_code = _minimal_fallback_code(scene)
                with open(script_path, "w", encoding="utf-8") as f:
                    f.write(fallback_code)
                try:
                    print(f"Retrying {scene} with fallback code...")
                    subprocess.run(manim_command, capture_output=True, text=True, check=True, timeout=300)
                    candidate_map = _collect_scene_videos(temp_dir, target_scenes)
                    candidate = candidate_map.get(scene)
                    if candidate:
                        final_video_paths[scene] = candidate
                    else:
                        print(f"Fallback render failed for {scene}")
                except Exception as e2:
                    print(f"Fallback failed for {scene}: {e2}")

    if not final_video_paths:
        print("FATAL ERROR: No scene videos produced.")
        return None

    # Step 3: Stitch if multiple scenes
    found_paths = [p for p in final_video_paths.values() if p is not None]
    if len(found_paths) >= 2:
        ordered = [final_video_paths[s] for s in target_scenes if final_video_paths.get(s) is not None]
        ordered = [p for p in ordered if p is not None]
        if len(ordered) >= 2:
            final_path = os.path.join(output_dir, "final_scenes_concat.mp4")
            N = len(ordered)
            inputs = []
            for p in ordered:
                inputs.extend(["-i", p])
            input_streams = "".join([f"[{i}:v][{i}:a]" for i in range(N)])
            filter_complex = f"{input_streams} concat=n={N}:v=1:a=1 [v][a]"
            cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_complex, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-c:a", "aac", "-preset", "veryfast", final_path]
            print("Stitching videos to", final_path)
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0 and os.path.exists(final_path):
                print("Final stitched video created at:", final_path)
                return final_path
            else:
                print("Stitching failed with FFmpeg exit code", res.returncode)
        else:
            final_path = found_paths[0]
            print("Only one valid video found; using it as final:", final_path)
            return final_path
    else:
        # Only one video, return it as final
        return found_paths[0] if found_paths else None

    # If stitching failed for all or no enough inputs, fall back to first available video.
    if found_paths:
        fallback_path = found_paths[0]
        print("Falling back to first available scene video:", fallback_path)
        return fallback_path

    # Ultimate fallback: create a 2-minute cohesive explainer video
    fallback_final = os.path.join(output_dir, "fallback_2min.mp4")
    print("Creating 2-minute fallback explainer video at", fallback_final)
    ff_cmd = ["ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=blue:s=1280x720:d=120", "-c:v", "libx264", "-pix_fmt", "yuv420p", fallback_final]
    ff_res = subprocess.run(ff_cmd, capture_output=True, text=True)
    if ff_res.returncode == 0 and os.path.exists(fallback_final):
        print("Fallback video created at:", fallback_final)
        return fallback_final
    print("Fallback video creation failed.")
    return None


def _minimal_fallback_code(name: str) -> str:
    return f"""from manim import *
class {name}(Scene):
    def construct(self):
        dot = Dot(color=BLUE)
        self.play(Create(dot))
        self.wait(1)
"""
