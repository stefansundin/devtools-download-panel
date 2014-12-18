
// We have to use a lot of setTimeout in click handlers unfortunately, otherwise it will cause another click if the content scrolls up due to what happens in the handler.

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

  var scroll_to_top = document.getElementById('scroll-to-top');
  scroll_to_top.addEventListener('click', function(e) {
    window.scrollTo(0, 0);
  });
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 0) {
      if (scroll_to_top.style.display == 'none') {
        scroll_to_top.style.display = 'block';
      }
    }
    else {
      if (scroll_to_top.style.display == 'block') {
        scroll_to_top.style.display = 'none';
      }
    }
  });


  var url_input = document.getElementById('url');
  var filename_input = document.getElementById('filename');
  var download_button = document.getElementById('download');
  var saveas_button = document.getElementById('saveas');
  var history_list = document.getElementById('history');

  // prevent Esc key from bringing up the console in input fields
  function keydown(e) {
    if (e.keyCode == 27) {
      e.stopPropagation();
    }
  }

  var inputs = document.getElementsByTagName('input');
  for (var i=0; i < inputs.length; i++) {
    inputs[i].addEventListener('keydown', keydown);
  }

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

  // window.addEventListener('focus', function() {
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
  // });

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

    // preview
    if (entry.content) {
      li.appendChild(document.createTextNode('['));
      var a = document.createElement('a');
      a.appendChild(document.createTextNode('preview'));
      var img = document.createElement('img');
      img.src = 'data:image/png;'+entry.content.encoding+','+entry.content.data;
      img.className = 'preview';
      a.addEventListener('mouseover', function(e) {
        // img.style.left = (a.offsetLeft+a.clientWidth+5)+'px';
        img.style.top = (a.offsetTop+a.clientHeight/2-img.height/2)+'px';
        document.body.appendChild(img);
      });
      a.addEventListener('mouseout', function(e) {
        document.body.removeChild(img);
      });
      li.appendChild(a);
      li.appendChild(document.createTextNode('] '));
    }

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
          filename_input.focus();
        }, 100);
      }
    });
    li.appendChild(a);
    // li.title = entry.request.url;
    var size = entry.response.content.size;
    if (size >= 0) {
      li.appendChild(document.createTextNode(' ('+fmt_filesize(size)+')'));
      li.title += ' ('+fmt_filesize(size)+')';
    }
    network_list.appendChild(li);
  }

  function valid_request(entry) {
    // ignore data uris (0), redirects (3xx), grab resources: empty url, chrome-extension, about:, extensions:
    var status = entry.response.status;
    if (status == 0 || (status >= 300 && status <= 400) || entry.request.url == "" || entry.request.url.indexOf('chrome-extension://') === 0 || entry.request.url.indexOf('about:') === 0 || entry.request.url.indexOf('extensions:') === 0) {
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
      network_stats.appendChild(document.createTextNode('Showing '+shown+' / '+total+' urls.'));
    }
    else if (total == 0) {
      network_stats.appendChild(document.createTextNode('No urls captured.'));
    }
    else {
      network_stats.appendChild(document.createTextNode('Captured '+shown+' urls.'));
    }
  }

  function filter_network_list() {
    clear_network_list();
    network_entries.filter(filter_request).forEach(add_network_entry);
    update_request_stats();
  }

  function populate_urls(urls, isException) {
    urls.forEach(function(url) {
      var entry = {
        request: {
          url: url
        },
        response: {
          status: 200,
          content: { size: -1 }
        }
      };
      if (valid_request(entry)) {
        network_entries.push(entry);
      }
    });
    filter_network_list();
  }

  // action links
  var actions = {
    'clear-history': function(e) {
      history = [];
      setTimeout(function() {
        while (history_list.hasChildNodes()) {
          history_list.removeChild(history_list.firstChild);
        }
        document.body.removeAttribute('history');
      }, 100);
    },
    'clear-network': function(e) {
      network_entries = [];
      clear_network_list();
      update_request_stats();
    },
    'reload': function(e) {
      chrome.devtools.inspectedWindow.reload({ ignoreCache: true });
    },
    'grab-all-links': function(e) {
      chrome.devtools.inspectedWindow.eval("(function(){\
var urls = [];\
var links = document.getElementsByTagName('a');\
for (var i=0; i < links.length; i++) {\
  urls.push(links[i].href);\
}\
return urls;\
})()", populate_urls);
    },
    'grab-inspected-links': function(e) {
      chrome.devtools.inspectedWindow.eval("(function(){\
var urls = [];\
if ($0.tagName == 'A') {\
  urls.push($0.href);\
}\
var links = $0.getElementsByTagName('a');\
for (var i=0; i < links.length; i++) {\
  urls.push(links[i].href);\
}\
return urls;\
})()", populate_urls);
    },
    'grab-resources': function(e) {
      chrome.devtools.inspectedWindow.getResources(function(resources) {
        // we're faking HAR entries here, we'll see if this holds up in the future
        resources.forEach(function(resource) {
          var entry = {
            request: {
              url: resource.url
            },
            response: {
              status: 200,
              content: { size: -1 }
            }
          };
          if (valid_request(entry)) {
            if (resource.type == 'image') {
              resource.getContent(function(content, encoding) {
                entry.content = { encoding: encoding, data:content };
                network_entries.push(entry);
                filter_network_list();
              });
            }
            else {
              network_entries.push(entry);
            }
          }
        });
        filter_network_list();
      });
    },
    'download-all': function(e) {
      network_entries.filter(filter_request).forEach(download_request);
    },
    'open-tab': function(e) {
      chrome.runtime.sendMessage({
        action: 'open-tab',
        opts: { url: e.srcElement.href }
      });
    },
    'open-downloads-folder': function(e) {
      chrome.runtime.sendMessage({ action: 'open-downloads-folder' });
    },
  };

  chrome.devtools.panels.elements.onSelectionChanged.addListener(function() {
    var link = document.querySelectorAll('[action="grab-inspected-links"]')[0];
    link.removeAttribute('disabled');
    chrome.devtools.inspectedWindow.eval("$0.getElementsByTagName('a').length;", function(count, isException) {
      while (link.childNodes.length > 1) {
        link.removeChild(link.lastChild);
      }
      link.appendChild(document.createTextNode(' ('+count+' links)'));
    });
  });

  var links = document.querySelectorAll('[action]');
  for (var i=0; i < links.length; i++) {
    var link = links[i];
    link.addEventListener('click', function(e) {
      e.preventDefault();
      actions[this.getAttribute('action')](e);
    });
  }

  chrome.runtime.sendMessage({ action: 'get-platform' }, function(platform) {
    var links = document.querySelectorAll('a[href="chrome://downloads"]');
    for (var i=0; i < links.length; i++) {
      links[i].title = platform.os == 'mac' ? '⌘-Shift-J' : 'Ctrl+J';
    }
  });

  // Only try to inspect network requests if we're a devtools page (opening the chrome-extension url in its own tab will cause Aw Snap)
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
