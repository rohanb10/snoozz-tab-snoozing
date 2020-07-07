const currentTime = new Date();
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// btn.addEventListener('click', );

function initialize() {
	getCurrentTab();
	configureSnoozeOptions();

	// custom snooze defaults + listeners
 	document.querySelector('input[type="date"]').setAttribute('min', currentTime.toISOString().split("T")[0]);
 	document.querySelector('input[type="time"]').value = currentTime.toTimeString().substring(0,5);
 	document.querySelectorAll('input').forEach(i => i.addEventListener('input', e => e.target.classList.remove('invalid')));

 	document.querySelector('.submit-custom').addEventListener('click', submitCustom);
 	document.addEventListener('snoozed', changeTabAfterSnooze);

 	// button event listeners
 	document.querySelectorAll('.dashboard-btn, .settings').forEach(el => el.addEventListener('click', openLink));
}

function openLink(el) {
	var href = el.target.dataset.href;
	chrome.tabs.create({'url': `../${href}/${href}.html`});
}

function getCurrentTab() {
	chrome.tabs.query({active: true}, tabs => {
		var tab = tabs.length > 0 && tabs[0] ? tabs[0] : false;
		if (!tabs) return;
		document.getElementById('tab-title').innerText = tab.title;
		document.getElementById('tab-favicon').src = tab.favIconUrl.length > 0 ? tab.favIconUrl : '../icons/unknown.png';
	});
}

function configureSnoozeOptions() {
	var options = document.querySelectorAll('.choice');

	options.forEach(o => {
		// disable invalid options
		if (o.dataset.option === 'today-morning' && currentTime.getHours() >= 7) o.classList.add('disabled')
		if (o.dataset.option === 'today-evening' && currentTime.getHours() >= 18) o.classList.add('disabled')

		var config = getTimeForOption(o.dataset.option);

		// set up snooze actions for each option
		o.addEventListener('click', e => snooze(config.time, e.target.dataset.option));

		// display time + date correctly for each option
		o.querySelector('.time').innerText = config.label[1];
		o.querySelector('.date').outerHTML = config.label[0].length > 0 ? `<div class="date">${config.label[0]}</div>` : ``;
	})
}

function getNextDay(dayNum) {
	// 0: sunday ... 6: saturday
	var d = new Date();
	return d.setDate(d.getDate() + ((7 + dayNum - d.getDay()) % 7 === 0 ? 7 : (7 + dayNum - d.getDay()) % 7));
}

function getTimeForOption(option) {
	const defaultMorningHour = 9;
	const defaultEveningHour = 18;

	// calculate date for option
	var t = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
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
		t.setHours(defaultEveningHour);
	} else if (['week', 'month'].indexOf(option) > -1) {
		t.setHours(currentTime.getHours())
	} else {
		t.setHours(defaultMorningHour);
	}

	var label = [];
	if (['today-morning', 'today-evening'].indexOf(option) > -1){
		label.push('', formatHours(t.getHours()));
	}
	else if (['tom-morning', 'tom-evening'].indexOf(option) > -1){
		label.push(`${DAYS[t.getDay()]}`, formatHours(t.getHours()));
	}
	else if (['weekend', 'monday', 'week', 'month'].indexOf(option) > -1){
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
	var d = document.getElementById('date-input')
	var t = document.getElementById('time-input')
	if (d.value.length === 0 || !d.value.match(/^\d{4}-\d{2}-\d{2}$/)) {
		d.classList.add('invalid');
		return;
	}
	if (t.value.length === 0 || !t.value.match(/^\d{2}:\d{2}$/)) {
		t.classList.add('invalid');
		return;
	}
	var time = new Date(`${d.value} ${t.value}`);
	if (time < currentTime) {
		t.classList.add('invalid');
		return;
	}
	snooze(time, 'custom');
}

function snooze(snoozeTime, label) {
	chrome.alarms.create('tabsAlarm', { periodInMinutes: 10 });
	chrome.storage.local.get(['snoozed'], function(storage) {
		storage.snoozed = storage.snoozed || [];
		chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
			var tab = tabs[0];
			storage.snoozed.push({
				id: Math.random().toString(36).slice(-6),
				title: tab.title,
				url: tab.url,
				favicon: tab.favIconUrl,
				snoozeUntil: snoozeTime.toISOString(),
				timestamp: currentTime.toISOString(),
				reopened: false,
			})
			chrome.storage.local.set(
				{snoozed: storage.snoozed},
				function() {
					document.dispatchEvent(new CustomEvent('snoozed', {detail: {label: label}}));
					setTimeout(function(){
						chrome.tabs.remove(tab.id);
					}, 2000);
				}
			);
		});
	});
}

function changeTabAfterSnooze(data) {
	var option = data.detail.label;
	document.querySelectorAll('.choice, .custom-choice').forEach(function(el) {
		if (!(el && el.dataset && el.dataset.option)) return;
		el.classList.add(el.dataset.option === option ? 'focused' : 'disabled');
	});

	var selectedChoice = document.querySelector(`.choice[data-option="${option}"]`);
	if (option === 'custom') selectedChoice = document.querySelector('.custom-choice')
	var tab = document.querySelector('.tab');
	tab.classList.add('snoozed');
	tab.innerHTML = '<span>Snoozed</span>'

	setTimeout(function(){
		var bgColor = getComputedStyle(selectedChoice).backgroundColor;
		tab.style.color = selectedChoice.classList.contains('dark-on-hover') ? '#fff' : '#000'
		tab.style.backgroundImage = `linear-gradient(to right, ${bgColor} 50%, rgb(221, 221, 221) 0)`
		tab.classList.add('animate');
	}, 301)
}

window.onload = initialize
window.addEventListener('unload', function(){debugger})