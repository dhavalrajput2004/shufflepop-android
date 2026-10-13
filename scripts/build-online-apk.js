'use strict';
const {spawn}=require('node:child_process');
const {origin,verifyDeployment}=require('./verify-deployment.js');
async function main(){
  const base=origin(process.argv[2]);
  console.log('Checking the deployed room API before building…');await verifyDeployment(base);
  const windows=process.platform==='win32';
  const args=['assembleDebug','-PmultiplayerApiBase='+base];
  const child=windows?spawn('cmd.exe',['/d','/c','gradlew.bat',...args],{stdio:'inherit'}):spawn('./gradlew',args,{stdio:'inherit'});
  child.on('error',()=>{console.error('Could not launch Gradle. Install JDK 17 and Android SDK 36; on Unix make gradlew executable.');process.exitCode=1;});
  child.on('exit',code=>{if(code===0)console.log('Test APK: app/build/outputs/apk/debug/app-debug.apk');else process.exitCode=code||1;});
}
if(require.main===module)main().catch(()=>{console.error('Pre-build check failed. Supply the real HTTPS API origin and ensure it is reachable.');process.exitCode=1;});
