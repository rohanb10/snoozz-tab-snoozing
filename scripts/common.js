window.browser = (_ => window.browser || window.browser)()
const isFirefox = (window.browser && chrome.runtime) || navigator.userAgent.indexOf('Firefox') !== -1;
/*	ASYNCHRONOUS FUNCTIONS	*/
/*	GET 	*/
async function getSnoozedTabs(ids) {
	var p = await new Promise(r => chrome.storage.local.get('snoozed', r));
	if (!p.snoozed) return;
	if (!ids || (ids.length && ids.length === 0)) return p.snoozed;
	var found = p.snoozed.filter(s => s.id && (ids.length ? ids.includes(s.id) : ids === s.id));
	return found.length === 1 ? found[0] : found;
}
async function getOptions(keys) {
	var p = await new Promise(r => chrome.storage.local.get('snoozedOptions', r));
	if (!p.snoozedOptions) return;
	if (!keys) return p.snoozedOptions;
	if (typeof keys === 'string') return p.snoozedOptions[keys];
	return Object.keys(p.snoozedOptions).filter(k => keys.includes(k)).reduce((o, k) => {o[k] = p.snoozedOptions[k];return o},{});
	
}
async function getTabsInWindow(active) {
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
	var foundTab  = tabsInWindow.find(t => t.url === url);
	return foundTab ? parseInt(foundTab.id) : false; 
}
async function getPrettyTab(tabId) {
	var tab = await getSnoozedTabs([tabId])
	Object.keys(tab).forEach(k => {
		if (typeof tab[k] === 'string' && tab[k].length > 75) tab[k] = tab[k].substring(0,72) + '...';
		if (!isNaN(tab[k])) tab[k] = new Date(tab[k]).toLocaleString('en-IN')
	})
	return tab;
}
/*	SAVE 	*/
async function saveOptions(o) {
	var p = await new Promise(r => chrome.storage.local.set({'snoozedOptions': o}, r));
	chrome.runtime.sendMessage({updateOptions: true});
}
async function saveTab(t) {
	var tabs = await getSnoozedTabs();
	tabs.push(t);
	await saveTabs(tabs);
}
async function saveTabs(tabs) {
	var p = new Promise(r => chrome.storage.local.set({'snoozed': tabs}, r));
	await updateBadge(sleeping(tabs));
	return p;
}
/*	CREATE 	*/
function createAlarm(name, time, willWakeUpATab = false) {
	bgLog(['Next Alarm at',dayjs(time).format('HH:mm:ss D/M/YY')], ['', willWakeUpATab ? 'yellow':'white'])
	chrome.alarms.create(name, {when: time});
}
function createNotification(id, title, imgUrl, msg, clickUrl) {
	chrome.notifications.create(id, {type: 'basic', iconUrl: chrome.extension.getURL(imgUrl), title: title, message: msg});
	if (clickUrl) chrome.notifications.onClicked.addListener(_ => openExtensionTab(clickUrl));
}
async function createWindow(tabId) {
	return new Promise(r => chrome.windows.create({url: `html/rise_and_shine.html#${tabId}`}, r));
}

/*	CONFIGURE	*/
async function updateBadge(tabs) {
	var num = 0;
	var badge = await getOptions('badge');
	if (tabs.length > 0 && badge && ['all','today'].includes(badge)) num = badge === 'today' ? today(tabs).length : tabs.length;
	chrome.browserAction.setBadgeText({text: num > 0 ? num.toString() : ''});
	chrome.browserAction.setBadgeBackgroundColor({color: '#CF5A77'});
}

/*	OPEN 	*/

// open tab for an extension page
async function openExtensionTab(url) {
	var tabs = await getTabsInWindow();
	var extTabs = tabs.filter(t => isDefault(t));

	if (extTabs.length === 1){chrome.tabs.update(extTabs[0].id, {url: url, active: true})}
	else if (extTabs.length > 1) {
		var activeTab = extTabs.some(et => et.active) ? extTabs.find(et => et.active) : extTabs.reduce((t1, t2) => t1.index > t2.index ? t1 : t2);
		chrome.tabs.update(activeTab.id, {url: url, active: true});
		chrome.tabs.remove(extTabs.filter(et => et !== activeTab).map(t => t.id))		
	} else {
		var activeTab = tabs.find(t => t.active);
		if (activeTab && activeTab.title === 'New Tab') {chrome.tabs.update(activeTab.id, {url: url})}
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
	var targetWindow = await createWindow(t.id);

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
		favicon: activeTab.favIconUrl ?? '',
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
		tabs: validTabs.map(t => {return {title: t.title, url: t.url, favicon: t.favIconUrl ?? '', ...t.pinned ? {pinned: true} : {},}})
	}
	await saveTab(sleepyGroup);
	chrome.runtime.sendMessage({logOptions: ['newwindow', sleepyGroup, snoozeTime]});
	return {windowId: tabsInWindow.find(w => w.active).windowId};
}

async function getChoices(which) {
	var NOW = dayjs();
	var config = await getOptions(['morning', 'evening']);
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
			time: NOW.startOf('d').weekday(6).add(config.morning, 'h'),
			timeString: NOW.weekday(6).format('ddd, D MMM'),
			// disabled: NOW.weekday(6).dayOfYear() === NOW.add(1, 'd').dayOfYear() || NOW.weekday(6).dayOfYear() === NOW.dayOfYear()
		},
		'monday': {
			label: 'Next Monday',
			color: '#488863',
			time: NOW.startOf('d').weekday(8).add(config.morning, 'h'),
			timeString: NOW.weekday(8).format('ddd, D MMM'),
			isDark: true,
		},
		'week': {
			label: 'Next Week',
			color: '#847AD0',
			time: NOW.add(1, 'week'),
			timeString: NOW.add(1, 'week').format('D MMM'),
			isDark: true,
		},
		'month': {
			label: 'Next Month',
			color: '#F0C26C',
			time: NOW.add(1, 'M'),
			timeString: NOW.add(1, 'M').format('D MMM')
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

var isDefault = tabs => tabs.title && ['dashboard | snoozz', 'settings | snoozz', 'rise and shine | snoozz', 'New Tab'].includes(tabs.title);

var isValid = tabs => tabs.url && ['http', 'https', 'file'].includes(tabs.url.substring(0, tabs.url.indexOf(':')))

var wrapInDiv = (attr, ...nodes) => {
	var div = Object.assign(document.createElement('div'), typeof attr === 'string' ? {className: attr} : attr);
	div.append(...nodes)
	return div;
}

var bgLog = (logs, colors, tsColor = 'grey') => {
	var timestamp = dayjs().format('[%c]D/M/YY HH:mm:ss[%c] | ')
	logs = logs.map(l => '%c'+l+'%c').join(' ')
	colors.unshift(tsColor);
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