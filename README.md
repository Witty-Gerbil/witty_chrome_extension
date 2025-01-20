# Witty Chrome Extension

## Overview
Witty Chrome Extension is a two-part open-source project designed to enhance browser interactions with a Chrome extension frontend and a Python backend run locally. This repository consists of:

- **witty_gerbil_frontend**: A Chrome extension built with JavaScript, HTML, and CSS for automating tasks and enhancing user interaction in the browser.
- **witty_gerbil_backend_api**: A Flask-based backend API that powers the extension's functionality.

## Repository Structure
*Note: Some of the directories/files are empty, leaving room for future iterations and features.*

```
witty_chrome_extension/
├── witty_gerbil_backend_api/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── endpoints/
│   │   │   ├── __init__.py
│   │   │   └── chrome_extension_backend_prompter.py
│   │   ├── main.py
│   │   ├── models/
│   │   │   └── __init__.py
│   │   └── services/
│   │       └── __init__.py
│   ├── results/
│   ├── .env.example
│   ├── README.md
│   ├── requirements.txt
│   ├── run.sh
│   └── start_server.py
└── witty_gerbil_frontend/
    ├── icons/
    │   ├── icon128.png
    │   ├── icon16.png
    │   └── icon48.png
    ├── libs/
    │   └── papaparse.js
    ├── background.js
    ├── content.js
    ├── manifest.json
    ├── ui.css
    ├── ui.html
    └── ui.js
├── .gitignore
└── README.md
```

## Features

### Frontend (Chrome Extension)
- Automates webpage interactions (sending inputs, extracting responses)
- Configurable selectors for identifying user, assistant, and input fields (defaults to auto-detect)
- Supports manual and automated message sending workflows
- Benchmarking functionality for running datasets and analyzing results
- Resizable and draggable UI

### Backend (Flask API)
- Generates prompts using OpenAI gpt-4o model using chat history context, user objectives, and special notes as context
- Handles chat history compression for large conversations
- Processes datasets (CSV/Excel) for benchmarking tasks
- Saves results to files with download endpoints

## Citation

If you benefit from this code or research, please cite our papers:

```
[Citation placeholder - Add your paper details here]
```

## Setup Instructions

### Prerequisites
- Python 3.8 or higher
- Node.js (optional, for frontend development)
- Modern Chromium-based browser (e.g., Chrome)
- Git

### Step 1: Clone the Repository
```bash
git clone git@github.com:Witty-Gerbil/witty_chrome_extension.git
cd witty_chrome_extension
```

### Backend Setup: witty_gerbil_backend_api

1. Navigate to the backend folder:
```bash
cd witty_gerbil_backend_api
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate   # For macOS/Linux
venv\Scripts\activate      # For Windows
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
- Copy `.env.example` to `.env`
- Update the values:
```
FLASK_APP=start_server.py
FLASK_ENV=development
OPENAI_API_KEY=your_openai_api_key_here
```

5. Start the Flask server:
```bash
bash run.sh
# or
python start_server.py
```

The backend will run at `http://127.0.0.1:5000/`.

### Frontend Setup: witty_gerbil_frontend

1. Navigate to the frontend folder:
```bash
cd ../witty_gerbil_frontend
```

2. Load the Chrome Extension:
- Open Chrome and go to `chrome://extensions/`
- Enable "Developer Mode"
- Click "Load unpacked"
- Select the `witty_gerbil_frontend` folder
- The extension icon will appear in your browser

3. Configure Backend URL (if needed / if you chose to run your backend on a different port, etc.):
- Open `content.js`
- Update `BACKEND_API_BASE_URL` if your backend runs elsewhere:
```javascript
const BACKEND_API_BASE_URL = "http://your-backend-url-here";
```

## Usage

### General Workflow

1. Start the backend server with valid configurations (api_keys, etc.)

2. Use the Chrome extension:
- Configure webpage selectors (or use auto-detect)
- Set your objective and optional notes
- Choose an interaction mode:
  - Generate Next Prompt
  - Automate Conversation
  - Benchmark using your own .csv/excel file
  - Save resutls locally

3. Features:
- **Red Team With Me**: Define objective and notes, generate prompts
- **Automate Conversation**: Given x number of max turns, generate the next likely prompt to meet the objective given the chat history and special notes, paste that prompt into the text input box, press [Enter] or the submit button on the page, wait for the response to be finished streaming, do that all over again for x number of turns.
- **Dataset Benchmarking**: Upload and process CSV/Excel datasets
- **Selector Configuration**: Manual or auto-detect DOM elements

## Current Limitations
- Manual selector configuration needed for complex webpages
- Requires OpenAI API key (support for local models planned)
- Current UI toggle behavior may need refinement

## Contributing

1. Fork the repository
2. Create a feature branch:
```bash
git checkout -b feature-name
```

3. Commit and push changes:
```bash
git commit -m "Description of changes"
git push origin feature-name
```

4. Open a pull request with details

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support
Open issues on our [GitHub repository](https://github.com/Witty-Gerbil/witty_chrome_extension/issues)
