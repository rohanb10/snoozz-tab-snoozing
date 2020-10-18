async function initialize() {
	document.querySelector('.dashboard').addEventListener('click', _ => openExtensionTab('/html/dashboard.html'), {once:true});
	showIconOnScroll();
	var options = await getOptions();
	try {updateFormValues(options)} catch(e) {}
	addListeners();
	document.getElementById('reset').addEventListener('click', resetSettings)
	document.getElementById('shortcut-btn').addEventListener('click', async e => {
		e.target.classList.toggle('show');
		if (!e.target.classList.contains('show')) return document.querySelectorAll(`.chrome-info, .ff-info, .shortcuts`).forEach(c => c.style.maxHeight = '0');

		populateShortcuts();

		var browserInfo = document.querySelector(`.${isFirefox ? 'ff':'chrome'}-info`);
		if (!isFirefox) browserInfo.querySelector('a[data-href]').addEventListener('click', e => {
			e.preventDefault();
			chrome.tabs.create({url: e.target.getAttribute('data-href'), active: true})
		});
		browserInfo.style.maxHeight = browserInfo.scrollHeight + 'px';
	});
	document.addEventListener('visibilitychange', populateShortcuts);
	document.querySelector('code').addEventListener('click', e => {
		var i = Object.assign(document.createElement('textarea'), {innerText: 'about:addons'});
		document.body.append(i);
		i.select();
		document.execCommand('copy');
		i.remove();
		var c = document.querySelector('body > .copied');
		c.classList.add('toast');
		setTimeout(_ => c.classList.remove('toast'), 4000)
	})
}

async function populateShortcuts() {
	var commands = await getKeyBindings();
	commands = commands.filter(c => c.shortcut && c.shortcut !== '');
	if (commands.length === 0) return document.querySelector('.shortcuts').style.maxHeight = '0px';
	var choices = await getChoices();

	var bindings = document.querySelector('.bindings');
	bindings.innerText = '';

	var splitShortcut = s => s.split(s.indexOf('+') > -1 ? '+' : '');

	commands.forEach(c => {
		var keys = wrapInDiv('', ...splitShortcut(c.shortcut).map(s => Object.assign(document.createElement('kbd'),{innerText: s})));
		bindings.append(wrapInDiv('flex', wrapInDiv({innerText: choices[c.name].label}), keys));
	});
	if (document.querySelector('#shortcut-btn div').classList.contains('show')) {
		document.querySelector('.shortcuts').style.maxHeight = document.querySelector('.shortcuts').scrollHeight + 'px';	
	} 
}

function updateFormValues(storage) {
	document.querySelector(`#morning option[value='${storage.morning}']`).setAttribute('selected', true)
	document.querySelector(`#evening option[value='${storage.evening}']`).setAttribute('selected', true)
	document.querySelector(`#timeOfDay option[value=${storage.timeOfDay}]`).setAttribute('selected', true)
	document.querySelector(`#history option[value='${storage.history}']`).setAttribute('selected', true)
	document.querySelector(`#badge option[value=${storage.badge}]`).setAttribute('selected', true)
	document.querySelector(`#closeDelay option[value='${storage.closeDelay}']`).setAttribute('selected', true)
	if (storage.contextMenu.length > 0) storage.contextMenu.forEach(o => document.getElementById(o).checked = true);
	if (storage.contextMenu.length > 4) document.querySelector('.choice-list').classList.add('disabled');
}

function addListeners() {
	document.querySelectorAll('select').forEach(s => s.addEventListener('change', save));
	document.querySelectorAll('#contextMenu input').forEach(c => c.addEventListener('change', e => {
		// disable if 5 options are selected;
		document.querySelector('.choice-list').classList.toggle('disabled', document.querySelectorAll('#contextMenu input:checked').length > 4);
		save()
	}))
}

async function save() {
	var options = {}
	document.querySelectorAll('select').forEach(s => options[s.id] = isNaN(s.value) ? s.value : parseInt(s.value));
	options.contextMenu = Array.from(document.querySelectorAll('#contextMenu input:checked')).map(c => c.id);
	saveOptions(options);
}

async function resetSettings() {
	if (!confirm('Are you sure you want to reset all settings? \nYou can\'t undo this.')) return;

	var defaultOptions = {
		morning: 9,
		evening: 18,
		timeOfDay: 'morning',
		history: 14,
		badge: 'today',
		closeDelay: 1000,
		contextMenu: ['today-evening', 'tom-morning', 'tom-evening', 'weekend', 'monday']
	}
	await saveOptions(defaultOptions);
	updateFormValues(defaultOptions);
}

window.onload = initialize