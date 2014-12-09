
function fmt_filesize(bytes) {
  var orig_bytes = bytes;
  var i = 0;
  while (bytes > 1024) {
    bytes = bytes / 1024;
    i++;
  }
  return (i>0?bytes.toFixed(1):bytes) + ' ' + ['','k','M','G','T','P','E','Z','Y'][i]+'B';
}

/*
function log(t) {
  var list = document.getElementById('log_list');
  if (list === null) {
    list = document.createElement('ul');
    list.id = 'log_list';
    document.body.appendChild(list);
  }
  var li = document.createElement('li');
  li.appendChild(document.createTextNode(t));
  list.appendChild(li);
}
*/

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
    if (opts.filename == '') {
      delete opts.filename;
    }
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
          setTimeout(function() {
            filename_input.focus();
          }, 10);
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

  // Only try to inspect network requests if we're a devtools page (opening the chrome-extension url in an entire tab will cause Aw Snap)
  if (window.top != window) {
    document.body.className = 'devtools';
    var network_minsize_checkbox = document.getElementById('network_minsize_checkbox');
    var network_minsize_input = document.getElementById('network_minsize');
    network_minsize_checkbox.addEventListener('change', function() {
      network_minsize_input.className = this.checked?'enabled':'';
    });
    network_minsize_input.addEventListener('focus', function() {
      network_minsize_checkbox.checked = true;
      network_minsize_input.className = 'enabled';
    });

    var network_list = document.getElementById('network');
    var network_clear = document.getElementById('network_clear');
    network_clear.addEventListener('click', function() {
      while (network_list.hasChildNodes()) {
        network_list.removeChild(network_list.firstChild);
      }
      network_clear.style.display = 'none';
    });

    chrome.devtools.network.onRequestFinished.addListener(function(entry) {
      if (entry.response.bodySize == -1) {
        return;
      }
      if (network_minsize_checkbox.checked) {
        var minsize = network_minsize_input.value;
        var suffix = minsize.slice(-1).toLowerCase();
        var num = minsize.substring(0, minsize.length-1);

        if (suffix == 'k') {
          minsize = parseInt(num, 10) * 1024;
        }
        else if (suffix == 'm') {
          minsize = parseInt(num, 10) * 1024 * 1024;
        }
        else if (suffix == 'g') {
          minsize = parseInt(num, 10) * 1024 * 1024 * 1024;
        }
        else {
          minsize = parseInt(minsize, 10);
        }

        if (entry.response.bodySize < minsize) {
          return;
        }
      }
      network_clear.style.display = 'block';

      var li = document.createElement('li');
      var a = document.createElement('a');
      a.appendChild(document.createTextNode(entry.request.url));
      a.addEventListener('click', function() {
        url_input.value = entry.request.url;
        filename_input.focus();
      });
      li.appendChild(a);
      li.appendChild(document.createTextNode(' ('+fmt_filesize(entry.response.bodySize)+')'));
      network_list.appendChild(li);
    });
  }
});
