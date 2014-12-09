
window.addEventListener('load', function() {
  var history = [];

  var version = chrome.runtime.getManifest().version;
  var version_span = document.getElementById('version');
  version_span.appendChild(document.createTextNode('v'+version));

  var url_input = document.getElementById('url');
  var filename_input = document.getElementById('filename');
  var download_button = document.getElementById('download');
  var saveas_button = document.getElementById('saveas');

  function start_download(opts) {
    chrome.runtime.sendMessage({
      opts: opts
    });

    history.push(opts.url);
    var history_list = document.getElementById('history');
    var history_header = document.getElementById('history_header');
    history_header.style.display = 'block'
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.appendChild(document.createTextNode(opts.url));
    a.addEventListener('click', function() {
      url_input.value = opts.url;
      filename_input.value = opts.filename;
      url_input.focus();
    });
    li.appendChild(a);
    history_list.appendChild(li);

    filename_input.value = url_input.value = '';
    url_input.focus();
  }

  function download() {
    start_download({
      url: url_input.value,
      filename: filename_input.value
    });
  }

  function saveas() {
    start_download({
      url: url_input.value,
      filename: filename_input.value,
      saveAs: true
    });
  }

  function keyup(e) {
    if (e.keyCode == 13) {
      download();
    }
  }

  url_input.addEventListener('keyup', keyup);
  filename_input.addEventListener('keyup', keyup);
  download_button.addEventListener('click', download);
  saveas_button.addEventListener('click', saveas);

  window.addEventListener('focus', function() {
    if (url_input.value == '') {
      url_input.focus();
      document.execCommand('paste');
      var text = url_input.value;
      if (history.indexOf(text) !== -1) {
        url_input.value = '';
      }
      else {
        if (/^https?:\/\//i.test(text)) {
          filename_input.focus();
        }
        else {
          url_input.value = '';
        }
      }
    }
    else if (filename_input.value == '') {
      filename_input.focus();
    }
  });
});
