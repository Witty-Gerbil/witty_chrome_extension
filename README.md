# Witty Chrome Extension

## Overview
Witty Chrome Extension is a two-part open-source project designed to enhance browser interactions with an intelligent Chrome extension frontend and a Flask-based Python backend API. This repository is structured as follows:

- **`witty_gerbil_frontend`**: The Chrome extension, built with JavaScript, HTML, and CSS, for automating tasks and enhancing user interaction in the browser.
- **`witty_gerbil_backend_api`**: A Flask-based backend API that is the engine behind the  functionality of the extension. 

---

## Repository Structure

```plaintext
witty_chrome_extension/
├── witty_gerbil_backend_api
│   ├── .DS_Store
│   ├── .env
│   ├── README.md
│   ├── app
│   │   ├── .DS_Store
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── endpoints
│   │   │   ├── .DS_Store
│   │   │   ├── __init__.py
│   │   │   └── chrome_extention_backend_prompter.py
│   │   ├── main.py
│   │   ├── models
│   │   │   ├── .DS_Store
│   │   │   └── __init__.py
│   │   └── services
│   │       ├── .DS_Store
│   │       └── __init__.py
│   ├── prompt_dataset.csv
│   ├── requirements.txt
│   ├── results
│   │   └── dataset_results.csv
│   ├── run.sh
│   └── start_server.py
└── witty_gerbil_frontend
    ├── .DS_Store
    ├── .gitignore
    ├── background.js
    ├── content.js
    ├── icons
    │   ├── .DS_Store
    │   ├── icon128.png
    │   ├── icon16.png
    │   └── icon48.png
    ├── libs
    │   └── papaparse.js
    ├── manifest.json
    ├── ui.css
    ├── ui.html
    └── ui.js
├── .gitignore                    # Git ignore file
├── README.md                     # This documentation
```

---

## Features

### Frontend (Chrome Extension)
- Automates interactions with webpages (e.g., sending inputs, extracting responses).
- Configurable selectors for identifying user, assistant, and input fields (amoung others).
- Supports both manual and automated message sending workflows.
- Benchmarking functionality for running datasets and analyzing results.
- Resizable and draggable UI.

### Backend (Flask API)
- Generates prompts using OpenAI models using chat history context, user given objective, and any special notes.
- Handles the compressing of chat history for large conversations
- Handles datasets (CSV/Excel) for benchmarking tasks.
- Saves results to files and provides endpoints for downloading them.
- Simple, extensible Python-based implementation.

---

## References
(Placeholder for future references to associated academic publications or Arxiv papers.)

if you benefit from the code or the research, please cite our papers!

```plaintext
citation
```

---

## Setup Instructions

### Prerequisites
- **Python 3.8 or higher** for the backend.
- **Node.js** (optional, for building or testing frontend dependencies).
- A **modern chromium-based browser** (e.g., Chrome) for the extension.
- **Git** for cloning the repository.

### Step 1: Clone the Repository
```bash
git clone git@github.com:Witty-Gerbil/witty_chrome_extension.git
cd witty_chrome_extension
```

---

### Backend Setup: `witty_gerbil_backend_api`

#### 1. Navigate to the Backend Folder
```bash
cd witty_gerbil_backend_api
```

#### 2. Create a Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate   # For macOS/Linux
venv\Scripts\activate     # For Windows
```

#### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 4. Create a `.env` File (there is a placeholder .env.example file in this directory. Simply fill in your key values for the variables and remove the .example)
Create a `.env` file in the `witty_gerbil_backend_api` directory with the following content:
```plaintext
FLASK_APP=start_server.py
FLASK_ENV=development
OPENAI_API_KEY=your_openai_api_key_here
```
Replace `your_openai_api_key_here` with your OpenAI API key.

#### 5. Run the Flask Server
You can start the Flask server using the provided `run.sh` script or directly with Python:

Using the script:
```bash
bash run.sh
```

Or directly:
```bash
python start_server.py
```
The backend will be available at `http://127.0.0.1:5000/`.

---

### Frontend Setup: `witty_gerbil_frontend`

#### 1. Navigate to the Frontend Folder
```bash
cd ../witty_gerbil_frontend
```

