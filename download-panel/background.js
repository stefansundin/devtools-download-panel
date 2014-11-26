
// We can't initiate downloads from the devtools tab, so pass a message to this background script which initiates the download... Duh.

chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    var opts = {
      url: message.url,
      saveAs: message.saveAs
    };
    if (message.filename) {
      opts.filename = message.filename;
    }
    // console.log(opts);
    chrome.downloads.download(opts);
  }
);
