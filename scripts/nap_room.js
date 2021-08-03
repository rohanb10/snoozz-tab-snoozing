const TIME_GROUPS = ['Recurring', 'Next Startup', 'Today', 'Tomorrow', 'This Week', 'Next Week', 'Later', 'History'];
var HISTORY = -1, CACHED_TABS = [], ticktock, colorList = [], observer;
async function init() {
	colorList = gradientSteps('#F3B845', '#DF4E76', TIME_GROUPS.length - 1);
	colorList.push('');
	document.querySelector('.settings').onkeyup = e => {if (e.keyCode === 13) openExtensionTab('/html/settings.html')}
	document.querySelector('.settings').addEventListener('click', _ => openExtensionTab('/html/settings.html'), {once:true})
	showIconOnScroll();
	setupClock();

	observer = lozad();

	chrome.storage.onChanged.addListener(async changes => {
		if (changes.snoozed) {
			CACHED_TABS = changes.snoozed.newValue;
			updateTabs();
		}
	});

	chrome.runtime.onMessage.addListener(async msg => {
		if (msg.updateDash) {
			CACHED_TABS = await getSnoozedTabs();
			updateTabs();
		}
	});
	document.addEventListener('visibilitychange', _ => {setupClock();updateTabs()});
	await fetchHourFormat();
	var search = document.getElementById('search');
	search.addEventListener('input', _ => {
		document.body.classList.toggle('searching', search.value.length > 0);
		search.parentElement.classList.toggle('searching', search.value.length > 0);
		search.parentElement.parentElement.classList.toggle('valid-search', search.value.length > 2);
		performSearch(search.value.toLowerCase());
	});

	CACHED_TABS = await getSnoozedTabs();
	HISTORY = await getOptions('history');

	buildTimeGroups();
	await initializeExpandos();
	observer.observe();

	if (getBrowser() === 'safari') chrome.runtime.sendMessage({wakeUp: true});
	checkForUpdates();
}

function setupClock() {
	if (ticktock) clearTimeout(ticktock);
	var NOW = dayjs();
	var currentSecond = parseInt(NOW.second());
	var currentMin = parseInt(NOW.minute());
	var currentHour = parseInt(NOW.hour());
	var rotate = num => `rotate(${num}deg)`;

	document.querySelector('.second').style.transform = rotate(currentSecond * 6);
	document.querySelector('.minute').style.transform = rotate(currentMin * 6);
	document.querySelector('.hour').style.transform = rotate(180 + ((currentHour % 12) * 30));

	moveSecondHand = _ => {
		clearTimeout(ticktock);
		document.querySelector('.second').style.transform = rotate((++currentSecond) * 6);
		if (currentSecond % 60 === 0) document.querySelector('.minute').style.transform = rotate((++currentMin) * 6);
		if (currentMin % 60 === 0 && currentSecond % 60 === 0) document.querySelector('.hour').style.transform = rotate(180 + (((++currentHour) % 12) * 30));
		ticktock = setTimeout(moveSecondHand, 1000)
	}
	ticktock = setTimeout(moveSecondHand, 1000);
}

