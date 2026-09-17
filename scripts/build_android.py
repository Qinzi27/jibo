#!/usr/bin/env python3
"""Build a signed local Android prototype with the official SDK; no Gradle/npm dependencies.
Requires a JDK (17+), Android SDK Platform 35 and Build Tools 35.0.0.
SDK licenses are accepted by the user in Android Studio / sdkmanager, not silently here.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile
import re
import xml.etree.ElementTree as ET
from runtime_assets import runtime_files

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sdk', type=Path, help='Android SDK folder; otherwise ANDROID_HOME or usual local locations')
parser.add_argument('--build-tools', default='35.0.0')
parser.add_argument('--platform', default='35')
parser.add_argument('--check-only', action='store_true', help='Check prerequisites without building')
parser.add_argument('--output', type=Path, help='APK path (default: dist/jibo-v<version>.apk)')
parser.add_argument('--notes-file', type=Path, help='UTF-8 update notes (at most 4000 characters) for jibo-update.json')
args = parser.parse_args()

main=ROOT/'android/app/src/main'
manifest=ET.parse(main/'AndroidManifest.xml').getroot()
android_ns='{http://schemas.android.com/apk/res/android}'
app_id=manifest.attrib['package']
version=manifest.attrib[android_ns+'versionName']
version_code=manifest.attrib[android_ns+'versionCode']
min_sdk=manifest.find('uses-sdk').attrib[android_ns+'minSdkVersion']
target_sdk=manifest.find('uses-sdk').attrib[android_ns+'targetSdkVersion']

def run(command, env=None, capture=False):
    print('+', ' '.join(map(str, command)), flush=True)
    result=subprocess.run(list(map(str, command)), check=True, cwd=ROOT, env=env,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.STDOUT if capture else None, text=True)
    if capture:
        print(result.stdout, end='', flush=True)
        return result.stdout

def resolve_sdk():
    candidates = [args.sdk]
    candidates += [Path(os.environ[k]) for k in ('ANDROID_HOME','ANDROID_SDK_ROOT') if os.environ.get(k)]
    candidates += [Path.home()/'Android/Sdk',Path.home()/'Library/Android/sdk']
    if os.environ.get('LOCALAPPDATA'): candidates.append(Path(os.environ['LOCALAPPDATA'])/'Android/Sdk')
    return next((p.resolve() for p in candidates if p and (p/'platforms').is_dir()), None)

def java_tool(name):
    suffix='.exe' if os.name=='nt' else ''
    homes=[Path(os.environ['JAVA_HOME'])] if os.environ.get('JAVA_HOME') else []
    if os.name=='nt':
        homes += [Path(os.environ.get('ProgramFiles','C:/Program Files'))/'Android/Android Studio/jbr']
    else:
        homes += [Path('/Applications/Android Studio.app/Contents/jbr/Contents/Home'),Path('/opt/android-studio/jbr')]
    found=next((h/'bin'/(name+suffix) for h in homes if (h/'bin'/(name+suffix)).is_file()),None)
    return str(found) if found else shutil.which(name)

sdk=resolve_sdk()
if not sdk:
    raise SystemExit('Android SDK not found. Install SDK Platform 35 and Build Tools 35.0.0 (Android Studio is optional).\nSet ANDROID_HOME or pass --sdk PATH. No APK was produced.')
bt=sdk/'build-tools'/args.build_tools
platform=sdk/'platforms'/('android-'+args.platform)/'android.jar'
suffix='.exe' if os.name=='nt' else ''
aapt2=bt/('aapt2'+suffix)
zipalign=bt/('zipalign'+suffix)
d8=bt/'lib/d8.jar'
apksigner=bt/'lib/apksigner.jar'
java,javac,keytool=[java_tool(t) for t in ('java','javac','keytool')]
missing=[str(p) for p in [platform,aapt2,zipalign,d8,apksigner] if not p.is_file()]
missing += [n for n,v in [('java',java),('javac',javac),('keytool',keytool)] if not v]
if missing:
    raise SystemExit('Missing build prerequisites:\n'+'\n'.join(missing)+'\nInstall them in SDK Manager / configure JAVA_HOME. No APK was produced.')
print('SDK:',sdk,'\nBuild Tools:',bt,'\nJava:',java)
try:
    java_check=subprocess.run([java,'-version'],capture_output=True,text=True,check=True)
    javac_check=subprocess.run([javac,'-version'],capture_output=True,text=True,check=True)
    java_version=re.search(r'version "(\d+)',java_check.stderr + java_check.stdout)
    if not java_version or int(java_version.group(1)) < 17:
        raise SystemExit('A working JDK 17+ is required. Configure JAVA_HOME. No APK was produced.')
except (OSError,subprocess.CalledProcessError) as error:
    raise SystemExit('JDK could not run: '+str(error)+'\nConfigure JAVA_HOME. No APK was produced.')
print('Java version:',(java_check.stderr + java_check.stdout).splitlines()[0])
print('App:',app_id,'Version:',version,'/',version_code)
if args.check_only: raise SystemExit(0)
notes = args.notes_file.read_text(encoding='utf-8').strip() if args.notes_file else '新增应用内检查更新、下载校验和系统确认安装；训练记录与照片仍保存在本机。'
if len(notes) > 4000: raise SystemExit('Update notes exceed the 4000-character limit.')
if args.output and args.output.name != f'jibo-v{version}.apk':
    raise SystemExit(f'Update releases require the APK filename jibo-v{version}.apk; --output may choose its directory.')

out=ROOT/'build/android-direct'
if out.exists():shutil.rmtree(out)
for directory in ('classes','generated','dex','assets/www'):(out/directory).mkdir(parents=True,exist_ok=True)
for item in runtime_files(ROOT/'web'):
    destination=out/'assets/www'/item.relative_to(ROOT/'web')
    destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(item,destination)
compiled=out/'resources.zip'
run([aapt2,'compile','--dir',main/'res','-o',compiled])
run([aapt2,'link','-o',out/'resources.apk','-I',platform,'--manifest',main/'AndroidManifest.xml',
     '--java',out/'generated','-A',out/'assets','--min-sdk-version',min_sdk,'--target-sdk-version',target_sdk,compiled])
sources=list((main/'java').rglob('*.java'))+list((out/'generated').rglob('*.java'))
run([javac,'-encoding','UTF-8','-source','8','-target','8','-classpath',platform,'-d',out/'classes',*sources])
classes=out/'classes.jar'
with zipfile.ZipFile(classes,'w',zipfile.ZIP_DEFLATED) as z:
    for f in (out/'classes').rglob('*.class'):z.write(f,f.relative_to(out/'classes').as_posix())
run([java,'-cp',d8,'com.android.tools.r8.D8','--release','--min-api',min_sdk,'--lib',platform,'--output',out/'dex',classes])
unsigned=out/'unsigned.apk'
shutil.copy2(out/'resources.apk',unsigned)
with zipfile.ZipFile(unsigned,'a',zipfile.ZIP_DEFLATED) as z:
    for f in sorted((out/'dex').glob('*.dex')):z.write(f,f.name)
aligned=out/'aligned.apk'
run([zipalign,'-f','4',unsigned,aligned])

env=dict(os.environ)
custom=bool(env.get('LEAN_KEYSTORE_PATH'))
if custom:
    key=Path(env['LEAN_KEYSTORE_PATH']).expanduser().resolve()
    alias=env.get('LEAN_KEY_ALIAS','leancrew')
    if not key.is_file() or not env.get('LEAN_STORE_PASS') or not env.get('LEAN_KEY_PASS'):
        raise SystemExit('Custom signing requires a valid LEAN_KEYSTORE_PATH, LEAN_STORE_PASS, LEAN_KEY_PASS, and optional LEAN_KEY_ALIAS.')
else:
    # Keystore remains local and is excluded from the distributed project and Git.
    key=ROOT/'.local-signing/debug.keystore'
    key.parent.mkdir(exist_ok=True)
    if os.name != 'nt': key.parent.chmod(0o700)
    alias='androiddebugkey'
    env['LEAN_STORE_PASS']='android';env['LEAN_KEY_PASS']='android'
    if not key.exists():
        run([keytool,'-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias',alias,
             '-dname','CN=Jibo Local Prototype,O=Local Development,C=AU','-keyalg','RSA','-keysize','2048',
             '-validity','10000','-noprompt'])
    if os.name != 'nt':
        key.parent.chmod(0o700)
        key.chmod(0o600)
output=args.output or ROOT/('dist/jibo-v'+version+'.apk')
output=output.expanduser().resolve()
output.parent.mkdir(parents=True,exist_ok=True)
run([java,'-jar',apksigner,'sign','--ks',key,'--ks-key-alias',alias,'--ks-pass','env:LEAN_STORE_PASS',
     '--key-pass','env:LEAN_KEY_PASS','--out',output,aligned],env=env)
signature=run([java,'-jar',apksigner,'verify','--verbose','--print-certs',output],capture=True)
certificate=re.search(r'Signer #1 certificate SHA-256 digest: ([0-9a-fA-F]{64})',signature)
if not certificate: raise SystemExit('APK signature verified but signer fingerprint could not be recorded.')
run([zipalign,'-c','-v','4',output])
with zipfile.ZipFile(output) as z:
    entries=set(z.namelist())
    if not {'classes.dex','AndroidManifest.xml','assets/www/index.html'} <= entries:
        raise SystemExit('APK missing expected runtime assets.')
    if any(n.lower().endswith(('.keystore','.jks')) for n in entries):
        raise SystemExit('Signing file found inside APK; refusing delivery.')
sha=hashlib.sha256(output.read_bytes()).hexdigest()
update={
    'schemaVersion': 1, 'packageName': app_id, 'versionName': version,
    'versionCode': int(version_code), 'minSdk': int(min_sdk),
    'apkUrl': f'https://github.com/Qinzi27/jibo/releases/download/v{version}/{output.name}',
    'sha256': sha, 'size': output.stat().st_size, 'notes': notes,
}
(ROOT/'dist').mkdir(parents=True, exist_ok=True)
(ROOT/'dist/jibo-update.json').write_text(json.dumps(update, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
info=f'''Build produced: {output.name}
SHA256: {sha}
App ID: {app_id}
Version: {version} / versionCode {version_code}
Minimum Android API: {min_sdk}; target: {target_sdk}
Signing: {'custom' if custom else 'local prototype/debug key'}
Signing certificate SHA256: {certificate.group(1).lower()}
No third-party Android runtime libraries. INTERNET is used only for the fixed GitHub release updater.
REQUEST_INSTALL_PACKAGES opens Android's user-confirmed installer; no silent installation.
WebView network loads remain blocked. Training records and photos are never sent by the updater.
Update metadata: jibo-update.json (actual signed APK byte size and SHA256).
Build + signature verification are NOT device installation/functional testing.
Keep the same signing key for updates. Back up app data before uninstalling.
'''
(ROOT/'dist/ANDROID_BUILD_INFO.txt').write_text(info,encoding='utf-8')
(output.with_suffix(output.suffix+'.sha256')).write_text(sha+'  '+output.name+'\n',encoding='utf-8')
print(info)
