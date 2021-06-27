# Privacy

#### Permissions

Visit the Snoozz website for a more detailed explanation the permissions required:

[https://snoozz.me/privacy.html](https://snoozz.me/privacy.html)

#### Data Collection
Snoozz collects a minimal amount of anonymous tracking data and sends it to an [open source server](https://github.com/rohanb10/snoozz-stats). All data collected can be visualised in full on the [Snoozz Stats](https://snoozz.me/privacy.html) page.

The few lines of code used to send this data can be found in the [`./scripts/poll.js`](https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/scripts/poll.js). The data is initially sent from the `displayPreviewAnimation(...)` function in [`./scripts/popup.js`](https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/scripts/popup.js) to [`./scripts/background.js`](https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/scripts/background.js) using the WebExtension Runtime API `runtime.sendMessage(...)`. It is processed in the background so that the speed of the extension is not compromised in any way

No other data is collected. Your snoozed urls, geolocations, ip addresses and even languages have never, and will never be used in any way.

You can open your Network tab in your Browser inspector and see exactly what is being sent to the server. If you snooze a tab for monday at 4:15pm, the string `monday.1615` will be sent over to the server. That's it.

You may turn this off on the settings page of your extension.