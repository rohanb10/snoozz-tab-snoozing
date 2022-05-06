## Roadmap
*In no particular order*
- Recurring snoozes
- Cloud sync
- Make contextMenu + allTabs permissions optional
- Make accessibile

PRs and other ideas are welcome.

## Changes ##
**May 2022**
#### 2.5.1
- New Theme - Hats
- Notification Sounds
- Incognito / Private Browser Support
- Local File Support (Blink browsers only)

**October 2021**
#### 2.5
- Recurring Snooze Times!
- Duplicate Sleeping Tabs
- Selected Tabs grouped together
- Keyboard Shortcuts in the Popup
- Hide sections in the Nap Room
- Snooze other extension / add-on pages
- "System" option for selecting a dark/light theme

**June 2021**
#### 2.4.4.3
- Start sending snooze times to analytics server

#### 2.4.4.2
- New setting to specify what day the week starts on
- Fix keyboard navigation in the popup (inlcuding new morning/evening/now dropdowns)
- Fix missing "Mon", "Tue" etc in the popup calendar

#### 2.4.4
- Use minutes in your 'Morning' and 'Evening' times (Can set as 8:45am instead of 9:00am)
- Choose 'Morning', 'Evening' or 'Now' times directly from the Snoozz popup, right click menu, and key bindings
- Update Animal icons to be more consistent
- Snoozz will now wait for a network connection before reopening tabs after your device wakes up

#### 2.4.3
- Enable / Disable notifications from the settings page
- Stop saving favicons in storage and lazily fetch them instead via DuckDuckGo when displaying in the Nap Room
- Count selected choices and display data publicly on [Snoozz Stats](https://snoozz.me/stats.html)
- Reduce overall file size

**May 2021**
#### 2.4.2.1
- Bug fixes in the Nap Room

#### 2.4.2 
- Introducing Icon Themes - Starting with a shiny new Animal theme. Change your theme on the Settings page.
- Setting to choose between 12 Hour / 24 Hour time formats
- Open links from the Nap Room without waking up a tab
- Bug fixes on the Rise and Shine page

#### 2.4.1 
- show number of search results in the nap room
- misc ui related fixes

#### 2.4.0
- Edit Snoozz times for sleeping tabs 🎉
- Snooze Again for awoken tabs
- New Date and Time picker for custom snooze time selection
- Snooze selected tabs (and a new UI for selecting snooze targets)
- New options: "One Hour From Now" and "On Next Startup"
- Change "Dashboard" to "Nap Room"
- Export and Smart Import tabs to use across different devices (No duplicates, the most recently updated tab will be saved to your device)

**January 2021**
#### 2.3.3
- Make entire extension keyboard navigable
- Improve dashboard performance
- Change notification click actions

**November 2020**
#### 2.3.2.1 and 2.3.2.2
- Critical bug hotfixes released within 24 hours of 2.3.2

#### 2.3.2
- Multiple tabs/windows waking up bug fix 🤞
- Confirmation when changing history setting
snooze in background hotfix

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