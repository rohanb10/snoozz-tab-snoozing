var collapse, customChoice, closeDelay = 1000, colorList = [];
async function init() {
	await buildChoices();
	buildCustomChoice();
	await buildTargets();

	document.querySelectorAll('.dashboard-btn, .settings').forEach(btn => btn.addEventListener('click', el => {
		openExtensionTab(el.target.dataset.href);
		setTimeout(_ => window.close(), 100);
	}));
	document.querySelectorAll('.dashboard-btn, .settings').forEach(btn => btn.onkeyup = e => {
		if (e.which == 13) {
			openExtensionTab(btn.dataset.href);
			setTimeout(_ => window.close(), 100);
		}
	});
	if (getBrowser() === 'firefox') {
		chrome.tabs.onActivated.addListener(_ => setTimeout(_ => window.close(), 50))
		chrome.runtime.onMessage.addListener(msg => {if (msg.closePopup) window.close()});
	}
	if (getBrowser() === 'safari') await chrome.runtime.getBackgroundPage(async bg => {await bg.wakeUpTask()});

	closeDelay = await getOptions('closeDelay');
	var tabs = await getSnoozedTabs();
	if (tabs && tabs.length) {
		var todayCount = sleeping(tabs).filter(t => dayjs(t.wakeUpTime).dayOfYear() === dayjs().dayOfYear()).length;
		if (todayCount > 0) document.querySelector('.upcoming').setAttribute('data-today', todayCount);
	}

	document.addEventListener('keyup', e => {
		if (e.which >= 48 && e.which <= 56 && !document.querySelector('.form-overlay').classList.contains('show')) {
			var choices = document.querySelectorAll('.choice');
			var selectedChoice = choices && choices.length > 0 ? choices[e.which - 48 - 1] : false;
			if (!selectedChoice || selectedChoice.classList.contains('disabled')) return;
			choices.forEach(c => c.classList.remove('focused'));
			selectedChoice.focus();
		}
		if (e.which === 13 && !document.querySelector('.form-overlay').classList.contains('show')) {
			var selectedChoice = document.querySelector('.choice.focused');
			if (!selectedChoice) return;
			snooze(o.time, c)
		}
		if (e.which === 84) document.getElementById('tab').click();
		if (e.which === 87) document.getElementById('window').click();
		if (e.which === 83) document.getElementById('selection').click();
		if (e.which === 71) document.getElementById('group').click();
	})
}

async function buildTargets() {
	var allTabs = await getTabsInWindow();
	if (!allTabs || allTabs.length == 0) return;
	if (allTabs.length === undefined) allTabs = [allTabs];

	var activeTab = allTabs.find(at => at.active);
	var validTabs = allTabs.filter(t => !isDefault(t) && isValid(t));

	var isActiveTabValid = validTabs.includes(activeTab);
	document.getElementById('tab').classList.toggle('disabled', !isActiveTabValid);
	var isWindowValid = getBrowser() !== 'safari' && (validTabs.length > 1 || validTabs.length == 1 && !isActiveTabValid);
	document.getElementById('window').classList.toggle('disabled', !isWindowValid);
	var isSelectionValid = getBrowser() !== 'safari' && validTabs.length > 1 && activeTab.highlighted && validTabs.filter(t => t.highlighted).length > 1;
	document.getElementById('selection').classList.toggle('disabled', !isSelectionValid);
	var isGroupValid = false && getBrowser() === 'chrome' && validTabs.length > 1 && activeTab.groupId && activeTab.groupId != -1 && validTabs.filter(vt => vt.groupId && vt.groupId != activeTab.groupId).length > 1
	document.getElementById('group').classList.toggle('disabled', !isGroupValid);

	document.querySelectorAll('.target').forEach(t => t.tabIndex = t.classList.contains('disabled') ? -1 : 0);
	document.querySelectorAll('.target').forEach(t => t.addEventListener('keyup', e => { if (e.which == 13) t.click() }));

	// hide groups if not chrome
	if (getBrowser() !== 'chrome' || true) document.getElementById('group').style.display = 'none';

	if (isActiveTabValid) {
		document.getElementById('tab').classList.add('active');
	} else if (isWindowValid) {
		document.getElementById('window').classList.add('active');
	} else if (isSelectionValid) {
		document.getElementById('selection').classList.add('active');
	} else if (isGroupValid) {
		document.getElementById('group').classList.add('active');
	} else {
		document.querySelectorAll('.choice, .custom-choice, h3').forEach(c => {c.classList.add('disabled');c.setAttribute('tabindex','-1')});
		return document.getElementById('preview-text').innerText = `Can't snooze this tab`;
	}
	await generatePreview(document.querySelector('.target.active').id)

	document.querySelectorAll('.target').forEach(t => t.addEventListener('click', async e => {
		if (e.target.classList.contains('disabled') || e.target.classList.contains('active')) return;
		document.querySelectorAll('.target').forEach(s => s.classList.remove('active'));
		e.target.classList.add('active');
		document.getElementById('icon').classList.toggle('flipped');
		await generatePreview(e.target.id);
	}));
}

