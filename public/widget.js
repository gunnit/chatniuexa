(function() {
  'use strict';

  // Get configuration from script tag
  const script = document.currentScript || document.querySelector('script[data-chatbot-id]');
  if (!script) {
    console.error('niuexa.ai widget: No chatbot ID found');
    return;
  }

  const chatbotId = script.getAttribute('data-chatbot-id');
  if (!chatbotId) {
    console.error('niuexa.ai widget: Missing data-chatbot-id attribute');
    return;
  }

  // Get base URL from script src
  const scriptSrc = script.src || '';
  const baseUrl = scriptSrc.replace(/\/widget\.js.*$/, '') || window.location.origin;

  // Generate session ID
  const sessionId = 'widget-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

  // Widget state
  let isOpen = false;
  let chatbot = null;
  let messages = [];
  let isLoading = false;

  // Create widget container with Shadow DOM
  const container = document.createElement('div');
  container.id = 'niuexa-widget-container';
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: 'open' });

  // Inject styles
  const styles = document.createElement('style');
  styles.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .widget-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 999999;
    }

    .widget-button:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }

    .widget-panel {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 500px;
      max-height: calc(100vh - 120px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999998;
    }

    .widget-panel.open {
      display: flex;
    }

    .widget-header {
      padding: 16px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .widget-header h3 {
      font-size: 16px;
      font-weight: 600;
    }

    .widget-close {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .widget-close:hover {
      opacity: 1;
    }

    .widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f9fafb;
    }

    .message {
      margin-bottom: 12px;
      display: flex;
    }

    .message.user {
      justify-content: flex-end;
    }

    .message-content {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
    }

    .message.assistant .message-content {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px 12px 12px 0;
    }

    .message.user .message-content {
      color: white;
      border-radius: 12px 12px 0 12px;
    }

    .message-sources {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #6b7280;
    }

    .message-sources-title {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .message-source {
      background: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
      margin-top: 4px;
    }

    .confidence-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 4px;
    }

    .confidence-high {
      background: #dcfce7;
      color: #166534;
    }

    .confidence-medium {
      background: #fef9c3;
      color: #854d0e;
    }

    .confidence-low {
      background: #fee2e2;
      color: #991b1b;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 10px 14px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      width: fit-content;
    }

    .typing-dot {
      width: 8px;
      height: 8px;
      background: #9ca3af;
      border-radius: 50%;
      animation: typing 1.4s ease-in-out infinite;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }

    .streaming-cursor::after {
      content: '▋';
      animation: blink 1s infinite;
      margin-left: 2px;
    }

    .widget-input {
      padding: 16px;
      background: white;
      border-top: 1px solid #e5e7eb;
    }

    .widget-input form {
      display: flex;
      gap: 8px;
    }

    .widget-input input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .widget-input input:focus {
      border-color: #3b82f6;
    }

    .widget-input button {
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .widget-input button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .widget-branding {
      text-align: center;
      padding: 8px;
      background: #f9fafb;
      font-size: 11px;
      color: #9ca3af;
    }

    .widget-branding a {
      color: #6b7280;
      text-decoration: none;
    }

    .widget-branding a:hover {
      text-decoration: underline;
    }

    @media (max-width: 480px) {
      .widget-panel {
        bottom: 0;
        right: 0;
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }

      .widget-button {
        bottom: 16px;
        right: 16px;
      }
    }
  `;
  shadow.appendChild(styles);

  // Create widget HTML
  const widgetHTML = document.createElement('div');
  widgetHTML.innerHTML = `
    <button class="widget-button" id="widget-toggle">💬</button>
    <div class="widget-panel" id="widget-panel">
      <div class="widget-header" id="widget-header">
        <h3 id="widget-title">Chat</h3>
        <button class="widget-close" id="widget-close">&times;</button>
      </div>
      <div class="widget-messages" id="widget-messages"></div>
      <div class="widget-input">
        <form id="widget-form">
          <input type="text" id="widget-input" placeholder="Type a message..." autocomplete="off" />
          <button type="submit" id="widget-send">Send</button>
        </form>
      </div>
      <div class="widget-branding" id="widget-branding">
        Powered by <a href="https://niuexa.ai" target="_blank" rel="noopener">niuexa.ai</a>
      </div>
    </div>
  `;
  shadow.appendChild(widgetHTML);

  // Get DOM elements
  const toggleBtn = shadow.getElementById('widget-toggle');
  const panel = shadow.getElementById('widget-panel');
  const closeBtn = shadow.getElementById('widget-close');
  const header = shadow.getElementById('widget-header');
  const title = shadow.getElementById('widget-title');
  const messagesContainer = shadow.getElementById('widget-messages');
  const form = shadow.getElementById('widget-form');
  const input = shadow.getElementById('widget-input');
  const sendBtn = shadow.getElementById('widget-send');
  const branding = shadow.getElementById('widget-branding');

  // Load chatbot config
  async function loadChatbot() {
    try {
      const res = await fetch(`${baseUrl}/api/widget/${chatbotId}`);
      if (!res.ok) throw new Error('Failed to load chatbot');
      const data = await res.json();
      chatbot = data.chatbot;

      // Apply styling
      const color = chatbot.primaryColor || '#3B82F6';
      toggleBtn.style.backgroundColor = color;
      header.style.backgroundColor = color;
      sendBtn.style.backgroundColor = color;

      title.textContent = chatbot.name;

      if (!chatbot.showBranding) {
        branding.style.display = 'none';
      }

      // Add welcome message
      if (chatbot.welcomeMessage) {
        addMessage('assistant', chatbot.welcomeMessage);
      }
    } catch (err) {
      console.error('niuexa.ai widget: Failed to load chatbot', err);
    }
  }

  // Add message to UI
  function addMessage(role, content, sources, confidence) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    let html = `<div class="message-content"${role === 'user' && chatbot ? ` style="background-color: ${chatbot.primaryColor}"` : ''}>${escapeHtml(content)}`;

    // Confidence indicator for assistant messages
    if (role === 'assistant' && confidence) {
      const labels = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
      html += `<div class="confidence-indicator confidence-${confidence}">${labels[confidence]}</div>`;
    }

    if (sources && sources.length > 0) {
      html += `<div class="message-sources">
        <div class="message-sources-title">Sources:</div>
        ${sources.map(s => `<div class="message-source">${escapeHtml(s.documentTitle)}</div>`).join('')}
      </div>`;
    }

    html += '</div>';
    msg.innerHTML = html;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Show typing indicator
  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'message assistant';
    typing.id = 'typing-indicator';
    typing.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messagesContainer.appendChild(typing);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTyping() {
    const typing = shadow.getElementById('typing-indicator');
    if (typing) typing.remove();
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Add streaming message element
  function addStreamingMessage() {
    const msg = document.createElement('div');
    msg.className = 'message assistant';
    msg.id = 'streaming-message';
    msg.innerHTML = '<div class="message-content streaming-cursor"></div>';
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msg.querySelector('.message-content');
  }

  // Update streaming message with final metadata
  function finalizeStreamingMessage(sources, confidence) {
    const msg = shadow.getElementById('streaming-message');
    if (!msg) return;

    msg.removeAttribute('id');
    const content = msg.querySelector('.message-content');
    content.classList.remove('streaming-cursor');

    // Add confidence indicator
    if (confidence) {
      const labels = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
      const indicator = document.createElement('div');
      indicator.className = `confidence-indicator confidence-${confidence}`;
      indicator.textContent = labels[confidence];
      content.appendChild(indicator);
    }

    // Add sources
    if (sources && sources.length > 0) {
      const sourcesDiv = document.createElement('div');
      sourcesDiv.className = 'message-sources';
      sourcesDiv.innerHTML = `
        <div class="message-sources-title">Sources:</div>
        ${sources.map(s => `<div class="message-source">${escapeHtml(s.documentTitle)}</div>`).join('')}
      `;
      content.appendChild(sourcesDiv);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Send message with streaming
  async function sendMessage(text) {
    if (!text.trim() || isLoading || !chatbot) return;

    isLoading = true;
    input.disabled = true;
    sendBtn.disabled = true;

    addMessage('user', text);
    showTyping();

    let streamingContent = null;
    let metadata = null;

    try {
      const res = await fetch(`${baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId,
          sessionId,
          message: text,
        }),
      });

      hideTyping();

      if (!res.ok) {
        // Fallback to non-streaming endpoint
        const fallbackRes = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatbotId,
            sessionId,
            message: text,
          }),
        });

        if (!fallbackRes.ok) {
          throw new Error('Failed to send message');
        }

        const data = await fallbackRes.json();
        addMessage('assistant', data.message.content, data.message.sources, data.message.confidence);
        return;
      }

      // Handle streaming response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              // Stream complete
              if (metadata) {
                finalizeStreamingMessage(metadata.sources, metadata.confidence);
              }
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'metadata') {
                // Store metadata for later
                metadata = parsed;
              } else if (parsed.content) {
                // Create streaming message element if not exists
                if (!streamingContent) {
                  streamingContent = addStreamingMessage();
                }
                // Append content
                streamingContent.textContent += parsed.content;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      hideTyping();
      // Remove incomplete streaming message if exists
      const streamingMsg = shadow.getElementById('streaming-message');
      if (streamingMsg) streamingMsg.remove();
      addMessage('assistant', 'Sorry, something went wrong. Please try again.');
    } finally {
      isLoading = false;
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // Event listeners
  toggleBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    toggleBtn.textContent = isOpen ? '✕' : '💬';
    if (isOpen) input.focus();
  });

  closeBtn.addEventListener('click', () => {
    isOpen = false;
    panel.classList.remove('open');
    toggleBtn.textContent = '💬';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
      sendMessage(text);
      input.value = '';
    }
  });

  // Initialize
  loadChatbot();
})();
