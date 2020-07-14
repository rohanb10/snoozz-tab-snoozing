'use strict';

var EXT_OPTIONS = {history: 7, morning: 9, evening: 18, badge: 'today'};
function wakeUpTabs() {
	const NOW = new Date();
	// tab actions
	chrome.storage.local.get(['snoozed', 'snoozedOptions'], s => {
		var ST = s.snoozed
		if (!ST) ST = [];
		EXT_OPTIONS = Object.assign(EXT_OPTIONS, s.snoozedOptions);
		if (!ST || Object.keys(ST).length === 0){
			chrome.alarms.clear('wakeUpTabs');
			return;
		}
		// remove tabs in history if they are more than X days old. X is defined in options
		ST.filter(t => !t.opened && NOW - new Date(t.opened) > parseInt(EXT_OPTIONS.history) * 8.64e7)
		
		var earliest = 9999999999999;
		ST.forEach((t, i) => {
			if (t.opened) return;
			if (t.wakeUpTime < earliest) earliest = t.wakeUpTime
			if (NOW > t.wakeUpTime) {
				t.opened = NOW.getTime();
				chrome.tabs.create({url: t.url, active: true}, _ => {
					chrome.notifications.create(t.id, {
						type: 'basic',
						iconUrl: chrome.extension.getURL("icons/main-icon.png"),
						title: 'A tab woke up!',
						message: `${t.title} -- snoozed on ${formatDate(new Date(t.timeCreated))}`,
					});
					chrome.notifications.onClicked.addListener(_ => {
						chrome.tabs.query({currentWindow: true, title: 'dashboard | snoozz'}, dashboardTabs => {
							chrome.tabs.query({currentWindow: true, title: 'settings | snoozz'}, settingsTabs => {
								var tabs = dashboardTabs.concat(settingsTabs);
								if (tabs.length === 0) {chrome.tabs.create({url: url});return;}
								var openTabID = tabs.findIndex(t => t.active === true);
								var openTab = openTabID ? tabs.splice(openTabID, 1).pop() : tabs.shift();
								if (tabs.length > 0) chrome.tabs.remove(tabs.map(t => t.id));
								chrome.tabs.update(openTab.id, {url: , active: true});
							});
						});
					});
				});
			}
		});
		chrome.storage.local.set({snoozed: ST, snoozedOptions: EXT_OPTIONS});
		if (earliest <= NOW) {
			chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1})
		} else if (earliest !== 9999999999999) {
			chrome.alarms.create('wakeUpTabs', {when: earliest});
		} else {
			chrome.alarms.clear('wakeUpTabs');
		}
		updateBadge(ST);
	});
}

// eg. Jul 18
function formatDate(d) {
	return d.toLocaleString('default', {month:'short'}) + ' ' + d.getDate();
}

function isToday(d) {
	const NOW = new Date();
	return (NOW.getFullYear() === d.getFullYear() && NOW.getMonth() === d.getMonth() && NOW.getDate() === d.getDate())
}

function updateBadge(tabs) {
	var num = 0;
	if (tabs.length > 0 && EXT_OPTIONS.badge && EXT_OPTIONS.badge === 'all') num = tabs.filter(t => !t.opened).length;
	if (tabs.length > 0 && EXT_OPTIONS.badge && EXT_OPTIONS.badge === 'today') num = tabs.filter(t => !t.opened && isToday(new Date(t.wakeUpTime))).length;
	chrome.browserAction.setBadgeText({text: num > 0 ? num.toString() : ''});
	chrome.browserAction.setBadgeBackgroundColor({color: '#CF5A77'});
}

chrome.runtime.onInstalled.addListener(_ => {wakeUpTabs()});
chrome.runtime.onStartup.addListener(_ => {wakeUpTabs()});
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'wakeUpTabs') wakeUpTabs()});