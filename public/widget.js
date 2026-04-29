(function() {
  'use strict';

  // ── Bootstrap ────────────────────────────────────────────────────
  const script = document.currentScript || document.querySelector('script[data-chatbot-id]');
  if (!script) { console.error('ChatAziendale.it widget: No chatbot ID found'); return; }
  const chatbotId = script.getAttribute('data-chatbot-id');
  if (!chatbotId) { console.error('ChatAziendale.it widget: Missing data-chatbot-id'); return; }
  const baseUrl = (script.src || '').replace(/\/widget\.js.*$/, '') || window.location.origin;
  const sessionId = 'widget-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);

  // ── Color helpers ───────────────────────────────────────────────
  function hexToRgb(hex) {
    const h = (hex || '#3B82F6').replace('#', '');
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(n, 16) || 0;
    return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
  }
  function rgba(hex, a) { const { r, g, b } = hexToRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
  function shade(hex, pct) {
    const { r, g, b } = hexToRgb(hex);
    const f = c => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * (pct > 0 ? 255 - c : c))));
    return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  // ── Icons ───────────────────────────────────────────────────────
  const ICONS = {
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M12 4 C 9 8, 8 11, 9 15 C 10 17, 12 18, 12 21 C 12 18, 14 17, 15 15 C 16 11, 15 8, 12 4 Z" fill="currentColor" stroke="none" fill-opacity="0.95"/><path d="M19 5 L 19.6 6.4 L 21 7 L 19.6 7.6 L 19 9 L 18.4 7.6 L 17 7 L 18.4 6.4 Z" fill="currentColor" stroke="none"/><path d="M5 14 L 5.4 15 L 6.4 15.4 L 5.4 15.8 L 5 16.8 L 4.6 15.8 L 3.6 15.4 L 4.6 15 Z" fill="currentColor" stroke="none"/></svg>',
    avatarMark: '<svg viewBox="0 0 20 20" fill="none"><path d="M10 3 C 7 6, 6 9, 7 12 C 8 14, 10 15, 10 17 C 10 15, 12 14, 13 12 C 14 9, 13 6, 10 3 Z" fill="white" fill-opacity="0.95"/><circle cx="10" cy="11.5" r="1.4" fill="rgba(0,0,0,0.18)"/></svg>',
    expand: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10 3h3v3M13 3l-4 4M6 13H3v-3M3 13l4-4"/></svg>',
    compact: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 7l4-4M13 3v3M13 3h-3M7 9l-4 4M3 13v-3M3 13h3"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a5 5 0 019-3M13 8a5 5 0 01-9 3M11 5h2V3M5 11H3v2"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    arrow: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h8M7 3l4 4-4 4"/></svg>',
    send: '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12V2M3 6l4-4 4 4"/></svg>',
    thumbUp: '<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5v5H2.5a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5H4zM4 6.5L6.5 2a1.5 1.5 0 011.5 1v3h3a1 1 0 011 1l-1 4a1 1 0 01-1 .5H4"/></svg>',
    thumbDown: '<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(180deg)"><path d="M4 6.5v5H2.5a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5H4zM4 6.5L6.5 2a1.5 1.5 0 011.5 1v3h3a1 1 0 011 1l-1 4a1 1 0 01-1 .5H4"/></svg>',
    copy: '<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V3a1 1 0 011-1h7"/></svg>',
    spinner: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="11" height="11"><path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.4 1.4M8.1 8.1l1.4 1.4M2.5 9.5l1.4-1.4M8.1 3.9l1.4-1.4"/></svg>',
  };

  const PRESET_LAUNCHER_ICONS = {
    headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
    robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    'message-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  };

  function getLauncherIconHTML(config) {
    if (!config) return ICONS.spark;
    if (config.chatIconType === 'preset' && config.chatIconPreset && PRESET_LAUNCHER_ICONS[config.chatIconPreset]) {
      return PRESET_LAUNCHER_ICONS[config.chatIconPreset];
    }
    if (config.chatIconType === 'custom' && config.chatIconImage) {
      const fallback = ICONS.spark.replace(/'/g, "\\'");
      return '<img src="' + config.chatIconImage + '" alt="" width="32" height="32" style="display:block;pointer-events:none;border-radius:8px;" onerror="this.parentElement.innerHTML=\'' + fallback + '\'">';
    }
    return ICONS.spark;
  }

  // Avatar icon — fills the gradient square. Preset SVGs render white via currentColor;
  // custom images cover the full square. Falls back to the spark mark.
  function getAvatarIconHTML(config) {
    if (config && config.chatIconType === 'preset' && config.chatIconPreset && PRESET_LAUNCHER_ICONS[config.chatIconPreset]) {
      return PRESET_LAUNCHER_ICONS[config.chatIconPreset];
    }
    if (config && config.chatIconType === 'custom' && config.chatIconImage) {
      const fallback = ICONS.avatarMark.replace(/'/g, "\\'");
      return '<img src="' + config.chatIconImage + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.innerHTML=\'' + fallback + '\'">';
    }
    return ICONS.avatarMark;
  }

  // ── State ────────────────────────────────────────────────────────
  let chatbot = null;
  let mode = 'launcher';
  let isLoading = false;
  let messageCount = 0;

  // ── Container + Shadow DOM ──────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'chataziendale-widget-container';
  document.body.appendChild(container);
  const shadow = container.attachShadow({ mode: 'open' });

  // ── Styles ───────────────────────────────────────────────────────
  const styles = document.createElement('style');
  styles.textContent = `
    :host { all: initial; }
    * {
      box-sizing: border-box; margin: 0; padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    }

    .root {
      --bg: #f6f1ea;
      --paper: #fefcf8;
      --paper-hi: #fffefb;
      --fg: #1a1410;
      --fg-mute: rgba(26,20,16,0.6);
      --fg-faint: rgba(26,20,16,0.36);
      --line: rgba(26,20,16,0.07);
      --line-hi: rgba(26,20,16,0.14);
      --chip: #f3ede4;
      --user-bubble: #1a1410;
      --user-bubble-text: #fefcf8;
      --accent: #3b82f6;
      --accent-soft: rgba(59,130,246,0.10);
      --accent-faint: rgba(59,130,246,0.08);
      --accent-line: rgba(59,130,246,0.40);
      --accent-shade-pos: #4f8df7;
      --accent-shade-pos2: #6da3f9;
      --accent-shade-neg: #2266dd;
      --launcher-c1: #3b82f6;
      --launcher-c2: #2266dd;
      --shadow-glow: rgba(59,130,246,0.50);
      --shadow-soft: rgba(59,130,246,0.30);
    }

    /* ── Launcher ──────────────────────────────────────────── */
    .launcher {
      position: fixed; right: 24px; bottom: 24px; z-index: 2147483645;
      width: 60px; height: 60px; border-radius: 22px; border: none; cursor: pointer;
      background: linear-gradient(135deg, var(--launcher-c1), var(--launcher-c2));
      color: #fff; display: flex; align-items: center; justify-content: center;
      box-shadow:
        0 14px 30px -8px var(--shadow-glow),
        0 6px 14px -4px var(--shadow-soft),
        inset 0 1px 0 rgba(255,255,255,0.25);
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      opacity: 0;
    }
    .launcher.ready { opacity: 1; }
    .launcher:hover { transform: scale(1.06); }
    .launcher:active { transform: scale(0.96); }
    .launcher.hidden { opacity: 0; pointer-events: none; transform: scale(0.85); }
    .launcher::before {
      content: ''; position: absolute; inset: -6px; border-radius: 28px;
      border: 1.5px solid var(--launcher-c1); opacity: 0.5; pointer-events: none;
      animation: cw-halo 2.4s infinite ease-out;
    }
    .launcher svg, .launcher img { pointer-events: none; display: block; }
    @keyframes cw-halo {
      0% { transform: scale(0.9); opacity: 0.55; }
      100% { transform: scale(1.35); opacity: 0; }
    }

    /* ── Widget shell ──────────────────────────────────────── */
    .widget {
      position: fixed; right: 24px; bottom: 24px; z-index: 2147483646;
      width: 400px; height: 620px;
      max-width: calc(100vw - 48px); max-height: calc(100vh - 48px);
      background: var(--bg); border-radius: 26px; overflow: hidden;
      color: var(--fg);
      box-shadow:
        0 24px 60px -18px var(--shadow-soft),
        0 12px 36px -8px rgba(26,20,16,0.18),
        0 0 0 1px rgba(26,20,16,0.05);
      display: none; flex-direction: column;
      transition: width 0.32s cubic-bezier(0.4, 0, 0.2, 1), height 0.32s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .widget.open { display: flex; animation: cw-in 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
    .widget.focus { width: 740px; height: 760px; }
    @keyframes cw-in {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }

    .widget-bg {
      position: absolute; inset: 0; pointer-events: none; z-index: 0;
      background:
        radial-gradient(ellipse 600px 320px at 70% -10%, var(--accent-faint), transparent 60%),
        radial-gradient(ellipse 500px 280px at 0% 110%, var(--accent-faint), transparent 60%);
    }
    .header, .body, .composer-wrap { position: relative; z-index: 1; }

    /* ── Header ─────────────────────────────────────────────── */
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 14px 14px 18px;
      border-bottom: 1px solid var(--line);
      flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .avatar {
      flex-shrink: 0; border-radius: 32%;
      background: linear-gradient(135deg, var(--accent-shade-pos), var(--accent-shade-neg));
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px var(--accent-soft), inset 0 1px 0 rgba(255,255,255,0.25);
      position: relative; overflow: hidden;
    }
    .avatar.lg { width: 32px; height: 32px; }
    .avatar.sm { width: 26px; height: 26px; }
    .avatar svg { width: 62%; height: 62%; }
    .avatar img { display: block; }
    .avatar.thinking svg { animation: cw-pulse 1.2s infinite; }
    .header-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .header-title { display: flex; align-items: center; gap: 7px; flex-wrap: nowrap; }
    .header-title .name {
      font-size: 14px; font-weight: 600; letter-spacing: -0.2px; color: var(--fg);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;
    }
    .header-title .lang {
      font-size: 9.5px; color: var(--accent); font-weight: 700; letter-spacing: 0.5px;
      font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
      padding: 2px 6px; background: var(--accent-soft); border-radius: 4px;
      white-space: nowrap; flex-shrink: 0;
    }
    .header-status {
      display: flex; align-items: center; gap: 5px; font-size: 11px;
      color: var(--fg-mute); white-space: nowrap;
    }
    .header-status .dot {
      width: 6px; height: 6px; border-radius: 3px; background: #22c55e;
      box-shadow: 0 0 6px rgba(34,197,94,0.5); flex-shrink: 0;
      animation: cw-pulse 2.2s infinite;
    }
    .header-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
    .icon-btn {
      width: 30px; height: 30px; border-radius: 9px; border: none; cursor: pointer;
      background: transparent; color: var(--fg-mute);
      display: flex; align-items: center; justify-content: center;
      transition: background-color 0.12s, color 0.12s, transform 0.1s;
    }
    .icon-btn:hover { background: var(--chip); color: var(--fg); }
    .icon-btn:active { transform: scale(0.94); }

    /* ── Body ───────────────────────────────────────────────── */
    .body {
      flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
      padding: 18px 18px 12px;
      display: flex; flex-direction: column; gap: 14px;
      scrollbar-width: thin; scrollbar-color: var(--line-hi) transparent;
    }
    .body.empty { padding: 4px 18px 12px; }
    .body::-webkit-scrollbar { width: 5px; }
    .body::-webkit-scrollbar-track { background: transparent; }
    .body::-webkit-scrollbar-thumb { background: var(--line-hi); border-radius: 3px; }

    /* ── Empty state ────────────────────────────────────────── */
    .empty-state { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
    .greeting { display: flex; flex-direction: column; gap: 6px; }
    .eyebrow {
      align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
      font-size: 10.5px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;
      color: var(--accent); font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
    }
    .eyebrow .bar { width: 14px; height: 1px; background: var(--accent); opacity: 0.5; }
    .greet-title {
      font-size: 22px; font-weight: 600; letter-spacing: -0.6px; line-height: 1.18;
      color: var(--fg); text-wrap: balance;
    }
    .greet-title .accent-text {
      background: linear-gradient(120deg, var(--accent) 0%, var(--accent-shade-pos2) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .greet-body {
      font-size: 13.5px; line-height: 1.5; color: var(--fg-mute); text-wrap: pretty;
      word-wrap: break-word;
    }

    .section-label {
      font-size: 10px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase;
      color: var(--fg-faint); font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
    }
    .prompt-block { display: flex; flex-direction: column; gap: 8px; }
    .prompt-list { display: flex; flex-direction: column; gap: 6px; }
    .prompt-card {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px;
      background: var(--paper); color: var(--fg);
      font-family: inherit; font-size: 13.5px; text-align: left; line-height: 1.4;
      cursor: pointer; transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
    }
    .prompt-card:hover { border-color: var(--accent); background: var(--paper-hi); transform: translateY(-1px); }
    .prompt-card .label { flex: 1; line-height: 1.4; word-wrap: break-word; }
    .prompt-card .arrow { color: var(--accent); flex-shrink: 0; display: flex; }

    /* ── Messages ───────────────────────────────────────────── */
    .msg { animation: cw-in 0.28s ease-out; }
    .msg.user { display: flex; justify-content: flex-end; }
    .msg.user .bubble {
      background: var(--user-bubble); color: var(--user-bubble-text);
      padding: 10px 14px; border-radius: 16px 16px 4px 16px;
      font-size: 13.5px; line-height: 1.5; max-width: 78%;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      word-wrap: break-word; overflow-wrap: anywhere; white-space: pre-wrap;
    }
    .msg.bot { display: flex; gap: 9px; align-items: flex-start; }
    .msg.bot .bot-col { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
    .bot-bubble {
      background: var(--paper); border: 1px solid var(--line);
      border-radius: 4px 16px 16px 16px; padding: 12px 14px;
      font-size: 13.5px; line-height: 1.55; color: var(--fg);
      box-shadow: 0 1px 2px rgba(26,20,16,0.04);
      word-wrap: break-word; overflow-wrap: anywhere;
    }
    .bot-bubble.streaming-cursor::after {
      content: '▋'; animation: cw-blink 1s infinite; margin-left: 2px; opacity: 0.6;
    }
    @keyframes cw-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }

    .sources {
      margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line);
      display: flex; flex-direction: column; gap: 6px;
    }
    .sources-title {
      font-size: 9.5px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase;
      color: var(--fg-faint); font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
    }
    .sources-list { display: flex; flex-direction: column; gap: 4px; }
    .source {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 8px; border-radius: 8px; background: var(--chip);
      font-size: 11.5px; color: var(--fg-mute);
      transition: background-color 0.12s; text-decoration: none;
    }
    a.source { cursor: pointer; }
    a.source:hover { background: var(--accent-soft); }
    .source .num {
      width: 18px; height: 18px; border-radius: 5px; background: var(--paper);
      border: 1px solid var(--line);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 9.5px; font-weight: 700; color: var(--accent);
      font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
      flex-shrink: 0;
    }
    .source .title {
      flex: 1; color: var(--fg); font-weight: 500; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .actions { display: flex; align-items: center; gap: 2px; padding-left: 4px; }
    .action-btn {
      width: 24px; height: 24px; border-radius: 7px; border: none; cursor: pointer;
      background: transparent; color: var(--fg-faint);
      display: flex; align-items: center; justify-content: center;
      transition: background-color 0.12s, color 0.12s;
    }
    .action-btn:hover { background: var(--chip); color: var(--fg); }
    .action-btn.active { background: var(--accent-soft); color: var(--accent); }
    .action-btn.active svg path { fill: var(--accent); }
    .actions .spacer { flex: 1; }
    .feedback { font-size: 10.5px; color: var(--fg-mute); margin-left: 4px; opacity: 0; transition: opacity 0.3s; white-space: nowrap; }
    .feedback.visible { opacity: 1; }

    .confidence {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 9.5px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
      letter-spacing: 0.7px; text-transform: uppercase;
      font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
      width: fit-content; margin-left: 4px;
    }
    .confidence.high { background: rgba(34,197,94,0.12); color: #15803d; }
    .confidence.medium { background: rgba(234,179,8,0.14); color: #a16207; }
    .confidence.low { background: rgba(239,68,68,0.12); color: #b91c1c; }

    /* ── Thinking ───────────────────────────────────────────── */
    .thinking { display: flex; gap: 9px; align-items: flex-start; animation: cw-in 0.28s ease-out; }
    .thinking-bubble {
      background: var(--paper); border: 1px solid var(--line);
      border-radius: 4px 16px 16px 16px; padding: 10px 14px;
      display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0;
      box-shadow: 0 1px 2px rgba(26,20,16,0.04);
    }
    .thinking-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; color: var(--fg-mute);
      font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
    }
    .thinking-row svg { color: var(--accent); animation: cw-spin 1.4s linear infinite; flex-shrink: 0; }
    .thinking-dots { display: flex; gap: 4px; padding-left: 1px; }
    .thinking-dots span {
      width: 5px; height: 5px; border-radius: 3px; background: var(--accent);
      animation: cw-dot 1.2s infinite ease-in-out;
    }
    .thinking-dots span:nth-child(2) { animation-delay: 0.15s; }
    .thinking-dots span:nth-child(3) { animation-delay: 0.30s; }
    @keyframes cw-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes cw-dot {
      0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
      40% { opacity: 1; transform: translateY(-3px); }
    }
    @keyframes cw-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* ── Composer ───────────────────────────────────────────── */
    .composer-wrap { padding: 4px 14px 14px; flex-shrink: 0; position: relative; }
    .composer-fade {
      position: absolute; left: 0; right: 0; top: -24px; height: 24px;
      background: linear-gradient(to bottom, transparent, var(--bg));
      pointer-events: none;
    }
    .composer {
      display: flex; flex-direction: column;
      background: var(--paper); border-radius: 18px; border: 1px solid var(--line);
      box-shadow: 0 2px 6px rgba(26,20,16,0.04);
      transition: border-color 0.18s, box-shadow 0.18s;
      overflow: hidden;
    }
    .composer.focused {
      border-color: var(--accent-line);
      box-shadow: 0 0 0 3px var(--accent-faint), 0 6px 16px -6px var(--accent-soft);
    }
    .composer textarea {
      width: 100%; resize: none; border: none; outline: none;
      background: transparent; color: var(--fg); font-family: inherit;
      font-size: 13.5px; line-height: 1.5; padding: 12px 14px 6px;
      max-height: 120px; overflow-y: auto;
    }
    .composer textarea::placeholder { color: var(--fg-faint); }
    .composer textarea:disabled { cursor: wait; }
    .composer-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 4px 8px 8px 14px;
    }
    .composer-tools { display: flex; align-items: center; flex: 1; min-width: 0; overflow: hidden; }
    .composer-hint {
      font-size: 10.5px; color: var(--fg-faint);
      font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .send-btn {
      width: 32px; height: 32px; border-radius: 10px; border: none; cursor: pointer;
      background: var(--chip); color: var(--fg-faint);
      display: flex; align-items: center; justify-content: center;
      transition: background-color 0.15s, transform 0.15s, box-shadow 0.15s;
      flex-shrink: 0;
    }
    .send-btn.active {
      background: var(--accent); color: #fff;
      box-shadow: 0 4px 10px var(--accent-soft), inset 0 1px 0 rgba(255,255,255,0.2);
    }
    .send-btn.active:hover { transform: translateY(-1px); }
    .send-btn:disabled { cursor: not-allowed; }

    .branding {
      text-align: center; font-size: 10.5px; color: var(--fg-faint);
      display: flex; align-items: center; justify-content: center; gap: 5px;
      font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
      margin-top: 9px; flex-wrap: wrap;
    }
    .branding strong { font-weight: 600; color: var(--fg-mute); }
    .branding a { color: inherit; text-decoration: none; }
    .branding a:hover { text-decoration: underline; }
    .branding .sep { opacity: 0.5; }

    /* ── Markdown ───────────────────────────────────────────── */
    .md-p { margin: 0 0 10px 0; }
    .md-p:last-child { margin-bottom: 0; }
    .md-h2, .md-h3, .md-h4 { margin: 10px 0 4px 0; font-weight: 600; line-height: 1.3; }
    .md-h2 { font-size: 15px; }
    .md-h3 { font-size: 14px; }
    .md-h4 { font-size: 13px; }
    .md-code-block {
      background: rgba(26,20,16,0.04); color: var(--fg);
      padding: 10px 12px; border-radius: 8px; overflow-x: auto;
      font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, 'Ubuntu Mono', monospace;
      font-size: 12px; margin: 8px 0;
      white-space: pre-wrap; word-break: break-word;
    }
    .md-inline-code {
      background: var(--chip); color: var(--accent);
      padding: 1px 6px; border-radius: 4px;
      font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, 'Ubuntu Mono', monospace;
      font-size: 12px;
    }
    .md-ul, .md-ol { margin: 6px 0; padding-left: 20px; }
    .md-li, .md-oli { margin: 3px 0; line-height: 1.5; }
    .md-link { color: var(--accent); text-decoration: none; font-weight: 500; }
    .md-link:hover { text-decoration: underline; }
    .bot-bubble strong { color: var(--accent); font-weight: 600; }

    /* ── Mobile ─────────────────────────────────────────────── */
    @media (max-width: 480px) {
      .widget {
        right: 0; bottom: 0; left: 0; top: 0;
        width: 100%; height: 100%;
        max-width: 100%; max-height: 100%;
        border-radius: 0;
      }
      .widget.focus { width: 100%; height: 100%; }
      .launcher { right: 16px; bottom: 16px; }
      .composer-wrap { padding-bottom: max(14px, env(safe-area-inset-bottom)); }
      .composer-hint { display: none; }
    }
  `;
  shadow.appendChild(styles);

  // ── Markup ──────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'root';
  root.innerHTML = `
    <button class="launcher" id="launcher" aria-label="Open chat">${ICONS.spark}</button>

    <div class="widget" id="widget" role="dialog" aria-label="Chat">
      <div class="widget-bg"></div>

      <div class="header">
        <div class="header-left">
          <div class="avatar lg" id="header-avatar">${ICONS.avatarMark}</div>
          <div class="header-meta">
            <div class="header-title">
              <span class="name" id="header-name">Chat</span>
              <span class="lang" id="header-lang">EN</span>
            </div>
            <div class="header-status">
              <span class="dot"></span>
              <span id="header-status-text">Online · replies in seconds</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="btn-expand" type="button" title="Expand">${ICONS.expand}</button>
          <button class="icon-btn" id="btn-new" type="button" title="New conversation">${ICONS.refresh}</button>
          <button class="icon-btn" id="btn-close" type="button" title="Close">${ICONS.close}</button>
        </div>
      </div>

      <div class="body" id="body"></div>

      <div class="composer-wrap">
        <div class="composer-fade"></div>
        <div class="composer" id="composer">
          <textarea id="input" rows="1" placeholder="Ask anything…" autocomplete="off"></textarea>
          <div class="composer-row">
            <div class="composer-tools">
              <span class="composer-hint">⏎ to send · ⇧⏎ for newline</span>
            </div>
            <button class="send-btn" id="send" type="button" disabled aria-label="Send">${ICONS.send}</button>
          </div>
        </div>
        <div class="branding" id="branding">
          Powered by <a href="https://chataziendale.it" target="_blank" rel="noopener"><strong>ChatAziendale</strong></a>
          <span class="sep">·</span> AI may make mistakes
        </div>
      </div>
    </div>
  `;
  shadow.appendChild(root);

  // ── DOM refs ────────────────────────────────────────────────────
  const $ = id => shadow.getElementById(id);
  const launcher = $('launcher');
  const widget = $('widget');
  const headerName = $('header-name');
  const headerLang = $('header-lang');
  const body = $('body');
  const composer = $('composer');
  const input = $('input');
  const sendBtn = $('send');
  const branding = $('branding');
  const btnExpand = $('btn-expand');
  const btnNew = $('btn-new');
  const btnClose = $('btn-close');

  // ── Storage ─────────────────────────────────────────────────────
  const storageKey = 'chataziendale-chat-' + chatbotId;
  function loadStored() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.timestamp && Date.now() - data.timestamp < 24 * 3600 * 1000) return data;
    } catch {}
    return null;
  }
  function saveStored() {
    try {
      const stored = [];
      body.querySelectorAll('.msg').forEach(m => {
        if (m.classList.contains('user')) {
          const t = m.querySelector('.bubble');
          if (t && t.textContent.trim()) stored.push({ role: 'user', content: t.textContent });
        } else if (m.classList.contains('bot')) {
          const text = m.dataset.text || '';
          if (text.trim()) stored.push({ role: 'assistant', content: text });
        }
      });
      localStorage.setItem(storageKey, JSON.stringify({ messages: stored, timestamp: Date.now() }));
    } catch {}
  }
  function clearStored() { try { localStorage.removeItem(storageKey); } catch {} }

  // ── Markdown parser ─────────────────────────────────────────────
  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = String(text == null ? '' : text);
    return d.innerHTML;
  }
  // Block-level markdown parser. Splits on blank lines, classifies each block
  // (heading / list / code / paragraph), then runs inline transforms inside.
  // This avoids the regex-soup pitfalls of the previous single-pass approach
  // (extra <br> between <li> items, dangling </p> after lists, etc).
  function parseMarkdown(text) {
    const escaped = escapeHtml(text);

    // Extract fenced code blocks first so their contents are not touched by
    // inline transforms or block splitting.
    const codeBlocks = [];
    const stashed = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const i = codeBlocks.push('<pre class="md-code-block"><code>' + code.trim() + '</code></pre>') - 1;
      return ' CB' + i + ' ';
    });

    function inline(s) {
      s = s.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<em>$1</em>');
      s = s.replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, '<em>$1</em>');
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');
      return s;
    }

    const blocks = stashed.split(/\n{2,}/);
    const out = [];
    for (const raw of blocks) {
      const block = raw.replace(/^\n+|\n+$/g, '');
      if (!block) continue;

      // Restored code block placeholder
      const codeMatch = block.match(/^ CB(\d+) $/);
      if (codeMatch) { out.push(codeBlocks[+codeMatch[1]]); continue; }

      // Heading: # → h2, ## → h3, ### → h4 (h1 reserved for the host page)
      const h = block.match(/^(#{1,3}) (.+)$/);
      if (h) {
        const level = h[1].length + 1;
        out.push('<h' + level + ' class="md-h' + level + '">' + inline(h[2]) + '</h' + level + '>');
        continue;
      }

      // Unordered list — every line starts with "- " or "* "
      if (block.split('\n').every(l => /^[\-*] /.test(l))) {
        const items = block.split('\n').map(l => '<li class="md-li">' + inline(l.replace(/^[\-*] /, '')) + '</li>').join('');
        out.push('<ul class="md-ul">' + items + '</ul>');
        continue;
      }

      // Ordered list — every line starts with "N. "
      if (block.split('\n').every(l => /^\d+\. /.test(l))) {
        const items = block.split('\n').map(l => '<li class="md-oli">' + inline(l.replace(/^\d+\. /, '')) + '</li>').join('');
        out.push('<ol class="md-ol">' + items + '</ol>');
        continue;
      }

      // Plain paragraph — preserve single newlines as <br>
      out.push('<p class="md-p">' + inline(block).replace(/\n/g, '<br>') + '</p>');
    }
    return out.join('');
  }

  function dedupSources(sources) {
    const seen = new Set();
    return sources.filter(s => {
      if (!s || !s.documentTitle) return false;
      if (seen.has(s.documentTitle)) return false;
      seen.add(s.documentTitle);
      return true;
    });
  }

  // ── Mode switching ──────────────────────────────────────────────
  function setMode(next) {
    mode = next;
    if (next === 'launcher') {
      launcher.classList.remove('hidden');
      widget.classList.remove('open', 'focus');
    } else if (next === 'widget') {
      launcher.classList.add('hidden');
      widget.classList.remove('focus');
      widget.classList.add('open');
      btnExpand.innerHTML = ICONS.expand;
      btnExpand.title = 'Expand';
      setTimeout(() => { try { input.focus(); } catch {} }, 60);
    } else if (next === 'focus') {
      launcher.classList.add('hidden');
      widget.classList.add('open', 'focus');
      btnExpand.innerHTML = ICONS.compact;
      btnExpand.title = 'Compact';
      setTimeout(() => { try { input.focus(); } catch {} }, 60);
    }
  }

  // ── Render helpers ──────────────────────────────────────────────
  function ensureMessagesContainer() {
    if (body.classList.contains('empty')) {
      body.classList.remove('empty');
      body.innerHTML = '';
    }
  }
  function makeAvatar(small) {
    const div = document.createElement('div');
    div.className = 'avatar ' + (small ? 'sm' : 'lg');
    div.innerHTML = getAvatarIconHTML(chatbot);
    return div;
  }
  function buildSourcesEl(sources) {
    const unique = dedupSources(sources);
    if (!unique.length) return null;
    const el = document.createElement('div');
    el.className = 'sources';
    const title = document.createElement('div');
    title.className = 'sources-title';
    title.textContent = 'Sources · ' + unique.length;
    el.appendChild(title);
    const list = document.createElement('div');
    list.className = 'sources-list';
    unique.forEach((s, i) => {
      const node = document.createElement(s.sourceUrl ? 'a' : 'div');
      node.className = 'source';
      if (s.sourceUrl) { node.href = s.sourceUrl; node.target = '_blank'; node.rel = 'noopener'; }
      const num = document.createElement('span'); num.className = 'num'; num.textContent = i + 1;
      const t = document.createElement('span'); t.className = 'title'; t.textContent = s.documentTitle || 'Source';
      node.appendChild(num); node.appendChild(t);
      list.appendChild(node);
    });
    el.appendChild(list);
    return el;
  }
  function buildActionsEl(messageId, text) {
    const el = document.createElement('div');
    el.className = 'actions';
    el.innerHTML = `
      <button class="action-btn" type="button" data-r="up" title="Helpful">${ICONS.thumbUp}</button>
      <button class="action-btn" type="button" data-r="down" title="Not helpful">${ICONS.thumbDown}</button>
      <button class="action-btn" type="button" data-r="copy" title="Copy">${ICONS.copy}</button>
      <span class="feedback"></span>
      <span class="spacer"></span>
    `;
    el.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn, messageId, text, el));
    });
    return el;
  }
  function buildConfidenceEl(confidence) {
    if (!confidence) return null;
    const el = document.createElement('div');
    el.className = 'confidence ' + confidence;
    const labels = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
    el.textContent = labels[confidence] || '';
    return el;
  }

  // ── Empty state ─────────────────────────────────────────────────
  // Renders a single line of "accent markdown" — *word* wraps the word in the accent color.
  function renderAccentMarkdown(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/\*([^*\n]+)\*/g, '<span class="accent-text">$1</span>');
  }

  function renderEmptyState() {
    body.classList.add('empty');
    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';

    const eyebrowText = chatbot && typeof chatbot.welcomeEyebrow === 'string'
      ? chatbot.welcomeEyebrow.trim()
      : 'Knowledge assistant';
    const headlineText = (chatbot && chatbot.welcomeHeadline && chatbot.welcomeHeadline.trim())
      || 'Hi — what would you like to *know*?';
    const welcome = (chatbot && chatbot.welcomeMessage)
      || (chatbot && chatbot.name ? 'Ask me anything about ' + chatbot.name + '.' : 'Ask me anything.');

    const greet = document.createElement('div');
    greet.className = 'greeting';
    const eyebrowHTML = eyebrowText
      ? '<div class="eyebrow"><span class="bar"></span>' + escapeHtml(eyebrowText) + '</div>'
      : '';
    greet.innerHTML =
      eyebrowHTML +
      '<div class="greet-title">' + renderAccentMarkdown(headlineText) + '</div>' +
      '<div class="greet-body"></div>';
    greet.querySelector('.greet-body').textContent = welcome;
    wrap.appendChild(greet);

    const prompts = (chatbot && Array.isArray(chatbot.suggestedPrompts) ? chatbot.suggestedPrompts : []).filter(Boolean);
    if (prompts.length) {
      const block = document.createElement('div');
      block.className = 'prompt-block';
      const label = document.createElement('div');
      label.className = 'section-label';
      label.textContent = 'Try asking';
      block.appendChild(label);
      const list = document.createElement('div');
      list.className = 'prompt-list';
      prompts.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'prompt-card';
        btn.type = 'button';
        const span = document.createElement('span');
        span.className = 'label';
        span.textContent = p;
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.innerHTML = ICONS.arrow;
        btn.appendChild(span);
        btn.appendChild(arrow);
        btn.addEventListener('click', () => sendMessage(p));
        list.appendChild(btn);
      });
      block.appendChild(list);
      wrap.appendChild(block);
    }

    body.appendChild(wrap);
  }

  // ── Messages ────────────────────────────────────────────────────
  function renderUserMessage(text) {
    ensureMessagesContainer();
    const el = document.createElement('div');
    el.className = 'msg user';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    el.appendChild(bubble);
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    messageCount++;
  }

  function renderBotMessage(content, sources, confidence, messageId) {
    ensureMessagesContainer();
    const el = document.createElement('div');
    el.className = 'msg bot';
    if (messageId) el.dataset.messageId = messageId;
    el.dataset.text = content || '';

    el.appendChild(makeAvatar(true));
    const col = document.createElement('div');
    col.className = 'bot-col';

    const bubble = document.createElement('div');
    bubble.className = 'bot-bubble';
    bubble.innerHTML = parseMarkdown(content || '');
    if (sources && sources.length && chatbot && chatbot.showSources !== false) {
      const sourcesEl = buildSourcesEl(sources);
      if (sourcesEl) bubble.appendChild(sourcesEl);
    }
    col.appendChild(bubble);

    const conf = buildConfidenceEl(confidence);
    if (conf) col.appendChild(conf);

    if (messageId) col.appendChild(buildActionsEl(messageId, content || ''));

    el.appendChild(col);
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    messageCount++;
    return { el, bubble, col };
  }

  function showThinking() {
    ensureMessagesContainer();
    const el = document.createElement('div');
    el.className = 'thinking';
    el.id = 'thinking';
    const av = makeAvatar(true);
    av.classList.add('thinking');
    el.appendChild(av);
    const bubble = document.createElement('div');
    bubble.className = 'thinking-bubble';
    bubble.innerHTML = `
      <div class="thinking-row">${ICONS.spinner}<span>Searching knowledge base</span></div>
      <div class="thinking-dots"><span></span><span></span><span></span></div>
    `;
    el.appendChild(bubble);
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }
  function hideThinking() {
    const t = $('thinking');
    if (t) t.remove();
  }

  // ── Streaming ───────────────────────────────────────────────────
  function addStreamingBubble() {
    ensureMessagesContainer();
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.id = 'streaming';
    el.appendChild(makeAvatar(true));
    const col = document.createElement('div');
    col.className = 'bot-col';
    const bubble = document.createElement('div');
    bubble.className = 'bot-bubble streaming-cursor';
    col.appendChild(bubble);
    el.appendChild(col);
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return { el, bubble, col };
  }
  function finalizeStreaming(buffer, sources, confidence, messageId) {
    const el = $('streaming');
    if (!el) return;
    el.removeAttribute('id');
    if (messageId) el.dataset.messageId = messageId;
    el.dataset.text = buffer || '';

    const bubble = el.querySelector('.bot-bubble');
    bubble.classList.remove('streaming-cursor');
    bubble.innerHTML = parseMarkdown(buffer || '');
    if (sources && sources.length && chatbot && chatbot.showSources !== false) {
      const sourcesEl = buildSourcesEl(sources);
      if (sourcesEl) bubble.appendChild(sourcesEl);
    }

    const col = el.querySelector('.bot-col');
    const conf = buildConfidenceEl(confidence);
    if (conf) col.appendChild(conf);
    if (messageId) col.appendChild(buildActionsEl(messageId, buffer || ''));

    saveStored();
    body.scrollTop = body.scrollHeight;
    messageCount++;
  }

  // ── Actions (reactions + copy) ──────────────────────────────────
  async function handleAction(btn, messageId, text, actionsRow) {
    const r = btn.getAttribute('data-r');
    const feedback = actionsRow.querySelector('.feedback');

    if (r === 'copy') {
      try {
        await navigator.clipboard.writeText(text);
        if (feedback) {
          feedback.textContent = 'Copied';
          feedback.classList.add('visible');
          setTimeout(() => feedback.classList.remove('visible'), 1800);
        }
      } catch {}
      return;
    }

    actionsRow.querySelectorAll('.action-btn[data-r="up"], .action-btn[data-r="down"]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (feedback) {
      feedback.textContent = r === 'up' ? 'Thanks!' : 'Thanks for the feedback';
      feedback.classList.add('visible');
      setTimeout(() => feedback.classList.remove('visible'), 2400);
    }

    if (!messageId) return;
    try {
      await fetch(baseUrl + '/api/chat/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, reaction: r, sessionId }),
      });
    } catch (err) {
      console.error('Failed to save reaction:', err);
    }
  }

  // ── Send ────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text || !text.trim() || isLoading || !chatbot) return;
    isLoading = true;
    input.disabled = true;
    sendBtn.disabled = true;
    sendBtn.classList.remove('active');

    renderUserMessage(text);
    saveStored();
    showThinking();

    let streamingState = null;
    let buffer = '';
    let metadata = null;

    try {
      const res = await fetch(baseUrl + '/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId, sessionId, message: text }),
      });
      hideThinking();

      if (!res.ok || !res.body) {
        const fb = await fetch(baseUrl + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatbotId, sessionId, message: text }),
        });
        if (!fb.ok) throw new Error('Failed to send message');
        const data = await fb.json();
        renderBotMessage(data.message.content, data.message.sources, data.message.confidence, data.message.id);
        saveStored();
        return;
      }

      // The server emits events in this order: metadata → content × N → [DONE] → messageId.
      // We defer finalization until the stream actually closes so messageId is captured.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const lines = raw.split('\n');
        raw = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === 'metadata') {
              metadata = parsed;
            } else if (parsed.messageId) {
              metadata = metadata || {};
              metadata.messageId = parsed.messageId;
            } else if (parsed.content) {
              if (!streamingState) streamingState = addStreamingBubble();
              buffer += parsed.content;
              streamingState.bubble.textContent = buffer;
              body.scrollTop = body.scrollHeight;
            }
          } catch {}
        }
      }
      if (streamingState) {
        finalizeStreaming(buffer, metadata && metadata.sources, metadata && metadata.confidence, metadata && metadata.messageId);
      }
    } catch (err) {
      hideThinking();
      const orphan = $('streaming');
      if (orphan) orphan.remove();
      renderBotMessage('Sorry, something went wrong. Please try again.', null, null, null);
    } finally {
      isLoading = false;
      input.disabled = false;
      try { input.focus(); } catch {}
      updateSendState();
    }
  }

  // ── Input handling ──────────────────────────────────────────────
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  function updateSendState() {
    const v = input.value.trim();
    if (v && !isLoading) {
      sendBtn.disabled = false;
      sendBtn.classList.add('active');
    } else {
      sendBtn.disabled = true;
      sendBtn.classList.remove('active');
    }
  }
  function submit() {
    const v = input.value.trim();
    if (!v) return;
    sendMessage(v);
    input.value = '';
    autoGrow();
    updateSendState();
  }

  // ── Event wiring ────────────────────────────────────────────────
  launcher.addEventListener('click', () => setMode('widget'));
  btnClose.addEventListener('click', () => setMode('launcher'));
  btnExpand.addEventListener('click', () => setMode(mode === 'focus' ? 'widget' : 'focus'));
  btnNew.addEventListener('click', () => {
    if (messageCount === 0 || confirm('Start a new conversation?')) {
      clearStored();
      messageCount = 0;
      renderEmptyState();
    }
  });
  input.addEventListener('input', () => { autoGrow(); updateSendState(); });
  input.addEventListener('focus', () => composer.classList.add('focused'));
  input.addEventListener('blur', () => composer.classList.remove('focused'));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });
  sendBtn.addEventListener('click', submit);

  // ── Theme ───────────────────────────────────────────────────────
  function applyTheme(primary, secondary) {
    const accent = secondary || primary;
    const lc1 = primary;
    const lc2 = shade(primary, -12);

    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-soft', rgba(accent, 0.10));
    root.style.setProperty('--accent-faint', rgba(accent, 0.08));
    root.style.setProperty('--accent-line', rgba(accent, 0.40));
    root.style.setProperty('--accent-shade-pos', shade(accent, 8));
    root.style.setProperty('--accent-shade-pos2', shade(accent, 25));
    root.style.setProperty('--accent-shade-neg', shade(accent, -10));
    root.style.setProperty('--launcher-c1', lc1);
    root.style.setProperty('--launcher-c2', lc2);
    root.style.setProperty('--shadow-glow', rgba(lc1, 0.50));
    root.style.setProperty('--shadow-soft', rgba(lc1, 0.30));
  }

  // ── Init ────────────────────────────────────────────────────────
  async function loadChatbot() {
    try {
      const res = await fetch(baseUrl + '/api/widget/' + chatbotId);
      if (!res.ok) throw new Error('Failed to load chatbot');
      const data = await res.json();
      chatbot = data.chatbot;

      const primary = chatbot.primaryColor || '#3B82F6';
      const secondary = chatbot.secondaryColor || primary;
      applyTheme(primary, secondary);

      launcher.innerHTML = getLauncherIconHTML(chatbot);
      launcher.classList.add('ready');
      $('header-avatar').innerHTML = getAvatarIconHTML(chatbot);

      headerName.textContent = chatbot.name || 'Chat';
      const lang = (navigator.language || 'en').split('-')[0].toUpperCase();
      headerLang.textContent = lang;
      const promptName = (chatbot.name || '').replace(/^ask\s+/i, '').trim() || 'anything';
      input.placeholder = 'Ask ' + promptName + '…';

      const desc = (chatbot.description || '').trim();
      if (desc) $('header-status-text').textContent = desc;

      if (chatbot.showBranding === false) branding.style.display = 'none';

      const stored = loadStored();
      if (stored && Array.isArray(stored.messages) && stored.messages.length) {
        body.classList.remove('empty');
        body.innerHTML = '';
        stored.messages.forEach(m => {
          if (m.role === 'user') renderUserMessage(m.content);
          else if (m.role === 'assistant') renderBotMessage(m.content, null, null, null);
        });
      } else {
        renderEmptyState();
      }
    } catch (err) {
      console.error('ChatAziendale.it widget: Failed to load', err);
      launcher.style.display = 'none';
    }
  }

  loadChatbot();
})();
