function getBrowser() {
	if (!!navigator.userAgent.match(/safari/i) && !navigator.userAgent.match(/chrome/i) && typeof document.body.style.webkitFilter !== 'undefined') return 'safari';
	if (!!window.sidebar) return 'firefox';
	return 'chrome';
}
/*	ASYNCHRONOUS FUNCTIONS	*/
/*	GET 	*/
async function getSnoozedTabs(ids) {
	var p = await new Promise(r => chrome.storage.local.get('snoozed', r));
	if (!p.snoozed) return [];
	if (!ids || (ids.length && ids.length === 0)) return p.snoozed;
	var found = p.snoozed.filter(s => s.id && (ids.length ? ids.includes(s.id) : ids === s.id));
	return found.length === 1 ? found[0] : found;
}
async function getOptions(keys) {
	var p = await new Promise(r => chrome.storage.local.get('snoozedOptions', r));
	if (!p.snoozedOptions) return [];
	if (!keys) return p.snoozedOptions;
	if (typeof keys === 'string') return p.snoozedOptions[keys];
	return Object.keys(p.snoozedOptions).filter(k => keys.includes(k)).reduce((o, k) => {o[k] = p.snoozedOptions[k];return o},{});
	
}
async function getTabsInWindow(active) {
	if (getBrowser() === 'safari') active = true;
	var p = new Promise(r => chrome.tabs.query({active: active, currentWindow: true}, r));
	if (!active) return p;
	var tabs = await p;
	return tabs[0];
}
async function getAllWindows() {
	return new Promise(r => chrome.windows.getAll({windowTypes: ['normal']}, r));
}
async function getTabId(url) {
	var tabsInWindow = await getTabsInWindow();
	if (!tabsInWindow.length) tabsInWindow = [tabsInWindow];
	var foundTab  = tabsInWindow.find(t => t.url === url);
	return foundTab ? parseInt(foundTab.id) : false; 
}
async function findTabAnywhere(url, tabDBId) {
	var wins = await getAllWindows(), found = false;
	if (!wins || !wins.length) return found;
	for (var wid of wins.map(w => w.id)) {
		if (found) return;
		var tabs = await new Promise(r => chrome.tabs.query({windowId: wid}, r));
		if (url && tabs && tabs.some(t => t.url === url)) return found = tabs.find(t => t.url === url);
		if (!url && tabdDBId && tabs && tabs.some(t => t.url.indexOf(tabDBId) > -1)) return found = tabs.find(t => t.url.indexOf(tabDBId) > -1);
	}
	return found;
}
async function getKeyBindings() {
	if (!chrome.commands) return [];
	return new Promise(r => chrome.commands.getAll(r));
}
async function getStorageSize() {
	if (getBrowser() !== 'firefox') return new Promise(r => chrome.storage.local.getBytesInUse(r));
	var tabs = await getSnoozedTabs();
	var options = await getOptions();
	return calcObjectSize(tabs) + calcObjectSize(options);
}

/*	SAVE 	*/
async function saveOptions(o) {
	if (!o) return;
	return new Promise(r => chrome.storage.local.set({'snoozedOptions': o}, r));
}
async function saveTab(t) {
	if (!t) return;
	var tabs = await getSnoozedTabs();
	if (tabs.some(tab => tab.id === t.id)) {
		tabs[tabs.findIndex(tab => tab.id === t.id)] = t;
	} else {
		tabs.push(t);
	}
	await saveTabs(tabs);
}
async function saveTabs(tabs) {
	if (!tabs) return;
	return new Promise(r => chrome.storage.local.set({'snoozed': tabs}, r));
}
/*	CREATE 	*/
async function createAlarm(when, willWakeUpATab) {
	bgLog(['Next Alarm at', dayjs(when).format('HH:mm:ss DD/MM/YY')], ['', willWakeUpATab ? 'yellow':'white'])
	await chrome.alarms.create('wakeUpTabs', {when});
}
async function createNotification(id, title, imgUrl, message, force) {
	var n = typeof SAVED_OPTIONS !== 'undefined' && SAVED_OPTIONS.notifications ? SAVED_OPTIONS.notifications : await getOptions('notifications');
	if (!chrome.notifications || (n && n === 'off' && !force)) return;
	await chrome.notifications.create(id, {type: 'basic', iconUrl: chrome.extension.getURL(imgUrl), title, message});
}
async function createWindow(tabId) {
	return new Promise(r => chrome.windows.create({url: `/html/rise-and-shine.html#${tabId}`}, r));
}

