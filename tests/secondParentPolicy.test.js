import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePreviousSecond,previousMonthBounds} from '../src/secondParentPolicy.js';
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
test('Only immediately preceding calendar month; no duplicate parent input in current month',()=>{
 for(const date of ['2026-08-31','2026-10-01','2026-09-31',''])assert.match(validatePreviousSecond({...base,parent:{...base.parent,date}}),/전월/);
 assert.equal(validatePreviousSecond({...base,parent:{...base.parent,date:'2026-09-01'}}),'');
 assert.match(validatePreviousSecond({...base,saleDate:'2026-09-30'}),/10월/);
 assert.deepEqual(previousMonthBounds('2027-01-03'),{start:'2026-12-01',end:'2026-12-31'});
 assert.deepEqual(previousMonthBounds('2028-03-01'),{start:'2028-02-01',end:'2028-02-29'});
 assert.match(validatePreviousSecond({...base,bundleKeys:[]}),/1~2/);
});
