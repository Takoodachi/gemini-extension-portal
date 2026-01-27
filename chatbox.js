// Helper Functions
function simpleMarkdownToHtml(text) {
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

// Main script execution after the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    const iFrameBody = document.body;
    const uiContainer = document.getElementById('gemini-ui-container');
    const chatHistoryDiv = document.getElementById('gemini-chat-history');
    const promptInput = document.getElementById('gemini-prompt-input');
    const sendButton = document.getElementById('gemini-send-button');
    const settingsButton = document.getElementById('gemini-settings-button');
    const backButton = document.getElementById('gemini-back-button');
    const clearChatButton = document.getElementById('clear-chat-button');
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const sizeRadios = document.querySelectorAll('input[name="size"]');
    const langRadios = document.querySelectorAll('input[name="language"]');
    const persistCheckbox = document.getElementById('persist-settings-checkbox');
    const settingsIcon = document.getElementById('settings-icon');
    const backIcon = document.getElementById('back-icon');
    const uploadIcon = document.getElementById('upload-icon');
	const sendIcon = document.getElementById('send-icon');
    const imageUploadButton = document.getElementById('image-upload-button');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
	const confirmationModal = document.getElementById('confirmation-modal');
    const confirmYesBtn = document.getElementById('confirm-yes');
    const confirmNoBtn = document.getElementById('confirm-no');
	const successModal = document.getElementById('success-modal');
    const successOkBtn = document.getElementById('success-ok');
    let uploadedImageData = null;

    // Translation Strings
    const translations = {
        en: {
            geminiChat: "Gemini Chat",
            settings: "Settings",
            send: "Send",
            language: "Language",
            theme: "Theme",
            dark: "Dark",
            light: "Light",
            chatboxSize: "Chatbox Size",
            default: "Default",
            large: "Large",
            rememberChoice: "Remember my choice",
            clearChat: "Clear Chat History",
            welcomeMessage: "Hello! 👋 How can I help you today?",
            clearConfirm: "Are you sure you want to clear the entire chat history?",
            typeMessage: "Type your message...",
            sources: "Sources:",
			chatCleared: "Chat history cleared!",
            ok: "OK"
        },
        vi: {
            geminiChat: "Trò chuyện Gemini",
            settings: "Cài đặt",
            send: "Gửi",
            language: "Ngôn ngữ",
            theme: "Giao diện",
            dark: "Tối",
            light: "Sáng",
            chatboxSize: "Kích thước",
            default: "Mặc định",
            large: "Lớn",
            rememberChoice: "Ghi nhớ lựa chọn",
            clearChat: "Xóa lịch sử trò chuyện",
            welcomeMessage: "Xin chào! 👋 Tôi có thể giúp gì cho bạn?",
            clearConfirm: "Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện không?",
            typeMessage: "Nhập tin nhắn của bạn...",
            sources: "Nguồn:",
			chatCleared: "Đã xóa lịch sử trò chuyện!",
            ok: "OK"
        }
    };
    let currentLang = 'en';

    // Language & UI Text Logic
    function applyLanguage(lang) {
		currentLang = lang;
		document.querySelectorAll('[data-key]').forEach(el => {
			const key = el.dataset.key;
			if (translations[lang][key]) {
				el.textContent = translations[lang][key];
			}
		});
		promptInput.placeholder = translations[lang].typeMessage;
		document.querySelectorAll('.options label span').forEach(el => {
			const key = el.getAttribute('data-txt').toLowerCase();
			if (translations[lang][key]) {
				el.textContent = translations[lang][key];
			}
		});
		document.querySelector(`input[name="language"][value="${lang}"]`).checked = true;
		window.parent.postMessage({ type: 'LANGUAGE_CHANGED', lang: lang }, '*');
	}

    // Theme & Size Logic
    function applyTheme(theme) {
        if (theme === 'light') {
            iFrameBody.classList.add('light-theme');
            settingsIcon.src = 'settings-light.png';
            backIcon.src = 'arrow-left-light.png';
            uploadIcon.src = 'upload-light.png';
			sendIcon.src = 'send-light.png';
        } else {
            iFrameBody.classList.remove('light-theme');
            settingsIcon.src = 'settings-dark.png';
            backIcon.src = 'arrow-left-dark.png';
            uploadIcon.src = 'upload-dark.png';
			sendIcon.src = 'send-dark.png';
        }
        window.parent.postMessage({ type: 'THEME_CHANGED', theme: theme }, '*');
        document.querySelector(`input[name="theme"][value="${theme}"]`).checked = true;
    }

    function applySize(size) {
        document.querySelector(`input[name="size"][value="${size}"]`).checked = true;
        window.parent.postMessage({ type: 'SIZE_CHANGED', size: size }, '*');
    }

    function saveSettings() {
        const persist = persistCheckbox.checked;
        if (persist) {
            const currentTheme = iFrameBody.classList.contains('light-theme') ? 'light' : 'dark';
            const currentSize = document.querySelector('input[name="size"]:checked').value;
            chrome.storage.local.set({
                theme: currentTheme,
                size: currentSize,
                language: currentLang,
                persistSettings: true
            });
        } else {
            chrome.storage.local.remove(['theme', 'size', 'language', 'persistSettings']);
        }
    }
	
	function addDateLine() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = today.toLocaleDateString(currentLang, options);
        const dateDiv = document.createElement('div');
        dateDiv.classList.add('date-divider');
        dateDiv.textContent = formattedDate;
        chatHistoryDiv.appendChild(dateDiv);
    }

    function loadSettings() {
        chrome.storage.local.get(['theme', 'size', 'language', 'persistSettings'], (result) => {
            if (result.persistSettings) {
                persistCheckbox.checked = true;
                applyTheme(result.theme || 'dark');
                applySize(result.size || 'default');
                applyLanguage(result.language || 'en');
            } else {
                applyTheme('dark');
                applySize('default');
                applyLanguage('en');
            }
			addDateLine();
            addMessage(translations[currentLang].welcomeMessage, 'gemini');
        });
    }

    themeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            applyTheme(radio.value);
            saveSettings();
        });
    });

    sizeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            applySize(radio.value);
            saveSettings();
        });
    });

    langRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            applyLanguage(radio.value);
            saveSettings();
        });
    });

    persistCheckbox.addEventListener('change', saveSettings);

    // Image Upload & Paste Logic
    imageUploadButton.addEventListener('click', () => { imageUploadInput.click(); });
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) { handleImageFile(file); }
    });
	
    promptInput.addEventListener('paste', (event) => {
        const items = (event.clipboardData || window.clipboardData).items;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                handleImageFile(file);
                event.preventDefault();
                return;
            }
        }
    });
	
    function handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImageData = e.target.result;
            displayImagePreview(uploadedImageData);
        };
        reader.readAsDataURL(file);
    }
	
    function displayImagePreview(imageData) {
        imagePreviewContainer.style.display = 'flex';
        imagePreviewContainer.innerHTML = `<div class="image-preview"><img src="${imageData}" alt="Image preview"/><button class="remove-image-button">&times;</button></div>`;
        imagePreviewContainer.querySelector('.remove-image-button').addEventListener('click', removeImage);
    }
	
    function removeImage() {
        uploadedImageData = null;
        imagePreviewContainer.innerHTML = '';
        imagePreviewContainer.style.display = 'none';
        imageUploadInput.value = '';
    }

    // Helper function that needs access to chatHistoryDiv
    function addMessage(text, sender, imageData = null, citations = null) {
		const messageDiv = document.createElement('div');
		messageDiv.classList.add('gemini-message');
		
		const now = new Date();
		const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		
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
			messageDiv.innerHTML = simpleMarkdownToHtml(text);

			if (citations && citations.groundingChunks && citations.groundingChunks.length > 0) {
				const citationsDiv = document.createElement('div');
				citationsDiv.classList.add('gemini-citations');
				const citationsTitle = document.createElement('p');
				citationsTitle.classList.add('citations-title');
				citationsTitle.textContent = translations[currentLang].sources;
				citationsDiv.appendChild(citationsTitle);

				const citationsList = document.createElement('ul');
				citationsList.classList.add('citations-list');
				citations.groundingChunks.forEach((chunk, index) => {
					if (chunk.uri && chunk.title) {
						const listItem = document.createElement('li');
						const link = document.createElement('a');
						link.href = chunk.uri;
						link.textContent = chunk.title;
						link.target = "_blank";
						link.rel = "noopener noreferrer";
						listItem.appendChild(link);
						citationsList.appendChild(listItem);
					}
				});
				citationsDiv.appendChild(citationsList);
				messageDiv.appendChild(citationsDiv);
			}
		}
		
		const timestampDiv = document.createElement('div');
		timestampDiv.classList.add('timestamp');
		timestampDiv.textContent = formattedTime;
		messageDiv.appendChild(timestampDiv);
		
		chatHistoryDiv.appendChild(messageDiv);
		chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
	}
	
    function showLoader() {
        if (chatHistoryDiv.querySelector('.loader')) return;
        const loaderDiv = document.createElement('div');
        loaderDiv.classList.add('gemini-message', 'gemini-response', 'loader');
        loaderDiv.innerHTML = `<div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div>`;
        chatHistoryDiv.appendChild(loaderDiv);
        chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
    }
	
    function removeLoader() {
        const loader = chatHistoryDiv.querySelector('.loader');
        if (loader) { chatHistoryDiv.removeChild(loader); }
    }

    // Communication with content.js
    function sendMessageToParent(prompt, imageData) {
        window.parent.postMessage({ type: 'GEMINI_PROMPT', text: prompt, imageData: imageData }, '*');
    }
	
    window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;
        const message = event.data;
		
		if (message.type === 'RESTORE_HISTORY') {
            chatHistoryDiv.innerHTML = '';
            
            addDateLine();
            addMessage(translations[currentLang].welcomeMessage, 'gemini');

            message.history.forEach(item => {
                if (item.role === 'user') {
                    const textPart = item.parts.find(p => p.text);
                    const text = textPart ? textPart.text : null;

                    const imgPart = item.parts.find(p => p.inline_data);
                    const imgData = imgPart ? `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}` : null;
                    
                    if (text || imgData) {
                        addMessage(text, 'user', imgData);
                    }
                } else if (item.role === 'model') {
                    const textPart = item.parts.find(p => p.text);
                    if (textPart) {
                        addMessage(textPart.text, 'gemini');
                    }
                }
            });
            chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
        }
		
        if (message.type === 'GEMINI_RESPONSE') {
            removeLoader();
            addMessage(message.text, 'gemini', null, message.groundingMetadata);
        } else if (message.type === 'GEMINI_ERROR') {
            removeLoader();
            addMessage(message.text, 'gemini-error');
        } else if (message.type === 'IFRAME_RESIZED') {
            resizeTextarea();
        }
    });

    // Textarea Resize Logic
    function resizeTextarea() {
        promptInput.style.height = '38px';
        promptInput.style.height = `${promptInput.scrollHeight}px`;
    }

    // Event Listeners
    function handleSend() {
        const userPrompt = promptInput.value.trim();
        if (userPrompt === '' && !uploadedImageData) return;
        addMessage(userPrompt, 'user', uploadedImageData);
        showLoader();
        sendMessageToParent(userPrompt, uploadedImageData);
        promptInput.value = '';
        promptInput.style.height = '38px';
        removeImage();
    }
	
    sendButton.addEventListener('click', handleSend);
	
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    promptInput.addEventListener('input', resizeTextarea);

    // UI Navigation Logic
    settingsButton.addEventListener('click', () => { uiContainer.classList.add('settings-active'); });
    backButton.addEventListener('click', () => { uiContainer.classList.remove('settings-active'); });

    clearChatButton.addEventListener('click', () => {
        confirmationModal.classList.remove('hidden');
    });

    // Modal Action Listeners
    confirmYesBtn.addEventListener('click', () => {
        chatHistoryDiv.innerHTML = '';
        addMessage(translations[currentLang].welcomeMessage, 'gemini');
        window.parent.postMessage({ type: 'CLEAR_CHAT_HISTORY' }, '*');
        
        confirmationModal.classList.add('hidden');
        successModal.classList.remove('hidden');
    });

    confirmNoBtn.addEventListener('click', () => {
        confirmationModal.classList.add('hidden');
    });
	
	successOkBtn.addEventListener('click', () => {
        successModal.classList.add('hidden');
    });
	
	successModal.addEventListener('click', (e) => {
        if (e.target === successModal) {
            successModal.classList.add('hidden');
        }
    });

    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            confirmationModal.classList.add('hidden');
        }
    });

    // Initial Actions
    loadSettings();
});