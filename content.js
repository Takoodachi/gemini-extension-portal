(function() {
    if (window.hasRunGeminiPortal) return;
    window.hasRunGeminiPortal = true;

    // State
    let container = null;
    let floatingButton = null;
    let chatIframe = null;
    let chatHistory = [];
    let currentLanguage = 'en';
    let currentAbortController = null;

    // Listener references for cleanup
    let handleDragMove = null;
    let handleDragEnd = null;
    let handleDocClick = null;
    let handleWindowMessage = null;
    let handleKeyDown = null;

    function sendToIframe(message) {
        if (chatIframe) chatIframe.contentWindow.postMessage(message, '*');
    }

    function enableFeature() {
        if (container) return;

        container = document.createElement('div');
        container.id = 'gemini-chatbox-container';
        container.classList.add('bottom-right', 'gemini-entering');
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '2147483647',
            transition: 'transform 0.2s ease-out'
        });
        document.body.appendChild(container);
        container.addEventListener('animationend', () => container.classList.remove('gemini-entering'), { once: true });

        floatingButton = document.createElement('div');
        floatingButton.id = 'gemini-floating-button';
        floatingButton.innerHTML = `<img src="${chrome.runtime.getURL('chat-icon-dark.png')}" alt="Gemini Chat Icon" />`;
        container.appendChild(floatingButton);
        const floatingButtonIcon = floatingButton.querySelector('img');

        chatIframe = document.createElement('iframe');
        chatIframe.id = 'gemini-chat-iframe';
        chatIframe.allow = "microphone";
        chatIframe.src = chrome.runtime.getURL('chatbox.html') + '?v=' + Date.now();
        container.appendChild(chatIframe);

        // Drag state
        let isDragging = false;
        let hasDragged = false;
        let wasVisibleOnDragStart = false;
        let offsetX = 0, offsetY = 0;
        let initialMouseX, initialMouseY;

        // Restore saved widget position
        chrome.storage.local.get('widgetPosition', (data) => {
            if (data.widgetPosition) {
                offsetX = data.widgetPosition.x;
                offsetY = data.widgetPosition.y;
                container.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                updateQuadrantClass();
            }
        });

        chatIframe.addEventListener('load', () => {
            chrome.storage.session.get("chatHistory", (data) => {
                if (data.chatHistory) {
                    chatHistory = data.chatHistory;
                    sendToIframe({ type: 'RESTORE_HISTORY', history: chatHistory });
                }
            });
        });

        chatIframe.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'width') {
                sendToIframe({ type: 'IFRAME_RESIZED' });
            }
        });

        floatingButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            hasDragged = false;
            container.style.transition = 'none';
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            floatingButton.style.cursor = 'grabbing';
            wasVisibleOnDragStart = chatIframe.classList.contains('gemini-iframe-visible');
            if (wasVisibleOnDragStart) chatIframe.classList.remove('gemini-iframe-visible');
        });

        handleDragMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDragged = true;

            let newX = offsetX + dx;
            let newY = offsetY + dy;
            container.style.transform = `translate(${newX}px, ${newY}px)`;

            const r = container.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            if (r.left < 0) newX -= r.left;
            if (r.right > vw) newX -= (r.right - vw);
            if (r.top < 0) newY -= r.top;
            if (r.bottom > vh) newY -= (r.bottom - vh);
            container.style.transform = `translate(${newX}px, ${newY}px)`;
        };

        handleDragEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            floatingButton.style.cursor = 'grab';
            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;
            let newOffsetX = offsetX + dx;
            let newOffsetY = offsetY + dy;

            container.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px)`;
            const r = container.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            if (r.left < 0) newOffsetX -= r.left;
            if (r.right > vw) newOffsetX -= (r.right - vw);
            if (r.top < 0) newOffsetY -= r.top;
            if (r.bottom > vh) newOffsetY -= (r.bottom - vh);

            if (hasDragged) {
                const snap = snapToEdges(newOffsetX, newOffsetY);
                offsetX = snap.x;
                offsetY = snap.y;
                container.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                const sr = container.getBoundingClientRect();
                if (sr.left < 0) offsetX -= sr.left;
                if (sr.right > vw) offsetX -= (sr.right - vw);
                if (sr.top < 0) offsetY -= sr.top;
                if (sr.bottom > vh) offsetY -= (sr.bottom - vh);

                container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                container.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

                // Persist position across page loads
                chrome.storage.local.set({ widgetPosition: { x: offsetX, y: offsetY } });

                setTimeout(() => {
                    updateQuadrantClass();
                    container.style.transition = 'transform 0.2s ease-out';
                }, 300);

                if (wasVisibleOnDragStart) toggleChatbox();
            } else {
                offsetX = newOffsetX;
                offsetY = newOffsetY;
                container.style.transition = 'transform 0.2s ease-out';
                if (!wasVisibleOnDragStart) toggleChatbox();
            }
        };

        handleDocClick = (event) => {
            if (!container) return;
            if (chatIframe.classList.contains('gemini-iframe-visible') && !container.contains(event.target)) {
                toggleChatbox();
            }
        };

        handleKeyDown = (event) => {
            if (event.key === 'Escape' && chatIframe && chatIframe.classList.contains('gemini-iframe-visible')) {
                toggleChatbox();
            }
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('click', handleDocClick);
        document.addEventListener('keydown', handleKeyDown);

        handleWindowMessage = async (event) => {
            if (!chatIframe || event.source !== chatIframe.contentWindow) return;
            const message = event.data;

            if (message.type === 'LANGUAGE_CHANGED') {
                currentLanguage = message.lang;
            } else if (message.type === 'SIZE_CHANGED') {
                chatIframe.style.width = (message.size === 'large') ? '700px' : '350px';
            } else if (message.type === 'THEME_CHANGED') {
                if (message.theme === 'light') {
                    floatingButton.style.backgroundColor = '#FFFFFF';
                    floatingButtonIcon.src = chrome.runtime.getURL('chat-icon-light.png');
                } else {
                    floatingButton.style.backgroundColor = '#121212';
                    floatingButtonIcon.src = chrome.runtime.getURL('chat-icon-dark.png');
                }
            } else if (message.type === 'CLEAR_CHAT_HISTORY') {
                chatHistory = [];
                chrome.storage.session.remove("chatHistory");
            } else if (message.type === 'TOGGLE_CHATBOX') {
                toggleChatbox();
            } else if (message.type === 'SUMMARIZE_PAGE') {
                if (!chatIframe.classList.contains('gemini-iframe-visible')) toggleChatbox();
                
                chrome.storage.local.get(["disabledDataDomains"], (data) => {
                    const disabledDataDomains = data.disabledDataDomains || [];
                    if (disabledDataDomains.includes(window.location.hostname)) {
                        sendError("Data reading is disabled for this website. You can enable it in the extension popup menu.");
                        return;
                    }
                    
                    const pageText = document.body.innerText.slice(0, 15000);
                    sendToIframe({ type: 'ADD_USER_MESSAGE', text: 'Summarize this page' });
                    handleGeminiPrompt({ text: `Please summarize the content of this page:\n\n${pageText}` });
                });
            } else if (message.type === 'STOP_GENERATION') {
                if (currentAbortController) currentAbortController.abort();
            } else if (message.type === 'GEMINI_PROMPT') {
                handleGeminiPrompt(message);
            }
        };

        window.addEventListener('message', handleWindowMessage);
    }

    function disableFeature() {
        if (!container) return;
        if (currentAbortController) currentAbortController.abort();
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('click', handleDocClick);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('message', handleWindowMessage);

        // Animate out, then remove from DOM
        const el = container;
        container = null;
        floatingButton = null;
        chatIframe = null;
        el.classList.add('gemini-hiding');
        el.addEventListener('animationend', () => el.remove(), { once: true });
        setTimeout(() => { if (el.parentNode) el.remove(); }, 500);
    }

    // Sync chat history across tabs
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'session' && changes.chatHistory) {
            chatHistory = changes.chatHistory.newValue || [];
            if (chatIframe) sendToIframe({ type: 'RESTORE_HISTORY', history: chatHistory });
        }
    });

    function updateQuadrantClass() {
        if (!container) return;
        const rect = container.getBoundingClientRect();
        container.classList.remove('top-left', 'top-right', 'bottom-left', 'bottom-right');
        const isTop = rect.top + rect.height / 2 < window.innerHeight / 2;
        const isLeft = rect.left + rect.width / 2 < window.innerWidth / 2;
        container.classList.add(`${isTop ? 'top' : 'bottom'}-${isLeft ? 'left' : 'right'}`);
    }

    function snapToEdges(currentX, currentY) {
        if (!container) return { x: currentX, y: currentY };
        const rect = container.getBoundingClientRect();
        const snapThreshold = 100, edgeMargin = 20;
        const vw = window.innerWidth, vh = window.innerHeight;
        let snapX = currentX, snapY = currentY;

        if (rect.left < snapThreshold + edgeMargin) snapX = currentX - (rect.left - edgeMargin);
        else if (rect.right > vw - (snapThreshold + edgeMargin)) snapX = currentX + (vw - rect.right - edgeMargin);
        if (rect.top < snapThreshold + edgeMargin) snapY = currentY - (rect.top - edgeMargin);
        else if (rect.bottom > vh - (snapThreshold + edgeMargin)) snapY = currentY + (vh - rect.bottom - edgeMargin);

        return { x: snapX, y: snapY };
    }

    function toggleChatbox() {
        if (chatIframe) chatIframe.classList.toggle('gemini-iframe-visible');
    }

    function sendError(text) {
        sendToIframe({ type: 'GEMINI_ERROR', text });
    }

    async function handleGeminiPrompt(message) {
        const userPrompt = message.text;
        const userImageData = message.imageData;
        const userParts = [];
        if (userImageData) {
            userParts.push({ inline_data: { mime_type: userImageData.match(/:(.*?);/)[1], data: userImageData.split(',')[1] } });
        }
        if (userPrompt) userParts.push({ text: userPrompt });

        chatHistory.push({ role: "user", parts: userParts });
        chrome.storage.session.set({ chatHistory });

        currentAbortController = new AbortController();

        try {
            const result = await streamGeminiRequest(chatHistory, null, currentAbortController.signal);

            if (result.functionCall) {
                const { functionCall } = result;
                chatHistory.push({ role: "model", parts: [{ functionCall }] });

                let toolOutput;
                if (functionCall.name === 'googleSearch') {
                    toolOutput = await executeGoogleSearch(functionCall.args.query);
                } else {
                    toolOutput = { error: `Unknown function: ${functionCall.name}` };
                }

                currentAbortController = new AbortController();
                const finalResult = await streamGeminiRequest(
                    chatHistory,
                    { name: functionCall.name, response: toolOutput },
                    currentAbortController.signal
                );

                if (finalResult.text) {
                    chatHistory.push({ role: "model", parts: [{ text: finalResult.text }] });
                    chrome.storage.session.set({ chatHistory });
                }
            } else if (result.text) {
                chatHistory.push({ role: "model", parts: [{ text: result.text }] });
                chrome.storage.session.set({ chatHistory });
            } else if (!result.functionCall) {
                sendError("The model did not return a response.");
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                sendToIframe({ type: 'GEMINI_STREAM_ABORT' });
            } else {
                console.error(error);
                sendError(`Error: ${error.message}`);
            }
        } finally {
            currentAbortController = null;
        }
    }

    async function streamGeminiRequest(history, toolOutputs, signal) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;
        const payload = buildGeminiPayload(history, toolOutputs);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => response.statusText);
            throw new Error(`API Error ${response.status}: ${errBody}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';
        let functionCall = null;
        let groundingMetadata = null;
        let streamStarted = false;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const chunk = JSON.parse(jsonStr);
                        const candidate = chunk.candidates?.[0];
                        if (!candidate) continue;

                        if (candidate.groundingMetadata) groundingMetadata = candidate.groundingMetadata;

                        const part = candidate.content?.parts?.[0];
                        if (!part) continue;

                        if (part.functionCall) {
                            functionCall = part.functionCall;
                        } else if (part.text) {
                            if (!streamStarted) {
                                streamStarted = true;
                                sendToIframe({ type: 'GEMINI_STREAM_START' });
                            }
                            accumulatedText += part.text;
                            sendToIframe({ type: 'GEMINI_STREAM_CHUNK', text: part.text });
                        }
                    } catch (_) { /* ignore malformed chunk */ }
                }
            }
        } finally {
            reader.releaseLock();
        }

        if (streamStarted) {
            sendToIframe({ type: 'GEMINI_STREAM_END', fullText: accumulatedText, groundingMetadata });
        }

        return { text: accumulatedText || null, functionCall, groundingMetadata };
    }

    function buildGeminiPayload(history, toolOutputs) {
        const formattedDate = new Date().toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: 'numeric', hour12: true
        });
        const langInstruction = currentLanguage === 'vi' ? 'Please respond in Vietnamese.' : 'Please respond in English.';

        const payload = {
            system_instruction: {
                parts: [{ text: `System context: The current date and time is ${formattedDate}. ${langInstruction}` }]
            },
            tools: [{
                functionDeclarations: [{
                    name: "googleSearch",
                    description: "Search Google for current information.",
                    parameters: {
                        type: "object",
                        properties: { query: { type: "string", description: "The search query." } },
                        required: ["query"]
                    }
                }]
            }],
            contents: [...history]
        };

        if (toolOutputs) {
            payload.contents.push({
                role: "function",
                parts: [{ functionResponse: { name: toolOutputs.name, response: toolOutputs.response } }]
            });
        }

        return payload;
    }

    async function executeGoogleSearch(query) {
        const url = new URL("https://www.googleapis.com/customsearch/v1");
        url.searchParams.append('q', query);
        url.searchParams.append('key', GOOGLE_SEARCH_API_KEY);
        url.searchParams.append('cx', CUSTOM_SEARCH_ENGINE_ID);
        try {
            const response = await fetch(url.toString());
            const data = await response.json();
            const results = (data.items || []).map(item => ({ title: item.title, snippet: item.snippet, link: item.link }));
            return { results: results.length ? results : [{ snippet: "No results found." }] };
        } catch (error) {
            return { error: error.message };
        }
    }

    const CONTEXT_MENU_PREFIXES = {
        "gemini-summarize":    "Summarize this:\n\n",
        "gemini-explain":      "Explain this:\n\n",
        "gemini-fix-grammar":  "Fix the grammar and spelling of this text:\n\n",
        "gemini-rephrase":     "Rephrase and rewrite this text:\n\n",
        "gemini-shorten":      "Make this text shorter and more concise:\n\n",
        "gemini-translate-vi": "Translate this to Vietnamese:\n\n",
        "gemini-translate-en": "Translate this to English:\n\n"
    };

    const CONTEXT_MENU_LABELS = {
        "gemini-summarize":    "Summarize",
        "gemini-explain":      "Explain",
        "gemini-fix-grammar":  "Fix grammar",
        "gemini-rephrase":     "Rephrase",
        "gemini-shorten":      "Make shorter",
        "gemini-translate-vi": "Translate to Vietnamese",
        "gemini-translate-en": "Translate to English"
    };

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === "toggleState") {
            if (request.enabled) enableFeature(); else disableFeature();
        } else if (request.action === "contextMenuClick") {
            enableFeature();
            setTimeout(() => {
                if (!chatIframe.classList.contains('gemini-iframe-visible')) toggleChatbox();
                const prefix = CONTEXT_MENU_PREFIXES[request.menuId] || "";
                const label = CONTEXT_MENU_LABELS[request.menuId] || "Action";
                const preview = request.text.slice(0, 80) + (request.text.length > 80 ? '…' : '');
                sendToIframe({ type: 'ADD_USER_MESSAGE', text: `${label}: "${preview}"` });
                handleGeminiPrompt({ text: prefix + request.text });
            }, 100);
        }
    });

    chrome.storage.local.get(["globalEnabled", "disabledDomains", "isEnabled"], (data) => {
        // Backwards compatibility with isEnabled during transition
        const isGlobalEnabled = data.globalEnabled !== false && data.isEnabled !== false;
        const disabledDomains = data.disabledDomains || [];
        const isDomainDisabled = disabledDomains.includes(window.location.hostname);
        
        if (isGlobalEnabled && !isDomainDisabled) {
            enableFeature();
        }
    });

})();
