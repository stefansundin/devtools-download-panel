// Chrome no longer displays icons but Firefox requires them.

chrome.devtools.panels.create(
  'Download',
  'img/devtools-icon.png',
  'panel.html',
  (panel) => panel.onShown.addListener((win) => win.focus()),
);
