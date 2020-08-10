'use strict';

const CHOICE_MAP = {
	'today-morning': 'this morning',
	'today-evening': 'this evening',
	'tom-morning': 'tomorrow morning',
	'tom-evening': 'tomorrow evening',
	'weekend': 'this weekend',
	'monday': 'next monday',
	'week': 'next week',
	'month': 'next month',
}

function wakeUpTabs() {
	const NOW = new Date();
	// tab actions
	chrome.storage.local.get(['snoozed', 'snoozedOptions'], s => {
		var ST = s.snoozed
		if (!ST) ST = [];
		EXT_OPTIONS = Object.assign(EXT_OPTIONS, s.snoozedOptions);
		if (Object.keys(ST).length === 0){
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
					chrome.notifications.onClicked.addListener(_ => openURL('dashboard.html'));
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

function setUpContextMenus() {
	chrome.contextMenus.removeAll();
	chrome.storage.local.get(['snoozedOptions'], so => {
		EXT_OPTIONS = Object.assign(EXT_OPTIONS, so.snoozedOptions)
		console.log('context menus setting up', EXT_OPTIONS.contextMenu);
		var choices = EXT_OPTIONS.contextMenu;
		if (choices.length === 0) return;
		if (choices.length === 1) {
			chrome.contextMenus.create({
				title: `Snoozz till ${CHOICE_MAP[choices[0]]}`,
				id: choices[0],
				contexts: ['link']
			});
			return;
		}
		choices.forEach(c => {
			console.log(c);
			chrome.contextMenus.create({
				title: `Snoozz till ${CHOICE_MAP[c]}`,
				id: c,
				contexts: ['link']
			})
		});
		if (window.browser && browser.runtime) {
			chrome.contextMenus.onShown.addListener(updateContextMenuItems);	
		}
	});
}

function updateContextMenuItems() {
	// return if browser is not firefox
	if (!isFirefox) return;
	chrome.storage.local.get(['snoozedOptions'], so => {
		EXT_OPTIONS = Object.assign(EXT_OPTIONS, so.snoozedOptions)
		const NOW = new Date();
		EXT_OPTIONS.contextMenu.forEach(c => {
			var disabled = c === 'today-morning' ? NOW.getHours() >= EXT_OPTIONS.morning : (c === 'today-evening' ? NOW.getHours() >= EXT_OPTIONS.evening : false);
			chrome.contextMenus.update(c, {
				icons: { 16: `icons/${c}.png`},
				enabled: !disabled
			});
		});
		chrome.contextMenus.refresh();
	});
}

chrome.contextMenus.onClicked.addListener(function(item) {
	console.log(item);
	if(!item.menuItemId || !Object.keys(CHOICE_MAP).includes(item.menuItemId)) {
		displayErrorNotification();
		return;
	}

	var config = getTimeForOption(item.menuItemId);

	if (NOW > config.time) {
		displayErrorNotification();
		return;
	}
	chrome.tabs.query({active: true}, tabs => {
		chrome.storage.local.get(['snoozed'], s => {
			s.snoozed = s.snoozed || [];
			s.snoozed.push({
				id: Math.random().toString(36).slice(-6),
				title: getBetterUrl(item.linkUrl),
				url: item.linkUrl,
				favicon: getHostname(item.linkUrl) === getHostname(item.pageUrl) ? tabs[0].favIconUrl :'',
				wakeUpTime: config.time.getTime(),
				timeCreated: (new Date()).getTime(),
			});
			chrome.storage.local.set({snoozed: s.snoozed}, _ => {
				var formattedDate = config.label[0].length > 0 ? 'on ' + config.label[0]: 'today';
				chrome.notifications.create(null, {
					type: 'basic',
					iconUrl: chrome.extension.getURL("icons/main-icon.png"),
					title: 'A new tab is taking a nap',
					message: `${getHostname(item.linkUrl)} will wake up ${formattedDate} at ${config.label[1]}.`,
				});
				chrome.notifications.onClicked.addListener(_ => openURL('dashboard.html'));
			});
		});
	});
});

function displayErrorNotification() {
	chrome.notifications.create(null, {
		type: 'basic',
		iconUrl: chrome.extension.getURL("icons/unknown.png"),
		title: 'Something went wrong :(',
		message: 'No tabs were put to sleep.',
	});
	chrome.notifications.onClicked.addListener(_ => openURL('dashboard.html'));
}

// eg. Jul 18
function formatDate(d) {
	return d.toLocaleString('default', {month:'short'}) + ' ' + d.getDate();
}

chrome.runtime.onInstalled.addListener(_ => {wakeUpTabs(); setUpContextMenus()});
chrome.runtime.onStartup.addListener(_ => {wakeUpTabs(); setUpContextMenus()});
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'wakeUpTabs') wakeUpTabs()});