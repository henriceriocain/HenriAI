# app.py
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel
import time
import uvicorn

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.henriai.ca"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model configuration
MODEL_NAME = "EleutherAI/gpt-j-6B"
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
    
    # Configure 4-bit quantization
    print("Configuring quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    
    print("Loading base model...")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.float16
    )
    
    print("Loading adapter weights...")
    model = PeftModel.from_pretrained(model, ADAPTER_PATH)
    model.eval()
    
    print("Model loading complete!")

def generate_response(prompt: str) -> tuple[str, dict]:
    start_time = time.time()
    
    # Format the prompt according to your training format
    formatted_prompt = f"Question: {prompt}\nAnswer:"
    
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
    
    # Extract answer portion
    response = response.split("Answer:", 1)[1].strip() if "Answer:" in response else response
    
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