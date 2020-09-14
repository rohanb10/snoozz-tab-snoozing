const isFirefox = (window.browser && browser.runtime) || navigator.userAgent.indexOf('Firefox') !== -1;
var EXT_OPTIONS = {history: 7, morning: 9, evening: 18, badge: 'today', contextMenu: ['today-evening', 'tom-morning', 'monday']}
async function conifgureOptions() {
	var storageOptions = await getStored('snoozedOptions');
	EXT_OPTIONS = Object.assign(EXT_OPTIONS, storageOptions)
}

function getChoices() {
	var NOW = dayjs();
	return {
		'today-morning': {
			label: 'This Morning',
			color: '#F7D05C',
			time: NOW.startOf('d').add(EXT_OPTIONS.morning, 'h'),
			timeString: 'Today',
			disabled: NOW.startOf('d').add(EXT_OPTIONS.morning, 'h').valueOf() < dayjs()
		},
		'today-evening': {
			label: 'This Evening',
			color: '#E1AD7A',
			time: NOW.startOf('d').add(EXT_OPTIONS.evening, 'h'),
			timeString: 'Today',
			disabled: NOW.startOf('d').add(EXT_OPTIONS.evening, 'h').valueOf() < dayjs()
		},
		'tom-morning': {
			label: 'Tomorrow Morning',
			color: '#00b77d',
			time: NOW.startOf('d').add(1,'d').add(EXT_OPTIONS.morning, 'h'),
			timeString: NOW.add(1,'d').format('ddd D')
		},
		'tom-evening': {
			label: 'Tomorrow Evening',
			color: '#87CCE2',
			time: NOW.startOf('d').add(1,'d').add(EXT_OPTIONS.evening, 'h'),
			timeString: NOW.add(1,'d').format('ddd D')
		},
		'weekend': {
			label: 'Weekend',
			color: '#F08974',
			time: NOW.startOf('d').weekday(6).add(EXT_OPTIONS.morning, 'h'),
			timeString: NOW.weekday(6).format('ddd, D MMM'),
			// disabled: NOW.weekday(6).dayOfYear() === NOW.add(1, 'd').dayOfYear() || NOW.weekday(6).dayOfYear() === NOW.dayOfYear()
		},
		'monday': {
			label: 'Next Monday',
			color: '#488863',
			time: NOW.startOf('d').weekday(8).add(EXT_OPTIONS.morning, 'h'),
			timeString: NOW.weekday(8).format('ddd, D MMM'),
			isDark: true,
		},
		'week': {
			label: 'Next Week',
			color: '#847AD0',
			time: NOW.add(1, 'week'),
			timeString: NOW.add(1, 'week').format('D MMM'),
			isDark: true,
		},
		'month': {
			label: 'Next Month',
			color: '#F0C26C',
			time: NOW.add(1, 'M'),
			timeString: NOW.add(1, 'M').format('D MMM')
		}
	}
}

function sortArrayByDate(t1,t2) {
	var d1 = new Date(t1.wakeUpTime);
	var d2 = new Date(t2.wakeUpTime);
	return (d1 < d2) ? -1 : ((d1 > d2) ? 1 : 0);
}

function getHostname(url) {
	return Object.assign(document.createElement('a'), {href: url}).hostname;
}
function getBetterUrl(url) {
	var a = Object.assign(document.createElement('a'), {href: url});
	return a.hostname + a.pathname;
}

function wakeUpTabsFromBg() {
	chrome.extension.getBackgroundPage().wakeUpTabs();
}

function updateBadge(tabs) {
	var num = 0;
	tabs = tabs.filter(t => !t.opened);
	console.log(tabs);
	if (tabs.length > 0 && EXT_OPTIONS.badge && EXT_OPTIONS.badge === 'all') num = tabs.length;
	if (tabs.length > 0 && EXT_OPTIONS.badge && EXT_OPTIONS.badge === 'today') num = tabs.filter(t => dayjs().dayOfYear(t.wakeUpTime) === dayjs().dayOfYear()).length;
	chrome.browserAction.setBadgeText({text: num > 0 ? num.toString() : ''});
	chrome.browserAction.setBadgeBackgroundColor({color: '#CF5A77'});
}

function showIconOnScroll() {
	var header = document.querySelector('body > div.flex.center')
	var logo = document.querySelector('body > div.scroll-logo');
	if (!header || !logo) return;

	logo.addEventListener('click', _ => window.scrollTo({top: 0,behavior: 'smooth'}));
	document.addEventListener('scroll', _ => {
		if (logo.classList.contains('hidden') && window.pageYOffset > (header.offsetHeight + header.offsetTop)) {
			logo.classList.remove('hidden')
		} else if (!logo.classList.contains('hidden') && window.pageYOffset <= (header.offsetHeight + header.offsetTop)) {
			logo.classList.add('hidden')
		}
	})
}