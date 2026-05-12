# Gemini Portal
## I. Introduction
Gemini Portal is a Google Chrome extension that embeds a Gemini-powered chatbox directly into your web browser, allowing you to consult Gemini on any website without switching tabs.

## II. What and How
The extension adds a floating chat icon to the bottom right of any webpage. Clicking it opens an integrated chat interface. You will need your own API keys to use it. (See <ins>Instructions</ins> below).

## III. Features
### 1. Highlight-to-Prompt (Context Menus)
Highlight text on any webpage, right-click, and select "Summarize", "Explain", "Translate to Vietnamese", "Fix grammar", or "Rephrase". The extension will automatically open the chatbox and send the prompt for you.
### 2. Page Summarization
Click the new summarize icon in the chat header to instantly extract and summarize the current webpage's content.
### 3. Streaming Responses
Gemini's responses are streamed in real-time. A "Stop Generation" button is available if you need to halt the output.
### 4. Voice Dictation & Text-to-Speech
Click the microphone icon to speak your prompts. Gemini can also read its responses aloud via the speaker button attached to every message.
### 5. Multi-modal Support
Upload an image or paste it directly into the chatbox (Ctrl+V) to include it in your prompt.
### 6. Chat Exporting
Export your current chat history to a Markdown file directly from the Settings menu.
### 7. Customization
Change from Dark to Light mode, adjust the chatbox size, or have the chatbox automatically expand for long responses.

## IV. Instructions on how to use this extension
Create your own `env.js` file in the root extension directory, then add the following API keys:
```javascript
const GEMINI_API_KEY = "YOUR_API_KEY_HERE";
const GOOGLE_SEARCH_API_KEY = "YOUR_API_KEY_HERE";
const CUSTOM_SEARCH_ENGINE_ID = "YOUR_API_KEY_HERE";
```
Save the extension, then load it unpacked in `chrome://extensions/`. Refresh any open tabs to start using it!

## V. Contact
Leave a suggestion/review at: luongdtran06@gmail.com!
