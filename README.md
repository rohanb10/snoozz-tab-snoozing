# snoozz

<p align="center">
  <img src="https://i.imgur.com/h6piEH8.png" alt="Snoozz logo"/>
</p>

<div align="center">
	<a target="_blank" href="https://addons.mozilla.org/en-US/firefox/addon/snoozz/">
		<img src="https://img.shields.io/amo/v/snoozz?color=orange&logo=firefox-browser&label=firefox%20add-on" alt="Mozilla Add-on">
		</a>
	<a target="_blank" href="https://chrome.google.com/webstore/detail/snoozz-snooze-tabs-window/lklendgldejcnkkaldoggoapclkepgfb">
		<img src="https://img.shields.io/chrome-web-store/v/lklendgldejcnkkaldoggoapclkepgfb?logo=google-chrome&color=yellow&logoColor=white" alt="Chrome Web Store">
	</a>
	<a href="https://github.com/rohanb10/snoozz-tab-snoozing/releases/latest/">
		<img alt="GitHub Latest Release" src="https://img.shields.io/github/v/release/rohanb10/snoozz-tab-snoozing?label=latest%20release">
	</a>
</div>
<div align="center">
	<img alt="GitHub Release Date" src="https://img.shields.io/github/release-date/rohanb10/snoozz-tab-snoozing?color=red">
	<img alt="GitHub commits since latest release" src="https://img.shields.io/github/commits-since/rohanb10/snoozz-tab-snoozing/latest?color=9cf">
	<a href="https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/LICENSE">
		<img src="https://img.shields.io/github/license/rohanb10/snoozz-tab-snoozing?color=lightgrey" alt="License">
	</a>
	<a href="https://paypal.me/rohanrohanrohanrohan/2USD">
		<img alt="Paypal Donate Link" src="https://img.shields.io/badge/Donate-PayPal-success">
	</a>
</div>


-------------


A Web Extension to *snoozz* tabs and windows now and have them reopen automatically later.

Check out the [Snoozz.me](https://snoozz.me) website for more features, screenshots, demo gifs, and the privacy policy (spoiler: nothing is tracked)

Features:
- Snooze individual tabs, selected tabs, or full windows in just two clicks
- Configure keyboard shortcuts and context menu options to snooze tabs even quicker
- View your currently sleeping and already awoken tabs in the nap room
- Edit Sleeping Tabs to wake up at a different time, Snooze woken up tabs again
- Works completely offline - None of your data is transmitted anywhere, and the extension is entirely self contained

I initially built this for myself. Had too many tabs open at the end of the day, and didnt want to look at them until work started the next day.

Available on [Chrome](https://chrome.google.com/webstore/detail/snoozz-snooze-tabs-window/lklendgldejcnkkaldoggoapclkepgfb), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/snoozz/), [Edge](https://microsoftedge.microsoft.com/addons/detail/ifofnjpbldmdcbkaalbdgaopphhlopok) and as a custom build for [Safari](https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/docs/safari.md).

[Latest Release](https://github.com/rohanb10/snoozz-tab-snoozing/releases/latest/) | [Changelog](https://snoozz.me/changelog) | [Browser Compatibility](https://snoozz.me/compatibility) | [Privacy](https://snoozz.me/privacy)

Related repos: [Snoozz Website](https://github.com/rohanb10/snoozz-web) | [Snoozz Stats](https://github.com/rohanb10/snoozz-stats)

## How to generate extension package

1. `npm install` dependencies.
1. Requires direnv or `npm bin` (most likely `./node_modules/.bin`) to be in the path.
1. Install python dependencies `shell` and `re` (`python3 -m pip install ...`).
1. Run `python3 build.py`.

Tested on macos 13.0, Python 3.9.6, pip 22.3.1, node v16.13.0, npm 8.1.0.

Source code is packed for review with `zip -r -FS ../source-code.zip * --exclude '*.git*' --exclude '*node_modules*'`.

## Colours

Orange: `#F3B845` | Pink: `#DF4E76`

## License

Snoozz is licensed under the [GNU GPLv3](https://github.com/rohanb10/snoozz-tab-snoozing/blob/master/LICENSE) license.

Built by [rohan](https://rohan.xyz) in 2020/21

[🍺 Buy me a beer](https://www.buymeacoffee.com/rohanb10)