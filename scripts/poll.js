/*
	Snoozz collects a tiny amount of anonymous click data to help improve the extension in the future. The choice and time you have selected will be sent to the Snoozz server.
	No other personal or identifiable data is transmitted or processed at all. All your tab urls, IP addresses, languages and geolocations never leave your device.

	You can read more about this here: https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/docs/PRIVACY.md

	All data collected using this code is fully public and can be seen at https://snoozz.me/stats.html
	The source code for the server is also available publicly at https://github.com/rohanb10/snoozz-stats
*/

function poll(choice) {
	fetch('https://stats.snoozz.me/clicks', {
		method: 'POST',
		body: choice,
	});
}