async function init() {
	await fetchHourFormat();
	document.querySelector('.nap-room').onkeyup = e => {if (e.which === 13) openExtensionTab('/html/nap-room.html')}
	document.querySelector('.nap-room').addEventListener('click', _ => openExtensionTab('/html/nap-room.html'), {once:true});
	showIconOnScroll();

	var options = await getOptions();
	if (options.icons) document.querySelector('.nap-room img').src = `../icons/${options.icons}/nap-room.png`;

	var found = await fetchTabFromStorage();
	populate(found);
	mapTabs();
	chrome.runtime.onMessage.addListener(async r => {
		if (!r.startMapping) return;
		await mapTabs();
	});
}

async function fetchTabFromStorage() {
	var tabs = await getSnoozedTabs();
	var query = window.location.hash.substring(1);
	if (!query || query.length === 0 || !tabs || tabs.length === 0) return false;

	var found = tabs.find(t => t.id && t.id === query);
	if (!found || !found.tabs || !found.tabs.length || found.tabs.length === 0) return;
	return found;
}
function populate(found) {
	if (!found && found !== false) return setTimeout(_ => window.close(), 1000);
	document.querySelector('#when span').innerText = dayjs(found.timeCreated).format(`${getHourFormat()} on dddd, DD MMM YYYY`)
	var till = document.querySelector('#till span');
	till.innerText = found.startUp ? 'the next time you opened ' + capitalize(getBrowser()) : dayjs(found.timeCreated).to(dayjs(found.wakeUpTime),true) + ' later'
	till.setAttribute('title', dayjs(found.wakeUpTime).format(`${getHourFormat()} on dddd, DD MMM YYYY`))
	var tabList = document.querySelector('.tab-list');
	found.tabs.forEach((t, i) => {
		var iconImg = Object.assign(document.createElement('img'), {src: getFaviconUrl(t.url)});
		var tab = wrapInDiv('tab flex', wrapInDiv('icon', iconImg), wrapInDiv({className: 'tab-title', innerText: t.title}));
		tab.setAttribute('data-url', t.url);
		tabList.append(tab);
	})
}
async function mapTabs() {
	document.querySelectorAll('.tab').forEach(top => top.addEventListener('click', async _ => {
		var tabsInWindow = await getTabsInWindow();
		var found = tabsInWindow.find(tiw => tiw.title === top.querySelector('.tab-title').innerText || tiw.url === top.getAttribute('data-url'));
		if (!found) return;
		chrome.tabs.update(found.id, {active: true});
		if (tabsInWindow.find(t => t.active)) chrome.runtime.sendMessage({close: true, tabId: tabsInWindow.find(t => t.active).id});
	}, {once: true}));
}

window.onload = init