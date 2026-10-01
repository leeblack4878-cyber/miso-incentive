import test from 'node:test';
import assert from 'node:assert/strict';
import {MOBILE_PLANS,getMobilePlan,summarizeMobilePlans,mobilePlanLabel} from '../src/mobilePlans.js';
const plan=key=>MOBILE_PLANS.find(p=>p.key===key);
const sale=(id,key,extra={})=>({id,user_id:'a',source_type:'mobile',source_meta:{ri:1,ci:2,planDetail:plan(key),...extra}});
test('29 reporting choices retain all user types, low-tier variants and unique stable keys',()=>{
 assert.equal(MOBILE_PLANS.length,29);
 assert.equal(new Set(MOBILE_PLANS.map(x=>x.key)).size,29);
 for(const [type,count] of [['general',13],['senior',6],['junior',10]])assert.equal(MOBILE_PLANS.filter(p=>p.type===type).length,count);
 assert.equal(plan('general_130').label,'130군');assert.match(plan('senior_under28').label,/16\.5/);assert.match(plan('junior_under28').label,/키즈22/);assert.match(plan('junior_28').label,/키즈29/);
 assert.notEqual(mobilePlanLabel(plan('senior_47')),mobilePlanLabel(plan('general_47')));
 assert.equal(getMobilePlan({key:'general_95',type:'senior'}),null);
});
test('store/type counts separate HS, SIM, missing details; never count previous parent or 2ND',()=>{
 const sales=[sale('1','general_95'),sale('2','general_105'),sale('3','senior_47'),sale('4','junior_85',{ri:5}),sale('5',null),sale('second','general_115',{ri:7,secondOnlyBundle:true}),sale('standalone',null,{ri:7}),{...sale('cancel','general_95'),status:'cancelled'},sale('6','junior_28',{ri:6})];
 const opts={userIds:['a'],branches:['store'],employeeBranches:{a:'store'}};
 const total=summarizeMobilePlans(sales,opts);
 assert.equal(total.total,6);assert.equal(total.missing,1);assert.deepEqual(total.types,{general:2,senior:1,junior:2});
 assert.equal(summarizeMobilePlans(sales,{...opts,kind:'hs'}).total,4);
 assert.equal(summarizeMobilePlans(sales,{...opts,kind:'sim'}).total,1);
});
test('only scoped employees, credited store for support, no support in personal statistics; duplicates ignored',()=>{
 const one=sale('1','general_130');
 const support=sale('2','senior_44',{teamOnly:true,creditedStore:'other'});
 const rows=[one,one,support,{...sale('outside','junior_85'),user_id:'forbidden'}];
 const opts={userIds:['a'],employeeBranches:{a:'home'}};
 assert.equal(summarizeMobilePlans(rows,{...opts,branches:['home']}).total,1);
 assert.equal(summarizeMobilePlans(rows,{...opts,branches:['other']}).counts.senior_44,1);
 assert.equal(summarizeMobilePlans(rows,{...opts,personal:true}).total,1);
 assert.equal(summarizeMobilePlans(rows,{...opts,userIds:[]}).total,0);
});
test('editing classification moves one count; deleting removes it; unknown historical data stays unknown',()=>{
 const old=sale('1',null),opts={userIds:['a']};
 assert.equal(summarizeMobilePlans([old],opts).missing,1);
 const updated={...old,source_meta:{...old.source_meta,planDetail:plan('junior_33')}};
 assert.equal(summarizeMobilePlans([updated],opts).counts.junior_33,1);assert.equal(updated.source_meta.ci,old.source_meta.ci);
 assert.equal(summarizeMobilePlans([],opts).total,0);
 assert.equal(summarizeMobilePlans([sale('bad',null,{planDetail:{type:'general',key:'general_unknown'}})],opts).missing,1);
});
