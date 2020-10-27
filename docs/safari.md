# Using Snoozz with Safari

<div align="center">
	<img src="https://i.imgur.com/wzYR5gz.png" alt="Snoozz x Safari">
</div>

I'm not paying Apple a hundred bucks a year for the privilege of publishing my free, open source extension in their App Store.

If you want to build your own version of Snoozz for Safari, here's how you do it.

### Requirements
- MacOS 10.14.6+
- Xcode 12+
- [Command Line Tools]((https://developer.apple.com/download/more/)) for Xcode
- Latest [release](https://github.com/rohanb10/snoozz-tab-snoozing/releases/tag/v2.3.0) of Snoozz
- Safari 14+
	- Show **Developer** menu in **Safari** > **Preferences** > **Advanced**
	- Allow [Unsigned Extensions](https://i.imgur.com/4l1piHd.png) in the **Develop** menu

### Instructions

 1. Convert the extension to an Xcode package using this command. More info [here](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari).
 ```
 	xcrun safari-web-extension-converter /path/to/extension
 ```
 2. In Xcode, find and open the `manifest.json` file in the `Resources/` directory.
 3. In `manifest.json`, under the `permissions` key change the permission `tabs` to `activeTab`. (This is to [minimise](https://developer.apple.com/documentation/safariservices/safari_web_extensions/managing_safari_web_extension_permissions) access requests to the user)
 4. [Build and run](https://developer.apple.com/documentation/safariservices/safari_app_extensions/building_a_safari_app_extension#2957926) the extension.
 5. Quit the newly built Snoozz app. Open **Safari** > **Preferences** > **Extensions** and enable Snoozz.
 6. Get through all the scary warning menus and then get snoozing.

### What's broken ?
- **Snoozing windows**
	This requires the `tabs` permission. If I ask for that permission, you will see a privacy popup every single time you try to snooze a website you have not snoozed before.

- **Notifications**
	Safari does not support the notifications API.
- **Keyboard Shortcuts**
	Safari does not let you configure your own keyboard shortcuts.
- **Unpredictable wake up delays**
	Safari does not support the idle API. It is used to calculate the next tab to wake up after your computer comes back from standby.
- **Terrible input for "Choose your own time" in the popup menu**
	Safari does not have custom panels for date and time inputs. Fallbacks to a simple (ugly) text field.
- **UI bugs**
	This extension was designed for Chrome and Firefox, so things might look a bit off because Safari is slow to support the latest and greatest CSS and JS changes.
