# Using Snoozz with Safari

I'm not paying Apple a hundred bucks a year for the privilege of publishing my free, open source extension in their App Store.

If you want to build your own version of Snoozz for Safari, here's how you do it.

### System Requirements
- Safari 14+
- MacOS 10.14.6+
- Xcode 12+
- Ability to google solutions to a frustrating amount of error codes

### Instructions

 1. Make sure you have Command Line Tools for Xcode installed. You can download it [here](https://developer.apple.com/download/more/).
 2. Download a zip file of this repo.
 
 3. Extract the zip and delete the non-critical folders (`docs/`, `external_assets`).
 4. Convert the extension to an Xcode package using this command. More info [here](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari).
 ```
 xcrun safari-web-extension-converter /path/to/extension
 ```
 5. In Xcode, find and open the `manifest.json` file in the Resources directory.
 6. In `manifest.json`, under the `permissions` key change the permission `tabs` to `activeTab`. (This is to [minimise](https://developer.apple.com/documentation/safariservices/safari_web_extensions/managing_safari_web_extension_permissions) access requests to the user)
 7. [Build and run](https://developer.apple.com/documentation/safariservices/safari_app_extensions/building_a_safari_app_extension#2957926) the extension.
 8. In the newly built app, click on the **Quit and Open Safari Preferences...** button.
 
 9. In Safari, toggle developer mode if it's not on already. **Preferences** > **Advanced** > **Show Develop menu in menu bar**.
 10. Click on the Develop menu at the top, and then enable **Allow Unsigned Extensions** at the bottom of the dropdown. (This will reset everytime you quit Safari. It's dumb, I agree)
 11. Open the **Extensions** Menu in Safari Preferences and enable Snoozz. ([help](https://developer.apple.com/documentation/safariservices/safari_app_extensions/building_a_safari_app_extension#2957925))
 12. Get through all the scary warning menus and then get snoozing.

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
