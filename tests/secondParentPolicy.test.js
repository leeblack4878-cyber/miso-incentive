import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePreviousSecond,previousMonthBounds,validateSecondCustomer} from '../src/secondParentPolicy.js';
const base={saleDate:'2026-10-01',parent:{model:'iphone18_pro',date:'2026-09-18',ci:0},bundleKeys:['b_AppleWatch']};
test('October accepts previous-month iPhone18 Pro AND Pro Max, not other Apple models',()=>{
 for(const model of ['iphone18_pro','iphone18_pro_max'])assert.equal(validatePreviousSecond({...base,parent:{...base.parent,model}}),'');
 for(const model of ['iphone18','iphone18_air','iphone17_pro'])assert.match(validatePreviousSecond({...base,parent:{...base.parent,model}}),/모델/);
});
test('Galaxy S/foldable parents allow previous-month sales and matching children only',()=>{
 for(const model of ['galaxy_s','galaxy_foldable']){
  const parent={model,date:'2026-09-30',ci:1};
  assert.equal(validatePreviousSecond({...base,parent,bundleKeys:['b_X236','b_L345']}),'');
  assert.match(validatePreviousSecond({...base,parent}),/맞는/);
 }
 assert.match(validatePreviousSecond({...base,bundleKeys:['b_L335']}),/맞는/);
 assert.match(validatePreviousSecond({...base,parent:{...base.parent,ci:1}}),/115/);
});
test('Reject older months and future dates; accept the preceding calendar month',()=>{
 for(const date of ['2026-08-31','2026-10-02','2026-09-31',''])assert.match(validatePreviousSecond({...base,parent:{...base.parent,date}}),/전월/);
 assert.equal(validatePreviousSecond({...base,parent:{...base.parent,date:'2026-09-01'}}),'');
 assert.match(validatePreviousSecond({...base,saleDate:'2026-09-30'}),/10월/);
 assert.deepEqual(previousMonthBounds('2027-01-03'),{start:'2026-12-01',end:'2026-12-31'});
 assert.deepEqual(previousMonthBounds('2028-03-01'),{start:'2028-02-01',end:'2028-02-29'});
 assert.match(validatePreviousSecond({...base,bundleKeys:[]}),/1~2/);
});

test('current-month follow-up accepts the selling-month eligible Apple models without a second HS',()=>{
 assert.equal(validatePreviousSecond({...base,saleDate:'2026-10-15',parent:{model:'iphone_other',date:'2026-10-01',ci:0}}),'');
 assert.match(validatePreviousSecond({...base,parent:{model:'iphone_other',date:'2026-09-18',ci:0}}),/모델/);
 assert.equal(validatePreviousSecond({...base,saleDate:'2026-10-15',parent:{model:'galaxy_s',date:'2026-10-14',ci:3},bundleKeys:['b_L335']}),'');
 for(const date of ['2026-10-16','2026-08-31','2026-09-31','2026-99-01'])assert.match(validatePreviousSecond({...base,saleDate:'2026-10-15',parent:{model:'galaxy_s',date,ci:0},bundleKeys:['b_L335']}),/판매일/);
});

test('2ND same-name check allows outer whitespace and rejects different or missing parent name',()=>{
 assert.equal(validateSecondCustomer(' 김미소 ','김미소'),'');
 assert.ok(validateSecondCustomer('김미소','이미소'));
 assert.ok(validateSecondCustomer('김미소',''));
});