async function generatePreview(type) {
	var previewText = document.getElementById('preview-text');
	var previewIcon = document.getElementById('preview-favicon');

	var allTabs = await getTabsInWindow();
	if (!allTabs || !allTabs.length) return;
	
	if (type == 'tab') {
		previewText.innerText = allTabs.find(at => at.active).title;
		previewIcon.src = allTabs.find(at => at.active).favIconUrl ? allTabs.find(at => at.active).favIconUrl : '../icons/unknown.png';
	} else if (type == 'window') {
		var validTabs = allTabs.filter(t => !isDefault(t) && isValid(t));
		previewText.innerText = `${getTabCountLabel(validTabs)} from ${getSiteCountLabel(validTabs)}`;
		previewIcon.src = '../icons/octopus.png'
	} else if (type == 'selection') {
		var validTabs = allTabs.filter(t => !isDefault(t) && isValid(t) && t.highlighted);
		previewText.innerText = `${validTabs.length} selected tabs from ${getSiteCountLabel(validTabs)}`;
		previewIcon.src = '../icons/magnet.png'
	} else if (type == 'group') {
		var currentTabGroup = allTabs.find(at => at.active).groupId;
		var validTabs = allTabs.filter(t => currentTabGroup && currentTabGroup != -1 && !isDefault(t) && isValid(t) && t.groupId && t.groupId == currentTabGroup);
		previewText.innerText = `${validTabs.length} grouped tabs from ${getSiteCountLabel(validTabs)}`;
		previewIcon.src = '../icons/octopus.png'
	} else {
		previewText.innerText = `Can't snooze this tab`;
	}
}

async function buildChoices() {
	var choices = await getChoices();
	colorList = gradientSteps('#F3B845', '#DF4E76', Math.ceil(Object.keys(choices).length / 2) + 1);
	document.querySelector('.section.choices').append(...(Object.entries(choices).map(([name, o], i) => {
		var icon = Object.assign(document.createElement('img'), {src: `../icons/${name}.png`});
		var label = wrapInDiv({classList: 'label', innerText: o.label});
		var date = wrapInDiv({classList: 'date', innerText: o.timeString});
		var time = wrapInDiv({classList: 'time', innerText: dayjs(o.time).format(`h${dayjs(o.time).minute() !== 0 ? ':mm ':''}A`)});

		var c = wrapInDiv({
			classList: `choice ${o.disabled ? 'disabled always-disabled' : ''}`,
			style: `--bg:${colorList[Math.floor(i / 2)]}`,
			tabIndex: o.disabled ? -1 : 0,
		}, wrapInDiv('', icon, label), o.startUp ? wrapInDiv() : wrapInDiv('', date, time));
		c.onclick = _ => snooze(o.startUp ? 'startup' : o.time, c)
		c.onkeyup = e => {if (e.which === 13) snooze(o.startUp ? 'startup' : o.time, c)}
		return c
	})));
}

