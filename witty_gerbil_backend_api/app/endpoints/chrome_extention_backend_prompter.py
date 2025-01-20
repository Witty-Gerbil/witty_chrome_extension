from fastapi import APIRouter, HTTPException, File, UploadFile, Query
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import pandas as pd
import csv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

router = APIRouter()

# Globals
TEMP_DATASET_PATH = "temp_uploaded_dataset"
CURRENT_DF: Optional[pd.DataFrame] = None

DEFAULT_RESULTS_FILE = os.path.join("results", "dataset_results.csv")
os.makedirs("results", exist_ok=True)

class GeneratePromptRequest(BaseModel):
    model: str
    objective: str
    history: List[Dict[str, Any]]
    special_notes: str
    max_turns: int = 1

class CompressHistoryRequest(BaseModel):
    history: List[Dict[str, Any]]

class EvaluateRequest(BaseModel):
    objective: str
    assistant_message: str

class GetDatasetRowsRequest(BaseModel):
    column_name: str

class SaveDatasetResultRequest(BaseModel):
    prompt: str
    response: str
    results_file_path: Optional[str] = None

@router.post("/generate_prompt", response_class=JSONResponse, tags=["Conversational Prompting"])
async def generate_prompt(input_data: GeneratePromptRequest):
    try:
        system_prompt = (
            "You are an advanced prompt engineering assistant specialized in generating strategically "
            "crafted user prompts for a chatbot conversation. "
            "Your primary objective is to create the most effective, context-aware, and goal-oriented next user prompt.\n\n"
            "CORE RESPONSIBILITIES:\n"
            "1. Analyze the conversation context\n"
            "2. Identify the underlying objective\n"
            "3. Generate a prompt that aligns with the objective\n"
            "4. The output must be a JSON with a single key: 'response'\n"
        )

        formatted_history = []
        for h in input_data.history:
            if 'compressed_summary' in h:
                formatted_history.append("[COMPRESSED SUMMARY]: " + h['compressed_summary'])
            else:
                formatted_history.append(h['role'].upper() + ": " + h['content'])

        conversation_str = "\n".join(formatted_history)

        human_prompt = (
            f"Objective:\n{input_data.objective}\n\n"
            f"Conversation History:\n{conversation_str}\n\n"
            f"Special Notes:\n{input_data.special_notes}\n\n"
            "Please produce the next user prompt in JSON with {'response': '...'}."
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ]

        model = ChatOpenAI(model_name=input_data.model, temperature=1)
        structured_model = model.with_structured_output(method="json_mode")
        ai_message = structured_model.invoke(messages)

        return ai_message
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compress_history", response_class=JSONResponse, tags=["Conversational Prompting"])
async def compress_history(input_data: CompressHistoryRequest):
    try:
        formatted_hist = []
        for h in input_data.history:
            if 'compressed_summary' in h:
                formatted_hist.append("COMPRESSED: " + h['compressed_summary'])
            else:
                formatted_hist.append(h['role'].upper() + ": " + h['content'])
        history_text = "\n".join(formatted_hist)

        system_message = (
            "You are a summarization assistant. Given a conversation history, compress it into 3-4 short lines."
            "Return ONLY JSON with a 'compressed_summary' field."
        )

        human_message = f"Here is the conversation history:\n\n{history_text}\n\nSummarize it concisely."

        messages = [
            SystemMessage(content=system_message),
            HumanMessage(content=human_message)
        ]

        model = ChatOpenAI(model_name="gpt-4o", temperature=0.5)
        structured_model = model.with_structured_output(method="json_mode")
        ai_message = structured_model.invoke(messages)
        return ai_message
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evaluate", response_class=JSONResponse, tags=["Conversational Prompting"])
async def evaluate_objective(input_data: EvaluateRequest):
    try:
        system_message = (
            "You are a success evaluator. Given an objective and the assistant's latest response, "
            "determine if the objective has likely been met. Return JSON with {'success': true/false}."
        )

        human_message = (
            f"Objective:\n{input_data.objective}\n\n"
            f"Assistant's last response:\n{input_data.assistant_message}\n\n"
            "Has the objective likely been met?"
        )

        messages = [
            SystemMessage(content=system_message),
            HumanMessage(content=human_message)
        ]

        model = ChatOpenAI(model_name="gpt-4o", temperature=0)
        structured_model = model.with_structured_output(method="json_mode")
        ai_message = structured_model.invoke(messages)
        return ai_message
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================= NEW DATASET ROUTES =================

@router.post("/upload_dataset", tags=["Dataset Handling"])
async def upload_dataset(file: UploadFile = File(...)):
    """
    Upload a CSV or XLSX file, parse column headers, store the DataFrame in memory.
    Returns list of columns.
    """
    global CURRENT_DF
    try:
        file_location = f"{TEMP_DATASET_PATH}_{file.filename}"
        with open(file_location, "wb") as f:
            f.write(await file.read())

        if file.filename.endswith(".csv"):
            df = pd.read_csv(file_location)
        else:
            df = pd.read_excel(file_location)

        CURRENT_DF = df
        columns = list(df.columns)
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class GetDatasetRowsRequest(BaseModel):
    column_name: str

@router.post("/get_dataset_rows", tags=["Dataset Handling"])
async def get_dataset_rows(data: GetDatasetRowsRequest):
    global CURRENT_DF
    try:
        if CURRENT_DF is None:
            raise HTTPException(status_code=400, detail="No dataset is currently uploaded.")

        if data.column_name not in CURRENT_DF.columns:
            raise HTTPException(status_code=400, detail="Selected column not found in dataset.")

        col_data = CURRENT_DF[data.column_name].fillna("").astype(str).tolist()
        return {"rows": col_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SaveDatasetResultRequest(BaseModel):
    prompt: str
    response: str
    results_file_path: Optional[str] = None

@router.post("/save_dataset_result", tags=["Dataset Handling"])
async def save_dataset_result(data: SaveDatasetResultRequest):
    """
    Save a single {prompt, response} to a CSV. Use custom file path if provided.
    """
    try:
        # Determine which file to use
        file_path = data.results_file_path.strip() if data.results_file_path else ""
        if not file_path:
            file_path = DEFAULT_RESULTS_FILE  # Fallback to default

        # Make sure the directory exists
        dir_name = os.path.dirname(file_path)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)

        file_exists = os.path.exists(file_path)
        with open(file_path, mode="a", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=["prompt", "response"])
            if not file_exists:
                writer.writeheader()
            writer.writerow({"prompt": data.prompt, "response": data.response})

        return {"status": "ok", "message": f"Result saved to {file_path}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download_dataset_results", tags=["Dataset Handling"])
async def download_dataset_results(file_path: str = Query("")):
    """
    Return the CSV as a file attachment. If no file_path given, default to 'results/dataset_results.csv'.
    """
    file_path = file_path.strip() if file_path else DEFAULT_RESULTS_FILE
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    return FileResponse(path=file_path, media_type='text/csv', filename=os.path.basename(file_path))


# NEW: Endpoint to clear the existing results file (before a new dataset run)
@router.post("/clear_dataset_results", tags=["Dataset Handling"])
async def clear_dataset_results(file_path: str = Query("")):
    """
    Clears (deletes) the specified results CSV so new runs start fresh.
    If none specified, clears default results path.
    """
    path = file_path.strip() if file_path else DEFAULT_RESULTS_FILE
    if os.path.exists(path):
        os.remove(path)
        return {"status": "ok", "message": f"Results file cleared: {path}"}
    else:
        return {"status": "ok", "message": f"No existing file to clear at: {path}"}
