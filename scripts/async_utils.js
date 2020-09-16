window.browser = (_ => window.browser || window.chrome)()

async function getStored(key) {
	var p = new Promise(r => chrome.storage.local.get(key || ['snoozed', 'snoozedOptions'], r));
	if (!key || typeof key !== 'string') return p;
	var store = await p;
	return store[key];
}

async function getTabs(active, cw = true) {
	var p = new Promise(r => chrome.tabs.query({active: active, currentWindow: cw}, r));
	if (!active) return p;
	var tabs = await p;
	return tabs[0];
}

async function saveTab(t) {
	var tabs = await getStored('snoozed');
	tabs.push(t);
	await saveTabs(tabs);
}

function saveTabs(tabs) {
	updateBadge(tabs);
	return new Promise(r => chrome.storage.local.set({'snoozed': tabs}, r));
}

function createNotification(id, title, imgUrl, msg, clickUrl, type = 'basic') {
	chrome.notifications.create(id, {
		type: type,
		iconUrl: chrome.extension.getURL(imgUrl),
		title: title,
		message: msg,
	});
	if (clickUrl) chrome.notifications.onClicked.addListener(_ => openExtTab(clickUrl));
}

function saveOptions(o) {
	return new Promise(r => chrome.storage.local.set({'snoozedOptions': o}, r));	
}

async function configureOptions() {
	var storageOptions = await getStored('snoozedOptions');
	EXT_OPTIONS = Object.assign(EXT_OPTIONS, storageOptions)
}

// get tab id for url
async function getTabId(url) {
	var tabsInWindow = await getTabs();
	var foundTab  = tabsInWindow.find(t => t.url === url);
	return foundTab ? parseInt(foundTab.id) : false; 
}

// open tab for an external page
async function openRegTab(tab, sendNotification) {
	await new Promise(r => chrome.tabs.create({url: tab.url, active: true}, r));
	if (!sendNotification) return;
	var msg = `${tab.title} -- snoozed ${dayjs(tab.timeCreated).fromNow()}`;
	createNotification(tab.id, 'A tab woke up!', 'icons/main-icon.png', msg, 'dashboard.html');
}

// open tab for an extension page
async function openExtTab(url) {
	var tabs = await getTabs();
	var extTabs = tabs.filter(t => ['dashboard | snoozz', 'settings | snoozz'].includes(t.title));
	if (extTabs.length === 0) chrome.tabs.create({url: url});
	if (extTabs.length === 1) chrome.tabs.update(extTabs[0].id, {url: url, active: true});
	if (extTabs.length > 1) {
		var activeTab = extTabs.some(et => et.active) ? extTabs.find(et => et.active) : extTabs.reduce((t1, t2) => t1.index > t2.index ? t1 : t2);
		chrome.tabs.update(activeTab.id, {url: url, active: true});
		chrome.tabs.remove(extTabs.filter(et => et !== activeTab).map(t => t.id))		
	}
}

// remove opened tabs in history if they are more than X days old. X is defined in options
async function cleanUpHistory() {
	var tabs = await getStored('snoozed');
	if (!tabs || tabs.length === 0) return;
	tabs.filter(t => !(t.opened && dayjs(t.opened).add(EXT_OPTIONS.history, 'd') > dayjs()))
	saveTabs(tabs);
}

async function getFaviconFromStorage(url) {
	var missingDomain = getHostname(url);

	var tabs = await getStored('snoozed');
	if (!tabs || tabs.length === 0) return '';
	var foundDomain = tabs.filter(t => t.url).find(t => getHostname(t.url) === missingDomain);
	if (foundDomain) return foundDomain.favicon;
	return '';
	// check windows for favicon
	// foundDomain = tabs.filter(t => t.tabs).map

}