import test from 'node:test';
import assert from 'node:assert/strict';
import {companyPlanFee,summarizeCompanyRevenue,canViewCompanyRevenue} from '../src/companyRevenue.js';
const sale=(id,tier,ri=1,type='general',extra={})=>({id,source_type:'mobile',sale_date:'2026-10-03',source_meta:{ri,planDetail:{key:`${type}_${tier}`,type},...extra}});
test('company plan rates independently match owner amounts across all subscription rows',()=>{
 for(const [tier,fee] of [[130,154000],[115,154000],[105,143000],[95,132000],[85,121000],[75,88000],[70,44000],[61,22000]])for(const ri of [0,1,2,3,4,6])assert.equal(companyPlanFee(sale('x',tier,ri).source_meta).amount,fee);
 for(const tier of [55,47,37,33])for(const ri of [0,1,2,3,4,6])assert.equal(companyPlanFee(sale('x',tier,ri).source_meta).amount,ri===1?22000:0);
 assert.equal(companyPlanFee(sale('x',28).source_meta).amount,0);
});
test('base fee includes every mobile type, pending rules are explicit',()=>{
 for(let ri=0;ri<=7;ri++){const r=summarizeCompanyRevenue([sale('x',115,ri)],'2026-10');assert.equal(r.base,22000);}
 for(const s of [sale('x',115,5),sale('x',47,1,'senior'),sale('x',85,1,'junior'),sale('x',null)]){const r=summarizeCompanyRevenue([s],'2026-10');assert.equal(r.total,22000);assert.equal(r.pending,1);}
 assert.equal(summarizeCompanyRevenue([sale('x',115)],'2026-10').total,176000);
 assert.equal(summarizeCompanyRevenue([sale('x',61)],'2026-10').total,44000);
});
test('bundled child lines count once and prior parent is not counted again',()=>{
 const main=sale('1',115,1,'general',{bundle2ndKeys:['watch','tablet']});
 assert.equal(summarizeCompanyRevenue([main],'2026-10').total,22000*3+154000);
 const child=sale('2',null,7,'general',{secondOnlyBundle:true,bundle2ndKeys:['watch'],secondParent:{planDetail:{key:'general_115',type:'general'},saleDate:'2026-09-01'}});
 const r=summarizeCompanyRevenue([child],'2026-10');assert.equal(r.count,1);assert.equal(r.total,22000);assert.equal(r.pending,1);
});
test('source date, cancellation, deletion, dedup and editing control revenue without mutating sales',()=>{
 const good=sale('1',115),copy=structuredClone(good);
 const r=summarizeCompanyRevenue([good,good,{...sale('2',115),status:'cancelled'},{...sale('3',115),deleted:true},{...sale('4',115),sale_date:'2026-09-30'},{...sale('5',115),source_type:'home'}],'2026-10');
 assert.equal(r.total,176000);assert.deepEqual(good,copy);
 assert.equal(summarizeCompanyRevenue([sale('1',105)],'2026-10').total,165000);
 assert.equal(summarizeCompanyRevenue([],'2026-10').total,0);
});
test('only the confirmed representative account can open company revenue',()=>{
 assert.equal(canViewCompanyRevenue('a50a0979-acef-40b1-98b7-f05074f1c835'),true);
 for(const id of [null,'employee','f0329992-ced4-4407-b71d-ed58c5d74aaf'])assert.equal(canViewCompanyRevenue(id),false);
});
