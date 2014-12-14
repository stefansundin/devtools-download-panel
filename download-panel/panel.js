
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

function debug(t) {
  if (typeof t != 'string') {
    try {
      t = JSON.stringify(t);
    }
    catch (e) {
      t = e.message;
    }
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

window.addEventListener('load', function() {
  var history = [];

  var version = chrome.runtime.getManifest().version;
  var version_span = document.getElementById('version');
  version_span.appendChild(document.createTextNode('v'+version));

  var url_input = document.getElementById('url');
  var filename_input = document.getElementById('filename');
  var download_button = document.getElementById('download');
  var saveas_button = document.getElementById('saveas');
  var history_list = document.getElementById('history');

  function start_download(opts) {
    if (opts.url == '') {
      return;
    }
    if (opts.filename == '') {
      delete opts.filename;
    }
    chrome.runtime.sendMessage({
      action: 'download',
      opts: opts
    });

    document.body.setAttribute('history', '');
    history.push(opts.url);
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.appendChild(document.createTextNode(opts.url));
    a.href = opts.url;
    a.addEventListener('click', function(e) {
      // allow middle click to open link in new window
      if (e.which == 1) {
        e.preventDefault();
        url_input.value = opts.url;
        filename_input.value = (opts.filename ? opts.filename : '');
        setTimeout(function() {
          // we have to do this in a setTimeout unfortunately, otherwise it may cause another click where the mouse cursor ends up after scrolling up (usually on a network link)
          filename_input.focus();
        }, 100);
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
        // don't use the pasted url if we have it in the history
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

  var network_entries = [];
  var network_regex_input = document.getElementById('network_regex');
  var network_minsize_checkbox = document.getElementById('network_minsize_checkbox');
  var network_minsize_input = document.getElementById('network_minsize');
  var network_list = document.getElementById('network');
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
  network_regex_input.addEventListener('focus', filter_network_list);
  network_regex_input.addEventListener('keyup', filter_network_list);
  network_regex_input.addEventListener('search', filter_network_list);

  var filters = document.querySelectorAll('[regex-filter]');
  for (var i=0; i < filters.length; i++) {
    var filter = filters[i];
    filter.addEventListener('click', function() {
      network_regex_input.value = this.getAttribute('regex-filter');
      filter_network_list();
    });
    if (filter.title == '') {
      filter.title = filter.getAttribute('regex-filter');
    }
  }

  function clear_network_list() {
    while (network_list.hasChildNodes()) {
      network_list.removeChild(network_list.firstChild);
    }
  }

  function add_network_entry(entry) {
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
        setTimeout(function() {
          // we have to do this in a setTimeout unfortunately, otherwise it may cause another click where the mouse cursor ends up after scrolling up
          filename_input.focus();
        }, 100);
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
      minsize = parseInt(minsize, 10); // it is fine to parse even with trailing characters, they will just be ignored

      if (suffix == 'k') {
        minsize = minsize * 1024;
      }
      else if (suffix == 'm') {
        minsize = minsize * 1024 * 1024;
      }
      else if (suffix == 'g') {
        minsize = minsize * 1024 * 1024 * 1024;
      }

      if (entry.response.content.size < minsize) {
        return false;
      }
    }
    if (network_regex_input.value != '') {
      var re = new RegExp(network_regex_input.value, 'i');
      if (!re.test(entry.request.url)) {
        return false;
      }
    }
    return true;
  }

  function download_request(entry) {
    start_download({
      url: entry.request.url
    });
  }

  function update_request_stats() {
    var shown = network_list.childNodes.length;
    var total = network_entries.length;
    while (network_stats.hasChildNodes()) {
      network_stats.removeChild(network_stats.firstChild);
    }
    if (shown != total) {
      network_stats.appendChild(document.createTextNode('Showing '+shown+' / '+total+' requests.'));
    }
    else if (total == 0) {
      network_stats.appendChild(document.createTextNode('No requests captured.'));
    }
    else {
      network_stats.appendChild(document.createTextNode('Captured '+shown+' requests.'));
    }
  }

  function filter_network_list() {
    clear_network_list();
    network_entries.filter(filter_request).forEach(add_network_entry);
    update_request_stats();
  }

  // action links
  var actions = {
    'clear-history': function() {
      while (history.length > 0) {
        history.pop();
      }
      while (history_list.hasChildNodes()) {
        history_list.removeChild(history_list.firstChild);
      }
      document.body.removeAttribute('history');
    },
    'clear-network': function() {
      network_entries = [];
      clear_network_list();
      update_request_stats();
    },
    'reload': function() {
      chrome.devtools.inspectedWindow.reload({ ignoreCache: true });
    },
    'grab-links': function() {
    },
    'download-all': function() {
      network_entries.filter(filter_request).forEach(download_request);
    },
    'open-downloads-tab': function() {
      chrome.runtime.sendMessage({
        action: 'open-tab',
        opts: { url: 'chrome://downloads' }
      });
    },
    'change-downloads-settings': function() {
      chrome.runtime.sendMessage({
        action: 'open-tab',
        opts: { url: 'chrome://settings/search#download%20location' }
      });
    },
  };

  var links = document.querySelectorAll('[action]');
  for (var i=0; i < links.length; i++) {
    var link = links[i];
    link.addEventListener('click', actions[link.getAttribute('action')]);
  }

  // Only try to inspect network requests if we're a devtools page (opening the chrome-extension url in an entire tab will cause Aw Snap)
  if (window.top != window) {
    document.body.setAttribute('devtools', '');

    chrome.devtools.network.getHAR(function(har_log) {
      network_entries = network_entries.concat(har_log.entries.filter(valid_request));
      filter_network_list();
    });

    chrome.devtools.network.onRequestFinished.addListener(function(har_entry) {
      if (valid_request(har_entry)) {
        network_entries.push(har_entry);
        if (filter_request(har_entry)) {
          add_network_entry(har_entry);
        }
        update_request_stats();
      }
    });

    // chrome.devtools.network.onNavigated.addListener(function(url) {
    //   debug(url);
    // });
  }

});
