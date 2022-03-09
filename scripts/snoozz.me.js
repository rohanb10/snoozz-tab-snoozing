function replaceSettingsURL() {
	var found = document.getElementById('snoozz_settings_url');
	if (found) found.href = chrome.extension.getURL('html/settings.html');
}
replaceSettingsURL()