var closeDelay = 1000, colorList = [], isInEditMode = false, isInDupeMode = false, iconTheme, debounce;
async function init() {
	isInEditMode = getUrlParam('type') && getUrlParam('type') === 'edit';
	isInDupeMode = getUrlParam('type') && getUrlParam('type') === 'clone';

	iconTheme = await getOptions('icons');
	if (!iconTheme) iconTheme = 'human';

	await fetchHourFormat();
	await buildChoices();
	await buildCustomChoice();
	await buildRepeatCustomChoice();

	document.querySelectorAll('.nap-room-btn, .settings').forEach(btn => btn.addEventListener('click', el => {
		openExtensionTab(el.target.dataset.href);
		setTimeout(_ => window.close(), 100);
	}));
	document.querySelectorAll('.nap-room-btn, .settings').forEach(btn => btn.onkeyup = e => {
		if (e.which === 13 || e.which === 32) {
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
	if (!(isInEditMode || isInDupeMode) && tabs && tabs.length) {
		var todayCount = sleeping(tabs).filter(t => dayjs(t.wakeUpTime).dayOfYear() === dayjs().dayOfYear() && dayjs(t.wakeUpTime).year() === dayjs().year()).length;
		if (todayCount > 0) document.querySelector('.upcoming').setAttribute('data-today', todayCount);
	}
	document.getElementById('repeat').addEventListener('change', toggleRepeat);

	document.addEventListener('keyup', e => {
		var isOverlayOpen = document.querySelector('.form-overlay').classList.contains('show');
		if (e.keyCode >= 49 && e.keyCode <= 58 && !isOverlayOpen) {
			var choices = document.querySelectorAll('.choice');
			var selectedChoice = choices && choices.length > 0 ? choices[e.keyCode - 48 - 1] : false;
			if (!selectedChoice || selectedChoice.classList.contains('disabled')) return;
			choices.forEach(c => c.classList.remove('focused'));
			selectedChoice.focus();
		}
		if (e.keyCode === 48 && !isOverlayOpen) {
			document.querySelectorAll('.choice').forEach(c => c.classList.remove('focused'))
			document.querySelector('.choice:last-of-type').focus();
		}
		if ((e.which === 13 || e.which === 32) && !isOverlayOpen) {
			var selectedChoice = document.querySelector('.choice.focused');
			if (!selectedChoice) return;
			snooze(o.time, c)
		}
		if (e.keyCode === 67 && !isOverlayOpen) document.querySelector('.custom-choice').click();
		if (e.keyCode === 67 && isOverlayOpen) document.querySelector('.overlay-close-btn').click();
		if (e.keyCode === 84 && !isOverlayOpen) document.getElementById('tab').click();
		if (e.keyCode === 87 && !isOverlayOpen) document.getElementById('window').click();
		if (e.keyCode === 83 && !isOverlayOpen) document.getElementById('selection').click();
		if (e.keyCode === 82) document.getElementById('repeat').click();
		if ((isInEditMode || isInDupeMode) && parent && parent.closeModalOnOutsideClick) parent.closeModalOnOutsideClick(e);
	});
	['mouseover', 'focus'].forEach(e => document.querySelector('.keyboard').addEventListener(e, _ => document.body.classList.add('show-shortcuts')));
	['mouseout', 'blur'].forEach(e => document.querySelector('.keyboard').addEventListener(e, _ => document.body.classList.remove('show-shortcuts')));
	if (isInEditMode || isInDupeMode) {
		initEditMode(isInDupeMode);
	} else {
		await buildTargets();
	}
	if ((isInEditMode || isInDupeMode) && parent && parent.resizeIframe) parent.resizeIframe();
}
async function initEditMode(isDupe) {
	document.querySelector('h3').innerText = isDupe ? 'Duplicate What?' : 'Edit What?'
	document.getElementById('targets').classList.add('hidden');
	document.querySelectorAll('target').forEach(t => t.classList.remove('active'));
	document.querySelector('.footer').classList.add('hidden');
	var t = await getSnoozedTabs(getUrlParam('tabId'));
	if (t.repeat) document.getElementById('repeat').click();
	document.getElementById('preview-text').innerText = t.title;
	document.getElementById('preview-favicon').src = t.tabs ? `../icons/${iconTheme}/${t.selection ? 'selection' : 'window'}.png` : (getUrlParam('noImg') ? '../icons/unknown.png' : getFaviconUrl(t.url));
	document.getElementById(t.tabs ? (t.selection ? 'selection' : 'window') : 'tab').classList.add('active');
}
async function toggleRepeat(e) {
	if (document.querySelector('.repeat-choice.disabled')) return;
	var repeat = e.target.checked;
	var choices = await getChoices();
	var config = await getOptions(['popup']);
	Object.entries(choices).forEach(async ([name, o]) => {
		var c = document.getElementById(name);
		c.classList.toggle('disabled', ((!repeat && !!o.disabled) || (repeat && !!o.repeatDisabled)));
		c.classList.toggle('always-disabled', ((!repeat && !!o.disabled) || (repeat && !!o.repeatDisabled)));
		if (['weekend', 'monday', 'week', 'month'].includes(name)) o.time = await getTimeWithModifier(name);
		c.querySelector('.label .text').innerText = repeat ? o.repeatLabel : o.label;
		if (name !== 'startup') {
			c.querySelector('.date').innerText = repeat ? o.repeatTimeString : o.timeString;
			if (!repeat) console.log(o.label, o.time);
			c.querySelector('.time').innerText = repeat ? o.repeatTime : dayjs(o.time).format(`${getHourFormat(dayjs(o.time).minute() !== 0)}`);
		}
		if (['weekend', 'monday', 'week', 'month'].includes(name)) c.querySelector('select').dispatchEvent(new Event('change'));
	});
	var custom = document.getElementById('custom');
	custom.querySelector('.label').innerText = repeat ? 'Choose a custom interval' : 'Choose your own time';
	document.querySelector('.repeat-container').classList.toggle('hidden', !repeat);
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

	if (getBrowser() !== 'chrome' || true) document.getElementById('group').style.display = 'none';

	if (isSelectionValid) {
		document.getElementById('selection').classList.add('active');
	} else if (isActiveTabValid) {
		document.getElementById('tab').classList.add('active');
	} else if (isWindowValid) {
		document.getElementById('window').classList.add('active');
	} else {
		document.querySelectorAll('.choice, .custom-choice, h3, .repeat-choice, #repeat').forEach(c => {c.classList.add('disabled');c.setAttribute('tabindex','-1')});
		return document.getElementById('preview-text').innerText = `Can't snooze this tab`;
	}
	await generatePreview(document.querySelector('.target.active').id)

	document.querySelectorAll('.target').forEach(t => t.addEventListener('click', async e => {
		if (t.classList.contains('disabled') || t.classList.contains('active')) return;
		document.querySelectorAll('.target').forEach(s => s.classList.remove('active'));
		t.classList.add('active');
		document.getElementById('icon').classList.toggle('flipped');
		await generatePreview(t.id);
	}));
}

async function generatePreview(type) {
	var previewText = document.getElementById('preview-text');
	var previewIcon = document.getElementById('preview-favicon');

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
		c.setAttribute('data-repeat-id', o.repeat_id);
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
		c.onkeyup = e => {if (e.which === 13 || e.which === 32) snooze(o.startUp ? 'startup' : o.time, c)}
		return c
	})));
	document.querySelectorAll('.section.choices .choice select').forEach(s => s.dispatchEvent(new Event('change')));
}

