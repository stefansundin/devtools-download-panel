const defaultOptions = {
  reverseList: false,
  networkHidedata: false,
};

document.addEventListener('DOMContentLoaded', async () => {
  const reverseListCheckbox = document.getElementById('reverse-list');
  const networkHidedataCheckbox = document.getElementById('network-hidedata');
  const saveButton = document.getElementById('save');
  const status = document.getElementById('status');

  const options = await chrome.storage.sync.get(defaultOptions);
  reverseListCheckbox.checked = options.reverseList;
  networkHidedataCheckbox.checked = options.networkHidedata;

  saveButton.addEventListener('click', async () => {
    const newOptions = {
      reverseList: reverseListCheckbox.checked,
      networkHidedata: networkHidedataCheckbox.checked,
    };
    await chrome.storage.sync.set(newOptions);
    status.textContent = 'Options saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 5000);
    chrome.runtime.sendMessage({
      action: 'update-options',
      options: newOptions,
    });
  });

  document.getElementById('reset').addEventListener('click', async () => {
    reverseListCheckbox.checked = defaultOptions.reverseList;
    networkHidedataCheckbox.checked = defaultOptions.networkHidedata;
    await chrome.storage.sync.clear();
    status.textContent = 'Options reset.';
    setTimeout(() => {
      status.textContent = '';
    }, 5000);
    chrome.runtime.sendMessage({
      action: 'update-options',
      options: defaultOptions,
    });
  });
});
