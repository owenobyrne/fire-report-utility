# Fire Report Utility
A desktop utility for downloading Fire reports.

# Building
To generate the API type file from the OpenAPI def first resolve all $refs. There's a bug in the typegen script that results in some refs being ignored.
```bash
npm install json-refs --g
json-refs resolve ./static/fire-business-api-v1.yml > ./static/fire-business-api-v1-resolved.yml
``` 

Then create the type file.
```bash
npm install -g openapi-client-axios-typegen
typegen ./static/fire-business-api-v1-resolved.yml > ./src/types/fire-business-api.d.ts
```

To publish a new version, up the package.json version and run:
```bash
npm run publish
```

This will push a new exe to Github which will notify existing installs to update.

