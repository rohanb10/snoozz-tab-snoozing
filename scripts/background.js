chrome.runtime.onMessage.addListener(async msg => {
	if (msg.logOptions) sendToLogs(msg.logOptions);
	if (msg.poll && (navigator && navigator.onLine)) {
		var p = await getOptions('polling');
		if (p !== 'off') poll(msg.poll);
	}
	if (msg.wakeUp) await wakeUpTask();
	if (msg.close) setTimeout(_ => {
		if (msg.tabId) chrome.tabs.remove(msg.tabId);
		if (msg.windowId) chrome.windows.remove(msg.windowId);
		chrome.runtime.sendMessage({closePopup: true});
	}, msg.delay || 2000);
});
chrome.storage.onChanged.addListener(async changes => {
	if (changes.snoozedOptions) {
		await setUpContextMenus(changes.snoozedOptions.newValue.contextMenu);
		updateBadge(null, changes.snoozedOptions.newValue.badge);
		if (changes.snoozedOptions.oldValue && changes.snoozedOptions.newValue.history !== changes.snoozedOptions.oldValue.history) await wakeUpTask();
	}
	if (changes.snoozed) {
		await updateBadge(changes.snoozed.newValue);
		await wakeUpTask(changes.snoozed.newValue);
	}
});

if (chrome.notifications) chrome.notifications.onClicked.addListener(async id => {
	await chrome.notifications.clear(id)
	if (id === '_wakeUpNow') return await wakeUpTask();
	var t = await getSnoozedTabs(id);
	if (t && t.id && id && id.length) {
		var found = t.tabs ? await findTabAnywhere(null, t.id) : await findTabAnywhere(t.url);
		if (found && found.id && found.windowId) {
			try {
				await chrome.windows.update(found.windowId, {focused: true});
				if (t.tabs) {
					var winTabs = await getTabsInWindow();
					await chrome.tabs.update(winTabs[0] && winTabs[0].id ? winTabs[0].id : found.id, {active: true});
				} else {
					await chrome.tabs.update(found.id, {active: true});
				}
				return;
			} catch (e) {}
		}
	}
	await openExtensionTab('html/nap-room.html');
});

async function wakeUpTask(cachedTabs) {
	var tabs = cachedTabs || await getSnoozedTabs();
	if (!tabs || !tabs.length || tabs.length === 0) return;
	await cleanUpHistory(tabs);
	if (sleeping(tabs).length === 0) {
		bgLog(['No tabs are asleep'],['pink'], 'pink');
		return chrome.alarms.clear('wakeUpTabs');
	}
	await setNextAlarm(tabs);
}

var debounce;
async function setNextAlarm(tabs) {
	var next = sleeping(tabs).filter(t => t.wakeUpTime).reduce((t1,t2) => t1.wakeUpTime < t2.wakeUpTime ? t1 : t2);
	if (next && next.wakeUpTime <= dayjs().valueOf()) {
		clearTimeout(debounce)
		debounce = setTimeout(_ => wakeMeUp(tabs), 3000)
	} else {
		var oneHour = dayjs().add(1, 'h').valueOf();
		bgLog(['Next tab waking up:', next.id, 'at', dayjs(next.wakeUpTime).format('HH:mm:ss DD/MM/YY')],['','green','','yellow'])
		await createAlarm(next.wakeUpTime < oneHour ? next.wakeUpTime : oneHour, next.wakeUpTime < oneHour);
	}
}

async function wakeMeUp(tabs) {
	var now = dayjs().valueOf();
	var wakingUp = t => !t.opened && (t.url || (t.tabs && t.tabs.length && t.tabs.length > 0)) && t.wakeUpTime && t.wakeUpTime <= now;
	var tabsToWakeUp = tabs.filter(wakingUp);
	if (tabsToWakeUp.length === 0) return;
	bgLog(['Waking up tabs', tabsToWakeUp.map(t => t.id).join(', ')], ['', 'green'], 'yellow');
	tabs.filter(wakingUp).forEach(t => t.opened = now);
	await saveTabs(tabs);

	for (var s of tabsToWakeUp) s.tabs ? await openWindow(s, true) : await openTab(s, null, true);
}