function buildCustomChoice() {
	var date = flatpickr('#date', {
		inline: true,
		defaultDate: dayjs().format('YYYY-MM-DD'),
		minDate: dayjs().format('YYYY-MM-DD'),
	});
	var time = flatpickr('#time', {
		inline: true,
		enableTime: true,
		noCalendar: true,
		defaultDate: dayjs().format('HH:mm'),
		onChange: validate,
		onValueUpdate: validate
	});

	var getDateTime = _ => dayjs(dayjs(date.selectedDates).format('YYYY-MM-DD') + dayjs(time.selectedDates).format('HH:mm'));

	var reset = _ => {
		var now = dayjs();
		time.setDate(now.format('HH:mm'));
		date.setDate(now.format('YYYY-MM-DD'));
	}

	var validate = async _ => {
		await new Promise(r => setTimeout(r, 50));
		var now = dayjs();
		console.log('validating', now, getDateTime());
		document.querySelectorAll('.action').forEach(action => {
			action.classList.toggle('disabled', (getDateTime().add(parseInt(action.getAttribute('data-value')), 'm') < now));
		});
		if (getDateTime() < now) reset()
		time.set('minTime', getDateTime().dayOfYear() == now.dayOfYear() ? now.format('HH:mm') : null);
		document.querySelector('.date-display').innerText = dayjs(date.selectedDates).format('ddd, D MMM');
		document.querySelector('.time-display').innerText = dayjs(time.selectedDates).format('h:mm A');
		document.querySelector('.submit-btn').classList.toggle('disabled', getDateTime() <= now);
		return getDateTime() > now;
	}

	var submitButton = wrapInDiv({
		classList: 'submit-btn disabled',
		innerText: 'snoozz',
		onclick: e => {
			if (e.target.classList.contains('disabled') || !validate()) return;
			snooze(getDateTime(), customChoice)
		}
	});

	var icon = Object.assign(document.createElement('img'), {src: `../icons/alarm.png`})
	var label = wrapInDiv({classList: 'label', innerText: 'Choose your own time'})
	var customChoice = wrapInDiv({
		classList: 'custom-choice',
		style: `--bg: ${colorList[colorList.length - 1]}`,
		tabIndex: 0,
		onclick: _ => {
			customChoice.classList.add('focused');
			document.querySelectorAll('.choice').forEach(c => {c.classList.add('disabled');c.setAttribute('tabindex','-1')});
			document.querySelector('.form-overlay').classList.add('show')
		}
	}, wrapInDiv('', icon, label), wrapInDiv('custom-info', wrapInDiv('display', wrapInDiv('date-display'), wrapInDiv('time-display')), submitButton));
	document.querySelector('.section.choices').after(customChoice);


	// attach listeners
	document.querySelector('.overlay-close-btn').addEventListener('click', _ => {
		customChoice.classList.remove('focused');
		document.querySelectorAll('.choice').forEach(c => {c.classList.remove('disabled');c.setAttribute('tabindex','0')});
		document.querySelector('.form-overlay').classList.remove('show');
	})
	document.querySelectorAll('.action').forEach(action => action.addEventListener('click', function(e) {
		if (action.classList.contains('disabled')) return;
		var amount = parseInt(e.target.getAttribute('data-value'));
		if (Math.abs(amount) > 1000) {
			date.setDate(dayjs(date.selectedDates).add(amount, 'm').toDate());
		} else {
			if (dayjs(time.selectedDates).add(amount, 'm').dayOfYear() != dayjs(time.selectedDates).dayOfYear()) {
				date.setDate(dayjs(date.selectedDates).add(amount < 0 ? -1 : 1, 'd').toDate());
			}
			time.setDate(dayjs(time.selectedDates).add(amount, 'm').toDate());
		}
		validate();
	}));
	document.querySelector('.f-am-pm').addEventListener('click', _ => validate);
	
	document.querySelector('.reset-action').addEventListener('click', _ => {reset();validate()});
	document.querySelector('.form-overlay .f-days').addEventListener('click', e => {if (e.target.classList.contains('f-day')) validate()});
	document.querySelectorAll('.form-overlay .time-wrapper input').forEach(i => {
		i.addEventListener('blur', validate);
		i.addEventListener('increment', validate);
		i.addEventListener('keyup', e => {if (e.which && (e.which == 38 || e.which == 40)) validate()})
	});

	validate();
}

var activateForm = (a = true) => {customChoice.classList.toggle('active', a); clearTimeout(collapse)}
var focusForm = (f = true) => {customChoice.classList.toggle('focused', f); clearTimeout(collapse)}

async function snooze(time, choice) {
	var target = document.querySelector('.target.active');
	if (!['tab', 'window', 'selection', 'group'].includes(target.id)) return;

	var response;
	if (target.id == 'tab') {
		response = await snoozeTab(time);
	} else if (target.id == 'window') {
		response = await snoozeWindow(time);
	} else if (target.id == 'selection') {
		response = await snoozeSelectedTabs(time);
	} else if (target.id == 'group') {
		// response = await snoozeGroupedTabs(time);
	}
	if (response && !(response.tabId || response.windowId)) return;
	await chrome.runtime.sendMessage(Object.assign(response, {close: true, delay: closeDelay}));
	displayPreviewAnimation(choice, target.id)
}
function displayPreviewAnimation(choice, type) {
	document.body.style.pointerEvents = 'none';
	choice.classList.add('focused');
	var preview = document.getElementById('preview');
	preview.classList.add('snoozed');
	preview.textContent = '';
	preview.appendChild(Object.assign(document.createElement('span'), {
		textContent: `Snoozing ${type}`,
		style: {
			transition: `color 400ms ease-in-out ${(closeDelay/2) - 250}ms`,
			color: '#000',
		}
	}));
	preview.style.transition = `background-position ${closeDelay - 100}ms linear`
	preview.style.backgroundImage = `linear-gradient(to right, ${getComputedStyle(choice).backgroundColor} 50%, ${getComputedStyle(preview).backgroundColor} 0)`
	preview.classList.add('animate');
}
window.onload = init