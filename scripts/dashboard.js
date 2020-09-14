'use strict';

var SNOOZED_TABS;
async function initialize() {
	document.querySelector('.settings').addEventListener('click', _ => openExtTab('settings.html'), {once:true})
	await cleanUpHistory();
	await loadTabs();
	// refresh the alarm if the next one is more than 2 mins away;
	wakeUpTabsFromBg();
	// refresh dashboard when storage changed if page is not in focus
	chrome.storage.onChanged.addListener(_ => {
		if (document.hasFocus()) return;
		chrome.tabs.query({currentWindow: true, title: 'dashboard | snoozz'}, dashboardTabs => {
			if (dashboardTabs.length === 0) return;
			var dt = dashboardTabs.shift();
			if (dashboardTabs.length > 0) chrome.tabs.remove(dashboardTabs.map(t => t.id));
			chrome.tabs.reload(dt.id)
		});
	})
	showIconOnScroll();
}

async function loadTabs() {
	var tabs = await getStored('snoozed');
	if (!tabs || tabs.length === 0) return;
	sortTabsAndBuildCollections(tabs)
}

function sortTabsAndBuildCollections(tabs) {
	if (tabs.length > 0) document.querySelector('.none').style.display = 'none';

	var cc = document.querySelector('.collection-container');
	var today = [], tomorrow = [], this_week = [], next_week = [], later = [], history = [];
	for (var t = 0; t < tabs.length; t++) {
		var wut = dayjs(tabs[t].wakeUpTime);
		if (tabs[t].opened) { history.push(tabs[t]) }
		else if (wut.dayOfYear() === dayjs().dayOfYear()) { today.push(tabs[t]) }
		else if (wut.dayOfYear() === dayjs().add(1,'d').dayOfYear()) { tomorrow.push(tabs[t]) }
		else if (wut.week() === dayjs().week()) { this_week.push(tabs[t]) }
		else if (wut.week() === dayjs().add(1, 'week').week()) { next_week.push(tabs[t]) }
		else { later.push(tabs[t]) }
	}
	
	buildCollection('Today', today)
	buildCollection('Tomorrow', tomorrow)
	buildCollection('This Week', this_week)
	buildCollection('Next Week', next_week)
	buildCollection('Later', later)
	if (tabs.length - history.length > 0) cc.appendChild(Object.assign(document.createElement('p'),{innerText: 'Due to API restrictions, tabs may reopen upto 5 minutes late.'}));
	
	buildCollection('History', history)

	if (history.length > 0) cc.appendChild(Object.assign(document.createElement('p'),{innerText: `Tabs in your history are removed ${EXT_OPTIONS.history} day${EXT_OPTIONS.history>1?'s':''} after they are opened.`}));

	if (tabs.length > 4) {
		cc.appendChild(Object.assign(document.createElement('p'), {innerHTML: 'Click <span>here</span> to delete all your tabs'}));
		cc.querySelector('p span').addEventListener('click', _ => {
			if (!confirm('Are you sure you want to delete all your snoozed tabs? \nYou cannot undo this action.')) return;
			chrome.storage.local.set({snoozed: []}, _ => chrome.tabs.reload());
			chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1});
			updateBadge([]);
		})
	}

	// add click handlers
	document.querySelectorAll('.tab').forEach(t => {
		t.querySelector('.remove').addEventListener('click', _ => removeTab(t.getAttribute('data-tab-id')));
	})
}

function buildCollection(heading, tabs) {
	if (tabs.length === 0) return;
	tabs = tabs.sort(sortArrayByDate)
	if (heading === 'History') tabs.reverse();
	var cc = document.querySelector('.collection-container');
	var collection = Object.assign(document.createElement('div'), {
		className: 'collection'
	});
	collection.setAttribute('data-type', heading.toLowerCase())

	var h2 = document.createElement('h2');
	var sp = Object.assign(document.createElement('span'), {innerText: heading});
	h2.appendChild(sp);
	collection.append(h2)

	var tab_list = Object.assign(document.createElement('div'), {
		className: 'tab-list'
	});
	tabs.forEach(t => buildTab(t, heading, tab_list))
	collection.appendChild(tab_list);
	cc.appendChild(collection);
}

function buildTab(t, heading, tab_list) {
	var tab = Object.assign(document.createElement('div'), {className: 'tab'});
	tab.setAttribute('data-tab-id', t.id);

	var input = Object.assign(document.createElement('input'), {type: 'checkbox'});
	var tab_select = Object.assign(document.createElement('div'), {className: 'tab-select'});
	tab_select.appendChild(input);
	

	var favicon = Object.assign(document.createElement('img'), {className: 'favicon', src: !t.favicon || t.favicon === '' ? '../icons/unknown.png' : t.favicon});
	var tab_info = Object.assign(document.createElement('div'), {className: 'tab-info flex'});
	tab_info.appendChild(favicon);

	var div = document.createElement('div');
	var tab_title = Object.assign(document.createElement('a'), { className: 'tab-title', innerText: t.title, title: t.url, href: t.url, target: '_blank'});
	div.appendChild(tab_title);

	var tab_snoozed_on = Object.assign(document.createElement('div'), {
		className: 'tab-snoozed-on',
		innerText: dayjs(t.timeCreated).format('ddd, MMM D[ @ ]h:mm a'),
		title: dayjs(t.timeCreated).format('h:mm a [on] ddd, D MMMM YYYY')
	});
	div.appendChild(tab_snoozed_on);
	tab_info.appendChild(div);


	var snoozed_until = Object.assign(document.createElement('div'), {className: 'tab-snooze-until'});
	var time = Object.assign(document.createElement('div'), {
		className: 'time',
		innerText: formatSnoozedUntil(t.wakeUpTime, heading === 'History'),
		title: dayjs(t.wakeUpTime).format('h:mm a [on] ddd D MMM YYYY')
	});
	var post = Object.assign(document.createElement('div'), {className: 'post'});
	snoozed_until.append(post, time);

	var tab_actions = Object.assign(document.createElement('div'), {className: 'tab-actions'});
	var remove = Object.assign(document.createElement('span'), {className: 'remove', innerHTML: '&times;'});
	remove.addEventListener('click', _ => removeTab(t.id))
	tab_actions.appendChild(remove);

	tab.append(tab_select, tab_info, snoozed_until, tab_actions)

	tab_list.appendChild(tab);
}

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

function getTabFromID(id) {
	return document.querySelector(`.tab[data-tab-id="${id}"`)
}

function removeTab(id) {
	SNOOZED_TABS = SNOOZED_TABS.filter(t => t.id !== id)
	chrome.storage.local.set({snoozed: SNOOZED_TABS}, _ => {
		wakeUpTabsFromBg();
		updateBadge(SNOOZED_TABS);
		var tab = getTabFromID(id);
		if (tab) tab.outerHTML = '';
		document.querySelectorAll('.collection').forEach(c => {
			if (!c.querySelector('.tab')){
				if (c.getAttribute('data-type') === 'history') c.nextElementSibling.outerHTML = ''
				c.outerHTML = '';
			}
		})
	});
	if (SNOOZED_TABS.length <= 0) {
		document.querySelectorAll('.collection, .collection-container p').forEach(el => el.outerHTML = '');
		document.querySelector('.none').style.display = 'block';
	}
}

window.onload = initialize