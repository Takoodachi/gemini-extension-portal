chrome.runtime.onInstalled.addListener(() => {
  // Default to ON when installed
  chrome.storage.local.set({ isEnabled: true });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-feature") {
    chrome.storage.local.get("isEnabled", (data) => {
      const newState = !data.isEnabled;
      
      // 1. Save the new state
      chrome.storage.local.set({ isEnabled: newState });

      // 2. Send a message to the active tab to toggle the UI immediately
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: "toggleState", 
            enabled: newState 
          }).catch(() => {
            // Ignore errors if the user is on a restricted page (like chrome://)
          });
        }
      });
    });
  }
});