/*	CONFIGURE	*/

async function setTheme() {
	var t = await getOptions('theme');
	document.body.classList.toggle('dark', t === 'dark');
}
setTheme();

var HOUR_FORMAT = 12;
async function fetchHourFormat() {
	var t = await getOptions('hourFormat');
	HOUR_FORMAT = t && [24, 12].includes(t) ? t : 12;
}

async function updateBadge(cachedTabs, cachedBadge) {
	var num = 0;
	var badge = cachedBadge || await getOptions('badge');
	var tabs = cachedTabs || await getSnoozedTabs();
	tabs = sleeping(tabs);
	if (tabs.length > 0 && badge && ['all','today'].includes(badge)) num = badge === 'today' ? today(tabs).length : tabs.length;
	chrome.browserAction.setBadgeText({text: num > 0 ? num.toString() : ''});
	chrome.browserAction.setBadgeBackgroundColor({color: '#0072BC'});
}

/*	OPEN 	*/

// open tab for an extension page
async function openExtensionTab(url) {
	if (getBrowser() === 'safari') url = chrome.runtime.getURL(url);
	var tabs = await getTabsInWindow();
	if (getBrowser() === 'safari' && !tabs.length) tabs = [tabs];
	var extTabs = tabs.filter(t => isDefault(t));
	if (extTabs.length === 1){chrome.tabs.update(extTabs[0].id, {url, active: true})}
	else if (extTabs.length > 1) {
		var activeTab = extTabs.some(et => et.active) ? extTabs.find(et => et.active) : extTabs.reduce((t1, t2) => t1.index > t2.index ? t1 : t2);
		chrome.tabs.update(activeTab.id, {url, active: true});
		chrome.tabs.remove(extTabs.filter(et => et !== activeTab).map(t => t.id))		
	} else {
		var activeTab = tabs.find(t => t.active);
		if (activeTab && ['New Tab', 'Start Page'].includes(activeTab.title)) {chrome.tabs.update(activeTab.id, {url})}
		else {chrome.tabs.create({url})}
	}
}

async function openTab(tab, windowId, automatic = false) {
	var windows = await getAllWindows();
	if (!windows || !windows.length) {
		await new Promise(r => chrome.windows.create({url: tab.url}, r));
	} else {
		await new Promise(r => chrome.tabs.create({url: tab.url, active: false, pinned: tab.pinned, windowId}, r));	
	}
	if (!automatic) return;
	var msg = `${tab.title} -- snoozed ${dayjs(tab.timeCreated).fromNow()}`;
	createNotification(tab.id, 'A tab woke up!', 'icons/logo.svg', msg);
}

async function openWindow(t, automatic = false) {
	var targetWindowID, currentWindow = await getTabsInWindow();
	if (currentWindow.length && currentWindow.filter(isDefault).length === currentWindow.length) {
		await openExtensionTab(`/html/rise-and-shine.html#${t.id}`);
		targetWindowID = currentWindow[0].windowId;
	} else {
		var window = await createWindow(t.id);
		targetWindowID = window.id;
	}

	// send message to map browser tabs to tab-list in rise-and-shine.html
	var loadingCount = 0;
	chrome.tabs.onUpdated.addListener(async function cleanTabsAfterLoad(id, state, title) {
		if (loadingCount > t.tabs.length) {
			chrome.runtime.sendMessage({startMapping: true});
			chrome.tabs.onUpdated.removeListener(cleanTabsAfterLoad)
		}
		if (state.status === 'loading' && state.url) loadingCount ++;
	});

	for (var s of t.tabs) await openTab(s, targetWindowID);
	chrome.windows.update(targetWindowID, {focused: true});
	
	if (!automatic) return;
	var msg = `This window was put to sleep ${dayjs(t.timeCreated).fromNow()}`;
	createNotification(t.id, 'A window woke up!', 'icons/logo.svg', msg);
	return;
}

