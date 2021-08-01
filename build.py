# usage
# python3 build.py

import json
import shutil
import re
import os
import io
import requests
from sys import argv

FOLDER = 'build_temp'
with open('manifest.json') as m: 
	data = json.load(m)
VERSION = data['version']

print('\nBuilding \x1b[1;31;34mSnoozz v' + VERSION + '\x1b[0m\n');

#
#	delete old files if they exist
#
old = [FOLDER, 'snoozz-chrome-' + VERSION, 'snoozz-ff-' + VERSION, 'snoozz-' + VERSION, 'snoozz-safari-' + VERSION]
for file in old:
	if os.path.exists(file):
		shutil.rmtree(file)
oldzip = ['snoozz-chrome-' + VERSION + '.zip', 'snoozz-ff-' + VERSION + '.zip', 'snoozz-' + VERSION + '.zip', 'snoozz-safari-' + VERSION + '.zip']
for zippy in oldzip:
	if (os.path.exists(zippy)) :
		os.remove(zippy)
#
# Copy essential files only
#
shitfiles = shutil.ignore_patterns('.DS_Store', '.git', '.Trashes', '.Spotlight-V100', '.github')
shutil.copytree('html', FOLDER + '/html', ignore = shitfiles)
shutil.copytree('icons', FOLDER + '/icons', dirs_exist_ok=True, ignore = shitfiles)
with open(FOLDER + '/manifest.json', 'w+') as m:
	m.write(json.dumps(data, indent=4))

#
# Minify Files (JS + CSS)
#
def minifyFilesInDirectory(directory, ext, url):
	os.mkdir(FOLDER + '/' + directory)
	for root, dirs, files in os.walk(directory):
		for name in files:
			chars = len(ext)
			if name.endswith('.min' + ext):
				shutil.copyfile(os.path.join(root, name), FOLDER + '/' + directory + '/' + name)
			elif name.endswith(ext):
				print('\n⧖ Minifying ' + '\x1b[1;32;33m' + name + '\x1b[0m ...', end='')
				data = {'input': open(os.path.join(root, name), 'rb').read()}
				response = requests.post(url, data=data)
				f2 = open(FOLDER + '/' + directory + '/' + name[:-chars] + '.min' + ext, 'w')
				f2.write(response.text)
				f2.close()
				replaceInHTMLFiles(name, name[:-chars] + '.min' + ext)
				print('\r✓ Minified ' + '\x1b[1;32;33m' + name + '\x1b[0m -> \x1b[1;32;32m' + name[:-chars] + '.min' + ext + '\x1b[0m', end='', flush=True)

def replaceInHTMLFiles(original, replacement):
	for root, dirs, files in os.walk(FOLDER + '/html'):
		for name in files:
			file = open(os.path.join(root, name), 'rt')
			data = file.read()
			data = data.replace(original, replacement)
			file.close()
			file = open(os.path.join(root, name), 'wt')
			file.write(data)
			file.close()

minifyFilesInDirectory('scripts', '.js', 'https://javascript-minifier.com/raw')
minifyFilesInDirectory('styles', '.css', 'https://cssminifier.com/raw')

#
# Build release for chrome
#
name = 'snoozz-chrome-' + VERSION
shutil.make_archive(name, 'zip', FOLDER)
print('\n\nCreated Chrome Release: ' + '\x1b[1;31;40m' + name + '.zip' + '\x1b[0m')


#
# Add Open popup shortcut to start of manifest.commands
#
del data['offline_enabled']
mod_commands = {'_execute_browser_action' : {'description': 'Open the Snoozz popup'}}
for key, value in data['commands'].items(): mod_commands[key] = value

data['commands'] = mod_commands
with open(FOLDER + '/manifest.json', 'w+') as m:
	m.write(json.dumps(data, indent=4))

#
# Build release for firefox
#
name = 'snoozz-ff-' + VERSION
shutil.make_archive(name, 'zip', FOLDER)
print('Created Firefox Release: ' + '\x1b[1;31;40m' + name + '.zip' + '\x1b[0m')

#
# Build release for github
#
shutil.copy('LICENSE', FOLDER)

name = 'snoozz-' + VERSION
shutil.make_archive(name, 'zip', FOLDER)
print('Created GH Release: ' + '\x1b[1;31;40m' + name + '.zip' + '\x1b[0m')

#
# Modify manifest file for safari and build
#
shutil.copy('docs/safari.md', FOLDER)
shutil.copy('instructions_safari.txt', FOLDER)
shutil.copy('safari.sh', FOLDER)
if 'idle' in data['permissions']: data['permissions'].remove('idle')
if 'notifications' in data['permissions']: data['permissions'].remove('notifications')
data['permissions'] = [p.replace('tabs','activeTab') for p in data['permissions']]
del data['commands']

with open(FOLDER + '/manifest.json', 'w+') as m:
	m.write(json.dumps(data, indent=4))

name = 'snoozz-safari-' + VERSION
shutil.make_archive(name, 'zip', FOLDER)
print('Created Safari Release: ' + '\x1b[1;31;40m' + name + '.zip' + '\x1b[0m')

#
# Print changelog
#
print('\nChanges in v' + VERSION)
with open('docs/changelog.md', 'r') as c:
	latest = re.search('#### ' + VERSION + '(.+?)(####|\*\*)', c.read().replace('\n', '¿'))
	if latest: print(latest.group(1).replace('¿', '\n'))
#
# Cleanup
#
shutil.rmtree(FOLDER)