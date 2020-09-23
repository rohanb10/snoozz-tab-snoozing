chrome.runtime.onMessage.addListener((msg, sender, resp) => {
	if (msg.closeTabInBg) setTimeout(_ => chrome.tabs.remove(msg.tabId), 2000);
	if (msg.closeWindowInBg) setTimeout(_ => chrome.windows.remove(msg.windowId), 2000);
	if (msg.updateOptions) {configureOptions();setUpContextMenus()}
})

async function wakeUpTask(cachedTabs) {
	var tabs = cachedTabs || await getSnoozedTabs();
	if (!tabs || !tabs.length || tabs.length === 0 || sleeping(tabs).length === 0) {
		console.log('No tabs are asleep');
		chrome.alarms.clear('wakeUpTabs'); 
		return;
	}
	setNextAlarm(tabs);
	cleanUpHistory(tabs);
}

async function setNextAlarm(tabs) {
	var earliest = sleeping(tabs).reduce((t1,t2) => t1.wakeUpTime < t2.wakeUpTime ? t1 : t2);
	console.log('Next tab waking up: ', new Date(earliest.wakeUpTime).toLocaleString('en-IN'), earliest);
	if (earliest.wakeUpTime < dayjs().valueOf()) {
		wakeMeUp(tabs);
	} else {
		var oneHourFromNow = dayjs().add(1, 'hour').valueOf();
		await createAlarm('wakeUpTabs', earliest.wakeUpTime < oneHourFromNow ? earliest.wakeUpTime : oneHourFromNow);
	}
}

async function wakeMeUp(tabs) {
	var now = dayjs().valueOf();
	var tabsToWakeUp = t => !t.opened && (t.url || t.tabs) && t.wakeUpTime && t.wakeUpTime <= now;
	if (tabs.filter(tabsToWakeUp).length === 0) return;
	console.log('Waking up these tabs at ', new Date().toLocaleString('en-IN'), tabs.filter(tabsToWakeUp));
	for (var s of tabs.filter(tabsToWakeUp)) s.tabs ? await openWindow(s, true) : await openTab(s, true);
	tabs.filter(tabsToWakeUp).forEach(t => t.opened = now);
	await saveTabs(tabs);
	await wakeUpTask(tabs);
}

async function setUpContextMenus() {
	console.log('Setting up context menus', new Date().toLocaleString('en-IN'));
	chrome.contextMenus.removeAll();
	if (!EXT_OPTIONS || !EXT_OPTIONS.contextMenu || !EXT_OPTIONS.contextMenu.length || EXT_OPTIONS.contextMenu.length === 0) return;
	var CHOICE_MAP = getChoices();
	EXT_OPTIONS.contextMenu.forEach(o => chrome.contextMenus.create({
		id: o,
		contexts: ['link'],
		title: `Snooze till ${CHOICE_MAP[o].label.toLowerCase()}`
	}));
}

chrome.contextMenus.onClicked.addListener(contextMenuClickHandler)

async function contextMenuClickHandler(item) {
	var CHOICE_MAP = getChoices();
	var snoozeTime = CHOICE_MAP[item.menuItemId] && CHOICE_MAP[item.menuItemId].time;
	if (!snoozeTime || CHOICE_MAP[item.menuItemId].disabled || dayjs().isAfter(dayjs(snoozeTime))) {
		createNotification(null, `Can't snooze that link :(`, 'icons/main-icon.png', 'The time you selected is invalid.');
		return;
	}
	if (!item.linkUrl || !item.linkUrl.length || item.linkUrl.length === 0) {
		createNotification(null, `Can't snooze that link :(`, 'icons/main-icon.png', 'The link you are trying to snooze is invalid.');
		return;
	}
	await snoozeTab(snoozeTime.valueOf(), Object.assign(item, {url: item.linkUrl}));
	var msg = `${getHostname(item.linkUrl)} will wake up at ${snoozeTime.format('h:mm a [on] ddd, D MMM')}.`
	createNotification(snoozeTab.id, 'A new tab is now napping :)', 'icons/main-icon.png', msg, 'dashboard.html');
}

async function cleanUpHistory(tabs) {
	console.log('deleting old tabs: ', tabs.filter(t => t.opened && dayjs().isAfter(dayjs(t.opened).add(EXT_OPTIONS.history, 'd'))));
	saveTabs(tabs.filter(t => !(t.opened && dayjs().isAfter(dayjs(t.opened).add(EXT_OPTIONS.history, 'd')))));
}

async function setUpExtension() {
	var snoozed = await getSnoozedTabs();
	if (!snoozed || !snoozed.length || snoozed.length === 0) await saveTabs([]);
	var options = await getOptions();
	if (!options) await saveOptions(EXT_OPTIONS);
	init();
}

function init() {
	wakeUpTask();
	setUpContextMenus();
}

chrome.runtime.onInstalled.addListener(setUpExtension);
chrome.runtime.onStartup.addListener(init);
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'wakeUpTabs') wakeUpTask()});