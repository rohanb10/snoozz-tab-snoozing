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
- <details><summary>Safari 14+</summary>
	- Show **Developer** menu in **Safari** > **Preferences** > **Advanced**
	- Allow [Unsigned Extensions](https://i.imgur.com/4l1piHd.png) in the **Develop** menu</details>


<details><summary>Latest release of [Snoozz for Safari](https://github.com/rohanb10/snoozz-tab-snoozing/releases/latest) v2.3.1+</summary>
	There is only one small difference between the Safari release and the regular release. The `tabs` permission is replaced with `activeTab` in the manifest [to minimise](https://developer.apple.com/documentation/safariservices/safari_web_extensions/managing_safari_web_extension_permissions) access requests to the user.
</details>



### Instructions

1. In Terminal, navigate to the unzipped Snoozz directory and convert the extension to an Xcode package using this command. [More info](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari) on all the extra options/flags.
```
	xcrun safari-web-extension-converter . --app-name "Snoozz for Safari"  --bundle-identifier com.snoozeman.snoozz --swift --force
```

2. [Build and run](https://developer.apple.com/documentation/safariservices/safari_app_extensions/building_a_safari_app_extension#2957926) the extension.

3. Quit the newly built Snoozz app. Open **Safari** > **Preferences** > **Extensions** and enable Snoozz.

4. Get through all the scary warning menus and then get snoozing.

### What's broken ?
- **Snoozing windows:**
	This requires the `tabs` permission. If I ask for that permission, you will see a privacy popup every single time you try to snooze a website you have not snoozed before.

- **Notifications:**
	Safari does not support the notifications API.
- **Keyboard Shortcuts:**
	Safari does not let you configure your own keyboard shortcuts.
- **Unpredictable wake up delays:**
	Safari does not support the idle API. It is used to calculate the next tab to wake up after your computer comes back from standby.
- **Shit input for "Choose your own time" in the popup menu:**
	Safari does not have custom panels for date and time inputs. Fallbacks to a simple (ugly) text field with no validation UI.
- **UI bugs:**
	This extension was designed for Chrome and Firefox, so things might look a teeny bit off.
    
Find anything else broken? Leave a [bug report](https://github.com/rohanb10/snoozz-tab-snoozing/issues/new/choose). It would be extremely helpful if you could [open up the logs](https://i.imgur.com/9xYn5Ll.png) and give me [an error code](https://i.imgur.com/B6YJjJD.png) (screenshot or copy/paste, either is fine)
