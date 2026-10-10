import {test,expect,result,openEmployee} from './fixtures.js';
test('employee receives company ranking metrics while private peer records stay protected',async({page,world})=>{
 const date='2026-09-16';
 for(const [actor,n] of [[world.employee,15],[world.other,40]])await result(actor.client.from('daily_records').insert({user_id:actor.id,work_date:date,data:{matrix:[[n]]}}));
 expect(await result(world.employee.client.from('daily_records').select('*').eq('user_id',world.other.id))).toHaveLength(0);
 const {data,error}=await world.employee.client.functions.invoke('monthly-ranking',{body:{month:'2026-09'}});expect(error).toBeFalsy();
 const me=data.rows.find(r=>r.id===world.employee.id),other=data.rows.find(r=>r.id===world.other.id);expect(me.publicMetrics.hs).toBe(15);expect(other.publicMetrics.hs).toBe(40);expect(other.name).toBe(world.other.profile.name);
 expect(Object.keys(other).sort()).toEqual(['id','name','branch','position','publicMetrics'].sort());
 const bad=await world.employee.client.functions.invoke('monthly-ranking',{body:{month:'2026-09',userId:world.other.id}});expect(bad.error).toBeTruthy();
 await openEmployee(page,world);await page.locator('.app-bottom-nav').getByRole('button',{name:'홈',exact:true}).click();await page.getByRole('button',{name:'전체 직원 프로필 보기 ›'}).click();await page.getByRole('button',{name:new RegExp(world.other.profile.name+'.*'+world.other.profile.store_name)}).click();await expect(page.getByRole('dialog',{name:'직원 공개 프로필'}).getByText('40건',{exact:true})).toBeVisible();
});
