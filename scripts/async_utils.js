window.browser = (_ => window.browser || window.chrome)()

async function getStored(key) {
	var p = new Promise(r => chrome.storage.local.get(key || ['snoozed', 'snoozedOptions'], r));
	if (!key || typeof key !== 'string') return p;
	var store = await p;
	return store[key];
}

async function getTabs(active, cw = true, windowId) {
	var p = new Promise(r => chrome.tabs.query({active: active, currentWindow: cw, windowId: windowId}, r));
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
	updateBadge(sleeping(tabs));
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

function createAlarm(name, time) {
	console.log('Alarm set at  '+ new Date().toLocaleString('en-IN') + ', waking up at ' + new Date(time).toLocaleString('en-IN'));
	chrome.alarms.create(name, {when: time});
}

async function createWindow(tabId) {
	return new Promise(r => chrome.windows.create({url: `rise_and_shine.html#${tabId}`, focused: true}, r));
}

async function saveOptions(o) {
	return new Promise(r => chrome.storage.local.set({'snoozedOptions': o}, r));	
}

async function configureOptions() {
	var storageOptions = await getStored('snoozedOptions');
	EXT_OPTIONS = Object.assign(EXT_OPTIONS, storageOptions)
	return;
}

// get tab id for url
async function getTabId(url) {
	var tabsInWindow = await getTabs();
	var foundTab  = tabsInWindow.find(t => t.url === url);
	return foundTab ? parseInt(foundTab.id) : false; 
}

async function openRegWindow(t, automatic = false) {
	var targetWindow = await createWindow(t.id);

	var loadingCount = 0;
	chrome.tabs.onUpdated.addListener(async function cleanTabsAfterLoad(id, state, title) {
		if (loadingCount > t.tabs.length) {
			chrome.runtime.sendMessage({startMapping: true});		
			chrome.tabs.onUpdated.removeListener(cleanTabsAfterLoad)	
		}
		if (state.status === 'loading' && state.url) loadingCount ++;
	});

	for (var s of t.tabs) await openRegTab(Object.assign(s, {forceWindow: targetWindow.id}));
	chrome.windows.update(targetWindow.id, {focused: true});
	
	if (!automatic) return;
	var msg = `This window was put to sleep ${dayjs(t.timeCreated).fromNow()}`;
	createNotification(t.id, 'A window woke up!', 'icons/main-icon.png', msg, 'dashboard.html');
	return;
}

// open tab for an regular page
async function openRegTab(tab, automatic = false) {
	console.log('openRegTab', tab);
	await new Promise(r => chrome.tabs.create({url: tab.url, active: false, pinned: tab.pinned, windowId: tab.forceWindow}, r));
	if (!automatic) return;
	var msg = `${tab.title} -- snoozed ${dayjs(tab.timeCreated).fromNow()}`;
	createNotification(tab.id, 'A tab woke up!', 'icons/main-icon.png', msg, 'dashboard.html');
}

// open tab for an extension page
async function openExtTab(url) {
	var tabs = await getTabs();
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

async function findFaviconInStorage(url) {
	var missingDomain = getHostname(url);

	var tabs = await getStored('snoozed');
	if (!tabs || tabs.length === 0) return '';
	var match = tabs.find(t => (t.favicon && t.favicon !== '' && t.url && getHostname(t.url) === missingDomain) || (t.tabs && t.tabs.length && t.tabs.some(s => s.favicon && s.favicon !== '' && s.url && getHostname(s.url) === missingDomain)));
	if (match && !match.favicon && match.tabs) match = match.tabs.find(m => m.url && getHostname(m.url) === missingDomain);
	return match ? match.favicon : '';
}