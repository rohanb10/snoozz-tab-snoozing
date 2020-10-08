# Privacy

No data is collected, aggregated or analysed in any way. All your tab and window data stays on your machine without any remote access. This extension is designed to work completely offline. There is no 3rd party or remote code being executed.

## Extension Permissions

**alarms**
A single alarm is created (and reused) to wake up your tabs at the correct time. 
If you have no tabs snoozed, this alarm is deleted. 


**notifications**
- Send you notifications when a tab is reopened. 
(Not critical to the functioning of the extension, so if you have your notifications turned off that’s perfectly fine.)


**tabs**
- Used to fetch only the metadata from your tabs (title, url, favicon). 
(You can review the code for this [here](https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/scripts/common.js#L108-L142) if you don't believe me)
- This permission is also used to create new tabs/windows when they wake up, and to close them when you put them to sleep. 


**storage**
- Used to store your snoozed tabs, with as little information retained as possible to save those precious kilobytes. 
- Only local storage is used for this extension.
- When a tab/window wakes up, it is added to the ‘History’ section of your dashboard just in case you need to find something you previously snoozed.
- The history is cleared periodically. You can change this on the settings page if you would like to turn this off.


**contextMenu**
- Used to create the Snoozz submenu in your context menu.
- Only appears when you right click on a link with a valid href attribute. 
- This can be turned off on your settings page. 


### If you delete this extension, all your data and preferences are deleted with it. It cannot be recovered. I’ve tried.
