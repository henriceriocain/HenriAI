# server.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import time
import logging
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.henriai.ca"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

class MessageInput(BaseModel):
    text: str

# Keys
HF_TOKEN = os.getenv('HF_TOKEN')
ENDPOINT_URL = os.getenv('ENDPOINT_URL')

headers = {
    "Authorization": f"Bearer {HF_TOKEN}",
    "Content-Type": "application/json"
}

@app.post("/generate")
async def generate_text(message: MessageInput):
    try:
        logger.info(f"Received message: {message.text}")
        start_time = time.time()
        
        # Format the prompt
        formatted_prompt = f"Question: {message.text}\nAnswer:"
        logger.info(f"Formatted prompt: {formatted_prompt}")
        
        # Make request to Inference Endpoint
        try:
            response = requests.post(
                ENDPOINT_URL,
                headers=headers,
                json={
                    "inputs": formatted_prompt,
                    "parameters": {
                        "max_length": 512,
                        "temperature": 0.7,
                        "top_p": 0.95,
                        "do_sample": True,
                        "return_full_text": False
                    }
                },
                timeout=30
            )
            
            logger.info(f"Response status: {response.status_code}")
            logger.info(f"Response content: {response.text}")
            
            if response.status_code == 503:
                return {
                    "response": "Model is loading, please try again in a minute",
                    "timing": {"total_time": None}
                }
            
            response.raise_for_status()
            result = response.json()[0]["generated_text"]
            
            # Clean up response
            answer = result.split("Answer:", 1)[1].strip() if "Answer:" in result else result
            
            generation_time = time.time() - start_time
            
            return {
                "response": answer,
                "timing": {"total_time": round(generation_time, 2)}
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
            
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.options("/generate")
async def preflight():
    return {"message": "Preflight checks passed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)