function updateTabs() {
	var cachedTabIds = CACHED_TABS.map(ct => ct.id);
	var allTabIds = Array.from(document.querySelectorAll('.tab') ?? []).map(at => at.id);

	// if (allTabIds.filter(at => !cachedTabIds.includes(at)).length === 0) return;
	allTabIds.filter(at => !cachedTabIds.includes(at)).forEach(t => document.getElementById(t).remove());

	// add any remaining tabs from cache
	cachedTabIds.forEach(tid => {
		var t = CACHED_TABS.find(ct => ct.id === tid)

		if (document.getElementById(tid)) {
			if (!document.getElementById(tid).closest(`#${getTimeGroup(t)}`)) insertIntoCorrectPosition(t, true)
		} else {
			insertIntoCorrectPosition(t)
		}
	});
	updateTimeGroups();
	observer.observe();
}
function insertIntoCorrectPosition(t, alreadyExists = false) {
	var tab = alreadyExists ? document.getElementById(t.id) : buildTab(t);
	var allTabs, index = 0, group = document.getElementById(getTimeGroup(t));
	if (t && group) allTabs = group.querySelectorAll('.tab');
	if (allTabs && allTabs.length > 0) {
		Array.from(allTabs).map(s => CACHED_TABS.find(ct => ct.id === s.id)).forEach(s => {
			if (!t.opened && dayjs(t.wakeUpTime).isAfter(s.wakeUpTime) || t.wakeUpTime === s.wakeUpTime) index++;
			if (t.opened && dayjs(t.opened).isBefore(s.opened)) index++;
		});
		group.insertBefore(tab, Array.from(allTabs)[index]);
	} else {
		try {group.append(tab)}catch(e){}
	}
	console.log('taActions', t, tab);
	buildTabActions(t, tab)
}

function buildTimeGroups() {
	var container = document.getElementById('time-container');
	
	TIME_GROUPS.forEach((t, i) => {
		var tID = t.replace(/ /g,'_').toLowerCase();
		var timeGroup = Object.assign(document.createElement('div'), {className: 'time-group', id: tID});
		var header = Object.assign(document.createElement('div'), {className: 'flex time-header'});
		var expando = Object.assign(document.createElement('img'), {className: 'expanded', src: '../icons/collapse.png'});
		var name = Object.assign(document.createElement('h2'), {className: 'time-name', innerText: t, style: `border-color:${colorList[i]}`});
		var timeAction = Object.assign(document.createElement('div'), {
			className: `time-action`,
			tabIndex: 0,
			innerText: tID === 'history' ? 'clear history' : 'wake up all'
		});
		timeAction.onclick = async _ => {
			var ids = Array.from(document.querySelectorAll(`#${tID} .tab`)).map(t =>t.id);
			tID === 'history' ? await removeTabsFromHistory(ids) : await wakeUpTabsAbruptly(ids);
		}
		timeAction.onkeyup = async e => {
			if (e.keyCode !== 13) return;
			var ids = Array.from(document.querySelectorAll(`#${tID} .tab`)).map(t =>t.id);
			tID === 'history' ? await removeTabsFromHistory(ids) : await wakeUpTabsAbruptly(ids);
		}
		header.append(wrapInDiv('flex', name, wrapInDiv('expando', expando)), timeAction);
		timeGroup.append(header);
		container.append(timeGroup);
	});

	var s = sleeping(CACHED_TABS);
	if (s.length > 0) s.sort((t1,t2) => t1.wakeUpTime - t2.wakeUpTime).forEach(st => {
		var timeGroup = document.getElementById(getTimeGroup(st));
		if (!timeGroup) return;
		var tab = buildTab(st)
		timeGroup.append(tab);
		buildTabActions(st, tab)
	})

	var awake = CACHED_TABS.filter(t => t.opened);
	if (awake.length > 0) {
		var hist_div = document.getElementById('history')
		awake.sort((t1,t2) => t2.opened - t1.opened).forEach(at => {
			var tab = buildTab(at);
			hist_div.append(tab);
			buildTabActions(at, tab);
		});
	}
	document.getElementById('historyHref').innerText = `${HISTORY} day${HISTORY>1?'s':''}`
	updateTimeGroups();
}

function updateTimeGroups() {
	TIME_GROUPS.forEach(name => {
		var tg = document.getElementById(name.replace(/ /g,"_").toLowerCase())
		var tabCount = Array.from(tg.querySelectorAll('.tab')).filter(t => !t.classList.contains('hidden')).length;
		tg.classList.toggle('hidden', tabCount === 0)
		tg.querySelector('.time-action').classList.toggle('hidden', tabCount < 2);
	})
	var allTabs = document.querySelectorAll('.tab') || []
	var allTabsHidden = !allTabs.length || Array.from(allTabs).every(t => t.classList.contains('hidden'));

	document.querySelector('.instructions').classList.toggle('hidden', allTabs.length > 0);
	document.querySelector('.search-container').classList.toggle('hidden', allTabs.length < 2);
	document.getElementById('no-tabs').classList.toggle('hidden', !allTabsHidden);
	document.getElementById('api-message').classList.toggle('hidden', allTabsHidden)
	var histTabs = document.querySelectorAll('#history .tab') || [];
	document.getElementById('history-message').classList.toggle('hidden', !histTabs.length || Array.from(histTabs).every(t => t.classList.contains('hidden')))
}

