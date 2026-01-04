(function() {
    // Prevent multiple injections, but allow toggling
    if (window.hasRunGeminiPortal) return;
    window.hasRunGeminiPortal = true;

    // --- State Variables ---
    let container = null;
    let floatingButton = null;
    let chatIframe = null;
    let chatHistory = [];
    let currentLanguage = 'en';
    
    // --- Event Listener References (Need these to remove them properly) ---
    let handleDragMove = null;
    let handleDragEnd = null;
    let handleDocClick = null;
    let handleWindowMessage = null;

    // --- Logic to Enable (Create UI) ---
    function enableFeature() {
        if (container) return; // Already enabled

        // 1. Create UI Shell
        container = document.createElement('div');
        container.id = 'gemini-chatbox-container';
        container.classList.add('bottom-right');
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '2147483647',
            transition: 'transform 0.2s ease-out'
        });
        document.body.appendChild(container);

        floatingButton = document.createElement('div');
        floatingButton.id = 'gemini-floating-button';
        floatingButton.innerHTML = `<img src="${chrome.runtime.getURL('chat-icon-dark.png')}" alt="Gemini Chat Icon" />`;
        container.appendChild(floatingButton);
        const floatingButtonIcon = floatingButton.querySelector('img');

        chatIframe = document.createElement('iframe');
        chatIframe.id = 'gemini-chat-iframe';
        chatIframe.src = chrome.runtime.getURL('chatbox.html');
        container.appendChild(chatIframe);

        chatIframe.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'width') {
                chatIframe.contentWindow.postMessage({ type: 'IFRAME_RESIZED' }, '*');
            }
        });

        // 2. Setup Drag & Drop Logic
        let isDragging = false;
        let hasDragged = false;
        let wasVisibleOnDragStart = false;
        let offsetX = 0, offsetY = 0;
        let initialMouseX, initialMouseY;

        floatingButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            hasDragged = false;
            container.style.transition = 'none';
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            floatingButton.style.cursor = 'grabbing';

            wasVisibleOnDragStart = chatIframe.classList.contains('gemini-iframe-visible');
            if (wasVisibleOnDragStart) {
                chatIframe.classList.remove('gemini-iframe-visible');
            }
        });

        // Define named functions for document listeners so we can remove them later
        handleDragMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { hasDragged = true; }
            container.style.transform = `translate(${offsetX + dx}px, ${offsetY + dy}px)`;
        };

        handleDragEnd = (e) => {
            if (isDragging) {
                isDragging = false;
                container.style.transition = 'transform 0.2s ease-out';
                floatingButton.style.cursor = 'grab';
                const dx = e.clientX - initialMouseX;
                const dy = e.clientY - initialMouseY;
                offsetX += dx;
                offsetY += dy;

                if (hasDragged) {
                    updateQuadrantClass();
                    if (wasVisibleOnDragStart) {
                        toggleChatbox();
                    }
                } else {
                    if (!wasVisibleOnDragStart) {
                        toggleChatbox();
                    }
                }
            }
        };

        handleDocClick = (event) => {
            if (!container) return;
            const isChatVisible = chatIframe.classList.contains('gemini-iframe-visible');
            const isClickOutside = !container.contains(event.target);
            if (isChatVisible && isClickOutside) { toggleChatbox(); }
        };

        // Attach listeners
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('click', handleDocClick);

        // 3. Setup Message Handling (Logic)
        handleWindowMessage = async (event) => {
            if (!chatIframe || event.source !== chatIframe.contentWindow) return;
            const message = event.data;

            if (message.type === 'LANGUAGE_CHANGED') {
                currentLanguage = message.lang;
                return;
            }
            if (message.type === 'SIZE_CHANGED') {
                chatIframe.style.width = (message.size === 'large') ? '700px' : '350px';
                return;
            }
            if (message.type === 'THEME_CHANGED') {
                if (message.theme === 'light') {
                    floatingButton.style.backgroundColor = '#FFFFFF';
                    floatingButtonIcon.src = chrome.runtime.getURL('chat-icon-light.png');
                } else {
                    floatingButton.style.backgroundColor = '#121212';
                    floatingButtonIcon.src = chrome.runtime.getURL('chat-icon-dark.png');
                }
                return;
            }
            if (message.type === 'CLEAR_CHAT_HISTORY') {
                chatHistory = [];
                return;
            }
            if (message.type === 'TOGGLE_CHATBOX') {
                toggleChatbox();
            }
            if (message.type === 'GEMINI_PROMPT') {
                // ... (Your existing API logic) ...
                handleGeminiPrompt(message);
            }
        };

        window.addEventListener('message', handleWindowMessage);
    }

    // --- Logic to Disable (Remove UI) ---
    function disableFeature() {
        if (!container) return; // Already disabled

        // 1. Remove Listeners
        if (handleDragMove) document.removeEventListener('mousemove', handleDragMove);
        if (handleDragEnd) document.removeEventListener('mouseup', handleDragEnd);
        if (handleDocClick) document.removeEventListener('click', handleDocClick);
        if (handleWindowMessage) window.removeEventListener('message', handleWindowMessage);

        // 2. Remove DOM Elements
        container.remove();

        // 3. Clean up variables
        container = null;
        floatingButton = null;
        chatIframe = null;
        chatHistory = []; // Reset history for a fresh start next time
    }

    // --- Helper Functions (Reused from your code) ---
    function updateQuadrantClass() {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        container.classList.remove('top-left', 'top-right', 'bottom-left', 'bottom-right');
        const isTop = rect.top + (rect.height / 2) < windowHeight / 2;
        const isLeft = rect.left + (rect.width / 2) < windowWidth / 2;
        if (isTop && isLeft) { container.classList.add('top-left'); }
        else if (isTop && !isLeft) { container.classList.add('top-right'); }
        else if (!isTop && isLeft) { container.classList.add('bottom-left'); }
        else { container.classList.add('bottom-right'); }
    }

    function toggleChatbox() { 
        if(chatIframe) chatIframe.classList.toggle('gemini-iframe-visible'); 
    }

    // (Extracted your API logic into a function to keep code clean)
    async function handleGeminiPrompt(message) {
        const userPrompt = message.text;
        const userImageData = message.imageData;
        const userParts = [];
        if (userImageData) {
            userParts.push({ inline_data: { mime_type: userImageData.match(/:(.*?);/)[1], data: userImageData.split(',')[1] } });
        }
        if (userPrompt) { userParts.push({ text: userPrompt }); }

        chatHistory.push({ role: "user", parts: userParts });

        try {
            const result = await callGeminiApi(chatHistory);
            let modelResponseCandidate = result.candidates?.[0];

            if (!modelResponseCandidate) {
               // ... error handling
               sendError("The model's response was blocked.");
               return;
            }

            const functionCall = modelResponseCandidate.content.parts?.[0]?.functionCall;
            if (functionCall) {
                chatHistory.push({ role: "model", parts: [{ functionCall: functionCall }] });
                let toolOutput;
                if (functionCall.name === 'googleSearch') {
                    toolOutput = await executeGoogleSearch(functionCall.args.query);
                } else {
                    toolOutput = { error: `Unknown function: ${functionCall.name}` };
                }
                const secondResult = await callGeminiApi(chatHistory, { name: functionCall.name, response: toolOutput });
                modelResponseCandidate = secondResult.candidates?.[0];
            }

            const geminiResponseText = modelResponseCandidate?.content.parts?.[0]?.text;
            const groundingMetadata = modelResponseCandidate?.groundingMetadata;

            if (geminiResponseText) {
                chatHistory.push({ role: "model", parts: [{ text: geminiResponseText }] });
                chatIframe.contentWindow.postMessage({
                    type: 'GEMINI_RESPONSE',
                    text: geminiResponseText,
                    groundingMetadata: groundingMetadata
                }, '*');
            } else {
                sendError("The model did not provide a text response.");
            }

        } catch (error) {
            console.error(error);
            sendError(`An unhandled error occurred: ${error.message}`);
        }
    }

    function sendError(text) {
        if (chatIframe) chatIframe.contentWindow.postMessage({ type: 'GEMINI_ERROR', text: text }, '*');
    }

    // --- API Functions (Using your env.js keys) ---
    async function callGeminiApi(history, toolOutputs = null) {
        const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: 'numeric', hour12: true
        });
        const langInstruction = currentLanguage === 'vi' ? 'Please respond in Vietnamese.' : 'Please respond in English.';

        const payload = {
            system_instruction: { parts: [{ text: `System context: The current date and time is ${formattedDate}. ${langInstruction}` }] },
            tools: [{ functionDeclarations: [{ name: "googleSearch", description: "Search Google for information.", parameters: { type: "object", properties: { query: { type: "string", description: "The search query to send to Google." } }, required: ["query"] } }] }],
            contents: history
        };

        if (toolOutputs) {
            payload.contents.push({ role: "function", parts: [{ functionResponse: { name: toolOutputs.name, response: toolOutputs.response } }] });
        }

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(response.statusText);
        return await response.json();
    }

    async function executeGoogleSearch(query) {
        const GOOGLE_SEARCH_BASE_URL = "https://www.googleapis.com/customsearch/v1";
        const searchUrl = new URL(GOOGLE_SEARCH_BASE_URL);
        searchUrl.searchParams.append('q', query);
        searchUrl.searchParams.append('key', GOOGLE_SEARCH_API_KEY);
        searchUrl.searchParams.append('cx', CUSTOM_SEARCH_ENGINE_ID);

        try {
            const response = await fetch(searchUrl.toString());
            const data = await response.json();
            let searchResults = [];
            if (data.items && data.items.length > 0) {
                data.items.forEach(item => { searchResults.push({ title: item.title, snippet: item.snippet, link: item.link }); });
            } else { searchResults.push({ snippet: "No search results found." }); }
            return { results: searchResults };
        } catch (error) { return { error: error.message }; }
    }


    // --- Initialization Listeners ---
    
    // 1. Listen for Toggle Messages from Background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggleState") {
            if (request.enabled) {
                enableFeature();
            } else {
                disableFeature();
            }
        }
    });

    // 2. Initial Check on Page Load
    chrome.storage.local.get("isEnabled", (data) => {
        // Default to true if not set
        if (data.isEnabled === undefined || data.isEnabled === true) {
            enableFeature();
        }
    });

})();