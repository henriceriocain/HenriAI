// ----- Authentication -----
const CORRECT_PASSWORD = "test1"; 

const authScreen = document.getElementById('authScreen');
const passwordSection = document.getElementById('passwordSection');
const nameSection = document.getElementById('nameSection');
const mainContent = document.getElementById('mainContent');
const passwordInput = document.getElementById('passwordInput');
const nameInput = document.getElementById('nameInput');

document.getElementById('passwordSubmit').addEventListener('click', checkPassword);
document.getElementById('nameSubmit').addEventListener('click', submitName);

passwordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        checkPassword();
    }
});

nameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitName();
    }
});

function checkPassword() {
    const password = passwordInput.value.trim();
    if (password === CORRECT_PASSWORD) {
        passwordSection.classList.add('fade-out');
        setTimeout(() => {
            passwordSection.classList.add('hidden');
            nameSection.classList.remove('hidden');
            nameInput.focus();
        }, 500);
    } else {
        passwordInput.value = '';
    }
}

function submitName() {
    const name = nameInput.value.trim();
    if (name) {
        authScreen.classList.add('fade-out');
        setTimeout(() => {
            authScreen.classList.add('hidden');
            mainContent.classList.remove('hidden');
        }, 500);
    }
}

// ----- Chat -----
const messageInput = document.querySelector('.message-input');
const sendButton = document.querySelector('.send-button');
const chatContainer = document.querySelector('.chat-container');
const welcomeNote = document.querySelector('.welcome-note');
const REQUEST_TIMEOUT = 240000; // 4 minutes

// Loading stages shown in the AI placeholder
const loadingStages = [
    "Thinking...",
    "Processing...",
    "Still working...",
    "Almost there...",
    "Finalizing response..."
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateLoadingMessage(loadingDiv) {
    let stageIndex = 0;
    while (loadingDiv && loadingDiv.parentNode) {
        loadingDiv.querySelector('.message-text').textContent = loadingStages[stageIndex];
        stageIndex = (stageIndex + 1) % loadingStages.length;
        await sleep(10000); // Update every 10 seconds
    }
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        appendMessage('user', message);
        messageInput.value = '';
        autoResize(messageInput);
        
        // Create and show loading message
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message bot';
        loadingDiv.innerHTML = `
            <div class="message-content">
                <div class="avatar">AI</div>
                <div class="message-text">Initializing...</div>
            </div>
        `;
        chatContainer.appendChild(loadingDiv);
        
        updateLoadingMessage(loadingDiv);
        
        try {
            // Create a timeout so it doesn't hang forever
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), REQUEST_TIMEOUT)
            );
            
            // Fetch from your public Hugging Face Inference Endpoint (no token needed)
            const fetchPromise = fetch("https://xbx8ej11mghp3mkw.us-east-1.aws.endpoints.huggingface.cloud", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: `Question: ${message}\nAnswer:`,
                    parameters: {
                        max_new_tokens: 128,
                        temperature: 0.7,
                        do_sample: true
                    }
                }),
                mode: 'cors'
            });
            
            // Race the network request against the timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            const data = await response.json();
            
            console.log(data); // Debug: see the full raw response
            
            // Remove loading message
            chatContainer.removeChild(loadingDiv);
            
            // data is an array with an object containing generated_text
            if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
                // Post-process so we only show text after "Answer:"
                let rawOutput = data[0].generated_text;
                let answerPart = rawOutput;
                
                // If the output includes "Answer:", split to only show content after it
                if (rawOutput.includes("Answer:")) {
                    // Splits on "Answer:" and takes the final chunk
                    answerPart = rawOutput.split("Answer:").pop().trim();
                }
                
                appendMessage('bot', answerPart);
            } else {
                throw new Error('No generated_text field found in response.');
            }
        } catch (error) {
            // Remove loading message
            if (loadingDiv.parentNode) {
                chatContainer.removeChild(loadingDiv);
            }
            let errorMessage = 'Sorry, I encountered an error. Please try again.';
            if (error.message === 'Request timed out') {
                errorMessage = 'The request took too long. Please try again or shorten your question.';
            }
            appendMessage('bot', errorMessage);
            console.error('Error:', error);
        }
    }
}

messageInput.addEventListener('input', function() {
    autoResize(this);
    if (this.value.trim() !== '') {
        welcomeNote.classList.add('hidden');
    } else if (chatContainer.children.length <= 1) {
        welcomeNote.classList.remove('hidden');
    }
});

function appendMessage(type, text) {
    welcomeNote.classList.add('hidden');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    const formattedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
    
    messageDiv.innerHTML = `
        <div class="message-content">
            ${
                type === 'user'
                    ? `<div class="message-text">${formattedText}</div><div class="avatar">U</div>`
                    : `<div class="avatar">AI</div><div class="message-text">${formattedText}</div>`
            }
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    const newHeight = textarea.scrollHeight;
    textarea.style.height = Math.min(newHeight, 150) + 'px';
}

// Send message on button click
sendButton.addEventListener('click', sendMessage);

// Auto-resize on input
messageInput.addEventListener('input', function() {
    autoResize(this);
});

// Send message on enter
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Initialize
autoResize(messageInput);