function matchQuery(query, against) {
	var array = typeof against === 'string' ? against.toLowerCase().trim().split(' ') : against;
	for (word of query.trim().split(" ")) {
		if (!array.some(a => a.indexOf(word.toLowerCase()) > -1)) return false;
	}
	return true;
}

function search(t, query) {
	if (query.length < 3) return true
	// tab props
	if (t.url && t.url.toLowerCase().indexOf(query) > -1) return true;
	if (t.title && t.title.toLowerCase().indexOf(query) > -1) return true;
	// relative time
	if (t.repeat && !t.opened && ('recurring repeated interval every').indexOf(query) > -1) return true;
	if (t.startUp && !t.opened && ('start starting launch launching next time open opening').indexOf(query) > -1) return true;
	if (!t.opened && ('snoozed sleeping asleep napping snoozzed snoozing snoozzing').indexOf(query) > -1) return true;
	if (t.opened && ('manually deleted removed woke awake history').indexOf(query) > -1) return true;
	// categories
	if (matchQuery(query, getTimeGroup(t, 'wakeUpTime', true).map(tg => tg.replace(/_/g, ' ')))) return true;
	if (matchQuery(query, getTimeGroup(t, 'timeCreated', true).map(tg => tg.replace(/_/g, ' ')))) return true;
	if (matchQuery(query, getTimeGroup(t, 'modifiedTime', true).map(tg => tg.replace(/_/g, ' ')))) return true;
	// absolute time
	if ( t.opened && matchQuery(query, dayjs(t.opened).format('dddd DD MMMM A'))) return true;
	if (!t.opened && t.wakeUpTime && matchQuery(query, dayjs(t.wakeUpTime).format('dddd DD MMMM A'))) return true;
	if ( t.timeCreated && matchQuery(query, dayjs(t.timeCreated).format('dddd DD MMMM A'))) return true;
	return false;
}

function performSearch(searchQuery = '') {
	var tabs = document.querySelectorAll('.tab');
	if (tabs) tabs.forEach(t => t.classList.toggle('hidden', !search((CACHED_TABS).find(ct => ct.id === t.id), searchQuery)));
	updateTimeGroups();
	countSearchItems();
}

function countSearchItems() {
	var all = document.querySelectorAll('.time-group .tab').length;
	var visible = document.querySelectorAll('.time-group .tab:not(.hidden)').length;
	document.querySelector('.search-container').setAttribute('data-search', `Showing ${visible} out of ${all} items`);
}

