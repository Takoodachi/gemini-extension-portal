document.addEventListener('DOMContentLoaded', async () => {
    const domainValue = document.getElementById('current-domain');
    const toggleGlobal = document.getElementById('toggle-global');
    const toggleDomain = document.getElementById('toggle-domain');
    const toggleData = document.getElementById('toggle-data');

    // Get current tab domain
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        domainValue.textContent = "Invalid Page";
        toggleDomain.disabled = true;
        toggleData.disabled = true;
        return;
    }

    const url = new URL(tab.url);
    const hostname = url.hostname;
    domainValue.textContent = hostname;

    // Load settings
    chrome.storage.local.get(["globalEnabled", "disabledDomains", "disabledDataDomains"], (data) => {
        const globalEnabled = data.globalEnabled !== false; // default true
        const disabledDomains = data.disabledDomains || [];
        const disabledDataDomains = data.disabledDataDomains || [];

        toggleGlobal.checked = globalEnabled;
        toggleDomain.checked = !disabledDomains.includes(hostname);
        toggleData.checked = !disabledDataDomains.includes(hostname);

        // Update UI state based on global master switch
        if (!globalEnabled) {
            toggleDomain.disabled = true;
            toggleData.disabled = true;
        }
    });

    // Handle Global Toggle
    toggleGlobal.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ globalEnabled: isEnabled });
        
        toggleDomain.disabled = !isEnabled;
        toggleData.disabled = !isEnabled;
    });

    // Handle Domain Toggle
    toggleDomain.addEventListener('change', (e) => {
        chrome.storage.local.get(["disabledDomains"], (data) => {
            let domains = data.disabledDomains || [];
            if (e.target.checked) {
                domains = domains.filter(d => d !== hostname);
            } else {
                if (!domains.includes(hostname)) domains.push(hostname);
            }
            chrome.storage.local.set({ disabledDomains: domains });
        });
    });

    // Handle Data Toggle
    toggleData.addEventListener('change', (e) => {
        chrome.storage.local.get(["disabledDataDomains"], (data) => {
            let domains = data.disabledDataDomains || [];
            if (e.target.checked) {
                domains = domains.filter(d => d !== hostname);
            } else {
                if (!domains.includes(hostname)) domains.push(hostname);
            }
            chrome.storage.local.set({ disabledDataDomains: domains });
        });
    });
});
