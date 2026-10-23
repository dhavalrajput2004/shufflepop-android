#!/usr/bin/env python3
"""Build the dependency-free Android preview with official SDK tools, without Gradle.
Requires JDK 17, Android SDK platform 36 and build-tools 36.0.0. Debug only.
Run: JAVA_HOME=/path/to/jdk ANDROID_HOME=/path/to/sdk python scripts/build-sdk-preview.py
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.parse
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--api', default='https://shufflepop-rooms-test.onrender.com')
parser.add_argument('--package-suffix',default='landscape',choices=['landscape','handfix'])
args = parser.parse_args()
uri = urllib.parse.urlsplit(args.api)
if uri.scheme != 'https' or not uri.hostname or uri.path or uri.query or uri.fragment or uri.username:
    parser.error('--api must be an HTTPS origin without a path or trailing slash')
project = Path(__file__).resolve().parent.parent
jdk_setting = os.environ.get('JAVA_HOME')
sdk_setting = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
if not jdk_setting or not sdk_setting:
    parser.error('Set JAVA_HOME to JDK 17 and ANDROID_HOME to Android SDK 36')
jdk, sdk = Path(jdk_setting), Path(sdk_setting)
tools = sdk / 'build-tools/36.0.0'
android_jar = sdk / 'platforms/android-36/android.jar'
win = os.name == 'nt'
def tool(name):
    return tools / (name + ('.bat' if name in ['d8', 'apksigner'] else '.exe') if win else name)
def java_tool(name):
    return jdk / 'bin' / (name + '.exe' if win else name)
for executable in [java_tool('javac'), java_tool('keytool'), tool('aapt2'), tool('d8'), tool('zipalign'), tool('apksigner'), android_jar]:
    if not executable.exists():
        parser.error('Missing required tool: ' + str(executable))
out = project / 'app/build/sdk-preview'
out.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, JAVA_HOME=str(jdk))
env['PATH'] = str(jdk / 'bin') + os.pathsep + env.get('PATH', '')
def run(command):
    subprocess.run([str(part) for part in command], check=True, env=env)
res = out / 'res'
shutil.copytree(project / 'app/src/main/res', res, dirs_exist_ok=True)
styles = res / 'values/styles.xml'
styles.write_text(styles.read_text().replace('<string name="app_name">ShufflePop</string>', '<string name="app_name">ShufflePop Preview</string>'))
manifest = out / 'AndroidManifest.xml'
xml = (project / 'app/src/main/AndroidManifest.xml').read_text()
xml = xml.replace('<manifest xmlns:android=', '<manifest package="com.dhavalrajput.shufflepop.' + args.package_suffix + '" xmlns:android=')
xml = xml.replace('android:name=".MainActivity"', 'android:name="com.dhavalrajput.shufflepop.MainActivity"')
xml = xml.replace('android:allowBackup="false"', 'android:allowBackup="false" android:debuggable="true"')
manifest.write_text(xml)
run([tool('aapt2'), 'compile', '--dir', res, '-o', out / 'resources.zip'])
unsigned = out / 'unsigned.apk'
run([tool('aapt2'), 'link', '-o', unsigned, '-I', android_jar, '--manifest', manifest,
     '--min-sdk-version', '26', '--target-sdk-version', '36', '--version-code', '29',
     '--version-name', '1.7.10-test', '-A', project / 'app/src/main/assets', out / 'resources.zip'])
config = out / 'BuildConfig.java'
config.write_text('package com.dhavalrajput.shufflepop; public final class BuildConfig { public static final String MULTIPLAYER_API_BASE = ' + json.dumps(args.api) + '; public static final boolean DEBUG = true; }')
classes, dex = out / 'classes', out / 'dex'
for folder in [classes, dex]:
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir()
run([java_tool('javac'), '--release', '17', '-classpath', android_jar, '-d', classes,
     config, *sorted((project / 'app/src/main/java').rglob('*.java'))])
run([tool('d8'), '--min-api', '26', '--lib', android_jar, '--output', dex, *sorted(classes.rglob('*.class'))])
with zipfile.ZipFile(unsigned, 'a', compression=zipfile.ZIP_DEFLATED) as bundle:
    for item in dex.glob('*.dex'):
        bundle.write(item, item.name)
run([tool('zipalign'), '-f', '4', unsigned, out / 'aligned.apk'])
key = out / 'debug.keystore'
if not key.exists():
    run([java_tool('keytool'), '-genkeypair', '-noprompt', '-keystore', key,
         '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey',
         '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
         '-dname', 'CN=Android Debug,O=Android,C=US'])
apk = out / 'ShufflePop_1.7.10_Landscape.apk'
run([tool('apksigner'), 'sign', '--ks', key, '--ks-pass', 'pass:android',
     '--key-pass', 'pass:android', '--out', apk, out / 'aligned.apk'])
run([tool('apksigner'), 'verify', '--verbose', apk])
run([tool('aapt2'), 'dump', 'badging', apk])
print('Built debug preview:', apk)
