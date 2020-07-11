'use strict';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NOW = new Date();

var SNOOZED_TABS;
var EXT_OPTIONS = {history: 7};
function initialize() {
	document.querySelector('.settings').addEventListener('click', _ => openURL('settings.html', true), {once:true})
	loadTabs();
	// refresh the alarm if the next one is more than 2 mins away;
	chrome.alarms.get('wakeUpTabs', wut => {
		if (!wut) return;
		var nextRing = new Date(wut.scheduledTime);
		if (nextRing.setMinutes(nextRing.getMinutes() + 2) > NOW) chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1});
	})
	
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

function sortTabs(t) {

}

function sortTabsAndBuildCollections(tabs) {
	if (tabs.length > 0) document.querySelector('.none').style.display = 'none';

	var cc = document.querySelector('.collection-container');
	var today = [], tomorrow = [], week = [], later = [], history = [];
	for (var t = 0; t < tabs.length; t++) {
		var tab_time = new Date(tabs[t].wakeUpTime);
		if (tabs[t].opened) {
			history.push(tabs[t]);
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && sameDate(tab_time, NOW)) {
			today.push(tabs[t]);
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && isNextDay(tab_time, NOW)) {
			tomorrow.push(tabs[t]);
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && isSameWeek(tab_time, NOW)) {
			week.push(tabs[t]);
		} else {
			later.push(tabs[t]);
		}
	}
	
	buildCollection('Today', today)
	buildCollection('Tomorrow', tomorrow)
	buildCollection('This Week', week)
	buildCollection('Later', later)
	if (tabs.length - history.length > 0) cc.innerHTML += '<p><i>Due to API restrictions, tabs may reopen upto 2 minutes late.</i></p>'
	
	buildCollection('History', history)

	if (history.length > 0) cc.innerHTML += `<p><i>Tabs in your history are removed ${EXT_OPTIONS.history} day${EXT_OPTIONS.history>1?'s':''} after they are opened.</i></p>`
	if (tabs.length > 4) {
		cc.innerHTML += '<p>Click <span>here</span> to delete all your tabs</p>';
		cc.querySelector('p span').addEventListener('click', _ => {
			if (!confirm('Are you sure you want to delete all your snoozed tabs? \nYou cannot undo this action.')) return;
			chrome.storage.local.set({snoozed: []});
			chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1});
			updateBadge(0);
			chrome.tabs.reload();
		})
	}

	// add click handlers
	document.querySelectorAll('.tab').forEach(t => {
		t.querySelector('.tab-title').addEventListener('click', tt => openURL(tt.target.title));
		t.querySelector('.remove').addEventListener('click', _ => removeTab(t.getAttribute('data-tab-id')));
	})
}

function sortArrayByDate(t1,t2) {
	var d1 = new Date(t1.wakeUpTime);
	var d2 = new Date(t2.wakeUpTime);
	return (d1 < d2) ? -1 : ((d1 < d2) ? 1 : 0);
}

function isNextDay(d1, d2) {
	if (d1 === d2) return false;
	var d_earlier = d1 < d2 ? d1 : d2;
	var d_later = d1 > d2 ? d1 : d2;
	var tomorrow = new Date(d_earlier.getFullYear(), d_earlier.getMonth(), d_earlier.getDate() + 1);
	var d_a_tomorrow = new Date(tomorrow);
		d_a_tomorrow.setDate(tomorrow.getDate() + 1);
	return tomorrow <= d_later && d_later < d_a_tomorrow;
}

function isSameWeek(d1, d2) {
	if (d1 === d2) return true;
	var d_earlier = d1 < d2 ? d1 : d2;
	var d_later = d1 > d2 ? d1 : d2;
	var sunday = new Date(d_earlier.getFullYear(), d_earlier.getMonth(), d_earlier.getDate() - d_earlier.getDay());
	var next_sunday = new Date(sunday)
		next_sunday.setDate(sunday.getDate() + 7);
	return sunday <= d_later && d_later < next_sunday;
}

function sameYear(d1, d2) {
	return d1.getFullYear() === d2.getFullYear()
}

function sameMonth(d1, d2) {
	return d1.getMonth() === d2.getMonth()
}

function sameDate(d1, d2) {
	return d1.getDate() === d2.getDate()
}

function daysBetween(d1, d2) {
	var db = Math.floor(Math.abs(d1.getTime() - d2.getTime())/8.64e7);
	return db === 0 ? (d1.getDate() === d2.getDate() ? 0 : 1) : db;
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
		src: t.favicon
		// src: '../icons/unknown.png'
	});
	tab_info.appendChild(favicon);

	var div = document.createElement('div');
	var tab_title = Object.assign(document.createElement('div'), {
		className: 'tab-title',
		innerText: t.title,
		title: t.url,
		target: '_blank'
	});
	div.appendChild(tab_title);

	var tab_snoozed_on = Object.assign(document.createElement('div'), {
		className: 'tab-snoozed-on',
		innerText: formatSnoozedOn(t.timeCreated)
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
		title: formatFullTimeStamp(t.wakeUpTime)
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

function formatSnoozedOn(ts) {
	return new Date(ts).toDateString()
}

function formatFullTimeStamp(d) {
	d = new Date(d);
	return d.toLocaleTimeString('default', {hour: "numeric", minute: "numeric"})+ ' on' + d.toDateString().substring(d.toDateString().indexOf(' '));
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

function formatTime(date) {
	var hour = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
	var minutes = date.getMinutes() === 0 ? '00' : (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
	var suffix = date.getHours() > 11 ? 'pm' : 'am';
	return hour + ':' + minutes + suffix;
}

function openURL(url, thisTab = false){
	console.log(thisTab, url);
	if (thisTab)  chrome.tabs.getCurrent(tab => chrome.tabs.update(tab.id, {url:url}));
	if (!thisTab) chrome.tabs.create({url: url});
}

function getTabFromID(id) {
	return document.querySelector(`.tab[data-tab-id="${id}"`)
}

function removeTab(id) {
	SNOOZED_TABS = SNOOZED_TABS.filter(t => t.id !== id)
	chrome.storage.local.set({snoozed: SNOOZED_TABS}, _ => {
		chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1})
		getTabFromID(id).outerHTML = '';
		// .filter(t => !t.opened)
		updateBadge(SNOOZED_TABS.filter(t => !t.opened).length);
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

function updateBadge(num) {
	chrome.browserAction.setBadgeText({text: num > 0 ? num.toString() : ''});
	chrome.browserAction.setBadgeBackgroundColor({color: '#30443f'});
}

window.onload = initialize