async function editSnoozeTime(tabId, snoozeTime) {
	var t = await getSnoozedTabs(tabId);
	delete t.startUp;
	delete t.opened;
	delete t.deleted;
	t.wakeUpTime = snoozeTime === 'startup' ? dayjs().add(20, 'y').valueOf() : dayjs(snoozeTime).valueOf(),
	t.modifiedTime = dayjs().valueOf();
	if (snoozeTime === 'startup') t.startUp = true;
	await saveTab(t);
	return {edited: true}
}

/*		SNOOZING 	*/
async function snoozeTab(snoozeTime, overrideTab) {
	var activeTab = overrideTab || await getTabsInWindow(true);
	if (!activeTab || !activeTab.url) return {};
	var sleepyTab = {
		id: [...Array(16)].map(() => Math.random().toString(36)[2]).join(''),
		title: activeTab.title ?? getBetterUrl(activeTab.url),
		url: activeTab.url,
		...activeTab.pinned ? {pinned: true} : {},
		wakeUpTime: snoozeTime === 'startup' ? dayjs().add(20, 'y').valueOf() : dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
	}
	if (snoozeTime === 'startup') sleepyTab.startUp = true;
	await saveTab(sleepyTab);
	chrome.runtime.sendMessage({logOptions: ['tab', sleepyTab, snoozeTime]});
	var tabId = activeTab.id || await getTabId(activeTab.url);
	return {tabId, tabDBId: sleepyTab.id}
}

async function snoozeWindow(snoozeTime, isAGroup) {
	var tabsInWindow = await getTabsInWindow();
	var validTabs = tabsInWindow.filter(t => !isDefault(t) && isValid(t));
	if (validTabs.length === 0) return {};
	if (validTabs.length === 1) {
		await snoozeTab(snoozeTime, validTabs[0])
		return {windowId: tabsInWindow.find(w => w.active).windowId};
	}

	var sleepyGroup = {
		id: Math.random().toString(36).slice(-10),
		wakeUpTime: snoozeTime === 'startup' ? dayjs().add(20, 'y').valueOf() : dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
	}
	if (snoozeTime === 'startup') sleepyGroup.startUp = true;

	if (isAGroup && false) {
	// if (isAGroup && chrome.tabGroups) {
		var active = tabsInWindow.find(t => t.active && t.groupId);
	} else {
		sleepyGroup = Object.assign(sleepyGroup, {
			title: `${getTabCountLabel(validTabs)} from ${getSiteCountLabel(validTabs)}`,
		});
	}

	sleepyGroup = Object.assign(sleepyGroup, {
		tabs: validTabs.map(t => ({
			title: t.title,
			url: t.url,
			...t.pinned ? {pinned: true} : {}
		}))
	});
	await saveTab(sleepyGroup);
	if (isAGroup) {
		chrome.runtime.sendMessage({logOptions: ['group', sleepyGroup, snoozeTime]});	
		return {tabId: tabsInWindow.filter(t => t.groupId && t.groupId === active.groupId).map(t => t.id)}
	} else {
		chrome.runtime.sendMessage({logOptions: ['window', sleepyGroup, snoozeTime]});	
		return {windowId: tabsInWindow.find(w => w.active).windowId};
	}	
}

