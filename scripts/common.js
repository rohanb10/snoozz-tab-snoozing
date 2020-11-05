function getBrowser() {
	if (!!navigator.userAgent.match(/safari/i) && !navigator.userAgent.match(/chrome/i) && typeof document.body.style.webkitFilter !== "undefined") return 'safari';
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

async function getPrettyTab(tabId) {
	var tab = await getSnoozedTabs([tabId])
	Object.keys(tab).forEach(k => {
		if (typeof tab[k] === 'string' && tab[k].length > 75) tab[k] = tab[k].substring(0,72) + '...';
		if (!isNaN(tab[k])) tab[k] = dayjs(tab[k]).format('HH:mm:ss D/M/YY');
	})
	return tab;
}
/*	SAVE 	*/
async function saveOptions(o) {
	if (!o) return;
	return new Promise(r => chrome.storage.local.set({'snoozedOptions': o}, r));
}
async function saveTab(t) {
	if (!t) return;
	var tabs = await getSnoozedTabs();
	tabs.push(t);
	await saveTabs(tabs);
}
async function saveTabs(tabs) {
	if (!tabs) return;
	return new Promise(r => chrome.storage.local.set({'snoozed': tabs}, r));
}
/*	CREATE 	*/
async function createAlarm(time, willWakeUpATab) {
	bgLog(['Next Alarm at',dayjs(time).format('HH:mm:ss D/M/YY')], ['', willWakeUpATab ? 'yellow':'white'])
	await chrome.alarms.create('wakeUpTabs', {when: time});
}
async function createNotification(id, title, imgUrl, msg, clickUrl) {
	if (!chrome.notifications) return;
	await chrome.notifications.create(id, {type: 'basic', iconUrl: chrome.extension.getURL(imgUrl), title: title, message: msg});
	if (clickUrl) chrome.notifications.onClicked.addListener(async _ => await openExtensionTab(clickUrl));
}
async function createWindow(tabId) {
	return new Promise(r => chrome.windows.create({url: `/html/rise_and_shine.html#${tabId}`}, r));
}

/*	CONFIGURE	*/

async function setTheme() {
	var t = await getOptions('theme');
	document.body.classList.toggle('dark', t === 'dark');
}
setTheme();

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
	if (extTabs.length === 1){chrome.tabs.update(extTabs[0].id, {url: url, active: true})}
	else if (extTabs.length > 1) {
		var activeTab = extTabs.some(et => et.active) ? extTabs.find(et => et.active) : extTabs.reduce((t1, t2) => t1.index > t2.index ? t1 : t2);
		chrome.tabs.update(activeTab.id, {url: url, active: true});
		chrome.tabs.remove(extTabs.filter(et => et !== activeTab).map(t => t.id))		
	} else {
		var activeTab = tabs.find(t => t.active);
		if (activeTab && ['New Tab', 'Start Page'].includes(activeTab.title)) {chrome.tabs.update(activeTab.id, {url: url})}
		else {chrome.tabs.create({url: url})}
	}
}

async function openTab(tab, windowId, automatic = false) {
	var windows = await getAllWindows();
	if (!windows || !windows.length || windows.length === 0) {
		await new Promise(r => chrome.windows.create({url: tab.url}, r));
	} else {
		await new Promise(r => chrome.tabs.create({url: tab.url, active: false, pinned: tab.pinned, windowId: windowId}, r));	
	}
	if (!automatic) return;
	var msg = `${tab.title} -- snoozed ${dayjs(tab.timeCreated).fromNow()}`;
	createNotification(tab.id, 'A tab woke up!', 'icons/main-icon.png', msg, './html/dashboard.html');
}

async function openWindow(t, automatic = false) {
	var targetWindow, currentWindow = await getTabsInWindow();
	if (currentWindow.length && currentWindow.filter(isDefault).length === currentWindow.length) {
		await openExtensionTab(`/html/rise_and_shine.html#${t.id}`);
		targetWindow = currentWindow[0].windowId;
	} else {
		targetWindow = await createWindow(t.id)
	}

	// send message to map browser tabs to tab-list in rise_and_shine.html
	var loadingCount = 0;
	chrome.tabs.onUpdated.addListener(async function cleanTabsAfterLoad(id, state, title) {
		if (loadingCount > t.tabs.length) {
			chrome.runtime.sendMessage({startMapping: true});
			chrome.tabs.onUpdated.removeListener(cleanTabsAfterLoad)
		}
		if (state.status === 'loading' && state.url) loadingCount ++;
	});

	for (var s of t.tabs) await openTab(s, targetWindow.id);
	chrome.windows.update(targetWindow.id, {focused: true});
	
	if (!automatic) return;
	var msg = `This window was put to sleep ${dayjs(t.timeCreated).fromNow()}`;
	createNotification(t.id, 'A window woke up!', 'icons/main-icon.png', msg, './html/dashboard.html');
	return;
}

