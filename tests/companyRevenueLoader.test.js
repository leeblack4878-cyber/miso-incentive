import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCompanyRevenue} from '../src/companyRevenueLoader.js';
function client(tables,fail){return {from(table){let filters=[];return {select(){return this;},eq(k,v){filters.push(r=>r[k]===v);return this;},gte(k,v){filters.push(r=>r[k]>=v);return this;},lt(k,v){filters.push(r=>r[k]<v);return this;},in(k,v){filters.push(r=>v.includes(r[k]));return this;},order(){return this;},async range(a,b){if(table===fail)return {error:new Error('denied')};return {data:(tables[table]||[]).filter(r=>filters.every(f=>f(r))).slice(a,b+1)};}}}};}
test('company reads installation-month homes, all siblings and original application-month SIM source',async()=>{
 const tables={home_orders:[{id:'a',status:'completed',actual_install_date:'2026-10-03',source_work_date:'2026-09-20'},{id:'b',status:'pending',source_work_date:'2026-09-20'},{id:'c',status:'completed',actual_install_date:'2026-09-03',source_work_date:'2026-09-01'}],customer_sales:[{id:'h',source_type:'home_order',source_ref:'a',sale_date:'2026-09-20'},{id:'sim',source_type:'mobile',sale_date:'2026-09-20'},{id:'oct',source_type:'mobile',sale_date:'2026-10-02'},{id:'nov',source_type:'mobile',sale_date:'2026-11-01'}]};
 const r=await loadCompanyRevenue(client(tables),'2026-10');assert.deepEqual(r.orders.map(x=>x.id),['a','b']);assert.deepEqual(r.sales.map(x=>x.id),['sim','oct','h']);
});
test('company query failure rejects the entire result instead of displaying a partial sum',async()=>{
 await assert.rejects(loadCompanyRevenue(client({},'home_orders'),'2026-10'),/denied/);
 await assert.rejects(loadCompanyRevenue(client({},'customer_sales'),'2026-10'),/denied/);
});
