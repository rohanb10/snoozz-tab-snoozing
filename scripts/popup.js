var collapse, ccContainer, closeDelay = 1000;
async function init() {
	await buildChoices();
	buildCustomChoice();
	await generatePreviews();
 	
 	document.querySelectorAll('.dashboard-btn, .settings').forEach(btn => btn.addEventListener('click', el => {
		openExtensionTab(el.target.dataset.href);
		setTimeout(_ => window.close(), 100);
	}));
	if (getBrowser() === 'firefox') {
		chrome.tabs.onActivated.addListener(_ => setTimeout(_ => window.close(), 50))
		chrome.runtime.onMessage.addListener(msg => {if (msg.closePopup) window.close()});
	}
	if (getBrowser() === 'safari') await chrome.runtime.getBackgroundPage(async bg => {await bg.wakeUpTask()});

	closeDelay = await getOptions('closeDelay');
 	var tabs = await getSnoozedTabs();
 	if (!tabs || tabs.length === 0) return;
 	var todayCount = sleeping(tabs).filter(t => dayjs(t.wakeUpTime).dayOfYear() === dayjs().dayOfYear()).length;
 	if (todayCount > 0) document.querySelector('.upcoming').setAttribute('data-today', todayCount);
}

async function buildChoices() {
	var choices = await getChoices();
	document.querySelector('.section.choices').append(...(Object.entries(choices).map(([name, o]) => {
		var icon = Object.assign(document.createElement('img'), {src: `../icons/${name}.png`});
		var label = wrapInDiv({classList: 'label', innerText: o.label});
		var date = wrapInDiv({classList: 'date', innerText: o.timeString});
		var time = wrapInDiv({classList: 'time', innerText: dayjs(o.time).format(`h${dayjs(o.time).minute() !== 0 ? ':mm ':''}A`)});

		return wrapInDiv({
			classList: `choice ${o.hi} ${o.disabled ? 'disabled' : ''} ${o.isDark ? 'dark-on-hover' : ''}`,
			style: `--bg:${o.color}`,
			onclick: e => snooze(o.time, e.target)
		}, wrapInDiv('', icon, label), wrapInDiv('', date, time));
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
		onmouseover: activateForm,
		onmousemove: activateForm,
		onmouseout: _ => collapse = setTimeout(_ => activateForm(false), 3000),
	}, wrapInDiv('', icon, label), wrapInDiv('custom-choice-form', wrapInDiv('input', date, time), submitButton));

	document.querySelector('.section.choices').after(ccContainer);
}
var activateForm = (a = true) => {ccContainer.classList.toggle('active', a); clearTimeout(collapse)}
var focusForm = (f = true) => {ccContainer.classList.toggle('focused', f); clearTimeout(collapse)}

async function generatePreviews() {
	var windowPreview = document.querySelector('div[data-preview="window"]')
	var tabPreview = document.querySelector('div[data-preview="tab"]')
	
	var allTabs = await getTabsInWindow();
	if (!allTabs || allTabs.length == 0) return;
	if (allTabs.length === undefined) allTabs = [allTabs];

	var activeTab = allTabs.find(at => at.active);
	var validTabs = allTabs.filter(t => !isDefault(t) && isValid(t));

	var isActiveTabValid = validTabs.includes(activeTab);
	// tab preview handler
	document.getElementById('tab-title').innerText = isActiveTabValid ? activeTab.title : `Can't snooze this tab`;
	document.getElementById('tab-favicon').src = isActiveTabValid && activeTab.favIconUrl ? activeTab.favIconUrl : (activeTab ? getFaviconUrl(activeTab.url) : '../icons/unknown.png');
	tabPreview.classList.toggle('disabled', !isActiveTabValid);
	tabPreview.classList.toggle('active', isActiveTabValid);

	// window preview handler
	document.getElementById('window-title').innerText = `${getTabCountLabel(validTabs)} from ${getSiteCountLabel(validTabs)}`;
	windowPreview.classList.toggle('disabled', getBrowser(true) === 'safari' || (validTabs.length === 1 && isActiveTabValid) || validTabs.length === 0);
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
	var selectedPreview = document.querySelector('div[data-preview].active');
	if (!selectedPreview || !['window', 'tab'].includes(selectedPreview.getAttribute('data-preview'))) return;

	var response = selectedPreview.getAttribute('data-preview') === 'window' ? await snoozeWindow(time) : await snoozeTab(time);
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
	preview.appendChild(Object.assign(document.createElement('span'), {
		textContent: `Snoozing ${previewParent.getAttribute('data-preview')}`,
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