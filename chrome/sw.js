// There are many things the devtools panel can't do on its own, so that's why this is required.

const defaultOptions = {
  reverseList: false,
  networkHidedata: false,
};

let platform, options;

chrome.runtime.getPlatformInfo().then((info) => {
  platform = info;
});

chrome.storage.sync.get(defaultOptions).then((items) => {
  options = items;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log('received message:', message, sender);
  if (message.action === 'download') {
    chrome.downloads.download(message.opts);
  } else if (message.action === 'open-tab') {
    chrome.tabs.create(message.opts);
  } else if (message.action === 'open-downloads-folder') {
    chrome.downloads.showDefaultFolder();
  } else if (message.action === 'get-platform') {
    sendResponse(platform);
  } else if (message.action === 'get-lang') {
    sendResponse(chrome.i18n.getUILanguage());
  } else if (message.action === 'open-options') {
    chrome.runtime.openOptionsPage();
  } else if (message.action === 'get-options') {
    sendResponse(options);
  } else if (message.action === 'update-options') {
    options = message.options;
  }
});
