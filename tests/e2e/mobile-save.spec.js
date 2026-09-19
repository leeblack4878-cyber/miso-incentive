import {randomUUID} from 'node:crypto';
import {test,expect,result,snapshot,date,openEmployee,editBundle,saveDialog} from './fixtures.js';

test('home edit preserves completed and cancelled promise identities through repeated saves',async({page,world})=>{
 const customer=await world.seed(world.employee);
 const original=await snapshot(world.admin,world.employee.id);
 const closed=await result(world.employee.client.from('customer_tasks').insert(['completed','cancelled'].map(status=>({user_id:world.employee.id,customer_id:customer.id,source_sale_id:original.customer_sales[1].id,task_type:'custom',title:`E2E_${status}`,base_date:date,due_date:date,status,completed_at:status==='completed'?`${date}T01:00:00Z`:null,task_meta:{preserved:status}}))).select('*'));
 await openEmployee(page,world);
 for(let i=0;i<2;i++){
  const dialog=await editBundle(page,customer);
  const response=await saveDialog(page,dialog);expect(response.ok(),await response.text()).toBe(true);
  await expect(dialog).toHaveCount(0);
  const saved=await snapshot(world.admin,world.employee.id);
  expect(saved.customer_tasks).toHaveLength(3);
  for(const old of closed){const now=saved.customer_tasks.find(t=>t.id===old.id);expect(now).toMatchObject({status:old.status,completed_at:old.completed_at,created_at:old.created_at,task_meta:old.task_meta});expect(saved.customer_sales.some(s=>s.id===now.source_sale_id)).toBe(true);}
 }
 await page.getByRole('button',{name:'고객관리',exact:true}).click();
 await page.getByRole('button',{name:'완료·취소',exact:true}).click();
 await expect(page.getByText(`${customer.name} · E2E_completed`,{exact:true})).toBeVisible();
 await expect(page.getByText(`${customer.name} · E2E_cancelled`,{exact:true})).toBeVisible();
});

test('mobile create, actual child failure rollback, edit and undo use one transaction and refresh totals',async({page,world})=>{
 await openEmployee(page,world);
 await page.getByRole('button',{name:/모바일 실적 입력/}).click();
 const dialog=page.getByRole('dialog',{name:'모바일 실적 입력'});
 await dialog.getByRole('button',{name:'일반 판매',exact:true}).click();
 const name=`E2E_mobile_${randomUUID().slice(0,6)}`;
 await dialog.getByPlaceholder('고객명을 입력해주세요').fill(name);
 await dialog.getByLabel('가입구분',{exact:true}).selectOption('0');
 await dialog.getByLabel('요금제군',{exact:true}).selectOption('0');
 await dialog.getByRole('button',{name:'둘 다',exact:true}).click();
 const before=await snapshot(world.admin,world.employee.id);
 const rpc='**/rest/v1/rpc/save_sale_atomic';
 await page.route(rpc,async route=>{const body=route.request().postDataJSON();body.p_expenses=[{amount:1000,expense_date:null,category:'E2E failure'}];await route.continue({postData:JSON.stringify(body)});},{times:1});
 let wait=page.waitForResponse(r=>r.url().endsWith('/rpc/save_sale_atomic'));
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();
 const failure=await wait;expect(failure.ok()).toBe(false);expect((await failure.json()).code).toBe('23502');
 expect(await snapshot(world.admin,world.employee.id)).toEqual(before);
 await expect(dialog.getByRole('button',{name:'실적 등록',exact:true})).toBeEnabled();
 wait=page.waitForResponse(r=>r.url().endsWith('/rpc/save_sale_atomic'));
 await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();
 const savedResponse=await wait;expect(savedResponse.ok(),await savedResponse.text()).toBe(true);
 await expect(dialog).toHaveCount(0);
 const created=await snapshot(world.admin,world.employee.id);
 expect(created.customer_tasks.map(t=>t.task_type).sort()).toEqual(['plan183','plan93']);
 expect(created.customer_sales[0].source_meta.reminders.plan).toBe('both');
 expect(created.customer_sales).toHaveLength(1);expect(created.daily_records[0].data.matrix[0][0]).toBe(1);
 await page.getByRole('button',{name:'판매건 수정',exact:true}).click();
 await dialog.getByLabel('요금제군',{exact:true}).selectOption('1');
 wait=page.waitForResponse(r=>r.url().endsWith('/rpc/save_sale_atomic'));
 await dialog.getByRole('button',{name:'수정 저장',exact:true}).click();
 const edit=await wait;expect(edit.ok(),await edit.text()).toBe(true);await expect(dialog).toHaveCount(0);
 const edited=await snapshot(world.admin,world.employee.id);
 expect(edited.customer_tasks.map(t=>t.task_type).sort()).toEqual(['plan183','plan93']);
 expect(edited.customer_tasks.map(t=>t.due_date).sort()).toEqual(created.customer_tasks.map(t=>t.due_date).sort());
 expect(edited.customer_sales).toHaveLength(1);expect(edited.customer_sales[0].id).toBe(created.customer_sales[0].id);
 expect(edited.customer_sales[0].source_meta.policySnapshot).toEqual(created.customer_sales[0].source_meta.policySnapshot);
 expect(edited.daily_records[0].data.matrix[0].slice(0,2)).toEqual([0,1]);
 wait=page.waitForResponse(r=>r.url().endsWith('/rpc/delete_sale_atomic'));
 await page.getByRole('button',{name:'삭제',exact:true}).click();
 await page.getByRole('button',{name:'판매건 삭제',exact:true}).click();
 const undone=await wait;expect(undone.ok(),await undone.text()).toBe(true);
 await expect.poll(async()=> (await snapshot(world.admin,world.employee.id)).customer_sales.length).toBe(0);
 const after=await snapshot(world.admin,world.employee.id);expect(after.daily_records[0].data.matrix[0].slice(0,2)).toEqual([0,0]);
 await page.getByRole('button',{name:/모바일 실적 입력/}).click();
 await dialog.getByRole('button',{name:'일반 판매',exact:true}).click();
 await dialog.getByPlaceholder('고객명을 입력해주세요').fill(name);
 await dialog.getByLabel('가입구분',{exact:true}).selectOption('0');await dialog.getByLabel('요금제군',{exact:true}).selectOption('0');
 wait=page.waitForResponse(r=>r.url().endsWith('/rpc/save_sale_atomic'));await dialog.getByRole('button',{name:'실적 등록',exact:true}).click();expect((await wait).ok()).toBe(true);await expect(dialog).toHaveCount(0);
 wait=page.waitForResponse(r=>r.url().endsWith('/rpc/delete_sale_atomic'));await page.getByRole('button',{name:'방금 등록 취소',exact:true}).click();expect((await wait).ok()).toBe(true);
 await expect.poll(async()=> (await snapshot(world.admin,world.employee.id)).customer_sales.length).toBe(0);
});
