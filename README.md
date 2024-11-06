# Fire Report Utility
A desktop utility for downloading Fire reports.

# Building
Run 
```bash
npm install
```
to download and install all the necessary libraries and utilities. 

To generate the API type file from the OpenAPI def first resolve all `$refs`. There's a bug in the typegen script that results in some refs being ignored.
```bash
npm install json-refs --g
json-refs resolve ./static/fire-business-api-v1.yaml > ./static/fire-business-api-v1-resolved.yaml
``` 

Then create the type file - run the npx command without the > param first to install it. 
```bash
npx openapicmd typegen ./static/fire-business-api-v1-resolved.yaml > ./src/types/fire-business-api.d.ts
```


# Code Signing (Windows) 
I used a Comodo Code Signing Cert ($85) from here: https://comodosslstore.com/codesigning.aspx

Needs to be packaged up as a .pfx file and then referenced in the `forge.config.js` file. 

# Code Signing (MacOS)
Create a new Developer ID Application Certificate - it needs to be a Developer ID Application - other types won't work.
- Create a new cert request - use a distinct Common Name, otherwise it'll be hard to find amongst the other certs with the default name. See https://help.apple.com/developer-account/#/devbfa00fef7 for details. 
- Upload to the Certificate page on the Developer center - https://developer.apple.com/account/resources/certificates/list 
- Download the cert, click to open it - a new certificate should arrive in the keychain - `Developer ID Application: <Your name> (<ID>)` 

Use this full certificate name in the `"identity"` field of the `forge.config.js` file - `config.packagerConfig.osxSign`. When you run the package step, it will ask you for your Keychain password to access the key. It needs the key about 15 times, so best to Allow Always. 

You must also Notarize the app - this is a process where Apple reviews the code in an automated fashion. https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution. It takes about 5 minutes during the package process. You need to provide your Apple ID email and a password. You probably have (should have!) 2FA on your Apple ID, so you must create an App Specific Password for this.

- Sign in to https://appleid.apple.com.
- In the Sign-In and Security section, select App-Specific Passwords.
- Select Generate an app-specific password or select the Add button Blue plus sign icon, then follow the steps on your screen.
- Use this password in the `config.packagerConfig.osxNotarize` section of `forge.config.js`

# Make executable

From: https://github.com/MichaelTr7/Electron-Builder-DMG-Tutorial

To make a DMG installer L&F and icons for Mac, in the assets folder, run the `makeIconSet.sh` script, and run the following command: 

```
tiffutil -cathidpicheck "DMG_Background.png" "DMG_Background_Large.png" -out DMG_Background.tiff
```


```bash
npm start make
```



# Publishing
To publish a new version, up the package.json version and run:
```bash
export GITHUB_TOKEN=xxx
npm run publish
```

This will push a new exe to Github which will notify existing installs to update.

