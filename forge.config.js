const path = require('path');

module.exports = {
    "packagerConfig": {
    },
    "makers": [
      {
        "name": "@electron-forge/maker-squirrel",
        "platforms": ['win32'],
        "config": (arch) => {
          return {
            name: 'fire-report-utility',
            authors: 'Owen O Byrne',
            title: "Fire Report Utility",
            noMsi: true,
            remoteReleases: '',
            iconUrl: "https://owenobyrne.s3-eu-west-1.amazonaws.com/fire-reports-icon.png",
            certificateFile: path.resolve(__dirname, '../codesigning.pfx'),
            certificatePassword: ""
          }
        }
      },
      {
        "name": '@electron-forge/maker-dmg',
        "platforms": ['darwin'],
        "config": (arch) => {
          return {
            name: 'fire-report-utility',
            icon: "fire-reports-icon.png",
            format: 'ULFO'
          }
        }
      }
    ],
    "plugins": [
      {
        "name": "@electron-forge/plugin-webpack",
        "config": {
          "mainConfig": "./webpack.main.config.js",
          "devContentSecurityPolicy": "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src data: https://cdn.jsdelivr.net https://fonts.gstatic.com; img-src 'self' 'unsafe-inline' data: https://cdn.jsdelivr.net; connect-src ws://localhost:3000; child-src 'self'",
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
      }
    ],
	publishers: [
		{
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'owenobyrne',
          name: 'fire-report-utility'
        },
        prerelease: false
      }
    }
	]
};