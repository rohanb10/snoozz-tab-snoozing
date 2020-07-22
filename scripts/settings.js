'use strict';

var savedTimer;

function initialize() {
	
	chrome.storage.local.get(['snoozedOptions'], s => {
		EXT_OPTIONS = Object.assign(EXT_OPTIONS, s.snoozedOptions);
		if (!s.snoozedOptions ||Object.keys(s.snoozedOptions).length === 0) chrome.storage.local.set({snoozedOptions: EXT_OPTIONS});

		document.querySelectorAll('input').forEach(i => {
			// set values
			i.value = EXT_OPTIONS[i.id] - (i.id === 'evening'? 12 : 0);
			// wait for changed values
			i.addEventListener('input', e => {
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

		document.querySelectorAll('option').forEach(o => {if (o.value === EXT_OPTIONS.badge) o.setAttribute('selected', 'true')})

		document.querySelector('select').addEventListener('change', e => {
			EXT_OPTIONS[e.target.id] = e.target.value;
			save();
		});

		document.querySelector('select').addEventListener('click', removeSavedMessage);
	});

	showIconOnScroll();

	document.querySelector('.dashboard').addEventListener('click', _ => openURL('./dashboard.html'));
}

function removeSavedMessage() {
	document.getElementById('saved').classList.remove('animate')
}

function save() {
	clearTimeout(savedTimer)
	savedTimer = setTimeout(_=> {
		chrome.storage.local.set({snoozedOptions: EXT_OPTIONS}, _ => {
			chrome.storage.local.get(['snoozed'], s => {
				if (!s.snoozed || s.snoozed.length === 0) return;
				updateBadge(s.snoozed);
			})
		})
		document.getElementById('saved').classList.add('animate');
	}, 1000);
}

window.onload = initialize