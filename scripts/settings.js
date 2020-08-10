'use strict';

var savedTimer;

function initialize() {
	chrome.storage.local.get(['snoozedOptions'], s => {
		EXT_OPTIONS = Object.assign(EXT_OPTIONS, s.snoozedOptions);
		if (!s.snoozedOptions ||Object.keys(s.snoozedOptions).length === 0) chrome.storage.local.set({snoozedOptions: EXT_OPTIONS});

		// numbers
		document.querySelectorAll('input').forEach(i => {
			// set values
			i.value = EXT_OPTIONS[i.id] - (i.id === 'evening'? 12 : 0);
			// wait for changed values
			i.addEventListener('input', e => {
				if (e.target.type === 'checkbox') return;
				var val = parseInt(e.target.value);
				if (parseInt(val) == NaN || parseInt(e.target.min) > val || parseInt(e.target.max) < val) {
					e.target.classList.add('error');
					removeSavedMessage();
					return;
				}
				e.target.classList.remove('error');
				val += e.target.id === 'evening' ? 12 : 0;
				EXT_OPTIONS[e.target.id] = parseInt(e.target.value) + (e.target.id === 'evening' ? 12 : 0);
				save();
			})
			// hide save onfocus
			i.addEventListener('focus', removeSavedMessage);
			// select text onclick
			i.addEventListener('click', e => e.target.select());
		});

		// dropdown
		document.querySelectorAll('option').forEach(o => {if (o.value === EXT_OPTIONS.badge) o.setAttribute('selected', 'true')})
		document.querySelector('select').addEventListener('change', e => {
			EXT_OPTIONS[e.target.id] = e.target.value;
			save();
		});
		document.querySelector('select').addEventListener('click', removeSavedMessage);

		// rightclick
		document.querySelectorAll('.choice input[type=checkbox').forEach(c => {
			c.checked = EXT_OPTIONS['contextMenu'].includes(c.id);
			c.addEventListener('change', e => {
				var cc = document.querySelectorAll('.choice input[type=checkbox]:checked');
				EXT_OPTIONS['contextMenu'] = Array.from(cc).map(c => c.id)
				document.querySelector('.choice-list').classList.toggle('disabled', cc.length > 4);
				document.getElementById('contextMenu').checked = cc.length > 0;
				save();
			})
		});

		var checkedChoices = document.querySelectorAll('.choice input[type=checkbox]:checked');
		document.querySelector('.choice-list').classList.toggle('disabled', checkedChoices.length > 4);
		document.getElementById('contextMenu').checked = checkedChoices.length > 0;
	});

	showIconOnScroll();

	document.querySelector('.dashboard').addEventListener('click', _ => openURL('./dashboard.html'));
}

function removeSavedMessage() {
	document.getElementById('saved').classList.remove('animate')
}

var savedMessageTimeout;
function save() {
	clearTimeout(savedTimer);
	clearTimeout(savedMessageTimeout);
	savedTimer = setTimeout(_=> {
		chrome.storage.local.set({snoozedOptions: EXT_OPTIONS}, _ => {
			chrome.storage.local.get(['snoozed'], s => {
				if (!s.snoozed || s.snoozed.length === 0) return;
				updateBadge(s.snoozed);
			});
			var bg = chrome.extension.getBackgroundPage();
			bg.setUpContextMenus();
		})
		document.getElementById('saved').classList.add('animate');
		savedMessageTimeout = setTimeout(removeSavedMessage, 3000);
	}, 1000);
}

window.onload = initialize