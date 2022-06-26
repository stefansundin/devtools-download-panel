chrome.devtools.panels.create('Download', null, 'panel.html', panel =>
  panel.onShown.addListener(win => win.focus()),
);
