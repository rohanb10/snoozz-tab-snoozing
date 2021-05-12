var collapse, ccContainer, closeDelay = 1000;
async function init() {
	await buildChoices();
	buildCustomChoice();
	await buildTargets()
 	
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
 		if (e.which >= 48 && e.which <= 56) {
 			var choices = document.querySelectorAll('.choice');
 			var selectedChoice = choices && choices.length > 0 ? choices[e.which - 48 - 1] : false;
 			if (!selectedChoice || selectedChoice.classList.contains('disabled')) return;
 			choices.forEach(c => c.classList.remove('focused'));
 			selectedChoice.focus();
 		}
 		if (e.which === 13) {
 			var selectedChoice = document.querySelector('.choice.focused');
 			if (!selectedChoice) return;
 			snooze(o.time, c)
 		}
 	})
}

async function buildChoices() {
	var choices = await getChoices();
	document.querySelector('.section.choices').append(...(Object.entries(choices).map(([name, o]) => {
		var icon = Object.assign(document.createElement('img'), {src: `../icons/${name}.png`});
		var label = wrapInDiv({classList: 'label', innerText: o.label});
		var date = wrapInDiv({classList: 'date', innerText: o.timeString});
		var time = wrapInDiv({classList: 'time', innerText: dayjs(o.time).format(`h${dayjs(o.time).minute() !== 0 ? ':mm ':''}A`)});

		var c = wrapInDiv({
			classList: `choice${o.disabled ? ' disabled' : ''}${o.isDark ? ' dark-on-hover' : ''}`,
			style: `--bg:${o.color}`,
			tabIndex: o.disabled ? -1 : 0,
		}, wrapInDiv('', icon, label), wrapInDiv('', date, time));
		c.onclick = _ => snooze(o.time, c)
		c.onkeyup = e => {if (e.which === 13) snooze(o.time, c)}
		return c
	})));
}

function buildCustomChoice() {
	var NOW = dayjs();
	var icon = Object.assign(document.createElement('img'), {src: `../icons/alarm.png`})
	var label = wrapInDiv({classList: 'label', innerText: 'Choose your own time'})
	var submitButton = wrapInDiv({
		classList: 'submit-btn disabled',
		innerText: 'snoozz',
		onclick: e => {
			var dv = date.value, tv = time.value;
			if (dv.length === 0 || !dv.match(/^\d{4}-\d{2}-\d{2}$/) || dayjs(dv).dayOfYear() < dayjs().dayOfYear()) return date.classList.add('invalid');
			if (tv.length === 0 || !tv.match(/^\d{2}:\d{2}$/) || dayjs(dv + tv) <= dayjs()) return time.classList.add('invalid');
			
			e.target.classList.add('disabled');
			[date,time].forEach(i => i.setAttribute('disabled', true));
			snooze(dayjs(dv + tv), ccContainer)
		}
	});

	var date = Object.assign(document.createElement('input'), {type: 'date', required: true, value: NOW.format('YYYY-MM-DD')});
	var time = Object.assign(document.createElement('input'), {type: 'time', required: true, value: NOW.format('HH:mm')});
	[date,time].forEach(dt => {
		dt.addEventListener('click', focusForm)
		dt.addEventListener('blur', _ => collapse = setTimeout(_ => focusForm(false)), 3000)
		dt.addEventListener('input', el => [date,time].forEach(ddtt => ddtt.classList.remove('invalid')))
		dt.addEventListener('change', _ => {
			activateForm = focusForm = _ => {}
			submitButton.classList.remove('disabled')
		});
	})

	ccContainer = wrapInDiv({
		classList: 'custom-choice dark-on-hover',
		style: '--bg: #4C72CA',
		tabIndex: 0,
		onmouseover: activateForm,
		onmousemove: activateForm,
		onmouseout: _ => collapse = setTimeout(_ => activateForm(false), 3000),
	}, wrapInDiv('', icon, label), wrapInDiv('custom-choice-form', wrapInDiv('input', date, time), submitButton));

	document.querySelector('.section.choices').after(ccContainer);
}
var activateForm = (a = true) => {ccContainer.classList.toggle('active', a); clearTimeout(collapse)}
var focusForm = (f = true) => {ccContainer.classList.toggle('focused', f); clearTimeout(collapse)}

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
	var isGroupValid = getBrowser() === 'chrome' && validTabs.length > 1 && activeTab.groupId && activeTab.groupId != -1 && validTabs.filter(vt => vt.groupId && vt.groupId != activeTab.groupId).length > 1
	document.getElementById('group').classList.toggle('disabled', !isGroupValid);

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
		if (e.target.classList.contains('disabled')) return;
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
		previewIcon.src = '../icons/window.png'
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
			color: choice.classList.contains('dark-on-hover') ? '#fff' : '#000',
		}
	}));
	preview.style.transition = `background-position ${closeDelay - 100}ms linear`
	preview.style.backgroundImage = `linear-gradient(to right, ${getComputedStyle(choice).backgroundColor} 50%, ${getComputedStyle(preview).backgroundColor} 0)`
	preview.classList.add('animate');
}
window.onload = init