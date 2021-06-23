/*
	Analytics code for anonymous click data processing to a tiny server + MongoDB I created.

	As you can see below, I am just sending the choice and time you selected. Nothing else.
	No geographic, language, diagnostic data is collected in any way, simply the choice that you have selected in the popup

	Lets say you snooze a tab to wakeup on monday morning at 9:30am, this string will be sent to the server 'monday.0930'. Thats it

	All data collected using this code is fully public and can be seen at https://snoozz.me/stats.html
	The source code for the server is also available publicly at https://github.com/rohanb10/snoozz-stats
*/

function poll(choice) {
	fetch('https://stats.snoozz.me/clicks', {
		method: 'POST',
		body: choice,
	});
}