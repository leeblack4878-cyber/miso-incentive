import {test,expect} from '@playwright/test';
test('분리된 지급기준 화면은 저장 전 원본을 바꾸지 않고 변경값을 전달한다',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tests/ui/settings.html');
 const amount=page.getByRole('button',{name:'직급별 최저 보장금액',exact:true}).locator('..').locator('input').first();
 await expect(amount).toHaveValue('1,000');
 await amount.fill('2500');
 await expect(amount).toHaveValue('2,500');
 await expect(page.getByTestId('saved-config')).toHaveCount(0);
 await page.getByRole('button',{name:'지급 기준 저장',exact:true}).click();
 const saved=JSON.parse(await page.getByTestId('saved-config').textContent());
 expect(saved.basePay.점장).toBe(2500);expect(saved.basePay.사원).toBe(1000);
 expect(saved.matrix).toEqual(Array.from({length:8},()=>Array(6).fill(0)));
 expect(errors).toEqual([]);
});
test('분리된 권한 화면은 선택한 직원 ID와 역할만 저장한다',async({page})=>{
 const writes=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://placeholder.supabase.co/**',async route=>{
  if(route.request().method()==='PATCH')writes.push({url:route.request().url(),body:route.request().postDataJSON()});
  return route.fulfill({json:route.request().method()==='GET'?{value:[]}:[]});
 });
 await page.goto('/tests/ui/settings.html?permissions');
 await expect(page.getByRole('button',{name:'저장',exact:true})).toBeDisabled();
 await page.getByRole('combobox').selectOption('manager');
 await page.getByRole('button',{name:'저장',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(new URL(writes[0].url).searchParams.get('id')).toBe('eq.fixture-employee');
 expect(writes[0].body).toEqual({role:'manager'});
 expect(errors).toEqual([]);
});
