var colours = window.gradientSteps ? gradientSteps('#F3B845', '#DF4E76', 100) : [];
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
async function isIncognitoAllowed() {
	return new Promise(r => chrome.extension.isAllowedIncognitoAccess(r));
}

/*	SAVE 	*/
async function saveOption(key, val) {
	if (!key || !val) return;
	var o = await getOptions();
	o[key] = val;
	await saveOptions(o);
}
async function saveOptions(o) {
	if (!o) return;
	return new Promise(r => chrome.storage.local.set({'snoozedOptions': o}, r));
}
async function saveTab(t) {
	if (!t || !t.id) return;
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
	var n = await getOptions('notifications');
	if (n === 'sound') try { new Audio(chrome.runtime.getURL('sounds/appointed.mp3')).play()} catch (e){}
	if (!chrome.notifications || (n && n === 'off' && !force)) return;
	await chrome.notifications.create(id, {type: 'basic', iconUrl: chrome.runtime.getURL(imgUrl), title, message});
}
async function createWindow(tabId, incognito) {
	if (tabId) return new Promise(r => chrome.windows.create({url: `/html/rise-and-shine.html#${tabId}`}, r));
	return new Promise(r => chrome.windows.create({incognito}, r));
}

/*	CONFIGURE	*/

async function setTheme() {
	var t = await getOptions('theme');
	if (t === 'system') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
	var cookieStoreId = tab.cookieStoreId ? { cookieStoreId: tab.cookieStoreId } : {};
	if (tab.incognito) {
		var w = windows.find(i => i.incognito) || await createWindow(undefined, t.incognito);
		await new Promise(r => chrome.tabs.create({url: tab.url, active: false, pinned: tab.pinned, ...cookieStoreId, windowId: w.id}, r));
	} else if (!windows || !windows.filter(w => !w.incognito).length) {
		await new Promise(r => chrome.windows.create({url: tab.url, ...cookieStoreId}, r));
	} else {
		await new Promise(r => chrome.tabs.create({url: tab.url, active: false, pinned: tab.pinned, ...cookieStoreId, windowId}, r));	
	}
	if (!automatic) return;
	var msg = `${tab.title} -- snoozed ${dayjs(tab.timeCreated).fromNow()}`;
	createNotification(tab.id, 'A tab woke up!', 'icons/logo.svg', msg);
}

async function openSelection(t, automatic = false) {
	var targetWindowID = null, windows = await getAllWindows();
	if (!windows || !windows.length || t.newWindow) {
		var window = await createWindow(undefined, t.incognito);
		targetWindowID = window.id;
	}
	for (var s of t.tabs) await openTab(s, targetWindowID);
	if (!automatic) return;
	var msg = `These tabs were put to sleep ${dayjs(t.timeCreated).fromNow()}`;
	createNotification(t.id, `${t.title.split(' ')[0]} tabs woke up!`, 'icons/logo.svg', msg);
}

