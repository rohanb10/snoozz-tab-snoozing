# Privacy

No data is collected, aggregated or analysed in any way. Not even diagnostic or crash data.

All your tab and window data stays on your machine without any network communication. It is not uploaded anywhere.

This extension is designed to work completely offline. There is no 3rd party or remote code being executed.

## Extension Permissions

#### alarms
- A single alarm is created (and reused) to wake up your tabs at the correct time.
- If no tabs are waking up in the next hour, the alarm is set to be triggered again in an hour.


#### notifications
- Send you notifications when a tab is reopened. (Not critical to use of the extension, you can turn them off at the system level)


#### tabs
- Used to fetch **only** the metadata from your tabs (title, url, favicon). You can review code for this in the `snoozeTab(...)` and `snoozeWindow(...)` functions in [this file](https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/scripts/common.js)
- No metadata is passively recorded - it is only saved when users perform a specific action to snooze a tab or window.


#### storage
- Used to store snoozed tabs and windows. 
- Used to store user preferences which can be configured the settings page.
- Only local storage is used for this extension.
- Old tabs are deleted periodically. You can adjust the frequency of this on the settings page (Default - 14 days after they have woken up).


#### contextMenu
- Used to create the Snoozz submenu in your context menu.
- Only appears when you right click on a link with a valid href attribute. 
- This can be turned off on your settings page. 


#### idle
- When the `idle` state changes to `active`, the extension will open any overdue tabs or recalculate the next alarm time.


#### commands
- Used to configure keyboard shortcuts on compatible browsers. Shortcuts are off by default.


### If you delete this extension, all your data and preferences are deleted with it. It cannot be recovered at all. I’ve tried.
