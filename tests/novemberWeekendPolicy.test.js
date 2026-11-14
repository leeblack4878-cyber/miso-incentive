import test from 'node:test';import assert from 'node:assert/strict';
import {novemberWeekendMobile as mobile,novemberWeekendHome as home,calculateNovemberWeekendGrade as grade,novemberWeekendModel,novemberA176Review} from '../src/novemberWeekendPolicy.js';
import {NOVEMBER_SPECIAL_SALES} from '../src/novemberPolicy.js';
import {specialSalesForDate,calculateMonthlySpecialSale} from '../src/octoberPolicy.js';
import {NOVEMBER_SECOND_HOME_PROMOTION as period,calculateNovemberHomeBonusFromOrders as bonus} from '../src/novemberHomePolicy.js';
import {calculateHomePolicyFromOrders} from '../src/policyEngine.js';
const sale=(id,extra={})=>({id,user_id:'a',source_type:'mobile',sale_date:'2026-11-13',source_meta:{ri:1,bundle2ndKeys:[],weekendModelKind:'general',...extra}});
const pair=(id,date='2026-11-13')=>['internet500','homeTv'].map((product_type,i)=>({id:id+i,user_id:'a',customer_id:id,product_type,source_work_date:date,actual_install_date:'2026-11-14',status:'completed',network_type:'household',main_tv_plan:i?'broadcastPass':null,internet_plan:'premiumSafe'}));
test('weekend tiers reprice all confirmed points, never sum tiers',()=>{
 for(const [points,rate] of [[0,0],[4,0],[5,10000],[7,10000],[8,13000],[11,16000],[14,20000],[17,23000],[20,25000],[21,25000]]){
  const result=grade({points,pendingCount:0},{points:0,pendingCount:0,recordCount:0});assert.equal(result.rate,rate);assert.equal(result.amount,points*rate);
 }
});
test('exclusive general1/strategy3, each bundle2, completed internet2/free1/smart1 equals 11P and176000',()=>{
 const policy=NOVEMBER_SPECIAL_SALES.find(p=>p.model==='S942-256/512'&&p.saleType==='MNP');
 const m=mobile([sale('s',{specialPolicy:{policyId:policy.key},bundle2ndKeys:['watch']}),sale('a',{baseModel:'A176'}),sale('sim',{ri:5}),sale('standalone',{ri:7})]);
 assert.equal(m.points,7);assert.equal(m.pendingCount,0);
 const h=home([...pair('home'),{...pair('free')[0],id:'free',product_type:'tvFree'},{...pair('smart')[0],id:'smart',product_type:'smartHome'}]);assert.equal(h.points,4);assert.equal(grade(m,h).amount,176000);
});
test('period boundaries, duplicates, cancellations and support exclude safely; previous-parent bundle has no HS',()=>{
 const keep=sale('one');assert.equal(mobile([keep,keep,{...sale('cancel'),status:'cancelled'},{...sale('before'),sale_date:'2026-11-12'},{...sale('after'),sale_date:'2026-11-17'},sale('support',{teamOnly:true})]).points,1);
 assert.equal(mobile([{...sale('end'),sale_date:'2026-11-16'}]).points,1);
 assert.equal(mobile([sale('child',{ri:7,secondOnlyBundle:true,bundle2ndKeys:['watch']})]).points,2);
 assert.equal(home(pair('old').map(r=>({...r,actual_install_date:'2026-11-17'}))).points,0);
 assert.equal(home([...pair('h'),...pair('h')]).points,2);
 assert.equal(home([...pair('h'),{...pair('h')[0],id:'legacy',product_type:'homeOnly'}]).points,2);
});
test('unclassified models/FE, conflicting IDs, mixed employees, missing sources and legacy gaps cannot become paid totals',()=>{
 assert.equal(mobile([sale('unknown',{weekendModelKind:''})]).pendingCount,1);
 const fe=NOVEMBER_SPECIAL_SALES.find(p=>p.model==='S741');assert.equal(novemberWeekendModel({specialPolicy:{policyId:fe.key},weekendModelKind:'strategy'}),null);
 const emptyH=home([]);assert.equal(grade(mobile([sale('unknown',{weekendModelKind:''})]),emptyH).amount,null);
 assert.equal(grade(null,emptyH).amount,null);assert.equal(grade(mobile([]),null).amount,null);
 assert.equal(grade(mobile([sale('a')]),emptyH,{expectedHs:2}).amount,null);
 assert.equal(grade(mobile([]),emptyH,{legacyHome:1}).amount,null);
 assert.equal(grade(mobile([sale('same'),sale('same',{ri:5})]),emptyH).amount,null);
 assert.equal(grade(mobile([sale('a'),{...sale('b'),user_id:'b'}]),emptyH).amount,null);
});
test('November home windows are isolated, and each personal pair is paid only once in existing payroll',()=>{
 const first=pair('first','2026-11-05'),second=pair('second');
 assert.equal(bonus(second).total,0);assert.equal(bonus(second,period).total,100000);
 const result=calculateHomePolicyFromOrders([...first,...second]);assert.equal(result.novemberWeekend.total,100000);assert.equal(result.novemberSecondWeekend.total,100000);
 const two=calculateHomePolicyFromOrders([...first,...second,...pair('third','2026-11-16').map(r=>({...r,actual_install_date:'2026-11-16'}))]);assert.equal(two.novemberWeekend.total,100000);assert.equal(two.novemberSecondWeekend.total,300000);
 assert.equal(bonus(pair('outside','2026-11-17'),period).total,0);assert.equal(bonus(pair('before','2026-11-12'),period).total,0);
 assert.equal(bonus(pair('late').map(r=>({...r,actual_install_date:'2026-12-01'})),period).total,0);
 assert.equal(bonus(pair('soho').map(r=>({...r,network_type:'soho',main_tv_plan:'premium'})),period).total,100000);
 assert.equal(bonus(pair('pending').map(r=>({...r,status:'pending'})),period).total,0);
});
test('A176 November7 boundary preserves old60000/30000 and pays only new MNP50000',()=>{
 const before=specialSalesForDate('2026-11-06').filter(p=>p.model==='A176');assert.deepEqual(before.map(p=>p.additionalAmount),[60000,30000]);
 const after=specialSalesForDate('2026-11-07').filter(p=>p.model==='A176');assert.equal(after.length,1);assert.equal(after[0].saleType,'MNP');assert.equal(after[0].additionalAmount,50000);
 const p=after[0],args={policyKey:p.key,saleDate:'2026-11-07',saleType:'MNP',planDetail:{type:'general',key:'general_33'},strategicPoints:2};assert.equal(calculateMonthlySpecialSale(args).additionalAmount,50000);
 assert.equal(calculateMonthlySpecialSale({...args,strategicPoints:1.9}).eligible,false);assert.equal(calculateMonthlySpecialSale({...args,saleType:'기기변경'}).additionalAmount,0);
});

