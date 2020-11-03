# usage
# python3 build.py [safaridev]

import json
import shutil
import re
from sys import argv

F = 'build_temp'
m = json.load(open('manifest.json'))
v = m['version']

print('\n\x1b[1;31;40m' + 'Building Snoozz v' + v + '\x1b[0m\n')


#
# Remove non-essential files
#
shitfiles = shutil.ignore_patterns('.DS_Store', '.git', '.Trashes', '.Spotlight-V100', '.github')

shutil.copytree('html', F + '/html', ignore = shitfiles)
shutil.copytree('scripts', F + '/scripts', ignore = shitfiles)
shutil.copytree('styles', F + '/styles', ignore = shitfiles)
shutil.copytree('icons', F + '/icons', ignore = shitfiles)
shutil.copy('manifest.json', F)

#
# Build release for upload
#
shutil.make_archive('snoozz_upload-' + v, 'zip', F)
print('Created Upload Release: ' + '\x1b[1;32;40m' + 'snoozz_upload-' + v + '\x1b[0m')

#
# Build release for github
#
shutil.copy('LICENSE', F)
shutil.make_archive('snoozz_gh-' + v, 'zip', F)
print('Created GH Release: ' + '\x1b[1;32;40m' + 'snoozz_gh-' + v + '\x1b[0m')

#
# Modify manifest file for safari and build
#
safari_manifest = open(F + '/manifest.json', 'r')
data = json.load(safari_manifest)
safari_manifest.close()

if 'idle' in data['permissions']: data['permissions'].remove('idle')
if 'notifications' in data['permissions']: data['permissions'].remove('notifications')
data['permissions'] = [p.replace('tabs','activeTab') for p in data['permissions']]
del data['commands']

safari_manifest = open(F + '/manifest.json', 'w+')
safari_manifest.write(json.dumps(data, indent=4))
safari_manifest.close()

if len(argv) > 1 and argv[1] == 'safaridev':
	shutil.copytree(F, 'snoozz_safari')
	print('Created Safari DEV release: ' + '\x1b[1;32;40m' + 'snoozz_safari' + '\x1b[0m')
else:
	shutil.make_archive('snoozz_safari-' + v, 'zip', F)
	print('Created Safari Release: ' + '\x1b[1;32;40m' + 'snoozz_safari-' + v + '\x1b[0m')

#
# Print changelog
#
print('\nChanges in v' + v)
with open('docs/changelog.md', 'r') as file:
	latest = re.search('#### ' + v + '(.+?)####', file.read().replace('\n', '¿'))
	if latest: print(latest.group(1).replace('¿', '\n'))
#
# Cleanup
#
shutil.rmtree(F)