## Roadmap
*In no particular order*
- Cloud sync
- Firefox date + time picker for popup
- Make contextMenu permission optional
- Custom notifications on dashboard instead of native ?
- Edit snooze times (maybe a snoozz again / recurring feature?)
- Make accessibile
- Tab groups (Chrome only) (if API ever opens up)
- Favicon compression

PRs and other ideas welcome.

## Changes ##

**November 2020**
#### 2.3.1
- Dark mode 🌚
- Visualise available storage on the settings page
- Add option to select time as "now" for [monday, weekend, next-week, next-month]
- Webkit specific changes. [See how](https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/docs/safari.md) to build for Safari (not distributed through app store)

**October 2020**
#### 2.3.0
- First release on Microsoft Edge 🎉
- Add Search to the Dashboard -> `urls | titles | snooze date | wake up date | day of week | month | relative time | snoozz state`
- Add live clock css/js animation to the Dashboard when no tabs are found.
- Onboarding instructions UI on the Dashboard (shown when no tabs in storage).
- Change copy on settings page to make easier to comprehend.
- Tabs opening twice and other misc bug fixes.
- Firefox popup "choose your own time" style changes.

#### 2.2.0
- Keyboard Shortcuts
- Add setting to change default time for [monday, weekend, next-week, next-month] from morning to evening
- Bug fixes, minor UI adjustments

#### 2.1.2
- Change the Snoozz logo font (Slightly modified version of Bungee by [David Jonathan Ross](https://djr.com/))
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