async function openWindow(t, automatic = false) {
	var targetWindowID, currentWindow = await getTabsInWindow();
	if (currentWindow.length && (currentWindow.filter(isDefault).length === currentWindow.length || (typeof t.newWindow === 'boolean' && t.newWindow === false))) {
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

async function editSnoozed(tabId, snoozeTime, duplicating) {
	var t = await getSnoozedTabs(tabId);
	['startUp', 'opened', 'deleted', 'repeat', 'paused'].forEach(prop => delete t[prop]);
	t.wakeUpTime = snoozeTime === 'startup' ? dayjs().add(20, 'y').valueOf() : dayjs(snoozeTime).valueOf(),
	t.timeCreated = dayjs().valueOf();
	t.id = duplicating ? getRandomId() : t.id;
	if (snoozeTime === 'startup') t.startUp = true;
	await saveTab(t);
	return duplicating ? {duped: true} : {edited: true}
}

async function editRecurringSnoozed(tabId, data, duplicating) {
	var t = await getSnoozedTabs(tabId);
	['startUp', 'opened', 'deleted', 'paused'].forEach(prop => delete t[prop]);
	t.wakeUpTime = await calculateNextSnoozeTime(data);
	t.timeCreated = dayjs().valueOf();
	if (data.repeat === 'startup') t.startUp = true;
	t.repeat = data;
	t.id = duplicating ? getRandomId() : t.id;
	await saveTab(t);
	return duplicating ? {duped: true} : {edited: true}
}

async function editSnoozeRecurring(tabId, data, ) {
	var t = await getSnoozedTabs(tabId);
	['startUp', 'opened', 'deleted', 'repeat', 'paused'].forEach(prop => delete t[prop]);
	if (data.repeat === 'startup') t.startUp = true;
	t.wakeUpTime = await calculateNextSnoozeTime(data);
	t.modifiedTime = dayjs().valueOf();
	t.repeat = data;
	t.paused = false;
	await saveTab(t);
	return {edited: true}
}

/*		SNOOZING 	*/
async function snoozeTab(snoozeTime, overrideTab) {
	var activeTab = overrideTab || await getTabsInWindow(true);
	if (!activeTab || !activeTab.url) return {};
	var sleepyTab = {
		id: getRandomId(),
		title: activeTab.title || getBetterUrl(activeTab.url),
		url: activeTab.url,
		...activeTab.pinned ? {pinned: true} : {},
		...activeTab.incognito ? {incognito: true} : {},
		...activeTab.cookieStoreId ? {cookieStoreId: activeTab.cookieStoreId} : {},
		wakeUpTime: snoozeTime === 'startup' ? dayjs().add(20, 'y').valueOf() : dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
	}
	if (snoozeTime === 'startup') sleepyTab.startUp = true;
	await saveTab(sleepyTab);
	chrome.runtime.sendMessage({logOptions: ['tab', sleepyTab, snoozeTime]});
	var tabId = activeTab.id || await getTabId(activeTab.url);
	return {tabId, tabDBId: sleepyTab.id}
}

async function snoozeWindow(snoozeTime, isASelection) {
	var tabsInWindow = await getTabsInWindow();
	var validTabs = tabsInWindow.filter(t => !isDefault(t) && isValid(t));
	if (isASelection) validTabs = validTabs.filter(t => t.highlighted);
	if (validTabs.length === 0) return {};
	if (validTabs.length === 1) {
		await snoozeTab(snoozeTime, validTabs[0])
		return {windowId: tabsInWindow.find(w => w.active).windowId};
	}
	var sleepyGroup = {
		id: getRandomId(),
		wakeUpTime: snoozeTime === 'startup' ? dayjs().add(20, 'y').valueOf() : dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
		title: `${getTabCountLabel(validTabs)} from ${getSiteCountLabel(validTabs)}`,
		...(validTabs.some(v => v.incognito)) ? {incognito: true} : {},
	}
	if (isASelection) {
		sleepyGroup.title = sleepyGroup.title.replace(' tab', ' selected tab');
		sleepyGroup.selection = true;
	}
	if (snoozeTime === 'startup') sleepyGroup.startUp = true;

	sleepyGroup = Object.assign(sleepyGroup, {
		tabs: validTabs.map(t => ({
			title: t.title,
			url: t.url,
			...t.pinned ? {pinned: true} : {},
			...t.cookieStoreId ? {cookieStoreId: t.cookieStoreId} : {}
		}))
	});
	await saveTab(sleepyGroup);
	chrome.runtime.sendMessage({logOptions: [isASelection ? 'selection' : 'window', sleepyGroup, snoozeTime]});	
	return isASelection ? {tabId: tabsInWindow.filter(t => t.highlighted).map(t => t.id)} : {windowId: tabsInWindow.find(w => w.active).windowId};
}

async function snoozeRecurring(target, data) {
	var sleepyObj = {
		id: getRandomId(),
		timeCreated: dayjs().valueOf(),
		repeat: data,
		paused: false,
	}

	var validTabs, activeTab, tabsInWindow = await getTabsInWindow();
	validTabs = tabsInWindow.filter(t => !isDefault(t) && isValid(t));
	if (target === 'tab') validTabs = validTabs.filter(t => t.active);
	if (target === 'selection') {
		validTabs = validTabs.filter(t => t.highlighted);
		sleepyObj.selection = true;
	}

	if (data.repeat === 'startup') sleepyObj.startUp = true;

	sleepyObj.wakeUpTime = await calculateNextSnoozeTime(data);
	// console.log(dayjs(sleepyObj.wakeUpTime).format('DD/MM/YY HH:mm'));

	if (validTabs.length === 0) return {};
	if (validTabs.length === 1 || target === 'tab') {
		var activeTab = validTabs && validTabs.length ? validTabs[0] : await getTabsInWindow(true);
		if (!activeTab || !activeTab.url) return {};
		Object.assign(sleepyObj, {
			title: activeTab.title || getBetterUrl(activeTab.url),
			url: activeTab.url,
			...activeTab.pinned ? {pinned: true} : {},
			...activeTab.cookieStoreId ? {cookieStoreId: activeTab.cookieStoreId} : {}
		});
	} else {
		Object.assign(sleepyObj, {
			title: `${getTabCountLabel(validTabs).replace(' tab', target === 'selection' ? ' selected tab' : ' tab')} from ${getSiteCountLabel(validTabs)}`,
			tabs: validTabs.map(t => ({
				title: t.title,
				url: t.url,
				...t.pinned ? {pinned: true} : {},
				...t.cookieStoreId ? {cookieStoreId: t.cookieStoreId} : {}
			}))
		})
	}
	console.log(sleepyObj);
	await saveTab(sleepyObj);
	chrome.runtime.sendMessage({logOptions: [target, sleepyObj, sleepyObj.wakeUpTime]});
	if (target === 'tab') return {tabId: activeTab.id};
	if (target === 'window') return {windowId: validTabs.find(w => w.active).windowId};
	if (target === 'selection') return {tabId: validTabs.map(t => t.id)};

}

async function getTimeWithModifier(choice) {
	var c = await getChoices([choice])
	var options = await getOptions(['morning', 'evening', 'popup']);
	var modifier = options.popup ? options.popup[choice] : '';
	options = upgradeSettings(options);
	var m = options[modifier] || [dayjs().hour(), dayjs().minute()];
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
			repeatTime: NOW.add(20, 'y'),
			repeatTimeString: '',
			repeat_id: 'startup',
			menuLabel: 'till next startup'
		},
		'in-an-hour': {
			label: 'In One Hour',
			repeatLabel: 'Every hour',
			time: NOW.add(1, 'h'),
			timeString: NOW.add(1, 'h').dayOfYear() == NOW.dayOfYear() ? 'Today' : 'Tomorrow',
			repeatTime: NOW.add(1, 'h').format(getHourFormat(true)),
			repeatTimeString: `Starts at`,
			repeat_id: 'hourly',
			menuLabel: 'for an hour'
		},
		'today-morning': {
			label: 'This Morning',
			repeatLabel: '',
			time: NOW.startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm'),
			timeString: 'Today',
			repeatTime: '',
			repeatTimeString: '',
			menuLabel: 'till this morning',
			disabled: NOW.startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm').valueOf() < dayjs(),
			repeatDisabled: true,
		},
		'today-evening': {
			label: getEveningLabel(config.evening[0]),
			repeatLabel: `Everyday, Now`,
			time: NOW.startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm'),
			timeString: 'Today',
			repeatTime: NOW.format(getHourFormat(true)),
			repeatTimeString: 'Starts Tom at',
			repeat_id: 'daily',
			menuLabel: 'till this evening',
			disabled: NOW.startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm').valueOf() < dayjs(),
		},
		'tom-morning': {
			label: 'Tomorrow Morning',
			repeatLabel: 'Every Morning',
			time: NOW.startOf('d').add(1,'d').add(config.morning[0], 'h').add(config.morning[1], 'm'),
			timeString: NOW.add(1,'d').format('ddd, D MMM'),
			repeatTime: NOW.startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm').format(getHourFormat(true)),
			repeatTimeString: `Starts ${NOW < NOW.startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm') ? 'Today' : 'Tom'} at`,
			repeat_id: 'daily_morning',
			menuLabel: 'till tomorrow morning'
		},
		'tom-evening': {
			label: getEveningLabel(config.evening[0], 'tomorrow'),
			repeatLabel: getEveningLabel(config.evening[0], 'everyday'),
			time: NOW.startOf('d').add(1,'d').add(config.evening[0], 'h').add(config.evening[1], 'm'),
			timeString: NOW.add(1,'d').format('ddd, D MMM'),
			repeatTime: NOW.startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm').format(getHourFormat(true)),
			repeatTimeString: `Starts ${NOW < NOW.startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm') ? 'Today' : 'Tom'} at`,
			repeat_id: 'daily_evening',
			menuLabel: 'till tomorrow evening'
		},
		'weekend': {
			label: 'Saturday',
			repeatLabel: 'Every Saturday',
			time: NOW.startOf('d').weekday(6),
			timeString: NOW.weekday(6).format('ddd, D MMM'),
			repeatTime: NOW.startOf('d').format(getHourFormat(true)),
			repeatTimeString: `${NOW.weekday(6).format('dddd')}s at`,
			repeat_id: 'weekends',
			menuLabel: 'till the weekend',
			// disabled: NOW.day() === 6,
		},
		'monday': {
			label: 'Next Monday',
			repeatLabel: 'Every Monday',
			time: NOW.startOf('d').weekday(NOW.startOf('d') < dayjs().startOf('d').weekday(1) ? 1 : 8),
			timeString: NOW.weekday(NOW.startOf('d') < dayjs().startOf('d').weekday(1) ? 1 : 8).format('ddd, D MMM'),
			repeatTime: NOW.startOf('d').format(getHourFormat(true)),
			repeatTimeString: `${NOW.weekday(1).format('dddd')}s at`,
			repeat_id: 'mondays',
			menuLabel: 'till next Monday'
		},
		'week': {
			label: 'Next Week',
			repeatLabel: 'Every ' + NOW.format('dddd'),
			time: NOW.startOf('d').add(1, 'week'),
			timeString: NOW.startOf('d').add(1, 'week').format('ddd, D MMM'),
			repeatTime: NOW.format(getHourFormat(true)),
			repeatTimeString: `${NOW.format('dddd')}s at`,
			repeat_id: 'weekly',
			menuLabel: 'for a week',
			// disabled: NOW.day() === 1,
			// repeatDisabled: NOW.day() === 1 || NOW.day() === 6,
		},
		'month': {
			label: 'Next Month',
			repeatLabel: 'Every Month',
			time: NOW.startOf('d').add(1, 'M'),
			timeString: NOW.startOf('d').add(1, 'M').format('ddd, D MMM'),
			repeatTime: NOW.format(getHourFormat(true)),
			repeatTimeString: `${getOrdinal(NOW.format('D'))} of Month`,
			repeat_id: 'monthly',
			menuLabel: 'for a month'
		},
	}
	return which && all[which] ? all[which] : all;
}

