chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true }, // <-- This is the magic key
    files: ["content.js"]
  });
});