'use strict';

const NOW = new Date();
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
var EXT_OPTIONS = {morning: 9, evening: 18};

function initialize() {
	getCurrentTab();

	// custom snooze defaults + listeners
 	document.querySelectorAll('input').forEach(i => i.addEventListener('input', e => e.target.classList.remove('invalid')));

 	
 	document.querySelector('.dashboard-btn').addEventListener('click', openLink);
 	document.querySelector('.settings').addEventListener('click', openLink);

 	customChoiceHandler()

 	document.addEventListener('snoozeEvent', changeTabAfterSnooze);

 	chrome.storage.local.get(['snoozed', 'snoozedOptions'], s => {
 		EXT_OPTIONS = Object.assign(EXT_OPTIONS, s.snoozedOptions);

 		if (!s.snoozedOptions || Object.keys(s.snoozedOptions).length === 0) chrome.storage.local.set({snoozedOptions: EXT_OPTIONS});
 		configureSnoozeOptions();
 		
 		if (!s.snoozed || Object.keys(s.snoozed).length === 0) return;

 		var todayCount = (s.snoozed.filter(t => sameDay(NOW, new Date(t.wakeUpTime)) && !t.opened)).length;
 		if (todayCount === 0) return;
 		var upc = document.querySelector('.upcoming');
 		upc.innerText = `${todayCount}`;
 		upc.style.opacity = "1"
 	});
}

var closeTimeout, dateEdited = false;
function customChoiceHandler() {
	var cc = document.querySelector('.custom-choice');
	var formDate = cc.querySelector('input[type="date"]');
	var formTime = cc.querySelector('input[type="time"]');
	var submitBtn = cc.querySelector('.submit-btn');
	// default values for form
	formDate.setAttribute('min', NOW.toISOString().split('T')[0]);
	formDate.value = NOW.toISOString().split('T')[0];
	formTime.value = NOW.toTimeString().substring(0,5);

	cc.addEventListener('mouseover', _ => {
		cc.classList.add('active');
		clearTimeout(closeTimeout)
	});
	cc.addEventListener('mousemove', _ => {
		cc.classList.add('active');
		clearTimeout(closeTimeout)
	});
	[formDate,formTime].forEach(f => f.addEventListener('click', _ => {
		cc.classList.add('focused');
		clearTimeout(closeTimeout)
	}));
	[formDate,formTime].forEach(f => f.addEventListener('blur', _ => {
		cc.classList.remove('focused');
		clearTimeout(closeTimeout)
	}));
	[formDate,formTime].forEach(f => f.addEventListener('change', _ => {
		var isEdited = formDate.value !== NOW.toISOString().split('T')[0] || formTime.value !== NOW.toTimeString().substring(0,5);
		if (isEdited) submitBtn.classList.remove('disabled');
	}, {once:true}));
	cc.addEventListener('mouseout', _=> {
		if (dateEdited) return;
		if (!submitBtn.classList.contains('disabled')) return;
		closeTimeout = setInterval(_ => cc.classList.remove('active'), 4000);
	})

 	// submit button click
	cc.querySelector('.submit-btn').addEventListener('click', submitCustom);
}

function openLink(el) {
	var href = el.target.dataset.href;
	chrome.tabs.create({'url': `./${href}.html`});
}

function getCurrentTab() {
	chrome.tabs.query({active: true, currentWindow: true}, tabs => {
		var tab = tabs.length > 0 && tabs[0] ? tabs[0] : false;
		if (!tabs) return;

		const validProtocols = ['http', 'https', 'file', 'ftp'];
		var tabProto = tab.url.substring(0, tab.url.indexOf(':'))
		if (!validProtocols.includes(tabProto)) {
			tab.title = `Cannot snooze tabs starting with\n` + tabProto + '://';
			tab.url = '';
			document.querySelectorAll('.choice, .custom-choice').forEach(c => c.classList.add('disabled'));
		}

		document.getElementById('tab-title').innerText = tab.title;
		document.getElementById('tab-favicon').src = tab.favIconUrl && tab.favIconUrl.length > 0 ? tab.favIconUrl : '../icons/unknown.png';
	});

}

function sameDay(d1, d2)  {
	if (d1.getFullYear() !== d2.getFullYear()) return false;
	if (d1.getMonth() !== d2.getMonth()) return false;
	if (d1.getDate() !== d2.getDate()) return false;
	return true;
}

function configureSnoozeOptions() {
	var options = document.querySelectorAll('.choice');

	options.forEach(o => {
		// disable invalid options
		if (o.dataset.option === 'today-morning' && NOW.getHours() >= EXT_OPTIONS.morning) o.classList.add('disabled')
		if (o.dataset.option === 'today-evening' && NOW.getHours() >= EXT_OPTIONS.evening) o.classList.add('disabled')

		var config = getTimeForOption(o.dataset.option);

		// set up snooze actions for each option
		o.addEventListener('click', e => snooze(config.time, e.target.dataset.option));

		// display time + date correctly for each option
		var time_date = o.querySelector('.time').parentElement;
		time_date.querySelector('.time').innerText = config.label[1];
		time_date.querySelector('.date').outerHTML = config.label[0].length > 0 ? `<div class="date">${config.label[0]}</div>` : ``;
		time_date.title = formatFullTimeStamp(config.time);
	})
}