async function snoozeSelectedTabs(snoozeTime) {
	var tabsInSelection = await getTabsInWindow();
	tabsInSelection = tabsInSelection.filter(t => t.highlighted && !isDefault(t) && isValid(t));
	if (tabsInSelection.length === 0) return {};
	var tabsToClose = []
	for (var t of tabsInSelection) {
		var response = await snoozeTab(snoozeTime, t);
		if (response && response.tabId) tabsToClose.push(response.tabId);
	}
	return {tabId: tabsToClose}
}

async function getTimeWithModifier(choice) {
	var c = await getChoices([choice])
	var options = await getOptions(['morning', 'evening', 'popup']);
	var modifier = options.popup ? options.popup[choice] : '';
	options = upgradeSettings(options);
	var m = options[modifier] ?? [dayjs().hour(), dayjs().minute()];
	return dayjs(c.time).add(m[0], 'h').add(m[1], 'm');
}

async function getChoices(which) {
	var NOW = dayjs();
	var config = await getOptions(['morning', 'evening']);
	if (typeof config.morning === 'number' || typeof config.evening === 'number') config = upgradeSettings(config);
	var all = {
		'startup': {
			label: 'On Next Startup',
			repeatLabel: 'Every Browser Startup',
			startUp: true,
			time: NOW.add(20, 'y'),
			timeString: '',
			repeatTime: '',
			repeatTimeString: '',
			menuLabel: 'till next startup'
		},
		'in-an-hour': {
			label: 'In One Hour',
			repeatLabel: 'Every hour',
			time: NOW.add(1, 'h'),
			timeString: NOW.add(1, 'h').dayOfYear() == NOW.dayOfYear() ? 'Today' : 'Tomorrow',
			repeatTime: NOW.add(1, 'h').format(getHourFormat(true)),
			repeatTimeString: `Starts at`,
			repeat: {operation: 'add', amount: 1, type: 'h'},
			menuLabel: 'for an hour'
		},
		'today-morning': {
			label: 'This Morning',
			repeatLabel: '-',
			time: NOW.startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm'),
			timeString: 'Today',
			repeatTime: '',
			repeatTimeString: '',
			disabled: NOW.startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm').valueOf() < dayjs(),
			repeatDisabled: true,
			menuLabel: 'till this morning'
		},
		'today-evening': {
			label: `Today ${getEveningLabel(config.evening[0])}`,
			repeatLabel: `Everyday`,
			time: NOW.startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm'),
			timeString: 'Today',
			repeatTime: NOW.format(getHourFormat(true)),
			repeatTimeString: 'Starts Tom At',
			repeat: {operation: 'add', amount: 1, type: 'h'},
			disabled: NOW.startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm').valueOf() < dayjs(),
			menuLabel: 'till this evening'
		},
		'tom-morning': {
			label: 'Tomorrow Morning',
			repeatLabel: 'Every Morning',
			time: NOW.startOf('d').add(1,'d').add(config.morning[0], 'h').add(config.morning[1], 'm'),
			timeString: NOW.add(1,'d').format('ddd, D MMM'),
			repeatTime: NOW.startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm').format(getHourFormat(true)),
			repeatTimeString: `Starts ${NOW < NOW.startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm') ? 'Today' : 'Tom'} at`,
			menuLabel: 'till tomorrow morning'
		},
		'tom-evening': {
			label: `Tomorrow ${getEveningLabel(config.evening[0])}`,
			repeatLabel: `Every ${getEveningLabel(config.evening[0])}`,
			time: NOW.startOf('d').add(1,'d').add(config.evening[0], 'h').add(config.evening[1], 'm'),
			timeString: NOW.add(1,'d').format('ddd, D MMM'),
			repeatTime: NOW.startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm').format(getHourFormat(true)),
			repeatTimeString: `Starts ${NOW < NOW.startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm') ? 'Today' : 'Tom'} at`,
			menuLabel: 'till tomorrow evening'
		},
		'weekend': {
			label: 'Weekend',
			repeatLabel: 'Every Weekend',
			time: NOW.startOf('d').weekday(6),
			timeString: NOW.weekday(6).format('ddd, D MMM'),
			repeatTime: NOW.startOf('d').format(getHourFormat(true)),
			repeatTimeString: `${NOW.weekday(6).format('dddd')}s at`,
			disabled: NOW.day() === 5,
			menuLabel: 'till the weekend'
		},
		'monday': {
			label: 'Next Monday',
			repeatLabel: 'Every Monday',
			time: NOW.startOf('d').weekday(NOW.startOf('d') < dayjs().startOf('d').weekday(1) ? 1 : 8),
			timeString: NOW.weekday(NOW.startOf('d') < dayjs().startOf('d').weekday(1) ? 1 : 8).format('ddd, D MMM'),
			repeatTime: NOW.startOf('d').format(getHourFormat(true)),
			repeatTimeString: `${NOW.weekday(1).format('dddd')}s at`,
			menuLabel: 'till next Monday'
		},
		'week': {
			label: 'Next Week',
			repeatLabel: 'Every week',
			time: NOW.startOf('d').add(1, 'week'),
			timeString: NOW.startOf('d').add(1, 'week').format('D MMM'),
			repeatTime: NOW.format(getHourFormat(true)),
			repeatTimeString: `${NOW.format('dddd')}s at` ,
			menuLabel: 'for a week'
		},
		'month': {
			label: 'Next Month',
			repeatLabel: 'Every Month',
			time: NOW.startOf('d').add(1, 'M'),
			timeString: NOW.startOf('d').add(1, 'M').format('D MMM'),
			repeatTime: NOW.format(getHourFormat(true)),
			repeatTimeString: `${NOW.format('Do')} of Month`,
			menuLabel: 'for a month'
		},
	}
	return which && all[which] ? all[which] : all;
}

