async function initialize() {
	document.querySelector('.nap-room').addEventListener('keyup', e => {if (e.which === 13) openExtensionTab('/html/nap-room.html')})
	document.querySelector('.nap-room').addEventListener('click', _ => openExtensionTab('/html/nap-room.html'));
	showIconOnScroll();
	fillAbout()

	if (window.location.hash) {
		if (document.getElementById(window.location.hash.slice(1))) highlightSetting(window.location.hash.slice(1))
		window.location.hash = '';
		window.history.replaceState(null, null, window.location.pathname);
	}
	var options = await getOptions();
	options = upgradeSettings(options);
	if (options.icons) document.querySelector('.nap-room img').src = `../icons/${options.icons}/nap-room.png`;

	try {updateFormValues(options)} catch(e) {}
	
	addListeners();
	await fetchHourFormat();

	// calculateStorage();
	// chrome.storage.onChanged.addListener(calculateStorage);
	

	if (getBrowser() === 'safari') chrome.runtime.sendMessage({wakeUp: true});
}
function highlightSetting(name, condition) {
	var el = document.getElementById(name).closest('.input-container');
	if (condition !== undefined) return el.classList.toggle('highlight', condition)
	el.classList.add('highlight');
	setTimeout(_ =>el.scrollIntoView({behavior: 'smooth', block: 'center'}), 1000);
	document.getElementById(name).addEventListener('click', _ => el.classList.remove('highlight'), {once: true})
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
	['morning', 'evening'].forEach(o => {
		if (typeof storage[o] === 'number' || (typeof storage[o] === 'object' && storage[o].length !== 2)) storage[o] = [storage[o], 0];
		document.getElementById(`${o}_h`).value = storage[o][0];
		document.getElementById(`${o}_m`).value = storage[o][1];
	});
	['weekend', 'monday', 'week', 'month'].forEach(po => {
		document.querySelector(`#popup_${po}`).value = storage.popup && storage.popup[po] ? storage.popup[po] : (storage.timeOfDay || 'morning');
	});
	['history', 'icons', 'theme', 'notifications', 'badge', 'closeDelay', 'hourFormat', 'polling'].forEach(o => {
		if (storage[o] !== undefined && document.querySelector(`#${o} option[value="${storage[o]}"]`)) {
			document.getElementById(o).value = storage[o].toString()
			document.getElementById(o).setAttribute('data-orig-value', storage[o]);
		}
	});
	if (storage.contextMenu && storage.contextMenu.length) storage.contextMenu.forEach(o => document.getElementById(o).checked = true);
	resizeDropdowns();
}

function addListeners() {
	document.querySelectorAll('select').forEach(s => s.addEventListener('change', save));
	document.querySelectorAll('#contextMenu input').forEach(c => c.addEventListener('change', e => save))

	document.querySelector('#shortcut .btn').addEventListener('click', toggleShortcuts);
	document.querySelector('#shortcut .btn').onkeyup = e => {if (e.which === 13) toggleShortcuts()}

	document.querySelector('#right-click .btn').addEventListener('click', toggleRightClickOptions);
	document.querySelector('#right-click .btn').onkeyup = e => {if (e.which === 13) toggleRightClickOptions()}

	document.addEventListener('visibilitychange', updateKeyBindings);

	document.querySelectorAll('a[data-highlight="history"]').forEach(a => a.addEventListener('click', e => highlightSetting('history')))

	document.getElementById('import').addEventListener('click', _ => document.getElementById('import_hidden').click());
	document.getElementById('import').onkeyup = e => {if (e.which === 13) document.getElementById('import_hidden').click()}
	document.getElementById('import_hidden').addEventListener('change', importTabs);

	document.getElementById('export').addEventListener('click', exportTabs);
	document.getElementById('export').onkeyup = e => {if (e.which === 13) exportTabs()}

	document.getElementById('reset').addEventListener('click', resetSettings);
	document.getElementById('reset').onkeyup = e => {if (e.which === 13) resetSettings()}

	document.querySelector('code').addEventListener('click', _ => {
		clipboard('about:addons')
		document.querySelector('body > .copied').classList.add('toast');
		setTimeout(_ => document.querySelector('body > .copied').classList.remove('toast'), 4000)
	});
}

