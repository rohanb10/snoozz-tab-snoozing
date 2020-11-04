# usage
# python3 build.py [safaridev]

import json
import shutil
import re
from sys import argv

FOLDER = 'build_temp'
with open('manifest.json') as m: 
	data = json.load(m)
VERSION = data['version']

print('\n\x1b[1;31;40m' + 'Building Snoozz v' + VERSION + '\x1b[0m\n')


#
# Remove non-essential files
#
shitfiles = shutil.ignore_patterns('.DS_Store', '.git', '.Trashes', '.Spotlight-V100', '.github')

shutil.copytree('html', FOLDER + '/html', ignore = shitfiles)
shutil.copytree('scripts', FOLDER + '/scripts', ignore = shitfiles)
shutil.copytree('styles', FOLDER + '/styles', ignore = shitfiles)
shutil.copytree('icons', FOLDER + '/icons', ignore = shitfiles)
shutil.copy('manifest.json', FOLDER)
modified_manifest = open(FOLDER + '/manifest.json', 'w+')

#
# Build release for chrome
#
name = 'snoozz-chrome-' + VERSION
shutil.make_archive(name, 'zip', FOLDER)
print('Created Chrome Release: ' + '\x1b[1;32;40m' + name + '.zip' + '\x1b[0m')


#
# Add Open popup shortcut to start of manifest.commands
#
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
print('Created Firefox Release: ' + '\x1b[1;32;40m' + name + '.zip' + '\x1b[0m')

#
# Build release for github
#
shutil.copy('LICENSE', FOLDER)

name = 'snoozz-' + VERSION
shutil.make_archive(name, 'zip', FOLDER)
print('Created GH Release: ' + '\x1b[1;32;40m' + name + '.zip' + '\x1b[0m')

#
# Modify manifest file for safari and build
#

if 'idle' in data['permissions']: data['permissions'].remove('idle')
if 'notifications' in data['permissions']: data['permissions'].remove('notifications')
data['permissions'] = [p.replace('tabs','activeTab') for p in data['permissions']]
del data['commands']

with open(FOLDER + '/manifest.json', 'w+') as m:
	m.write(json.dumps(data, indent=4))

name = 'snoozz-safari-' + VERSION
if len(argv) > 1 and argv[1] == 'safaridev':
	shutil.copytree(FOLDER, name)
	print('Created Safari DEV release: ' + '\x1b[1;32;40m' + name + '\x1b[0m')
else:
	shutil.make_archive(name, 'zip', FOLDER)
	print('Created Safari Release: ' + '\x1b[1;32;40m' + name + '.zip' + '\x1b[0m')

modified_manifest.close()

#
# Print changelog
#
print('\nChanges in v' + VERSION)
with open('docs/changelog.md', 'r') as c:
	latest = re.search('#### ' + VERSION + '(.+?)####', c.read().replace('\n', '¿'))
	if latest: print(latest.group(1).replace('¿', '\n'))
#
# Cleanup
#
shutil.rmtree(FOLDER)