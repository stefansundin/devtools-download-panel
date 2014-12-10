
function fmt_filesize(bytes) {
  var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  var i = 0;
  while (bytes > 1024) {
    bytes = bytes / 1024;
    i++;
  }
  var size = i > 0 ? bytes.toFixed(1) : bytes;
  return size + ' ' + units[i];
}

/*
function debug(t) {
  if (typeof t != 'string') {
    t = JSON.stringify(t);
  }
  var list = document.getElementById('log_list');
  if (list == null) {
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
    a.href = opts.url;
    a.addEventListener('click', function(e) {
      // allow middle click to open link in new window
      if (e.which == 1) {
        e.preventDefault();
        url_input.value = opts.url;
        if (opts.filename) {
          filename_input.value = opts.filename;
        }
        url_input.focus();
      }
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
    var network_entries = [];
    var network_minsize_checkbox = document.getElementById('network_minsize_checkbox');
    var network_minsize_input = document.getElementById('network_minsize');
    var network_list = document.getElementById('network');
    var network_clear = document.getElementById('network_clear');
    var network_stats = document.getElementById('network_stats');
    network_minsize_checkbox.addEventListener('change', function() {
      network_minsize_input.className = this.checked ? 'enabled' : '';
      filter_network_list();
    });

    function minsize_change(e) {
      if (!network_minsize_checkbox.checked) {
        if (this.value != '') {
          network_minsize_checkbox.checked = true;
          network_minsize_input.className = 'enabled';
          filter_network_list();
        }
      }
      else {
        if (this.value == '') {
          network_minsize_checkbox.checked = false;
          network_minsize_input.className = '';
        }
        filter_network_list();
      }
    }

    network_minsize_input.addEventListener('focus', minsize_change);
    network_minsize_input.addEventListener('keyup', minsize_change);
    network_minsize_input.addEventListener('search', minsize_change);

    function clear_network_list() {
      while (network_list.hasChildNodes()) {
        network_list.removeChild(network_list.firstChild);
      }
      network_clear.style.display = 'none';
    }

    network_clear.addEventListener('click', function() {
      network_entries = [];
      clear_network_list();
      update_request_stats();
    });

    function add_network_entry(entry) {
      network_clear.style.display = 'block';
      var li = document.createElement('li');

      // instant download link
      li.appendChild(document.createTextNode('['));
      var a = document.createElement('a');
      a.title = 'Instant download';
      a.appendChild(document.createTextNode('download'));
      a.addEventListener('click', function(e) {
        // middle click uses saveAs
        start_download({
          url: entry.request.url,
          saveAs: e.which == 2
        });
        url_input.value = entry.request.url;
        filename_input.focus();
      });
      li.appendChild(a);
      li.appendChild(document.createTextNode('] '));

      // link to populate form
      var a = document.createElement('a');
      a.appendChild(document.createTextNode(entry.request.url));
      a.href = entry.request.url;
      a.addEventListener('click', function(e) {
        // allow middle click to open link in new window
        if (e.which == 1) {
          e.preventDefault();
          url_input.value = entry.request.url;
          filename_input.focus();
        }
      });
      li.appendChild(a);
      li.appendChild(document.createTextNode(' ('+fmt_filesize(entry.response.content.size)+')'));
      li.title = entry.request.url+' ('+fmt_filesize(entry.response.content.size)+')';
      network_list.appendChild(li);
    }

    function valid_request(entry) {
      // ignore data uris (0), redirects (3xx)
      var status = entry.response.status;
      if (status == 0 || (status >= 300 && status <= 400)) {
        return false;
      }
      // don't allow duplicate urls
      if (network_entries.some(function(existing_entry) {
        return (existing_entry.request.url == entry.request.url);
      })) {
        return false;
      }
      return true;
    }

    function filter_request(entry) {
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

        if (entry.response.content.size < minsize) {
          return false;
        }
      }
      return true;
    }

    function update_request_stats() {
      while (network_stats.hasChildNodes()) {
        network_stats.removeChild(network_stats.firstChild);
      }
      if (network_minsize_checkbox.checked) {
        network_stats.appendChild(document.createTextNode('Showing '+network_list.childNodes.length+' / '+network_entries.length+' requests.'));
      }
      else if (network_list.childNodes.length == 0) {
        network_stats.appendChild(document.createTextNode('No requests captured.'));
      }
      else {
        network_stats.appendChild(document.createTextNode('Captured '+network_list.childNodes.length+' requests.'));
      }
    }

    function filter_network_list() {
      clear_network_list();
      network_entries.filter(filter_request).forEach(add_network_entry);
      update_request_stats();
    }

    chrome.devtools.network.getHAR(function(har_log) {
      network_entries = network_entries.concat(har_log.entries.filter(valid_request));
      filter_network_list();
    });

    chrome.devtools.network.onRequestFinished.addListener(function(har_entry) {
      if (valid_request(har_entry)) {
        network_entries.push(har_entry);
        if (filter_request(har_entry)) {
          add_network_entry(har_entry);
          update_request_stats();
        }
      }
    });
  }
});
