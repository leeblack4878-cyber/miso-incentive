import test from 'node:test';
import assert from 'node:assert/strict';
import {ADDITIONAL_STRATEGIC_SERVICES as services,toggleStrategicService} from '../src/additionalStrategicServices.js';
import {calculateSaleStrategicPoints,summarizeStrategicProducts} from '../src/strategicPoints.js';
import {octoberConfig} from '../src/octoberPolicy.js';
import {septemberConfig} from '../src/septemberPolicy.js';
test('six missing source-listed services have exact codes and points with no direct fees',()=>{
 assert.deepEqual(services.map(s=>[s.code,s.point,s.rate]),[['LRZ1003226',0.3,0],['LRZ1003228',0.5,0],['LRZ0002150',0.3,0],['LRZ1005368',0.3,0],['LRZ1007515',0.6,0],['LRZ0002941',0.1,0]]);
 for(const service of services){
  assert.equal(calculateSaleStrategicPoints({vasKeys:[service.key]}),service.point);
  assert.equal(summarizeStrategicProducts([{source_meta:{vasKeys:[service.key]}}]).strategicPoints,service.point);
 }
 const september=septemberConfig(),october=octoberConfig();
 for(const old of september.vas)assert.equal(october.vas.find(v=>v.key===old.key).rate,old.rate);
 assert.equal(october.vas.filter(v=>services.some(s=>s.key===v.key)).reduce((sum,v)=>sum+v.rate,0),0);
 assert.ok(september.vas.every(v=>!services.some(s=>s.key===v.key)));
});
test('ringing variants replace each other while independent services and legacy records remain intact',()=>{
 const old=['vasKyobo','vasBellMoya','vasCallConvenience'];
 assert.deepEqual(toggleStrategicService(old,'vasBellAiCharacter'),['vasKyobo','vasCallConvenience','vasBellAiCharacter']);
 assert.deepEqual(old,['vasKyobo','vasBellMoya','vasCallConvenience']);
 assert.deepEqual(toggleStrategicService(['vasVcolorBundle'],'vasVprofile'),['vasVprofile']);
 assert.deepEqual(toggleStrategicService(['vasNone'],'vasCallFeatureGuide'),['vasCallFeatureGuide']);
 assert.deepEqual(toggleStrategicService(['vasCallFeatureGuide'],'vasNone'),['vasNone']);
});
