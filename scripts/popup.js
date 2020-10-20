var closeDelay;
async function init() {
	await buildChoices();
	buildCustomChoice();
	await generatePreviews();
 	
 	document.querySelectorAll('.dashboard-btn, .settings').forEach(btn => btn.addEventListener('click', el => {
		if (isFirefox) setTimeout(_ => window.close(), 100);
		openExtensionTab(el.target.dataset.href);
	}));
	if (isFirefox) {
		chrome.tabs.onActivated.addListener(_ => setTimeout(_ => window.close(), 50))
		chrome.runtime.onMessage.addListener(msg => {if (msg.closePopup) window.close()});
	}

 	var tabs = await getSnoozedTabs();
 	if (!tabs || tabs.length === 0) return;
 	var todayCount = sleeping(tabs).filter(t => dayjs(t.wakeUpTime).dayOfYear() === dayjs().dayOfYear()).length;
 	if (todayCount > 0) document.querySelector('.upcoming').setAttribute('data-today', todayCount);

 	closeDelay = await getOptions('closeDelay');
}

async function buildChoices() {
	var choiceContainer = document.querySelector('.section.choices');
	var choices = await getChoices();
	Object.entries(choices).forEach(([name, config]) => {
		var choice = Object.assign(document.createElement('div'), {
			classList: `choice ${config.disabled ? 'disabled' : ''} ${config.isDark ? 'dark-on-hover' : ''}`,
			style: `--bg:${config.color}`
		})

		var icon = Object.assign(document.createElement('img'), {src: `../icons/${name}.png`});
		var label = Object.assign(document.createElement('div'), {classList: 'label', innerText: config.label});
		var div = document.createElement('div');
		div.append(icon, label);

		var date = Object.assign(document.createElement('div'), {classList: 'date', innerText: config.timeString});
		var time = Object.assign(document.createElement('div'), {classList: 'time', innerText: dayjs(config.time).format(`h${dayjs(config.time).minute() !== 0 ? ':mm ':''}A`)});
		var div2 = document.createElement('div');
		div2.append(date, time);

		choice.append(div, div2);
		choice.addEventListener('click', e => snooze(config.time, e.target));

		choiceContainer.append(choice);
	})
}

var collapseTimeout, ccContainer;
function buildCustomChoice() {
	var NOW = dayjs();
	var submitButton = Object.assign(document.createElement('div'), {classList: 'submit-btn disabled', innerText: 'snoozz'});
	submitButton.addEventListener('click', e => {
		var dv = date.value, tv = time.value;
		var dateTime = dayjs(`${dv} ${tv}`);

		if (dv.length === 0 || !dv.match(/^\d{4}-\d{2}-\d{2}$/) || dayjs(dv).dayOfYear() < dayjs().dayOfYear()) return date.classList.add('invalid');
		if (tv.length === 0 || !tv.match(/^\d{2}:\d{2}$/) || dateTime <= dayjs()) return time.classList.add('invalid');
		
		// success
		e.target.classList.add('disabled');
		[date,time].forEach(dt => dt.setAttribute('disabled', true));
		snooze(dateTime, ccContainer)
	});

	var date = Object.assign(document.createElement('input'), {type: 'date', required: true, value: NOW.format('YYYY-MM-DD')});
	var time = Object.assign(document.createElement('input'), {type: 'time', required: true, value: NOW.format('HH:mm')});

	[date,time].forEach(dt => dt.addEventListener('click', focusForm));
	[date,time].forEach(dt => dt.addEventListener('blur', _ => focusForm(false)));
	[date,time].forEach(dt => dt.addEventListener('change', _=> {
		clearTimeout(collapseTimeout)
		var formEdited = date.value !== NOW.format('YYYY-MM-DD') || time.value !== NOW.format('HH:mm');
		if (formEdited) submitButton.classList.remove('disabled');
		if (!formEdited) collapseTimeout = setTimeout(_ => cc.classList.remove('active'), 3000);
	}));
	[date,time].forEach(dt => dt.addEventListener('input', el => [date,time].forEach(ddtt => ddtt.classList.remove('invalid'))));

	var input = Object.assign(document.createElement('div'), {classList: 'input'});
	input.append(date, time);

	var ccForm = Object.assign(document.createElement('div'), {classList: 'custom-choice-form'});
	ccForm.append(input, submitButton);

	ccContainer = Object.assign(document.createElement('div'), {classList: 'custom-choice dark-on-hover',style: '--bg: #4C72CA'});
	ccContainer.addEventListener('mouseover', activateForm);
	ccContainer.addEventListener('mousemove', activateForm);
	ccContainer.addEventListener('mouseout', e => {
		if (!submitButton.classList.contains('disabled')) return;
		collapseTimeout = setTimeout(_ => activateForm(false), 3000);
	})

	var icon = Object.assign(document.createElement('img'), {src: `../icons/alarm.png`})
	var label = Object.assign(document.createElement('div'), {classList: 'label', innerText: 'Choose your own time'});
	var labelDiv = document.createElement('div');
	labelDiv.append(icon, label);

	ccContainer.append(labelDiv, ccForm)

	document.querySelector('.section.choices').after(ccContainer);
}

