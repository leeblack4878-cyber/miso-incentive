import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readEnvironment } from './environment.js';
export { expect };
export const date = '2026-09-16';
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
export async function result(request) {
  const { data, error } = await request;
  if (error) throw new Error(`Supabase failure: ${error.code || 'unknown'} ${error.message}`);
  return data;
}
const tables = ['home_orders', 'customer_sales', 'customer_tasks', 'sales_expenses', 'daily_records'];
export async function snapshot(client, id) {
  return Object.fromEntries(await Promise.all(tables.map(async table =>
    [table, await result(client.from(table).select('*').eq('user_id', id).order('id'))])));
}
export function payload(userId, customerId, customerName, smart = false, completed = false) {
  const products = [['homeTv','homeBase','homeTv','TV(주) · 방송패스'],
    ['internet500','homeFlat','home500Only','인터넷 500MB'],
    ...(smart ? [['smartHome','homeFlat','smartHome','스마트홈']] : [])];
  const ids = products.map(() => randomUUID());
  return { p_user_id: userId, p_work_date: date,
    p_orders: products.map(([product_type,source_group,source_key]) => ({ user_id:userId,customer_id:customerId,
      customer_name:customerName,product_type,source_group,source_key,network_type:'household',sale_type:'normal',
      status:completed?'completed':'pending',applied_at:`${date}T03:00:00Z`,source_work_date:date,
      completed_at:completed?`${date}T03:00:00Z`:null,actual_install_date:completed?date:null,
      planned_install_date:null,main_tv_plan:product_type==='homeTv'?'broadcastPass':null,schema_version:3 })),
    p_sales: products.map((p,i) => ({ id:ids[i],user_id:userId,customer_id:customerId,sale_date:date,
      metric_label:p[3],source_type:'home_order',schema_version:3,
      source_meta:{schemaVersion:3,unifiedHome:true,networkType:'household',internetSpeed:'500',mainTvPlanLevel:'broadcastPass',mobileSimul:'none'} })),
    p_tasks:[{user_id:userId,customer_id:customerId,source_sale_id:ids[0],task_type:'custom',title:'E2E 유지 확인',base_date:date,due_date:'2026-09-20',status:'pending',task_meta:{}}],
    // Deliberately attach expense to a different sale: no query order can recover
    // both children by reading only the first sale in the bundle.
    p_expenses:[{user_id:userId,source_sale_id:ids[1],expense_date:date,amount:33000,category:'오퍼',customer_name:customerName,memo:'E2E 설치비'}],
    p_replace_sale_ids:[],p_replace_order_ids:[],p_daily_record:null };
}
export const test = base.extend({
  world: async ({ page }, use) => {
    const env=readEnvironment();
    const admin=createClient(env.url,env.serviceKey,options);
    const actors=[];
    // Validation completes before any write or cleanup is enabled.
    for (const credentials of [env.employee,env.other]) {
      const client=createClient(env.url,env.publicKey,options);
      const login=await result(client.auth.signInWithPassword(credentials));
      const id=login.user.id;
      const profile=await result(admin.from('profiles').select('id,name,role,position,active,status,store_name,store_scope').eq('id',id).single());
      expect(profile.role).toBe('employee'); expect(profile.position).toBe('사원');
      expect(profile.active).toBe(true); expect(profile.status).toBe('approved');
      expect(profile.name).toMatch(/^E2E_/); expect(profile.store_name).toMatch(/^E2E_/);
      expect(profile.store_scope == null || profile.store_scope.length === 0).toBe(true);
      const existing=await snapshot(admin,id);
      for(const rows of Object.values(existing)) expect(rows,'Dedicated account must have no existing business data').toHaveLength(0);
      for(const table of ['customers','monthly_status']) expect(await result(admin.from(table).select('id').eq('user_id',id))).toHaveLength(0);
      actors.push({id,client,credentials,profile});
    }
    expect(actors[0].id).not.toBe(actors[1].id);
    for (const actor of actors) {
      const peers=await result(admin.from('profiles').select('id,role').eq('store_name',actor.profile.store_name));
      expect(peers.every(p=>actors.some(a=>a.id===p.id)&&p.role==='employee')).toBe(true);
    }
    const [employee,other]=actors;
    const world={env,admin,employee,other,
      async seed(actor) {
        const name=`E2E_${randomUUID().slice(0,8)}`;
        const customer=await result(actor.client.from('customers').insert({user_id:actor.id,customer_name:name,first_sale_date:date,last_sale_date:date}).select('id').single());
        const body=payload(actor.id,customer.id,name);
        await result(actor.client.rpc('save_home_bundle_atomic',body));
        return {id:customer.id,name,body};
      }};
    try { await use(world); }
    finally {
      await page.close();
      // Only the two verified, dedicated accounts; never truncate or touch policies.
      for(const actor of actors) {
        for(const table of ['customer_tasks','sales_expenses','customer_sales','home_orders','daily_records','monthly_status','customers'])
          await result(admin.from(table).delete().eq('user_id',actor.id));
        const after=await snapshot(admin,actor.id);
        for(const rows of Object.values(after)) expect(rows,'Fixture cleanup must succeed').toHaveLength(0);
        const profile=await result(admin.from('profiles').select('id,name,role,position,active,status,store_name,store_scope').eq('id',actor.id).single());
        expect(profile).toEqual(actor.profile);
        await actor.client.auth.signOut();
      }
    }
  },
});

export async function openEmployee(page, world) {
  await page.clock.setFixedTime(new Date(`${date}T03:00:00Z`));
  await page.addLocatorHandler(page.getByRole('button',{name:'좋아요!',exact:true}),async locator=>locator.click());
  await page.goto('/');
  await page.locator('input[type=email]').fill(world.employee.credentials.email);
  await page.locator('input[type=password]').fill(world.employee.credentials.password);
  await page.getByRole('button',{name:'로그인',exact:true}).last().click();
  await page.getByRole('button',{name:'확인하고 시작하기',exact:true}).click();
  await page.getByRole('button',{name:'실적입력',exact:true}).click();
  await page.getByTestId('sale-day-16').click();
}
export async function editBundle(page, customer) {
  await page.getByTestId(`sale-bundle-${customer.id}`).getByRole('button',{name:'판매건 수정',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'홈 실적 입력',exact:true});
  await expect(dialog.getByPlaceholder('고객명을 입력해주세요')).toHaveValue(customer.name);
  return dialog;
}
export async function saveDialog(page, dialog) {
  const response=page.waitForResponse(r=>r.url().endsWith('/rest/v1/rpc/save_home_bundle_atomic')&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();
  return await response;
}
