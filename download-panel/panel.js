// We have to use a lot of setTimeout in click handlers unfortunately, otherwise it will cause another click if the content scrolls up due to what happens in the handler.

function fmt_filesize(bytes) {
  var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  var i = 0;
  while (bytes > 1024) {
    bytes = bytes / 1024;
    i++;
  }
  var size = i > 0 ? bytes.toFixed(1) : bytes;
  return `${size} ${units[i]}`;
}

function extract_filename(url) {
  var i = url.indexOf('?');
  if (i != -1) {
    url = url.substr(0, i);
  }
  var filename = url.substr(url.lastIndexOf('/')+1);
  return filename;
}

function extract_extension(url) {
  var re = /^data:[a-z]+\/([a-z]+)[,;]/.exec(url);
  if (re) {
    return re[1];
  }
  else {
    var filename = extract_filename(url);
    var i = filename.lastIndexOf('.');
    if (i != -1) {
      return filename.substr(i+1);
    }
  }
  return '';
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

  var options = {
    reverse_list: false,
    hide_data: false,
  };
  chrome.runtime.sendMessage({ action: 'get-options' }, function(items) {
    options = items;
    network_hidedata_checkbox.checked = options.hide_data;
  });

  var version = chrome.runtime.getManifest().version;
  var version_span = document.getElementById('version');
  version_span.appendChild(document.createTextNode(`v${version}`));

  if (chrome.devtools.panels.themeName) {
    document.body.classList.add(`theme-${chrome.devtools.panels.themeName}`);
  }

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
    if (opts.filename) {
      var pattern = new RegExp(filename_input.pattern);
      if (!pattern.test(opts.filename)) {
        if (confirm('Your filename contains one or more invalid characters. Invalid characters are: *?"<>:| and tabs.\n\nDo you want to automatically remove the invalid characters?')) {
          opts.filename = opts.filename.replace(/[:*?"<>|]/, '').replace(/\t+/, ' ');
        }
        else {
          return;
        }
      }
      if (["/","\\"].includes(opts.filename.slice(-1))) {
        // Auto-detect filename from url and append it
        var filename = extract_filename(opts.url);
        if (filename == '') {
          alert("While subdirectories are fine, you can't end the filename with a slash or backslash. If a filename could be detected from the url, it would be automatically appended.");
          return;
        }
        else {
          opts.filename += filename;
        }
      }
      if (network_regex_input.value != '' && opts.filename.includes('$')) {
        var network_re = new RegExp(network_regex_input.value, 'i');
        var network_ret = network_re.exec(opts.url);
        opts.filename = opts.filename.replace(/\$(\d+)/g, function(match, p1) {
          var n = parseInt(p1, 10);
          return network_ret[n];
        });
      }
      if (extract_extension(opts.filename) == '' && extract_extension(opts.url) != '') {
        // Automatically use the extension from the url if the filename field is missing a file extension
        opts.filename += '.'+extract_extension(opts.url);
      }
    }
    if (opts.filename == '') {
      delete opts.filename;
    }

    chrome.runtime.sendMessage({
      action: 'download',
      opts: opts
    });

    // mark in network list as downloaded
    var i = network_visible_entries.findIndex(function(entry) {
      return (entry.request.url == opts.url);
    });
    if (i != -1) {
      if (options.reverse_list) {
        i = network_visible_entries.length-1 - i;
      }
      var li = network_list.getElementsByTagName('li')[i];
      li.classList.add('downloaded');
    }

    // add to history
    document.body.setAttribute('history', '');
    history.push(opts.url);
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.appendChild(document.createTextNode(opts.url));
    a.href = opts.url;
    a.title = opts.filename ? opts.filename : extract_filename(opts.url);
    a.addEventListener('click', function(e) {
      // allow middle click to open link in new window
      if (e.which == 1 && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        url_input.value = opts.url;
        url_update();
        filename_input.value = (opts.filename ? opts.filename : '');
        setTimeout(function() {
          filename_input.focus();
        }, 100);
      }
    });
    li.appendChild(a);
    if (options.reverse_list) {
      history_list.insertBefore(li, history_list.firstChild);
    }
    else {
      history_list.appendChild(li);
    }
    url_update();
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
      // url_update();
    }
  }

  function url_update() {
    url_input.classList.toggle('downloaded', history.indexOf(url_input.value) != -1);
  }

  url_input.addEventListener('input', url_update);
  url_input.addEventListener('focus', url_update);

  filename_input.addEventListener('focus', function() {
    this.parentNode.classList.add('focus');
  });
  filename_input.addEventListener('blur', function() {
    this.parentNode.classList.remove('focus');
  });

  url_input.addEventListener('keyup', keyup);
  filename_input.addEventListener('keyup', keyup);
  download_button.addEventListener('click', download);
  saveas_button.addEventListener('click', saveas);

  // window.addEventListener('focus', function() {
    if (url_input.value == '') {
      url_input.focus();
      document.execCommand('paste');
      var text = url_input.value;
      if (history.includes(text)) {
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
      url_update();
    }
    else if (filename_input.value == '') {
      filename_input.focus();
    }
  // });

  var network_entries = [];
  var network_visible_entries = [];
  var network_regex_input = document.getElementById('network_regex');
  var network_minsize_checkbox = document.getElementById('network_minsize_checkbox');
  var network_hidedata_checkbox = document.getElementById('network_hidedata_checkbox');
  var link_text_checkbox = document.getElementById('link_text_checkbox');
  var link_text_input = document.getElementById('link_text');
  var network_minsize_input = document.getElementById('network_minsize');
  var network_autodownload_checkbox = document.getElementById('network_autodownload_checkbox');
  var network_autoclear_checkbox = document.getElementById('network_autoclear_checkbox');
  var network_list = document.getElementById('network');
  var network_stats = document.getElementById('network_stats');
  network_minsize_checkbox.addEventListener('change', function() {
    network_minsize_input.classList.toggle('enabled', this.checked);
    filter_network_list();
  });
  network_hidedata_checkbox.addEventListener('change', filter_network_list);
  link_text_checkbox.addEventListener('change', function() {
    link_text_input.classList.toggle('enabled', this.checked);
    filter_network_list();
  });
  link_text_input.addEventListener('input', filter_network_list);

  function minsize_change(e) {
    if (!network_minsize_checkbox.checked) {
      if (this.value != '') {
        network_minsize_checkbox.checked = true;
        network_minsize_input.classList.add('enabled');
        filter_network_list();
      }
    }
    else {
      if (this.value == '') {
        network_minsize_checkbox.checked = false;
        network_minsize_input.classList.remove('enabled');
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
    network_visible_entries = [];
    while (network_list.hasChildNodes()) {
      network_list.removeChild(network_list.firstChild);
    }
  }

  function add_network_entry(entry, new_entry) {
    network_visible_entries.push(entry);
    var filename = '';
    if (!entry.request.url.startsWith('data:')) {
      filename = extract_filename(entry.request.url);
    }
    var li = document.createElement('li');
    var span = document.createElement('span');
    var url_link = document.createElement('a');
    li.appendChild(span);
    if (history.includes(entry.request.url)) {
      li.classList.add('downloaded');
    }
    else if (typeof(new_entry) == 'boolean' && new_entry) {
      li.classList.add('new');
    }

    // instant download link
    span.appendChild(document.createTextNode('['));
    var instant_link = document.createElement('a');
    instant_link.href = '#'; // needed for middle click
    instant_link.title = `Instantly download ${filename}`;
    instant_link.appendChild(document.createTextNode('download'));
    // highlight url when hovering instant download link
    instant_link.addEventListener('mouseenter', function(e) {
      url_link.classList.add('hover');
    });
    instant_link.addEventListener('mouseleave', function(e) {
      url_link.classList.remove('hover');
    });
    instant_link.addEventListener('click', function(e) {
      e.preventDefault();
      // middle click uses saveAs
      start_download({
        url: entry.request.url,
        saveAs: (e.which == 2 || e.metaKey || e.ctrlKey)
      });
    });
    span.appendChild(instant_link);
    span.appendChild(document.createTextNode('] '));

    // preview
    if (entry.content || entry.request.url.startsWith('data:image/')) {
      span.appendChild(document.createTextNode('['));
      var a = document.createElement('a');
      a.appendChild(document.createTextNode('preview'));
      var img = document.createElement('img');

      if (entry.content) {
        var mime = 'image/'+(extract_extension(entry.request.url) || 'png');
        if (mime == 'image/svg') {
          mime += '+xml';
        }
        var arr = [];
        var binary = atob(entry.content.data);
        for (var i=0; i < binary.length; i++) {
          arr.push(binary.charCodeAt(i));
        }
        var blob = new Blob([new Uint8Array(arr)], {type: mime});
        var url = URL.createObjectURL(blob);
        img.src = url;
      }
      else {
        img.src = entry.request.url;
      }

      img.classList.add('preview');
      a.addEventListener('mouseover', function(e) {
        // img.style.left = (a.offsetLeft+a.clientWidth+5)+'px';
        img.style.top = (a.offsetTop+a.clientHeight/2-img.height/2)+'px';
        document.body.appendChild(img);
      });
      a.addEventListener('mouseout', function(e) {
        document.body.removeChild(img);
      });
      span.appendChild(a);
      span.appendChild(document.createTextNode('] '));
    }

    // link to populate form
    url_link.appendChild(document.createTextNode(entry.request.url));
    url_link.href = entry.request.url;
    url_link.addEventListener('click', function(e) {
      // allow middle click to open link in new window (or command or ctrl key)
      if (e.which == 1 && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        url_input.value = entry.request.url;
        url_update();
        setTimeout(function() {
          filename_input.focus();
        }, 100);
      }
    });
    span.appendChild(url_link);
    span.title = filename;

    if (entry.text) {
      span.appendChild(document.createTextNode(` (text: ${entry.text})`));
    }

    var size = entry.response.content.size;
    if (size >= 0) {
      span.appendChild(document.createTextNode(` (${fmt_filesize(size)})`));
      instant_link.title += ` (${fmt_filesize(size)})`;
      span.title += ` (${fmt_filesize(size)})`;
    }
    if (options.reverse_list) {
      network_list.insertBefore(li, network_list.firstChild);
    }
    else {
      network_list.appendChild(li);
    }
  }

  function valid_request(entry) {
    // ignore data uris (0), redirects (3xx), grab resources: empty url, chrome-extension, about:, extensions:
    var status = entry.response.status;
    var url = entry.request.url;
    var prefix = url.substr(0, url.indexOf(':'));
    var skip = ['', 'javascript', 'chrome-extension', 'about', 'extensions'];
    if (status == 0 || (status >= 300 && status <= 400) || skip.includes(prefix)) {
      return false;
    }
    // don't allow duplicate urls
    if (network_entries.some(function(existing_entry) {
      return (existing_entry.request.url == url);
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
    if (network_hidedata_checkbox.checked && entry.request.url.startsWith('data:')) {
      return false;
    }
    if (link_text_checkbox.checked && (!entry.text || !entry.text.toLowerCase().includes(link_text_input.value.toLowerCase()))) {
      return false;
    }
    if (network_regex_input.value != '') {
      var re = new RegExp(network_regex_input.value, 'i');
      if (!re.test(entry.request.url)) {
        return false;
      }
    }
    return true;
  }

  function update_request_stats() {
    var shown = network_list.childNodes.length;
    var total = network_entries.length;
    while (network_stats.hasChildNodes()) {
      network_stats.removeChild(network_stats.firstChild);
    }
    if (shown != total) {
      network_stats.appendChild(document.createTextNode(`Showing ${shown} / ${total} urls.`));
    }
    else if (total == 0) {
      network_stats.appendChild(document.createTextNode('No urls captured.'));
    }
    else {
      network_stats.appendChild(document.createTextNode(`Captured ${shown} urls.`));
    }
  }

  function filter_network_list() {
    clear_network_list();
    var entries = network_entries.filter(filter_request);
    entries.forEach(add_network_entry);
    update_request_stats();
    // autograb url if filtering only matches one
    if (url_input.value == '' && entries.length == 1) {
      url_input.value = entries[0].request.url;
      url_update();
    }
  }

  function populate_entries(list, isException) {
    list.forEach(function(item) {
      var entry = {
        request: {
          url: item[0]
        },
        response: {
          status: 200,
          content: { size: -1 }
        }
      };
      if (item[1].trim() != "") {
        entry.text = item[1].trim();
      }
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
        url_update();
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
var list = [];\
var links = document.getElementsByTagName('a');\
for (var i=0; i < links.length; i++) {\
  list.push([links[i].href, links[i].textContent]);\
}\
return list;\
})()", populate_entries);
    },
    'grab-inspected-links': function(e) {
      chrome.devtools.inspectedWindow.eval("(function(){\
var list = [];\
if ($0.tagName == 'A') {\
  list.push($0.href);\
}\
var links = $0.getElementsByTagName('a');\
for (var i=0; i < links.length; i++) {\
  list.push([links[i].href, links[i].textContent]);\
}\
return list;\
})()", populate_entries);
    },
    'use-inspected-text': function(e) {
      filename_input.value = this.title;
      filename_input.focus();
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
                entry.content = { encoding: encoding, data: content };
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
      var filename = filename_input.value; // Save this value because the input field will be cleared after the first call
      network_visible_entries.forEach(
        function(entry, index) {
          setTimeout(function() {
            start_download({
              url: entry.request.url,
              filename: filename
            });
          }, 100*index);
        }
      );
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
    'open-options': function(e) {
      chrome.runtime.sendMessage({ action: 'open-options' });
    },
  };

  var links = document.querySelectorAll('[action]');
  for (var i=0; i < links.length; i++) {
    var link = links[i];
    link.addEventListener('click', function(e) {
      e.preventDefault();
      actions[this.getAttribute('action')].call(this, e);
    });
  }

  chrome.runtime.sendMessage({ action: 'get-platform' }, function(platform) {
    var links = document.querySelectorAll('a[href="chrome://downloads"]');
    for (var i=0; i < links.length; i++) {
      links[i].title = platform.os == 'mac' ? '⌘-Shift-J' : 'Ctrl+J';
    }
  });

  // Only try to use chrome.devtools.* APIs if we're a devtools page (opening the chrome-extension url in its own tab will cause Aw Snap)
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
          if (network_autodownload_checkbox.checked) {
            start_download({ url: har_entry.request.url });
          }
          add_network_entry(har_entry, true);
        }
        update_request_stats();
      }
    });

    chrome.devtools.network.onNavigated.addListener(function(url) {
      // debug(url);
      if (network_autoclear_checkbox.checked) {
        actions['clear-network']();
      }
    });

    function check_inspected_element() {
      chrome.devtools.inspectedWindow.eval("(function(){ if ($0 !== undefined) { return $0.getElementsByTagName('a').length; } })()", function(count, e) {
        if (e) {
          debug(`e: ${e.isError}, ${e.code}, ${e.description}, ${e.details}, ${e.isException}, ${e.value}`);
        }
        var link = document.querySelectorAll('[action="grab-inspected-links"]')[0];
        while (link.childNodes.length > 1) {
          link.removeChild(link.lastChild);
        }
        // count is undefined if there is no element selected, this happens when the user navigates to another page
        if (count === undefined) {
          link.setAttribute('disabled', true);
        }
        else {
          link.removeAttribute('disabled');
          link.appendChild(document.createTextNode(` (${count} links)`));
        }
      });
      chrome.devtools.inspectedWindow.eval("(function(){ if ($0 !== undefined) { return $0.textContent; } })()", function(text, e) {
        if (e) {
          debug(`e: ${e.isError}, ${e.code}, ${e.description}, ${e.details}, ${e.isException}, ${e.value}`);
        }
        var link = document.querySelectorAll('[action="use-inspected-text"]')[0];
        while (link.firstChild) {
          link.removeChild(link.firstChild);
        }
        // text is undefined if there is no element selected, this happens when the user navigates to another page
        if (text === undefined) {
          text = '';
        }
        text = text.replace(/[:*?"<>|\r\n]/g, '').replace(/[\t ]+/g, ' ').trim();
        if (text != '') {
          link.title = text;
          link.appendChild(document.createTextNode(text.substr(0,50)));
        }
      });
    }
    chrome.devtools.panels.elements.onSelectionChanged.addListener(check_inspected_element);
    check_inspected_element();
  }
});
