(function () {
    if (window.hasRunGeminiPortal) return;
    window.hasRunGeminiPortal = true;

    // State
    let container = null;
    let floatingButton = null;
    let chatIframe = null;
    let chatHistory = [];
    let currentLanguage = 'en';
    let currentAbortController = null;
    let currentPageContext = null;
    let offsetX = 0, offsetY = 0;

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

        currentPageContext = detectPageContext();
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
        offsetX = 0;
        offsetY = 0;
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

                // Persist position; clear corner preset since user dragged to a custom spot
                chrome.storage.local.set({ widgetPosition: { x: offsetX, y: offsetY }, cornerPosition: null });

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
                    floatingButton.style.backgroundColor = '#f7f3ef';
                    floatingButtonIcon.src = chrome.runtime.getURL('chat-icon-light.png');
                } else {
                    floatingButton.style.backgroundColor = '#0a0a0a';
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
            } else if (message.type === 'SET_CORNER_POSITION') {
                setCornerPosition(message.corner);
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

    function setCornerPosition(corner) {
        if (!container) return;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isLeft = corner.includes('left');
        const isTop = corner.includes('top');
        // The container anchors at bottom:20px right:20px with a 50px button.
        // Default (bottom-right) offset is (0,0). Other corners shift from there.
        offsetX = isLeft ? -(vw - 90) : 0;
        offsetY = isTop ? -(vh - 90) : 0;
        container.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        container.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        setTimeout(() => {
            updateQuadrantClass();
            container.style.transition = 'transform 0.2s ease-out';
        }, 400);
        chrome.storage.local.set({ widgetPosition: { x: offsetX, y: offsetY }, cornerPosition: corner });
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

                const toolOutput = await executeToolCall(functionCall);

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
            } else {
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;
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

        let groundingMetadata = null;
        let functionCall = null;
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

        let systemText = `You are a helpful AI assistant embedded in a browser extension. The current date and time is ${formattedDate}. ${langInstruction} When you have access to real-time data from a tool, always use it and cite the source briefly. Prefer specialized tools (weather, news, stocks, Wikipedia) over generic web search for queries they can handle.`;

        if (currentPageContext) {
            const ctx = currentPageContext;
            if (ctx.type === 'youtube' && ctx.title) {
                systemText += ` The user is watching a YouTube video: "${ctx.title}"${ctx.channel ? ` by ${ctx.channel}` : ''}.${ctx.description ? ` Description: ${ctx.description}` : ''}`;
            } else if (ctx.type === 'github' && ctx.repo) {
                systemText += ` The user is viewing GitHub repo: ${ctx.repo}.${ctx.about ? ` About: ${ctx.about}.` : ''}${ctx.readme ? ` README: ${ctx.readme}` : ''}`;
            } else if (ctx.type === 'reddit' && ctx.title) {
                systemText += ` The user is on Reddit${ctx.subreddit ? ` (r/${ctx.subreddit})` : ''}: "${ctx.title}".`;
            } else if (ctx.type === 'stackoverflow' && ctx.question) {
                systemText += ` The user is on Stack Overflow: "${ctx.question}".`;
            } else if (ctx.type === 'wikipedia' && ctx.title) {
                systemText += ` The user is reading the Wikipedia article: "${ctx.title}".`;
            } else if (ctx.type === 'article' && ctx.title) {
                systemText += ` The user is reading an article: "${ctx.title}".`;
            }
        }

        const contents = [...history];
        if (toolOutputs) {
            contents.push({
                role: "user",
                parts: [{ functionResponse: { name: toolOutputs.name, response: toolOutputs.response } }]
            });
        }

        return {
            system_instruction: { parts: [{ text: systemText }] },
            tools: [
                { googleSearch: {} },
                {
                    functionDeclarations: [
                        {
                            name: "getWeather",
                            description: "Get current weather and multi-day forecast for any location. Use for all weather, temperature, precipitation, or forecast questions.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    location: { type: "STRING", description: "City name or location (e.g. 'London', 'New York, NY')" },
                                    unit: { type: "STRING", description: "Temperature unit: 'fahrenheit' or 'celsius'", enum: ["fahrenheit", "celsius"] }
                                },
                                required: ["location"]
                            }
                        },
                        {
                            name: "convertCurrency",
                            description: "Convert an amount between any two currencies using live exchange rates. Use for currency conversion or exchange rate questions.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    amount: { type: "NUMBER", description: "The amount to convert" },
                                    from_currency: { type: "STRING", description: "Source currency code (e.g. 'USD', 'EUR', 'JPY')" },
                                    to_currency: { type: "STRING", description: "Target currency code (e.g. 'USD', 'EUR', 'JPY')" }
                                },
                                required: ["amount", "from_currency", "to_currency"]
                            }
                        },
                        {
                            name: "lookupWikipedia",
                            description: "Look up encyclopedic information about a person, place, concept, or event from Wikipedia. Use for factual or background knowledge questions.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    query: { type: "STRING", description: "The topic, person, or concept to look up" }
                                },
                                required: ["query"]
                            }
                        },
                        {
                            name: "getNewsHeadlines",
                            description: "Fetch the latest news articles about any topic. Use for questions about current events, recent developments, or news about a specific subject.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    topic: { type: "STRING", description: "The news topic or keyword to search for" },
                                    count: { type: "INTEGER", description: "Number of articles to return (1-10, default 5)" }
                                },
                                required: ["topic"]
                            }
                        },
                        {
                            name: "getStockPrice",
                            description: "Get the current stock price and market data for a publicly traded company. Use for questions about stock prices, market performance, or financial metrics.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    symbol: { type: "STRING", description: "Stock ticker symbol (e.g. 'AAPL', 'GOOGL', 'TSLA', 'MSFT')" }
                                },
                                required: ["symbol"]
                            }
                        }
                    ]
                }
            ],
            contents
        };
    }

    function detectPageContext() {
        const hostname = window.location.hostname;
        const path = window.location.pathname;

        if (hostname.includes('youtube.com') && path.includes('/watch')) {
            const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim()
                       || document.title.replace(' - YouTube', '').trim();
            const channel = document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim()
                         || document.querySelector('#channel-name a')?.textContent?.trim();
            const description = document.querySelector('#description-inner')?.textContent?.trim()?.slice(0, 400);
            return { type: 'youtube', title, channel, description };
        }

        if (hostname.includes('github.com')) {
            const parts = path.split('/').filter(Boolean);
            if (parts.length >= 2) {
                const repo = `${parts[0]}/${parts[1]}`;
                const about = document.querySelector('p.f4.my-3')?.textContent?.trim()
                           || document.querySelector('[data-pjax="#repo-content-pjax-container"] .BorderGrid-cell p')?.textContent?.trim();
                const readme = document.querySelector('article.markdown-body')?.textContent?.trim()?.slice(0, 800);
                return { type: 'github', repo, about, readme };
            }
        }

        if (hostname.includes('reddit.com')) {
            const title = document.querySelector('h1[id^="post-title"]')?.textContent?.trim()
                       || document.querySelector('h1')?.textContent?.trim()
                       || document.title.split(' : ')[0].trim();
            const subreddit = path.split('/')[2];
            return { type: 'reddit', title, subreddit };
        }

        if (hostname.includes('stackoverflow.com') || hostname.includes('stackexchange.com')) {
            const question = document.querySelector('h1[itemprop="name"] a')?.textContent?.trim()
                          || document.querySelector('h1.fs-headline1')?.textContent?.trim();
            return { type: 'stackoverflow', question };
        }

        if (hostname.includes('wikipedia.org')) {
            const title = document.querySelector('#firstHeading')?.textContent?.trim();
            return { type: 'wikipedia', title };
        }

        if (document.querySelector('article') || document.querySelector('[role="article"]')) {
            const title = document.querySelector('h1')?.textContent?.trim();
            return { type: 'article', title };
        }

        return { type: 'general' };
    }

    function weatherCodeToCondition(code) {
        const map = {
            0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
            45: 'Foggy', 48: 'Depositing rime fog',
            51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
            61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
            71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
            80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
            85: 'Slight snow showers', 86: 'Heavy snow showers',
            95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
        };
        return map[code] || 'Unknown';
    }

    async function executeGetWeather(location, unit = 'fahrenheit') {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results?.length) return { error: `Location not found: ${location}` };

        const { latitude, longitude, name, country, admin1 } = geoData.results[0];
        const displayName = [name, admin1, country].filter(Boolean).join(', ');
        const unitParam = unit === 'celsius' ? 'celsius' : 'fahrenheit';
        const deg = unit === 'celsius' ? '°C' : '°F';

        const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
            `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,precipitation,cloud_cover` +
            `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
            `&temperature_unit=${unitParam}&wind_speed_unit=mph&timezone=auto&forecast_days=4`
        );
        const w = await weatherRes.json();
        const c = w.current;

        return {
            location: displayName,
            current: {
                condition: weatherCodeToCondition(c.weather_code),
                temperature: `${c.temperature_2m}${deg}`,
                feels_like: `${c.apparent_temperature}${deg}`,
                humidity: `${c.relative_humidity_2m}%`,
                wind: `${c.wind_speed_10m} mph`,
                precipitation: `${c.precipitation} mm`,
                cloud_cover: `${c.cloud_cover}%`
            },
            forecast: w.daily.time.map((date, i) => ({
                date,
                condition: weatherCodeToCondition(w.daily.weather_code[i]),
                high: `${w.daily.temperature_2m_max[i]}${deg}`,
                low: `${w.daily.temperature_2m_min[i]}${deg}`,
                rain_chance: `${w.daily.precipitation_probability_max[i]}%`,
                precipitation: `${w.daily.precipitation_sum[i]} mm`,
                max_wind: `${w.daily.wind_speed_10m_max[i]} mph`
            }))
        };
    }

    async function executeConvertCurrency(amount, from_currency, to_currency) {
        const from = from_currency.toLowerCase();
        const to = to_currency.toLowerCase();
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from}.json`);
        const data = await res.json();
        const rate = data[from]?.[to];
        if (!rate) return { error: `No exchange rate found for ${from_currency.toUpperCase()} → ${to_currency.toUpperCase()}` };
        return {
            from: `${amount} ${from_currency.toUpperCase()}`,
            to: `${(amount * rate).toFixed(4)} ${to_currency.toUpperCase()}`,
            rate: rate,
            rate_display: `1 ${from_currency.toUpperCase()} = ${rate} ${to_currency.toUpperCase()}`,
            date: data.date
        };
    }

    async function executeLookupWikipedia(query) {
        const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=1`);
        const searchData = await searchRes.json();
        if (!searchData.query.search?.length) return { error: `No Wikipedia article found for: ${query}` };

        const title = searchData.query.search[0].title;
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        const s = await summaryRes.json();
        return {
            title: s.title,
            description: s.description || '',
            summary: s.extract,
            url: s.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
        };
    }

    async function executeGetNewsHeadlines(topic, count = 5) {
        const safeCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);
        const res = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&lang=en&max=${safeCount}&token=${GNEWS_API_KEY}`);
        const data = await res.json();
        if (!data.articles?.length) return { error: `No news found for: ${topic}` };
        return {
            topic,
            total_found: data.totalArticles,
            articles: data.articles.map(a => ({
                title: a.title,
                source: a.source.name,
                published: a.publishedAt,
                description: a.description,
                url: a.url
            }))
        };
    }

    async function executeGetStockPrice(symbol) {
        const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol.toUpperCase())}&apikey=${ALPHA_VANTAGE_API_KEY}`);
        const data = await res.json();
        const q = data['Global Quote'];
        if (!q?.['05. price']) return { error: `Stock not found: ${symbol.toUpperCase()}. Verify the ticker symbol.` };
        const price = parseFloat(q['05. price']);
        const change = parseFloat(q['09. change']);
        return {
            symbol: q['01. symbol'],
            price: `$${price.toFixed(2)}`,
            change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}`,
            change_percent: q['10. change percent'],
            high: `$${parseFloat(q['03. high']).toFixed(2)}`,
            low: `$${parseFloat(q['04. low']).toFixed(2)}`,
            volume: parseInt(q['06. volume']).toLocaleString(),
            previous_close: `$${parseFloat(q['08. previous close']).toFixed(2)}`,
            last_trading_day: q['07. latest trading day']
        };
    }

    async function executeToolCall(functionCall) {
        try {
            const { name, args } = functionCall;
            switch (name) {
                case 'getWeather':
                    return await executeGetWeather(args.location, args.unit);
                case 'convertCurrency':
                    return await executeConvertCurrency(args.amount, args.from_currency, args.to_currency);
                case 'lookupWikipedia':
                    return await executeLookupWikipedia(args.query);
                case 'getNewsHeadlines':
                    return await executeGetNewsHeadlines(args.topic, args.count);
                case 'getStockPrice':
                    return await executeGetStockPrice(args.symbol);
                default:
                    return { error: `Unknown tool: ${name}` };
            }
        } catch (err) {
            return { error: `Tool execution failed: ${err.message}` };
        }
    }

    const CONTEXT_MENU_PREFIXES = {
        "gemini-summarize": "Summarize this:\n\n",
        "gemini-explain": "Explain this:\n\n",
        "gemini-fix-grammar": "Fix the grammar and spelling of this text:\n\n",
        "gemini-rephrase": "Rephrase and rewrite this text:\n\n",
        "gemini-shorten": "Make this text shorter and more concise:\n\n",
        "gemini-translate-vi": "Translate this to Vietnamese:\n\n",
        "gemini-translate-en": "Translate this to English:\n\n"
    };

    const CONTEXT_MENU_LABELS = {
        "gemini-summarize": "Summarize",
        "gemini-explain": "Explain",
        "gemini-fix-grammar": "Fix grammar",
        "gemini-rephrase": "Rephrase",
        "gemini-shorten": "Make shorter",
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
