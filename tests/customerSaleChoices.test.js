import test from 'node:test';
import assert from 'node:assert/strict';
import {customerSaleChoices,taskChoiceKey,customerChoiceLabel} from '../src/customerSaleChoices.js';
const customers=[{id:'c',customer_name:'김민수'}];
const sales=[{id:'s1',customer_id:'c',sale_date:'2026-09-19',source_type:'mobile'},{id:'s2',customer_id:'c',sale_date:'2026-08-25',source_type:'home_order',source_ref:'o2',created_at:'2026-09-19T00:00:00Z'}];
test('namesakes use distinct sale IDs, home uses input date rather than later save/install date',()=>{
 const rows=customerSaleChoices({customers,sales});assert.equal(rows.length,2);assert.equal(rows[0].key,'sale:s1');assert.equal(rows[1].month,'2026-08');assert.match(customerChoiceLabel(rows[1]),/2026.08.25/);
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
 const row=customerSaleChoices({customers,tasks:[{customer_id:'c',status:'pending'}]})[0];assert.equal(row.month,'unknown');assert.match(customerChoiceLabel(row),/날짜 미확인/);
});
test('same name/day mobile, home and identical products have distinct stable labels',()=>{
 const input=[
  {id:'a',customer_id:'c',sale_date:'2026-09-19',source_type:'mobile',metric_label:'MNP'},
  {id:'b',customer_id:'c',sale_date:'2026-09-19',source_type:'mobile',metric_label:'MNP'},
  {id:'h',customer_id:'c',sale_date:'2026-09-19',source_type:'home_order',metric_label:'인터넷+TV'},
  {id:'n',customer_id:'namesake',sale_date:'2026-09-19',source_type:'mobile',metric_label:'MNP'},
 ];
 const args={customers:[...customers,{id:'namesake',customer_name:'김민수'}],sales:input};
 const rows=customerSaleChoices(args),labels=rows.map(customerChoiceLabel);
 assert.equal(new Set(labels).size,4);
 assert.match(labels[0],/모바일 · MNP · 1건째/);
 assert.match(labels[2],/홈 · 인터넷\+TV/);
 assert.deepEqual(customerSaleChoices({...args,sales:[...input].reverse()}),rows);
 assert.deepEqual(rows.map(r=>r.reference.id),['a','b','h','n']);
 assert.equal(customerChoiceLabel(customerSaleChoices({customers,sales:[input[0]]})[0]),'김민수 · 2026.09.19');
});
test('collision labels preserve deleted manual promises and September/October attribution',()=>{
 const ref={id:'deleted',date:'2026-09-19',kind:'모바일',label:'MNP'};
 const task={customer_id:'c',status:'pending',task_meta:{sale_reference:ref}};
 const rows=customerSaleChoices({customers,sales:[sales[0],{...sales[0],id:'oct',sale_date:'2026-10-01'}],tasks:[task]});
 const old=rows.find(r=>r.key===taskChoiceKey(task));
 assert.equal(old.month,'2026-09');assert.deepEqual(old.reference,ref);
 assert.match(customerChoiceLabel(old),/이전 판매/);
 assert.equal(customerChoiceLabel(rows[0]),'김민수 · 2026.10.01');
 assert.equal(new Set(rows.map(customerChoiceLabel)).size,3);
});
