**ExplainD** is a proof-of-concept application that automates the creation of short, animated educational videos from a single text prompt. It leverages local large language models (LLMs) to generate scripts and animation code, and then uses a programmatic animation engine to render the final video with audio narration.

---

## 🎥 Project Demo

Watch a complete walkthrough of the application, from prompt to final video output.

**[Click here to watch the full project demo on YouTube](https://youtu.be/x-SFlt3WJ-o)**

---

## ✨ Features

* **Prompt-Based Generation:** Simply describe a topic and a target audience to start the creation process.
* **Local LLM Integration:** Utilizes a locally-run `mistral` model via Ollama for fast, free, and reliable content generation.
* **Automated Storyboarding:** The AI generates a logical, three-act storyboard to structure the educational content.
* **Programmatic Animation:** Manim, the powerful mathematical animation engine, is used to create the visuals based on the AI-generated Python code.
* **Text-to-Speech Narration:** Each scene's script is automatically converted into an audio track.
* **End-to-End Video Production:** The application handles rendering the animation, generating audio, and merging them into a final, shareable MP4 video.
* **Professional UI:** A clean, centered interface built with Streamlit provides a seamless user experience.

---

## 🛠️ Technology Stack & Architecture

This project is built with a modular architecture, ensuring that each component is independent and testable.

### **Core Technologies:**

* **Backend:** Python
* **LLM Orchestration:** Ollama (running `mistral` locally)
* **Animation Engine:** Manim Community Edition v0.19.0
* **Web Framework:** Streamlit
* **Text-to-Speech:** gTTS (Google Text-to-Speech)
* **Video/Audio Manipulation:** FFmpeg

### **System Workflow:**

1.  **User Input:** The user provides a topic and audience via the Streamlit frontend.
2.  **Content Creation (`content_creation.py`):**
    * The `mistral` model is prompted to create a 3-frame JSON storyboard.
    * For each frame, the model is prompted to generate a narration script and a detailed animation description.
    * The model is then prompted with the animation description to generate a Manim Python script.
3.  **Video Generation (`video_generator.py`):**
    * The **Narration Module (`narration_generator.py`)** converts the script to an MP3 file.
    * Manim is executed as a subprocess to render a silent MP4 from the generated code.
    * FFmpeg is executed as a subprocess to merge the silent video and the audio file.
4.  **Output:** The final videos are displayed in the Streamlit app and saved to a local `output` directory.

---

## 🚀 Local Setup and Installation

Follow these steps to run the project on your local machine.

### **1. Prerequisites**

* **Python (3.9+):** Ensure Python is installed and added to your system's PATH.
* **Ollama:** The Ollama application must be installed and running. Download it from [ollama.com](https://ollama.com/).
* **Manim Dependencies:** You must have **FFmpeg** and a **LaTeX** distribution (like MiKTeX for Windows) installed. Follow the official [Manim installation guide](https://docs.manim.community/en/stable/installation.html) for your OS.

### **2. Clone the Repository**

```bash
git clone [https://github.com/adityabatra072/ExplainD](https://github.com/adityabatra072/ExplainD)
cd ExplainD
```

### **3. Set Up Local Models**

Pull the required model using Ollama from your terminal:

```bash
ollama pull mistral
```

### **4. Create a Virtual Environment**

It is highly recommended to use a virtual environment to manage project dependencies.

```bash
# Create the environment
python -m venv venv

# Activate the environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### **5. Install Dependencies**

Install all required Python packages from the `requirements.txt` file.

```bash
pip install -r requirements.txt
```

---

## 🏃‍♂️ How to Run the Application

### **1. Start Ollama**

Ensure the Ollama desktop application is running in the background.

### **2. Run the Main Application**

Execute the following command in your terminal from the project's root directory:

```bash
streamlit run main_app.py
```


