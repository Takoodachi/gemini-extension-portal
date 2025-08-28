(function() {
    if (window.hasRunGeminiPortal) return;
    window.hasRunGeminiPortal = true;

    // --- Configuration ---
    const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;
    const GOOGLE_SEARCH_BASE_URL = "https://www.googleapis.com/customsearch/v1";

    let chatHistory = [];
    let currentLanguage = 'en';

    // --- Create UI Shell ---
    const container = document.createElement('div');
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

    const floatingButton = document.createElement('div');
    floatingButton.id = 'gemini-floating-button';
    floatingButton.innerHTML = `<img src="${chrome.runtime.getURL('chat-icon-dark.png')}" alt="Gemini Chat Icon" />`;
    container.appendChild(floatingButton);
    const floatingButtonIcon = floatingButton.querySelector('img');

    const chatIframe = document.createElement('iframe');
    chatIframe.id = 'gemini-chat-iframe';
    chatIframe.src = chrome.runtime.getURL('chatbox.html');
    container.appendChild(chatIframe);

    chatIframe.addEventListener('transitionend', (event) => {
        if (event.propertyName === 'width') {
            chatIframe.contentWindow.postMessage({ type: 'IFRAME_RESIZED' }, '*');
        }
    });

    // --- Function to update quadrant class ---
    function updateQuadrantClass() {
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

    // --- Drag-and-Drop Logic ---
    let isDragging = false;
    let hasDragged = false;
    let wasVisibleOnDragStart = false; // New flag
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

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - initialMouseX;
        const dy = e.clientY - initialMouseY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { hasDragged = true; }
        container.style.transform = `translate(${offsetX + dx}px, ${offsetY + dy}px)`;
    });

    document.addEventListener('mouseup', (e) => {
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
    });

	document.addEventListener('click', (event) => {
        const isChatVisible = chatIframe.classList.contains('gemini-iframe-visible');
        const isClickOutside = !container.contains(event.target);
        if (isChatVisible && isClickOutside) { toggleChatbox(); }
    });

    // --- Visibility and Communication Logic ---
    function toggleChatbox() { chatIframe.classList.toggle('gemini-iframe-visible'); }

    // --- Function to call Gemini API and handle responses ---
    async function callGeminiApi(currentChatHistory, toolOutputs = null) {
        try {
            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: 'numeric', minute: 'numeric', hour12: true
            });
            const langInstruction = currentLanguage === 'vi' ? 'Please respond in Vietnamese.' : 'Please respond in English.';

            const payload = {
                system_instruction: {
                    parts: [{ text: `System context: The current date and time is ${formattedDate}. ${langInstruction}` }]
                },
                tools: [
                    {
                        functionDeclarations: [
                            {
                                name: "googleSearch",
                                description: "Search Google for information.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        query: {
                                            type: "string",
                                            description: "The search query to send to Google."
                                        }
                                    },
                                    required: ["query"]
                                }
                            }
                        ]
                    }
                ],
                contents: currentChatHistory // The conversation history
            };

            if (toolOutputs) {
                payload.contents.push({
                    role: "function", // The role for tool outputs is "function"
                    parts: [{
                        functionResponse: { // Data for the tool's response
                            name: toolOutputs.name,
                            response: toolOutputs.response // The actual data returned by the tool
                        }
                    }]
                });
            }

            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Full Gemini API Error Response:', errorData);
                throw new Error(`HTTP error! status: ${response.status}. Message: ${errorData.error?.message || JSON.stringify(errorData)}`);
            }

            return await response.json(); // Return the full JSON result
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            chatIframe.contentWindow.postMessage({ type: 'GEMINI_ERROR', text: `An error occurred. Details: ${error.message}` }, '*');
            throw error; // Re-throw to propagate error handling
        }
    }

    // --- Google Search Tool Execution ---
    async function executeGoogleSearch(query) {
        console.log(`Performing real Google Search for: "${query}"`);
        const searchUrl = new URL(GOOGLE_SEARCH_BASE_URL);
        searchUrl.searchParams.append('q', query);
        searchUrl.searchParams.append('key', GOOGLE_SEARCH_API_KEY);
        searchUrl.searchParams.append('cx', CUSTOM_SEARCH_ENGINE_ID);

        try {
            const response = await fetch(searchUrl.toString());
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Full Google Search API Error Response:', errorData);
                throw new Error(`Google Search API HTTP error! status: ${response.status}. Message: ${errorData.error?.message || JSON.stringify(errorData)}`);
            }
            const data = await response.json();

            // Extract relevant snippets and titles for grounding
            let searchResults = [];
            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    searchResults.push({
                        title: item.title,
                        snippet: item.snippet,
                        link: item.link
                    });
                });
            } else {
                searchResults.push({ snippet: "No search results found." });
            }
            return { results: searchResults }; // Return structured results
        } catch (error) {
            console.error('Error executing Google Search:', error);
            return { error: `Failed to perform search: ${error.message}` };
        }
    }


    // --- Message Listener to handle Function Calling ---
    window.addEventListener('message', async (event) => {
        if (event.source !== chatIframe.contentWindow) return;
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
            const userPrompt = message.text;
            const userImageData = message.imageData;
            const userParts = [];
            if (userImageData) {
                userParts.push({ inline_data: { mime_type: userImageData.match(/:(.*?);/)[1], data: userImageData.split(',')[1] } });
            }
            if (userPrompt) { userParts.push({ text: userPrompt }); }

            // Add user's message to history
            chatHistory.push({ role: "user", parts: userParts });

            try {
                // First call: Send user prompt to Gemini
                const result = await callGeminiApi(chatHistory);
                let modelResponseCandidate = result.candidates?.[0];

                if (!modelResponseCandidate) {
                    console.error('API Error: No valid response candidate found in first turn.', result);
                    const errorMessage = result.promptFeedback?.blockReason || "The model's response was blocked.";
                    chatIframe.contentWindow.postMessage({ type: 'GEMINI_ERROR', text: `Sorry, I can't respond to that. Reason: ${errorMessage}` }, '*');
                    return;
                }

                // Check if the model wants to call a function
                const functionCall = modelResponseCandidate.content.parts?.[0]?.functionCall;

                if (functionCall) {
                    console.log('Model wants to call a function:', functionCall);
                    chatHistory.push({ role: "model", parts: [{ functionCall: functionCall }] }); // Add the function call to history

                    let toolOutput;
                    if (functionCall.name === 'googleSearch') {
                        toolOutput = await executeGoogleSearch(functionCall.args.query);
                    } else {
                        // Handle other potential function calls here if you add more tools
                        console.warn(`Unknown function call: ${functionCall.name}`);
                        toolOutput = { error: `Unknown function: ${functionCall.name}` };
                    }

                    // Second call: Send tool output back to Gemini
                    console.log('Sending tool output back to Gemini:', toolOutput);
                    const secondResult = await callGeminiApi(chatHistory, { name: functionCall.name, response: toolOutput });
                    modelResponseCandidate = secondResult.candidates?.[0];

                    if (!modelResponseCandidate) {
                        console.error('API Error: No valid response candidate found after tool execution.', secondResult);
                        const errorMessage = secondResult.promptFeedback?.blockReason || "The model's response was blocked after tool execution.";
                        chatIframe.contentWindow.postMessage({ type: 'GEMINI_ERROR', text: `Sorry, I can't respond to that. Reason: ${errorMessage}` }, '*');
                        return;
                    }
                }

                // Final response handling (after initial or tool-assisted generation)
                const geminiResponseText = modelResponseCandidate.content.parts?.[0]?.text;
                const groundingMetadata = modelResponseCandidate.groundingMetadata;

                if (geminiResponseText) {
                    chatHistory.push({ role: "model", parts: [{ text: geminiResponseText }] });
                    chatIframe.contentWindow.postMessage({
                        type: 'GEMINI_RESPONSE',
                        text: geminiResponseText,
                        groundingMetadata: groundingMetadata
                    }, '*');
                } else {
                    console.error('API Error: No text response found in final candidate.', modelResponseCandidate);
                    chatIframe.contentWindow.postMessage({ type: 'GEMINI_ERROR', text: "The model did not provide a text response." }, '*');
                }

            } catch (error) {
                console.error('Unhandled error in GEMINI_PROMPT:', error);
                chatIframe.contentWindow.postMessage({ type: 'GEMINI_ERROR', text: `An unhandled error occurred: ${error.message}` }, '*');
            }
        }
    });
})();