async function setUpContextMenus(cachedMenus) {
	var cm = cachedMenus || await getOptions('contextMenu');
	if (!cm || !cm.length || cm.length === 0) return;
	var choices = await getChoices();
	var contexts = getBrowser() === 'firefox' ? ['link', 'tab'] : ['link'];
	if (cm.length === 1) {
		await chrome.contextMenus.removeAll();
		await chrome.contextMenus.create({
			id: cm[0], 
			contexts: contexts, 
			title: `Snoozz ${choices[cm[0]].label.toLowerCase()}`, 
			documentUrlPatterns: ['<all_urls>'],
			...(getBrowser() === 'firefox') ? {icons: {32: `../icons/${cm[0]}.png`}} : {}
		});
	} else {
		await chrome.contextMenus.removeAll();
		await chrome.contextMenus.create({id: 'snoozz', contexts: contexts, title: 'Snoozz', documentUrlPatterns: ['<all_urls>']})
		for (var o of cm) await chrome.contextMenus.create({
			parentId: 'snoozz',
			id: o, 
			contexts: contexts,
			title: choices[o].menuLabel,
			...(getBrowser() === 'firefox') ? {icons: {32: `../icons/${o}.png`}} : {}
		});
	}
	chrome.contextMenus.onClicked.addListener(snoozeInBackground);
	if (getBrowser() === 'firefox') chrome.contextMenus.onShown.addListener(contextMenuUpdater);
}
if (chrome.commands) chrome.commands.onCommand.addListener(async (command, tab) => {
	if (command === 'nap-room') return openExtensionTab('/html/nap-room.html');
	tab = tab || await getTabsInWindow(true);
	await snoozeInBackground({menuItemId: command, pageUrl: tab.url}, tab)
})

async function snoozeInBackground(item, tab) {
	var c = await getChoices(item.menuItemId);
	
	var isHref = item.linkUrl && item.linkUrl.length;
	var url = isHref ? item.linkUrl : item.pageUrl;
	if(!isValid({url})) return createNotification(null, `Can't snoozz that :(`, 'icons/logo.svg', 'The link you are trying to snooze is invalid.', true);

	var snoozeTime = c && c.time;
	if (c && ['weekend', 'monday', 'week', 'month'].includes(item.menuItemId)) snoozeTime = await getTimeWithModifier(item.menuItemId);
	if (!snoozeTime || c.disabled || dayjs().isAfter(dayjs(snoozeTime))) {
		return createNotification(null, `Can't snoozz that :(`, 'icons/logo.svg', 'The time you have selected is invalid.', true);
	}
	// add attributes
	var startUp = item.menuItemId === 'startup' ? true : undefined;
	var title = !isHref ? tab.title : (item.linkText ? item.linkText : item.selectionText);
	var wakeUpTime = snoozeTime.valueOf();
	var pinned = !isHref && tab.pinned ? tab.pinned : undefined;
	var assembledTab = Object.assign(item, {url, title, pinned, startUp, wakeUpTime})

	var snoozed = await snoozeTab(item.menuItemId === 'startup' ? 'startup' : snoozeTime.valueOf(), assembledTab);
	
	var msg = `${!isHref ? tab.title : getHostname(url)} will wake up ${formatSnoozedUntil(assembledTab)}.`
	createNotification(snoozed.tabDBId, 'A new tab is now napping :)', 'icons/logo.svg', msg, true);

	if (!isHref) await chrome.tabs.remove(tab.id);
	await chrome.runtime.sendMessage({updateDash: true});
}

