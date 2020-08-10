'use strict';

var SNOOZED_TABS;
function initialize() {
	document.querySelector('.settings').addEventListener('click', _ => openURL('settings.html'), {once:true})
	loadTabs();
	// refresh the alarm if the next one is more than 2 mins away;
	chrome.alarms.get('wakeUpTabs', wut => {
		if (!wut) return;
		var nextRing = new Date(wut.scheduledTime);
		if (nextRing.setMinutes(nextRing.getMinutes() + 2) > NOW) chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1});
	});
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

function loadTabs() {
	chrome.storage.local.get(['snoozed','snoozedOptions'], s => {
		SNOOZED_TABS = s.snoozed;
		EXT_OPTIONS = Object.assign(EXT_OPTIONS, s.snoozedOptions);
		if (!s.snoozedOptions || Object.keys(s.snoozedOptions).length === 0) chrome.storage.local.set({snoozedOptions: EXT_OPTIONS});
		if (!s.snoozed || Object.keys(s.snoozed).length === 0) return;
		sortTabsAndBuildCollections(s.snoozed)
	});
}

function sortTabsAndBuildCollections(tabs) {
	if (tabs.length > 0) document.querySelector('.none').style.display = 'none';

	var cc = document.querySelector('.collection-container');
	var today = [], tomorrow = [], this_week = [], next_week = [], later = [], history = [];
	for (var t = 0; t < tabs.length; t++) {
		var tab_time = new Date(tabs[t].wakeUpTime);
		if (tabs[t].opened) {
			history.push(tabs[t]);
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && sameDate(tab_time, NOW)) {
			today.push(tabs[t]);
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && isNextDay(tab_time, NOW)) {
			tomorrow.push(tabs[t]);
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && isSameWeek(tab_time, NOW)) {
			this_week.push(tabs[t]);
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && isNextWeek(tab_time, NOW)) {
			next_week.push(tabs[t]);
		} else {
			later.push(tabs[t]);
		}
	}
	
	buildCollection('Today', today)
	buildCollection('Tomorrow', tomorrow)
	buildCollection('This Week', this_week)
	buildCollection('Next Week', next_week)
	buildCollection('Later', later)
	if (tabs.length - history.length > 0) cc.appendChild(Object.assign(document.createElement('p'),{innerText: 'Due to API restrictions, tabs may reopen upto 2 minutes late.'}));
	
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
		t.querySelector('.tab-title').addEventListener('click', tt => openURL(tt.target.title, true));
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
	var tab = Object.assign(document.createElement('div'), {
		className: 'tab',
	});
	tab.setAttribute('data-tab-id', t.id);

	var tab_select = Object.assign(document.createElement('div'), { 
		className: 'tab-select'
	});
	var input = Object.assign(document.createElement('input'), {
		type: 'checkbox',
	});
	tab_select.appendChild(input);
	tab.appendChild(tab_select);

	var tab_info = Object.assign(document.createElement('div'), {
		className: 'tab-info flex'
	});

	var favicon = Object.assign(document.createElement('img'), {
		className: 'favicon',
		src: !t.favicon || t.favicon === '' ? '../icons/unknown.png' : t.favicon
	});
	tab_info.appendChild(favicon);

	var div = document.createElement('div');
	var tab_title = Object.assign(document.createElement('a'), {
		className: 'tab-title',
		innerText: t.title,
		title: t.url,
		target: '_blank'
	});
	div.appendChild(tab_title);

	var tab_snoozed_on = Object.assign(document.createElement('div'), {
		className: 'tab-snoozed-on',
		innerText: getPrettyDate(t.timeCreated)
	});
	div.appendChild(tab_snoozed_on);
	tab_info.appendChild(div);

	tab.appendChild(tab_info);

	var snoozed_until = Object.assign(document.createElement('div'), {
		className: 'tab-snooze-until'
	});
	var time = Object.assign(document.createElement('div'), {
		className: 'time',
		innerText: formatSnoozedUntil(t.wakeUpTime, heading === 'History'),
		title: getPrettyTimestamp(new Date(t.wakeUpTime))
	});
	var post = Object.assign(document.createElement('div'), {
		className: 'post',
	});
	snoozed_until.appendChild(post);
	snoozed_until.appendChild(time);
	tab.appendChild(snoozed_until);

	var tab_actions = Object.assign(document.createElement('div'), {
		className: 'tab-actions'
	});
	var remove = Object.assign(document.createElement('span'), {
		className: 'remove',
		innerHTML: '&times;',
	});
	tab_actions.appendChild(remove);
	tab.appendChild(tab_actions);

	tab_list.appendChild(tab);
}

function formatSnoozedUntil(ts, isHistory = false) {
	var date = new Date(ts);
	if (isHistory) return date.toDateString().substring(0, date.toDateString().lastIndexOf(' '));
	if (sameYear(date, NOW) && sameMonth(date, NOW) && sameDate(date, NOW)){
		return (date.getHours() > 17 ? 'Tonight' : 'Today') +' @ ' + formatTime(date);
	} else if(isNextDay(date, NOW)) {
		return 'Tomorrow @ ' + formatTime(date);
	}else if (isSameWeek(date, NOW)) {
		return DAYS[date.getDay()] + ' @ ' + formatTime(date);
	} else {
		return date.toDateString().substring(0, date.toDateString().lastIndexOf(' '));
	}
}

function getTabFromID(id) {
	return document.querySelector(`.tab[data-tab-id="${id}"`)
}

function removeTab(id) {
	SNOOZED_TABS = SNOOZED_TABS.filter(t => t.id !== id)
	chrome.storage.local.set({snoozed: SNOOZED_TABS}, _ => {
		chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1})
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