chrome.devtools.panels.create(
  "Download",
  null,
  "panel.html",
  function(panel) {
    panel.onShown.addListener(function(win) {
      win.focus();
    });
  }
);
