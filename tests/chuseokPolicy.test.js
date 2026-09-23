import test from 'node:test';
import assert from 'node:assert/strict';
import {chuseokPolicy,chuseokMobileRate,chuseokSalePay} from '../src/chuseokPolicy.js';
test('owned and consignment exact boundaries reprice every eligible sale',()=>{
 for(const [store,mins] of [['월곶점',[3,5,7,10]],['신천동_삼미시장점',[5,8,11,14]]]){
  let previous=0; mins.forEach((min,i)=>{const rate=[10000,15000,20000,30000][i];assert.equal(chuseokMobileRate(min-1,store),previous);assert.equal(chuseokMobileRate(min,store),rate);previous=rate;});
 }
 const p=chuseokPolicy({store_name:'월곶점',store_mobile:10,mobile_count:3,store_internet:4,internet_count:2,store_tv:7,tv_count:1});
 assert.equal(p.mobilePay,90000);assert.equal(p.internetPay,300000);assert.equal(p.tvPay,40000);assert.equal(p.total,430000);
});
test('date bounds, saved sale not counted twice, new sale uses resulting store tier',()=>{
 const p=chuseokPolicy({store_name:'월곶점',store_mobile:4,mobile_count:1,store_internet:0,internet_count:0,store_tv:0,tv_count:0});
 const args={month:'2026-09',dayKey:'22',meta:{ri:1}};
 assert.equal(chuseokSalePay(p,args),15000);
 assert.equal(chuseokSalePay(p,{...args,existingSale:{source_meta:args.meta}}),10000);
 for(const dayKey of ['21','29'])assert.equal(chuseokSalePay(p,{...args,dayKey}),0);
 assert.equal(chuseokSalePay(p,{...args,dayKey:'28'}),15000);
 assert.equal(chuseokSalePay(p,{...args,meta:{ri:7}}),0);
 assert.equal(chuseokSalePay(p,{...args,meta:{ri:1,teamOnly:true}}),0);
});
