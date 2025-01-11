import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import time
import uvicorn

app = FastAPI()

# Configure CORS - Updated to be more permissive
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model configuration
MODEL_NAME = "EleutherAI/gpt-neo-1.3B"
ADAPTER_PATH = "epoch_4"  # Changed to match RunPod path
MAX_LENGTH = 512
TEMPERATURE = 0.7
TOP_P = 0.95

class MessageInput(BaseModel):
    text: str  # Changed from 'message' to 'text' to match frontend

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
    try:
        model = PeftModel.from_pretrained(model, ADAPTER_PATH)
        print("Adapter weights loaded successfully!")
    except Exception as e:
        print(f"Error loading adapter weights: {str(e)}")
        raise
    
    model.eval()
    print("Model loading complete!")

def generate_response(prompt: str) -> tuple[str, dict]:
    start_time = time.time()
    
    try:
        # Tokenize input
        inputs = tokenizer(prompt, return_tensors="pt")
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
        
        # Calculate timing
        end_time = time.time()
        timing = {
            "total_time": round(end_time - start_time, 2)
        }
        
        return response, timing
    except Exception as e:
        print(f"Error in generate_response: {str(e)}")
        raise

@app.post("/generate")
async def generate(prompt: MessageInput):
    try:
        response, timing = generate_response(prompt.text)  # Changed from message to text
        return {"response": response, "timing": timing}
    except Exception as e:
        print(f"Error in generate endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)  # Changed port to 7860 for RunPod