# start_server.py
import os
from dotenv import load_dotenv
import uvicorn

#grab the parent directory path where the .env file is
parent_dir = os.path.abspath(os.path.join(os.getcwd(), ".."))

# Specify the path to the .env file in the parent directory
env_path = os.path.join(parent_dir, ".env")

# Load the .env file from the specified path
load_dotenv(env_path)

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

if __name__ == "__main__":
    # Start the uvicorn server with the loaded environment variables
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
