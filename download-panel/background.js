
// We can't initiate downloads from the devtools tab, so pass a message to this background script which initiates the download... Duh.

chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    chrome.downloads.download(message.opts);
  }
);
