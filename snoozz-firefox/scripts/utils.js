'use strict';

function sortArrayByDate(t1,t2) {
	var d1 = new Date(t1.wakeUpTime);
	var d2 = new Date(t2.wakeUpTime);
	return (d1 < d2) ? -1 : ((d1 > d2) ? 1 : 0);
}

function isToday(d) {
	const NOW = new Date();
	return sameYear(NOW, d) && sameMonth(NOW, d) && sameDate(NOW, d);
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

function isNextWeek(d1,d2) {
	if (d1 === d2) return false;
	var d_earlier = d1 < d2 ? d1 : d2;
	var d_later = d1 > d2 ? d1 : d2;
	var coming_sunday = new Date(d_earlier.getFullYear(), d_earlier.getMonth(), d_earlier.getDate() + (7-d_earlier.getDay()));
	var next_sunday = new Date(coming_sunday);
	next_sunday = next_sunday.setDate(next_sunday.getDate() + 7);
	return coming_sunday <= d_later && d_later < next_sunday;
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

function getNextDay(dayNum) {
	// 0: sunday ... 6: saturday
	var d = new Date();
	return d.setDate(d.getDate() + ((7 + dayNum - d.getDay()) % 7 === 0 ? 7 : (7 + dayNum - d.getDay()) % 7));
}

// 11:00am or 6:00pm
function formatTime(date, showMinutes = true) {
	var hour = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
	var minutes = date.getMinutes() === 0 ? '00' : (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
	var suffix = date.getHours() > 11 ? 'pm' : 'am';
	return hour + (showMinutes ? ':' + minutes : '') + suffix;
}

// Sun July 12 2020
function getPrettyDate(ts) {
	return new Date(ts).toDateString()
}

function getPrettyTimestamp(d) {
	return d.toLocaleTimeString('default', {hour: "numeric", minute: "numeric"})+ ' on' + d.toDateString().substring(d.toDateString().indexOf(' '));
}

function switchToTabIfItExists(url, callback) {
	browser.tabs.query({currentWindow: true, title: 'dashboard | snoozz'}, dashboardTabs => {
		browser.tabs.query({currentWindow: true, title: 'settings | snoozz'}, settingsTabs => {
			var tabs = dashboardTabs.concat(settingsTabs);
			console.log(tabs, tabs.length);
			if (tabs.length === 0) {browser.tabs.create({url: url});return;}
			var openTabID = tabs.findIndex(t => t.active === true);
			var openTab = openTabID ? tabs.splice(openTabID, 1).pop() : tabs.shift();
			if (tabs.length > 0) browser.tabs.remove(tabs.map(t => t.id));
			browser.tabs.update(openTab.id, {url: url, active: true});
			if (callback) callback();
		});
	});
}

function refreshDashboardTabIfItExists() {
	browser.tabs.query({currentWindow: true, title: 'dashboard | snoozz'}, dashboardTabs => {
		if (dashboardTabs.length === 0) return;
		var dt = dashboardTabs.shift();
		if (dashboardTabs.length > 0) browser.tabs.remove(dashboardTabs.map(t => t.id));
		browser.tabs.reload(dt.id)
	});
}

function openURL(url, external = false, callback){
	if (url === 'dashboard.html' || url === 'settings.html' || url === '../dashboard.html' || url === '../settings.html') {
		switchToTabIfItExists(url, callback);	
	} else if (!external) {
		browser.tabs.query({currentWindow: true, active: true}, current => browser.tabs.update(current[0].id, {url:url}));
	} else if (external) {
		browser.tabs.create({url: url});
	}
}

function updateBadge(tabs) {
	var num = 0;
	if (tabs.length > 0 && EXT_OPTIONS.badge && EXT_OPTIONS.badge === 'all') num = tabs.filter(t => !t.opened).length;
	if (tabs.length > 0 && EXT_OPTIONS.badge && EXT_OPTIONS.badge === 'today') num = tabs.filter(t => !t.opened && isToday(new Date(t.wakeUpTime))).length;
	browser.browserAction.setBadgeText({text: num > 0 ? num.toString() : ''});
	browser.browserAction.setBadgeBackgroundColor({color: '#CF5A77'});
}

function showIconOnScroll() {
	var header = document.querySelector('body > div.flex.center')
	var logo = document.querySelector('body > div.scroll-logo');
	if (!header || !logo) return;

	logo.addEventListener('click', _ => window.scrollTo({top: 0,behavior: 'smooth'}));
	document.addEventListener('scroll', _ => {
		if (logo.classList.contains('hidden') && window.pageYOffset > (header.offsetHeight + header.offsetTop)) {
			logo.classList.remove('hidden')
		} else if (!logo.classList.contains('hidden') && window.pageYOffset <= (header.offsetHeight + header.offsetTop)) {
			logo.classList.add('hidden')
		}
	})
	
}