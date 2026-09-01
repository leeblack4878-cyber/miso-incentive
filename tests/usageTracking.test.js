import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('사용기록은 화면·기능 식별자만 저장하고 본문 데이터는 받지 않는다', async () => {
  const source = await readFile(new URL('../src/usageTracking.js', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../sql/app_usage_events.sql', import.meta.url), 'utf8');

  assert.match(source, /SAFE_KEY/);
  assert.match(source, /screen_key/);
  assert.match(source, /feature_key/);
  assert.doesNotMatch(source, /customer_name|phone_number|sale_amount|memo/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) = user_id\)/i);
});