async function calculateNextSnoozeTime(data) {
	var NOW = dayjs(), TYPE = data.type, [HOUR, MINUTE] = data.time;
	if (TYPE === 'startup') {
		return NOW.add(20, 'y');
	} else if (TYPE === 'hourly') {
		var isNextHour = NOW.minute() >= MINUTE ? 1 : 0;
		return NOW.startOf('h').add(isNextHour, 'h').minute(MINUTE).valueOf();
	} else if (TYPE === 'daily') {
		var isNextDay = NOW.hour() > HOUR || (NOW.hour() === HOUR && NOW.minute() >= MINUTE) ? 1 : 0;
		return NOW.startOf('d').add(isNextDay, 'd').hour(HOUR).minute(MINUTE).valueOf();
	} else if (TYPE === 'daily_morning') {
		var [m_hour, m_minute] = await getOptions('morning');
		var isNextDay = NOW.hour() > m_hour || (NOW.hour() === m_hour && NOW.minute() >= m_minute) ? 1 : 0;
		return NOW.startOf('d').add(isNextDay, 'd').hour(m_hour).minute(m_minute).valueOf();
	} else if (TYPE === 'daily_evening') {
		var [e_hour, e_minute] = await getOptions('evening');
		var isNextDay = NOW.hour() > e_hour || (NOW.hour() === e_hour && NOW.minute() >= e_minute) ? 1 : 0;
		return NOW.startOf('d').add(isNextDay, 'd').hour(e_hour).minute(e_minute).valueOf();
	} else if (['weekends', 'mondays', 'weekly', 'monthly', 'custom'].includes(TYPE)) {
		var days = [];
		if (data.weekly) {
			var thisWeek = data.weekly, nextWeek = data.weekly.map(day => day + 7);
			days = nextWeek.concat(thisWeek).map(day => dayjs().startOf('w').add(day, 'd').hour(HOUR).minute(MINUTE));
		} else if (data.monthly) {
			var thisMonth = data.monthly.filter(d => d <= dayjs().daysInMonth()).map(d => dayjs().startOf('M').date(d).hour(HOUR).minute(MINUTE));
			var nextMonth = data.monthly.filter(d => d <= dayjs().add(1, 'M').daysInMonth()).map(d => dayjs().startOf('M').add(1, 'M').date(d).hour(HOUR).minute(MINUTE));
			days = nextMonth.concat(thisMonth);
		}
		return days.filter(d => d > NOW).pop().valueOf();
	}
	return false;
}

