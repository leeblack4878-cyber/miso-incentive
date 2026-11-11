import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeHighPlanShare} from '../src/mobilePlans.js';
import {calculateRetailPartnerMonthlyPolicy} from '../src/hqStructurePolicy.js';
const sale=(id,key,ri=1)=>({id,source_type:'mobile',source_meta:{ri,planDetail:key?{key,type:key.split('_')[0]}:null}});
test('115/130 including signature tier excludes junior and senior from denominator',()=>{
 const rows=[sale('1','general_115'),sale('2','general_130'),sale('3','general_95'),sale('4','junior_85'),sale('5','senior_47'),sale('6','general_115',5)];
 const r=summarizeHighPlanShare([...rows,rows[0]]);assert.equal(r.high,2);assert.equal(r.base,3);assert.equal(r.weak,2);assert.equal(r.ratio,2/3*100);
 const p=calculateRetailPartnerMonthlyPolicy({hs:5,plan115Hs:2,plan115Base:r.base});assert.equal(p.plan115Ratio,2/3*100);
});
test('unknown plan and empty or all-weak base are never treated as measured zero percent',()=>{
 assert.equal(summarizeHighPlanShare([sale('1',null)]).ratio,null);
 assert.equal(summarizeHighPlanShare([sale('1','junior_85')]).ratio,null);
 assert.equal(summarizeHighPlanShare([]).ratio,null);
});
