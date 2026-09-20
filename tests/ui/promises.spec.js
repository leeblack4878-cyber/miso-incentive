import {test,expect} from '@playwright/test';
test('320px customer auto-list, reminders, split settlement, reload and completion undo',async({page})=>{
 await page.setViewportSize({width:320,height:844});let tasks=[],posts=0;
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),name=new URL(req.url()).pathname.split('/').pop();
  if(name==='customer_sales')return route.fulfill({json:[{id:'sale1',customer_id:'customer1',sale_date:'2026-09-19',source_type:'mobile'}]});
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
 await page.getByLabel('약속관리 고객').selectOption('sale:sale1');await page.getByRole('button',{name:'+ 선택 고객 약속 추가'}).click();
 const dialog=page.getByRole('dialog',{name:'고객 약속 편집'});
 await dialog.getByLabel('예상금액',{exact:true}).fill('320000');await dialog.getByLabel('실제금액',{exact:true}).fill('300000');
 await dialog.getByLabel('처리 방식 1',{exact:true}).selectOption('위약금 수납');await dialog.getByLabel('처리 금액 1',{exact:true}).fill('100000');
 await dialog.getByRole('button',{name:'+ 처리 방식 추가'}).click();await dialog.getByLabel('처리 금액 2',{exact:true}).fill('200000');
 await dialog.getByLabel('처리 완료일',{exact:true}).fill('2026-09-19');
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await dialog.getByRole('button',{name:'저장 후 처리완료'}).click();await expect(dialog).toHaveCount(0);expect(posts).toBe(1);expect(tasks[0].task_meta.sale_reference.id).toBe('sale1');
 await page.locator('summary').filter({hasText:'월별 중고폰 처리금액'}).click();await expect(page.getByText('300,000원',{exact:true})).toBeVisible();
 await page.reload();await page.locator('summary').filter({hasText:'월별 중고폰 처리금액'}).click();await expect(page.getByText('300,000원',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'완료·취소',exact:true}).click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'완료 취소',exact:true}).click();
 await expect(page.getByText('완료 0건 · 예상금액 0원 · 미처리 전체 1건')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('deleted empty customers hidden, pending retained and history accessible',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 const customers=['empty','sale','pending','closed'].map(id=>({id,customer_name:id}));
 await page.route('https://placeholder.supabase.co/**',route=>{
  const table=new URL(route.request().url()).pathname.split('/').pop();
  const rows=table==='customers'?customers:table==='customer_sales'?[{id:'s',customer_id:'sale',sale_date:'2026-09-19',source_type:'mobile'}]:table==='customer_tasks'?[
   {id:'p',customer_id:'pending',task_type:'custom',title:'남은 약속',status:'pending',base_date:'2026-09-19',due_date:'2026-09-19'},
   {id:'c',customer_id:'closed',task_type:'custom',title:'과거 약속',status:'completed',base_date:'2026-09-19',due_date:'2026-09-19'}
  ]:[];
  return route.fulfill({json:rows});
 });
 await page.goto('/tests/ui/promises.html');
 const options=page.getByLabel('약속관리 고객').locator('option');
 await expect(options).toHaveCount(3);await expect(options).not.toContainText(['empty']);
 await page.getByRole('button',{name:'완료·취소',exact:true}).click();
 await expect(options).toHaveCount(4);
 await page.getByLabel('약속관리 고객').selectOption('legacy:closed');
 await expect(page.getByText('closed · 과거 약속',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'전체 예정',exact:true}).click();
 await expect(page.getByLabel('약속관리 고객')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('month groups distinguish namesakes and home sales; promise is scoped to selected sale',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 const sales=[{id:'sep1',customer_id:'same',sale_date:'2026-09-19',source_type:'mobile',metric_label:'기기변경'},{id:'sep2',customer_id:'same',sale_date:'2026-09-03',source_type:'mobile',metric_label:'MNP'},{id:'aug',customer_id:'same',sale_date:'2026-08-25',source_type:'home_order',metric_label:'인터넷+TV'}];
 await page.route('https://placeholder.supabase.co/**',route=>{const table=new URL(route.request().url()).pathname.split('/').pop();return route.fulfill({json:table==='customers'?[{id:'same',customer_name:'김민수'}]:table==='customer_sales'?sales:table==='customer_tasks'?[{id:'a',customer_id:'same',source_sale_id:'sep1',task_type:'plan93',status:'pending',title:'첫 판매 안내',due_date:'2026-12-21'},{id:'b',customer_id:'same',source_sale_id:'sep2',task_type:'plan93',status:'pending',title:'둘째 판매 안내',due_date:'2026-12-05'}]:[]});});
 await page.goto('/tests/ui/promises.html');
 await expect(page.getByLabel('고객 입력 월')).toHaveValue('2026-09');
 const choices=page.getByLabel('약속관리 고객');await expect(choices.locator('option')).toHaveCount(3);
 await choices.selectOption('sale:sep1');await expect(page.getByText('김민수 · 첫 판매 안내',{exact:true})).toBeVisible();await expect(page.getByText('김민수 · 둘째 판매 안내',{exact:true})).toHaveCount(0);
 await page.getByLabel('고객 입력 월').selectOption('2026-08');await expect(choices.locator('option')).toHaveCount(2);await expect(choices.locator('option').last()).toContainText('김민수 · 2026.08.25');
 await page.getByLabel('판매 고객명 검색').fill('없는고객');await expect(choices.locator('option')).toHaveCount(1);
 await page.getByLabel('판매 고객명 검색').fill('김민수');await page.getByLabel('고객 입력 월').selectOption('all');await expect(choices.locator('optgroup')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