/* END ASYNC FUNCTIONS */
var getFaviconUrl = url => {
	if (url.indexOf('file://') === 0) return '../icons/file.svg'
	// return `https://icons.duckduckgo.com/ip3/${getHostname(url)}.ico`
	// return `https://www.google.com/s2/favicons?sz=64&domain_url=${getHostname(url)}`;
	return `https://besticon.herokuapp.com/icon?url=${getHostname(url)}&size=32..48..64&fallback_icon_color=${getColorForUrl(getHostname(url)).replace('#', '')}`;
}
var getColorForUrl = (url = 'snoozz.me') => colours[url.split('').map(c => c.charCodeAt(0)).reduce((a, b) => a + b) % 100];

var getHostname = url => {
	var h = Object.assign(document.createElement('a'), {href: url}).hostname;
	return (h && h.length) ? h : undefined;
}

var getBetterUrl = url => {
	var a = Object.assign(document.createElement('a'), {href: url});
	return a.hostname + a.pathname;
}

var getTabCountLabel = tabs => `${tabs.length} tab${tabs.length === 1 ? '' : 's'}`

var getSiteCountLabel = tabs => {
	var count = tabs.map(t => getHostname(t.url)).filter((v,i,s) => s.indexOf(v) === i).length;
	return count > 1 ? `${count} different websites` : `${count} website`;
}

