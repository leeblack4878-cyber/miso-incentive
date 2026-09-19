import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReminderTasks,restoreReminders,reminderServices,usedPhoneMeta,usedPhoneSummary} from '../src/customerPromises.js';
test('93/183 days include leap/year boundaries; both schedules and individual insurance/VAS',()=>{
 const tasks=buildReminderTasks({saleDate:'2026-09-19',reminders:{plan:'both',services:{vasKyobo:'93',vasSafePass:'93',vasPhonePass:'keep'}},services:reminderServices(['vasKyobo','vasSafePass','vasPhonePass','vasNone','vasStrategicPlan'],[])});
 assert.deepEqual(tasks.map(t=>[t.task_type,t.due_date]),[['plan93','2026-12-21'],['plan183','2027-03-21'],['addon93_vasKyobo','2026-12-21'],['insurance93_vasSafePass','2026-12-21']]);
 assert.equal(buildReminderTasks({saleDate:'2027-12-01',reminders:{plan:'93'},services:[]})[0].due_date,'2028-03-03');
});
test('sale editing retains rescheduling and manual tasks, never duplicates closed reminders',()=>{
 const previous=[{task_type:'plan93',status:'completed'},{task_type:'plan183',status:'pending',due_date:'2027-04-01',note:'고객 요청'},{task_type:'custom',status:'pending',task_meta:{amount:33}},{task_type:'usedPhone',status:'completed'}];
 const rows=buildReminderTasks({saleDate:'2026-09-19',reminders:{plan:'both'},services:[],previous});
 assert.equal(rows.length,2);assert.equal(rows[0].due_date,'2027-04-01');assert.equal(rows[0].note,'고객 요청');assert.equal(rows[1].task_meta.amount,33);
 assert.equal(buildReminderTasks({saleDate:'2026-09-19',reminders:{plan:'keep'},services:[],previous}).length,1);
});
test('old plan selection restores without changing completed tasks; metadata persists both',()=>{
 assert.equal(restoreReminders({},[{task_type:'plan93',status:'pending'},{task_type:'plan183',status:'pending'}]).plan,'both');
 assert.equal(restoreReminders({},[{task_type:'plan93',status:'completed'}]).plan,'keep');
 assert.equal(restoreReminders({reminders:{plan:'both',services:{}}},[]).plan,'both');
});
test('used phone 300000 split 100000 penalty + 200000 deposit counted once in completion month',()=>{
 const meta=usedPhoneMeta({expected_amount:'320000',actual_amount:'300000',processed_date:'2026-10-01',allocations:[{method:'위약금 수납',amount:'100000'},{method:'고객 입금',amount:'200000'}]},true);
 const t={task_type:'usedPhone',status:'completed',task_meta:meta};
 const rows=[t,{...t,status:'pending'},{...t,status:'cancelled'}];
 const summary=usedPhoneSummary(rows,'2026-10');assert.equal(summary.actual,300000);assert.equal(summary.expected,320000);assert.equal(summary.methods['고객 입금'],200000);assert.equal(summary.count,1);assert.equal(summary.pending,1);
 assert.equal(usedPhoneSummary(rows,'2026-09').actual,0);
});
test('missing actual differs from zero; incomplete and overallocated settlement blocked',()=>{
 assert.equal(usedPhoneMeta({}).actual_amount,null);
 assert.throws(()=>usedPhoneMeta({},true));
 assert.throws(()=>usedPhoneMeta({actual_amount:30,allocations:[{method:'고객 입금',amount:31}]}));
 assert.throws(()=>usedPhoneMeta({actual_amount:30,processed_date:'2026-09-19',allocations:[{method:'고객 입금',amount:20}]},true));
 assert.throws(()=>usedPhoneMeta({allocations:[{method:'기타',amount:1}]}));
 assert.throws(()=>usedPhoneMeta({actual_amount:-1}));
 assert.equal(usedPhoneMeta({actual_amount:0,processed_date:'2026-09-19'},true).actual_amount,0);
});
