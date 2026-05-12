document.addEventListener('DOMContentLoaded', async () => {
    // Match the extension's theme setting
    chrome.storage.local.get(['theme'], (data) => {
        if (data.theme === 'light') document.body.classList.add('light-theme');
    });
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.theme) {
            document.body.classList.toggle('light-theme', changes.theme.newValue === 'light');
        }
    });

    const domainValue = document.getElementById('current-domain');
    const domainInfo = document.querySelector('.domain-info');
    const statusBadge = document.getElementById('status-badge');
    const toggleGlobal = document.getElementById('toggle-global');
    const toggleDomain = document.getElementById('toggle-domain');
    const toggleData = document.getElementById('toggle-data');
    const domainSettingItems = [
        toggleDomain.closest('.setting-item'),
        toggleData.closest('.setting-item')
    ];

    function updateStatusBadge(isEnabled) {
        if (isEnabled) {
            statusBadge.textContent = 'Active';
            statusBadge.className = 'status-badge status-active';
            domainInfo.classList.add('active-site');
        } else {
            statusBadge.textContent = 'Off';
            statusBadge.className = 'status-badge status-inactive';
            domainInfo.classList.remove('active-site');
        }
    }

    function setDomainTogglesEnabled(enabled) {
        toggleDomain.disabled = !enabled;
        toggleData.disabled = !enabled;
        domainSettingItems.forEach(el => {
            if (el) el.classList.toggle('dimmed', !enabled);
        });
    }

    // Get current tab domain
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        domainValue.textContent = "Invalid Page";
        toggleDomain.disabled = true;
        toggleData.disabled = true;
        updateStatusBadge(false);
        return;
    }

    const url = new URL(tab.url);
    const hostname = url.hostname;
    domainValue.textContent = hostname;

    // Load settings
    chrome.storage.local.get(["globalEnabled", "disabledDomains", "disabledDataDomains"], (data) => {
        const globalEnabled = data.globalEnabled !== false;
        const disabledDomains = data.disabledDomains || [];
        const disabledDataDomains = data.disabledDataDomains || [];

        const domainEnabled = !disabledDomains.includes(hostname);
        toggleGlobal.checked = globalEnabled;
        toggleDomain.checked = domainEnabled;
        toggleData.checked = !disabledDataDomains.includes(hostname);

        const fullyEnabled = globalEnabled && domainEnabled;
        updateStatusBadge(fullyEnabled);
        if (!globalEnabled) setDomainTogglesEnabled(false);
    });

    // Handle Global Toggle
    toggleGlobal.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ globalEnabled: isEnabled });
        setDomainTogglesEnabled(isEnabled);
        const domainCurrentlyEnabled = toggleDomain.checked;
        updateStatusBadge(isEnabled && domainCurrentlyEnabled);
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
        updateStatusBadge(toggleGlobal.checked && e.target.checked);
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
