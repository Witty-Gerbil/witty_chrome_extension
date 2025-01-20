from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from app.endpoints import chrome_extention_backend_prompter
from dotenv import load_dotenv
import os

parent_dir = os.path.abspath(os.path.join(os.getcwd(), "../../"))

# Specify the path to the .env file in the parent directory
env_path = os.path.join(parent_dir, ".env")

# Load the .env file from the specified path
load_dotenv(env_path)


app = FastAPI(
    title="Witty Gerbil Chrome Extension Backend",
    description="API backend supporting the Witty Gerbil Chrome Extension.",
    version="1.0.0"
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check
@app.get("/health", tags=["Utility"])
async def health_check():
    return {"status": "healthy"}

# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred."},
    )

# Include Router
app.include_router(chrome_extention_backend_prompter.router, prefix="/api/v1/chrome_extention_backend_prompter")
