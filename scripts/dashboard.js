'use strict';

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
	// sortTabsAndBuildCollections(tabs)

	buildTimeGroups();
	fillTimeGroups(tabs);
	updateTimeGroups();
}

function buildTimeGroups() {
	var container = document.getElementById('time-container');
	
	TIME_GROUPS.forEach(t => {
		var tID = t.replace(/ /g,"_").toLowerCase();
		var timeGroup = Object.assign(document.createElement('div'), {className: 'time-group', id: tID});
		var header = Object.assign(document.createElement('div'), {className: 'flex time-header'});
		var name = Object.assign(document.createElement('h2'), {className: 'time-name', innerText: t});
		var timeAction = Object.assign(document.createElement('div'), {
			className: `time-action ${tID === 'history' ? 'history' : ''}`,
			innerText: tID === 'history' ? 'clear history' : 'wake up all'
		});
		timeAction.addEventListener('click', async _ => {
			if (tID === 'history') {
				await removeTabsFromHistory(Array.from(document.querySelectorAll('#history .tab')).map(t =>t.id))
				updateTimeGroups()
			} else {

			}
			// wake up all, then add to history
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
		console.log(name, tabCount);
		tg.querySelector('.time-action').classList.toggle('hidden', tabCount <= 2);
	})
}

function fillTimeGroups(tabs) {
	document.querySelectorAll('p, .tab').forEach(t => t.remove());
	// regular
	tabs.filter(t => !t.opened).sort((t1,t2) => t1.wakeUpTime - t2.wakeUpTime).forEach(f => document.getElementById(getTimeGroup(f)).append(buildTab(f)))
	// history
	if (tabs.some(t => t.opened)) {
		tabs.filter(t => t.opened).sort((t1,t2) => t2.opened - t1.opened).forEach(h => document.getElementById(getTimeGroup(h)).append(buildTab(h)))	
		document.getElementById('history').appendChild(Object.assign(document.createElement('p'),{innerText: `Tabs in your history are removed ${EXT_OPTIONS.history} day${EXT_OPTIONS.history>1?'s':''} after they are opened.`}));
	}
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
		// wake up tabs
	});
	var removeBtn = Object.assign(document.createElement('div'), {className:'remove-button', innerHTML: '&times;'});
	removeBtn.addEventListener('click', _ => {
		console.log('hi');
		if (t.opened) removeTabsFromHistory([t.id]);
		if (!t.opened) sendTabsToHistory([t.id]);
	});

	var tab = Object.assign(document.createElement('div'), {className: 'tab', id: t.id});
	tab.append(iconContainer, titleContainer, wakeUpContainer, wakeUpBtn, removeBtn);
	return tab;
}

// function sortTabsAndBuildCollections(tabs) {
// 	if (tabs.length > 0) document.querySelector('.initial-state').style.display = 'none';

// 	var cc = document.querySelector('.collection-container');
// 	var today = [], tomorrow = [], this_week = [], next_week = [], later = [], history = [];
// 	for (var t = 0; t < tabs.length; t++) {
// 		var wut = dayjs(tabs[t].wakeUpTime);
// 		if (tabs[t].opened) { history.push(tabs[t]) }
// 		else if (wut.dayOfYear() === dayjs().dayOfYear()) { today.push(tabs[t]) }
// 		else if (wut.dayOfYear() === dayjs().add(1,'d').dayOfYear()) { tomorrow.push(tabs[t]) }
// 		else if (wut.week() === dayjs().week()) { this_week.push(tabs[t]) }
// 		else if (wut.week() === dayjs().add(1, 'week').week()) { next_week.push(tabs[t]) }
// 		else { later.push(tabs[t]) }
// 	}
	
// 	buildCollection('Today', today)
// 	buildCollection('Tomorrow', tomorrow)
// 	buildCollection('This Week', this_week)
// 	buildCollection('Next Week', next_week)
// 	buildCollection('Later', later)
// 	if (tabs.length - history.length > 0) cc.appendChild(Object.assign(document.createElement('p'),{innerText: 'Due to API restrictions, tabs may reopen upto 5 minutes late.'}));
	
// 	buildCollection('History', history)

// 	if (history.length > 0) cc.appendChild(Object.assign(document.createElement('p'),{innerText: `Tabs in your history are removed ${EXT_OPTIONS.history} day${EXT_OPTIONS.history>1?'s':''} after they are opened.`}));

// 	if (tabs.length > 4) {
// 		cc.appendChild(Object.assign(document.createElement('p'), {innerHTML: 'Click <span>here</span> to delete all your tabs'}));
// 		cc.querySelector('p span').addEventListener('click', _ => {
// 			if (!confirm('Are you sure you want to delete all your snoozed tabs? \nYou cannot undo this action.')) return;
// 			chrome.storage.local.set({snoozed: []}, _ => chrome.tabs.reload());
// 			chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1});
// 			updateBadge([]);
// 		})
// 	}
// }

