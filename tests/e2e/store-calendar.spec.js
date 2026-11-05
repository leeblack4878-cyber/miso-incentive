import {randomUUID} from 'node:crypto';
import {test,expect,result,openEmployee,date} from './fixtures.js';
test('authenticated shared schedule registers, is visible to peer but only owner can process, and retains audit',async({page,world})=>{
 const title=`E2E_calendar_${randomUUID().slice(0,8)}`;
 await openEmployee(page,world);await page.getByRole('button',{name:'OB/고객관리',exact:true}).click();
 await page.getByRole('button',{name:'＋ 매장 일정',exact:true}).click();
 const form=page.getByRole('dialog',{name:'매장 일정 등록'});await form.getByLabel('제목',{exact:true}).fill(title);await form.getByLabel('날짜',{exact:true}).fill(date);await form.getByLabel('연락·방문 메모').fill('E2E synthetic shared note');
 const saved=page.waitForResponse(r=>r.url().endsWith('/rpc/save_store_schedule')&&r.request().method()==='POST');await form.getByRole('button',{name:'일정 저장'}).click();const response=await saved;expect(response.ok(),await response.text()).toBe(true);await expect(form).toHaveCount(0);
 const own=await result(world.employee.client.rpc('read_store_calendar',{p_from:'2026-09-01',p_to:'2026-09-30'}));const event=own.events.find(e=>e.title===title);expect(event).toBeTruthy();expect(event.can_edit).toBe(true);
 const peer=await result(world.other.client.rpc('read_store_calendar',{p_from:'2026-09-01',p_to:'2026-09-30'}));expect(peer.events.find(e=>e.source_id===event.source_id).can_edit).toBe(false);
 expect((await world.other.client.rpc('save_store_schedule',{p_request_id:randomUUID(),p_id:event.source_id,p_expected_updated_at:event.updated_at,p_title:title,p_note:'forged',p_date:date,p_time:null,p_kind:'recare',p_status:'completed'})).error).toBeTruthy();
 const card=page.getByRole('article').filter({hasText:title});await expect(card).toBeVisible();await card.getByRole('button',{name:'일정 처리',exact:true}).click();const edit=page.getByRole('dialog',{name:'일정 처리'});await edit.getByLabel('처리 상태').selectOption('completed');await edit.getByRole('button',{name:'일정 저장'}).click();await expect(edit).toHaveCount(0);await expect(card.getByText('완료',{exact:true})).toBeVisible();
 const history=await result(world.employee.client.rpc('read_store_calendar_history',{p_source:'schedule',p_source_id:event.source_id}));expect(history[0].actor_id).toBe(world.employee.id);expect(history[0].assignee_id).toBe(world.employee.id);expect(history[0].is_proxy).toBe(false);
});
