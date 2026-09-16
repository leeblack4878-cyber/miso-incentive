import { randomUUID } from 'node:crypto';
import { test, expect, result, snapshot, payload, date, openEmployee, editBundle, saveDialog } from './fixtures.js';

for (const complete of [false, true]) {
  test(`employee adds Smart Home to existing bundle: ${complete ? 'completed' : 'pending'}; reload and repeat do not duplicate`, async ({ page, world }) => {
    const customer=await world.seed(world.employee);
    const before=await snapshot(world.admin,world.employee.id);
    await openEmployee(page,world);
    const dialog=await editBundle(page,customer);
    await dialog.getByRole('button',{name:'스마트홈',exact:true}).click();
    if(complete) {
      await dialog.getByLabel('지금 바로 설치/개통 완료된 건').check();
      await dialog.getByLabel('설치완료일',{exact:true}).fill(date);
    }
    const response=await saveDialog(page,dialog);
    expect(response.ok(),await response.text()).toBe(true);
    expect(await response.json()).toMatchObject({order_count:3,sale_count:3});
    await expect(dialog).toHaveCount(0);
    async function verify() {
      const saved=await snapshot(world.admin,world.employee.id);
      expect(saved.home_orders.map(r=>r.product_type).sort()).toEqual(['homeTv','internet500','smartHome']);
      expect(saved.home_orders.every(r=>r.status===(complete?'completed':'pending'))).toBe(true);
      expect(saved.home_orders.every(r=>r.actual_install_date===(complete?date:null))).toBe(true);
      expect(saved.customer_sales).toHaveLength(3);
      expect(new Set(saved.customer_sales.map(r=>r.source_ref)).size).toBe(3);
      for(const sale of saved.customer_sales) {
        expect(sale.user_id).toBe(world.employee.id);
        expect(sale.customer_id).toBe(customer.id);
        expect(saved.home_orders.some(o=>String(o.id)===sale.source_ref && o.customer_id===sale.customer_id)).toBe(true);
      }
      expect(saved.home_orders.some(o=>before.home_orders.some(old=>old.id===o.id))).toBe(false);
      expect(saved.customer_sales.some(s=>before.customer_sales.some(old=>old.id===s.id))).toBe(false);
      expect(saved.customer_tasks).toHaveLength(1); expect(saved.sales_expenses).toHaveLength(1);
      expect(saved.customer_tasks[0].title).toBe('E2E 유지 확인');
      expect(Number(saved.sales_expenses[0].amount)).toBe(33000);
      for(const child of [...saved.customer_tasks,...saved.sales_expenses])
        expect(saved.customer_sales.some(s=>s.id===child.source_sale_id)).toBe(true);
      expect(saved.daily_records).toHaveLength(1);
      const groups=saved.daily_records[0].data.groups;
      expect(Number(groups?.homeBase?.homeTv||0)).toBe(complete?1:0);
      expect(Number(groups?.homeFlat?.home500Only||0)).toBe(complete?1:0);
      expect(Number(groups?.homeFlat?.smartHome||0)).toBe(complete?1:0);
    }
    await verify();
    await page.reload();
    await page.getByRole('button',{name:'실적입력',exact:true}).click();
    await page.getByTestId('sale-day-16').click();
    await expect(page.getByTestId(`sale-bundle-${customer.id}`)).toContainText('스마트홈');
    const again=await editBundle(page,customer);
    const retry=await saveDialog(page,again);
    expect(retry.ok(),await retry.text()).toBe(true);
    await expect(again).toHaveCount(0);
    await verify();
  });
}

test('real DB failure after replacements rolls back every ledger; form remains editable and retry succeeds', async ({ page, world }) => {
  const customer=await world.seed(world.employee);
  await openEmployee(page,world);
  const dialog=await editBundle(page,customer);
  await dialog.getByRole('button',{name:'스마트홈',exact:true}).click();
  await dialog.getByLabel('지금 바로 설치/개통 완료된 건').check();
  // Snapshot after app boot so unrelated initialization cannot masquerade as a rollback failure.
  const before=await snapshot(world.admin,world.employee.id);
  const rpc='**/rest/v1/rpc/save_home_bundle_atomic';
  await page.route(rpc,async route=>{
    const body=route.request().postDataJSON();
    expect(body.p_replace_order_ids).toHaveLength(2);
    expect(body.p_tasks).toHaveLength(1);
    // Request reaches real Postgres: expense insert occurs AFTER deletion, replacement and task insertion.
    // Nonexistent sale reference forces a real foreign-key violation, not a mocked response.
    body.p_expenses[0].source_sale_id=randomUUID();
    await route.continue({postData:JSON.stringify(body)});
  },{times:1});
  const failure=await saveDialog(page,dialog);
  expect(failure.ok()).toBe(false);
  expect(await failure.json()).toMatchObject({code:'23503'});
  await expect(page.getByText('홈 상품 등록 실패',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'수정 저장',exact:true})).toBeEnabled();
  expect(await snapshot(world.admin,world.employee.id)).toEqual(before);
  const retry=await saveDialog(page,dialog);
  expect(retry.ok(),await retry.text()).toBe(true);
  await expect(dialog).toHaveCount(0);
  const saved=await snapshot(world.admin,world.employee.id);
  expect(saved.home_orders).toHaveLength(3); expect(saved.customer_sales).toHaveLength(3);
  expect(saved.customer_tasks).toHaveLength(1); expect(saved.sales_expenses).toHaveLength(1);
});

test('authenticated employee cannot replace/delete another employee bundle; stale IDs roll back own deletions', async ({ world }) => {
  const mine=await world.seed(world.employee), theirs=await world.seed(world.other);
  const own=await snapshot(world.admin,world.employee.id), other=await snapshot(world.admin,world.other.id);
  const foreign=payload(world.other.id,theirs.id,theirs.name,true);
  foreign.p_replace_sale_ids=other.customer_sales.map(x=>x.id);
  foreign.p_replace_order_ids=other.home_orders.map(x=>x.id);
  const forbidden=await world.employee.client.rpc('save_home_bundle_atomic',foreign);
  expect(forbidden.error?.message).toContain('HOME_WRITE_FORBIDDEN');
  const deletion=await world.employee.client.from('home_orders').delete().in('id',foreign.p_replace_order_ids).select('id');
  expect(deletion.error).toBeNull(); expect(deletion.data).toEqual([]);
  // Own sale deletion executes first; order mismatch must restore it and its tasks/expenses.
  const stale=payload(world.employee.id,mine.id,mine.name,true);
  stale.p_replace_sale_ids=own.customer_sales.map(x=>x.id);
  stale.p_replace_order_ids=[...own.home_orders.map(x=>x.id),other.home_orders[0].id];
  const mismatch=await world.employee.client.rpc('save_home_bundle_atomic',stale);
  expect(mismatch.error?.message).toContain('HOME_REPLACE_ORDERS_MISMATCH');
  expect(await snapshot(world.admin,world.employee.id)).toEqual(own);
  expect(await snapshot(world.admin,world.other.id)).toEqual(other);
});
