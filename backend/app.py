# app.py
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import time
import uvicorn

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model configuration
MODEL_NAME = "EleutherAI/gpt-neo-1.3B"
ADAPTER_PATH = "./adapters/epoch_4"  
MAX_LENGTH = 512
TEMPERATURE = 0.7
TOP_P = 0.95

class MessageInput(BaseModel):
    message: str

# Load model and tokenizer
@app.on_event("startup")
async def startup_event():
    global model, tokenizer
    
    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenizer.pad_token = tokenizer.eos_token
    
    print("Loading base model...")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    print("Loading adapter weights...")
    model = PeftModel.from_pretrained(model, ADAPTER_PATH)
    model.eval()
    
    print("Model loading complete!")

def generate_response(prompt: str) -> tuple[str, dict]:
    start_time = time.time()
    
    # Format the prompt
    formatted_prompt = f"Human: {prompt}\nAssistant:"
    
    # Tokenize input
    inputs = tokenizer(formatted_prompt, return_tensors="pt")
    inputs = {k: v.to(model.device) for k, v in inputs.items()}
    
    # Generate response
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_length=MAX_LENGTH,
            temperature=TEMPERATURE,
            top_p=TOP_P,
            pad_token_id=tokenizer.eos_token_id,
            do_sample=True
        )
    
    # Decode response
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # Extract assistant's response
    response = response.split("Assistant:")[-1].strip()
    
    # Calculate timing
    end_time = time.time()
    timing = {
        "total_time": round(end_time - start_time, 2)
    }
    
    return response, timing

@app.post("/generate")
async def generate(message: MessageInput):
    try:
        response, timing = generate_response(message.message)
        return {"response": response, "timing": timing}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)