function formatFullTimeStamp(d) {
	return d.toLocaleTimeString('default', {hour: "numeric", minute: "numeric"})+ ' on' + d.toDateString().substring(d.toDateString().indexOf(' '));
}

function getNextDay(dayNum) {
	// 0: sunday ... 6: saturday
	var d = new Date();
	return d.setDate(d.getDate() + ((7 + dayNum - d.getDay()) % 7 === 0 ? 7 : (7 + dayNum - d.getDay()) % 7));
}

function getTimeForOption(option) {
	// calculate date for option
	var t = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
	if (option === 'tom-morning') {
		t.setDate(t.getDate() + 1);
	} else if (option === 'tom-evening') {
		t.setDate(t.getDate() + 1);
	} else if (option === 'weekend') {
		t = new Date(getNextDay(6));
	} else if (option === 'monday') {
		t = new Date(getNextDay(1));
	} else if (option === 'week') {
		t.setDate(t.getDate() + 7);
	} else if (option === 'month') {
		t.setMonth(t.getMonth() + 1);
	}

	// calculate time for option
	if (option.indexOf('evening') > -1) {
		t.setHours(EXT_OPTIONS.evening);
	} else if (['week', 'month'].indexOf(option) > -1) {
		t.setHours(NOW.getHours())
	} else {
		t.setHours(EXT_OPTIONS.morning);
	}

	var label = [];
	if (['today-morning', 'today-evening'].indexOf(option) > -1){
		label.push('', formatHours(t.getHours()));
	}
	else if (['tom-morning', 'tom-evening', 'weekend'].indexOf(option) > -1){
		label.push(`${DAYS[t.getDay()]}`, formatHours(t.getHours()));
	}
	else if (['monday', 'week', 'month'].indexOf(option) > -1){
		label.push(MONTHS[t.getMonth()] + ' ' + t.getDate(), formatHours(t.getHours()));
	}

	return {time: t, label: label};
}

function formatHours(num) {
	var hour = num % 12 === 0 ? 12 : num % 12;
	var suffix = num > 11 ? 'pm' : 'am';
	return hour + suffix;
}

function submitCustom() {
	var d = document.getElementById('date-input');
	var t = document.getElementById('time-input');
	var btn = document.querySelector('.submit-btn');

	if (d.value.length === 0 || !d.value.match(/^\d{4}-\d{2}-\d{2}$/)) {
		d.classList.add('invalid');
		return;
	}
	if (t.value.length === 0 || !t.value.match(/^\d{2}:\d{2}$/)) {
		t.classList.add('invalid');
		return;
	}
	var time = new Date(`${d.value} ${t.value}`);
	if (time < NOW) {
		t.classList.add('invalid');
		return;
	}
	btn.classList.add('disabled');
	d.setAttribute('disabled', true)
	t.setAttribute('disabled', true)
	snooze(time, 'custom');
}

function snooze(snoozeTime, label) {
	if (snoozeTime < NOW) return;
	chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1})
	chrome.storage.local.get(['snoozed'], function(storage) {
		storage.snoozed = storage.snoozed || [];
		chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
			var tab = tabs[0];
			storage.snoozed.push({
				id: Math.random().toString(36).slice(-6),
				title: tab.title,
				url: tab.url,
				favicon: tab.favIconUrl,
				wakeUpTime: snoozeTime.getTime(),
				timeCreated: NOW.getTime(),
			})
			chrome.storage.local.set(
				{snoozed: storage.snoozed},
				function() {
					document.dispatchEvent(new CustomEvent('snoozeEvent', {detail: {label: label}}));
					document.body.style.pointerEvents = 'none';
					updateBadge(storage.snoozed.filter(t => !t.opened).length);
					setTimeout(_ => chrome.tabs.remove(tab.id), 2000);
				}
			);
		});
	});
}

function updateBadge(num) {
	chrome.browserAction.setBadgeText({text: num.toString()});
	chrome.browserAction.setBadgeBackgroundColor({color: '#666'});
}

function changeTabAfterSnooze(data) {
	var option = data.detail.label;
	document.querySelectorAll('.choice, .custom-choice').forEach(function(el) {
		if (!(el && el.dataset && el.dataset.option)) return;
		el.classList.add(el.dataset.option === option ? 'focused' : 'disabled');
	});

	var selectedChoice = document.querySelector(`.choice[data-option="${option}"]`);
	if (option === 'custom') selectedChoice = document.querySelector('.custom-choice')
	if (option !== 'custom') document.querySelector('.custom-choice').classList.remove('active', 'focused')
	var tab = document.querySelector('.tab');
	tab.classList.add('snoozed');
	tab.innerHTML = '<span>Snoozed</span>'

	setTimeout(_ => {
		var bgColor = getComputedStyle(selectedChoice).backgroundColor;
		tab.style.color = selectedChoice.classList.contains('dark-on-hover') ? '#fff' : '#000'
		tab.style.backgroundImage = `linear-gradient(to right, ${bgColor} 50%, rgb(221, 221, 221) 0)`
		tab.classList.add('animate');
	}, 301)
}

window.onload = initialize