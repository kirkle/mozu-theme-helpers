"use strict";

module.exports = getThemeDir;
var path = require("path"),
    fs = require("fs");

function getThemeDir() {
  var starting = arguments[0] === undefined ? process.cwd() : arguments[0];

  var lastThemeDir,
      themeDir = lastThemeDir = starting;
  while (themeDir && !fs.existsSync(path.resolve(themeDir, "theme.json")) && (themeDir = path.resolve(themeDir, "../"))) {
    if (themeDir === lastThemeDir) {
      // we made it to root without finding theme.json
      return undefined;
    }
    lastThemeDir = themeDir;
  }
  return themeDir;
}