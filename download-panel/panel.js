// We have to use a lot of setTimeout in click handlers unfortunately, otherwise it will cause another click if the content scrolls up due to what happens in the handler.

function fmt_filesize(bytes) {
  const units = [
    'bytes',
    'KiB',
    'MiB',
    'GiB',
    'TiB',
    'PiB',
    'EiB',
    'ZiB',
    'YiB',
  ];
  let i = 0;
  while (bytes > 1024) {
    bytes = bytes / 1024;
    i++;
  }
  const size = i > 0 ? bytes.toFixed(1) : bytes;
  return `${size} ${units[i]}`;
}

function extract_extension(filename) {
  const i = filename.lastIndexOf('.');
  if (i === -1) {
    return '';
  }
  return filename.substr(i + 1);
}

function extract_url_filename(url) {
  let i = url.indexOf('?');
  if (i !== -1) {
    url = url.substr(0, i);
  }
  i = url.indexOf('#');
  if (i !== -1) {
    url = url.substr(0, i);
  }
  return url.substr(url.lastIndexOf('/') + 1);
}

function extract_url_extension(url) {
  const re = /^data:[a-z]+\/([a-z]+)[,;]/.exec(url);
  if (re) {
    return re[1];
  }
  return extract_extension(extract_url_filename(url));
}

