const https = require('https');
const packageJson = require('../package.json');

function checkForUpdates() {
  return new Promise((resolve) => {
    const currentVersion = packageJson.version || '1.0.5';
    const url = 'https://raw.githubusercontent.com/cssiom-cloud/WLM/main/package.json';

    const req = https.get(url, { headers: { 'User-Agent': 'WLR-Command-Portal' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const remotePkg = JSON.parse(data);
          const remoteVersion = remotePkg.version || currentVersion;
          
          // Compare versions (semver style)
          const isNewer = compareVersions(remoteVersion, currentVersion) > 0;
          resolve({
            updateAvailable: isNewer,
            currentVersion,
            latestVersion: remoteVersion,
            downloadUrl: `https://github.com/cssiom-cloud/WLM/tree/main/release/v${remoteVersion}`,
            setupExeUrl: `https://github.com/cssiom-cloud/WLM/raw/main/release/v${remoteVersion}/WLR%20Command%20Portal%20Setup%20${remoteVersion}.exe`,
            portableExeUrl: `https://github.com/cssiom-cloud/WLM/raw/main/release/v${remoteVersion}/WLR%20Command%20Portal-v${remoteVersion}-Portable.exe`,
            repoUrl: 'https://github.com/cssiom-cloud/WLM'
          });
        } catch (err) {
          resolve({
            updateAvailable: false,
            currentVersion,
            latestVersion: currentVersion,
            error: err.message
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        error: err.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        error: 'Update check timed out'
      });
    });
  });
}

function compareVersions(v1, v2) {
  const parts1 = String(v1).replace(/^v/, '').split('.').map(Number);
  const parts2 = String(v2).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

checkForUpdates().then(console.log);
