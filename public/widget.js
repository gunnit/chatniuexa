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
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 999999;
      color: white;
    }

    .widget-button:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
    }

    .widget-button:active {
      transform: scale(1.02);
    }

    .widget-panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 48px);
      height: 520px;
      max-height: calc(100vh - 130px);
      background: white;
      border-radius: 20px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999998;
    }

    .widget-panel.open {
      display: flex;
      animation: slideUp 0.25s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .widget-header {
      padding: 16px 20px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 56px;
    }

    .widget-header h3 {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
      flex: 1;
      margin: 0;
    }

    .widget-close {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      transition: background-color 0.2s;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .widget-close:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f8fafc;
    }

    .message {
      margin-bottom: 16px;
      display: flex;
    }

    .message:last-child {
      margin-bottom: 8px;
    }

    .message.user {
      justify-content: flex-end;
    }

    .message-content {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .message.assistant .message-content {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 16px 16px 16px 4px;
      color: #1f2937;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .message.user .message-content {
      color: white;
      border-radius: 16px 16px 4px 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .message-sources {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #374151;
    }

    .message-sources-title {
      font-weight: 600;
      margin-bottom: 6px;
      color: #1f2937;
    }

    .message-source {
      background: #f3f4f6;
      padding: 6px 10px;
      border-radius: 6px;
      margin-top: 4px;
      color: #4b5563;
      line-height: 1.4;
    }

    .confidence-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 6px;
      margin-top: 8px;
    }

    .confidence-high {
      background: #dcfce7;
      color: #15803d;
    }

    .confidence-medium {
      background: #fef3c7;
      color: #92400e;
    }

    .confidence-low {
      background: #fee2e2;
      color: #b91c1c;
    }

    /* Markdown styles */
    .md-p {
      margin: 0 0 8px 0;
    }

    .md-p:last-child {
      margin-bottom: 0;
    }

    .md-h2, .md-h3, .md-h4 {
      margin: 12px 0 6px 0;
      font-weight: 600;
      line-height: 1.3;
    }

    .md-h2 { font-size: 16px; }
    .md-h3 { font-size: 15px; }
    .md-h4 { font-size: 14px; }

    .md-code-block {
      background: #1e293b;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      margin: 8px 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .md-inline-code {
      background: #f1f5f9;
      color: #be185d;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
    }

    .md-ul, .md-ol {
      margin: 8px 0;
      padding-left: 20px;
    }

    .md-li, .md-oli {
      margin: 4px 0;
      line-height: 1.5;
    }

    .md-link {
      color: #2563eb;
      text-decoration: none;
    }

    .md-link:hover {
      text-decoration: underline;
    }

    /* Message reactions */
    .message-reactions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
    }

    .reaction-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #f9fafb;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.15s;
    }

    .reaction-btn:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
      color: #374151;
    }

    .reaction-btn.active {
      background: #dbeafe;
      border-color: #3b82f6;
      color: #2563eb;
    }

    .reaction-btn.active[data-reaction="down"] {
      background: #fee2e2;
      border-color: #ef4444;
      color: #dc2626;
    }

    /* Quick reply suggestions */
    .widget-suggestions {
      padding: 8px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .suggestion-chip {
      display: inline-flex;
      align-items: center;
      padding: 8px 14px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 20px;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .suggestion-chip:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
    }

    .widget-suggestions.hidden {
      display: none;
    }

    /* Clear chat button */
    .widget-clear {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: background-color 0.2s;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .widget-clear:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .widget-clear svg {
      width: 16px;
      height: 16px;
    }

    .typing-indicator {
      display: flex;
      gap: 5px;
      padding: 14px 18px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 16px 16px 16px 4px;
      width: fit-content;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .typing-dot {
      width: 8px;
      height: 8px;
      background: #6b7280;
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
      padding: 12px 16px 16px;
      background: white;
      border-top: 1px solid #e5e7eb;
    }

    .widget-input form {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .widget-input input {
      flex: 1;
      padding: 12px 14px;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      color: #1f2937;
      background: #fafafa;
    }

    .widget-input input::placeholder {
      color: #6b7280;
    }

    .widget-input input:focus {
      border-color: var(--widget-primary-color, #3b82f6);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      background: white;
    }

    .widget-input button {
      padding: 12px 20px;
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      min-width: 70px;
    }

    .widget-input button:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .widget-input button:active:not(:disabled) {
      transform: translateY(0);
    }

    .widget-input button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .widget-branding {
      text-align: center;
      padding: 10px 16px;
      background: #f3f4f6;
      font-size: 12px;
      color: #4b5563;
      border-top: 1px solid #e5e7eb;
    }

    .widget-branding a {
      color: #1f2937;
      text-decoration: none;
      font-weight: 500;
    }

    .widget-branding a:hover {
      text-decoration: underline;
      color: #111827;
    }

    @media (max-width: 480px) {
      .widget-panel {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
        animation: slideUpMobile 0.2s ease-out;
      }

      @keyframes slideUpMobile {
        from {
          opacity: 0;
          transform: translateY(100%);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .widget-button {
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        font-size: 24px;
      }

      .widget-header {
        padding: 14px 16px;
        min-height: 52px;
      }

      .widget-input {
        padding: 10px 12px 14px;
      }

      .widget-input input {
        padding: 10px 12px;
      }

      .widget-input button {
        padding: 10px 14px;
        min-width: 60px;
      }

      .message-content {
        max-width: 90%;
        padding: 10px 14px;
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
        <button class="widget-clear" id="widget-clear" title="Clear chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
        <button class="widget-close" id="widget-close">&times;</button>
      </div>
      <div class="widget-suggestions" id="widget-suggestions"></div>
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
  const clearBtn = shadow.getElementById('widget-clear');
  const header = shadow.getElementById('widget-header');
  const title = shadow.getElementById('widget-title');
  const suggestionsContainer = shadow.getElementById('widget-suggestions');
  const messagesContainer = shadow.getElementById('widget-messages');
  const form = shadow.getElementById('widget-form');
  const input = shadow.getElementById('widget-input');
  const sendBtn = shadow.getElementById('widget-send');
  const branding = shadow.getElementById('widget-branding');

  // LocalStorage key for this chatbot
  const storageKey = `niuexa-chat-${chatbotId}`;

  // Get stored session or create new one
  function getStoredSession() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        // Check if session is less than 24 hours old
        if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
    return null;
  }

  // Save conversation to localStorage
  function saveConversation() {
    try {
      const messageElements = messagesContainer.querySelectorAll('.message');
      const savedMessages = [];

      messageElements.forEach(el => {
        const role = el.classList.contains('user') ? 'user' : 'assistant';
        const content = el.querySelector('.message-content');
        if (content) {
          // For assistant messages, get the text content without reactions/sources
          let text = '';
          if (role === 'assistant') {
            // Get text from markdown paragraphs
            const paragraphs = content.querySelectorAll('.md-p');
            if (paragraphs.length > 0) {
              text = Array.from(paragraphs).map(p => p.textContent).join('\n\n');
            } else {
              text = content.firstChild?.textContent || content.textContent || '';
            }
          } else {
            text = content.textContent || '';
          }
          if (text.trim()) {
            savedMessages.push({ role, content: text.trim() });
          }
        }
      });

      localStorage.setItem(storageKey, JSON.stringify({
        messages: savedMessages,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }

  // Clear conversation
  function clearConversation() {
    localStorage.removeItem(storageKey);
    messagesContainer.innerHTML = '';
    messages = [];

    // Re-show suggestions
    suggestionsContainer.classList.remove('hidden');

    // Add welcome message back
    if (chatbot?.welcomeMessage) {
      addMessage('assistant', chatbot.welcomeMessage);
    }
  }

  // Load stored messages into UI
  function loadStoredMessages(storedData) {
    if (!storedData?.messages?.length) return false;

    storedData.messages.forEach(msg => {
      addMessage(msg.role, msg.content);
    });

    // Hide suggestions if there are messages
    if (storedData.messages.length > 0) {
      suggestionsContainer.classList.add('hidden');
    }

    return true;
  }

  // Render suggestion chips
  function renderSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) {
      suggestionsContainer.classList.add('hidden');
      return;
    }

    suggestionsContainer.innerHTML = suggestions.map(s =>
      `<button class="suggestion-chip">${escapeHtml(s)}</button>`
    ).join('');

    suggestionsContainer.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.textContent;
        input.value = text;
        suggestionsContainer.classList.add('hidden');
        sendMessage(text);
        input.value = '';
      });
    });
  }

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

      // Render suggestions if available
      if (chatbot.suggestedPrompts && chatbot.suggestedPrompts.length > 0) {
        renderSuggestions(chatbot.suggestedPrompts);
      } else {
        suggestionsContainer.classList.add('hidden');
      }

      // Try to load stored conversation
      const storedData = getStoredSession();
      if (storedData && loadStoredMessages(storedData)) {
        // Loaded from storage, don't show welcome
      } else if (chatbot.welcomeMessage) {
        // Add welcome message for new conversations
        addMessage('assistant', chatbot.welcomeMessage);
      }
    } catch (err) {
      console.error('niuexa.ai widget: Failed to load chatbot', err);
    }
  }

  // Add message to UI
  function addMessage(role, content, sources, confidence, messageId) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    if (messageId) msg.setAttribute('data-message-id', messageId);

    // Use markdown for assistant, escape for user
    const renderedContent = role === 'assistant' ? parseMarkdown(content) : escapeHtml(content);

    let html = `<div class="message-content"${role === 'user' && chatbot ? ` style="background-color: ${chatbot.primaryColor}"` : ''}>${renderedContent}`;

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

    // Add reactions for assistant messages (except welcome message)
    if (role === 'assistant' && messageId) {
      html += `
        <div class="message-reactions">
          <button class="reaction-btn" data-reaction="up" title="Helpful">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
          </button>
          <button class="reaction-btn" data-reaction="down" title="Not helpful">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
            </svg>
          </button>
        </div>`;
    }

    html += '</div>';
    msg.innerHTML = html;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add reaction event listeners
    if (role === 'assistant' && messageId) {
      msg.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', () => handleReaction(btn, messageId));
      });
    }

    // Save after user messages
    if (role === 'user') {
      saveConversation();
    }
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

  // Lightweight markdown parser for assistant messages
  function parseMarkdown(text) {
    // Escape HTML first for security
    let html = escapeHtml(text);

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="md-code-block"><code>${code.trim()}</code></pre>`;
    });

    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/(?<![a-zA-Z])_([^_]+)_(?![a-zA-Z])/g, '<em>$1</em>');

    // Headers (## Header)
    html = html.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>');

    // Unordered lists (- item or * item)
    html = html.replace(/^[\-\*] (.+)$/gm, '<li class="md-li">$1</li>');
    html = html.replace(/(<li class="md-li">.*<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>');

    // Ordered lists (1. item)
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>');
    html = html.replace(/(<li class="md-oli">.*<\/li>\n?)+/g, '<ol class="md-ol">$&</ol>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');

    // Line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, '</p><p class="md-p">');
    html = '<p class="md-p">' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p class="md-p"><\/p>/g, '');
    html = html.replace(/<p class="md-p">(<(?:ul|ol|pre|h[2-4])[^>]*>)/g, '$1');
    html = html.replace(/(<\/(?:ul|ol|pre|h[2-4])>)<\/p>/g, '$1');

    // Single line breaks within paragraphs
    html = html.replace(/\n/g, '<br>');

    return html;
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
  function finalizeStreamingMessage(sources, confidence, messageId) {
    const msg = shadow.getElementById('streaming-message');
    if (!msg) return;

    msg.removeAttribute('id');
    if (messageId) msg.setAttribute('data-message-id', messageId);
    const content = msg.querySelector('.message-content');
    content.classList.remove('streaming-cursor');

    // Get raw text and apply markdown rendering
    const rawText = content.textContent || '';
    content.innerHTML = parseMarkdown(rawText);

    // Add reactions for assistant messages
    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'message-reactions';
    reactionsDiv.innerHTML = `
      <button class="reaction-btn" data-reaction="up" title="Helpful">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <button class="reaction-btn" data-reaction="down" title="Not helpful">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
      </button>
    `;
    content.appendChild(reactionsDiv);

    // Add reaction event listeners
    reactionsDiv.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', () => handleReaction(btn, messageId));
    });

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

    // Save to localStorage
    saveConversation();

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Handle reaction click
  async function handleReaction(btn, messageId) {
    const reaction = btn.getAttribute('data-reaction');
    const reactionsDiv = btn.parentElement;

    // Visual feedback
    reactionsDiv.querySelectorAll('.reaction-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Send to server if messageId exists
    if (messageId) {
      try {
        await fetch(`${baseUrl}/api/chat/reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            reaction,
            sessionId,
          }),
        });
      } catch (err) {
        console.error('Failed to save reaction:', err);
      }
    }
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
        addMessage('assistant', data.message.content, data.message.sources, data.message.confidence, data.message.id);
        saveConversation();
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
              finalizeStreamingMessage(
                metadata?.sources,
                metadata?.confidence,
                metadata?.messageId
              );
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'metadata') {
                // Store metadata for later
                metadata = parsed;
              } else if (parsed.messageId) {
                // Store message ID
                metadata = metadata || {};
                metadata.messageId = parsed.messageId;
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

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear chat history?')) {
      clearConversation();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
      // Hide suggestions after first message
      suggestionsContainer.classList.add('hidden');
      sendMessage(text);
      input.value = '';
    }
  });

  // Initialize
  loadChatbot();
})();