function buildTabActions(t, tabDiv) {
	tabDiv = tabDiv || document.getElementById(t.id);

	var tabName = tabDiv.querySelector('.tab-name');
	var wakeUpBtn = tabDiv.querySelector('img.wakeup-button');
	var menuBtn = tabDiv.querySelector('img.overflow-button');
	var removeBtn = tabDiv.querySelector('img.remove-button');

	tabName.setAttribute('tabIndex', 0);
	if (!t.tabs) tabName.onclick = _ => openTab(t);
	if (!t.tabs) tabName.onkeyup = e => { if (e.keyCode === 13) openTab(t)};

	if (t.opened) {
		wakeUpBtn.remove();
		menuBtn.remove();
		removeBtn.remove();

		// using new wakeup button as snooze again button for layout purposes
		var newEditBtn = Object.assign(document.createElement('img'), {className:'edit-button', src: '../icons/ext-icon-128.png', tabIndex: 0});
		newEditBtn.onclick = _ => openPopupModal(t.id, 'edit', tabDiv.querySelector('img.icon').getAttribute('src') === '../icons/unknown.png');
		newEditBtn.onkeyup = e => {if (e.keyCode === 13) openPopupModal(t.id, 'edit', tabDiv.querySelector('img.icon').getAttribute('src') === '../icons/unknown.png')}
		tabDiv.querySelector('.wakeup-btn-container').classList.add('again')
		tabDiv.querySelector('.wakeup-btn-container').append(newEditBtn);

		var newRemoveBtn = Object.assign(document.createElement('img'), {className:'remove-button', src: '../icons/close.png', tabIndex: 0});
		newRemoveBtn.onclick = async _ => await removeTabsFromHistory([t.id])
		newRemoveBtn.onkeyup = async e => {if (e.keyCode === 13) await removeTabsFromHistory([t.id])}
		tabDiv.querySelector('.remove-btn-container').append(newRemoveBtn)
	} else {
		wakeUpBtn.onclick = async _ => await wakeUpTabsAbruptly([t.id]);
		wakeUpBtn.onkeyup = async e => {if (e.keyCode === 13) await wakeUpTabsAbruptly([t.id])}
		menuBtn.onclick = _ => openOverflowForDiv(tabDiv);
		menuBtn.onkeyup = e => {if (e.keyCode === 13) openOverflowForDiv(tabDiv)}
		removeBtn.onclick = async _ => await sendTabsToHistory([t.id])
		removeBtn.onkeyup = async e => {if (e.keyCode === 13) await sendTabsToHistory([t.id])}

		// menu items
		var editMenuItem = '', dupeMenuItem = '', pauseMenuItem = '', resumeMenuItem = ''
		editMenuItem = wrapInDiv({className: 'overflow-menu-item edit', innerText: 'Edit Snooze Time', tabIndex: 0});
		editMenuItem.onclick = _ => openPopupModal(t.id, 'edit', tabDiv.querySelector('img.icon').getAttribute('src') === '../icons/unknown.png');
		dupeMenuItem = wrapInDiv({className: 'overflow-menu-item duplicate', innerText: 'Duplicate & Change Time', tabIndex: 0});
		dupeMenuItem.onclick = _ => openPopupModal(t.id, 'dupe', tabDiv.querySelector('img.icon').getAttribute('src') === '../icons/unknown.png');
		if (t.repeat) {
			if (!t.paused) {
				pauseMenuItem = wrapInDiv({className: 'overflow-menu-item pause', innerText: 'Pause Wakeups', tabIndex: 0});
				pauseMenuItem.onclick = _ => togglePause(t, 'pause');
			}
			if (t.paused) {
				resumeMenuItem = wrapInDiv({className: 'overflow-menu-item resume', innerText: 'Resume Wakeups', tabIndex: 0});
				resumeMenuItem.onclick = _ => togglePause(t, 'resume');
			}
		}
		var menu = tabDiv.querySelector('.overflow-menu');
		while (menu.firstChild) menu.removeChild(menu.firstChild);
		menu.append(editMenuItem, dupeMenuItem, pauseMenuItem, resumeMenuItem);
	}
	tabDiv.querySelector('.wakeup-label').innerText = t.deleted ? 'Deleted on' : (t.opened ? `Woke up ${t.opened < t.wakeUpTime ? 'manually' : ''} on` : t.repeat ? 'Next Wake Up' : 'Waking up')
	tabDiv.querySelector('.wakeup-time').innerText = t.opened ? dayjs(t.opened).format('dddd, D MMM') : t.paused ? 'Paused' : formatSnoozedUntil(t);
	tabDiv.querySelector('.wakeup-time').title = dayjs(t.opened ? t.opened : t.wakeUpTime).format(`${getHourFormat(true)} [on] ddd, D MMMM YYYY`);
	return tabDiv;
}

