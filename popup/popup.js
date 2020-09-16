async function initialize() {
	await configureOptions();

	buildChoices();
	buildCustomChoice();
	await generatePreviews();
 	
 	document.querySelectorAll('.dashboard-btn, .settings').forEach(btn => btn.addEventListener('click', el => {
		if (isFirefox) setTimeout(_ => window.close(), 100);
		openExtTab(el.target.dataset.href);
	}));

 	var tabs = await getStored('snoozed');
 	if (!tabs || tabs.length === 0) return;
 	var todayCount = (tabs.filter(t => dayjs(t.wakeUpTime).dayOfYear() === dayjs().dayOfYear() && !t.opened)).length;
 	if (todayCount > 0) document.querySelector('.upcoming').setAttribute('data-today', todayCount)
}

function buildChoices() {
	var choiceContainer = document.querySelector('.section.choices');
	Object.entries(getChoices()).forEach(([name, config]) => {
		var choice = Object.assign(document.createElement('div'), {
			classList: `choice ${config.disabled ? 'disabled' : ''} ${config.isDark ? 'dark-on-hover' : ''}`,
			style: `--bg:${config.color}`
		})

		var icon = Object.assign(document.createElement('img'), {src: `../icons/${name}.png`});
		var label = Object.assign(document.createElement('div'), {classList: 'label', innerText: config.label});
		var div = document.createElement('div');
		div.append(icon, label);

		var date = Object.assign(document.createElement('div'), {classList: 'date', innerText: config.timeString});
		var time = Object.assign(document.createElement('div'), {classList: 'time', innerText: dayjs(config.time).format('hA')});
		var div2 = document.createElement('div');
		div2.append(date, time);

		choice.append(div, div2);
		choice.addEventListener('click', e => snooze(config.time, e.target));

		choiceContainer.append(choice);
	})
}

