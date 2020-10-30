async function initialize() {
	document.querySelector('.dashboard').addEventListener('click', _ => openExtensionTab('/html/dashboard.html'));
	showIconOnScroll();

	if (window.location.hash) {
		if (document.getElementById(window.location.hash.slice(1))) highlightSetting(window.location.hash.slice(1))
		window.location.hash = '';
		window.history.replaceState(null, null, window.location.pathname);
	}
	var options = await getOptions();
	try {updateFormValues(options)} catch(e) {}
	addListeners();

	document.querySelector('#shortcut .btn').addEventListener('click', toggleShortcuts);
	document.addEventListener('visibilitychange', updateKeyBindings);

	calculateStorage();
	chrome.storage.onChanged.addListener(calculateStorage);

	document.getElementById('reset').addEventListener('click', resetSettings);
	document.getElementById('version').innerText = `Snoozz v${chrome.runtime.getManifest().version}`;

	document.querySelector('code').addEventListener('click', _ => {
		clipboard('about:addons')
		document.querySelector('body > .copied').classList.add('toast');
		setTimeout(_ => document.querySelector('body > .copied').remove('toast'), 4000)
	});

	if (getBrowser() === 'safari') await chrome.runtime.backgroundPage(bg => bg.wakeUpTask());
}
function highlightSetting(name, condition) {
	var el = document.getElementById(name).closest('.input-container');
	if (condition !== undefined) return el.classList.toggle('highlight', condition)
	el.classList.add('highlight');
	document.getElementById(name).addEventListener('click',_ => el.classList.remove('highlight'), {once: true})
}

async function calculateStorage() {
	var available = ((chrome.storage.local.QUOTA_BYTES || 5242880) / 1000).toFixed(1);
	var used = (await getStorageSize() / 1000).toFixed(1);
	var sizeAndSuffix = num => num < 1000 ? num + 'KB' : (num/1000).toFixed(2) + 'MB'
	document.querySelector('.storage-used').style.clipPath = `inset(0 ${99 - (used * 100 / available)}% 0 0)`;
	document.querySelector('.storage-text').innerText = `${sizeAndSuffix(used)} of ${sizeAndSuffix(available)} used.`
	document.querySelector('.storage-low').classList.toggle('hidden', used / available < .75 || used / available >= 1);
	document.querySelector('.storage-full').classList.toggle('hidden', used / available < 1);
	highlightSetting('storage', used / available >= 1)
}

function updateFormValues(storage) {
	['morning', 'evening', 'timeOfDay', 'history', 'badge', 'closeDelay'].forEach(o => document.getElementById(o).value = storage[o].toString())
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

async function save(e) {
	var options = {}
	document.querySelectorAll('select').forEach(s => options[s.id] = isNaN(s.value) ? s.value : parseInt(s.value));
	options.contextMenu = Array.from(document.querySelectorAll('#contextMenu input:checked')).map(c => c.id);
	saveOptions(options);
}

function toggleShortcuts(e) {
	var s = e.target.closest('.input-container');
	s.classList.toggle('show');
	s.querySelectorAll('.mini').forEach(el => el.style.maxHeight = '0');
	updateKeyBindings();

	var browserInfo = s.querySelector(`.${getBrowser()}-info`);
	if (browserInfo === 'chrome-info') browserInfo.querySelector('a[data-href]').addEventListener('click', e => {
		chrome.tabs.create({url: e.target.getAttribute('data-href'), active: true})
	});
	if (s.classList.contains('show')) browserInfo.style.maxHeight = browserInfo.scrollHeight + 'px';

}

async function updateKeyBindings() {
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
	if (document.getElementById('shortcut').classList.contains('show')) {
		document.querySelector('.shortcuts').style.maxHeight = document.querySelector('.shortcuts').scrollHeight + 'px';	
	} 
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