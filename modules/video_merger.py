import subprocess
import os

def stitch_videos(video_paths: list[str], output_path: str) -> bool:
    """
    Stitches multiple video files into a single video using FFmpeg.

    Args:
        video_paths: A list of paths to the video files to concatenate.
        output_path: The path for the final stitched video file.

    Returns:
        True if stitching was successful, False otherwise.
    """
    if not video_paths:
        print("No video paths provided for stitching.")
        return False

    # Create a temporary text file listing all videos to be concatenated
    list_file_path = "video_list.txt"
    with open(list_file_path, "w") as f:
        for path in video_paths:
            # FFmpeg requires a specific format with escaped backslashes for Windows
            f.write(f"file '{os.path.abspath(path)}'\n")

    # FFmpeg command to concatenate videos from the list file
    # -f concat: Use the concatenate demuxer
    # -safe 0: Allow unsafe file paths (necessary for absolute paths)
    # -i: Input file list
    # -c copy: Copy streams without re-encoding for speed
    command = [
        "ffmpeg",
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file_path,
        "-c", "copy",
        output_path
    ]

    try:
        print("Running FFmpeg stitch command...")
        subprocess.run(command, check=True, capture_output=True, text=True)
        print(f"Successfully stitched videos to {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        print(f" FATAL ERROR: FFmpeg stitching failed.")
        print(f"STDERR: {e.stderr}")
        return False
    finally:
        # Clean up the temporary list file
        if os.path.exists(list_file_path):
            os.remove(list_file_path)

