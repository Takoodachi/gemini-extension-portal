chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ isEnabled: true });
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
    chrome.storage.local.get("isEnabled", (data) => {
      const newState = !data.isEnabled;
      chrome.storage.local.set({ isEnabled: newState });
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "toggleState",
            enabled: newState
          }).catch(() => {});
        }
      });
    });
  }
});
