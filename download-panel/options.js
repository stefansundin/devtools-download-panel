var default_options = {
  reverse_list: false,
  hide_data: false,
};

document.addEventListener('DOMContentLoaded', function() {
  var reverse_list_input = document.getElementById('reverse_list');
  var hide_data_input = document.getElementById('hide_data');
  var save_button = document.getElementById('save');
  var status = document.getElementById('status');

  chrome.storage.sync.get(default_options, function(items) {
    reverse_list_input.checked = items.reverse_list;
    hide_data_input.checked = items.hide_data;
  });

  save_button.addEventListener('click', function() {
    var new_options = {
      reverse_list: reverse_list_input.checked,
      hide_data: hide_data_input.checked
    };
    chrome.storage.sync.set(new_options, function() {
      status.textContent = 'Options saved.';
      setTimeout(function() {
        status.textContent = '';
      }, 5000);
      chrome.runtime.sendMessage({ action: 'update-options', options: new_options });
    });
  });

  document.getElementById('reset').addEventListener('click', function() {
    reverse_list_input.checked = false;
    hide_data_input.checked = false;
    chrome.storage.sync.clear(function() {
      status.textContent = 'Options reset.';
      setTimeout(function() {
        status.textContent = '';
      }, 5000);
      chrome.runtime.sendMessage({ action: 'update-options', options: default_options });
    });
  });
});
