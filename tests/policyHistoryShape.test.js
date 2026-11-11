import test from 'node:test';
import assert from 'node:assert/strict';
import {POLICY_CHANGE_HISTORY} from '../src/policyChangeHistory.js';
test('every policy record can render month options and stable article keys',()=>{
 const ids=new Set();for(const row of POLICY_CHANGE_HISTORY){assert.match(row.month,/^20\d{2}-(0[1-9]|1[0-2])$/);assert.ok(row.id&&!ids.has(row.id));ids.add(row.id);assert.ok(row.effective);assert.ok(row.date.startsWith(row.month));}
});
