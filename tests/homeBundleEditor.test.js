import test from 'node:test';
import assert from 'node:assert/strict';
import {loadHomeBundleChildren} from '../src/homeBundleEditor.js';

function fakeClient(failTable) {
  const calls=[];
  return {calls,from(table){
    const query={};
    for(const method of ['select','eq','in','neq','order']) query[method]=(...args)=>{calls.push([table,method,...args]);return query;};
    query.then=(resolve,reject)=>Promise.resolve({data:[{id:table,source_sale_id:'second'}],error:table===failTable?new Error('lookup failed'):null}).then(resolve,reject);
    return query;
  }};
}
test('bundle editor loads children across all sales with user isolation',async()=>{
  const client=fakeClient();
  const children=await loadHomeBundleChildren(client,'owner',[{id:'first'},{id:'second'},{id:'first'}]);
  assert.equal(children.tasks[0].source_sale_id,'second');
  assert.equal(children.expenses[0].source_sale_id,'second');
  for(const table of ['customer_tasks','sales_expenses']){
    assert.ok(client.calls.some(c=>JSON.stringify(c)===JSON.stringify([table,'in','source_sale_id',['first','second']])));
    assert.ok(client.calls.some(c=>JSON.stringify(c)===JSON.stringify([table,'eq','user_id','owner'])));
  }
});
for(const table of ['customer_tasks','sales_expenses'])test(`${table} failure prevents destructive empty edit`,async()=>{
  await assert.rejects(loadHomeBundleChildren(fakeClient(table),'owner',[{id:'first'}]),/lookup failed/);
});
test('empty bundle or missing owner fails before queries',async()=>{
  const client=fakeClient();
  await assert.rejects(loadHomeBundleChildren(client,'owner',[]),/HOME_BUNDLE_NOT_FOUND/);
  await assert.rejects(loadHomeBundleChildren(client,null,[{id:'first'}]),/HOME_BUNDLE_NOT_FOUND/);
  assert.equal(client.calls.length,0);
});
