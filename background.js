chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ 
      globalEnabled: true, 
      disabledDomains: [], 
      disabledDataDomains: [] 
    });
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "gemini-summarize",     title: "Summarize with Gemini",      contexts: ["selection"] });
    chrome.contextMenus.create({ id: "gemini-explain",       title: "Explain with Gemini",         contexts: ["selection"] });
    chrome.contextMenus.create({ id: "gemini-fix-grammar",   title: "Fix grammar & spelling",      contexts: ["selection"] });
    chrome.contextMenus.create({ id: "gemini-rephrase",      title: "Rephrase / Rewrite",          contexts: ["selection"] });
    chrome.contextMenus.create({ id: "gemini-shorten",       title: "Make it shorter",             contexts: ["selection"] });
    chrome.contextMenus.create({ id: "gemini-translate-vi",  title: "Translate to Vietnamese",     contexts: ["selection"] });
    chrome.contextMenus.create({ id: "gemini-translate-en",  title: "Translate to English",        contexts: ["selection"] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: "contextMenuClick",
      menuId: info.menuItemId,
      text: info.selectionText
    }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-feature") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].url) return;
      
      const url = new URL(tabs[0].url);
      if (url.protocol === 'chrome:' || url.protocol === 'edge:') return;
      
      const hostname = url.hostname;
      chrome.storage.local.get(["disabledDomains", "globalEnabled"], (data) => {
        if (data.globalEnabled === false) return; // Ignore shortcut if globally disabled

        let domains = data.disabledDomains || [];
        const isCurrentlyDisabled = domains.includes(hostname);

        if (isCurrentlyDisabled) {
            domains = domains.filter(d => d !== hostname); // Enable it
        } else {
            domains.push(hostname); // Disable it
        }

        chrome.storage.local.set({ disabledDomains: domains });
      });
    });
  }
});

// Broadcast state changes to all tabs immediately
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.globalEnabled || changes.disabledDomains)) {
    chrome.storage.local.get(["globalEnabled", "disabledDomains"], (data) => {
      const globalEnabled = data.globalEnabled !== false;
      const disabledDomains = data.disabledDomains || [];

      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) continue;
          
          try {
            const url = new URL(tab.url);
            const isDomainDisabled = disabledDomains.includes(url.hostname);
            const shouldBeEnabled = globalEnabled && !isDomainDisabled;
            
            chrome.tabs.sendMessage(tab.id, {
              action: "toggleState",
              enabled: shouldBeEnabled
            }).catch(() => {});
          } catch (e) {}
        }
      });
    });
  }
});
