// Minimal client for Colab FastAPI
async function henriAIRequest(message, timeoutMs = 240000) {
  if (!window.COLAB_API_URL || !/^https:\/\/.+trycloudflare\.com/.test(window.COLAB_API_URL)) {
    throw new Error("COLAB_API_URL missing or invalid. Update config.js with the tunnel URL.");
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(`${window.COLAB_API_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    mode: "cors",
    body: JSON.stringify({ text: message }),
    signal: controller.signal
  }).catch((e) => {
    clearTimeout(t);
    throw e;
  });

  clearTimeout(t);

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const data = await res.json();
  // API returns: { response: "...", timing: { seconds: n } }
  return (data && data.response) ? data.response : "";
}

