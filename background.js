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

chrome.runtime.onMessage.addListener((msg, sender, resp) => {
	if (msg.closeTabInBg) setTimeout(_ => chrome.tabs.remove(msg.tabId), 2100);
	if (msg.closeWindowInBg) setTimeout(_ => chrome.windows.remove(msg.windowId), 2100);
})

async function checkAlarms() {
	console.log('checking alarms', new Date());
	var tabs = await getStored('snoozed');
	tabs = tabs.filter(t => !t.opened);
	if (!tabs || tabs.length === 0) {chrome.alarms.clear('wakeUpTabs'); return}

	var earliest = tabs.reduce((t1,t2) => t1.wakeUpTime < t2.wakeUpTime ? t1.wakeUpTime : t2.wakeUpTime);
	// if earliest time is before now, wake up some tabs
	if (earliest < new Date().getTime()) {wakeUpTabs(); return}
	// if earliest time is more than an hour away, set an alarm for an hour from now
	earliest = dayjs(earliest) < dayjs().add(1, 'hour') ? earliest : dayjs().add(1, 'hour').valueOf();
	chrome.alarms.create('wakeUpTabs', {when: earliest});
}

async function wakeUpTabs() {
	const NOW = new Date()
	var tabs = await getStored('snoozed');
	tabs.filter(t => !t.opened && t.wakeUpTime < NOW).forEach(t => {
		t.opened = dayjs().valueOf()
		openRegTab(t, true);
	})
	updateBadge(tabs);
	await saveTabs(tabs);
	// check alarms again to set the next earliest time
	await checkAlarms();
}

function destroyContextMenus() {
	chrome.contextMenus.removeAll();
}

async function setUpContextMenus2() {
	destroyContextMenus();
	var storage = await getStored('snoozedOptions');
	console.log('setting up cmenus', storage.contextMenu);
	if (storage.contextMenu.length === 0) return;
	var CHOICE_MAP = getChoices();
	storage.contextMenu.forEach(o => {
		chrome.contextMenus.create({
			id: o,
			contexts: ['link'],
			title: `Snooze till ${CHOICE_MAP[o].label.toLowerCase()}`
		});
	})
}

function setUpContextMenus() {
	return;
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
		if (window.chrome && chrome.runtime) {
			// chrome.contextMenus.onShown.addListener(updateContextMenuItems);	
		}
	});
}

chrome.contextMenus.onClicked.addListener(contextMenuClickHandler)

async function contextMenuClickHandler(item) {
	var CHOICE_MAP = getChoices();
	console.log(item, CHOICE_MAP[item.menuItemId]);
	if (!CHOICE_MAP[item.menuItemId]) {
		console.log('wtf');	
	}
	var snoozeTime = CHOICE_MAP[item.menuItemId].time;
	if (CHOICE_MAP[item.menuItemId].disabled || dayjs().isAfter(snoozeTime)){
		createNotification(null, `Can't snooze that link :(`, 'icons/unknown.png', 'The time you selected is in the past.');
		return;
	}
	console.log('here',CHOICE_MAP[item.menuItemId], snoozeTime);
	return;
	var activeTab = await getTabs(true);
	var maybeFavicon = getHostname(activeTab.url) === getHostname(item.linkUrl) ? activeTab.favIconUrl: '';
	var snoozeTab = {
		id: Math.random().toString(36).slice(-6),
		title: getBetterUrl(item.linkUrl),
		url: item.linkUrl,
		wakeUpTime: snoozeTime,
		favicon: maybeFavicon,
		timeCreated: dayjs().valueOf(),
	}
	await saveTab(snoozeTime);
	var msg = `${getHostname(item.linkUrl)} will wake up at ${snoozeTime.format('h:mm a [on] ddd, D MMM')}.`
	sendNotification('A new tab is now napping :)', 'icons/main-icon.png', msg, 'dashboard.html');
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

// chrome.contextMenus.onClicked.addListener(function(item) {
// 	console.log(item);
// 	if(!item.menuItemId || !Object.keys(CHOICE_MAP).includes(item.menuItemId)) {
// 		displayErrorNotification();
// 		return;
// 	}

// 	var config = getTimeForOption(item.menuItemId);

// 	if (NOW > config.time) {
// 		displayErrorNotification();
// 		return;
// 	}
// 	chrome.tabs.query({active: true}, tabs => {
// 		chrome.storage.local.get(['snoozed'], s => {
// 			s.snoozed = s.snoozed || [];
// 			s.snoozed.push({
// 				id: Math.random().toString(36).slice(-6),
// 				title: getBetterUrl(item.linkUrl),
// 				url: item.linkUrl,
// 				favicon: getHostname(item.linkUrl) === getHostname(item.pageUrl) ? tabs[0].favIconUrl :'',
// 				wakeUpTime: config.time.getTime(),
// 				timeCreated: (new Date()).getTime(),
// 			});
// 			chrome.storage.local.set({snoozed: s.snoozed}, _ => {
// 				var formattedDate = config.label[0].length > 0 ? 'on ' + config.label[0]: 'today';
// 				chrome.notifications.create(null, {
// 					type: 'basic',
// 					iconUrl: chrome.extension.getURL("icons/main-icon.png"),
// 					title: 'A new tab is taking a nap',
// 					message: `${getHostname(item.linkUrl)} will wake up ${formattedDate} at ${config.label[1]}.`,
// 				});
// 				chrome.notifications.onClicked.addListener(_ => openExtTab('dashboard.html'));
// 			});
// 		});
// 	});
// });

function displayErrorNotification() {
	chrome.notifications.create(null, {
		type: 'basic',
		iconUrl: chrome.extension.getURL("icons/unknown.png"),
		title: 'Something went wrong :(',
		message: 'No tabs were put to sleep.',
	});
	chrome.notifications.onClicked.addListener(_ => openExtTab('dashboard.html'));
}

chrome.runtime.onInstalled.addListener(_ => {wakeUpTabs(); setUpContextMenus()});
chrome.runtime.onStartup.addListener(_ => {wakeUpTabs(); setUpContextMenus()});
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'wakeUpTabs') wakeUpTabs()});