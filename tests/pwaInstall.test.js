import test from 'node:test';
import assert from 'node:assert/strict';
const events=new EventTarget();
globalThis.window={matchMedia:()=>({matches:false}),navigator:{},addEventListener:events.addEventListener.bind(events)};
const {getInstallState,subscribeInstall,requestAppInstall}=await import('../src/pwaInstall.js');
test('capture before authenticated header mounts, preserve on remount, consume once',async()=>{
 let called=0;const event=new Event('beforeinstallprompt',{cancelable:true});
 event.prompt=async()=>{called++;};event.userChoice=Promise.resolve({outcome:'accepted'});
 events.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 assert.equal(getInstallState().prompt,event);
 const stop=subscribeInstall(()=>{});stop();assert.equal(getInstallState().prompt,event);
 assert.equal(await requestAppInstall(),'accepted');assert.equal(called,1);
 assert.equal(await requestAppInstall(),'unavailable');assert.equal(called,1);
});
test('failed or dismissed native prompt is never reused; installed clears state',async()=>{
 const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{throw Error('unavailable');};events.dispatchEvent(event);
 assert.equal(await requestAppInstall(),'error');assert.equal(await requestAppInstall(),'unavailable');
 const next=new Event('beforeinstallprompt',{cancelable:true});next.prompt=async()=>{};next.userChoice=Promise.resolve({outcome:'dismissed'});events.dispatchEvent(next);
 assert.equal(await requestAppInstall(),'dismissed');assert.equal(getInstallState().prompt,null);
 events.dispatchEvent(new Event('appinstalled'));assert.equal(getInstallState().installed,true);
});
