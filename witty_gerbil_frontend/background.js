// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("LLM Chat Automation Extension Installed.");
});

// Optional: Handle messages from content scripts if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "log") {
    console.log("Log from Content Script:", request.message);
  }
});
