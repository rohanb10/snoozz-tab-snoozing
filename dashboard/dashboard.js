const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NOW = new Date();

var snoozedTabs;
function initialize() {
	document.querySelector('.settings').addEventListener('click', _ => openURL('settings.html', true))
	loadTabs();
}

function loadTabs() {
	chrome.storage.local.get(['snoozed'], stor => {
		snoozedTabs = stor.snoozed;
		sortTabsAndBuildCollections(stor.snoozed)
	});
}

function sortTabsAndBuildCollections(tabs) {
	if (tabs.length > 0) document.querySelector('.none').style.display = 'none';

	var today = [], tomorrow = [], week = [], later = [], history = [];
	tabs.forEach(t => {
		var tab_time = new Date(t.snoozeUntil)
		if (t.reopened) {
			history.push(t)
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && sameDate(tab_time, NOW)) {
			today.push(t)
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && daysBetween(tab_time, NOW) === 1) {
			tomorrow.push(t)
		} else if (sameYear(tab_time, NOW) && sameMonth(tab_time, NOW) && sameWeek(tab_time, NOW)) {
			week.push(t)
		} else {
			later.push(t)
		}
	});
	buildCollection('Today', today)
	buildCollection('Tomorrow', tomorrow)
	buildCollection('This Week', week)
	buildCollection('Later', later)
	buildCollection('History', history)
}

function sortByTimeAndDate(arr) {
	arr.sort(function(t1, t2) {
		var d1 = new Date(t1.snoozeUntil), d2 = new Date(t2.snoozeUntil);
			// Compare the 2 dates
		if (d1 < d2) return -1;
		if (d1 > d2) return 1;
		return 0;
	});
	return arr;
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
function sameWeek(d1,d2) {
	var d_earlier = d1 < d2 ? d1 : d2;
	var d_later = d1 > d2 ? d1 : d2;
	return daysBetween(d1, d2) < 7 && d_later.getDay() - d_earlier.getDay() > 0
}

function daysBetween(d1, d2) {
	var db = Math.floor(Math.abs(d1.getTime() - d2.getTime())/8.64e7);
	if (db === 0) return d1.getDate() === d2.getDate() ? 0 : 1
	return db;
}

function buildCollection(heading, tabs) {
	if (tabs.length === 0) return;
	tabs = sortByTimeAndDate(tabs);
	var cc = document.querySelector('.collection-container');
	var collection = Object.assign(document.createElement('div'), {
		className: 'collection'
	});
	collection.setAttribute('data-type', heading.toLowerCase())

	var h2 = document.createElement('h2');
	h2.innerText = heading
	collection.append(h2)

	var tab_list = Object.assign(document.createElement('div'), {
		className: 'tab-list'
	});
	tabs.forEach(t => {
		var tab = Object.assign(document.createElement('div'), {
			className: 'tab',
		});
		tab.setAttribute('data-tab-id', t.id);

		var tab_select = Object.assign(document.createElement('div'), { 
			className: 'tab-select'
		});
		var input = Object.assign(document.createElement('input'), {
			type: 'checkbox',
			id: 'hi'
		});
		tab_select.appendChild(input);
		tab.appendChild(tab_select);


		var tab_info = Object.assign(document.createElement('div'), {
			className: 'tab-info flex'
		});

		var favicon = Object.assign(document.createElement('img'), {
			className: 'favicon',
			src: t.favicon
		});
		tab_info.appendChild(favicon);

		var div = document.createElement('div');
		var tab_title = Object.assign(document.createElement('div'), {
			className: 'tab-title',
			innerText: t.title,
			title: t.url,
			href: t.url,
			target: '_blank'
		});
		tab_title.onclick = _ => openURL(t.url)
		div.appendChild(tab_title);

		var tab_snoozed_on = Object.assign(document.createElement('div'), {
			className: 'tab-snoozed-on',
			innerText: formatSnoozedOn(t.timestamp)
		});
		div.appendChild(tab_snoozed_on);
		tab_info.appendChild(div);

		tab.appendChild(tab_info);

		var snoozed_until = Object.assign(document.createElement('div'), {
			className: 'tab-snooze-until'
		});
		var time = Object.assign(document.createElement('div'), {
			className: 'time',
			innerText: formatSnoozedUntil(t.snoozeUntil),
			title: new Date(t.snoozeUntil).toDateString()
		});
		// snoozed_until.appendChild(time);
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
		remove.onclick = _ => removeTab(t.id)
		tab_actions.appendChild(remove);
		tab.appendChild(tab_actions);

		tab_list.appendChild(tab);
	})
	collection.appendChild(tab_list);
	cc.appendChild(collection);
}

function formatSnoozedOn(ts) {
	return new Date(ts).toDateString()
}

function formatSnoozedUntil(ts) {
	var date = new Date(ts);
	if (daysBetween(date, NOW) === 0){
		return (date.getHours() > 17 ? 'Tonight' : 'Today') +' @ ' + formatTime(date);
	} else if(daysBetween(date, NOW) === 1) {
		return 'Tomorrow @ ' + formatTime(date);
	}else if (sameWeek(date, NOW)) {
		return DAYS[date.getDay()] + ' @ ' + formatTime(date);
	} else {
		return date.toDateString().substring(0, date.toDateString().lastIndexOf(' '));
	}
}

function formatTime(date) {
	var hour = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
	var minutes = date.getMinutes() === 0 ? '00' : date.getMinutes();
	var suffix = date.getHours() > 11 ? 'pm' : 'am';
	return hour + ':' + minutes + suffix;
}

function openURL(url, thisTab = false){
	if (thisTab)  chrome.tabs.getCurrent(tab => chrome.tabs.update(tab.id, {url:url}));
	if (!thisTab) chrome.tabs.create({url: url});
}
function removeTab(id) {
	snoozedTabs = snoozedTabs.filter(t => t.id !== id)
	chrome.storage.local.set({snoozed: snoozedTabs}, _ => {
		document.querySelector(`.tab[data-tab-id="${id}"`).outerHTML = '';
	});
}

window.onload = initialize