'use strict';

function initialize() {
	getCurrentTab();

	// custom snooze defaults + listeners
 	document.querySelectorAll('input').forEach(i => i.addEventListener('input', el => el.target.classList.remove('invalid')));
 	
 	document.querySelectorAll('.dashboard-btn, .settings').forEach(btn => btn.addEventListener('click', el => {
		if (isFirefox) setTimeout(_ => window.close(), 100);
		openURL(el.target.dataset.href, false);
	}));

 	customChoiceHandler()

 	chrome.storage.local.get(['snoozed', 'snoozedOptions'], s => {
 		EXT_OPTIONS = Object.assign(EXT_OPTIONS, s.snoozedOptions);

 		if (!s.snoozedOptions || Object.keys(s.snoozedOptions).length === 0) chrome.storage.local.set({snoozedOptions: EXT_OPTIONS});
 		configureSnoozeOptions();
 		
 		if (!s.snoozed || Object.keys(s.snoozed).length === 0) return;

 		var todayCount = (s.snoozed.filter(t => isToday(new Date(t.wakeUpTime)) && !t.opened)).length;
 		if (todayCount > 0) document.querySelector('.upcoming').setAttribute('data-today', todayCount)
 	});
 	updateFaviconIfMissing();
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
		clearTimeout(closeTimeout)
		var isEdited = formDate.value !== NOW.toISOString().split('T')[0] || formTime.value !== NOW.toTimeString().substring(0,5);
		if (isEdited) {
			submitBtn.classList.remove('disabled');
		} else {
			closeTimeout = setTimeout(_ => cc.classList.remove('active'), 3000);
		}
	}, {once:true}));
	cc.addEventListener('mouseout', _=> {
		if (dateEdited) return;
		if (!submitBtn.classList.contains('disabled')) return;
		closeTimeout = setTimeout(_ => cc.classList.remove('active'), 3000);
	})

 	// submit button click
	cc.querySelector('.submit-btn').addEventListener('click', submitCustom);
}

function getCurrentTab() {
	chrome.tabs.query({active: true, currentWindow: true}, tabs => {
		var tab = tabs.length > 0 && tabs[0] ? tabs[0] : false;
		if (!tabs) return;

		const validProtocols = ['http', 'https', 'file'];
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
		time_date.querySelector('.date').innerText = config.label[0]
		if (config.label[0].length <= 0) time_date.removeChild(time_date.querySelector('.date'))
		time_date.title = getPrettyTimestamp(config.time);
	})
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
	chrome.storage.local.get(['snoozed'], storage => {
		storage.snoozed = storage.snoozed || [];
		chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
			var tab = tabs[0];
			storage.snoozed.push({
				id: Math.random().toString(36).slice(-6),
				title: tab.title,
				url: tab.url,
				favicon: tab.favIconUrl,
				wakeUpTime: snoozeTime.getTime(),
				timeCreated: NOW.getTime(),
			})
			chrome.storage.local.set({snoozed: storage.snoozed}, _ => {
					changeTabAfterSnooze(label)
					document.body.style.pointerEvents = 'none';
					updateBadge(storage.snoozed);
					setTimeout(_ => {
						chrome.tabs.remove(tab.id)
						if (isFirefox) window.close()
					}, 2100);
				}
			);
		});
	});
}

function changeTabAfterSnooze(option) {
	document.querySelectorAll('.choice, .custom-choice').forEach(function(el) {
		if (!(el && el.dataset && el.dataset.option)) return;
		el.classList.add(el.dataset.option === option ? 'focused' : 'disabled');
	});

	var selectedChoice = document.querySelector(`.choice[data-option="${option}"]`);
	if (option === 'custom') selectedChoice = document.querySelector('.custom-choice')
	if (option !== 'custom') document.querySelector('.custom-choice').classList.remove('active', 'focused')
	var tab = document.querySelector('.tab');
	tab.classList.add('snoozed');
	tab.textContent = '';
	tab.appendChild(Object.assign(document.createElement('span'), {textContent: 'Snoozzed'}));

	setTimeout(_ => {
		var bgColor = getComputedStyle(selectedChoice).backgroundColor;
		tab.style.color = selectedChoice.classList.contains('dark-on-hover') ? '#fff' : '#000'
		tab.style.backgroundImage = `linear-gradient(to right, ${bgColor} 50%, rgb(221, 221, 221) 0)`
		tab.classList.add('animate');
	}, 301)
}

window.onload = initialize