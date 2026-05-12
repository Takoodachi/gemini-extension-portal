// XSS & Markdown

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function simpleMarkdownToHtml(text) {
    if (!text) return '';

    // 1. Extract code blocks before any escaping
    const codeBlocks = [];
    text = text.replace(/```(?:[a-zA-Z0-9]*)\n?([\s\S]*?)```/g, (_, code) => {
        codeBlocks.push(escapeHtml(code.replace(/^\n+|\n+$/g, '')));
        return `\x00CB${codeBlocks.length - 1}\x00`;
    });

    // 2. Escape HTML
    let html = escapeHtml(text);

    // 3. Extract inline code (protect from further transforms)
    const inlineCodes = [];
    html = html.replace(/`([^`\n]+)`/g, (_, c) => {
        inlineCodes.push(`<code>${c}</code>`);
        return `\x00IC${inlineCodes.length - 1}\x00`;
    });

    // 4. Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

    // 5. Horizontal rules
    html = html.replace(/^[-*]{3,}$/gm, '<hr>');

    // 6. Bold + italic
    html = html.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*\n]+)\*\*/g,      '<strong>$1</strong>');
    html = html.replace(/\*([^*\n]+)\*/g,           '<em>$1</em>');

    // 7. Blockquotes (&gt; after escaping)
    html = html.replace(/^((?:&gt; .+\n?)+)/gm, match => {
        const content = match.replace(/^&gt; /gm, '').trim().replace(/\n/g, '<br>');
        return `<blockquote>${content}</blockquote>`;
    });

    // 8. Unordered lists
    html = html.replace(/^((?:[ \t]*[-*] .+\n?)+)/gm, match => {
        const items = match.trim().split('\n')
            .map(l => `<li>${l.replace(/^[ \t]*[-*] /, '').trim()}</li>`).join('');
        return `<ul>${items}</ul>`;
    });

    // 9. Ordered lists
    html = html.replace(/^((?:[ \t]*\d+\. .+\n?)+)/gm, match => {
        const items = match.trim().split('\n')
            .map(l => `<li>${l.replace(/^[ \t]*\d+\. /, '').trim()}</li>`).join('');
        return `<ol>${items}</ol>`;
    });

    // 10. Tables (| col | col |)
    html = html.replace(/^(\|.+\|\n?)+/gm, match => {
        const rows = match.trim().split('\n').filter(r => !/^\|[\s|:-]+\|$/.test(r.trim()));
        if (!rows.length) return match;
        let table = '<table>';
        rows.forEach((row, i) => {
            const cells = row.split('|').slice(1, -1);
            const tag = i === 0 ? 'th' : 'td';
            table += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
        });
        return table + '</table>';
    });

    // 11. Newlines → <br>, then clean up around block elements
    html = html.replace(/\n/g, '<br>');
    const B = 'h[1-6]|ul|ol|li|blockquote|table|tr|td|th|hr|pre';
    html = html.replace(new RegExp(`<br>(<(?:${B})[^>]*>)`, 'g'), '$1');
    html = html.replace(new RegExp(`(<\/(?:${B})>)<br>`, 'g'), '$1');

    // 12. Restore placeholders
    codeBlocks.forEach((c, i) => {
        html = html.replace(`\x00CB${i}\x00`, `<pre><code>${c}</code></pre>`);
    });
    inlineCodes.forEach((c, i) => {
        html = html.replace(`\x00IC${i}\x00`, c);
    });

    return html;
}

// Translations

const TRANSLATIONS = {
    en: {
        geminiChat: "Gemini Chat", settings: "Settings", send: "Send",
        language: "Language", theme: "Theme", dark: "Dark", light: "Light",
        chatboxSize: "Chatbox Size", default: "Default", large: "Large",
        autoExpand: "Auto-expand on long text",
        rememberChoice: "Remember my choice", clearChat: "Clear Chat History",
        exportChat: "Export Chat",
        welcomeMessage: "Hello! 👋 How can I help you today?",
        clearConfirm: "Are you sure you want to clear the entire chat history?",
        typeMessage: "Type your message...", sources: "Sources:",
        chatCleared: "Chat history cleared!", ok: "OK",
        yes: "Yes", no: "No",
        copy: "Copy", copied: "Copied!",
        ttsEnabled: "Text-to-Speech button", copyEnabled: "Copy answer button",
        widgetPosition: "Widget Corner", resetPosition: "Reset to Default Position"
    },
    vi: {
        geminiChat: "Trò chuyện Gemini", settings: "Cài đặt", send: "Gửi",
        language: "Ngôn ngữ", theme: "Giao diện", dark: "Tối", light: "Sáng",
        chatboxSize: "Kích thước", default: "Mặc định", large: "Lớn",
        autoExpand: "Tự động mở rộng khi văn bản dài",
        rememberChoice: "Ghi nhớ lựa chọn", clearChat: "Xóa lịch sử trò chuyện",
        exportChat: "Xuất đoạn chat",
        welcomeMessage: "Xin chào! 👋 Tôi có thể giúp gì cho bạn?",
        clearConfirm: "Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện không?",
        typeMessage: "Nhập tin nhắn của bạn...", sources: "Nguồn:",
        chatCleared: "Đã xóa lịch sử trò chuyện!", ok: "OK",
        yes: "Có", no: "Không",
        copy: "Sao chép", copied: "Đã sao chép!",
        ttsEnabled: "Nút đọc văn bản", copyEnabled: "Nút sao chép câu trả lời",
        widgetPosition: "Góc widget", resetPosition: "Đặt lại vị trí mặc định"
    }
};

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

// AppState

class AppState {
    constructor() {
        this.currentLang = 'en';
        this.uploadedImageData = null;
        this.isWaitingForResponse = false;
        this.isDictating = false;
        this.autoExpand = true;
        this.ttsEnabled = true;
        this.copyEnabled = true;
    }
}

// UIManager

class UIManager {
    constructor(state, chatManager) {
        this.state = state;
        this.chatManager = chatManager;
        this.settingsManager = null;
        this.ipcManager = null;
        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        this.iFrameBody = document.body;
        this.uiContainer = document.getElementById('gemini-ui-container');
        this.promptInput = document.getElementById('gemini-prompt-input');
        this.sendButton = document.getElementById('gemini-send-button');
        this.stopButton = document.getElementById('gemini-stop-button');
        this.micButton = document.getElementById('gemini-mic-button');
        this.settingsButton = document.getElementById('gemini-settings-button');
        this.backButton = document.getElementById('gemini-back-button');
        this.clearChatButton = document.getElementById('clear-chat-button');
        this.exportChatButton = document.getElementById('export-chat-button');
        this.summarizeButton = document.getElementById('gemini-summarize-button');
        this.imageUploadButton = document.getElementById('image-upload-button');
        this.imageUploadInput = document.getElementById('image-upload-input');
        this.imagePreviewContainer = document.getElementById('image-preview-container');
        this.confirmationModal = document.getElementById('confirmation-modal');
        this.confirmYesBtn = document.getElementById('confirm-yes');
        this.confirmNoBtn = document.getElementById('confirm-no');
        this.successModal = document.getElementById('success-modal');
        this.successOkBtn = document.getElementById('success-ok');
        this.settingsIcon = document.getElementById('settings-icon');
        this.backIcon = document.getElementById('back-icon');
        this.uploadIcon = document.getElementById('upload-icon');
        this.sendIcon = document.getElementById('send-icon');
    }

    bindEvents() {
        // Navigation
        this.settingsButton.addEventListener('click', () => this.uiContainer.classList.add('settings-active'));
        this.backButton.addEventListener('click', () => this.uiContainer.classList.remove('settings-active'));

        // Modals
        this.clearChatButton.addEventListener('click', () => this.confirmationModal.classList.remove('hidden'));
        this.confirmYesBtn.addEventListener('click', () => this.handleClearChat());
        this.confirmNoBtn.addEventListener('click', () => this.confirmationModal.classList.add('hidden'));
        this.successOkBtn.addEventListener('click', () => this.successModal.classList.add('hidden'));
        this.successModal.addEventListener('click', e => { if (e.target === this.successModal) this.successModal.classList.add('hidden'); });
        this.confirmationModal.addEventListener('click', e => { if (e.target === this.confirmationModal) this.confirmationModal.classList.add('hidden'); });

        // Export
        this.exportChatButton.addEventListener('click', () => this.chatManager.exportChat());

        // Summarize page
        this.summarizeButton.addEventListener('click', () => {
            window.parent.postMessage({ type: 'SUMMARIZE_PAGE' }, '*');
        });

        // Send & input
        this.sendButton.addEventListener('click', () => this.handleSend());
        this.stopButton.addEventListener('click', () => {
            window.parent.postMessage({ type: 'STOP_GENERATION' }, '*');
        });
        this.micButton.addEventListener('click', () => this.toggleDictation());
        this.promptInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
        });
        this.promptInput.addEventListener('input', () => this.resizeTextarea());

        // Image upload
        this.imageUploadButton.addEventListener('click', () => this.imageUploadInput.click());
        this.imageUploadInput.addEventListener('change', event => {
            const file = event.target.files[0];
            if (file && file.type.startsWith('image/')) this.handleImageFile(file);
        });
        this.promptInput.addEventListener('paste', event => {
            const items = (event.clipboardData || window.clipboardData).items;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    this.handleImageFile(item.getAsFile());
                    event.preventDefault();
                    return;
                }
            }
        });
    }

    handleClearChat() {
        this.chatManager.clearChat();
        this.ipcManager.sendClearHistory();
        this.confirmationModal.classList.add('hidden');
        this.successModal.classList.remove('hidden');
    }

    handleSend() {
        if (this.state.isWaitingForResponse) return;
        const userPrompt = this.promptInput.value.trim();
        if (userPrompt === '' && !this.state.uploadedImageData) return;

        this.chatManager.addMessage(userPrompt, 'user', this.state.uploadedImageData);
        this.chatManager.showLoader();
        this.ipcManager.sendPrompt(userPrompt, this.state.uploadedImageData);

        this.promptInput.value = '';
        this.resizeTextarea();
        this.removeImage();
        this.setWaitingState(true);
    }

    showStopButton() {
        this.stopButton.style.display = 'flex';
        this.sendButton.style.display = 'none';
    }

    hideStopButton() {
        this.stopButton.style.display = 'none';
        this.sendButton.style.display = 'flex';
    }

    toggleDictation() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('Speech recognition is not supported in this browser.'); return; }
        if (this.state.isDictating) { this.recognition.stop(); return; }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.state.currentLang === 'vi' ? 'vi-VN' : 'en-US';
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
            this.state.isDictating = true;
            this.micButton.classList.add('recording');
            this.promptInput.placeholder = 'Listening...';
        };
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            if (finalTranscript) {
                this.promptInput.value += (this.promptInput.value ? ' ' : '') + finalTranscript;
                this.resizeTextarea();
            }
        };
        this.recognition.onend = () => {
            this.state.isDictating = false;
            this.micButton.classList.remove('recording');
            this.applyLanguageText(this.state.currentLang);
        };
        this.recognition.onerror = () => {
            this.state.isDictating = false;
            this.micButton.classList.remove('recording');
            this.applyLanguageText(this.state.currentLang);
        };
        try { this.recognition.start(); } catch(_) {}
    }

    setWaitingState(isWaiting) {
        this.state.isWaitingForResponse = isWaiting;
        this.sendButton.disabled = isWaiting;
        this.promptInput.disabled = isWaiting;
        if (isWaiting) {
            this.sendButton.style.opacity = '0.5';
            this.sendButton.style.cursor = 'not-allowed';
        } else {
            this.sendButton.style.opacity = '1';
            this.sendButton.style.cursor = 'pointer';
            this.promptInput.focus();
        }
    }

    resizeTextarea() {
        const el = this.promptInput;
        const singleLineHeight = 34;
        el.style.height = singleLineHeight + 'px';
        if (el.scrollHeight > singleLineHeight) {
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        }
    }

    handleImageFile(file) {
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            alert(`Image size exceeds the ${MAX_IMAGE_SIZE_MB}MB limit.`);
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            this.state.uploadedImageData = e.target.result;
            this.displayImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    displayImagePreview(imageData) {
        this.imagePreviewContainer.style.display = 'flex';
        this.imagePreviewContainer.innerHTML = `<div class="image-preview"><img src="${imageData}" alt="Image preview"/><button class="remove-image-button">&times;</button></div>`;
        this.imagePreviewContainer.querySelector('.remove-image-button').addEventListener('click', () => this.removeImage());
    }

    removeImage() {
        this.state.uploadedImageData = null;
        this.imagePreviewContainer.innerHTML = '';
        this.imagePreviewContainer.style.display = 'none';
        this.imageUploadInput.value = '';
    }

    applyLanguageText(lang) {
        document.querySelectorAll('[data-key]').forEach(el => {
            const key = el.dataset.key;
            if (TRANSLATIONS[lang][key]) el.textContent = TRANSLATIONS[lang][key];
        });
        this.promptInput.placeholder = TRANSLATIONS[lang].typeMessage;
        document.querySelectorAll('.options label span').forEach(el => {
            const key = el.getAttribute('data-txt').toLowerCase();
            if (TRANSLATIONS[lang][key]) el.textContent = TRANSLATIONS[lang][key];
        });
        document.querySelector(`input[name="language"][value="${lang}"]`).checked = true;
    }

    applyThemeVisuals(theme) {
        if (theme === 'light') {
            this.iFrameBody.classList.add('light-theme');
            this.settingsIcon.src = 'settings-light.png';
            this.backIcon.src = 'arrow-left-light.png';
            this.uploadIcon.src = 'upload-light.png';
            this.sendIcon.src = 'send-light.png';
        } else {
            this.iFrameBody.classList.remove('light-theme');
            this.settingsIcon.src = 'settings-dark.png';
            this.backIcon.src = 'arrow-left-dark.png';
            this.uploadIcon.src = 'upload-dark.png';
            this.sendIcon.src = 'send-dark.png';
        }
    }
}

// ChatManager

class ChatManager {
    constructor(state) {
        this.state = state;
        this.chatHistoryDiv = document.getElementById('gemini-chat-history');
        this.streamDiv = null;
        this.streamAccum = '';
    }

    addDateLine() {
        const dateDiv = document.createElement('div');
        dateDiv.classList.add('date-divider');
        dateDiv.textContent = new Date().toLocaleDateString(this.state.currentLang, { year: 'numeric', month: 'long', day: 'numeric' });
        this.chatHistoryDiv.appendChild(dateDiv);
    }

    clearChat() {
        this.chatHistoryDiv.innerHTML = '';
        this.addMessage(TRANSLATIONS[this.state.currentLang].welcomeMessage, 'gemini');
    }

    addMessage(text, sender, imageData = null, citations = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('gemini-message');
        const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (sender === 'user') {
            messageDiv.classList.add('user-message');
            if (imageData) {
                const img = document.createElement('img');
                img.src = imageData;
                img.alt = "User upload";
                img.classList.add('user-upload-image');
                messageDiv.appendChild(img);
            }
            if (text) {
                const textDiv = document.createElement('div');
                textDiv.textContent = text;
                messageDiv.appendChild(textDiv);
            }
        } else {
            messageDiv.classList.add('gemini-response');
            if (sender === 'gemini-error') messageDiv.classList.add('error-message');
            this._fillResponseDiv(messageDiv, text || '', citations, formattedTime, sender === 'gemini-error');
            this.chatHistoryDiv.appendChild(messageDiv);
            this.smartScrollToBottom();
            return;
        }

        const timestampDiv = document.createElement('div');
        timestampDiv.classList.add('timestamp');
        timestampDiv.textContent = formattedTime;
        messageDiv.appendChild(timestampDiv);

        this.chatHistoryDiv.appendChild(messageDiv);
        this.smartScrollToBottom();
    }

    _fillResponseDiv(div, text, citations, formattedTime, isError) {
        div.innerHTML = simpleMarkdownToHtml(text);

        // Auto-expand logic
        if (this.state.autoExpand && text && text.length > 800) {
            const largeRadio = document.querySelector('input[name="size"][value="large"]');
            if (largeRadio && !largeRadio.checked) {
                largeRadio.checked = true;
                // We need to trigger the size change via window.parent or SettingsManager
                window.parent.postMessage({ type: 'SIZE_CHANGED', size: 'large' }, '*');
            }
        }

        if (!isError) {
            const actionsRow = document.createElement('div');
            actionsRow.classList.add('message-actions');

            // TTS button
            const speakerBtn = document.createElement('button');
            speakerBtn.innerHTML = '🔊';
            speakerBtn.classList.add('msg-action-btn', 'tts-btn');
            speakerBtn.title = 'Read aloud';
            if (!this.state.ttsEnabled) speakerBtn.style.display = 'none';
            speakerBtn.onclick = () => {
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                } else {
                    const clean = text.replace(/```[\s\S]*?```/g, '');
                    const utterance = new SpeechSynthesisUtterance(clean);
                    utterance.lang = this.state.currentLang === 'vi' ? 'vi-VN' : 'en-US';
                    window.speechSynthesis.speak(utterance);
                }
            };
            actionsRow.appendChild(speakerBtn);

            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.innerHTML = '📋';
            copyBtn.classList.add('msg-action-btn', 'copy-btn');
            copyBtn.title = TRANSLATIONS[this.state.currentLang].copy;
            if (!this.state.copyEnabled) copyBtn.style.display = 'none';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = '✓';
                    copyBtn.title = TRANSLATIONS[this.state.currentLang].copied;
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋';
                        copyBtn.title = TRANSLATIONS[this.state.currentLang].copy;
                    }, 1500);
                }).catch(() => {});
            };
            actionsRow.appendChild(copyBtn);

            div.appendChild(actionsRow);
        }

        // Citations
        if (citations?.groundingChunks?.length > 0) {
            const citationsDiv = document.createElement('div');
            citationsDiv.classList.add('gemini-citations');
            const title = document.createElement('p');
            title.classList.add('citations-title');
            title.textContent = TRANSLATIONS[this.state.currentLang].sources;
            citationsDiv.appendChild(title);
            const list = document.createElement('ul');
            list.classList.add('citations-list');
            citations.groundingChunks.forEach(chunk => {
                if (chunk.uri && chunk.title) {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = chunk.uri;
                    a.textContent = chunk.title;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    li.appendChild(a);
                    list.appendChild(li);
                }
            });
            citationsDiv.appendChild(list);
            div.appendChild(citationsDiv);
        }

        const timestampDiv = document.createElement('div');
        timestampDiv.classList.add('timestamp');
        timestampDiv.textContent = formattedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        div.appendChild(timestampDiv);
    }

    // Streaming

    startStreamMessage() {
        this.removeLoader();
        this.streamDiv = document.createElement('div');
        this.streamDiv.classList.add('gemini-message', 'gemini-response');
        this.streamAccum = '';
        this.chatHistoryDiv.appendChild(this.streamDiv);
        this.smartScrollToBottom();
    }

    appendStreamChunk(text) {
        this.streamAccum += text;
        // Show raw text during streaming; markdown renders on finalize
        this.streamDiv.innerHTML = escapeHtml(this.streamAccum).replace(/\n/g, '<br>');
        this.smartScrollToBottom();
    }

    finalizeStreamMessage(fullText, groundingMetadata) {
        if (!this.streamDiv) return;
        const div = this.streamDiv;
        this.streamDiv = null;
        this.streamAccum = '';
        div.innerHTML = '';
        this._fillResponseDiv(div, fullText || '', groundingMetadata, null, false);
        this.smartScrollToBottom();
    }

    abortStreamMessage() {
        if (this.streamDiv) {
            // Finalize with whatever partial text was accumulated
            this.finalizeStreamMessage(this.streamAccum, null);
        }
    }

    showLoader() {
        if (this.chatHistoryDiv.querySelector('.loader')) return;
        const loaderDiv = document.createElement('div');
        loaderDiv.classList.add('gemini-message', 'gemini-response', 'loader');
        loaderDiv.innerHTML = `<div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div>`;
        this.chatHistoryDiv.appendChild(loaderDiv);
        this.smartScrollToBottom();
    }

    removeLoader() {
        const loader = this.chatHistoryDiv.querySelector('.loader');
        if (loader) loader.remove();
    }

    smartScrollToBottom() {
        const el = this.chatHistoryDiv;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }

    scrollToBottom() {
        this.chatHistoryDiv.scrollTop = this.chatHistoryDiv.scrollHeight;
    }

    restoreHistory(historyData) {
        this.chatHistoryDiv.innerHTML = '';
        this.addDateLine();
        this.addMessage(TRANSLATIONS[this.state.currentLang].welcomeMessage, 'gemini');

        historyData.forEach(item => {
            if (item.role === 'user') {
                const textPart = item.parts.find(p => p.text);
                const imgPart = item.parts.find(p => p.inline_data);
                const imgData = imgPart ? `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}` : null;
                if (textPart?.text || imgData) this.addMessage(textPart?.text || null, 'user', imgData);
            } else if (item.role === 'model') {
                const textPart = item.parts.find(p => p.text);
                if (textPart) this.addMessage(textPart.text, 'gemini');
            }
        });

        this.scrollToBottom();
    }

    exportChat() {
        const messages = this.chatHistoryDiv.querySelectorAll('.gemini-message');
        let md = `# Gemini Chat — ${new Date().toLocaleDateString()}\n\n`;

        messages.forEach(msg => {
            if (msg.classList.contains('loader')) return;
            if (msg.classList.contains('user-message')) {
                const textDiv = msg.querySelector('div');
                const img = msg.querySelector('img.user-upload-image');
                if (img) md += `**You:** [image]\n\n`;
                if (textDiv?.textContent) md += `**You:** ${textDiv.textContent}\n\n`;
            } else if (msg.classList.contains('gemini-response')) {
                const clone = msg.cloneNode(true);
                clone.querySelectorAll('.message-actions, .gemini-citations, .timestamp').forEach(el => el.remove());
                const text = clone.textContent.trim();
                if (text) md += `**Gemini:** ${text}\n\n`;
            }
        });

        const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `gemini-chat-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// SettingsManager

class SettingsManager {
    constructor(state, uiManager, chatManager, ipcManager) {
        this.state = state;
        this.uiManager = uiManager;
        this.chatManager = chatManager;
        this.ipcManager = ipcManager;
        this.themeRadios = document.querySelectorAll('input[name="theme"]');
        this.sizeRadios = document.querySelectorAll('input[name="size"]');
        this.langRadios = document.querySelectorAll('input[name="language"]');
        this.persistCheckbox = document.getElementById('persist-settings-checkbox');
        this.autoExpandCheckbox = document.getElementById('auto-expand-checkbox');
        this.ttsCheckbox = document.getElementById('tts-checkbox');
        this.copyCheckbox = document.getElementById('copy-checkbox');
        this.cornerBtns = document.querySelectorAll('.corner-btn');
        this.resetPositionBtn = document.getElementById('reset-position-button');
        this.bindEvents();
    }

    bindEvents() {
        this.themeRadios.forEach(r => r.addEventListener('change', () => { this.applyTheme(r.value); this.saveSettings(); }));
        this.sizeRadios.forEach(r => r.addEventListener('change', () => { this.applySize(r.value); this.saveSettings(); }));
        this.langRadios.forEach(r => r.addEventListener('change', () => { this.applyLanguage(r.value); this.saveSettings(); }));
        this.persistCheckbox.addEventListener('change', () => this.saveSettings());
        this.autoExpandCheckbox.addEventListener('change', (e) => {
            this.state.autoExpand = e.target.checked;
            this.saveSettings();
        });
        this.ttsCheckbox.addEventListener('change', (e) => {
            this.state.ttsEnabled = e.target.checked;
            document.querySelectorAll('.tts-btn').forEach(btn => {
                btn.style.display = e.target.checked ? '' : 'none';
            });
            this.saveSettings();
        });
        this.copyCheckbox.addEventListener('change', (e) => {
            this.state.copyEnabled = e.target.checked;
            document.querySelectorAll('.copy-btn').forEach(btn => {
                btn.style.display = e.target.checked ? '' : 'none';
            });
            this.saveSettings();
        });
        this.cornerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const corner = btn.dataset.corner;
                this._setCornerActive(corner);
                window.parent.postMessage({ type: 'SET_CORNER_POSITION', corner }, '*');
            });
        });
        this.resetPositionBtn.addEventListener('click', () => {
            this._setCornerActive('bottom-right');
            window.parent.postMessage({ type: 'SET_CORNER_POSITION', corner: 'bottom-right' }, '*');
        });
    }

    _setCornerActive(corner) {
        this.cornerBtns.forEach(b => b.classList.toggle('active', b.dataset.corner === corner));
    }

    applyLanguage(lang) {
        this.state.currentLang = lang;
        this.uiManager.applyLanguageText(lang);
        this.ipcManager.sendLanguageChange(lang);
    }

    applyTheme(theme) {
        this.uiManager.applyThemeVisuals(theme);
        document.querySelector(`input[name="theme"][value="${theme}"]`).checked = true;
        this.ipcManager.sendThemeChange(theme);
    }

    applySize(size) {
        document.querySelector(`input[name="size"][value="${size}"]`).checked = true;
        this.ipcManager.sendSizeChange(size);
    }

    saveSettings() {
        const persist = this.persistCheckbox.checked;
        if (persist) {
            const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
            const currentSize = document.querySelector('input[name="size"]:checked').value;
            chrome.storage.local.set({
                theme: currentTheme,
                size: currentSize,
                language: this.state.currentLang,
                autoExpand: this.state.autoExpand,
                ttsEnabled: this.state.ttsEnabled,
                copyEnabled: this.state.copyEnabled,
                persistSettings: true
            });
        } else {
            chrome.storage.local.remove(['theme', 'size', 'language', 'autoExpand', 'ttsEnabled', 'copyEnabled', 'persistSettings']);
        }
    }

    loadSettings() {
        chrome.storage.local.get(['theme', 'size', 'language', 'autoExpand', 'ttsEnabled', 'copyEnabled', 'persistSettings', 'cornerPosition'], result => {
            if (result.persistSettings) {
                this.persistCheckbox.checked = true;
                this.applyTheme(result.theme || 'dark');
                this.applySize(result.size || 'default');
                this.applyLanguage(result.language || 'en');
                if (result.autoExpand !== undefined) {
                    this.state.autoExpand = result.autoExpand;
                    this.autoExpandCheckbox.checked = result.autoExpand;
                }
                if (result.ttsEnabled === false) {
                    this.state.ttsEnabled = false;
                    this.ttsCheckbox.checked = false;
                }
                if (result.copyEnabled === false) {
                    this.state.copyEnabled = false;
                    this.copyCheckbox.checked = false;
                }
            } else {
                this.applyTheme('dark');
                this.applySize('default');
                this.applyLanguage('en');
            }
            // Restore corner picker state regardless of persistSettings (position always persists)
            if (result.cornerPosition) {
                this._setCornerActive(result.cornerPosition);
            }
            this.chatManager.addDateLine();
            this.chatManager.addMessage(TRANSLATIONS[this.state.currentLang].welcomeMessage, 'gemini');
        });
    }
}

// IpcManager

class IpcManager {
    constructor(uiManager, chatManager) {
        this.uiManager = uiManager;
        this.chatManager = chatManager;
        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('message', event => {
            if (event.source !== window.parent) return;
            const message = event.data;

            if (message.type === 'RESTORE_HISTORY') {
                this.chatManager.restoreHistory(message.history);
            } else if (message.type === 'ADD_USER_MESSAGE') {
                this.chatManager.addMessage(message.text, 'user', message.imageData || null);
                this.chatManager.showLoader();
                this.uiManager.setWaitingState(true);
            } else if (message.type === 'GEMINI_STREAM_START') {
                this.chatManager.startStreamMessage();
                this.uiManager.showStopButton();
            } else if (message.type === 'GEMINI_STREAM_CHUNK') {
                this.chatManager.appendStreamChunk(message.text);
            } else if (message.type === 'GEMINI_STREAM_END') {
                this.chatManager.finalizeStreamMessage(message.fullText, message.groundingMetadata);
                this.uiManager.setWaitingState(false);
                this.uiManager.hideStopButton();
            } else if (message.type === 'GEMINI_STREAM_ABORT') {
                this.chatManager.abortStreamMessage();
                this.uiManager.setWaitingState(false);
                this.uiManager.hideStopButton();
            } else if (message.type === 'GEMINI_RESPONSE') {
                // Legacy fallback (function-call path without streaming)
                this.chatManager.removeLoader();
                this.uiManager.setWaitingState(false);
                this.uiManager.hideStopButton();
                this.chatManager.addMessage(message.text, 'gemini', null, message.groundingMetadata);
            } else if (message.type === 'GEMINI_ERROR') {
                this.chatManager.removeLoader();
                this.uiManager.setWaitingState(false);
                this.uiManager.hideStopButton();
                this.chatManager.addMessage(message.text, 'gemini-error');
            } else if (message.type === 'IFRAME_RESIZED') {
                this.uiManager.resizeTextarea();
            }
        });
    }

    sendPrompt(prompt, imageData) {
        window.parent.postMessage({ type: 'GEMINI_PROMPT', text: prompt, imageData }, '*');
    }
    sendClearHistory() { window.parent.postMessage({ type: 'CLEAR_CHAT_HISTORY' }, '*'); }
    sendLanguageChange(lang) { window.parent.postMessage({ type: 'LANGUAGE_CHANGED', lang }, '*'); }
    sendThemeChange(theme) { window.parent.postMessage({ type: 'THEME_CHANGED', theme }, '*'); }
    sendSizeChange(size) { window.parent.postMessage({ type: 'SIZE_CHANGED', size }, '*'); }
}

// Init

window.addEventListener('DOMContentLoaded', () => {
    const state = new AppState();
    const chatManager = new ChatManager(state);
    const uiManager = new UIManager(state, chatManager);
    const ipcManager = new IpcManager(uiManager, chatManager);

    uiManager.ipcManager = ipcManager;

    const settingsManager = new SettingsManager(state, uiManager, chatManager, ipcManager);
    uiManager.settingsManager = settingsManager;

    settingsManager.loadSettings();
});