#### 2. Load the Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer Mode** (toggle in the top-right corner).
3. Click on **Load unpacked**.
4. Select the `witty_gerbil_frontend` folder from your cloned repository.
5. After loading, you will see the Witty Chrome Extension in the browser's extension bar.
6. Now, when you visit a page that has an input text box, this menu will pop up (until future development, this may become a bit annoying, so get used to toggling this on and off for now)


#### 3. Update Backend API URL (if necessary)
By default, the extension is configured to communicate with the backend at `http://127.0.0.1:5000/`. If your backend is running on a different host or port, update the API URL in `content.js`:

1. Open `content.js` in a text editor.
2. Locate the `BACKEND_API_BASE_URL` constant.
3. Replace its value with the correct backend URL.

```javascript
const BACKEND_API_BASE_URL = "http://your-backend-url-here";
```

#### 4. Interaction with Web Pages
Once loaded, the extension allows you to interact with any active webpage. Use the extension's interface to configure:
- If you iwsh to use the 'Red Team With Me' functionaility, define the Objective, Special Notes, and press the 'Generate Next Prompt' button. If your DOM selectors are correct, this will retrieve the next likely prompt from the backend and insert it into the prompt text box.
- You can also define the Objective, Special Notes, as well as the Max Turns and press the 'Automate Conversation' button to have the extension automate the retrieving and sending of prompts to the browser for x number of turns.
- Benchmarking of your csv or excel datasets is also available. Simply upload your dataset, select the column that holds the prompts you wish to send, and press the 'Run Dataset' button
- **Selectors**: Define the DOM elements for input, user messages, and assistant responses. There is also options to let the extension auto-detect these. For simple webpages, the autodetect will usually work. For webpages that apply special rendering, etc. you will need to input the CSS element of the user bubble, assistant bubble, text input prompt box, and the send button (by default, when the extension sends a prompt it simulates the [Enter button]; however, if you provide a value here, it will click this button instead)

---

## How It Works

### Frontend
The Chrome extension interacts with the active webpage by:
- Injecting the `content.js` script to access and manipulate DOM elements.
- Providing a resizable, draggable user interface to configure selectors, manage interactions, and visualize results.
- Sending user prompts to the backend and handling the responses to automate tasks.

### Backend
The Flask API handles requests from the Chrome extension and provides the following functionality:
- **Prompt Generation**: Uses OpenAI models to generate responses based on user prompts.
- **Dataset Handling**: Processes uploaded datasets (CSV/Excel) for benchmarking and testing.
- **Results Management**: Saves generated responses and provides endpoints for downloading results.

---

## Usage

### General Workflow
1. **Backend**:
   - Start the Flask server as described in the backend setup instructions.
   - Ensure the `.env` file contains valid configurations, including your OpenAI API key.

2. **Frontend**:
   - Load the Chrome extension in your browser.
   - Open the extension UI and configure the selectors for user, assistant, and input fields on the webpage.
   - Enter your objective and optional notes.

3. **Automate Tasks**:
   - Use the "Automate Conversation" feature to interact with a webpage.
   - Use the "Benchmark Dataset" feature to process datasets and analyze results.

4. **View Results**:
   - Download the results to your local

---

## Current Limitations
- **Frontend Configuration**: Requires manual configuration of selectors for each webpage if the webpage is not simple. 
- **OpenAI API**: Requires a valid OpenAI API key for prompt generation. Future work will integrate other model types like locally hosted ones (HuggingFace, Ollama, etc.) and major cloud providers like AWS, GCP, and Azure. 

---

## Contributing
Contributions are welcome! Follow these steps to contribute:
1. Fork the repository.
2. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature-name
   ```
3. Commit your changes and push the branch:
   ```bash
   git commit -m "Description of changes"
   git push origin feature-name
   ```
4. Open a pull request with a detailed description of your changes.

---

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Acknowledgments
- Built with OpenAI's GPT models for advanced prompt handling.
- Inspired by the need for enhanced browser automation tools.

---

## Support
For issues or feature requests, please open an [issue](https://github.com/your-username/witty_chrome_extension/issues) in the repository.

