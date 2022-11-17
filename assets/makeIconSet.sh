#!/bin/bash

mkdir MacOS_Icon.iconset
sips -z 16 16     fire-reports-icon.png --out MacOS_Icon.iconset/icon_16x16.png
sips -z 32 32     fire-reports-icon.png --out MacOS_Icon.iconset/icon_16x16@2x.png
sips -z 32 32     fire-reports-icon.png --out MacOS_Icon.iconset/icon_32x32.png
sips -z 64 64     fire-reports-icon.png --out MacOS_Icon.iconset/icon_32x32@2x.png
sips -z 128 128   fire-reports-icon.png --out MacOS_Icon.iconset/icon_128x128.png
sips -z 256 256   fire-reports-icon.png --out MacOS_Icon.iconset/icon_128x128@2x.png
sips -z 256 256   fire-reports-icon.png --out MacOS_Icon.iconset/icon_256x256.png
sips -z 512 512   fire-reports-icon.png --out MacOS_Icon.iconset/icon_256x256@2x.png
sips -z 512 512   fire-reports-icon.png --out MacOS_Icon.iconset/icon_512x512.png
cp fire-reports-icon.png MacOS_Icon.iconset/icon_512x512@2x.png
iconutil -c icns MacOS_Icon.iconset
rm -R MacOS_Icon.iconset
