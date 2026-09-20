import {test,expect} from '@playwright/test';
test('320px employee request requires approval and typed confirmation',async({page})=>{
 await page.setViewportSize({width:320,height:844});let rows=[],calls=[];
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').pop();
  if(url.pathname.includes('/rpc/')){calls.push({name,args:route.request().postDataJSON()});if(name==='request_performance_reset')rows=[{id:'r',user_id:'employee',month:'2026-09',reason:'오입력 수정 필요',status:'pending'}];return route.fulfill({json:'r'});}
  return route.fulfill({json:rows});
 });
 await page.goto('/tests/ui/reset.html');await page.getByLabel('초기화 사유',{exact:true}).fill('오입력 수정 필요');
 await page.getByRole('button',{name:'관리자 승인 요청',exact:true}).click();
 await expect(page.getByText('승인 대기',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'승인된 실적 초기화 실행'})).toHaveCount(0);
 expect(calls.map(c=>c.name)).toEqual(['request_performance_reset']);
 rows[0]={...rows[0],status:'approved',expires_at:'2099-09-21T00:00:00Z'};
 await page.getByRole('button',{name:'상태 새로고침'}).click();
 const execute=page.getByRole('button',{name:'승인된 실적 초기화 실행'});await expect(execute).toBeDisabled();
 await page.getByLabel('초기화 확인 문구').fill('당월실적초기화');await expect(execute).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/miso-reset-employee.png',fullPage:true});
 await execute.click();await expect.poll(()=>calls.map(c=>c.name)).toContain('reset_my_month_performance');
});
test('admin review does not execute reset and own request cannot be approved',async({page})=>{
 await page.setViewportSize({width:320,height:844});let calls=[];let rows=[{id:'r',user_id:'employee',month:'2026-09',reason:'잘못 입력된 실적',status:'pending'},{id:'own',user_id:'manager',month:'2026-09',reason:'관리자 본인 요청',status:'pending'}];
 await page.route('https://placeholder.supabase.co/**',route=>{
  const url=new URL(route.request().url()),name=url.pathname.split('/').pop();
  if(url.pathname.includes('/rpc/')){calls.push({name,args:route.request().postDataJSON()});rows[0].status='approved';return route.fulfill({json:null});}
  return route.fulfill({json:rows});
 });
 await page.goto('/tests/ui/reset.html?admin');await expect(page.getByText('본인 요청은 승인할 수 없어요.')).toBeVisible();
 await expect(page.getByRole('button',{name:'승인',exact:true})).toHaveCount(1);
 await page.getByLabel('초기화 처리 메모').fill('확인했습니다');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/miso-reset-admin.png',fullPage:true});
 await page.getByRole('button',{name:'승인',exact:true}).click();await expect(page.getByText('승인 완료',{exact:true})).toBeVisible();
 expect(calls).toEqual([{name:'review_performance_reset',args:{p_request_id:'r',p_approve:true,p_note:'확인했습니다'}}]);
});
