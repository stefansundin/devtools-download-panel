// We have to use a lot of setTimeout in click handlers unfortunately, otherwise it will cause another click if the content scrolls up due to what happens in the handler.

function formatFilesize(bytes, digits = 1) {
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
  let size = bytes;
  while (size > 1024 && i < units.length) {
    size = size / 1024;
    i++;
  }
  if (i > 0) {
    size = size.toFixed(digits);
  }
  return `${size} ${units[i]}`;
}

function extractFilenameExtension(filename) {
  const i = filename.lastIndexOf('.');
  if (i === -1) {
    return '';
  }
  return filename.substring(i + 1);
}

function extractUrlFilename(url) {
  let i = url.indexOf('?');
  if (i !== -1) {
    url = url.substring(0, i);
  }
  i = url.indexOf('#');
  if (i !== -1) {
    url = url.substring(0, i);
  }
  return url.substring(url.lastIndexOf('/') + 1);
}

function extractUrlFilenameExtension(url) {
  const re = /^data:[a-z]+\/([a-z]+)[,;]/.exec(url);
  if (re) {
    return re[1];
  }
  return extractFilenameExtension(extractUrlFilename(url));
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('url');
  const filenameInput = document.getElementById('filename');
  const ffmpegCommandInput = document.getElementById('ffmpeg-command');
  const inspectButton = document.getElementById('inspect');
  const useDocumentTitleButton = document.getElementById('use-document-title');
  const useInspectedTextButton = document.getElementById('use-inspected-text');
  const downloadButton = document.getElementById('download');
  const saveAsButton = document.getElementById('saveas');
  const historyList = document.getElementById('history');
  const networkRegexpInput = document.getElementById('network-regexp');
  const networkMinsizeCheckbox = document.getElementById('network-minsize');
  const networkHidedataCheckbox = document.getElementById('network-hidedata');
  const networkMinsizeInput = document.getElementById('network-minsize-value');
  const networkAutodownloadCheckbox = document.getElementById(
    'network-autodownload',
  );
  const networkAutoclearCheckbox = document.getElementById('network-autoclear');
  const networkList = document.getElementById('network');
  const networkStats = document.getElementById('network-stats');

  const version = chrome.runtime.getManifest().version;
  const versionInfo = document.getElementById('version-info');
  versionInfo.textContent = `v${version}`;

  const platform = await chrome.runtime.sendMessage({ action: 'get-platform' });
  for (const link of document.querySelectorAll(
    'a[href="chrome://downloads"]',
  )) {
    link.title = platform.os === 'mac' ? '⌘ + Shift + J' : 'Ctrl + J';
  }
  const quoteCharacter = platform.os === 'win' ? '"' : "'";

  let history = [];
  let inspectInterval = null;

  const options = await chrome.runtime.sendMessage({ action: 'get-options' });
  networkHidedataCheckbox.checked = options.networkHidedata;

  const scrollToTopLink = document.getElementById('scroll-to-top');
  scrollToTopLink.addEventListener('click', () => window.scrollTo(0, 0));
  window.addEventListener('scroll', () => {
    if (window.scrollY > 0) {
      if (scrollToTopLink.style.display === 'none') {
        scrollToTopLink.style.display = 'block';
      }
    } else {
      if (scrollToTopLink.style.display === 'block') {
        scrollToTopLink.style.display = 'none';
      }
    }
  });

  // Prevent Esc key from bringing up the console in input fields
  function keydown(e) {
    if (e.keyCode === 27) {
      e.stopPropagation();
    }
  }

  for (const input of document.getElementsByTagName('input')) {
    input.addEventListener('keydown', keydown);
  }

  function startDownload(opts) {
    if (opts.url === '') {
      return;
    }
    if (opts.filename) {
      const pattern = new RegExp(filenameInput.pattern);
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
        const filename = extractUrlFilename(opts.url);
        if (filename === '') {
          alert(
            "While subdirectories are fine, you can't end the filename with a slash or backslash. If a filename could be detected from the url, it would be automatically appended.",
          );
          return;
        } else {
          opts.filename += filename;
        }
      }
      if (networkRegexpInput.value !== '' && opts.filename.includes('$')) {
        const networkRegExp = new RegExp(networkRegexpInput.value, 'i');
        const regExpExecResult = networkRegExp.exec(opts.url);
        opts.filename = opts.filename.replace(/\$(\d+)/g, (match, p1) => {
          const n = parseInt(p1, 10);
          return regExpExecResult[n];
        });
      }
      if (
        extractFilenameExtension(opts.filename) === '' &&
        extractUrlFilenameExtension(opts.url) !== ''
      ) {
        // Automatically use the extension from the url if the filename field is missing a file extension
        opts.filename += '.' + extractUrlFilenameExtension(opts.url);
      }
    }
    if (opts.filename === '') {
      delete opts.filename;
    }

    chrome.runtime.sendMessage({
      action: 'download',
      opts: opts,
    });

    // Mark in network list as downloaded
    let i = networkVisibleEntries.findIndex(
      (entry) => entry.request.url === opts.url,
    );
    if (i !== -1) {
      if (options.reverseList) {
        i = networkVisibleEntries.length - 1 - i;
      }
      const li = networkList.getElementsByTagName('li')[i];
      li.classList.add('downloaded');
    }

    // Add to history
    document.body.setAttribute('history', '');
    history.push(opts.url);
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = opts.url;
    a.href = opts.url;
    a.title = opts.filename ? opts.filename : extractUrlFilename(opts.url);
    a.addEventListener('click', (e) => {
      // Make middle click to open link in new window
      if (e.button === 0 && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        urlInput.value = opts.url;
        urlUpdate();
        filenameInput.value = opts.filename ? opts.filename : '';
        setTimeout(() => filenameInput.focus(), 100);
      }
    });
    li.appendChild(a);
    if (options.reverseList) {
      historyList.insertBefore(li, historyList.firstChild);
    } else {
      historyList.appendChild(li);
    }
    urlUpdate();
  }

  function download() {
    startDownload({
      url: urlInput.value,
      filename: filenameInput.value,
    });
  }

  function saveas() {
    startDownload({
      url: urlInput.value,
      filename: filenameInput.value,
      saveAs: true,
    });
  }

  function keyup(e) {
    if (e.keyCode === 13) {
      download();
      // urlUpdate();
    }
  }

  function filenameUpdate() {
    useInspectedTextButton.style.display =
      filenameInput.value === useInspectedTextButton.title ? 'none' : '';
    useDocumentTitleButton.style.display =
      filenameInput.value === useDocumentTitleButton.title ? 'none' : '';
  }

  function urlUpdate() {
    urlInput.classList.toggle('downloaded', history.includes(urlInput.value));
    ffmpegUpdate();
  }

  function ffmpegUpdate() {
    const urlExtension = extractUrlFilenameExtension(urlInput.value);
    if (urlExtension === 'm3u8') {
      let filename = filenameInput.value || 'video';
      const filenameExtension = extractFilenameExtension(filename);
      if (
        filenameExtension === '' ||
        filenameExtension !== filenameExtension.toLowerCase() ||
        filenameExtension.length > 4
      ) {
        filename += '.mp4';
      }
      filename = filename.replaceAll("'", '').replace(/[\/\\]/g, '-');
      ffmpegCommandInput.value = `ffmpeg -i ${quoteCharacter}${urlInput.value}${quoteCharacter} -c copy ${quoteCharacter}${filename}${quoteCharacter}`;
      ffmpegCommandInput.style.display = 'block';
    } else {
      ffmpegCommandInput.style.display = 'none';
    }
  }

  urlInput.addEventListener('input', urlUpdate);
  urlInput.addEventListener('focus', urlUpdate);
  urlInput.addEventListener('keyup', keyup);
  filenameInput.addEventListener('input', ffmpegUpdate);
  filenameInput.addEventListener('input', filenameUpdate);
  filenameInput.addEventListener('keyup', keyup);
  downloadButton.addEventListener('click', download);
  saveAsButton.addEventListener('click', saveas);

  // window.addEventListener('focus', () => {
  if (urlInput.value === '') {
    urlInput.focus();
    document.execCommand('paste');
    const text = urlInput.value;
    if (history.includes(text)) {
      // Don't use the pasted url if we have it in the history
      urlInput.value = '';
    } else {
      if (/^https?:\/\//i.test(text)) {
        setTimeout(() => filenameInput.focus(), 10);
        urlUpdate();
      } else {
        urlInput.value = '';
      }
    }
  } else if (filenameInput.value === '') {
    filenameInput.focus();
  }
  // });

  let networkEntries = [];
  let networkVisibleEntries = [];
  networkMinsizeCheckbox.addEventListener('change', function () {
    networkMinsizeInput.classList.toggle('enabled', this.checked);
    filterNetworkList();
  });
  networkHidedataCheckbox.addEventListener('change', filterNetworkList);

  function networkMinsizeChange() {
    if (!networkMinsizeCheckbox.checked) {
      if (this.value !== '') {
        networkMinsizeCheckbox.checked = true;
        networkMinsizeInput.classList.add('enabled');
        filterNetworkList();
      }
    } else {
      if (this.value === '') {
        networkMinsizeCheckbox.checked = false;
        networkMinsizeInput.classList.remove('enabled');
      }
      filterNetworkList();
    }
  }

  networkMinsizeInput.addEventListener('focus', networkMinsizeChange);
  networkMinsizeInput.addEventListener('keyup', networkMinsizeChange);
  networkMinsizeInput.addEventListener('search', networkMinsizeChange);
  networkRegexpInput.addEventListener('focus', filterNetworkList);
  networkRegexpInput.addEventListener('keyup', filterNetworkList);
  networkRegexpInput.addEventListener('search', filterNetworkList);

  for (const filter of document.querySelectorAll('[data-regex-filter]')) {
    filter.addEventListener('click', function () {
      networkRegexpInput.value = this.dataset.regexFilter;
      filterNetworkList();
    });
    if (filter.title === '') {
      filter.title = filter.dataset.regexFilter;
    }
  }

  function clearNetworkList() {
    networkVisibleEntries = [];
    while (networkList.hasChildNodes()) {
      networkList.removeChild(networkList.firstChild);
    }
  }

  function addNetworkEntry(entry, newEntry) {
    networkVisibleEntries.push(entry);
    let filename = '';
    if (!entry.request.url.startsWith('data:')) {
      filename = extractUrlFilename(entry.request.url);
    }
    const li = document.createElement('li');
    const span = document.createElement('span');
    const urlLink = document.createElement('a');
    li.appendChild(span);
    if (history.includes(entry.request.url)) {
      li.classList.add('downloaded');
    } else if (typeof newEntry === 'boolean' && newEntry) {
      li.classList.add('new');
    }

    // Instant download link
    span.appendChild(document.createTextNode('['));
    const instantLink = document.createElement('a');
    instantLink.href = '#'; // Needed for middle click
    instantLink.title = `Download ${filename}`;
    instantLink.textContent = 'download';
    // Highlight url when hovering instant download link
    instantLink.addEventListener('mouseenter', () =>
      urlLink.classList.add('hover'),
    );
    instantLink.addEventListener('mouseleave', () =>
      urlLink.classList.remove('hover'),
    );
    // instantLink.addEventListener('onmousedown', (e) => {
    //   if (e.button === 1) {
    //     e.preventDefault();
    //   }
    // });
    instantLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Middle click uses saveAs
      startDownload({
        url: entry.request.url,
        saveAs: e.button === 1 || e.metaKey || e.ctrlKey,
      });
    });
    span.appendChild(instantLink);
    span.appendChild(document.createTextNode('] '));

    // Preview
    if (entry.content || entry.request.url.startsWith('data:image/')) {
      span.appendChild(document.createTextNode('['));
      const a = document.createElement('a');
      a.textContent = 'preview';
      const img = document.createElement('img');

      if (entry.request.url.startsWith('data:image/')) {
        img.src = entry.request.url;
      } else {
        let mime =
          'image/' + (extractUrlFilenameExtension(entry.request.url) || 'png');
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

    // Link to populate form
    urlLink.textContent = entry.request.url;
    urlLink.href = entry.request.url;
    urlLink.addEventListener('click', (e) => {
      // Make middle click to open link in new window (or command or ctrl key)
      if (e.button === 0 && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        urlInput.value = entry.request.url;
        urlUpdate();
        setTimeout(() => filenameInput.focus(), 100);
      }
    });
    span.appendChild(urlLink);
    span.title = filename;

    const size = entry.response.content.size;
    if (size >= 0) {
      const filesize = formatFilesize(size);
      span.appendChild(document.createTextNode(` (${filesize})`));
      instantLink.title += ` (${filesize})`;
      span.title += ` (${filesize})`;
    }
    if (options.reverseList) {
      networkList.insertBefore(li, networkList.firstChild);
    } else {
      networkList.appendChild(li);
    }
  }

  function validRequest(entry) {
    // Ignore data urls (0), redirects (3xx), grab resources: empty url, chrome-extension, about:, extensions:
    const status = entry.response.status;
    const url = entry.request.url;
    const prefix = url.substring(0, url.indexOf(':'));
    const skip = ['', 'javascript', 'chrome-extension', 'about', 'extensions'];
    if (
      status === 0 ||
      (status >= 300 && status <= 400) ||
      skip.includes(prefix)
    ) {
      return false;
    }
    // Don't record duplicate urls
    if (
      networkEntries.some((existingEntry) => existingEntry.request.url === url)
    ) {
      return false;
    }
    return true;
  }

  function filterRequest(entry) {
    if (networkMinsizeCheckbox.checked) {
      let minsize = parseInt(networkMinsizeInput.value, 10); // It is fine to parse even with trailing characters, they will just be ignored
      const suffix = networkMinsizeInput.value.slice(-1).toLowerCase();

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
      networkHidedataCheckbox.checked &&
      entry.request.url.startsWith('data:')
    ) {
      return false;
    }
    if (networkRegexpInput.value !== '') {
      const re = new RegExp(networkRegexpInput.value, 'i');
      if (!re.test(entry.request.url)) {
        return false;
      }
    }
    return true;
  }

  function updateRequestStats() {
    const shown = networkList.childNodes.length;
    const total = networkEntries.length;
    if (shown !== total) {
      networkStats.textContent = `Showing ${shown} / ${total} urls.`;
    } else if (total === 0) {
      networkStats.textContent = 'No urls captured.';
    } else {
      networkStats.textContent = `Captured ${shown} urls.`;
    }
  }

  function filterNetworkList() {
    clearNetworkList();
    const entries = networkEntries.filter(filterRequest);
    entries.forEach(addNetworkEntry);
    updateRequestStats();
    // Autograb url if filtering only matches one entry
    if (urlInput.value === '' && entries.length === 1) {
      urlInput.value = entries[0].request.url;
      urlUpdate();
    }
  }

  function populateUrls(urls, isException) {
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
      if (validRequest(entry)) {
        networkEntries.push(entry);
      }
    }
    filterNetworkList();
  }

  // Action links
  const actions = {
    'clear-history': function (e) {
      history = [];
      setTimeout(() => {
        while (historyList.hasChildNodes()) {
          historyList.removeChild(historyList.firstChild);
        }
        document.body.removeAttribute('history');
        urlUpdate();
      }, 100);
    },
    'clear-network': function (e) {
      networkEntries = [];
      clearNetworkList();
      updateRequestStats();
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
        populateUrls,
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
        populateUrls,
      );
    },
    inspect: function (e) {
      if (inspectInterval) {
        clearInterval(inspectInterval);
        inspectInterval = null;
        inspectButton.textContent = 'Inspect';
        chrome.devtools.inspectedWindow.eval(
          '(function(){ delete window.downloadPanelExtensionText; })()',
        );
        return;
      }
      inspectButton.textContent = 'Stop';
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
      inspectInterval = setInterval(() => {
        chrome.devtools.inspectedWindow.eval(
          '(function(){ return window.downloadPanelExtensionText; })()',
          (text, err) => {
            if (err) {
              console.error(err);
              return;
            }
            if (text === undefined) {
              clearInterval(inspectInterval);
              inspectInterval = null;
              inspectButton.textContent = 'Inspect';
              return;
            }
            text = (text || '')
              .replace(/[:*?"<>|\r\n]/g, '')
              .replace(/[\t \xa0]+/g, ' ')
              .trim();
            if (text === filenameInput.value) {
              return;
            }
            filenameInput.value = text;
            ffmpegUpdate();
          },
        );
      }, 100);
    },
    'adopt-text-for-filename': function (e) {
      filenameInput.value = this.title;
      filenameUpdate();
      ffmpegUpdate();
    },
    'grab-resources': function (e) {
      chrome.devtools.inspectedWindow.getResources((resources) => {
        // We're faking HAR entries here, we'll see if this holds up in the future
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
          if (validRequest(entry)) {
            if (resource.type === 'image') {
              resource.getContent((content, encoding) => {
                entry.content = { encoding: encoding, data: content };
                networkEntries.push(entry);
                filterNetworkList();
              });
            } else {
              networkEntries.push(entry);
            }
          }
        }
        filterNetworkList();
      });
    },
    'download-all': function (e) {
      const filename = filenameInput.value; // Save this value because the input field will be cleared after the first call
      networkVisibleEntries.forEach(function (entry, index) {
        setTimeout(() => {
          startDownload({
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

  for (const link of document.querySelectorAll('[data-action]')) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      actions[this.dataset.action].call(this, e);
    });
  }

  // Only try to use chrome.devtools.* APIs if we're a devtools page (opening the chrome-extension:// url in its own tab will cause Aw Snap)
  if (window.top !== window) {
    document.body.setAttribute('devtools', '');

    chrome.devtools.network.getHAR((harLog) => {
      networkEntries = networkEntries.concat(
        harLog.entries.filter(validRequest),
      );
      filterNetworkList();
    });

    chrome.devtools.network.onRequestFinished.addListener((entry) => {
      if (validRequest(entry)) {
        networkEntries.push(entry);
        if (filterRequest(entry)) {
          if (networkAutodownloadCheckbox.checked) {
            startDownload({ url: entry.request.url });
          }
          addNetworkEntry(entry, true);
        }
        updateRequestStats();
      }
    });

    chrome.devtools.network.onNavigated.addListener((url) => {
      // console.log(url);
      if (networkAutoclearCheckbox.checked) {
        actions['clear-network']();
      }
    });

    function checkInspectedElement() {
      chrome.devtools.inspectedWindow.eval(
        "(function(){ if ($0 !== undefined) { return $0.getElementsByTagName('a').length; } })()",
        (count, err) => {
          if (err) {
            console.error(err);
            return;
          }
          const link = document.querySelector(
            '[data-action="grab-inspected-links"]',
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
          // text is undefined if there is no element selected, this happens when the user navigates to another page
          text = (text || '')
            .replace(/[:*?"<>|\r\n]/g, '')
            .replace(/[\t ]+/g, ' ')
            .trim();
          if (text !== '') {
            useInspectedTextButton.title = text;
            useInspectedTextButton.textContent = text;
            useInspectedTextButton.style.display = '';
          } else {
            useInspectedTextButton.textContent = '';
          }
        },
      );
    }

    function updateDocumentTitle() {
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
          if (title === useDocumentTitleButton.title) {
            return;
          }
          useDocumentTitleButton.title = title;
          useDocumentTitleButton.textContent = title;
          useDocumentTitleButton.style.display =
            filenameInput.value === title ? 'none' : '';
        },
      );
    }

    if (chrome.devtools.panels) {
      // Can't react to theme updates yet, the value doesn't change when the theme is changed
      document.body.classList.add(`theme-${chrome.devtools.panels.themeName}`);
      chrome.devtools.panels.elements.onSelectionChanged.addListener(
        checkInspectedElement,
      );
      checkInspectedElement();
      updateDocumentTitle();
      chrome.devtools.network.onNavigated.addListener(updateDocumentTitle);
      setInterval(updateDocumentTitle, 1000); // Detect title updates
    }
  }
});