function buildTab(t) {
	var tab = wrapInDiv({className:`tab${t.tabs ? ' window collapsed':''}`, id: t.id});

	var icon = Object.assign(document.createElement('img'), {
		className: `icon lozad ${t.tabs ? 'dropdown':''}`,
		tabIndex: t.tabs ? 0 : -1,
	});
	icon.onerror = _ => icon.src = '../icons/unknown.png';
	icon.setAttribute('data-src', getIconForTab(t));
	var iconContainer = wrapInDiv('icon-container', icon);

	var title = wrapInDiv({className: 'tab-name', innerText: t.title, title: t.url ?? ''});

	var startedNap = wrapInDiv({className:'nap-time', innerText: `Started napping at ${dayjs(t.timeCreated).format(`${getHourFormat(dayjs(t.timeCreated).minute() !== 0)} [on] ddd D MMM YYYY`)}`})
	if (t.modifiedTime) startedNap.innerText = `Last modified at ${dayjs(t.modifiedTime).format(`${getHourFormat(dayjs(t.modifiedTime).minute() !== 0)} [on] ddd D MMM YYYY`)}`;
	var titleContainer = wrapInDiv('title-container', title, startedNap);

	var wakeUpTimeContainer = wrapInDiv('wakeup-time-container', wrapInDiv('wakeup-label'), wrapInDiv('wakeup-time'));

	var littleTabs = '', editMenuItem = '', dupeMenuItem = '', pauseMenuItem = '', resumeMenuItem = '';
	if (t.tabs && t.tabs.length) {
		littleTabs = wrapInDiv('tabs');
		t.tabs.forEach(lt => {
			var littleIcon = Object.assign(document.createElement('img'), {className: 'little-icon'});
			littleIcon.onerror = _ => littleIcon.src = '../icons/unknown.png';
			littleIcon.src = getIconForTab(lt);
			var littleTitle = wrapInDiv({className: 'tab-name', innerText: lt.title});
			var littleTab = wrapInDiv({className: 'little-tab', tabIndex: 0}, littleIcon, littleTitle);
			littleTab.onclick = _ => openTab(lt);
			littleTab.onkeyup = e => {if (e.keyCode === 13) openTab(lt)};
			littleTabs.append(littleTab);
		});

		[iconContainer, titleContainer].forEach(c => c.addEventListener('click', _ => tab.classList.toggle('collapsed')))
		iconContainer.onkeyup = e => {if (e.keyCode === 13) tab.classList.toggle('collapsed')}
	}

	var wakeUpBtn = Object.assign(document.createElement('img'), {className:'wakeup-button', src: '../icons/sun.png', tabIndex: 0});
	var wakeUpBtnContainer = wrapInDiv('wakeup-btn-container tooltip', wakeUpBtn);

	var overflowBtn = Object.assign(document.createElement('img'), {className:'overflow-button', src: '../icons/menu.png', tabIndex: 0});
	var overflowBtnContainer = wrapInDiv('overflow-btn-container tooltip', overflowBtn);

	var overflowMenuContainer = wrapInDiv({className: 'overflow-menu'});

	var removeBtn = Object.assign(document.createElement('img'), {className:'remove-button', src: '../icons/close.png', tabIndex: 0});
	var removeBtnContainer = wrapInDiv('remove-btn-container tooltip', removeBtn);

	tab.append(iconContainer, titleContainer, wakeUpTimeContainer, wakeUpBtnContainer, overflowBtnContainer, removeBtnContainer, overflowMenuContainer, littleTabs);
	return tab;
}

var getIconForTab = t => t.tabs && t.tabs.length ? '../icons/dropdown.svg' : getFaviconUrl(t.url);