// function buildCollection(heading, tabs) {
// 	if (tabs.length === 0) return;
// 	tabs = tabs.sort(sortArrayByDate);
// 	// tabs = tabs.sort((t1,t2) => t1.wakeUpTime - t2.wakeUpTime);
// 	if (heading === 'History') tabs.reverse();
// 	var cc = document.querySelector('.collection-container');
// 	var collection = Object.assign(document.createElement('div'), {
// 		className: 'collection'
// 	});
// 	collection.setAttribute('data-type', heading.toLowerCase())

// 	var h2 = document.createElement('h2');
// 	var sp = Object.assign(document.createElement('span'), {innerText: heading});
// 	h2.appendChild(sp);
// 	collection.append(h2)

// 	var tab_list = Object.assign(document.createElement('div'), {
// 		className: 'tab-list'
// 	});
// 	tabs.forEach(t => buildTab(t, heading, tab_list))
// 	collection.appendChild(tab_list);
// 	cc.appendChild(collection);
// }

// function buildTab(t, heading, tab_list) {
// 	var tab = Object.assign(document.createElement('div'), {className: 'tab'});
// 	tab.setAttribute('data-tab-id', t.id);

// 	var input = Object.assign(document.createElement('input'), {type: 'checkbox'});
// 	var tab_select = Object.assign(document.createElement('div'), {className: 'tab-select'});
// 	tab_select.appendChild(input);
	

// 	var favicon = Object.assign(document.createElement('img'), {className: 'favicon', src: !t.favicon || t.favicon === '' ? '../icons/unknown.png' : t.favicon});
// 	var tab_info = Object.assign(document.createElement('div'), {className: 'tab-info flex'});
// 	tab_info.appendChild(favicon);

// 	var div = document.createElement('div');
// 	var tab_title = Object.assign(document.createElement('a'), { className: 'tab-title', innerText: t.title, title: t.url, href: t.url, target: '_blank'});
// 	div.appendChild(tab_title);

// 	var tab_snoozed_on = Object.assign(document.createElement('div'), {
// 		className: 'tab-snoozed-on',
// 		innerText: dayjs(t.timeCreated).format('ddd, MMM D[ @ ]h:mm a'),
// 		title: dayjs(t.timeCreated).format('h:mm a [on] ddd, D MMMM YYYY')
// 	});
// 	div.appendChild(tab_snoozed_on);
// 	tab_info.appendChild(div);


// 	var snoozed_until = Object.assign(document.createElement('div'), {className: 'tab-snooze-until'});
// 	var time = Object.assign(document.createElement('div'), {
// 		className: 'time',
// 		innerText: formatSnoozedUntil(t.wakeUpTime, heading === 'History'),
// 		title: dayjs(t.wakeUpTime).format('h:mm a [on] ddd D MMM YYYY')
// 	});
// 	var post = Object.assign(document.createElement('div'), {className: 'post'});
// 	snoozed_until.append(post, time);

// 	var tab_actions = Object.assign(document.createElement('div'), {className: 'tab-actions'});
// 	var remove = Object.assign(document.createElement('span'), {className: 'remove', innerHTML: '&times;'});
// 	remove.addEventListener('click', _ => removeTabs([t.id]))
// 	tab_actions.appendChild(remove);

// 	tab.append(tab_select, tab_info, snoozed_until, tab_actions)

// 	tab_list.appendChild(tab);
// }

function formatSnoozedUntil(ts, isHistory = false) {
	var date = dayjs(ts);
	if (isHistory) return date.format('ddd, MMM D');
	if (date.dayOfYear() === dayjs().dayOfYear()){
		return (date.hour() > 17 ? 'Tonight' : 'Today') + ' @ ' + date.format('h:mm a');
	} else if(date.dayOfYear() === dayjs().add(1,'d').dayOfYear()) {
		return 'Tomorrow @ ' + date.format('h:mm a');
	}else if (date.week() === dayjs().week()) {
		return date.format('ddd[ @ ]h:mm a');
	} else {
		return date.format('ddd, MMM D[ @ ]h:mm a');
	}
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

async function sendTabsToHistory(ids) {
	var tabs = await getStored('snoozed');
	tabs.forEach(t => {
		if (!ids.includes(t.id)) return;
		t.opened = dayjs().valueOf();
		t.deleted = true;
	});
	fillTimeGroups(tabs);
	updateTimeGroups();
	// await saveTabs(tabs);
}

async function removeTabsFromHistory(ids) {
	if (ids.length > 1 && !confirm('Are you sure you want to remove multiple tabs? \n You can\'t undo this.')) return;
	var tabs = await getStored('snoozed');
	// await saveTabs(tabs.filter(t => !ids.includes(t.id)));
	
	// tabs.filter(t => ids.includes(t.id)).map(t => t.id).forEach(id => {
	// 	var tab = document.querySelector(`.tab[data-tab-id="${id}"`);
	// 	if (tab) tab.outerHTML = '';	
	// 	console.log(id);
	// })

	ids.forEach(id => {var tab = document.getElementById(id); if (tab) tab.remove()})

	// document.querySelectorAll('.collection').forEach(c => {
	// 	if (!c.querySelector('.tab')){
	// 		if (c.getAttribute('data-type') === 'history') c.nextElementSibling.outerHTML = ''
	// 		c.outerHTML = '';
	// 	}
	// });
}

window.onload = initialize