async function save(e) {
	e.stopPropagation();
	if (e && e.target.id === 'history') {
		var tabs = await getSnoozedTabs();
		var count = tabs.filter(t => t.opened && dayjs().isAfter(dayjs(t.opened).add(e.target.value, 'd'))).length;
		if (count > 0 && !window.confirm(`Changing this setting will remove ${count} tab${count > 1 ? 's' : ''} from your Snoozz history. Are you sure you want to continue with this change?`)) {
			return e.target.value = e.target.getAttribute('data-orig-value');
		}
	}

	var options = {popup: {}}
	if (e && ['morning', 'evening'].includes(e.target.id)) {
		var tabs = await getSnoozedTabs();
		var ot = parseInt(e.target.getAttribute('data-orig-value'));
		var f = t => !t.opened && dayjs(t.wakeUpTime).hour() === ot && dayjs(t.wakeUpTime).minute() === 0 && dayjs(t.wakeUpTime).second() === 0
		var tabsToChange = tabs.filter(f);
		if (tabsToChange.length) {
			var count = `${tabsToChange.length > 1 ? 'are' : 'is'} ${tabsToChange.length} tab${tabsToChange.length > 1 ? 's' : ''}`
			if (confirm(`There ${count} scheduled to wake up at ${dayjs().minute(0).hour(ot).format(getHourFormat())}.
Would you like to update ${tabsToChange.length > 1 ? 'them' : 'it'} to snooze till ${dayjs().minute(0).hour(e.target.value).format(getHourFormat())}?`)) {
				tabs.filter(f).forEach(t => {
					t.modifiedTime = dayjs().valueOf();
					t.wakeUpTime = dayjs(t.wakeUpTime).hour(e.target.value).valueOf()
				})
				await saveTabs(tabs);
			}
		}
	}
	document.querySelectorAll('select.direct').forEach(s => options[s.id] = isNaN(s.value) ? s.value : parseInt(s.value));
	document.querySelectorAll('select.popup').forEach(p => options.popup[p.id.replace('popup_', '')] = p.value);
	// handle morning evening time separately
	['morning', 'evening'].forEach(o => options[o] = [parseInt(document.getElementById(`${o}_h`).value), parseInt(document.getElementById(`${o}_m`).value)]);
	options.contextMenu = Array.from(document.querySelectorAll('#contextMenu input:checked')).map(c => c.id);
	await saveOptions(options);
	await setTheme();
	await fetchHourFormat();
	await changeIcons(options.icons);
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
	browserInfo.querySelectorAll('a[data-href]').forEach(s => {
		s.onclick = e => chrome.tabs.create({url: e.target.getAttribute('data-href'), active: true});
		s.onkeyUp = e => { if (e.which === 13) chrome.tabs.create({url: e.target.getAttribute('data-href'), active: true})}
	});
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
		if (c.name === 'nap-room') bindings.append(wrapInDiv('flex', wrapInDiv({innerText: 'Open Sleeping Tabs'}), keys));
		if (c.name === '_execute_browser_action') bindings.append(wrapInDiv('flex', wrapInDiv({innerText: 'Open Popup'}), keys));
	});
	if (document.getElementById('shortcut').classList.contains('show')) {
		document.querySelector('.shortcuts').style.maxHeight = document.querySelector('.shortcuts').scrollHeight + 'px';	
	} 
}

async function resetSettings() {
	if (!confirm('Are you sure you want to reset all settings? \nYou can\'t undo this.')) return;

	var defaultOptions = {
		morning: [9, 0],
		evening: [18, 0],
		hourFormat: 12,
		icons: 'human',
		theme: 'light',
		notifications: 'on',
		history: 14,
		badge: 'today',
		closeDelay: 1000,
		polling: 'on',
		popup: {weekend: 'morning', monday: 'morning', week: 'morning', month: 'morning'},
		contextMenu: ['startup', 'in-an-hour', 'today-evening', 'tom-morning', 'weekend']
	}
	await saveOptions(defaultOptions);
	updateFormValues(defaultOptions);
	await setTheme();
}

async function changeIcons(name) {
	if (!name) name = await getOptions('icons');
	if (!name || !name.length) name = 'human';
	document.querySelector('.nap-room img').src = `../icons/${name}/nap-room.png`;
}

async function exportTabs() {
	var tabs = await getSnoozedTabs();
	var now = dayjs();
	var element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(tabs)));
	element.setAttribute('download', `Snoozz_export_${now.format('YYYY')}_${now.format('MM')}_${now.format('DD')}.txt`);
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
}

async function importTabs(e) {
	try {
		var text = await e.target.files[0].text();
		var json_array = JSON.parse(text);
		if (!json_array || !json_array.length) throw false;

		var allTabs = await getSnoozedTabs();
		var existing_ids = allTabs.map(at => at.id), needs_update = [];

		// remove tabs that already exist in the system, or are more recently updated
		json_array = json_array.filter(t => {
			if (!verifyTab(t)) return false;
			if (!existing_ids.includes(t.id))return true;
			var existing = allTabs.find(at => at.id === t.id);
			if (!existing.opened && (t.opened || (t.modifiedTime && !existing.modifiedTime) || (existing.modifiedTime && t.modifiedTime && dayjs(t.modifiedTime) > dayjs(existing.modifiedTime)))) {
				needs_update.push(existing.id);
				return true;
			}
			return false;
		});

		await saveTabs(allTabs.filter(at => !needs_update.includes(at.id)).concat(json_array));

		var count = json_array.length;
		document.querySelector('body > .import-success').innerText = `${count} tab${count === 1 ? ' was' : 's were'} imported from ${e.target.files[0].name}`;
		document.querySelector('body > .import-success').classList.add('toast');
		setTimeout(_ => document.querySelector('body > .import-success').remove('toast'), 4000)
	} catch {
		document.querySelector('body > .import-fail').classList.add('toast');
		setTimeout(_ => document.querySelector('body > .import-fail').remove('toast'), 4000)
	}
}

function fillAbout() {
	var emojis = ['🥭', '🌶️', '🍛', '🐅', '🐘', '🦚', '🍄', '☔', '🏏', '🚃', '🛺', '🪁', '🪔'];
	document.querySelector('.emoji').innerText = emojis[[Math.floor(Math.random() * emojis.length)]];
	document.getElementById('version').innerText = `Snoozz v${chrome.runtime.getManifest().version}`;
}

window.onload = initialize