var getTabType = t => {
	if (t.tabs && t.selection) return 'selection';
	if (t.tabs) return 'window';
	return 'tab';
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

var isValid = tabs => {
	var validProtocols = ['http', 'https', 'ftp', 'chrome-extension', 'web-extension', 'moz-extension', 'extension'];
	if (getBrowser() == 'chrome') validProtocols.push('file');
	return tabs.url && validProtocols.includes(tabs.url.substring(0, tabs.url.indexOf(':')));
}

var isSameYear = (a, b) => dayjs(a).year() === dayjs(b).year();

var capitalize = s => s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

var wrapInDiv = (attr, ...nodes) => {
	var div = Object.assign(document.createElement('div'), typeof attr === 'string' ? {className: attr} : attr);
	div.append(...nodes)
	return div;
}

var getRandomId = _ => [...Array(16)].map(_ => Math.random().toString(36)[2][Math.random() < .5 ? 'toLowerCase' : 'toUpperCase']()).join('');

var asc = (a, b) => a - b;
var desc = (a, b) => b - a;

var SIZES = {
	undefined: _ => 0,
	boolean: _ => 4,
	number: _ => 8,
	string: s => (new TextEncoder().encode(s)).length,
	object: o => !o ? 0 : Object.keys(o).reduce((total, key) => calcObjectSize(key) + calcObjectSize(o[key]) + total, 0)
}

const DEFAULT_OPTIONS = {
	morning: [9, 0],
	evening: [18, 0],
	hourFormat: 12,
	icons: 'human',
	theme: 'light',
	notifications: 'on',
	history: 30,
	badge: 'today',
	closeDelay: 1000,
	polling: 'on',
	napCollapsed: [],
	weekStart: 0,
	popup: {weekend: 'morning', monday: 'morning', week: 'morning', month: 'morning'},
	contextMenu: ['startup', 'in-an-hour', 'today-evening', 'tom-morning', 'weekend']
}

var calcObjectSize = obj => SIZES[typeof obj](obj);

var clipboard = text => {
	var el = Object.assign(document.createElement('textarea'), {innerText: text});
	document.body.append(el); el.select();
	document.execCommand('copy'); el.remove();
}

var formatSnoozedUntil = t => {
	if (t.startUp || (t.repeat && t.repeat.type === 'startup')) return `Next ${capitalize(getBrowser())} Launch`;
	var ts = t.wakeUpTime;
	var date = dayjs(ts);
	if (date.dayOfYear() === dayjs().dayOfYear()) return (date.hour() > 17 ? 'Tonight' : 'Today') + date.format(` [@] ${getHourFormat(date.minute() !== 0)}`);
	if (date.dayOfYear() === dayjs().add(1,'d').dayOfYear()) return 'Tomorrow' + date.format(` [@] ${getHourFormat(date.minute() !== 0)}`);
	if (date.week() === dayjs().week()) return date.format(`dddd [@] ${getHourFormat(date.minute() !== 0)}`);
	if (date.year() !== dayjs().year()) return date.format(`ddd, MMM D, YYYY`);
	return date.format(`ddd, MMM D [@] ${getHourFormat(date.minute() !== 0)}`);
}

var getHourFormat = showZeros => (HOUR_FORMAT && HOUR_FORMAT === 24) ? 'HH:mm' : `h${showZeros ? ':mm' : ''} A`;

var getEveningLabel = (hour, type) => {
	var t = 'evening', prefix = 'this ';
	if (type && type === 'tomorrow') prefix = 'tomorrow ';
	if (type && type === 'every') prefix = 'every ';
	if (hour && hour <= 16) t = 'afternoon';
	if (hour && hour >= 20) t = 'night';
	if (hour && hour >= 20 && !type) prefix = 'to';
	return capitalize(prefix + t)
}
var getOrdinal = num => {
	num = parseInt(num);
	if (num % 100 >= 11 && num % 100 <= 13) return `${num}th`;
	if (num % 10 === 1) return `${num}st`;
	if (num % 10 === 2) return `${num}nd`;
	if (num % 10 === 3) return `${num}rd`;
	return `${num}th`;
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
		return 'color:' + (colors[c] || 'unset')
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