async function contextMenuUpdater(menu) {
	var choices = await getChoices();
	for (c of menu.menuIds) {
		if (choices[c]) await chrome.contextMenus.update(c, {enabled: !choices[c].disabled});
	}
	await chrome.contextMenus.refresh();
}

async function cleanUpHistory(tabs) {
	var h = await getOptions('history') || 365;
	var tabsToDelete = tabs.filter(t => h && t.opened && dayjs().isAfter(dayjs(t.opened).add(h, 'd')));
	if (tabsToDelete.length === 0) return;
	bgLog(['Deleting old tabs automatically:',tabsToDelete.map(t => t.id)],['','red'], 'red')
	await saveTabs(tabs.filter(t => !tabsToDelete.includes(t)));
}

async function setUpExtension() {
	var snoozed = await getSnoozedTabs();
	if (!snoozed || !snoozed.length || snoozed.length === 0) await saveTabs([]);
	var options = await getOptions();
	options = Object.assign({
		morning: [9, 0],
		evening: [18, 0],
		hourFormat: 12,
		icons: 'human',
		notifications: 'on',
		history: 14,
		theme: 'light',
		badge: 'today',
		closeDelay: 1000,
		polling: 'on',
		weekStart: 0,
		popup: {weekend: options.timeOfDay || 'morning', monday: options.timeOfDay || 'morning', week: options.timeOfDay || 'morning', month: options.timeOfDay || 'morning'},
		contextMenu: ['startup', 'in-an-hour', 'today-evening', 'tom-morning', 'weekend']
	}, options);
	options = upgradeSettings(options);
	await saveOptions(options);
	await init();
}
function sendToLogs([which, p1]) {
	try {
		if (['tab', 'window', 'group'].includes(which)) bgLog(['Snoozing a new ' + which, p1.id, 'till', dayjs(p1.wakeUpTime).format('HH:mm:ss DD/MM/YY')],['', 'green', '', 'yellow'],'green')
		if (which === 'history') bgLog(['Sending tabs to history:', p1.join(', ')], ['', 'green'], 'blue');
		if (which === 'manually') bgLog(['Waking up tabs manually:', p1.join(', ')], ['', 'green'], 'blue');
		if (which === 'delete') bgLog(['Deleting tabs manually:', p1.join(', ')], ['', 'red'], 'red');
	} catch (e) {console.log('logError', e, which, p1)}
}

async function init() {
	var allTabs = await getSnoozedTabs();
	if (allTabs && allTabs.length && allTabs.some(t => t.startUp && !t.opened)) {
		allTabs.filter(t => t.startUp && !t.opened).forEach(t => t.wakeUpTime = dayjs().subtract(10, 's').valueOf());
		await saveTabs(allTabs);
	}
	await wakeUpTask();
	await setUpContextMenus();
}

chrome.runtime.onInstalled.addListener(async details => {
	setUpExtension();
	if (chrome.runtime.setUninstallURL) chrome.runtime.setUninstallURL('https://tally.so/r/mO5GYw');
	if (details && details.reason && details.reason == 'update' && details.previousVersion && details.previousVersion != chrome.runtime.getManifest().version) {
		if (chrome.runtime.getManifest().version.search(/^\d\.\d\.\d$/) !== 0) return;		// skip if minor version
		await new Promise(r => chrome.storage.local.set({'updated': true}, r));
		if (chrome.notifications) createNotification(null, 'Snoozz has been updated', 'icons/logo.svg', 'Click here to see what\'s new.', true);
	}
});
chrome.runtime.onStartup.addListener(init);
chrome.alarms.onAlarm.addListener(async a => { if (a.name === 'wakeUpTabs') await wakeUpTask()});
if (chrome.idle) chrome.idle.onStateChanged.addListener(async s => {
	if (s === 'active' || getBrowser() === 'firefox') {
		if (navigator && navigator.onLine === false) {
			window.addEventListener('online', async _ => {await wakeUpTask()}, {once: true});
		} else {
			await wakeUpTask();	
		}
	}
});