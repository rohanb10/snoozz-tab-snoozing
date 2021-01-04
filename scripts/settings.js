async function initialize() {
	document.querySelector('.dashboard').onkeyup = e => {if (e.which === 13) openExtensionTab('/html/dashboard.html')}
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
	document.querySelector('#shortcut .btn').onkeyup = e => {if (e.which === 13) toggleShortcuts()}
	document.querySelector('#right-click .btn').addEventListener('click', toggleRightClickOptions);
	document.querySelector('#right-click .btn').onkeyup = e => {if (e.which === 13) toggleRightClickOptions()}
	document.addEventListener('visibilitychange', updateKeyBindings);

	calculateStorage();
	chrome.storage.onChanged.addListener(calculateStorage);
	document.querySelectorAll('a[data-highlight="history"]').forEach(a => a.addEventListener('click', e => highlightSetting('history')))

	document.getElementById('reset').addEventListener('click', resetSettings);
	document.getElementById('reset').onkeyup = e => {if (e.which === 13) resetSettings()}
	document.getElementById('version').innerText = `Snoozz v${chrome.runtime.getManifest().version}`;

	document.querySelector('code').addEventListener('click', _ => {
		clipboard('about:addons')
		document.querySelector('body > .copied').classList.add('toast');
		setTimeout(_ => document.querySelector('body > .copied').remove('toast'), 4000)
	});

	if (getBrowser() === 'safari') await chrome.runtime.getBackgroundPage(async bg => {await bg.wakeUpTask()});
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
	['morning', 'evening', 'timeOfDay', 'history', 'theme', 'badge', 'closeDelay'].forEach(o => {
		if (storage[o] && document.querySelector(`#${o} option[value="${storage[o]}"]`)) {
			document.getElementById(o).value = storage[o].toString()
			document.getElementById(o).setAttribute('data-orig-value', storage[o]);
		}
	});
	if (storage.contextMenu.length > 0) storage.contextMenu.forEach(o => document.getElementById(o).checked = true);
	if (storage.contextMenu.length > 4) document.querySelectorAll('#contextMenu input:not(:checked)').forEach(c => c.disabled = true)
}

function addListeners() {
	document.querySelectorAll('select').forEach(s => s.addEventListener('change', save));
	document.querySelectorAll('#contextMenu input').forEach(c => c.addEventListener('change', e => {
		if (document.querySelectorAll('#contextMenu input:checked').length > 4) {
			document.querySelectorAll('#contextMenu input:not(:checked)').forEach(c => c.disabled = true)
		} else {
			document.querySelectorAll('#contextMenu input').forEach(c => c.disabled = false)
		}
		// document.querySelector('.choice-list').classList.toggle('disabled', );
		save()
	}))
}

async function save(e) {
	if (e && e.target.id === 'history') {
		var tabs = await getSnoozedTabs();
		var count = tabs.filter(t => t.opened && dayjs().isAfter(dayjs(t.opened).add(e.target.value, 'd'))).length;
		if (count > 0 && !window.confirm(`Changing this setting will remove ${count} tab${count > 1 ? 's' : ''} from your Snoozz history. Are you sure you want to continue with this change?`)) {
			return e.target.value = e.target.getAttribute('data-orig-value');
		}
	}
	var options = {}
	document.querySelectorAll('select').forEach(s => options[s.id] = isNaN(s.value) ? s.value : parseInt(s.value));
	options.contextMenu = Array.from(document.querySelectorAll('#contextMenu input:checked')).map(c => c.id);
	await saveOptions(options);
	await setTheme();
	if (e && e.target.tagName.toLowerCase() === 'select') e.target.setAttribute('data-orig-value', e.target.value);
}

function toggleRightClickOptions(e) {
	
	var collapsed = document.getElementById('contextMenu');
	var s = collapsed.closest('.input-container');
	s.classList.toggle('show');
	collapsed.style.maxHeight = s.classList.contains('show') ? `calc(${collapsed.scrollHeight}px + 1em)` : '0px'
}

function toggleShortcuts(e) {
	var s =  document.getElementById('shortcut').closest('.input-container');
	s.classList.toggle('show');
	s.querySelectorAll('.mini').forEach(el => {
		el.style.maxHeight = '0';
		el.style.visibility= 'hidden';
	});
	updateKeyBindings();

	var browserInfo = s.querySelector(`.${getBrowser()}-info`);
	browserInfo.querySelectorAll('a[data-href]').forEach(s => s.addEventListener('click', e => {
		chrome.tabs.create({url: e.target.getAttribute('data-href'), active: true})
	}));
	if (s.classList.contains('show')) {
		browserInfo.style.maxHeight = browserInfo.scrollHeight + 'px';
		browserInfo.style.visibility = 'visible';
	}
	document.querySelector('.mini.shortcuts').style.visibility = 'visible';

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
		if (choices[c.name]) bindings.append(wrapInDiv('flex', wrapInDiv({innerText: choices[c.name].label}), keys));
		if (c.name === 'dashboard') bindings.append(wrapInDiv('flex', wrapInDiv({innerText: 'Open Sleeping Tabs'}), keys));
		if (c.name === '_execute_browser_action') bindings.append(wrapInDiv('flex', wrapInDiv({innerText: 'Open Popup'}), keys));
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
		theme: 'light',
		history: 14,
		badge: 'today',
		closeDelay: 1000,
		contextMenu: ['today-evening', 'tom-morning', 'tom-evening', 'weekend', 'monday']
	}
	await saveOptions(defaultOptions);
	updateFormValues(defaultOptions);
}

window.onload = initialize