# -*- coding: utf-8 -*-
"""Interact.ipynb

Automatically generated by Colab.

Original file is located at
    https://colab.research.google.com/drive/1EQ0qsIACmP4Meza3gHFq5-q94jFfDgZW
"""

# Install necessary libraries
!pip install torch transformers

import torch
from transformers import GPTNeoForCausalLM, GPT2Tokenizer
from google.colab import drive

# Mount Google Drive (if your model is stored on Google Drive)
drive.mount('/drive')

# Set the device (GPU if available)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Path to your GPT-Neo model directory on Google Drive
model_dir = '/drive/MyDrive/HenriAI/myGPTNEO'

# Load the tokenizer and model
tokenizer = GPT2Tokenizer.from_pretrained(model_dir)
model = GPTNeoForCausalLM.from_pretrained(model_dir)

# Move the model to the device
model.to(device)

# Set padding token if it's not already set
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# Set the model to evaluation mode
model.eval()

# Define the text generation function with attention mask
def generate_text(prompt, max_length=50, num_return_sequences=1, temperature=0.1, top_p=0.5, repetition_penalty=1.5):
    # Encode the prompt into tokens
    encoded_input = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True, max_length=512)
    inputs = encoded_input['input_ids'].to(device)
    attention_masks = encoded_input['attention_mask'].to(device)

    # Generate outputs
    with torch.no_grad():
        outputs = model.generate(
            inputs,
            attention_mask=attention_masks,
            max_length=max_length + inputs.shape[1],
            num_return_sequences=num_return_sequences,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            do_sample=True,
            eos_token_id=tokenizer.eos_token_id,
            pad_token_id=tokenizer.pad_token_id
        )

    # Decode the output tokens to text
    generated_texts = []
    for output in outputs:
        text = tokenizer.decode(output, skip_special_tokens=True)
        # Remove the prompt from the generated text
        text = text[len(prompt):].strip()
        generated_texts.append(text)

    return generated_texts

while True:
    prompt = input("You: ")
    if prompt.lower() in ['exit', 'quit']:
        break
    generated_texts = generate_text(prompt)
    print(f"AI: {generated_texts[0]}\n")