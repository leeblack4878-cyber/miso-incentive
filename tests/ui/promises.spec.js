import {test,expect} from '@playwright/test';
test('320px customer auto-list, reminders, split settlement, reload and completion undo',async({page})=>{
 await page.setViewportSize({width:320,height:844});let tasks=[],posts=0;
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),name=new URL(req.url()).pathname.split('/').pop();
  if(name==='customers')return route.fulfill({json:[{id:'customer1',customer_name:'약속 점검 고객',last_sale_date:'2026-09-19'}]});
  if(name==='customer_tasks'){
   if(req.method()==='POST'){posts++;tasks=[{...req.postDataJSON(),id:'task1',updated_at:'2026-09-19T00:00:00Z'}];return route.fulfill({json:{id:'task1'}});}
   if(req.method()==='PATCH'){tasks=tasks.map(t=>({...t,...req.postDataJSON()}));return route.fulfill({json:[{id:'task1'}]});}
   return route.fulfill({json:tasks});
  }
  return route.fulfill({json:[]});
 });
 await page.goto('/tests/ui/promises.html');
 await page.getByRole('button',{name:'둘 다',exact:true}).click();await expect(page.getByRole('button',{name:'둘 다',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'93일 뒤 확인',exact:true}).click();await expect(page.getByRole('button',{name:'93일 뒤 확인',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('약속관리 고객').selectOption('customer1');await page.getByRole('button',{name:'+ 선택 고객 약속 추가'}).click();
 const dialog=page.getByRole('dialog',{name:'고객 약속 편집'});
 await dialog.getByLabel('예상금액',{exact:true}).fill('320000');await dialog.getByLabel('실제금액',{exact:true}).fill('300000');
 await dialog.getByLabel('처리 방식 1',{exact:true}).selectOption('위약금 수납');await dialog.getByLabel('처리 금액 1',{exact:true}).fill('100000');
 await dialog.getByRole('button',{name:'+ 처리 방식 추가'}).click();await dialog.getByLabel('처리 금액 2',{exact:true}).fill('200000');
 await dialog.getByLabel('처리 완료일',{exact:true}).fill('2026-09-19');
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog.getByRole('button',{name:'저장 후 처리완료'}).click();await expect(dialog).toHaveCount(0);expect(posts).toBe(1);
 await expect(page.getByText('300,000원',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('300,000원',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'완료·취소',exact:true}).click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'완료 취소',exact:true}).click();
 await expect(page.getByText('완료 0건 · 예상금액 0원 · 미처리 전체 1건')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
