# Fire Report Utility
A desktop utility for downloading Fire reports.

# Building
To generate the API type file from the OpenAPI def first resolve all `$refs`. There's a bug in the typegen script that results in some refs being ignored.
```bash
npm install json-refs --g
json-refs resolve ./static/fire-business-api-v1.yml > ./static/fire-business-api-v1-resolved.yml
``` 

Then create the type file.
```bash
npm install -g openapi-client-axios-typegen
typegen ./static/fire-business-api-v1-resolved.yml > ./src/types/fire-business-api.d.ts
```


# Code Signing (Windows) 
I used a Comodo Code Signing Cert ($85) from here: https://comodosslstore.com/codesigning.aspx

Needs to be packaged up as a .pfx file and then referenced in the `forge.config.js` file. 

# Code Signing (MacOS)
Create a new Developer ID Application Certificate - it needs to be a Developer ID Application - other types won't work.
- Create a new cert request - use a distinct Common Name, otherwise it'll be hard to find amongst the other certs with the default name. See https://help.apple.com/developer-account/#/devbfa00fef7 for details. 
- Upload to the Certificate page on the Developer center - https://developer.apple.com/account/resources/certificates/list 
- Download the cert, click to open it - a new certificate should arrive in the keychain - Developer ID Application: Owen O Byrne (54A3A3X8RX) 

Use this name in the "identity" field of the forge.config.js file - config.packagerConfig.osxSign


# Make executable

https://github.com/MichaelTr7/Electron-Builder-DMG-Tutorial

```
npm start make
```


# Publishing
To publish a new version, up the package.json version and run:
```bash
export GITHUB_TOKEN=xxx
npm run publish
```

This will push a new exe to Github which will notify existing installs to update.

