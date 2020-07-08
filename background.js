function wakeUpTabs() {
	const NOW = new Date();
	// tab actions
	chrome.storage.local.get(['snoozed'], s => {
		var ST = s.snoozed
		if (Object.keys(ST).length === 0){
			chrome.alarms.clear('wakeUpTabs');
			return;
		}
		// remove tabs older than 7 days old
		ST.filter(t => {
			var wut = new Date(t.opened);
			return NOW > (wut.setDate(wut.getDate() + 7))
		});
		var earliest = 9999999999999;
		ST.forEach((t, i) => {
			if (t.opened) return;
			earliest = t.wakeUpTime < earliest ? t.wakeUpTime : earliest;
			if (NOW > t.wakeUpTime) {
				t.opened = NOW.getTime();
				chrome.tabs.create({url: t.url, active: true}, _ => {
					chrome.notifications.create(t.id, {
						type: 'basic',
						iconUrl: chrome.extension.getURL("icons/popup-icon.png"),
						title: 'A tab woke up!',
						message: `${t.title} -- snoozed on ${formatDate(new Date(t.timeCreated))}`,
					});
					chrome.notifications.onClicked.addListener(_ => chrome.tabs.create({url: 'dashboard/dashboard.html'}))
				});
			}
		});
		chrome.storage.local.set({snoozed: ST});
		chrome.alarms.create('wakeUpTabs', {when: earliest});
	});
}

function formatDate(d) {
	return d.toLocaleString('default', {month:'short'}) + ' ' + d.getDate();
}

function daysBetween(d1, d2) {
	var db = Math.floor(Math.abs(d1.getTime() - d2.getTime())/8.64e7);
	return db === 0 ? (d1.getDate() === d2.getDate() ? 0 : 1) : db;
}

chrome.runtime.onStartup.addListener(_ => chrome.alarms.create('wakeUpTabs', {periodInMinutes: 1}));
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'wakeUpTabs') wakeUpTabs()});