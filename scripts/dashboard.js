const TIME_GROUPS = ['Today', 'Tomorrow', 'This Week', 'Next Week', 'Later', 'History'];
async function initialize() {
	await configureOptions();

	document.querySelector('.settings').addEventListener('click', _ => openExtTab('settings.html'), {once:true})
	showIconOnScroll();

	// refresh dashboard when storage changed if page is not in focus
	chrome.storage.onChanged.addListener(_ => {
		if (document.hasFocus()) return;
		chrome.tabs.query({currentWindow: true, title: 'dashboard | snoozz'}, dashboardTabs => {
			if (dashboardTabs.length === 0) return;
			var dt = dashboardTabs.shift();
			if (dashboardTabs.length > 0) chrome.tabs.remove(dashboardTabs.map(t => t.id));
			chrome.tabs.reload(dt.id)
		});
	});
	var tabs = await getStored('snoozed');
	if (!tabs || tabs.length === 0) return;

	buildTimeGroups();
	fillTimeGroups(tabs);
}

function buildTimeGroups() {
	var container = document.getElementById('time-container');
	
	TIME_GROUPS.forEach(t => {
		var tID = t.replace(/ /g,"_").toLowerCase();
		var timeGroup = Object.assign(document.createElement('div'), {className: 'time-group', id: tID});
		var header = Object.assign(document.createElement('div'), {className: 'flex time-header'});
		var name = Object.assign(document.createElement('h2'), {className: 'time-name', innerText: t});
		var timeAction = Object.assign(document.createElement('div'), {
			className: `time-action`,
			innerText: tID === 'history' ? 'clear history' : 'wake up all'
		});
		timeAction.addEventListener('click', async _ => {
			var ids = Array.from(document.querySelectorAll(`#${tID} .tab`)).map(t =>t.id);
			await (tID === 'history' ? removeTabsFromHistory(ids) : wakeUpTabsAbruptly(ids));
		}, {once: true})
		header.append(name, timeAction);
		timeGroup.append(header);
		container.append(timeGroup);
	});
}

function updateTimeGroups() {
	TIME_GROUPS.forEach(name => {
		var tg = document.getElementById(name.replace(/ /g,"_").toLowerCase())
		var tabCount = Array.from(tg.querySelectorAll('.tab')).length
		tg.classList.toggle('hidden', tabCount === 0)
		tg.querySelector('.time-action').classList.toggle('hidden', tabCount < 2);
	})
	document.getElementById('no-tabs').classList.toggle('hidden', document.querySelector('.tab'));
}

async function fillTimeGroups(tabs) {
	document.querySelectorAll('#time-container p,#time-container .tab').forEach(t => t.remove());
	// regular
	tabs.filter(t => !t.opened).sort((t1,t2) => t1.wakeUpTime - t2.wakeUpTime).forEach(f => document.getElementById(getTimeGroup(f)).append(buildTab(f)))
	// history
	if (tabs.some(t => t.opened)) {
		tabs.filter(t => t.opened).sort((t1,t2) => t2.opened - t1.opened).forEach(h => document.getElementById(getTimeGroup(h)).append(buildTab(h)))	
		document.getElementById('history').appendChild(Object.assign(document.createElement('p'),{innerText: `Tabs in your history are removed ${EXT_OPTIONS.history} day${EXT_OPTIONS.history>1?'s':''} after they are opened.`}));
	}
	updateTimeGroups();
}

