import json
import os
import shutil
import zipfile
#pip install pyfiglet
# import pyfiglet

manifest = json.load(open('manifest.json'))
version =  manifest['version']

print('\n\n\x1b[1;31;40m' + 'Building Snoozz v' + version + '\x1b[0m\n\n')

folder = 'build-temp'
shitfiles = shutil.ignore_patterns('.DS_Store', '.git', '.Trashes', '.Spotlight-V100', '.github')


shutil.copytree('html', folder + '/html', ignore = shitfiles)
shutil.copytree('scripts', folder + '/scripts', ignore = shitfiles)
shutil.copytree('styles', folder + '/styles', ignore = shitfiles)
shutil.copytree('icons', folder + '/icons', ignore = shitfiles)
shutil.copy('manifest.json', folder)

shutil.make_archive('snoozz_upload_v' + version, 'zip', folder)
print('Created Upload Package: ' + '\x1b[1;32;40m' + 'snoozz_upload_v' + version + '\x1b[0m')

shutil.copy('LICENSE', folder)
shutil.make_archive('Snoozz - ' + version, 'zip', folder)
print('\n\nCreated GH Release: ' + '\x1b[1;32;40m' + 'Snoozz - ' + version + '\x1b[0m')

safari_manifest = open(folder + '/manifest.json', 'r')
data = json.load(safari_manifest)
safari_manifest.close()

data['permissions'] = [p.replace('tabs','activeTab') for p in data['permissions']]
del data['commands']

safari_manifest = open(folder + '/manifest.json', 'w+')
safari_manifest.write(json.dumps(data, indent=4))
safari_manifest.close()

shutil.make_archive('Snoozz for Safari - ' + version, 'zip', folder)
print('\n\nCreated Safari Release -' + '\x1b[1;32;40m' + 'Snoozz for Safari - ' + version + '\x1b[0m')

#print('\n\nChangelog')
#changelog.close()

shutil.rmtree(folder)
print('Done.')