async function buildRepeatCustomChoice() {
	var date = flatpickr('#monthly', {
		inline: true,
		mode: 'multiple',
		minDate: '2020-03-01',
		maxDate: '2020-03-31',
		onChange: validate,
		onValueUpdate: validate
	});
	var time = flatpickr('#repeat-time', {
		inline: true,
		enableTime: true,
		noCalendar: true,
		time_24hr: HOUR_FORMAT && HOUR_FORMAT === 24,
		defaultDate: dayjs().add(1, 'd').format('HH:mm'),
		onChange: validate,
		onValueUpdate: validate
	});
	var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	var firstDayOfWeek = await getOptions('weekStart') || 0;
	var config = await getOptions(['morning', 'evening']);
	dayNames.slice(firstDayOfWeek).concat(dayNames.slice(0, firstDayOfWeek)).forEach(day => {
		var span = Object.assign(document.createElement('span'), {innerText: day});
		span.setAttribute('data-value', dayNames.indexOf(day));
		span.addEventListener('click', _ => {
			span.classList.toggle('active')
			validate();
		});
		document.querySelector('.repeat-week-wrapper div').append(wrapInDiv({className: 'day-choice'}, span));
	});

	var reset = _ => {
		date.setDate([]);
		time.setDate(dayjs().format('HH:mm'));
		document.querySelectorAll('.day-choice span.active').forEach(s => s.classList.remove('active'));
		validate();
	}

	var validate = async _ => {
		await new Promise(r => setTimeout(r, 50));
		var isValid = false, isWeekly = document.querySelector('.repeat-interval.active').getAttribute('data-type') === 'weekly';
		document.querySelector('.date-display').innerText = `Select ${isWeekly ? 'days' : 'dates'}`;
		document.querySelector('.time-display').innerText = dayjs(time.selectedDates).format(getHourFormat(true));
		document.querySelector('.submit-btn').classList.toggle('disabled', true);
		document.getElementById('next-wakeup').innerText = '-';
		if (isWeekly) {
			var days = Array.from(document.querySelectorAll('.day-choice span.active')).map(s => parseInt(s.getAttribute('data-value')));
			if (days.length) {
				document.querySelector('.date-display').innerText = days.length <= 2 ? `${days.map(d => dayNames[d].substring(0,3 )).join(', ')} every week` : `${days.length} days every week`;
				isValid = true;
			}
		} else if (date.selectedDates.length) {
			var dates = date.selectedDates, isValid = true;
			document.querySelector('.date-display').innerText = dates.length === 1 ? `${dates.map(d => getOrdinal(dayjs(d).format('D'))).join(', ')} of every month` : `${dates.length} days every month`;
		} 
		document.querySelectorAll('.repeat-time-wrapper .action').forEach(a => {
			var action = a.getAttribute('data-value'), actionValue = dayjs();
			if (action == 'morning') actionValue = dayjs().startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm');
			if (action == 'evening') actionValue = dayjs().startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm');
			a.classList.toggle('disabled', dayjs(time.selectedDates).format('HHmm') === actionValue.format('HHmm'));
		});
		if (isValid) {
			var data = {type: 'custom', time: [dayjs(time.selectedDates).hour(), dayjs(time.selectedDates).minute()]};
			if (document.querySelector('.repeat-interval.active').getAttribute('data-type') === 'weekly') {
				data.weekly = Array.from(document.querySelectorAll('.day-choice span.active')).map(d => parseInt(d.getAttribute('data-value'))).sort(desc);
			} else {
				data.monthly = document.getElementById('monthly')._flatpickr.selectedDates.map(d => dayjs(d).date()).sort(desc);
			}
			var wakeUpTime = await calculateNextSnoozeTime(data);
			document.getElementById('next-wakeup').innerText = formatSnoozedUntil({wakeUpTime});
			document.querySelector('.submit-btn').classList.toggle('disabled', false);
		}
	}

	if (document.querySelector('.repeat-time-wrapper .f-am-pm')) document.querySelector('.repeat-time-wrapper .f-am-pm').addEventListener('click', validate);
	document.querySelector('.repeat-time-wrapper .reset-action').addEventListener('click', _ => {reset();validate()});

	document.querySelector('.repeat-month-wrapper .f-days').addEventListener('click', validate);
	document.querySelectorAll('.repeat-time-wrapper input').forEach(i => {
		i.addEventListener('blur', validate);
		i.addEventListener('increment', validate);
		i.addEventListener('keyup', e => {if (e.which && (e.which === 38 || e.which === 40)) validate()});
	});
	document.querySelectorAll('.repeat-time-wrapper .action').forEach(a => a.addEventListener('click', _ => {
		if (a.classList.contains('disabled')) return;
		var action = a.getAttribute('data-value'), actionValue = dayjs();
		if (action == 'morning') actionValue = dayjs().startOf('d').add(config.morning[0], 'h').add(config.morning[1], 'm');
		if (action == 'evening') actionValue = dayjs().startOf('d').add(config.evening[0], 'h').add(config.evening[1], 'm');
		time.setDate(actionValue.toDate());
		validate();
	}));

	document.getElementById('repeat').addEventListener('change', e => {if (e.target.checked) validate()});
	document.querySelectorAll('.repeat-interval').forEach(ri => ri.addEventListener('click', e => {
		if (e.target.classList.contains('active')) return;

		document.querySelectorAll('.repeat-interval').forEach(rs => rs.classList.remove('active'));
		e.target.classList.add('active');

		document.querySelectorAll('.repeat-section > div.r-section').forEach(rdw => rdw.classList.add('hidden'));
		if (e.target.getAttribute('data-type') == 'weekly') document.querySelector('.repeat-week-wrapper').classList.remove('hidden');
		if (e.target.getAttribute('data-type') == 'monthly') {
			document.querySelector('.repeat-month-wrapper').classList.remove('hidden');
			var m = document.querySelector('.repeat-month-wrapper'), days = Array.from(m.querySelectorAll('.dayContainer .f-day:not(.f-disabled):not(.nextMonthDay)'));
			var bounds = days.map(d => d.getBoundingClientRect()).map((b, i) => ({index: i, left: b.left, right: b.right, top: b.top, bottom: b.bottom}));
			var func = (x, y) => {
				bounds.filter(b => b.left <= x && x <= b.right && b.top <= y && y <= b.bottom).forEach(b => {
					date.setDate([...new Set(date.selectedDates.map(d => dayjs(d).format('YYYY-MM-DD')).concat(`2020-03-${days[b.index].innerText}`))])
				});
				validate();
			}
			var selectMultipleDates = e => {
				clearTimeout(debounce);
				debounce = setTimeout(_ => func(e.clientX, e.clientY), 15);
			}
			m.addEventListener('mousedown', e => {e.preventDefault(); m.addEventListener('mouseover', selectMultipleDates)});
			m.addEventListener('mouseup', e => {e.preventDefault(); m.removeEventListener('mouseover', selectMultipleDates)});
			m.addEventListener('mouseleave', e => {m.removeEventListener('mouseover', selectMultipleDates)});
		}
		validate();
	}));
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
	

	var getDateTime = _ => {
		return dayjs(dayjs(date.selectedDates).format('YYYY-MM-DD') + dayjs(time.selectedDates).format('HH:mm'))
	};

	var reset = _ => {
		var now = dayjs();
		time.setDate(now.format('HH:mm'));
		date.setDate(now.format('YYYY-MM-DD'));
	}

	var validate = async _ => {
		await new Promise(r => setTimeout(r, 50));
		var now = dayjs();
		document.querySelectorAll('.time-wrapper .action').forEach(action => {
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
			document.querySelector('.form-overlay').classList.add('show');
			document.querySelector('.keyboard').classList.remove('show');
		},
		onkeydown: e => {
			if (!e || e.which !== 13 && e.which !== 32) return;
			customChoice.classList.add('focused');
			document.querySelectorAll('.choice').forEach(c => {c.classList.add('disabled');c.setAttribute('tabindex','-1')});
			document.querySelector('.form-overlay').classList.add('show');
			document.querySelector('.keyboard').classList.remove('show');
		}
	}, wrapInDiv('', icon, label), wrapInDiv('custom-info', wrapInDiv('display', wrapInDiv('date-display'), wrapInDiv('time-display')), submitButton));
	document.querySelector('.section.special-choices').prepend(customChoice);
	customChoice.setAttribute('data-repeat-id', 'custom');
	customChoice.addEventListener('mouseover', _ => customChoice.classList.add('really-focused'))
	customChoice.addEventListener('mouseout', _ => customChoice.classList.remove('really-focused'))

	// attach listeners
	document.querySelector('.overlay-close-btn').addEventListener('click', _ => {
		customChoice.classList.remove('focused');
		document.querySelectorAll('.choice').forEach(c => {c.classList.remove('disabled');c.setAttribute('tabindex','0')});
		document.querySelector('.popup-checkbox input').setAttribute('tabindex', '0');
		document.querySelector('.form-overlay').classList.remove('show');
		document.querySelector('.keyboard').classList.add('show');
	})
	document.querySelectorAll('.time-wrapper .action').forEach(action => action.addEventListener('click', _ => {
		if (action.classList.contains('disabled')) return;
		var amount = parseInt(action.getAttribute('data-value'));
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
	if (document.querySelector('.time-wrapper .f-am-pm')) document.querySelector('.time-wrapper .f-am-pm').addEventListener('click', validate);
	
	document.querySelector('.time-wrapper .reset-action').addEventListener('click', _ => {reset();validate()});

	document.querySelector('.date-wrapper .f-days').addEventListener('click', e => {if (e.target.classList.contains('f-day')) validate()});
	document.querySelectorAll('.time-wrapper input').forEach(i => {
		i.addEventListener('blur', validate);
		i.addEventListener('increment', validate);
		i.addEventListener('keyup', e => {if (e.which && (e.which === 38 || e.which === 40)) validate()});
	});

	document.getElementById('repeat').addEventListener('change', e => {if (!e.target.checked) validate()});
	validate();
}

async function modify(time, choice) {
	if (parent && parent.deleteTabFromDiv) parent.deleteTabFromDiv(getUrlParam('tabId'));
	var response = await editSnoozed(getUrlParam('tabId'), time, isInDupeMode);
	if (!response.edited && !response.duped) return;
	await displayPreviewAnimation(choice, time.format ? time.format('.HHmm') : '', response.duped ? 'Welcome to the clone zone' : 'Going back to sleep');
	if (parent && parent.closePopupModal) setTimeout(_ => parent.closePopupModal(), closeDelay);
}

async function snooze(time, choice) {
	time = ['weekend', 'monday', 'week', 'month'].includes(choice.id) ? await getTimeWithModifier(choice.id) : time;
	var response, target = document.querySelector('.target.active');
	if (!['tab', 'window', 'selection', 'group'].includes(target.id)) return;

	if (document.getElementById('repeat').checked) {
		var t, data = {type: choice.getAttribute('data-repeat-id'), time: [time.hour(), time.minute()]};
		if (data.type === 'daily') data.time = [dayjs().hour(), dayjs().minute()];
		if (data.type === 'weekends') data.weekly = [6];
		if (data.type === 'mondays') data.weekly = [1];
		if (data.type === 'weekly') data.weekly = [dayjs().day()];
		if (data.type === 'monthly') data.monthly = [dayjs().date()];
		if (data.type === 'custom') {
			var pickr = dayjs(document.getElementById('repeat-time')._flatpickr.selectedDates);
			data.time = [pickr.hour(), pickr.minute()];
			console.log(data, document.querySelector('.repeat-interval.active').getAttribute('data-type'));
			if (document.querySelector('.repeat-interval.active').getAttribute('data-type') === 'weekly') {
				data.weekly = Array.from(document.querySelectorAll('.day-choice span.active')).map(d => parseInt(d.getAttribute('data-value'))).sort(desc);
			}
			if (document.querySelector('.repeat-interval.active').getAttribute('data-type') === 'monthly') {
				data.monthly = document.getElementById('monthly')._flatpickr.selectedDates.map(d => dayjs(d).date()).sort(desc);
			}
		}
		if ((isInEditMode || isInDupeMode) && getUrlParam('tabId')) {
			if (parent && parent.deleteTabFromDiv) parent.deleteTabFromDiv(getUrlParam('tabId'));
			response = await editRecurringSnoozed(getUrlParam('tabId'), data, isInDupeMode);
			if (!response.edited && !response.duped) return;
			await displayPreviewAnimation(choice, time.format ? time.format('.HHmm') : '', response.duped ? 'Duplicating...' : 'Going back to sleep');
			if (parent && parent.closePopupModal) setTimeout(_ => parent.closePopupModal(), closeDelay);
		} else {
			response = await snoozeRecurring(target.id, data);
		}
	} else if ((isInEditMode || isInDupeMode) && getUrlParam('tabId')) {
		return modify(time, choice);
	} else if (target.id === 'tab') {
		response = await snoozeTab(time);
	} else if (target.id === 'window') {
		response = await snoozeWindow(time);
	} else if (target.id === 'selection') {
		response = await snoozeWindow(time, true);
	}
	if (!response || (!response.tabId && !response.windowId)) return;
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