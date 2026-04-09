/**
 * ==========================================
 * LogHunt Chrome Extension
 * Author: Ankit Patel
 * Contact: ankit.ap.patel01@gmail.com
 * ==========================================
 */
chrome.action.onClicked.addListener((tab) => {
  // FIX-6: inject into top frame only — main.js / dom.js will locate the
  // correct Visualforce iframe internally. allFrames:true injected the
  // full bundle into every iframe on the page, causing duplicate UI and
  // wasted execution in cross-origin/background iframes.
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    files: ["config.js", "api.js", "dom.js", "ui.js", "main.js"]
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SESSION_TOKEN') {
    if (!sender.url || (!sender.url.includes('salesforce.com') && !sender.url.includes('force.com') && !sender.url.includes('salesforce-setup.com'))) {
      sendResponse({ error: 'Unauthorized origin' });
      return true;
    }
    
    chrome.cookies.get({ url: sender.url, name: "sid" }, (cookie) => {
      if (cookie && cookie.value) {
        sendResponse({ token: cookie.value });
      } else {
        // Fallback for cross-origin iframes
        chrome.cookies.getAll({ name: "sid" }, (cookies) => {
          const sfCookie = cookies.find(c => c.domain.includes('salesforce.com') || c.domain.includes('force.com'));
          sendResponse({ token: sfCookie ? sfCookie.value : null });
        });
      }
    });
    return true; // Keep message channel open for async response
  }
});