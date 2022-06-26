const default_options = {
  reverse_list: false,
  hide_data: false,
};

document.addEventListener('DOMContentLoaded', async () => {
  const reverse_list_input = document.getElementById('reverse_list');
  const hide_data_input = document.getElementById('hide_data');
  const save_button = document.getElementById('save');
  const status = document.getElementById('status');

  const options = await chrome.storage.sync.get(default_options);
  reverse_list_input.checked = options.reverse_list;
  hide_data_input.checked = options.hide_data;

  save_button.addEventListener('click', async () => {
    const new_options = {
      reverse_list: reverse_list_input.checked,
      hide_data: hide_data_input.checked,
    };
    await chrome.storage.sync.set(new_options);
    status.textContent = 'Options saved.';
    setTimeout(() => {
      status.textContent = '';
    }, 5000);
    chrome.runtime.sendMessage({
      action: 'update-options',
      options: new_options,
    });
  });

  document.getElementById('reset').addEventListener('click', async () => {
    reverse_list_input.checked = false;
    hide_data_input.checked = false;
    await chrome.storage.sync.clear();
    status.textContent = 'Options reset.';
    setTimeout(() => {
      status.textContent = '';
    }, 5000);
    chrome.runtime.sendMessage({
      action: 'update-options',
      options: default_options,
    });
  });
});
