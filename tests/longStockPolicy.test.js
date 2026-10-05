import test from 'node:test';
import assert from 'node:assert/strict';
import {LONG_STOCK_SPECIAL_SALES,calculateLongStockSale} from '../src/longStockPolicy.js';
import {specialSalesForDate,octoberConfig} from '../src/octoberPolicy.js';
import {septemberConfig,calculateSeptemberBundleSale} from '../src/septemberPolicy.js';
import {mobileSaleOffsets} from '../src/mobileSaleEstimate.js';
const plan=(key)=>({key,type:key.split('_')[0]});
const args={saleDate:'2026-10-01',saleType:'MNP',planDetail:plan('general_85'),vasKeys:['vasSafePass','vasKyobo']};
test('stock notice amounts, date, deduplication and registration conditions',()=>{
 const amounts=[700000,700000,1300000,1300000,150000,250000,250000,250000,900000,600000,700000,250000,500000,300000,500000,300000,100000,350000];
 assert.deepEqual(LONG_STOCK_SPECIAL_SALES.map(p=>p.additionalAmount),amounts);
 assert.equal(specialSalesForDate('2026-09-30').some(p=>p.stock),false);
 assert.equal(specialSalesForDate('2026-10-01').filter(p=>p.stock).length,18);
 assert.equal(new Set(LONG_STOCK_SPECIAL_SALES.map(p=>p.key)).size,18);
 const p=LONG_STOCK_SPECIAL_SALES[0];
 assert.equal(calculateLongStockSale(args,p).additionalAmount,700000);
 for(const changed of [{saleDate:'2026-09-30'},{planDetail:plan('general_75')},{vasKeys:['vasSafePass']},{vasKeys:['vasKyobo']},{saleType:'010 신규'}])assert.equal(calculateLongStockSale({...args,...changed},p).eligible,false);
 assert.equal(calculateLongStockSale({...args,saleType:'기기변경'},LONG_STOCK_SPECIAL_SALES[1]).eligible,false);
 assert.equal(calculateLongStockSale({...args,saleType:'기기변경',planDetail:plan('general_95')},LONG_STOCK_SPECIAL_SALES[1]).additionalAmount,700000);
 const kids=LONG_STOCK_SPECIAL_SALES.find(p=>p.stockRule==='kids');
 assert.equal(calculateLongStockSale({...args,saleType:'010 신규',planDetail:plan('junior_28')},kids).eligible,true);
 assert.equal(calculateLongStockSale({...args,saleType:'010 신규',planDetail:plan('general_28')},kids).eligible,false);
});
test('R825 replaces second rate; insurance never adds another commission',()=>{
 const config=octoberConfig(septemberConfig({}));
 assert.equal(config.bundle2nd.find(p=>p.key==='b_R825FA').rate,350000);
 for(const vas of ['vasPhonePass','vasSafePass'])for(const [type,paid] of [['normal',350000],['discount',100000],['free',100000]]){
 const meta={ri:7,ci:0,bundle2ndKeys:['b_R825FA'],bundleVasMap:{b_R825FA:[vas]},bundleSaleTypeMap:{b_R825FA:type},bundleVasCommissionExcluded:true};
 assert.equal(mobileSaleOffsets(meta,config,true).bundleOffset,350000-paid);
 assert.equal(mobileSaleOffsets(meta,config,true).vasOffset,0);
 }
 const noInsurance={bundle2ndKeys:['b_R825FA'],bundleVasMap:{b_R825FA:[]}};
 assert.equal(mobileSaleOffsets(noInsurance,config,true).bundleOffset,350000);
 assert.equal(calculateSeptemberBundleSale({rate:150000,saleType:'discount',insuranceJoined:true}).paid,20000);
});