var collapseTimeout, ccContainer;
function buildCustomChoice() {
	var NOW = new Date();
	var submitButton = Object.assign(document.createElement('div'), {classList: 'submit-btn disabled', innerText: 'snooze'});
	submitButton.addEventListener('click', e => {
		var dateTime = dayjs(`${date.value} ${time.value}`);

		if (date.value.length === 0 || !date.value.match(/^\d{4}-\d{2}-\d{2}$/)) date.classList.add('invalid');
		if (time.value.length === 0 || !time.value.match(/^\d{2}:\d{2}$/)) time.classList.add('invalid');
		if (dateTime < dayjs()) [date,time].forEach(dt => dt.classList.add('invalid'));

		if ([date,time].some(dt => dt.classList.contains('invalid'))) return
		
		// success
		e.target.classList.add('disabled');
		[date,time].forEach(dt => dt.setAttribute('disabled', true));
		snooze(dateTime, ccContainer)
	});

	var date = Object.assign(document.createElement('input'), {type: 'date', required: true, value: NOW.toISOString().split('T')[0]});
	var time = Object.assign(document.createElement('input'), {type: 'time', required: true, value: NOW.toTimeString().substring(0,5)});

	[date,time].forEach(dt => dt.addEventListener('click', focusForm));
	[date,time].forEach(dt => dt.addEventListener('blur', _ => focusForm(false)));
	[date,time].forEach(dt => dt.addEventListener('change', _=> {
		clearTimeout(collapseTimeout)
		var formEdited = date.value !== NOW.toISOString().split('T')[0] || time.value !== NOW.toTimeString().substring(0,5);
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
	
	var allTabs = await getTabs();
	if (!allTabs || allTabs.length == 0) return;

	// get active tab and filter out invalid tabs
	var activeTab = allTabs.find(at => at.active);
	allTabs = allTabs.filter(t => !['New Tab', 'dashboard | snoozz', 'settings | snoozz'].includes(t.title));

	var isActiveTabValid = allTabs.includes(activeTab);

	// tab preview handler
	document.getElementById('tab-title').innerText = isActiveTabValid ? activeTab.title : `Can't snooze this tab`;
	document.getElementById('tab-favicon').src = isActiveTabValid ? activeTab.favIconUrl : '../icons/unknown.png';
	tabPreview.classList.toggle('disabled', !isActiveTabValid);
	tabPreview.classList.toggle('active', isActiveTabValid);

	// window preview handler
	var siteCount = allTabs.map(vt => getHostname(vt.url)).filter((v,i,s) => s.indexOf(v) === i).length;
	document.getElementById('window-title').innerText = `${allTabs.length} tab${allTabs.length > 1 ? 's' :''} from ${siteCount} ${siteCount > 1 ? 'different websites' : 'website'}`;
	windowPreview.classList.toggle('disabled', isActiveTabValid && allTabs.length === 1)
	windowPreview.classList.toggle('active', !isActiveTabValid && allTabs.length > 0);

	// Disable tab preview if invalid link type
	if (!tabPreview.classList.contains('disabled')) tabPreview.addEventListener('click', toggleActivePreview)
	if (!windowPreview.classList.contains('disabled')) windowPreview.addEventListener('click', toggleActivePreview);

	// Disable choices if both tabs and windows are unsnoozable.
	if (windowPreview.classList.contains('disabled') && tabPreview.classList.contains('disabled')) {
		document.querySelectorAll('.choice, .custom-choice, h3').forEach(c => c.classList.add('disabled'));	
	}
}

function toggleActivePreview(el) {
	var windowPreview = document.querySelector('div[data-preview="window"]')
	var tabPreview = document.querySelector('div[data-preview="tab"]')
	windowPreview.classList.toggle('active', el.currentTarget === windowPreview)
	tabPreview.classList.toggle('active', el.currentTarget === tabPreview)
}

async function snooze(time, choice) {
	var response, selectedPreview = document.querySelector('div[data-preview].active');
	if (!selectedPreview || !['window', 'tab'].includes(selectedPreview.getAttribute('data-preview'))) return;
	response = await (selectedPreview.getAttribute('data-preview') === 'window' ? snoozeWindow(time) : snoozeTab(time));
	
	if (!response.tabId && !response.windowId) return;
	changePreviewAfterSnooze(selectedPreview, choice)
	chrome.runtime.sendMessage(response);
}

async function snoozeTab(snoozeTime) {
	console.log('snoozeTab');
	var activeTab = await getTabs(true);
	var sleepyTab = {
		id: Math.random().toString(36).slice(-6),
		title: activeTab.title,
		url: activeTab.url,
		favicon: activeTab.favIconUrl,
		wakeUpTime: dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
	}
	// await saveTab(sleepyTab);
	var tabId = await getTabId(activeTab.url);
	return {tabId: tabId}
	return {closeTabInBg: true, tabId: tabId}
}

async function snoozeWindow(snoozeTime) {
	console.log('snoozeWindow');
	var tabsInWindow = await getTabs();
	var validTabs = tabsInWindow.filter(t => !['New Tab', 'dashboard | snoozz', 'settings | snoozz'].includes(t.title));
	if (validTabs.length === 1) return await snoozeTab(snoozeTime)
	var sleepyGroup = {
		id: Math.random().toString(36).slice(-6),
		title: document.getElementById('window-title').innerText,
		wakeUpTime: dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
		tabs: tabsInWindow.map(t => {return {title: t.title, url: t.url, favicon: t.favIconUrl}})
	}
	return {windowId: tabsInWindow.find(w => w.active).windowId};
	await saveTabs(sleepyGroup);
	return {closeWindowInBg: true, windowId: tabsInWindow.find(w => w.active).windowId};
}

function changePreviewAfterSnooze(previewParent, choice) {
	document.body.style.pointerEvents = 'none';
	var preview = previewParent.querySelector(`.preview`);
	preview.classList.add('snoozed');
	preview.textContent = '';
	preview.appendChild(Object.assign(document.createElement('span'), {textContent: `Snoozing ${previewParent.getAttribute('data-preview')}`}));
	setTimeout(_ => {
		preview.style.color = choice.classList.contains('dark-on-hover') ? '#fff' : '#000';
		preview.style.backgroundImage = `linear-gradient(to right, ${getComputedStyle(choice).backgroundColor} 50%, rgb(221, 221, 221) 0)`
		preview.classList.add('animate');
	})
}

window.onload = initialize