/*		SNOOZING 	*/
async function snoozeTab(snoozeTime, overrideTab) {
	var activeTab = overrideTab || await getTabsInWindow(true);
	if (!activeTab || !activeTab.url) return {};
	var sleepyTab = {
		id: Math.random().toString(36).slice(-10),
		title: activeTab.title ?? getBetterUrl(activeTab.url),
		url: activeTab.url,
		favicon: activeTab.favIconUrl && activeTab.favIconUrl.length < 150 ? activeTab.favIconUrl : '',
		...activeTab.pinned ? {pinned: true} : {},
		wakeUpTime: dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
	}
	await saveTab(sleepyTab);
	chrome.runtime.sendMessage({logOptions: ['newtab', sleepyTab, snoozeTime]});
	var tabId = activeTab.id || await getTabId(activeTab.url);
	return {tabId: tabId}
}

async function snoozeWindow(snoozeTime) {
	var tabsInWindow = await getTabsInWindow();
	var validTabs = tabsInWindow.filter(t => !isDefault(t) && isValid(t));
	if (validTabs.length === 0) return {};
	if (validTabs.length === 1) {
		await snoozeTab(snoozeTime, validTabs[0])
		return {windowId: tabsInWindow.find(w => w.active).windowId};
	}
	var sleepyGroup = {
		id: Math.random().toString(36).slice(-10),
		title: `${getTabCountLabel(validTabs)} from ${getSiteCountLabel(validTabs)}`,
		wakeUpTime: dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
		tabs: validTabs.map(t => ({
			title: t.title,
			url: t.url,
			favicon: t.favIconUrl && t.favIconUrl.length < 150 ? t.favIconUrl : '',
			...t.pinned ? {pinned: true} : {}
		}))
	}
	await saveTab(sleepyGroup);
	chrome.runtime.sendMessage({logOptions: ['newwindow', sleepyGroup, snoozeTime]});
	return {windowId: tabsInWindow.find(w => w.active).windowId};
}

async function getChoices(which) {
	var NOW = dayjs();
	var config = await getOptions(['morning', 'evening', 'timeOfDay']);
	config.timeOfDay = config.timeOfDay === 'evening' ? config.evening : (config.timeOfDay === 'morning' ? config.morning : NOW.hour() + (NOW.minute() / 60))
	var all = {
		'today-morning': {
			label: 'This Morning',
			color: '#F7D05C',
			time: NOW.startOf('d').add(config.morning, 'h'),
			timeString: 'Today',
			disabled: NOW.startOf('d').add(config.morning, 'h').valueOf() < dayjs()
		},
		'today-evening': {
			label: 'This Evening',
			color: '#E1AD7A',
			time: NOW.startOf('d').add(config.evening, 'h'),
			timeString: 'Today',
			disabled: NOW.startOf('d').add(config.evening, 'h').valueOf() < dayjs()
		},
		'tom-morning': {
			label: 'Tomorrow Morning',
			color: '#00b77d',
			time: NOW.startOf('d').add(1,'d').add(config.morning, 'h'),
			timeString: NOW.add(1,'d').format('ddd D')
		},
		'tom-evening': {
			label: 'Tomorrow Evening',
			color: '#87CCE2',
			time: NOW.startOf('d').add(1,'d').add(config.evening, 'h'),
			timeString: NOW.add(1,'d').format('ddd D')
		},
		'weekend': {
			label: 'Weekend',
			color: '#F08974',
			time: NOW.startOf('d').weekday(6).add(config.timeOfDay, 'h'),
			timeString: NOW.weekday(6).format('ddd, D MMM'),
			disabled: NOW.day() === 6
		},
		'monday': {
			label: 'Next Monday',
			color: '#488863',
			time: NOW.startOf('d').weekday(8).add(config.timeOfDay, 'h'),
			timeString: NOW.weekday(8).format('ddd, D MMM'),
			isDark: true,
		},
		'week': {
			label: 'Next Week',
			color: '#847AD0',
			time: NOW.startOf('d').add(1, 'week').add(config.timeOfDay, 'h'),
			timeString: NOW.startOf('d').add(1, 'week').add(config.timeOfDay, 'h').format('D MMM'),
			isDark: true,
		},
		'month': {
			label: 'Next Month',
			color: '#F0C26C',
			time: NOW.startOf('d').add(1, 'M').add(config.timeOfDay, 'h'),
			timeString: NOW.startOf('d').add(1, 'M').add(config.timeOfDay, 'h').format('D MMM')
		}
	}
	return which && all[which] ? all[which] : all;
}

/* END ASYNC FUNCTIONS */

var getFaviconUrl = url => `https://www.google.com/s2/favicons?sz=32&domain=${getHostname(url)}`

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

var sleeping = tabs => tabs.filter(t => !t.opened);

var today = tabs => tabs.filter(t => t.wakeUpTime && dayjs(t.wakeUpTime).dayOfYear() === dayjs().dayOfYear())

var isDefault = tabs => tabs.title && ['dashboard | snoozz', 'settings | snoozz', 'rise and shine | snoozz', 'New Tab', 'Start Page'].includes(tabs.title);

var isValid = tabs => tabs.url && ['http', 'https', 'ftp'].includes(tabs.url.substring(0, tabs.url.indexOf(':')))

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

var bgLog = (logs, colors, timestampColor = 'grey') => {
	var timestamp = dayjs().format('[%c]D/M/YY HH:mm:ss[%c] | ')
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