var is_firefox = navigator.userAgent.indexOf('Firefox/') != -1;


// chrome.devtools.panels.create(
//   "Download",
//   "img/icon16.png",
//   "panel.html",
//   function(panel) {
//     panel.onShown.addListener(function(win) {
//       win.focus();
//     });
//   }
// );

if (is_firefox) {
  browser.devtools.panels.create(
    "Download",
    "img/icon16.png",
    "panel.html",
    // function(panel) {
    //   panel.onShown.addListener(function(win) {
    //     win.focus();
    //   });
    // }
  ).then((panel) => {
    panel.onShown.addListener(function(win) {
      win.focus();
    });
  });
}
else {
  chrome.devtools.panels.create(
    "Download",
    "img/icon16.png",
    "panel.html",
    function(panel) {
      panel.onShown.addListener(function(win) {
        win.focus();
      });
    }
  );
}