function getTimeGroup(tab, timeType = 'wakeUpTime', searchQuery = false) {
	if (!searchQuery && tab.opened) return 'history';
	if (!searchQuery && tab.repeat) return 'recurring';
	if (!searchQuery && tab.startUp) return 'next_startup';

	var group = [];
	if (!tab.opened && !tab[timeType]) return group;
	var now = dayjs(), time = searchQuery && tab.opened ? dayjs(tab.opened) : dayjs(tab[timeType]);
	if (time.week() === now.subtract(1, 'week').week()) 						group.push('last_week');
	if (time.dayOfYear() === now.subtract(1, 'd').dayOfYear()) 					group.push('yesterday');
	if (time.dayOfYear() === now.dayOfYear() && time.year() == now.year()) 		group.push('today');
	if (time.dayOfYear() === now.add(1, 'd').dayOfYear()) 						group.push('tomorrow');
	if (time.week() === now.week()) 											group.push('this_week');
	if (time.week() === now.add(1, 'week').week()) 								group.push('next_week');
	if (time.valueOf() > now.add(1, 'week').valueOf())							group.push('later');
	return searchQuery ? group : group[0];
}

function openPopupModal(tabId, type, imgMissing) {
	closeOverflows()
	var overlay = document.querySelector('body > .iframe-overlay');
	overlay.style.top = window.scrollY + 'px';
	var iframe = document.createElement('iframe');
	iframe.setAttribute('tabIndex', '-1');
	iframe.src = './popup.html?type=' + type + '&tabId=' + tabId + (imgMissing ? '&noImg=true' : '');
	iframe.setAttribute('scrolling', 'no');
	overlay.append(iframe);
	overlay.classList.add('open');
	setTimeout(_ => {try {iframe.contentWindow.focus()} catch(e){}}, 200);
	bsf.freeze();
	overlay.addEventListener('click', closeModalOnOutsideClick, {once: true});
	document.addEventListener('keyup', closeModalOnOutsideClick);
}
function deleteTabFromDiv(tabId) {
	document.getElementById(tabId).outerHTML = '';
}

function closeModalOnOutsideClick(e) {
	if (e.keyCode && e.keyCode === 27) {
		closePopupModal();
		closeOverflows();
	}
	if (e.target && (e.target.classList.contains('iframe-overlay'))) closePopupModal();
	if (e.target && (e.target.classList.contains('overflow-overlay'))) closeOverflows();
}

function resizeIframe() {
	var frame = document.querySelector('body > .iframe-overlay > iframe');
	frame.style.height = frame.contentWindow.document.documentElement.scrollHeight + 'px';
}

function closePopupModal() {
	var overlay = document.querySelector('body > .iframe-overlay');
	overlay.removeEventListener('click', closeModalOnOutsideClick);
	document.removeEventListener('keyup', closeModalOnOutsideClick);
	overlay.classList.remove('open');
	if (overlay.querySelector('iframe')) overlay.querySelector('iframe').remove();
	overlay.style.top = '';
	bsf.unfreeze()
}

function overflowMenuKeyboardNav(e) {
	if (e.which && e.which === 38) console.log('up');
	if (e.which && e.which === 40) console.log('down');
	if (e.which && (e.which === 13 || e.which === 32)) console.log('enter');
}

function openOverflowForDiv(div) {
	div.querySelector('.overflow-menu').classList.add('show');
	div.querySelector('.overflow-menu').querySelector('.overflow-menu-item').focus();
	var overlay = document.querySelector('body > .overflow-overlay');
	overlay.classList.add('open');
	overlay.addEventListener('click', closeModalOnOutsideClick, {once: true});
	document.addEventListener('keyup', closeModalOnOutsideClick);
	document.addEventListener('keyup', overflowMenuKeyboardNav);
}
function closeOverflows() {
	document.querySelectorAll('.overflow-menu.show').forEach(m => m.classList.remove('show'));
	var overlay = document.querySelector('body > .overflow-overlay');
	overlay.classList.remove('open');
	overlay.removeEventListener('click', closeModalOnOutsideClick);
	document.removeEventListener('keyup', closeModalOnOutsideClick);
	document.removeEventListener('keyup', overflowMenuKeyboardNav);
}
async function togglePause(t, state) {
	t.paused = state === 'pause'
	if (state === 'resume') {
		var next = await calculateNextSnoozeTime(t.repeat, t.timeCreated, t.gap)
		t.wakeUpTime = next.valueOf();
	}
	await saveTab(t);
	closeOverflows();
	buildTabActions(t, document.getElementById(t.id))
}

