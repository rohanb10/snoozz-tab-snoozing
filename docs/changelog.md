## Roadmap
*In no particular order*
- Cloud sync
- Edit snooze times
- Search dashboard
- Make accessibile
- See storage used and add instructions to delete old tabs
- Tab groups (Chrome only) (if API ever opens up)
- Favicon compression and offline storage

PRs and other ideas welcome.

## Changes ##

**October 2020**
#### 2.1.2
- Make use of the Idle API for more reliable waking up of tabs and windows
- Allow UI animation when closing a popup to be customised in the settings menu
- Show snoozz contextmenu when clicking on a tab in the tab bar (FF only)
- Show icons in contextmenu and disable icons that are invalid (FF only)
- Restructure files in repository

**September 2020**
#### 2.1.1
- Fix trailing span on the rise and shine page

#### 2.1.0
- Firefox Specific Changes
- Make setting/getting options more secure and efficient

#### 2.0.0
- Major rewrite of almost the entire codebase
- Ability to snooze entire windows
- Transition from native JS dates to the lightweight Day.js library.
- Context menu snoozing
- Support for pinned tabs
- Make the choices in the popup modular so they can be used for editing UI in the future
- More reliable history purging
- Ability to manually wake up a tab at any time.
- Convert all settings into select menus for better reliability


**August 2020**
#### 1.3.0
- Add right click option for snoozing
- Change unknown tab icon
- Fix history not clearing on dashboard


**July 2020**
#### 1.2.1
- Merge firefox and chrome codebases into one

#### 1.2.0
- Migrate extension to firefox
- Refresh dashboard in background if any tabs are snoozed / woken up

#### 1.1.1
- Prevent multiple instances of settings/dashboard page from being open in one window

#### 1.1.0
- Add ability to change (or disable) the number icon on the toolbar

#### 1.0.2
- Fix notification bug when reopening tab

#### 1.0.2
- Fix option to change history deletion duration 

#### 1.0.1
- Fix error on startup with no settings initialized in local storage