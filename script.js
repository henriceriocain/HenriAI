const messageInput = document.querySelector('.message-input');
const sendButton = document.querySelector('.send-button');
const chatContainer = document.querySelector('.chat-container');
const REQUEST_TIMEOUT = 120000; // 2 minutes timeout

// Create loading stages
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
        // Show user message
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
        
        // Start updating loading message
        updateLoadingMessage(loadingDiv);
        
        try {
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), REQUEST_TIMEOUT)
            );
            
            // Create fetch promise
            const fetchPromise = fetch('http://localhost:8000/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });
            
            // Race between fetch and timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            const data = await response.json();
            
            // Remove loading message
            chatContainer.removeChild(loadingDiv);
            
            // Show AI response
            if (data.response) {
                let responseText = data.response;
                if (data.timing) {
                    responseText += `\n\n(Generated in ${data.timing.total_time} seconds)`;
                }
                appendMessage('bot', responseText);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            // Remove loading message
            if (loadingDiv.parentNode) {
                chatContainer.removeChild(loadingDiv);
            }
            // Show error message
            let errorMessage = 'Sorry, I encountered an error. Please try again.';
            if (error.message === 'Request timed out') {
                errorMessage = 'The request took too long to process. Please try again or try a shorter message.';
            }
            appendMessage('bot', errorMessage);
            console.error('Error:', error);
        }
    }
}

const welcomeNote = document.querySelector('.welcome-note');

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
            ${type === 'user' ? 
                `<div class="message-text">${formattedText}</div>
                 <div class="avatar">U</div>` :
                `<div class="avatar">AI</div>
                 <div class="message-text">${formattedText}</div>`
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

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('input', function() {
    autoResize(this);
});

messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

autoResize(messageInput);