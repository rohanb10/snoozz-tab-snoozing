var savedTimer;
var OPTIONS = {morning: 9, evening: 18, history: 7};

function initialize() {
	chrome.storage.local.get(['snoozedOptions'], s => {
		OPTIONS = Object.assign(OPTIONS, s.snoozedOptions);
		if (Object.keys(s.snoozedOptions).length === 0) chrome.storage.local.set({snoozedOptions: EXT_OPTIONS});
		document.querySelectorAll('input').forEach(i => {
			i.value = OPTIONS[i.id] - (i.id === 'evening'? 12 : 0);
			i.addEventListener('change', e => {
				var val = parseInt(e.target.value);
				if (parseInt(val) == NaN || e.target.min > val || e.target.max < val) return;
				val += e.target.id === 'evening' ? 12 : 0;
				OPTIONS[e.target.id] = parseInt(e.target.value) + (e.target.id === 'evening' ? 12 : 0);
				save();
			})
			i.addEventListener('focus', _ => document.getElementById('saved').classList.remove('animate'));
		})
	});
	document.querySelector('.dashboard div').addEventListener('click', _ => chrome.tabs.update({url: 'dashboard/dashboard.html'}));
}

function save() {
	clearTimeout(savedTimer)
	savedTimer = setTimeout(_=> {
		chrome.storage.local.set({snoozedOptions: OPTIONS})
		document.getElementById('saved').classList.add('animate');
	}, 1000);
}

window.onload = initialize