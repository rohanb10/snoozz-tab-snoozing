/*
	Analytics code for self hosted Snoozz Choice Data

	I process this data on a self hosted server using Umami [https://umami.is/] [https://github.com/mikecao/umami]
	No geographic, language, diagnostic data is collected in any way, simply the choice that you have selected in the popup

	All data collected using this code is fully public https://stats.snoozz.me/share/zUOLA2QP/Choice%20Count?view=event

	The code you see below is the bare minimum needed to send data to my server.
*/
function poll(selected_choice) {
	var r = new XMLHttpRequest();
	r.open('POST', 'https://stats.snoozz.me/api/collect');
	r.setRequestHeader('Content-Type', 'application/json');
	r.send(JSON.stringify({
		type: 'event', 
		payload: {
			event_type: 'choice',
			website: '66d67a57-af92-4d42-9b66-774fdaed4072',	//unique identifier for umami
			url: '',
			event_value: selected_choice
		}
	}));
}