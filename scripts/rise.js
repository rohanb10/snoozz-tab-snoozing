async function init() {
	document.querySelector('.dashboard').onkeyup = e => {if (e.which === 13) openExtensionTab('/html/dashboard.html')}
	document.querySelector('.dashboard').addEventListener('click', _ => openExtensionTab('/html/dashboard.html'), {once:true});
	showIconOnScroll();

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
	if (!found && found !== false) setTimeout(_ => window.close(), 1000);
	document.querySelector('#when span').innerText = dayjs(found.timeCreated).format('h:mma on dddd, DD MMM YYYY')
	var till = document.querySelector('#till span');
	till.innerText = dayjs(found.timeCreated).to(dayjs(found.wakeUpTime),true)
	till.setAttribute('title', dayjs(found.wakeUpTime).format('h:mma on dddd, DD MMM YYYY'))
	var tabList = document.querySelector('.tab-list');
	found.tabs.forEach((t, i) => {
		var iconImg = Object.assign(document.createElement('img'), {src: t.favicon && t.favicon !== '' ? t.favicon : getFaviconUrl(t.url)});
		var tab = wrapInDiv('tab flex', wrapInDiv('icon', iconImg), wrapInDiv({className: 'tab-title', innerText: t.title}));
		tab.setAttribute('data-url', t.url);
		tabList.append(tab);
	})
}
async function mapTabs() {
	document.querySelectorAll('.tab').forEach(top => top.addEventListener('click', async _ => {
		var tabsInWindow = await getTabsInWindow();
		var found = tabsInWindow.find(tiw => tiw.title === top.querySelector('.tab-title').innerText || tiw.url === top.getAttribute('data-url') || (top.querySelector('.icon img').src !== 'icons/unknown.png' && tiw.favIconUrl === top.querySelector('.icon img').src));
		if (!found) return;
		chrome.tabs.update(found.id, {active: true});
		if (tabsInWindow.find(t => t.active)) chrome.runtime.sendMessage({close: true, tabId: tabsInWindow.find(t => t.active).id});
	}, {once: true}));
}

window.onload = init