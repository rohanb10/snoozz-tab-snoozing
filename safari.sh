#!/bin/bash

# https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari
xcrun safari-web-extension-converter . --app-name "snoozz_for_safari"  --bundle-identifier com.snoozeman.snoozz --swift --force --no-open;

cd snoozz_for_safari

# https://developer.apple.com/documentation/safariservices/safari_web_extensions/updating_a_safari_web_extension/#3744531
xcodebuild -scheme snoozz_for_safari build

echo Succesfully built Snoozz for Safari
echo Next Steps:
echo "1. Enable the Develop menu in Safari > Preferences > Advanced"
echo "2. In the Develop menu, click Allow Unsigned Extensions"
echo "3. In Safari > Preferences > Extensions, enable Snoozz"
echo ""