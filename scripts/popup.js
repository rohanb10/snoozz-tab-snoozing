var closeDelay = 1000, colorList = [], isInEditMode = false;
async function init() {
	isInEditMode = getUrlParam('edit') && getUrlParam('edit') === 'true';

	await fetchHourFormat();
	await buildChoices();
	await buildCustomChoice();
	if (isInEditMode) {
		initEditMode();
	} else {
		await buildTargets();
	}

	document.querySelectorAll('.nap-room-btn, .settings').forEach(btn => btn.addEventListener('click', el => {
		openExtensionTab(el.target.dataset.href);
		setTimeout(_ => window.close(), 100);
	}));
	document.querySelectorAll('.nap-room-btn, .settings').forEach(btn => btn.onkeyup = e => {
		if (e.which === 13) {
			openExtensionTab(btn.dataset.href);
			setTimeout(_ => window.close(), 100);
		}
	});
	if (getBrowser() === 'firefox') {
		chrome.tabs.onActivated.addListener(_ => setTimeout(_ => window.close(), 50))
		chrome.runtime.onMessage.addListener(msg => {if (msg.closePopup) window.close()});
	}
	if (getBrowser() === 'safari') chrome.runtime.sendMessage({wakeUp: true});

	closeDelay = await getOptions('closeDelay');
	var tabs = await getSnoozedTabs();
	if (!isInEditMode && tabs && tabs.length) {
		var todayCount = sleeping(tabs).filter(t => dayjs(t.wakeUpTime).dayOfYear() === dayjs().dayOfYear() && dayjs(t.wakeUpTime).year() === dayjs().year()).length;
		if (todayCount > 0) document.querySelector('.upcoming').setAttribute('data-today', todayCount);
	}
	document.getElementById('repeat').addEventListener('change', toggleRepeat);

	document.addEventListener('keyup', e => {
		if (e.which >= 49 && e.which <= 58 && !document.querySelector('.form-overlay').classList.contains('show')) {
			var choices = document.querySelectorAll('.choice');
			var selectedChoice = choices && choices.length > 0 ? choices[e.which - 48 - 1] : false;
			if (!selectedChoice || selectedChoice.classList.contains('disabled')) return;
			choices.forEach(c => c.classList.remove('focused'));
			selectedChoice.focus();
		}
		if (e.which === 48) {
			document.querySelectorAll('.choice').forEach(c => c.classList.remove('focused'))
			document.querySelector('.choice:last-of-type').focus();
		}
		if (e.which === 13 && !document.querySelector('.form-overlay').classList.contains('show')) {
			var selectedChoice = document.querySelector('.choice.focused');
			if (!selectedChoice) return;
			snooze(o.time, c)
		}
		if (e.which === 67) document.querySelector('.custom-choice').click();
		if (e.which === 84) document.getElementById('tab').click();
		if (e.which === 87) document.getElementById('window').click();
		if (e.which === 83) document.getElementById('selection').click();
		if (isInEditMode && parent && parent.closeOnOutsideClick) parent.closeOnOutsideClick(e);
		// if (e.which === 71) document.getElementById('group').click();
	});
	if (isInEditMode && parent && parent.resizeIframe) parent.resizeIframe();
}
async function initEditMode() {
	document.getElementById('targets').remove();
	document.querySelector('.footer').remove();
	var t = await getSnoozedTabs(getUrlParam('tabId'));
	document.getElementById('preview-text').innerText = t.title;
	document.getElementById('preview-favicon').src = t.tabs ? '../icons/window.png' : (getUrlParam('noImg') ? '../icons/unknown.png' : getFaviconUrl(t.url));
}
async function toggleRepeat(e) {
	var repeat = e.target.checked;
	var choices = await getChoices();
	Object.entries(choices).forEach(([name, o]) => {
		var c = document.getElementById(name);
		c.classList.toggle('disabled', ((!repeat && !!o.disabled) || (repeat && !!o.repeatDisabled)))
		c.classList.toggle('always-disabled', ((!repeat && !!o.disabled) || (repeat && !!o.repeatDisabled)))

		c.querySelector('.label .text').innerText = repeat ? o.repeatLabel : o.label;
		if (name !== 'startup') c.querySelector('.date').innerText = repeat ? o.repeatTimeString : o.timeString;
		if (name !== 'startup') c.querySelector('.time').innerText = repeat ? o.repeatTime : dayjs(o.time).format(`${getHourFormat(dayjs(o.time).minute() !== 0)}`);
	});
}

