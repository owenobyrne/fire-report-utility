const path = require('path');

module.exports = {
    "packagerConfig": {},
    "makers": [
      {
        "name": "@electron-forge/maker-squirrel",
        "platforms": ['win32'],
        "config": (arch) => {
          return {
            name: 'fire-report-downloader',
            authors: 'Owen O Byrne',
            // exe: 'fire-report-downloader.exe',
            title: "Fire Report Downloader",
            noMsi: true,
            remoteReleases: '',
            setupExe: `fire-report-downloader-setup-${arch}.exe`,
            // setupIcon: path.resolve(__dirname, 'fire-reports-icon.png'),
            iconUrl: "https://owenobyrne.s3-eu-west-1.amazonaws.com/fire-reports-icon.png",
            certificateFile: path.resolve(__dirname, 'codesigning.pfx'),
            certificatePassword: ""
          }
        }
      },
      {
        "name": "@electron-forge/maker-zip",
        "platforms": [
          "darwin"
        ]
      },
      {
        "name": "@electron-forge/maker-deb",
        "config": {}
      },
      {
        "name": "@electron-forge/maker-rpm",
        "config": {}
      }
    ],
    "plugins": [
      [
        "@electron-forge/plugin-webpack",
        {
          "mainConfig": "./webpack.main.config.js",
          "renderer": {
            "config": "./webpack.renderer.config.js",
            "entryPoints": [
              {
                "html": "./src/index.html",
                "js": "./src/renderer.ts",
                "name": "main_window",
                "preload": {
                  "js": "./src/preload.ts"
                }
              }
            ]
          }
        }
      ]
    ],
	publishers: [
		// https://www.electronforge.io/config/publishers
	]
};