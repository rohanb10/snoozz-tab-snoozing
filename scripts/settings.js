'use strict';

var savedTimer;
var EXT_OPTIONS = {morning: 9, evening: 18, history: 7, badge: 'today'};

function initialize() {
	
	chrome.storage.local.get(['snoozedOptions'], s => {
		EXT_OPTIONS = Object.assign(EXT_OPTIONS, s.snoozedOptions);
		if (!s.snoozedOptions ||Object.keys(s.snoozedOptions).length === 0) chrome.storage.local.set({snoozedOptions: EXT_OPTIONS});

		document.querySelectorAll('input').forEach(i => {
			i.value = EXT_OPTIONS[i.id] - (i.id === 'evening'? 12 : 0);
			i.addEventListener('change', e => {
				var val = parseInt(e.target.value);
				if (parseInt(val) == NaN || e.target.min > val || e.target.max < val) {
					e.preventDefault();
					return;
				}
				val += e.target.id === 'evening' ? 12 : 0;
				EXT_OPTIONS[e.target.id] = parseInt(e.target.value) + (e.target.id === 'evening' ? 12 : 0);
				save();
			})
			i.addEventListener('focus', _ => document.getElementById('saved').classList.remove('animate'));
		});

		document.querySelectorAll('option').forEach(o => {if (o.value === EXT_OPTIONS.badge) o.setAttribute('selected', 'true')})

		document.querySelector('select').addEventListener('change', e => {
			EXT_OPTIONS[e.target.id] = e.target.value;
			save();
		});

		document.querySelector('select').addEventListener('click', _ => document.getElementById('saved').classList.remove('animate'));
	});

	document.querySelector('.dashboard div').addEventListener('click', _ => openURL('./dashboard.html'));
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