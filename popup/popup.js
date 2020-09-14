'use strict';

async function initialize() {
	// wakeUpTabsFromBg();

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

async function generatePreviews() {
	var windowPreview = document.querySelector('div[data-preview="window"]')
	var tabPreview = document.querySelector('div[data-preview="tab"]')
	
	var allTabs = await getTabs();
	if (!allTabs || allTabs.length == 0) return;

	var activeTab = allTabs.find(at => at.active)

	// Disable tab preview if invalid link type
	var activeTabProtocol = activeTab.url.substring(0, activeTab.url.indexOf(':'))
	if (!['http', 'https', 'file'].includes(activeTabProtocol)) {
		activeTab.title = `Cannot snooze tabs starting with\n` + activeTabProtocol + '://';
		activeTab.favIconUrl = '';
		tabPreview.classList.add('disabled');
		toggleActivePreview({currentTarget: windowPreview});
	} else {
		tabPreview.addEventListener('click', _ => toggleActivePreview({currentTarget: tabPreview}))
	}
	tabPreview.querySelector('#tab-title').innerText = activeTab.title;
	tabPreview.querySelector('#tab-favicon').src = activeTab.favIconUrl && activeTab.favIconUrl.length > 0 ? activeTab.favIconUrl : '../icons/unknown.png';
	
	// Remove New Tabs and show tab count.
	allTabs = allTabs.filter(tab => tab.title !== 'New Tab')
	var uniqSiteCount = allTabs.map(at => getHostname(at.url)).filter((v,i,s) => s.indexOf(v) === i).length;
	windowPreview.querySelector('#window-title').innerText = `${allTabs.length > 1 ? allTabs.length + ' tabs' : '1 tab'} from ${uniqSiteCount} ${uniqSiteCount > 1 ? 'different websites' : 'website'}.`;
	if (allTabs.length > 1) {
		windowPreview.addEventListener('click', _ => toggleActivePreview({currentTarget: windowPreview}));
	} else {
		windowPreview.classList.add('disabled');
		windowPreview.classList.remove('active');
		// toggleActivePreview({currentTarget: false});
	}

	// Disable choices if both tabs and windows are unsnoozable.
	if (windowPreview.classList.contains('disabled') && tabPreview.classList.contains('disabled')) {
		document.querySelectorAll('.choice, .custom-choice, h3').forEach(c => c.classList.add('disabled'));	
	}
}

function toggleActivePreview(el) {
	var windowPreview = document.querySelector('div[data-preview="window"]')
	var tabPreview = document.querySelector('div[data-preview="tab"]')
	windowPreview.classList.toggle('active', el === windowPreview)
	tabPreview.classList.toggle('active', el === tabPreview)
}

var collapseTimeout, ccContainer;
function buildCustomChoice() {
	var NOW = new Date();
	var submitButton = Object.assign(document.createElement('div'), {classList: 'submit-btn disabled', innerText: 'snooze'});
	submitButton.addEventListener('click', e => {
		// validate date and time
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

async function snooze(snoozeTime, el) {
	if (document.querySelector('div[data-preview].active').getAttribute('data-preview') === 'window') {
		snoozeAll(snoozeTime, el);
		return;
	}
	return;
	var activeTab = await getTabs(true);
	var sleepyTab = {
		id: Math.random().toString(36).slice(-6),
		title: activeTab.title,
		url: activeTab.url,
		favicon: activeTab.favIconUrl,
		wakeUpTime: dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
	}
	document.body.style.pointerEvents = 'none';
	await saveTab(sleepyTab);
	var tabId = await getTabId(activeTab.url);
	if (!tabId) return;
	changeTabAfterSnooze(el, 'tab')
	chrome.runtime.sendMessage({closeTabInBg: true, tabId: tabId});
	
}

async function snoozeAll(snoozeTime, el) {
	var tabsInWindow = await getTabs();
	var sleepyGroup = {
		id: Math.random().toString(36).slice(-6),
		wakeUpTime: dayjs(snoozeTime).valueOf(),
		timeCreated: dayjs().valueOf(),
		tabs: tabsInWindow.map(t => {return {title: t.title, url: t.url, favicon: t.favIconUrl}})
	}
	document.body.style.pointerEvents = 'none';
	await saveTabs(sleepyGroup);
	var windowId = tabsInWindow.find(w => w.active).windowId;
	if (!windowId) return;
	changeTabAfterSnooze(el, 'window');
	chrome.runtime.sendMessage({closeWindowInBg: true, windowId: windowId})
}

function changePreviewAfterSnooze(choice, previewName) {
	var preview = document.querySelector(`div[data-preview="${previewName}"] .preview`);
	preview.classList.add('snoozed');
	preview.textContent = '';
	preview.appendChild(Object.assign(document.createElement('span'), {textContent: `Snoozing ${previewName}`}));
	setTimeout(_ => {
		preview.style.color = choice.classList.contains('dark-on-hover') ? '#fff' : '#000';
		preview.style.backgroundImage = `linear-gradient(to right, ${getComputedStyle(choice).backgroundColor} 50%, rgb(221, 221, 221) 0)`
		preview.classList.add('animate');
	})
}

function changeTabAfterSnooze(el) {
	document.querySelectorAll('.choice, .custom-choice').forEach(c => c.classList.add(c === el ? 'focused' : 'disabled'));

	var tab = document.querySelector('.tab');
	tab.classList.add('snoozed');
	tab.textContent = '';
	tab.appendChild(Object.assign(document.createElement('span'), {textContent: 'Snoozzed'}));

	setTimeout(_ => {
		var bgColor = getComputedStyle(el).backgroundColor;
		tab.style.color = el.classList.contains('dark-on-hover') ? '#fff' : '#000'
		tab.style.backgroundImage = `linear-gradient(to right, ${bgColor} 50%, rgb(221, 221, 221) 0)`
		tab.classList.add('animate');
	}, 301)
}

window.onload = initialize