// We can't initiate downloads from the devtools panel, so pass a message to this background script which initiates the download... Doh!

var platform, options;

chrome.runtime.getPlatformInfo(function(info) {
  platform = info;
});

// chrome.storage.sync.get({
//   reverse_list: false,
//   hide_data: false,
// }).then(function(items) {
//   options = items;
// });

chrome.storage.sync.get({
  reverse_list: false,
  hide_data: false,
}, function(items) {
  options = items;
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
    else if (message.action == 'get-lang') {
      sendResponse(chrome.i18n.getUILanguage());
    }
    else if (message.action == 'open-options') {
      chrome.runtime.openOptionsPage();
    }
    else if (message.action == 'get-options') {
      console.log(options);
      sendResponse(options);
    }
    else if (message.action == 'update-options') {
      options = message.options;
    }
  }
);
