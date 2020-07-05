var btn = document.getElementById('btn');
var currentTabTitle = document.getElementById('tab-title');
var currentTabIcon = document.getElementById('tab-favicon');
const currentTime = new Date();
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// chrome.browserAction.onClicked.addListener(setTabTitle);



// btn.addEventListener('click', );

function initialize() {
	getCurrentTab();
	configureSnoozeOptions();
}

function getCurrentTab() {
	chrome.tabs.query({active: true}, function(tabs) {
		var tab = tabs.length > 0 && tabs[0] ? tabs[0] : false;
		if (!tabs) return;
		currentTabTitle.innerHTML = tab.title;
		currentTabIcon.src = tab.favIconUrl.length > 0 ? tab.favIconUrl : '../unknown.svg';
	})
}

function configureSnoozeOptions() {
	var options = document.querySelectorAll('.choice');

	options.forEach(function (o) {
		if (o.dataset.option === 'today-morning' && currentTime.getHours() >= 7) {
			o.classList.add('disabled');
			return;
		}
		if (o.dataset.option === 'today-evening' && currentTime.getHours() >= 18) {
			o.classList.add('disabled');
			return;
		}
		if (o.dataset.option === 'weekend' && (currentTime.getDay() === 6 || currentTime.getDay() === 0)) {
			o.classList.add('disabled');
			return;
		}
		o.addEventListener('click', function(e){
			var option = e.target;
			console.log(e.target.dataset.option)
		});
		if (o.dataset.option === 'custom') return;
		var label = getTimeLabelForOption(o.dataset.option);
		o.querySelector('.time').innerText = label[1];
		if (label[0].length > 0) {
			o.querySelector('.date').innerText = label[0];
		} else {
			o.querySelector('.date').outerHTML = '';
		}
	})
}

function getNextMonday() {
	var d = new Date();
	return d.setDate(d.getDate() + (7 + 1 - d.getDay()) % 7);
}

function getNextSaturday() {
	var d = new Date();
	return d.setDate(d.getDate() + ((7 - d.getDay()-1)));
}

function getTimeForOption(option) {
	var defaultMorningHour = 9;
	var defaultEveningHour = 18;
	var today = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
	switch (option) {
		case 'today-morning':
			today.setHours(defaultMorningHour);
			break;
		case 'today-evening':
			today.setHours(defaultEveningHour);
			break;
		case 'tom-morning':
			today.setDate(today.getDate() + 1);
			break;
		case 'tom-evening':
			today.setDate(today.getDate() + 1);
			today.setHours(defaultEveningHour);
			break;
		case 'weekend':
			today = getNextSaturday();
			break;
		case 'monday':
			today = getNextMonday();
			break;
		case 'week':
			today.setDate(today.getDate() + 1);
			today.setHours(currentTime.getHours())
			break;
		case 'month':
			today.setMonth(today.getMonth() + 1);
			today.setHours(currentTime.getHours())
			break;
		default:
			break;
	}
	if (today.getHours() === 0) {
		today.setHours(defaultMorningHour);
	}
	return today;
}

function getTimeLabelForOption(option){
	var defaultMorningHour = 9;
	var defaultEveningHour = 18;
	var today = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
	switch (option) {
		case 'today-morning':
			return ['', `${defaultMorningHour%12}am`]
		case 'today-evening':
			return ['', `${defaultEveningHour%12}pm`]
		case 'tom-morning':
			today.setDate(today.getDate() + 1);
			return [`${DAYS[today.getDay()]}`,`${defaultMorningHour%12}am`]
		case 'tom-evening':
			today.setDate(today.getDate() + 1);
			return [`${DAYS[today.getDay()]}`,`${defaultEveningHour%12}pm`]
		case 'weekend':
			today = new Date(getNextSaturday());
			return [`${MONTHS[today.getMonth()]} ${today.getDate()}`,`${defaultMorningHour%12}am`];
		case 'monday':
			today = new Date(getNextMonday());
			return [`${MONTHS[today.getMonth()]} ${today.getDate()}`, `${defaultMorningHour%12}am`]
		case 'week':
			today.setDate(today.getDate() + 7);
			var time = currentTime.getHours();
			return [`${MONTHS[today.getMonth()]} ${today.getDate()}`, `${time%12}${time>11?'pm':'am'}`]
		case 'month':
			today.setMonth(today.getMonth() + 1);
			var time = currentTime.getHours();
			return [`${MONTHS[today.getMonth()]} ${today.getDate()}`, `${time%12}${time>11?'pm':'am'}`]
		default:
			return ['',''];
	}
}

window.onload = initialize
// window.addEventListener('unload', function() { debugger; })