async function initializeExpandos() {
	var o = await getOptions('napCollapsed');
	document.querySelectorAll('.expando').forEach(e => {
		var group = e.closest('.time-group');
		var img = e.querySelector('img');

		e.addEventListener('click', async _ => {
			var nc = await getOptions('napCollapsed') || [];
			if (img.classList.contains('collapsed')) {
				img.src = '../icons/collapse.png';
				img.classList.remove('collapsed');
				img.classList.add('expanded');
				group.classList.remove('group-collapsed');
				await saveOption('napCollapsed', nc.filter(id => id !== group.id));
			} else if (img.classList.contains('expanded')) {
				img.src = '../icons/expand.png';
				img.classList.remove('expanded');
				img.classList.add('collapsed');
				group.classList.add('group-collapsed');
				nc.push(group.id);
				await saveOption('napCollapsed', nc);
			}
		});
		if (o && o.length && o.includes(group.id)) e.click();
	})
}

async function wakeUpTabsAbruptly(ids) {
	if (!ids) return;
	CACHED_TABS.filter(t => ids.includes(t.id) && !t.repeat).forEach(t => t.opened = dayjs().valueOf())
	chrome.runtime.sendMessage({logOptions: ['manually', ids]});
	await saveTabs(CACHED_TABS);
	for (var t of CACHED_TABS.filter(n => ids.includes(n.id))) {
		t.tabs && t.tabs.length ? (t.selection ? await openSelection(t) : await openWindow(t)) : await openTab(t);
	}
	updateTimeGroups();
}

async function sendTabsToHistory(ids) {
	console.log('hi');
	if (!ids) return;
	CACHED_TABS.filter(t => ids.includes(t.id)).forEach(t => {
		['startUp', 'repeat', 'paused', 'gap'].forEach(prop => delete t[prop]);
		t.opened = dayjs().valueOf();
		t.deleted = true;
	});
	chrome.runtime.sendMessage({logOptions: ['history', ids]});
	await saveTabs(CACHED_TABS);
	updateTimeGroups();
}

async function removeTabsFromHistory(ids) {
	if (!ids || (ids.length > 1 && !confirm('Are you sure you want to remove multiple tabs? \nYou can\'t undo this.'))) return;
	var tabs = CACHED_TABS;
	tabs = tabs.filter(t => !ids.includes(t.id));
	chrome.runtime.sendMessage({logOptions: ['delete', ids]});
	await saveTabs(tabs);
	updateTimeGroups();
}

async function checkForUpdates() {
	var p = await new Promise(r => chrome.storage.local.get(['updated'], r));
	if (!p || !p.updated) return;

	if (!document.getElementById('changelog').classList.contains('disabled')) {
		var overlay = document.querySelector('body > .changelog-overlay');
		overlay.querySelector('#v').innerText = `to v${chrome.runtime.getManifest().version}`;
		overlay.classList.add('open');
		bsf.freeze();
		overlay.addEventListener('click', closeChangelog, {once: true});
		document.addEventListener('keyup', closeChangelog);
	}

	await new Promise(r => chrome.storage.local.remove(['updated'], r));
}

function closeChangelog(e) {
	if (e && ((e.keyCode && e.keyCode === 27) || (e.target && e.target.classList.contains('changelog-overlay')))) {
		var overlay = document.querySelector('body > .changelog-overlay');
		overlay.removeEventListener('click', closeChangelog);
		document.removeEventListener('keyup', closeChangelog);
		overlay.classList.remove('open');
		bsf.unfreeze()
	}
}

var debugMode = pretty => document.querySelectorAll('.tab').forEach(t => t.onclick = async _ => console.log(pretty ? await getPrettyTab(t.id) : await getSnoozedTabs([t.id])));

window.onload = init