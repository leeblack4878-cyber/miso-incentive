import {randomUUID} from 'node:crypto';
import {test,expect,result,openEmployee,snapshot} from './fixtures.js';
test('actual Auth OB UI append, retry, customer history and other-employee isolation',async({page,world})=>{
 const actor=world.employee;const name=`E2E_OB_${randomUUID().slice(0,6)}`;
 expect(await result(world.admin.from('ob_contact_logs').select('id').in('user_id',[actor.id,world.other.id]))).toHaveLength(0);
 const before=await snapshot(world.admin,actor.id);
 try{
  await openEmployee(page,world);await page.getByRole('button',{name:'고객관리',exact:true}).click();await page.getByRole('button',{name:'OB 활동',exact:true}).click();
  await page.getByRole('button',{name:'＋ OB 활동 기록',exact:true}).click();const dialog=page.getByRole('dialog',{name:'OB 활동 기록'});
  await dialog.getByLabel('가입번호 · 필수').fill('e2e ob 001');await dialog.getByLabel('고객명 · 필수').fill(name);await dialog.getByLabel('연락처 · 필수').fill('010-0000-0001');await dialog.getByLabel('통화 결과',{exact:true}).selectOption('통화 완료');await dialog.getByLabel('고객 반응',{exact:true}).selectOption('재연락 희망');await dialog.getByLabel('내용 · 선택').fill('E2E first contact');
  const response=page.waitForResponse(r=>r.url().endsWith('/rpc/append_ob_contact')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'기록 저장',exact:true}).click();const saved=await response;expect(saved.ok(),await saved.text()).toBe(true);await expect(dialog).toHaveCount(0);
  const body=saved.request().postDataJSON();await result(actor.client.rpc('append_ob_contact',body));
  let rows=await result(world.admin.from('ob_contact_logs').select('*').eq('user_id',actor.id));expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({subscription_number:'E2EOB001',user_id:actor.id,employee_name:actor.profile.name,store_name:actor.profile.store_name,phone:'01000000001'});
  expect(await result(world.other.client.from('ob_contact_logs').select('*').eq('subscription_number','E2EOB001'))).toHaveLength(0);
  expect((await actor.client.from('ob_contact_logs').update({store_name:'forged'}).eq('id',rows[0].id)).error).toBeTruthy();
  expect((await actor.client.rpc('append_ob_contact',{...body,p_request_id:randomUUID(),p_reaction:null})).error).toBeTruthy();
  await page.getByLabel('OB 조회 날짜').fill(rows[0].contact_date);await page.getByRole('button',{name:new RegExp(name)}).click();let history=page.getByRole('dialog',{name:'고객 접촉 히스토리'});await expect(history.getByText('E2E first contact',{exact:true})).toBeVisible();await expect(history.getByRole('link',{name:'☎ 전화하기'})).toHaveAttribute('href','tel:01000000001');
  await history.getByRole('button',{name:'＋ 활동 추가',exact:true}).click();await expect(dialog.getByLabel('가입번호 · 필수')).toHaveValue('E2EOB001');await dialog.getByLabel('통화 결과',{exact:true}).selectOption('부재');await dialog.getByLabel('내용 · 선택').fill('E2E second contact');await dialog.getByRole('button',{name:'기록 저장',exact:true}).click();await expect(dialog).toHaveCount(0);
  rows=await result(actor.client.from('ob_contact_logs').select('*').eq('subscription_number','E2EOB001'));expect(rows).toHaveLength(2);expect(rows.filter(r=>r.call_result==='통화 완료')).toHaveLength(1);expect(rows.find(r=>r.call_result==='부재').reaction).toBe(null);
  await page.getByRole('button',{name:new RegExp(name)}).first().click();history=page.getByRole('dialog',{name:'고객 접촉 히스토리'});await expect(history.getByText('E2E first contact',{exact:true})).toBeVisible();await expect(history.getByText('E2E second contact',{exact:true})).toBeVisible();
  expect(await snapshot(world.admin,actor.id)).toEqual(before);
 }finally{
  await result(world.admin.from('ob_contact_logs').delete().in('user_id',[actor.id,world.other.id]));expect(await result(world.admin.from('ob_contact_logs').select('id').in('user_id',[actor.id,world.other.id]))).toHaveLength(0);
 }
});
