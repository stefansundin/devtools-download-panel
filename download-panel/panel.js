
window.addEventListener('load', function() {
  var url_input = document.getElementById('url');
  var filename_input = document.getElementById('filename');
  var saveas_input = document.getElementById('saveas');
  var button = document.getElementsByTagName('button')[0];
  var version_span = document.getElementById('version');
  var version = chrome.runtime.getManifest().version;
  version_span.appendChild(document.createTextNode('v'+version));

  function start_download() {
    chrome.runtime.sendMessage({
      url: url_input.value,
      filename: filename_input.value,
      saveAs: saveas_input.checked
    });
  }

  function keyup(e) {
    if (e.keyCode == 13) {
      start_download();
    }
  }

  url_input.addEventListener('keyup', keyup, false);
  filename_input.addEventListener('keyup', keyup, false);
  button.addEventListener('click', start_download, false);

  url_input.focus();
  document.execCommand('paste');
  if (/^https?:\/\//i.test(url_input.value)) {
    filename_input.focus();
  }
  else {
    url_input.value = '';
  }
}, false);