async function calculateNextSnoozeTime(choice, startTime) {
	console.log(choice, startTime);
}

/* END ASYNC FUNCTIONS */

// var getFaviconUrl = url => `https://icons.duckduckgo.com/ip3/${getHostname(url)}.ico`
var getFaviconUrl = url => `https://www.google.com/s2/favicons?sz=64&domain_url=${getHostname(url)}`;

var getHostname = url => Object.assign(document.createElement('a'), {href: url}).hostname;

var getBetterUrl = url => {
	var a = Object.assign(document.createElement('a'), {href: url});
	return a.hostname + a.pathname;
}

var getTabCountLabel = tabs => `${tabs.length} tab${tabs.length === 1 ? '' : 's'}`

var getSiteCountLabel = tabs => {
	var count = tabs.map(t => getHostname(t.url)).filter((v,i,s) => s.indexOf(v) === i).length;
	return count > 1 ? `${count} different websites` : `${count} website`;
}

var verifyTab = tab => {
	if (!tab) return false;
	if (!tab.title) return false;
	if (!tab.id) return false;
	if (!tab.url && (!tab.tabs || !tab.tabs.length)) return false;
	if (!tab.wakeUpTime) return false;
	if (!tab.timeCreated) return false;
	return true;
}

var sleeping = tabs => tabs.filter(t => !t.opened);

var today = tabs => tabs.filter(t => t.wakeUpTime && dayjs(t.wakeUpTime).dayOfYear() === dayjs().dayOfYear() && dayjs(t.wakeUpTime).year() === dayjs().year())

var isDefault = tabs => tabs.title && ['nap room | snoozz', 'settings | snoozz', 'rise and shine | snoozz', 'New Tab', 'Start Page'].includes(tabs.title);

var isValid = tabs => tabs.url && ['http', 'https', 'ftp'].includes(tabs.url.substring(0, tabs.url.indexOf(':')));

var capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

var wrapInDiv = (attr, ...nodes) => {
	var div = Object.assign(document.createElement('div'), typeof attr === 'string' ? {className: attr} : attr);
	div.append(...nodes)
	return div;
}

var SIZES = {
	undefined: _ => 0,
	boolean: _ => 4,
	number: _ => 8,
	string: s => (new TextEncoder().encode(s)).length,
	object: o => !o ? 0 : Object.keys(o).reduce((total, key) => calcObjectSize(key) + calcObjectSize(o[key]) + total, 0)
}

