async function init() {
	document.querySelector('.dashboard').addEventListener('click', _ => openExtensionTab('./dashboard.html'), {once:true});
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
	if (!query || query.length === 0 || !tabs || tabs.length === 0) return;

	var found = tabs.find(t => t.id && t.id === query);
	if (!found || !found.tabs || !found.tabs.length || found.tabs.length === 0) return;
	return found;
}
function populate(found) {
	if (!found) setTimeout(_ => window.close(), 1000);
	document.querySelector('#when span').innerText = dayjs(found.timeCreated).format('h:mma on dddd, DD MMM YYYY')
	document.querySelector('#till span').innerText = dayjs(found.timeCreated).to(dayjs(found.wakeUpTime),true)
	var tabList = document.querySelector('.tab-list');
	found.tabs.forEach((t, i) => {
		var iconImg = Object.assign(document.createElement('img'), {src: t.favicon && t.favicon !== '' ? t.favicon : getFaviconUrl(t.url)});
		var tab = wrapInDiv('tab flex', wrapInDiv('icon', iconImg), wrapInDiv({className: 'tab-title', innerText: t.title}));
		tab.setAttribute('data-url', t.url);
		tabList.append(tab);
	})
}
async function mapTabs() {
	var tabsInWindow = await getTabsInWindow();
	var thisTab = tabsInWindow.find(t => t.active);
	document.querySelectorAll('.tab').forEach(top => {
		var found = tabsInWindow.find(tiw => tiw.title === top.querySelector('.tab-title').innerText || tiw.url === top.getAttribute('data-url') || (top.querySelector('.icon img').src !== 'icons/unknown.png' && tiw.favIconUrl === top.querySelector('.icon img').src));
		if (!found) return;
		top.style.cursor = 'pointer';
		top.addEventListener('click', _ => {
			chrome.tabs.update(found.id, {active: true});
			if (thisTab.id) chrome.runtime.sendMessage({closeTabInBg:true, tabId: thisTab.id});
		}, {once: true});
	});
}

window.onload = init