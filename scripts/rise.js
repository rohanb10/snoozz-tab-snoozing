async function init() {
	document.querySelector('.dashboard').addEventListener('click', _ => openExtTab('./dashboard.html'), {once:true});
	showIconOnScroll();

	var found = await fetchTabFromStorage();
	if (!found) setTimeout(_ => window.close(), 1000);
	populate(found);
	mapTabs();
	chrome.runtime.onMessage.addListener(async r => {
		if (!r.startMapping) return;
		await mapTabs();
	});
}

async function fetchTabFromStorage() {
	var query = window.location.hash.substring(1);
	if (!query || query.length === 0) return;

	var tabs = await getStored('snoozed');
	if (!tabs || tabs.length === 0) return;

	var found = tabs.find(t => t.id && t.id === query);
	if (!found || !found.tabs || !found.tabs.length || found.tabs.length === 0) return;

	return found;
}
function populate(found) {
	document.getElementById('when').innerHTML = `This window was snoozed at <span>${dayjs(found.timeCreated).format('h:mma [</span>on<span>] dddd, DD MMM YYYY')}</span>.`
	document.getElementById('till').innerHTML = `It was scheduled to wake up <span>${dayjs(found.timeCreated).to(dayjs(found.wakeUpTime),true)}</span> later.`
	var tabList = document.querySelector('.tab-list');
	found.tabs.forEach((t, i) => {
		var iconImg = Object.assign(document.createElement('img'), {src: t.favicon === '' ? 'icons/unknown.png' : t.favicon});
		var title = wrapInDiv({className: 'tab-title', innerText: t.title});
		var tab = wrapInDiv('tab flex', wrapInDiv('icon', iconImg), title);
		tab.setAttribute('data-url', t.url);
		tabList.append(tab);
	})
}
async function mapTabs() {
	var tabsInWindow = await getTabs();
	var thisTab = tabsInWindow.find(t => t.active);
	var tabsOnPage = document.querySelectorAll('.tab')
	tabsOnPage.forEach(top => {
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