var calcObjectSize = obj => SIZES[typeof obj](obj);

var clipboard = text => {
	var el = Object.assign(document.createElement('textarea'), {innerText: text});
	document.body.append(el); el.select();
	document.execCommand('copy'); el.remove();
}

var formatSnoozedUntil = t => {
	if (t.startUp) return `Next ${capitalize(getBrowser())} Launch`;
	var ts = t.wakeUpTime;
	var date = dayjs(ts);
	if (date.dayOfYear() === dayjs().dayOfYear()) return (date.hour() > 17 ? 'Tonight' : 'Today') + date.format(` [@] ${getHourFormat(date.minute() !== 0)}`);
	if (date.dayOfYear() === dayjs().add(1,'d').dayOfYear()) return 'Tomorrow' + date.format(` [@] ${getHourFormat(date.minute() !== 0)}`);
	if (date.week() === dayjs().week()) return date.format(`dddd [@] ${getHourFormat(date.minute() !== 0)}`);
	return date.format(`ddd, MMM D [@] ${getHourFormat(date.minute() !== 0)}`);
}

var getHourFormat = showZeros => (HOUR_FORMAT && HOUR_FORMAT === 24) ? 'HH:mm' : `h${showZeros ? ':mm' : ''} A`;

var getEveningLabel = (hour, isToday) => {
	if (hour && hour <= 16) return 'Afternoon';
	if (hour && hour >= 20) return 'Night';
	return 'Evening';
}

var resizeDropdowns = _ => {
	document.querySelectorAll('select').forEach(s => {
		s.addEventListener('change', e => {
			var d = Object.assign(document.createElement('select'), {style: {visibility: 'hidden', position: 'fixed'}});
			var o = Object.assign(document.createElement('option'), {innerText: e.target.options[e.target.selectedIndex].text});
			d.append(o);
			e.target.after(d);
			e.target.style.width = `${d.getBoundingClientRect().width}px`;
			d.remove();
		});
		s.dispatchEvent(new Event('change'));
	});
}

var getUrlParam = p => {
	var url = new URLSearchParams(window.location.search);
	return url.get(p); 
}

var upgradeSettings = settings => {
	if (!settings) return;
	if (settings.morning && typeof settings.morning === 'number') settings.morning = [settings.morning, 0];
	if (settings.evening && typeof settings.evening === 'number') settings.evening = [settings.evening, 0];
	if (settings.popup && settings.timeOfDay) delete settings.timeOfDay;
	return settings;
}

var bgLog = (logs, colors, timestampColor = 'grey') => {
	var timestamp = dayjs().format('[%c]DD/MM/YY HH:mm:ss[%c] | ')
	logs = logs.map(l => '%c'+l+'%c').join(' ')
	colors.unshift(timestampColor);
	colors = colors.flatMap((v,i,a)=>i !== a.length ? [v, ''] : v).map(c => {
		var colors = {green:'limegreen', red:'crimson', blue:'dodgerblue', yellow:'gold', pink:'violet', grey:'slategrey', white: 'navajowhite'}
		return 'color:' + (colors[c] ?? 'unset')
	})
	console.log(timestamp + logs, ...colors)
}

var showIconOnScroll = _ => {
	var header = document.querySelector('body > div.flex.center')
	var logo = document.querySelector('body > div.scroll-logo');
	if (!header || !logo) return;

	logo.addEventListener('click', _ => window.scrollTo({top: 0,behavior: 'smooth'}));
	document.addEventListener('scroll', _ => {
		if (logo.classList.contains('hidden') && window.pageYOffset > (header.offsetHeight + header.offsetTop)) logo.classList.remove('hidden')
		if (!logo.classList.contains('hidden') && window.pageYOffset <= (header.offsetHeight + header.offsetTop)) logo.classList.add('hidden')
	})
}