function buildTab(t) {
	var icon = Object.assign(document.createElement('img'), {className: 'icon', src: !t.favicon || t.favicon === '' ? '../icons/unknown.png' : t.favicon});
	var iconContainer = Object.assign(document.createElement('div'), {className: 'icon-container'});
	iconContainer.append(icon);

	var title = Object.assign(document.createElement('div'), {className: 'tab-name', innerText: t.title, title: t.url})
	var startedNap = Object.assign(document.createElement('div'), {
		className: 'nap-time',
		innerText: `Started napping at ${dayjs(t.timeCreated).format('h:mm a [on] ddd D MMM YYYY')}`, 
		title: t.url
	});
	var titleContainer = Object.assign(document.createElement('div'), {className: 'title-container'});
	titleContainer.append(title, startedNap);

	var wakeUpLabel = Object.assign(document.createElement('div'), {
		className: 'wakeup-label',
		innerText: t.deleted ? 'Deleted on' : (t.opened ? `Woke up ${t.opened < t.wakeUpTime ? 'manually' : 'automatically'} on` : 'Waking up')
	});
	var wakeUpTime = Object.assign(document.createElement('div'), {
		className: 'wakeup-time',
		innerText: t.opened ? dayjs(t.opened).format('dddd, D MMM') : formatSnoozedUntil(t.wakeUpTime),
		title: dayjs(t.opened ? t.opened : t.wakeUpTime).format('h:mm a [on] ddd, D MMMM YYYY')
	});
	var wakeUpContainer = Object.assign(document.createElement('div'), {className: 'wakeup-container'});
	wakeUpContainer.append(wakeUpLabel, wakeUpTime);

	var wakeUpBtn = Object.assign(document.createElement('div'), {className:'wakeup-button', innerText: !t.opened ? 'Wake up now' : ''});
	wakeUpBtn.addEventListener('click', _ => {
		wakeUpTabsAbruptly([t.id]);
	});
	var removeBtn = Object.assign(document.createElement('img'), {className:'remove-button', src: '../icons/close.svg',title: 'Delete'});
	removeBtn.addEventListener('click', async _ => {
		if (t.opened) await removeTabsFromHistory([t.id]);
		if (!t.opened) await sendTabsToHistory([t.id]);
	});

	var tab = Object.assign(document.createElement('div'), {className: 'tab', id: t.id});
	tab.append(iconContainer, titleContainer, wakeUpContainer, wakeUpBtn, removeBtn);
	return tab;
}

function formatSnoozedUntil(ts) {
	var date = dayjs(ts);
	if (date.dayOfYear() === dayjs().dayOfYear()) return (date.hour() > 17 ? 'Tonight' : 'Today') + date.format(' [@] h:mm a');
	if (date.dayOfYear() === dayjs().add(1,'d').dayOfYear()) return 'Tomorrow' + date.format(' [@] h:mm a');
	if (date.week() === dayjs().week()) return date.format('ddd [@] h:mm a');
	return date.format('ddd, MMM D [@] h:mm a');
}

function getTimeGroup(t) {
	if (t.opened) return 'history';
	var time = dayjs(t.wakeUpTime);
	var now = dayjs()
	if (time.dayOfYear() === now.dayOfYear()) return 'today';
	if (time.dayOfYear() === now.add(1, 'd').dayOfYear()) return 'tomorrow';
	if (time.week() === now.week()) return 'this_week';
	if (time.week() === now.add(1, 'week').week()) return 'next_week';
	return 'later';
}

async function wakeUpTabsAbruptly(ids) {
	var tabs = await getStored('snoozed');
	tabs.forEach(t => {
		if (!ids.includes(t.id)) return;
		t.opened = dayjs().valueOf();
		chrome.tabs.create({url: t.url, active: false})
	});
	await saveTabs(tabs);
	fillTimeGroups(tabs);
}

async function sendTabsToHistory(ids) {
	var tabs = await getStored('snoozed');
	tabs.forEach(t => {
		if (!ids.includes(t.id)) return;
		t.opened = dayjs().valueOf();
		t.deleted = true;
	});
	await saveTabs(tabs);
	fillTimeGroups(tabs);
}

async function removeTabsFromHistory(ids) {
	if (ids.length > 1 && !confirm('Are you sure you want to remove multiple tabs? \n You can\'t undo this.')) return;
	var tabs = await getStored('snoozed');
	tabs = tabs.filter(t => !ids.includes(t.id));
	// await saveTabs(tabs);
	fillTimeGroups(tabs)
}

window.onload = initialize