# Chrome Download Panel

Adds a download panel to your devtools!

Chrome Web Store: https://chromewebstore.google.com/detail/download-panel/dfkcgjijchipieeogdonnjbhlhjphbfn

Icon from: https://iconarchive.com/show/100-flat-icons-by-graphicloads/download-3-icon.html


# Screenshot

![Screenshot of Download Panel in the Chrome Devtools](screenshot.png)


# Tips
- If you have a URL in your clipboard when opening the download panel, it will be pasted in the URL field automatically.
- End the filename with a `/` to automatically extract and append the filename from the URL.
- The file extension from the URL is automatically used if you don't specify an extension in the filename field.
- Middle-click a <kbd>[download]</kbd> link to open a save-as dialog.
- Middle-click a URL to open it in a new tab.
- Use the <kbd>Inspect</kbd> badge in the filename field to easily grab text from the page and use it for the filename.
- A red circle means that the network entry appeared after you filtered the list. A green circle means you have already downloaded the URL (it is in the history list).
- If you use a Network filter regular expression that have capture groups, then you can reference those capture groups in the filename field with `$1`, `$2`, `$3`, etc.
- If the URL ends with `.m3u8` then a text field with an `ffmpeg` command appears which you can copy paste into a terminal to download the video that the playlist is for.
