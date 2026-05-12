# Gemini Portal — Chrome Extension

## Overview
A Chrome extension that injects a floating, draggable chat widget into every webpage. Users can chat with Google Gemini 2.5 Flash directly from any site, with support for image uploads, voice input/output, Google Search grounding, and multilingual UI (English/Vietnamese).

---

## Architecture

The extension uses a **content script + sandboxed iframe + service worker** pattern:

```
Webpage
└── content.js (content script)
    ├── Creates floating button (#gemini-floating-button)
    └── Creates iframe (chatbox.html)
        └── chatbox.js ←→ content.js  (postMessage IPC)
                              ↓
                        Gemini API  /  Google Custom Search API
background.js (service worker)
└── Context menus, keyboard shortcut toggle, cross-tab state sync
```

---

## File Map

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest; declares permissions, content scripts, shortcuts |
| `background.js` | Service worker: context menus, Ctrl+Shift+Y toggle, cross-tab sync |
| `content.js` | Orchestrator: UI creation, drag/snap, API calls, message routing |
| `chatbox.html` | iframe HTML shell for the chat UI |
| `chatbox.js` | iframe logic: AppState, UIManager, ChatManager, SettingsManager, IpcManager |
| `styles.css` | Floating button and iframe container styles (injected into host page) |
| `iframe-styles.css` | Full chat UI design system (inside the iframe) |
| `env.js` | API keys (not in repo — copy from `env.example.js`) |
| `env.example.js` | Template for the three required API keys |

---

## Key Features

- **Floating button** — fixed bottom-right, draggable anywhere within the viewport
- **Snap-to-edges** — snaps to nearest edge when released within 100px
- **Opacity on blur** — iframe fades to 0.4 opacity when not hovered
- **Chat with history** — full conversation context sent to Gemini on each turn; session-persistent
- **Image upload** — paste or click upload; 5 MB limit; sent as `inline_data` to Gemini
- **Voice input** — Web Speech API (en-US / vi-VN)
- **Text-to-speech** — per-message speaker button; skips code blocks
- **Markdown rendering** — code blocks, inline code, bold, italic
- **Google Search grounding** — Gemini can invoke `googleSearch` tool; sources displayed as citations
- **Context menus** — right-click selected text: Summarize / Explain / Translate to Vietnamese
- **Settings** — dark/light theme, default/large size, language, remember-settings toggle, clear history
- **Cross-tab sync** — toggle state (enabled/disabled) propagated via `chrome.storage.local`

---

## External APIs

| API | Endpoint | Auth variable |
|-----|----------|---------------|
| Gemini 2.5 Flash | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` | `GEMINI_API_KEY` |
| Google Custom Search | `https://www.googleapis.com/customsearch/v1` | `GOOGLE_SEARCH_API_KEY` + `CUSTOM_SEARCH_ENGINE_ID` |

Keys are loaded from `env.js` which is a content script declared in `manifest.json` (runs before `content.js`).

---

## Chrome APIs Used

| API | Purpose |
|-----|---------|
| `chrome.storage.local` | Persist enabled state + user settings (theme, size, language) |
| `chrome.storage.session` | Chat history (cleared when browser closes) |
| `chrome.contextMenus` | Right-click "Summarize / Explain / Translate" on selected text |
| `chrome.commands` | Ctrl+Shift+Y keyboard shortcut to toggle the extension |
| `chrome.tabs.sendMessage` | Background → content script (toggle, context menu click) |
| `chrome.runtime.sendMessage` | Content script message bus |
| `chrome.runtime.getURL` | Resolve extension-internal resource URLs |

---

## IPC Message Types (postMessage between content.js ↔ iframe)

| Direction | Type | Payload | Purpose |
|-----------|------|---------|---------|
| content → iframe | `RESTORE_HISTORY` | `{ history }` | Replay saved messages on iframe load |
| content → iframe | `GEMINI_RESPONSE` | `{ text, groundingMetadata }` | Send model reply |
| content → iframe | `GEMINI_ERROR` | `{ error }` | Show error in chat |
| content → iframe | `IFRAME_RESIZED` | `{ size }` | Notify iframe of size change |
| iframe → content | `GEMINI_PROMPT` | `{ prompt, imageData? }` | User sent a message |
| iframe → content | `LANGUAGE_CHANGED` | `{ language }` | Update system prompt language |
| iframe → content | `THEME_CHANGED` | `{ theme }` | Update floating button color/icon |
| iframe → content | `SIZE_CHANGED` | `{ size }` | Resize iframe (350px / 700px) |
| iframe → content | `CLEAR_CHAT_HISTORY` | — | Clear session storage |
| iframe → content | `TOGGLE_CHATBOX` | — | Show/hide iframe |

---

## Storage Schema

**`chrome.storage.local`**
```js
{
  isEnabled: boolean,          // extension on/off
  theme: 'dark' | 'light',
  size: 'default' | 'large',
  language: 'en' | 'vi',
  persistSettings: boolean
}
```

**`chrome.storage.session`**
```js
{
  chatHistory: [
    {
      role: 'user' | 'model',
      parts: [
        { text: "..." },
        { inline_data: { mime_type: "image/...", data: "<base64>" } },  // optional
        { functionCall: { name: "googleSearch", args: { query: "..." } } }  // optional
      ]
    }
  ]
}
```

---

## Dev Setup

1. Copy `env.example.js` → `env.js` and fill in the three API keys.
2. Open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, select this folder.
3. Reload after any JS/CSS change (no build step needed).
4. `env.js` is listed in `.gitignore` — never commit real API keys.

---

## Patterns & Conventions

- **Manager classes** in `chatbox.js` — `UIManager`, `ChatManager`, `SettingsManager`, `IpcManager`; injected into each other after construction to break circular deps.
- **`window.hasRunGeminiPortal`** guard in `content.js` prevents double-injection.
- **Listener cleanup** — all drag/click listeners stored in variables and removed in `disableFeature()`.
- **XSS prevention** — `escapeHtml()` applied to all content before DOM insertion; Markdown transforms are allow-listed and safe.
- **Quadrant-aware animation** — CSS classes `.top-left / .top-right / .bottom-left / .bottom-right` on the container change the iframe's `transform-origin` so scale animation always opens toward the page center.
- **No build tooling** — plain ES6, no bundler; all files loaded directly by the browser.