function activateForm(shouldActivate = true) {
	ccContainer.classList.toggle('active', shouldActivate);
	clearTimeout(collapseTimeout);
}
function focusForm(shouldFocus = true) {
	ccContainer.classList.toggle('focused', shouldFocus);
	clearTimeout(collapseTimeout);
}

async function generatePreviews() {
	var windowPreview = document.querySelector('div[data-preview="window"]')
	var tabPreview = document.querySelector('div[data-preview="tab"]')
	
	var allTabs = await getTabsInWindow();
	if (!allTabs || allTabs.length == 0) return;

	var activeTab = allTabs.find(at => at.active);
	var validTabs = allTabs.filter(t => !isDefault(t) && isValid(t));

	var isActiveTabValid = validTabs.includes(activeTab);
	// tab preview handler
	document.getElementById('tab-title').innerText = isActiveTabValid ? activeTab.title : `Can't snooze this tab`;
	document.getElementById('tab-favicon').src = isActiveTabValid && activeTab.favIconUrl ? activeTab.favIconUrl : '../icons/unknown.png';
	tabPreview.classList.toggle('disabled', !isActiveTabValid);
	tabPreview.classList.toggle('active', isActiveTabValid);

	// window preview handler
	document.getElementById('window-title').innerText = `${getTabCountLabel(validTabs)} from ${getSiteCountLabel(validTabs)}`;
	windowPreview.classList.toggle('disabled', (validTabs.length === 1 && isActiveTabValid) || validTabs.length === 0);
	windowPreview.classList.toggle('active', !isActiveTabValid && validTabs.length > 0);

	// Disable tab preview if invalid link type
	if (!tabPreview.classList.contains('disabled')) tabPreview.addEventListener('click', toggleActivePreview)
	if (!windowPreview.classList.contains('disabled')) windowPreview.addEventListener('click', toggleActivePreview);

	// Disable everything if both tabs and windows are unsnoozable.
	if (validTabs.length === 0 || (windowPreview.classList.contains('disabled') && tabPreview.classList.contains('disabled'))) {
		document.querySelectorAll('.choice, .custom-choice, h3').forEach(c => c.classList.add('disabled'));
	}
}

function toggleActivePreview(el) {
	var windowPreview = document.querySelector('div[data-preview="window"]')
	var tabPreview = document.querySelector('div[data-preview="tab"]')
	windowPreview.classList.toggle('active', el.currentTarget === windowPreview)
	tabPreview.classList.toggle('active', el.currentTarget === tabPreview)
	document.getElementById('icon').classList.toggle('flipped')
}

async function snooze(time, choice) {
	var response, selectedPreview = document.querySelector('div[data-preview].active');
	if (!selectedPreview || !['window', 'tab'].includes(selectedPreview.getAttribute('data-preview'))) return;

	response = selectedPreview.getAttribute('data-preview') === 'window' ? await snoozeWindow(time) : await snoozeTab(time);
	if (response && !(response.tabId || response.windowId)) return;

	await chrome.runtime.sendMessage(Object.assign(response, {close: true, delay: closeDelay}));
	changePreviewAfterSnooze(selectedPreview, choice)
}

function changePreviewAfterSnooze(previewParent, choice) {
	document.body.style.pointerEvents = 'none';
	choice.classList.add('focused');
	var preview = previewParent.querySelector(`.preview`);
	preview.classList.add('snoozed');
	preview.textContent = '';
	preview.appendChild(Object.assign(document.createElement('span'), {textContent: `Snoozing ${previewParent.getAttribute('data-preview')}`}));
	preview.style.transition = `background-position ${closeDelay - 100}ms linear, color 400ms ease-in-out ${(closeDelay/2) - 250}ms`;
	setTimeout(_ => {
		preview.style.color = choice.classList.contains('dark-on-hover') ? '#fff' : '#000';
		preview.style.backgroundImage = `linear-gradient(to right, ${getComputedStyle(choice).backgroundColor} 50%, rgb(221, 221, 221) 0)`
		preview.classList.add('animate');
	})
}

window.onload = init