async function buildTargets() {
	var allTabs = await getTabsInWindow();
	if (!allTabs || !allTabs.length) return;
	if (allTabs.length === undefined) allTabs = [allTabs];

	var activeTab = allTabs.find(at => at.active);
	var validTabs = allTabs.filter(t => !isDefault(t) && isValid(t));

	var isActiveTabValid = validTabs.includes(activeTab);
	document.getElementById('tab').classList.toggle('disabled', !isActiveTabValid);
	var isWindowValid = getBrowser() !== 'safari' && (validTabs.length > 1 || validTabs.length === 1 && !isActiveTabValid);
	document.getElementById('window').classList.toggle('disabled', !isWindowValid);
	var isSelectionValid = getBrowser() !== 'safari' && validTabs.length > 1 && activeTab.highlighted && validTabs.filter(t => t.highlighted).length > 1;
	document.getElementById('selection').classList.toggle('disabled', !isSelectionValid);

	document.querySelectorAll('.target').forEach(t => t.tabIndex = t.classList.contains('disabled') ? -1 : 0);
	document.querySelectorAll('.target').forEach(t => t.addEventListener('keyup', e => { if (e.which === 13) t.click() }));

	// hide groups if not chrome
	if (getBrowser() !== 'chrome' || true) document.getElementById('group').style.display = 'none';

	if (isSelectionValid) {
		document.getElementById('selection').classList.add('active');
	} else if (isActiveTabValid) {
		document.getElementById('tab').classList.add('active');
	} else if (isWindowValid) {
		document.getElementById('window').classList.add('active');
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

	var iconTheme = await getOptions('icons');
	if (!iconTheme) iconTheme = 'human';

	var allTabs = await getTabsInWindow();
	if (!allTabs || !allTabs.length) return;
	if (allTabs.length === undefined) allTabs = [allTabs];
	
	if (type === 'tab') {
		var a = allTabs.find(at => at.active)
		previewText.innerText = a.title;
		previewIcon.onload = _ => {if (previewIcon && previewIcon.height === 16 && previewIcon.width === 16) previewIcon.src = '../icons/unknown.png';}
		previewIcon.src = a.favIconUrl ? a.favIconUrl : (getBrowser() === 'safari' ? getFaviconUrl(a.url) : '../icons/unknown.png');
	} else if (type === 'window') {
		var validTabs = allTabs.filter(t => !isDefault(t) && isValid(t));
		previewText.innerText = `${getTabCountLabel(validTabs)} from ${getSiteCountLabel(validTabs)}`;
		previewIcon.src = `../icons/${iconTheme}/window.png`;
	} else if (type === 'selection') {
		var validTabs = allTabs.filter(t => !isDefault(t) && isValid(t) && t.highlighted);
		previewText.innerText = `${validTabs.length} selected tabs from ${getSiteCountLabel(validTabs)}`;
		previewIcon.src = `../icons/${iconTheme}/selection.png`;
	} else {
		previewText.innerText = `Can't snooze this tab`;
	}
}

async function buildChoices() {
	var choices = await getChoices();
	var config = await getOptions(['popup']);
	var iconTheme = await getOptions('icons');
	if (!iconTheme) iconTheme = 'human';
	colorList = gradientSteps('#F3B845', '#DF4E76', Math.ceil(Object.keys(choices).length / 2) + 1);
	document.querySelector('.section.choices').append(...(Object.entries(choices).map(([name, o], i) => {
		var icon = Object.assign(document.createElement('img'), {src: `../icons/${iconTheme}/${name}.png`});
		
		var selectWrapper = '' 
		if (['weekend', 'monday', 'week', 'month'].includes(name)) {
			var s = config.popup && config.popup[name] ? config.popup[name] : 'morning';
			var morning = Object.assign(document.createElement('option'), {value: 'morning', innerText: 'Morning', selected: s === 'morning'});
			var evening = Object.assign(document.createElement('option'), {value: 'evening', innerText: 'Evening', selected: s === 'evening'});
			var now = Object.assign(document.createElement('option'), {value: 'now', innerText: 'Current Time', selected: s === 'now'});

			var select = document.createElement('select');
			select.tabIndex = -1;
			select.addEventListener('change', async e => {
				await savePopupOptions();
				// change time
				var t = await getTimeWithModifier(name);
				document.querySelector(`#${name} .time`).innerText = t.format(getHourFormat(t.minute() !== 0));
				// resize dropdown
				var d = Object.assign(document.createElement('select'), {style: {visibility: 'hidden', position: 'fixed'}});
				var o = Object.assign(document.createElement('option'), {innerText: e.target.options[e.target.selectedIndex].text});
				d.append(o);
				e.target.after(d);
				e.target.style.width = `${d.getBoundingClientRect().width}px`;
				d.remove();
			});
			select.append(morning, evening, now);
			selectWrapper = wrapInDiv({classList: 'select-wrapper'}, select);
		}

		var label = wrapInDiv({classList: 'label'}, wrapInDiv({className: 'text', innerText: o.label}), selectWrapper);
		var date = wrapInDiv({classList: 'date', innerText: o.timeString});
		var time = wrapInDiv({classList: 'time', innerText: dayjs(o.time).format(getHourFormat(dayjs(o.time).minute() !== 0))});

		var c = wrapInDiv({
			id: name,
			classList: `choice ${o.disabled ? 'disabled always-disabled' : ''}`,
			style: `--bg:${colorList[Math.floor(i / 2)]}`,
			tabIndex: o.disabled ? -1 : 0,
		}, wrapInDiv('', icon, label), o.startUp ? wrapInDiv() : wrapInDiv('', date, time));
		c.setAttribute('data-repeat', o.repeat);
		c.addEventListener('mouseover', _ => c.classList.add('focused'))
		c.addEventListener('mouseout', _ => c.classList.remove('focused'));
		if (['weekend', 'monday', 'week', 'month'].includes(name)) c.addEventListener('keydown', e => {
			if (!e || e.which !== 38 && e.which !== 40) return;
			var options = select.querySelectorAll('option');
			var current = Array.from(options).findIndex(o => o.selected);
			if (e.which === 38 && current > 0) options[current - 1].selected = true;
			if (e.which === 40 && current < options.length - 1) options[current + 1].selected = true;
			select.dispatchEvent(new Event('change'));
		})
		c.onclick = e => {if (!['OPTION', 'SELECT'].includes(e.target.nodeName)) snooze(o.startUp ? 'startup' : o.time, c)}
		c.onkeyup = e => {if (e.which === 13) snooze(o.startUp ? 'startup' : o.time, c)}
		return c
	})));
	document.querySelectorAll('.section.choices .choice select').forEach(s => s.dispatchEvent(new Event('change')));
}

async function buildCustomChoice() {
	var firstDayOfWeek = await getOptions('weekStart') || 0;
	var date = flatpickr('#date', {
		inline: true,
		defaultDate: dayjs().format('YYYY-MM-DD'),
		minDate: dayjs().format('YYYY-MM-DD'),
		locale: {firstDayOfWeek}
	});
	var time = flatpickr('#time', {
		inline: true,
		enableTime: true,
		noCalendar: true,
		time_24hr: HOUR_FORMAT && HOUR_FORMAT === 24,
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
		document.querySelectorAll('.action').forEach(action => {
			action.classList.toggle('disabled', (getDateTime().add(parseInt(action.getAttribute('data-value')), 'm') < now));
		});
		if (getDateTime() < now) reset()
		time.set('minTime', getDateTime().dayOfYear() === now.dayOfYear() ? now.format('HH:mm') : null);
		document.querySelector('.date-display').innerText = dayjs(date.selectedDates).format('ddd, D MMM');
		document.querySelector('.time-display').innerText = dayjs(time.selectedDates).format(getHourFormat(true));
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

	var iconTheme = await getOptions('icons');
	if (!iconTheme) iconTheme = 'human';
	var icon = Object.assign(document.createElement('img'), {src: `../icons/${iconTheme}/custom.png`})
	var label = wrapInDiv({classList: 'label', innerText: 'Choose your own time'})
	var customChoice = wrapInDiv({
		id: 'custom',
		classList: 'custom-choice',
		style: `--bg: ${colorList[colorList.length - 1]}`,
		tabIndex: 0,
		onclick: _ => {
			customChoice.classList.add('focused');
			document.querySelectorAll('.choice').forEach(c => {c.classList.add('disabled');c.setAttribute('tabindex','-1')});
			document.querySelector('.popup-checkbox input').setAttribute('tabindex', '-1');
			document.querySelector('.form-overlay').classList.add('show')
		},
		onkeydown: e => {
			if (!e || e.which !== 13 && e.which !== 32) return;
			customChoice.classList.add('focused');
			document.querySelectorAll('.choice').forEach(c => {c.classList.add('disabled');c.setAttribute('tabindex','-1')});
			document.querySelector('.form-overlay').classList.add('show')
		}
	}, wrapInDiv('', icon, label), wrapInDiv('custom-info', wrapInDiv('display', wrapInDiv('date-display'), wrapInDiv('time-display')), submitButton));
	document.querySelector('.section.special-choices').prepend(customChoice);
	customChoice.addEventListener('mouseover', _ => customChoice.classList.add('really-focused'))
	customChoice.addEventListener('mouseout', _ => customChoice.classList.remove('really-focused'))

	// attach listeners
	document.querySelector('.overlay-close-btn').addEventListener('click', _ => {
		customChoice.classList.remove('focused');
		document.querySelectorAll('.choice').forEach(c => {c.classList.remove('disabled');c.setAttribute('tabindex','0')});
		document.querySelector('.popup-checkbox input').setAttribute('tabindex', '0');
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
	if (document.querySelector('.f-am-pm')) document.querySelector('.f-am-pm').addEventListener('click', validate);
	
	document.querySelector('.reset-action').addEventListener('click', _ => {reset();validate()});
	document.querySelector('.form-overlay .f-days').addEventListener('click', e => {if (e.target.classList.contains('f-day')) validate()});
	document.querySelectorAll('.form-overlay .time-wrapper input').forEach(i => {
		i.addEventListener('blur', validate);
		i.addEventListener('increment', validate);
		i.addEventListener('keyup', e => {if (e.which && (e.which === 38 || e.which === 40)) validate()})
	});

	validate();
}

async function modify(time, choice) {
	if (!isInEditMode || !getUrlParam('tabId')) return;
	if (parent && parent.deleteTabFromDiv) parent.deleteTabFromDiv(getUrlParam('tabId'))
	var response = await editSnoozeTime(getUrlParam('tabId'), time);
	if (!response || !response.edited) return;
	await displayPreviewAnimation(choice, time.format ? time.format('.HHmm') : '', 'Going back to sleep');
	if (parent && parent.closeEditModal) setTimeout(_ => parent.closeEditModal(), closeDelay);
}

async function snooze(time, choice) {
	time = ['weekend', 'monday', 'week', 'month'].includes(choice.id) ? await getTimeWithModifier(choice.id) : time;
	if (document.getElementById('repeat').checked) {
		if (choice.getAttribute('data-repeat') === 'daily') time = dayjs();
		var t = calculateNextSnoozeTime(choice.getAttribute('data-repeat'), time);
		console.log(t.format('HH:mm:ss DD/MM/YY'));
		return 
	}
	if (isInEditMode) return modify(time, choice);
	var target = document.querySelector('.target.active');
	if (!['tab', 'window', 'selection', 'group'].includes(target.id)) return;
	var response;
	if (target.id === 'tab') {
		response = await snoozeTab(time);
	} else if (target.id === 'window') {
		response = await snoozeWindow(time);
	} else if (target.id === 'selection') {
		response = await snoozeSelectedTabs(time);
	}
	if (response && !(response.tabId || response.windowId)) return;
	await chrome.runtime.sendMessage(Object.assign(response, {close: true, delay: closeDelay}));
	await displayPreviewAnimation(choice, time.format ? time.format('.HHmm') : '', `Snoozing ${target.id}`)
}

async function displayPreviewAnimation(choice, time, text = 'Snoozing') {
	await chrome.runtime.sendMessage({poll: `${choice.id}${time}`});
	document.body.style.pointerEvents = 'none';
	choice.classList.add('focused');
	var preview = document.getElementById('preview');
	preview.classList.add('snoozed');
	preview.textContent = '';
	preview.appendChild(Object.assign(document.createElement('span'), {
		textContent: text,
		style: {
			transition: `color 400ms ease-in-out ${(closeDelay/2) - 250}ms`,
			color: '#000',
		}
	}));
	preview.style.transition = `background-position ${closeDelay - 100}ms linear`
	preview.style.backgroundImage = `linear-gradient(to right, ${getComputedStyle(choice).backgroundColor} 50%, ${getComputedStyle(preview).backgroundColor} 0)`
	preview.classList.add('animate');
}
async function savePopupOptions() {
	var o = await getOptions();
	o.popup = {
		weekend: document.querySelector('#weekend select').value,
		monday: document.querySelector('#monday select').value,
		week: document.querySelector('#week select').value,
		month: document.querySelector('#month select').value
	}
	await saveOptions(o);
}

window.onload = init