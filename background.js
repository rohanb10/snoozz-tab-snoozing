'use strict';

var OPTIONS = {history: 7};
function wakeUpTabs() {
	const NOW = new Date();
	// tab actions
	chrome.storage.local.get(['snoozed', 'snoozedOptions'], s => {
		var ST = s.snoozed
		OPTIONS = Object.assign(OPTIONS, s.snoozedOptions);
		if (!ST || Object.keys(ST).length === 0){
			chrome.alarms.clear('wakeUpTabs');
			return;
		}
		// remove tabs in history if they are more than X days old. X is defined in options
		ST.filter(t => !t.opened && NOW - new Date(t.opened) > parseInt(OPTIONS.history) * 8.64e7)
		
		var earliest = 9999999999999;
		ST.forEach((t, i) => {
			if (t.opened) return;
			if (t.wakeUpTime < earliest) earliest = t.wakeUpTime
			if (NOW > t.wakeUpTime) {
				t.opened = NOW.getTime();
				chrome.tabs.create({url: t.url, active: true}, _ => {
					chrome.notifications.create(t.id, {
						type: 'basic',
						iconUrl: chrome.extension.getURL("icons/popup-icon.png"),
						title: 'A tab woke up!',
						message: `${t.title} -- snoozed on ${formatDate(new Date(t.timeCreated))}`,
					});
					chrome.notifications.onClicked.addListener(_ => chrome.tabs.create({url: 'dashboard/dashboard.html'}))
				});
			}
		});
		chrome.storage.local.set({snoozed: ST});
		if (earliest <= NOW) {
			chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1})
		} else {
			chrome.alarms.create('wakeUpTabs', {when: earliest});
		}
		updateBadge((ST.filter(t => !t.opened)).length);
	});
}

function formatDate(d) {
	return d.toLocaleString('default', {month:'short'}) + ' ' + d.getDate();
}

function updateBadge(num) {
	chrome.browserAction.setBadgeText({text: num > 0 ? num.toString() : ''});
	chrome.browserAction.setBadgeBackgroundColor({color: '#666'});
}

chrome.runtime.onStartup.addListener(_ => chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1}));
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'wakeUpTabs') wakeUpTabs()});