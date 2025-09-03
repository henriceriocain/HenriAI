// ----- Authentication -----
const authScreen = document.getElementById('authScreen');
const passwordSection = document.getElementById('passwordSection');
const nameSection = document.getElementById('nameSection');
const mainContent = document.getElementById('mainContent');
const passwordInput = document.getElementById('passwordInput');
const nameInput = document.getElementById('nameInput');

document.getElementById('passwordSubmit').addEventListener('click', checkPassword);
document.getElementById('nameSubmit').addEventListener('click', submitName);

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); checkPassword(); }
});
nameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitName(); }
});

async function checkPassword() {
  const password = passwordInput.value.trim();
  if (!password) return;

  try {
    const res = await fetch(window.COLAB_API_URL + "/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.ok) {
      passwordSection.classList.add('fade-out');
      setTimeout(() => {
        passwordSection.classList.add('hidden');
        nameSection.classList.remove('hidden');
        nameInput.focus();
      }, 500);
    } else {
      passwordInput.value = '';
      alert("Wrong password.");
    }
  } catch (err) {
    console.error("Auth error:", err);
    alert("Auth server not reachable.");
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

const loadingStages = ["Thinking...", "Processing...", "Still working...", "Almost there...", "Finalizing response..."];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function updateLoadingMessage(loadingDiv) {
  let i = 0;
  while (loadingDiv && loadingDiv.parentNode) {
    const el = loadingDiv.querySelector('.message-text');
    if (el) el.textContent = loadingStages[i];
    i = (i + 1) % loadingStages.length;
    await sleep(10000);
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  appendMessage('user', message);
  messageInput.value = '';
  autoResize(messageInput);

  // Loading placeholder
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-message bot';
  loadingDiv.innerHTML = `
    <div class="message-content">
      <div class="avatar">AI</div>
      <div class="message-text">Initializing...</div>
    </div>`;
  chatContainer.appendChild(loadingDiv);
  updateLoadingMessage(loadingDiv);

  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), REQUEST_TIMEOUT);
    });

    const fetchPromise = (async () => {
      const answer = await henriAIRequest(message, REQUEST_TIMEOUT);
      return { answer };
    })();

    const result = await Promise.race([fetchPromise, timeoutPromise]);

    if (loadingDiv.parentNode) chatContainer.removeChild(loadingDiv);

    if (!result || !result.answer) throw new Error('Empty response from Colab API');
    appendMessage('bot', result.answer);

  } catch (err) {
    if (loadingDiv.parentNode) chatContainer.removeChild(loadingDiv);
    let msg = 'Sorry, I encountered an error. Please try again.';
    if (err && err.message === 'Request timed out') {
      msg = 'The request took too long. Please try again or shorten your question.';
    } else if (err && /COLAB_API_URL/.test(err.message)) {
      msg = 'Backend not configured. Update config.js with your Colab tunnel URL.';
    }
    appendMessage('bot', msg);
    console.error(err);
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
      ${type === 'user'
        ? `<div class="message-text">${formattedText}</div><div class="avatar">U</div>`
        : `<div class="avatar">AI</div><div class="message-text">${formattedText}</div>`
      }
    </div>`;
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  const h = textarea.scrollHeight;
  textarea.style.height = Math.min(h, 150) + 'px';
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('input', function() { autoResize(this); });
messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

autoResize(messageInput);
