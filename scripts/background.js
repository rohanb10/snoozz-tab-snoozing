chrome.runtime.onMessage.addListener(msg => {
	if (msg.closeTabInBg) setTimeout(_ => {
		chrome.tabs.remove(msg.tabId);
		chrome.runtime.sendMessage({closePopup: true});
	}, 2000);
	if (msg.closeWindowInBg) setTimeout(_ => {
		chrome.windows.remove(msg.windowId);
		chrome.runtime.sendMessage({closePopup: true});
	}, 2000);
	if (msg.updateOptions) {setUpContextMenus();}
	if (msg.logOptions){sendToLogs(msg.logOptions)}
})

async function wakeUpTask(cachedTabs) {
	var tabs = cachedTabs || await getSnoozedTabs();
	cleanUpHistory(tabs);
	if (!tabs || !tabs.length || tabs.length === 0 || sleeping(tabs).length === 0) {
		bgLog(['No tabs are asleep'],['pink'], 'pink')
		createAlarm('wakeUpTabs', dayjs().add(1,'d').subtract(1,'m').valueOf());
		return;
	}
	setNextAlarm(tabs);
}

async function setNextAlarm(tabs) {
	var next = sleeping(tabs).reduce((t1,t2) => t1.wakeUpTime < t2.wakeUpTime ? t1 : t2);
	if (next.wakeUpTime < dayjs().valueOf()) {
		wakeMeUp(tabs);
	} else {
		var oneHour = dayjs().add(1, 'hour').valueOf();
		bgLog(['Next tab waking up:', next.id, 'at', dayjs(next.wakeUpTime).format('HH:mm:ss D/M/YY')],['','green','','yellow'])
		await createAlarm('wakeUpTabs', next.wakeUpTime < oneHour ? next.wakeUpTime : oneHour, next.wakeUpTime < oneHour);
	}
}

async function wakeMeUp(tabs) {
	var now = dayjs().valueOf();
	var wakingUp = t => !t.opened && (t.url || t.tabs) && t.wakeUpTime && t.wakeUpTime <= now;
	if (tabs.filter(wakingUp).length === 0) return;
	bgLog(['Waking up tabs', tabs.filter(wakingUp).map(t => t.id).join(', ')], ['', 'green'], 'yellow');
	for (var s of tabs.filter(wakingUp)) s.tabs ? await openWindow(s, true) : await openTab(s, null, true);
	tabs.filter(wakingUp).forEach(t => t.opened = now);
	await saveTabs(tabs);
	await wakeUpTask(tabs);
}

async function setUpContextMenus() {
	chrome.contextMenus.removeAll();
	var cm = await getOptions('contextMenu');
	if (!cm || !cm.length || cm.length === 0) return;
	var choices = await getChoices();
	var contexts = isFirefox ? ['link', 'tab'] : ['link'];
	if (cm.length === 1) {
		chrome.contextMenus.create({
			id: cm[0], 
			contexts: contexts, 
			title: `Snoozz until ${choices[cm[0]].label.toLowerCase()}`, 
			documentUrlPatterns: ['<all_urls>'],
			...isFirefox ? {icons: {32: `../icons/${cm[0]}.png`}} : {}
		})
	} else {
		chrome.contextMenus.create({id: 'snoozz', contexts: contexts, title: 'Snoozz until', documentUrlPatterns: ['<all_urls>']})
		cm.forEach(o => chrome.contextMenus.create({
			parentId: 'snoozz',
			id: o, contexts: contexts,
			title: choices[o].label.toLowerCase(),
			...isFirefox ? {icons: {32: `../icons/${o}.png`}} : {}
		}));
	}
	chrome.contextMenus.onClicked.addListener(contextMenuClickHandler)
	if (isFirefox) chrome.contextMenus.onShown.addListener(contextMenuUpdater)
}

async function contextMenuClickHandler(item, tab) {
	var c = await getChoices(item.menuItemId);
	var snoozeTime = c && c.time;
	if (!snoozeTime || c.disabled || dayjs().isAfter(dayjs(snoozeTime))) {
		createNotification(null, `Can't snooze that link :(`, 'icons/main-icon.png', 'The time you selected is invalid.');
		return;
	}
	var url, title, icon;
	if (item.linkUrl && item.linkUrl.length && item.linkUrl.length > 0) {
		url = item.linkUrl;
	} else {
		url = item.pageUrl;
		title = tab.title;
		icon = tab.favIconUrl;
	}
	if(!isValid({url : url})) {
		createNotification(null, `Can't snooze that link :(`, 'icons/main-icon.png', 'The link you are trying to snooze is invalid.');
		return;
	}
	await snoozeTab(snoozeTime.valueOf(), Object.assign(item, {url: url, title: title, favIconUrl: icon}));
	var msg = `${getHostname(url)} will wake up at ${snoozeTime.format('h:mm a [on] ddd, D MMM')}.`
	createNotification(snoozeTab.id, 'A new tab is now napping :)', 'icons/main-icon.png', msg, 'html/dashboard.html');
	chrome.extension.getBackgroundPage().wakeUpTask();
	chrome.runtime.sendMessage({updateDash: true});
}

async function contextMenuUpdater(menu) {
	var choices = await getChoices();
	for (c of menu.menuIds) {
		if (choices[c]) await chrome.contextMenus.update(c, {enabled: !choices[c].disabled});
	}
	chrome.contextMenus.refresh();
}

async function cleanUpHistory(tabs) {
	var h = await getOptions('history');
	var tabsToDelete = tabs.filter(t => h && t.opened && dayjs().isAfter(dayjs(t.opened).add(h, 'd')));
	if (tabsToDelete.length === 0) return;
	bgLog(['Deleting old tabs automatically:',tabsToDelete.map(t => t.id)],['','red'], 'red')
	saveTabs(tabs.filter(t => !tabsToDelete.includes(t)));
}

async function setUpExtension() {
	var snoozed = await getSnoozedTabs();
	if (!snoozed || !snoozed.length || snoozed.length === 0) await saveTabs([]);
	var options = await getOptions();
	if (!options) await saveOptions({history: 14, morning: 9, evening: 18, badge: 'today', contextMenu: ['today-evening', 'tom-morning', 'monday']});
	init();
}
function sendToLogs([which, p1, p2]) {
	try {
		if (which === 'newtab') bgLog(['Snoozing a new tab', p1.id, 'till', dayjs(p2.wakeUpTime).format('HH:mm:ss D/M/YY')],['', 'green', '', 'yellow'],'green')
		if (which === 'newwindow') bgLog(['Snoozing a new window', p1.id, 'till', dayjs(p2.wakeUpTime).format('HH:mm:ss D/M/YY')],['', 'green', '', 'yellow'],'green');
		if (which === 'history') bgLog(['Sending tabs to history:', p1.join(', ')], ['', 'green'], 'blue');
		if (which === 'manually') bgLog(['Waking up tabs manually:', p1.join(', ')], ['', 'green'], 'blue');
		if (which === 'delete') bgLog(['Deleting tabs manually:', p1.join(', ')], ['', 'red'], 'red');
	} catch (e) {console.log('logError', e, which, p1, p2)}
}

function init() {
	wakeUpTask();
	setUpContextMenus();
}

chrome.runtime.onInstalled.addListener(setUpExtension);
chrome.runtime.onStartup.addListener(init);
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'wakeUpTabs') wakeUpTask()});