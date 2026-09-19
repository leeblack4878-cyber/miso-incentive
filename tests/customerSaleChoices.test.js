import test from 'node:test';
import assert from 'node:assert/strict';
import {customerSaleChoices,taskChoiceKey,customerChoiceLabel} from '../src/customerSaleChoices.js';
const customers=[{id:'c',customer_name:'김민수'}];
const sales=[{id:'s1',customer_id:'c',sale_date:'2026-09-19',source_type:'mobile'},{id:'s2',customer_id:'c',sale_date:'2026-08-25',source_type:'home_order',source_ref:'o2',created_at:'2026-09-19T00:00:00Z'}];
test('namesakes use distinct sale IDs, home uses input date rather than later save/install date',()=>{
 const rows=customerSaleChoices({customers,sales});assert.equal(rows.length,2);assert.equal(rows[0].key,'sale:s1');assert.equal(rows[1].month,'2026-08');assert.match(customerChoiceLabel(rows[1]),/홈 · 2026.08.25 입력/);
});
test('linked reminders stay isolated; unlinked legacy tasks are never guessed into a sale',()=>{
 const tasks=[{customer_id:'c',status:'pending',base_date:'2026-09-19'}];const rows=customerSaleChoices({customers,sales,tasks});assert.equal(rows.length,3);assert.equal(rows.find(r=>r.kind==='기존 약속').key,'legacy:c');
 assert.equal(taskChoiceKey({customer_id:'c',source_sale_id:'s1'}),'sale:s1');assert.equal(taskChoiceKey({task_meta:{sale_reference:{id:'s2'}}}),'sale:s2');
});
test('cancelled home and deleted empty customers are hidden; pending references/history survive',()=>{
 assert.equal(customerSaleChoices({customers,sales,orders:[{id:'o2',status:'cancelled'}]}).length,1);
 assert.equal(customerSaleChoices({customers,sales:[]}).length,0);
 const task={customer_id:'c',status:'pending',task_meta:{sale_reference:{id:'deleted',date:'2026-07-10',kind:'홈',label:'TV'}}};
 const row=customerSaleChoices({customers,tasks:[task]})[0];assert.equal(row.month,'2026-07');assert.equal(row.key,'sale:deleted');
 assert.equal(customerSaleChoices({customers,tasks:[{...task,status:'completed'}]}).length,0);
 assert.equal(customerSaleChoices({customers,tasks:[{...task,status:'completed'}],includeHistory:true}).length,1);
});
test('undated legacy records remain accessible without invented dates',()=>{
 const row=customerSaleChoices({customers,tasks:[{customer_id:'c',status:'pending'}]})[0];assert.equal(row.month,'unknown');assert.match(customerChoiceLabel(row),/입력일 미확인/);
});