test('A176 old saved amounts become review items without mutating original receipts',()=>{
 const old=NOVEMBER_SPECIAL_SALES.find(p=>p.model==='A176'&&p.saleType==='MNP'&&p.startDate==='2026-11-01');
 const row=sale('old',{specialPolicy:{policyId:old.key,policyType:'additive',replacementAmount:60000}});const before=JSON.stringify(row);
 const review=novemberA176Review([row]);assert.equal(review.length,1);assert.equal(review[0].saved,60000);assert.equal(review[0].expected,50000);assert.equal(JSON.stringify(row),before);
 assert.equal(novemberA176Review([{...row,sale_date:'2026-11-06'}]).length,0);
 assert.equal(novemberA176Review([sale('paid',{specialPolicy:{policyId:'nov_a176_mnp_1107',policyType:'additive',replacementAmount:50000}})]).length,0);
});
test('support home awards are excluded from the new personal period without changing the first period',()=>{
 const rows=pair('support').map(r=>({...r,team_only:true}));assert.equal(home(rows).points,0);assert.equal(calculateHomePolicyFromOrders(rows).novemberSecondWeekend.total,0);
 assert.equal(home([{...pair('unknown')[0],actual_install_date:null}]).pendingCount,1);
 assert.equal(grade(mobile([sale('x'),{...sale('x'),status:'cancelled'}]),home([])).amount,null);
});
