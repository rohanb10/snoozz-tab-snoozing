'use strict';

var savedTimer;

async function initialize() {
	document.querySelector('.dashboard').addEventListener('click', _ => openExtensionTab('/html/dashboard.html'), {once:true});
	showIconOnScroll();
	var options = await getOptions();
	try {updateFormValues(options)} catch(e) {}
	addListeners();
	document.getElementById('reset').addEventListener('click', resetSettings)
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

async function resetSettings(e) {
	e.preventDefault();
	if (!confirm('Are you sure you want to reset all settings? \nYou can\'t undo this.')) return;

	var defaultOptions = {
		morning: 9,
		evening: 18,
		timeOfDay: 'morning',
		history: 14,
		badge: 'today',
		closeDelay: 2000,
		contextMenu: ['today-evening', 'tom-morning', 'monday']
	}
	await saveOptions(defaultOptions);
	updateFormValues(defaultOptions);
}

window.onload = initialize