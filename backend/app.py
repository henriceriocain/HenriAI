from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import gc
import time

app = Flask(__name__)
CORS(app)

def clear_memory():
    """Clear GPU memory"""
    gc.collect()
    torch.cuda.empty_cache() if torch.cuda.is_available() else None

def load_model():
    print("Starting model load process...")
    try:
        print("Attempting to load with 4-bit quantization...")
        start_time = time.time()
        
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True
        )
        
        model = AutoModelForCausalLM.from_pretrained(
            "henriceriocain/HenriAI",
            quantization_config=bnb_config,
            device_map="auto",
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True
        )
        load_time = time.time() - start_time
        print(f"4-bit quantization successful! Load time: {load_time:.2f} seconds")
        
    except Exception as e:
        print(f"4-bit quantization failed: {str(e)}")
        print("Falling back to standard loading...")
        start_time = time.time()
        model = AutoModelForCausalLM.from_pretrained(
            "henriceriocain/HenriAI",
            torch_dtype=torch.float16,
            device_map="auto",
            low_cpu_mem_usage=True
        )
        load_time = time.time() - start_time
        print(f"Standard loading successful! Load time: {load_time:.2f} seconds")

    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained("henriceriocain/HenriAI")
    tokenizer.pad_token = tokenizer.eos_token
    print("Tokenizer loaded successfully!")
    
    return model, tokenizer

print("Initializing model...")
model, tokenizer = load_model()
print("Model initialization complete!")

@app.route('/status', methods=['GET'])
def status():
    return jsonify({'status': 'ready'})

@app.route('/generate', methods=['POST'])
def generate():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        start_time = time.time()
        data = request.json
        user_input = data.get('message', '')
        print(f"Received input: {user_input}")
        
        # Format input
        formatted_input = f"Question: {user_input}\nAnswer:"
        
        # Tokenize
        print("Tokenizing input...")
        inputs = tokenizer(
            formatted_input,
            return_tensors="pt",
            max_length=256,
            truncation=True
        )
        
        # Move inputs to appropriate device
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        print("Generating response...")
        gen_start_time = time.time()
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_length=512,
                temperature=0.7,
                num_return_sequences=1,
                pad_token_id=tokenizer.eos_token_id,
                do_sample=True,
                top_p=0.9
            )
        
        gen_time = time.time() - gen_start_time
        print(f"Generation took {gen_time:.2f} seconds")
        
        # Decode response
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        response = response.split("Answer:")[-1].strip()
        print(f"Generated response: {response}")
        
        # Clear memory
        clear_memory()
        
        total_time = time.time() - start_time
        return jsonify({
            'response': response, 
            'timing': {
                'total_time': f"{total_time:.2f}",
                'generation_time': f"{gen_time:.2f}"
            }
        })
    
    except Exception as e:
        print(f"Error during generation: {str(e)}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

if __name__ == '__main__':
    print("Starting Flask server...")
    app.run(host='localhost', port=8000, debug=False)