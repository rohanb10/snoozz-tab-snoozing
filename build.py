# usage
# python3 build.py
# local dependencies (npm) - uglifyjs, csso

import json
import shutil
from re import search
import os
from shell import ex

FOLDER = 'build_temp'
with open('manifest.json') as m: 
	data = json.load(m)
VERSION = data['version']

print('\n\nBuilding Snoozz \x1b[1;31;34mv' + VERSION + '\x1b[0m\n');

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
# shutil.copytree('scripts', FOLDER + '/scripts', ignore = shitfiles)
shutil.copytree('icons', FOLDER + '/icons', dirs_exist_ok=True, ignore = shitfiles)
shutil.copytree('sounds', FOLDER + '/sounds', dirs_exist_ok=True, ignore = shitfiles)

#
# Minify Files (JS + CSS)
#
def minifyFilesInDirectory(directory, ext, url):
	sameSize = '{:<16}'
	os.mkdir(FOLDER + '/' + directory)
	for root, dirs, files in os.walk(directory):
		for name in files:
			print('\n⧖ Minifying  ' + '\x1b[1;32;33m' + sameSize.format(name) + '\x1b[0m ...', end='')
			chars = len(ext)
			if name.endswith('.min' + ext):
				shutil.copyfile(os.path.join(root, name), FOLDER + '/' + directory + '/' + name)
				print('\r✓ Copied    ' + '\x1b[1;32;33m' + sameSize.format(name) + '\x1b[0m -> \x1b[1;32;32m' + name[:-chars] + '.min' + ext + '\x1b[0m', end='', flush=True)
			elif ext == '.js' and not name.endswith('.min' + ext):
				ex('uglifyjs ' + directory + '/' + name + ' -c -m -o ' + FOLDER + '/' + directory + '/' + name[:-chars] + '.min' + ext).stdout()
				replaceInHTMLFiles(name, name[:-chars] + '.min' + ext)
				replaceInManfest(name, name[:-chars] + '.min' + ext)
				print('\r✓ Minified  ' + '\x1b[1;32;33m' + sameSize.format(name) + '\x1b[0m -> \x1b[1;32;32m' + name[:-chars] + '.min' + ext + '\x1b[0m', end='', flush=True)
			elif ext == '.css' and not name.endswith('.min' + ext):
				ex('csso ' + directory + '/' + name + ' -o ' + FOLDER + '/' + directory + '/' + name[:-chars] + '.min' + ext).stdout()
				replaceInHTMLFiles(name, name[:-chars] + '.min' + ext)
				print('\r✓ Minified  ' + '\x1b[1;32;33m' + sameSize.format(name) + '\x1b[0m -> \x1b[1;32;32m' + name[:-chars] + '.min' + ext + '\x1b[0m', end='', flush=True)

def replaceInHTMLFiles(original, replacement):
	for root, dirs, files in os.walk(FOLDER + '/html'):
		for name in files:
			file = open(os.path.join(root, name), 'rt')
			h_data = file.read()
			h_data = h_data.replace(original, replacement)
			file.close()
			file = open(os.path.join(root, name), 'wt')
			file.write(h_data)
			file.close()

def replaceInManfest(original, replacement):
	global data
	data = json.loads(json.dumps(data).replace(original, replacement))

minifyFilesInDirectory('scripts', '.js', 'https://www.toptal.com/developers/javascript-minifier/raw')
minifyFilesInDirectory('styles', '.css', 'https://cssminifier.com/raw')

#
# Update manifest file
#
with open(FOLDER + '/manifest.json', 'w+') as m:
	m.write(json.dumps(data, indent=4))

#
# Build release for chrome
#
name = 'snoozz-chrome-' + VERSION
shutil.make_archive(name, 'zip', FOLDER)
print('\n\nCreated Chrome Release: ' + '\x1b[35m ' + name + '.zip' + '\x1b[0m')

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
print('Created Firefox Release: ' + '\x1b[35m ' + name + '.zip' + '\x1b[0m')

#
# Build release for github
#
shutil.copy('LICENSE', FOLDER)

name = 'snoozz-' + VERSION
shutil.make_archive(name, 'zip', FOLDER)
print('Created GH Release: ' + '\x1b[35m ' + name + '.zip' + '\x1b[0m')

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
print('Created Safari Release: ' + '\x1b[35m ' + name + '.zip' + '\x1b[0m')

#
# Cleanup
#
shutil.rmtree(FOLDER)