window.addEventListener('load', () => {
  const url_input = document.getElementById('url');
  const filename_input = document.getElementById('filename');
  const ffmpeg_command_input = document.getElementById('ffmpeg_command');
  const inspect_button = document.getElementById('inspect');
  const use_document_title = document.getElementById('use-document-title');
  const inspected_text_button = document.getElementById('inspected-text');
  const download_button = document.getElementById('download');
  const saveas_button = document.getElementById('saveas');
  const history_list = document.getElementById('history');
  const network_regex_input = document.getElementById('network_regex');
  const network_minsize_checkbox = document.getElementById(
    'network_minsize_checkbox',
  );
  const network_hidedata_checkbox = document.getElementById(
    'network_hidedata_checkbox',
  );
  const network_minsize_input = document.getElementById('network_minsize');
  const network_autodownload_checkbox = document.getElementById(
    'network_autodownload_checkbox',
  );
  const network_autoclear_checkbox = document.getElementById(
    'network_autoclear_checkbox',
  );
  const network_list = document.getElementById('network');
  const network_stats = document.getElementById('network_stats');

  const version = chrome.runtime.getManifest().version;
  const version_span = document.getElementById('version');
  version_span.appendChild(document.createTextNode(`v${version}`));

  let history = [];
  let inspect_interval = null;

  let options = {
    reverse_list: false,
    hide_data: false,
  };
  chrome.runtime.sendMessage({ action: 'get-options' }).then(items => {
    if (items) {
      options = items;
      network_hidedata_checkbox.checked = options.hide_data;
    }
  });

  const scroll_to_top = document.getElementById('scroll-to-top');
  scroll_to_top.addEventListener('click', () => window.scrollTo(0, 0));
  window.addEventListener('scroll', () => {
    if (window.scrollY > 0) {
      if (scroll_to_top.style.display === 'none') {
        scroll_to_top.style.display = 'block';
      }
    } else {
      if (scroll_to_top.style.display === 'block') {
        scroll_to_top.style.display = 'none';
      }
    }
  });

  // prevent Esc key from bringing up the console in input fields
  function keydown(e) {
    if (e.keyCode === 27) {
      e.stopPropagation();
    }
  }

  for (const input of document.getElementsByTagName('input')) {
    input.addEventListener('keydown', keydown);
  }

  function start_download(opts) {
    if (opts.url === '') {
      return;
    }
    if (opts.filename) {
      const pattern = new RegExp(filename_input.pattern);
      if (!pattern.test(opts.filename)) {
        if (
          confirm(
            'Your filename contains one or more invalid characters. Invalid characters are: *?"<>:| and tabs.\n\nDo you want to automatically remove the invalid characters?',
          )
        ) {
          opts.filename = opts.filename
            .replace(/[:*?"<>|]/, '')
            .replace(/\t+/, ' ');
        } else {
          return;
        }
      }
      if (['/', '\\'].includes(opts.filename.slice(-1))) {
        // Auto-detect filename from url and append it
        const filename = extract_url_filename(opts.url);
        if (filename === '') {
          alert(
            "While subdirectories are fine, you can't end the filename with a slash or backslash. If a filename could be detected from the url, it would be automatically appended.",
          );
          return;
        } else {
          opts.filename += filename;
        }
      }
      if (network_regex_input.value !== '' && opts.filename.includes('$')) {
        const network_re = new RegExp(network_regex_input.value, 'i');
        const network_ret = network_re.exec(opts.url);
        opts.filename = opts.filename.replace(/\$(\d+)/g, (match, p1) => {
          const n = parseInt(p1, 10);
          return network_ret[n];
        });
      }
      if (
        extract_extension(opts.filename) === '' &&
        extract_url_extension(opts.url) !== ''
      ) {
        // Automatically use the extension from the url if the filename field is missing a file extension
        opts.filename += '.' + extract_url_extension(opts.url);
      }
    }
    if (opts.filename === '') {
      delete opts.filename;
    }

    chrome.runtime.sendMessage({
      action: 'download',
      opts: opts,
    });

    // mark in network list as downloaded
    let i = network_visible_entries.findIndex(
      entry => entry.request.url === opts.url,
    );
    if (i !== -1) {
      if (options.reverse_list) {
        i = network_visible_entries.length - 1 - i;
      }
      const li = network_list.getElementsByTagName('li')[i];
      li.classList.add('downloaded');
    }

    // add to history
    document.body.setAttribute('history', '');
    history.push(opts.url);
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.appendChild(document.createTextNode(opts.url));
    a.href = opts.url;
    a.title = opts.filename ? opts.filename : extract_url_filename(opts.url);
    a.addEventListener('click', e => {
      // allow middle click to open link in new window
      if (e.button === 0 && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        url_input.value = opts.url;
        url_update();
        filename_input.value = opts.filename ? opts.filename : '';
        setTimeout(() => filename_input.focus(), 100);
      }
    });
    li.appendChild(a);
    if (options.reverse_list) {
      history_list.insertBefore(li, history_list.firstChild);
    } else {
      history_list.appendChild(li);
    }
    url_update();
  }

  function download() {
    start_download({
      url: url_input.value,
      filename: filename_input.value,
    });
  }

  function saveas() {
    start_download({
      url: url_input.value,
      filename: filename_input.value,
      saveAs: true,
    });
  }

  function keyup(e) {
    if (e.keyCode === 13) {
      download();
      // url_update();
    }
  }

  function filename_update() {
    inspected_text_button.style.display =
      filename_input.value === inspected_text_button.title ? 'none' : 'block';
    use_document_title.style.display =
      filename_input.value === use_document_title.title ? 'none' : 'block';
  }

  function url_update() {
    url_input.classList.toggle('downloaded', history.includes(url_input.value));
    ffmpeg_update();
  }

  function ffmpeg_update() {
    const url_extension = extract_url_extension(url_input.value);
    if (url_extension === 'm3u8') {
      let filename = filename_input.value || 'video';
      const filename_extension = extract_extension(filename);
      if (
        filename_extension === '' ||
        filename_extension !== filename_extension.toLowerCase() ||
        filename_extension.length > 4
      ) {
        filename += '.mp4';
      }
      filename = filename.replaceAll("'", '').replace(/[\/\\]/g, '-');
      ffmpeg_command_input.value = `ffmpeg -i '${url_input.value}' -c copy '${filename}'`;
      ffmpeg_command_input.style.display = 'block';
    } else {
      ffmpeg_command_input.style.display = 'none';
    }
  }

  url_input.addEventListener('input', url_update);
  url_input.addEventListener('focus', url_update);
  url_input.addEventListener('keyup', keyup);
  filename_input.addEventListener('input', ffmpeg_update);
  filename_input.addEventListener('input', filename_update);
  filename_input.addEventListener('keyup', keyup);
  download_button.addEventListener('click', download);
  saveas_button.addEventListener('click', saveas);

  // window.addEventListener('focus', () => {
  if (url_input.value === '') {
    url_input.focus();
    document.execCommand('paste');
    const text = url_input.value;
    if (history.includes(text)) {
      // don't use the pasted url if we have it in the history
      url_input.value = '';
    } else {
      if (/^https?:\/\//i.test(text)) {
        setTimeout(() => filename_input.focus(), 10);
        url_update();
      } else {
        url_input.value = '';
      }
    }
  } else if (filename_input.value === '') {
    filename_input.focus();
  }
  // });

  let network_entries = [];
  let network_visible_entries = [];
  network_minsize_checkbox.addEventListener('change', function () {
    network_minsize_input.classList.toggle('enabled', this.checked);
    filter_network_list();
  });
  network_hidedata_checkbox.addEventListener('change', filter_network_list);

  function minsize_change() {
    if (!network_minsize_checkbox.checked) {
      if (this.value !== '') {
        network_minsize_checkbox.checked = true;
        network_minsize_input.classList.add('enabled');
        filter_network_list();
      }
    } else {
      if (this.value === '') {
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

  for (const filter of document.querySelectorAll('[regex-filter]')) {
    filter.addEventListener('click', function () {
      network_regex_input.value = this.getAttribute('regex-filter');
      filter_network_list();
    });
    if (filter.title === '') {
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
    let filename = '';
    if (!entry.request.url.startsWith('data:')) {
      filename = extract_url_filename(entry.request.url);
    }
    const li = document.createElement('li');
    const span = document.createElement('span');
    const url_link = document.createElement('a');
    li.appendChild(span);
    if (history.includes(entry.request.url)) {
      li.classList.add('downloaded');
    } else if (typeof new_entry === 'boolean' && new_entry) {
      li.classList.add('new');
    }

    // instant download link
    span.appendChild(document.createTextNode('['));
    const instant_link = document.createElement('a');
    instant_link.href = '#'; // needed for middle click
    instant_link.title = `Download ${filename}`;
    instant_link.appendChild(document.createTextNode('download'));
    // highlight url when hovering instant download link
    instant_link.addEventListener('mouseenter', () =>
      url_link.classList.add('hover'),
    );
    instant_link.addEventListener('mouseleave', () =>
      url_link.classList.remove('hover'),
    );
    // instant_link.addEventListener('onmousedown', e => {
    //   if (e.button === 1) {
    //     e.preventDefault();
    //   }
    // });
    instant_link.addEventListener('click', e => {
      e.preventDefault();
      // middle click uses saveAs
      start_download({
        url: entry.request.url,
        saveAs: e.button === 1 || e.metaKey || e.ctrlKey,
      });
    });
    span.appendChild(instant_link);
    span.appendChild(document.createTextNode('] '));

    // preview
    if (entry.content || entry.request.url.startsWith('data:image/')) {
      span.appendChild(document.createTextNode('['));
      const a = document.createElement('a');
      a.appendChild(document.createTextNode('preview'));
      const img = document.createElement('img');

      if (entry.request.url.startsWith('data:image/')) {
        img.src = entry.request.url;
      } else {
        let mime =
          'image/' + (extract_url_extension(entry.request.url) || 'png');
        if (mime === 'image/svg') {
          mime += '+xml';
        }
        const arr = [];
        const binary = atob(entry.content.data);
        for (let i = 0; i < binary.length; i++) {
          arr.push(binary.charCodeAt(i));
        }
        const blob = new Blob([new Uint8Array(arr)], { type: mime });
        const url = URL.createObjectURL(blob);
        img.src = url;
      }

      img.classList.add('preview');
      a.addEventListener('mouseover', () => {
        // img.style.left = a.offsetLeft + a.clientWidth + 5 + 'px';
        img.style.top =
          a.offsetTop + a.clientHeight / 2 - img.height / 2 + 'px';
        document.body.appendChild(img);
      });
      a.addEventListener('mouseout', () => document.body.removeChild(img));
      span.appendChild(a);
      span.appendChild(document.createTextNode('] '));
    }

    // link to populate form
    url_link.appendChild(document.createTextNode(entry.request.url));
    url_link.href = entry.request.url;
    url_link.addEventListener('click', e => {
      // allow middle click to open link in new window (or command or ctrl key)
      if (e.button === 0 && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        url_input.value = entry.request.url;
        url_update();
        setTimeout(() => filename_input.focus(), 100);
      }
    });
    span.appendChild(url_link);
    span.title = filename;

    const size = entry.response.content.size;
    if (size >= 0) {
      span.appendChild(document.createTextNode(` (${fmt_filesize(size)})`));
      instant_link.title += ` (${fmt_filesize(size)})`;
      span.title += ` (${fmt_filesize(size)})`;
    }
    if (options.reverse_list) {
      network_list.insertBefore(li, network_list.firstChild);
    } else {
      network_list.appendChild(li);
    }
  }

  function valid_request(entry) {
    // ignore data urls (0), redirects (3xx), grab resources: empty url, chrome-extension, about:, extensions:
    const status = entry.response.status;
    const url = entry.request.url;
    const prefix = url.substr(0, url.indexOf(':'));
    const skip = ['', 'javascript', 'chrome-extension', 'about', 'extensions'];
    if (
      status === 0 ||
      (status >= 300 && status <= 400) ||
      skip.includes(prefix)
    ) {
      return false;
    }
    // don't record duplicate urls
    if (
      network_entries.some(existing_entry => existing_entry.request.url === url)
    ) {
      return false;
    }
    return true;
  }

  function filter_request(entry) {
    if (network_minsize_checkbox.checked) {
      let minsize = parseInt(network_minsize_input.value, 10); // it is fine to parse even with trailing characters, they will just be ignored
      const suffix = network_minsize_input.value.slice(-1).toLowerCase();

      if (suffix === 'k') {
        minsize = minsize * 1024;
      } else if (suffix === 'm') {
        minsize = minsize * 1024 * 1024;
      } else if (suffix === 'g') {
        minsize = minsize * 1024 * 1024 * 1024;
      }

      if (entry.response.content.size < minsize) {
        return false;
      }
    }
    if (
      network_hidedata_checkbox.checked &&
      entry.request.url.startsWith('data:')
    ) {
      return false;
    }
    if (network_regex_input.value !== '') {
      const re = new RegExp(network_regex_input.value, 'i');
      if (!re.test(entry.request.url)) {
        return false;
      }
    }
    return true;
  }

  function update_request_stats() {
    const shown = network_list.childNodes.length;
    const total = network_entries.length;
    while (network_stats.hasChildNodes()) {
      network_stats.removeChild(network_stats.firstChild);
    }
    if (shown !== total) {
      network_stats.appendChild(
        document.createTextNode(`Showing ${shown} / ${total} urls.`),
      );
    } else if (total === 0) {
      network_stats.appendChild(document.createTextNode('No urls captured.'));
    } else {
      network_stats.appendChild(
        document.createTextNode(`Captured ${shown} urls.`),
      );
    }
  }

  function filter_network_list() {
    clear_network_list();
    const entries = network_entries.filter(filter_request);
    entries.forEach(add_network_entry);
    update_request_stats();
    // autograb url if filtering only matches one entry
    if (url_input.value === '' && entries.length === 1) {
      url_input.value = entries[0].request.url;
      url_update();
    }
  }

  function populate_urls(urls, isException) {
    for (const url of urls) {
      const entry = {
        request: {
          url: url,
        },
        response: {
          status: 200,
          content: { size: -1 },
        },
      };
      if (valid_request(entry)) {
        network_entries.push(entry);
      }
    }
    filter_network_list();
  }

  // action links
  const actions = {
    'clear-history': function (e) {
      history = [];
      setTimeout(() => {
        while (history_list.hasChildNodes()) {
          history_list.removeChild(history_list.firstChild);
        }
        document.body.removeAttribute('history');
        url_update();
      }, 100);
    },
    'clear-network': function (e) {
      network_entries = [];
      clear_network_list();
      update_request_stats();
    },
    reload: function (e) {
      chrome.devtools.inspectedWindow.reload({ ignoreCache: true });
    },
    'grab-all-links': function (e) {
      chrome.devtools.inspectedWindow.eval(
        "(function(){\
const urls = [];\
for (const link of document.getElementsByTagName('a')) {\
  urls.push(link.href);\
}\
return urls;\
})()",
        populate_urls,
      );
    },
    'grab-inspected-links': function (e) {
      chrome.devtools.inspectedWindow.eval(
        "(function(){\
const urls = [];\
if ($0.tagName === 'A') {\
  urls.push($0.href);\
}\
for (const link of $0.getElementsByTagName('a')) {\
  urls.push(link.href);\
}\
return urls;\
})()",
        populate_urls,
      );
    },
    inspect: function (e) {
      if (inspect_interval) {
        clearInterval(inspect_interval);
        inspect_interval = null;
        inspect_button.textContent = 'Inspect';
        chrome.devtools.inspectedWindow.eval(
          '(function(){ delete window.downloadPanelExtensionText; })()',
        );
        return;
      }
      inspect_button.textContent = 'Stop';
      chrome.devtools.inspectedWindow.eval(
        "(function(){\
if (window.downloadPanelExtensionText !== undefined) {\
  return;\
}\
\
const wrapper = document.createElement('div');\
wrapper.style.all = 'unset';\
const shadow = wrapper.attachShadow({ mode: 'closed' });\
document.body.appendChild(wrapper);\
const overlay = document.createElement('div');\
overlay.style.position = 'fixed';\
overlay.style.backgroundColor = 'rgba(255, 155, 0, 0.3)';\
overlay.style.pointerEvents = 'none';\
overlay.style.zIndex = 10000;\
shadow.appendChild(overlay);\
window.downloadPanelExtensionText = null;\
let target = null;\
\
function getText(node) {\
  if (node.nodeType === Node.ELEMENT_NODE) {\
    if (node.value || node.alt || node.placeholder) {\
      return node.value || node.alt || node.placeholder;\
    }\
    let text = Array.from(node.childNodes).map(getText).filter(Boolean).join('');\
    const display = getComputedStyle(node).display;\
    if (node.tagName === 'BR' || display.includes('block') || display === 'list-item') {\
      if (text === '') {\
        return text;\
      }\
      return ' '+text+' ';\
    }\
    return text;\
  } else if (node.nodeType === Node.TEXT_NODE) {\
    return node.nodeValue;\
  } else {\
    return '';\
  }\
}\
function stop() {\
  window.removeEventListener('mouseover', handleMouseOver, true);\
  window.removeEventListener('scroll', updateTarget, true);\
  window.removeEventListener('click', handleClick, true);\
  document.body.removeChild(wrapper);\
  delete window.downloadPanelExtensionText;\
}\
function updateTarget() {\
  if (window.downloadPanelExtensionText === undefined) {\
    stop();\
    return;\
  }\
  const rect = target.getBoundingClientRect();\
  overlay.style.left = rect.left+'px';\
  overlay.style.top = rect.top+'px';\
  overlay.style.width = rect.width+'px';\
  overlay.style.height = rect.height+'px';\
  window.downloadPanelExtensionText = getText(target)?.trim() || '';\
}\
function handleMouseOver(e) {\
  target = e.target;\
  while (((target.textContent || target.value || target.alt)?.trim() || '') === '') {\
    target = target.parentNode;\
  }\
  updateTarget();\
}\
function handleClick(e) {\
  e.preventDefault();\
  e.stopPropagation();\
  stop();\
}\
\
window.addEventListener('mouseover', handleMouseOver, true);\
window.addEventListener('scroll', updateTarget, true);\
window.addEventListener('click', handleClick, true);\
})()",
      );
      inspect_interval = setInterval(() => {
        chrome.devtools.inspectedWindow.eval(
          '(function(){ return window.downloadPanelExtensionText; })()',
          (text, err) => {
            if (err) {
              console.error(err);
              return;
            }
            if (text === undefined) {
              clearInterval(inspect_interval);
              inspect_interval = null;
              inspect_button.textContent = 'Inspect';
              return;
            }
            text = (text || '')
              .replace(/[:*?"<>|\r\n]/g, '')
              .replace(/[\t \xa0]+/g, ' ')
              .trim();
            if (text === filename_input.value) {
              return;
            }
            filename_input.value = text;
            ffmpeg_update();
          },
        );
      }, 100);
    },
    'adopt-text-for-filename': function (e) {
      filename_input.value = this.title;
      filename_update();
      ffmpeg_update();
    },
    'grab-resources': function (e) {
      chrome.devtools.inspectedWindow.getResources(resources => {
        // we're faking HAR entries here, we'll see if this holds up in the future
        for (const resource of resources) {
          const entry = {
            request: {
              url: resource.url,
            },
            response: {
              status: 200,
              content: { size: -1 },
            },
          };
          if (valid_request(entry)) {
            if (resource.type === 'image') {
              resource.getContent((content, encoding) => {
                entry.content = { encoding: encoding, data: content };
                network_entries.push(entry);
                filter_network_list();
              });
            } else {
              network_entries.push(entry);
            }
          }
        }
        filter_network_list();
      });
    },
    'download-all': function (e) {
      const filename = filename_input.value; // Save this value because the input field will be cleared after the first call
      network_visible_entries.forEach(function (entry, index) {
        setTimeout(() => {
          start_download({
            url: entry.request.url,
            filename: filename,
          });
        }, 100 * index);
      });
    },
    'open-tab': function (e) {
      chrome.runtime.sendMessage({
        action: 'open-tab',
        opts: { url: e.srcElement.href },
      });
    },
    'open-downloads-folder': function (e) {
      chrome.runtime.sendMessage({ action: 'open-downloads-folder' });
    },
    'open-options': function (e) {
      chrome.runtime.sendMessage({ action: 'open-options' });
    },
  };

  for (const link of document.querySelectorAll('[action]')) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      actions[this.getAttribute('action')].call(this, e);
    });
  }

  chrome.runtime.sendMessage({ action: 'get-platform' }).then(platform => {
    for (const link of document.querySelectorAll(
      'a[href="chrome://downloads"]',
    )) {
      link.title = platform.os === 'mac' ? '⌘ + Shift + J' : 'Ctrl + J';
    }
  });

  // Only try to use chrome.devtools.* APIs if we're a devtools page (opening the chrome-extension url in its own tab will cause Aw Snap)
  if (window.top !== window) {
    document.body.setAttribute('devtools', '');

    chrome.devtools.network.getHAR(har_log => {
      network_entries = network_entries.concat(
        har_log.entries.filter(valid_request),
      );
      filter_network_list();
    });

    chrome.devtools.network.onRequestFinished.addListener(har_entry => {
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

    chrome.devtools.network.onNavigated.addListener(url => {
      // console.log(url);
      if (network_autoclear_checkbox.checked) {
        actions['clear-network']();
      }
    });

    function check_inspected_element() {
      chrome.devtools.inspectedWindow.eval(
        "(function(){ if ($0 !== undefined) { return $0.getElementsByTagName('a').length; } })()",
        (count, err) => {
          if (err) {
            console.error(err);
            return;
          }
          const link = document.querySelector(
            '[action="grab-inspected-links"]',
          );
          while (link.childNodes.length > 1) {
            link.removeChild(link.lastChild);
          }
          // count is undefined if there is no element selected, this happens when the user navigates to another page
          if (count === undefined) {
            link.setAttribute('disabled', true);
          } else {
            link.removeAttribute('disabled');
            link.appendChild(document.createTextNode(` (${count} links)`));
          }
        },
      );
      chrome.devtools.inspectedWindow.eval(
        '(function(){ if ($0 !== undefined && $0 !== document.body) { return $0.textContent; } })()',
        (text, err) => {
          if (err) {
            console.error(err);
            return;
          }
          while (inspected_text_button.firstChild) {
            inspected_text_button.removeChild(inspected_text_button.firstChild);
          }
          // text is undefined if there is no element selected, this happens when the user navigates to another page
          text = (text || '')
            .replace(/[:*?"<>|\r\n]/g, '')
            .replace(/[\t ]+/g, ' ')
            .trim();
          if (text !== '') {
            inspected_text_button.title = text;
            inspected_text_button.textContent = text;
            inspected_text_button.style.display = 'block';
          }
        },
      );
    }

    function update_document_title() {
      chrome.devtools.inspectedWindow.eval(
        '(function(){ return [document.location.href, document.title]; })()',
        ([url, title], err) => {
          if (err) {
            console.error(err);
            return;
          }
          const uri = new URL(url);
          title = (title || '').trim();
          if (title) {
            const lastPart = title.split(' ').at(-1).toLowerCase();
            if (
              title.length > lastPart.length &&
              (uri.hostname.endsWith(lastPart) ||
                uri.hostname.split('.').includes(lastPart))
            ) {
              title = title
                .substring(0, title.length - lastPart.length)
                .replace(/[\-|\t ]+$/, '');
            }
          }
          title = title
            .replace(/[:*?"<>|\r\n]/g, '')
            .replace(/[\t ]+/g, ' ')
            .trim();
          if (title === use_document_title.title) {
            return;
          }
          use_document_title.title = title;
          use_document_title.textContent = title;
          use_document_title.style.display =
            filename_input.value === use_document_title.title
              ? 'none'
              : 'block';
        },
      );
    }

    if (chrome.devtools.panels) {
      // Can't react to theme updates yet, the value doesn't change when the theme is changed
      document.body.classList.add(`theme-${chrome.devtools.panels.themeName}`);
      chrome.devtools.panels.elements.onSelectionChanged.addListener(
        check_inspected_element,
      );
      check_inspected_element();
      update_document_title();
      chrome.devtools.network.onNavigated.addListener(update_document_title);
      setInterval(update_document_title, 1000); // detect title updates
    }
  }
});
