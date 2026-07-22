const fs = require('fs');
const path = require('path');
const postinstallPath = path.join(__dirname, '..', 'dist', 'postinstall.js');
if (fs.existsSync(postinstallPath)) {
  require(postinstallPath);
}
