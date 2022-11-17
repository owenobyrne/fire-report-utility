const path = require('path');

const config = {
    "packagerConfig": {
      "osxSign": {
        "identity": "Developer ID Application: Owen O Byrne (54A3A3X8RX)",
        'gatekeeper-assess': false,
        "signature-flags": "library"
      }
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
        "config": { 
            name: 'fire-report-utility',
            icon: "assets/MacOS_Icon.icns",
            background: "assets/DMG_Background.tiff",
            debug: true,
            format: 'ULFO',
            additionalDMGOptions: {}
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


// if we're on a Mac, add the notarise stuff.
function notarizeMaybe() {
  if (process.platform !== 'darwin') {
    return;
  }


  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.warn(
      'Should be notarizing, but environment variables APPLE_ID or APPLE_ID_PASSWORD are missing!',
    );
    // return;
  }

  config.packagerConfig.osxNotarize = {
    appBundleId: 'com.fire.report-utility',
    appleId: process.env.APPLE_ID || "owen.obyrne@iol.ie",
    appleIdPassword: process.env.APPLE_ID_PASSWORD || "tgdw-ngiy-dzon-piho",
  };
}

notarizeMaybe();

// Finally, export it
module.exports = config;