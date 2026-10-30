import test from 'node:test';
import assert from 'node:assert/strict';
import {companyBundleRevenue,COMPANY_BUNDLE_FEES} from '../src/companyBundleRevenue.js';
import {summarizeCompanyRevenue} from '../src/companyRevenue.js';
const sale=(extra={})=>({id:'x',source_type:'mobile',sale_date:'2026-10-10',source_meta:{ri:1,planDetail:{key:'general_115',type:'general'},specialPolicy:{policyId:'oct_s942_256_512_mnp'},...extra}});
test('existing Samsung products use VAT-inclusive company rates and selective 115 bonus',()=>{
 for(const [model,fee] of Object.entries(COMPANY_BUNDLE_FEES).filter(([k])=>!k.startsWith('Apple'))){
  const s=sale({bundle2ndKeys:[`b_${model}`,`b_${model}`]});
  const r=companyBundleRevenue(s);assert.equal(r.amount,fee+(['L335','L505','X216'].includes(model)?44000:0));assert.equal(r.pending,0);
  const low=sale({bundle2ndKeys:[`b_${model}`],planDetail:{key:'general_105',type:'general'}});assert.equal(companyBundleRevenue(low).amount,fee);
 }
});
test('unknown parent, tablet outside notice and standalone never fabricate revenue',()=>{
 assert.equal(companyBundleRevenue(sale({specialPolicy:null,bundle2ndKeys:['b_L335']})).pending,1);
 assert.equal(companyBundleRevenue(sale({bundle2ndKeys:['b_iPadUIDA16_1016']})).amount,0);
 assert.equal(companyBundleRevenue(sale({ri:7,bundle2ndKeys:[]})).pending,1);
 const used=sale({ri:6,bundle2ndKeys:['b_L335']});assert.equal(companyBundleRevenue(used).amount,0);
});
test('Apple follow-up uses actual parent plan and September pro scope only',()=>{
 const child=sale({ri:7,secondOnlyBundle:true,specialPolicy:null,bundle2ndKeys:['b_AppleWatch11_12_1016'],secondParent:{model:'iphone18_pro',date:'2026-09-20',planDetail:{key:'general_115',type:'general'}}});
 const before=structuredClone(child);assert.equal(companyBundleRevenue(child).amount,220000);assert.deepEqual(child,before);
 child.source_meta.secondParent.model='iphone_other';assert.equal(companyBundleRevenue(child).amount,0);assert.equal(companyBundleRevenue(child).pending,1);
 child.source_meta.secondParent.model='iphone18_pro';child.source_meta.secondParent.planDetail={key:'general_105',type:'general'};assert.equal(companyBundleRevenue(child).amount,0);
});
test('monthly totals include bundles once and cancel/delete/edit remove or recalculate them',()=>{
 const s=sale({bundle2ndKeys:['b_L335']});const r=summarizeCompanyRevenue([s,s],'2026-10');assert.equal(r.bundle,286000);assert.equal(r.total,484000);assert.equal(r.rows[0].total,r.total);assert.equal(r.pending,0);
 for(const state of [{status:'cancelled'},{deleted:true},{sale_date:'2026-09-30'}])assert.equal(summarizeCompanyRevenue([{...s,...state}],'2026-10').bundle,0);
 assert.equal(summarizeCompanyRevenue([sale({bundle2ndKeys:['b_X236']})],'2026-10').bundle,231000);
});
test('owner-confirmed S-series means S26 for follow-up bundles, including the 115 bonus',()=>{
 const s=sale({ri:7,secondOnlyBundle:true,specialPolicy:null,bundle2ndKeys:['b_L335_1016'],secondParent:{model:'galaxy_s',date:'2026-09-20',planDetail:{key:'general_115',type:'general'}}});
 const copy=structuredClone(s);assert.equal(companyBundleRevenue(s).amount,286000);assert.equal(companyBundleRevenue(s).pending,0);assert.deepEqual(s,copy);
 s.source_meta.secondParent.planDetail={key:'general_105',type:'general'};assert.equal(companyBundleRevenue(s).amount,242000);
 s.source_meta.secondParent.model='galaxy_foldable';assert.equal(companyBundleRevenue(s).pending,1);
});
