(function() {
    if (window.hasRunGeminiPortal) return;
    window.hasRunGeminiPortal = true;

    // State Variables
    let container = null;
    let floatingButton = null;
    let chatIframe = null;
    let chatHistory = [];
    let currentLanguage = 'en';
    
    // Event Listener References
    let handleDragMove = null;
    let handleDragEnd = null;
    let handleDocClick = null;
    let handleWindowMessage = null;

    // Logic to Enable (Create UI)
    function enableFeature() {
        if (container) return; 

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

        chatIframe.addEventListener('load', () => {
            chrome.storage.session.get("chatHistory", (data) => {
                if (data.chatHistory) {
                    chatHistory = data.chatHistory;
                    chatIframe.contentWindow.postMessage({ 
                        type: 'RESTORE_HISTORY', 
                        history: chatHistory 
                    }, '*');
                }
            });
        });

        chatIframe.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'width') {
                chatIframe.contentWindow.postMessage({ type: 'IFRAME_RESIZED' }, '*');
            }
        });

        // Setup Drag & Drop Logic
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
            if (wasVisibleOnDragStart) chatIframe.classList.remove('gemini-iframe-visible');
        });

        handleDragMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { hasDragged = true; }
            
            // Calculate new position
            let newX = offsetX + dx;
            let newY = offsetY + dy;
            
            // Apply transform to get actual position
            container.style.transform = `translate(${newX}px, ${newY}px)`;
            
            // Get actual container position after transform
            const containerRect = container.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Constrain to viewport boundaries
            let constrainedX = newX;
            let constrainedY = newY;
            
            // If container goes outside left edge, constrain it
            if (containerRect.left < 0) {
                constrainedX = newX - containerRect.left;
            }
            // If container goes outside right edge, constrain it
            if (containerRect.right > viewportWidth) {
                constrainedX = newX - (containerRect.right - viewportWidth);
            }
            // If container goes outside top edge, constrain it
            if (containerRect.top < 0) {
                constrainedY = newY - containerRect.top;
            }
            // If container goes outside bottom edge, constrain it
            if (containerRect.bottom > viewportHeight) {
                constrainedY = newY - (containerRect.bottom - viewportHeight);
            }
            
            // Apply constrained position
            container.style.transform = `translate(${constrainedX}px, ${constrainedY}px)`;
        };

        handleDragEnd = (e) => {
            if (isDragging) {
                isDragging = false;
                floatingButton.style.cursor = 'grab';
                const dx = e.clientX - initialMouseX;
                const dy = e.clientY - initialMouseY;
                let newOffsetX = offsetX + dx;
                let newOffsetY = offsetY + dy;
                
                // Constrain final position to viewport boundaries
                container.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px)`;
                const containerRect = container.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Adjust if outside boundaries
                if (containerRect.left < 0) {
                    newOffsetX = newOffsetX - containerRect.left;
                }
                if (containerRect.right > viewportWidth) {
                    newOffsetX = newOffsetX - (containerRect.right - viewportWidth);
                }
                if (containerRect.top < 0) {
                    newOffsetY = newOffsetY - containerRect.top;
                }
                if (containerRect.bottom > viewportHeight) {
                    newOffsetY = newOffsetY - (containerRect.bottom - viewportHeight);
                }
                
                if (hasDragged) {
                    const snapResult = snapToEdges(newOffsetX, newOffsetY);
                    offsetX = snapResult.x;
                    offsetY = snapResult.y;
                    
                    container.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                    const snappedRect = container.getBoundingClientRect();
                    if (snappedRect.left < 0) {
                        offsetX = offsetX - snappedRect.left;
                    }
                    if (snappedRect.right > viewportWidth) {
                        offsetX = offsetX - (snappedRect.right - viewportWidth);
                    }
                    if (snappedRect.top < 0) {
                        offsetY = offsetY - snappedRect.top;
                    }
                    if (snappedRect.bottom > viewportHeight) {
                        offsetY = offsetY - (snappedRect.bottom - viewportHeight);
                    }
                    
                    container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    container.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                    
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
            }
        };

        handleDocClick = (event) => {
            if (!container) return;
            const isChatVisible = chatIframe.classList.contains('gemini-iframe-visible');
            const isClickOutside = !container.contains(event.target);
            if (isChatVisible && isClickOutside) { toggleChatbox(); }
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('click', handleDocClick);

        // Setup Message Handling
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
                // Clear storage
                chrome.storage.session.remove("chatHistory");
                return;
            }
            if (message.type === 'TOGGLE_CHATBOX') {
                toggleChatbox();
            }
            if (message.type === 'GEMINI_PROMPT') {
                handleGeminiPrompt(message);
            }
        };

        window.addEventListener('message', handleWindowMessage);
    }

    // Logic to Disable (Remove UI)
    function disableFeature() {
        if (!container) return;
        if (handleDragMove) document.removeEventListener('mousemove', handleDragMove);
        if (handleDragEnd) document.removeEventListener('mouseup', handleDragEnd);
        if (handleDocClick) document.removeEventListener('click', handleDocClick);
        if (handleWindowMessage) window.removeEventListener('message', handleWindowMessage);
        container.remove();
        container = null;
        floatingButton = null;
        chatIframe = null;

    }

    // Listen for Storage Changes (Sync across tabs)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'session' && changes.chatHistory) {
            chatHistory = changes.chatHistory.newValue || [];
            if (chatIframe) {
                chatIframe.contentWindow.postMessage({ 
                    type: 'RESTORE_HISTORY', 
                    history: chatHistory 
                }, '*');
            }
        }
    });

    // Helper Functions
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

    // Snap-to-Edges Function
    function snapToEdges(currentX, currentY) {
        if (!container) return { x: currentX, y: currentY };
        
        const rect = container.getBoundingClientRect();
        const snapThreshold = 100;
        const edgeMargin = 20;
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let snapX = currentX;
        let snapY = currentY;
        let snapped = false;

        if (rect.left < snapThreshold + edgeMargin) {
            snapX = currentX - (rect.left - edgeMargin);
            snapped = true;
        } 
        else if (rect.right > windowWidth - (snapThreshold + edgeMargin)) {
            snapX = currentX + (windowWidth - rect.right - edgeMargin);
            snapped = true;
        }

        if (rect.top < snapThreshold + edgeMargin) {
            snapY = currentY - (rect.top - edgeMargin);
            snapped = true;
        } 
        else if (rect.bottom > windowHeight - (snapThreshold + edgeMargin)) {
            snapY = currentY + (windowHeight - rect.bottom - edgeMargin);
            snapped = true;
        }
        
        return { x: snapX, y: snapY, snapped: snapped };
    }

    function toggleChatbox() { 
        if(chatIframe) chatIframe.classList.toggle('gemini-iframe-visible'); 
    }

    async function handleGeminiPrompt(message) {
        const userPrompt = message.text;
        const userImageData = message.imageData;
        const userParts = [];
        if (userImageData) {
            userParts.push({ inline_data: { mime_type: userImageData.match(/:(.*?);/)[1], data: userImageData.split(',')[1] } });
        }
        if (userPrompt) { userParts.push({ text: userPrompt }); }

        chatHistory.push({ role: "user", parts: userParts });
        chrome.storage.session.set({ chatHistory: chatHistory });

        try {
            const result = await callGeminiApi(chatHistory);
            let modelResponseCandidate = result.candidates?.[0];

            if (!modelResponseCandidate) {
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
                chrome.storage.session.set({ chatHistory: chatHistory });

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

    // API Functions
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

    // Initialization
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggleState") {
            if (request.enabled) enableFeature();
            else disableFeature();
        }
    });

    chrome.storage.local.get("isEnabled", (data) => {
        if (data.isEnabled === undefined || data.isEnabled === true) {
            enableFeature();
        }
    });

})();