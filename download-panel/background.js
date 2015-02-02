
// We can't initiate downloads from the devtools panel, so pass a message to this background script which initiates the download... Doh!

var platform;

chrome.runtime.getPlatformInfo(function(info) {
  platform = info;
});

chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    console.log('received message: ', message, sender);
    if (message.action == 'download') {
      chrome.downloads.download(message.opts);
    }
    else if (message.action == 'open-tab') {
      chrome.tabs.create(message.opts);
    }
    else if (message.action == 'open-downloads-folder') {
      chrome.downloads.showDefaultFolder();
    }
    else if (message.action == 'get-platform') {
      sendResponse({ platform: platform });
    }
  }
);
