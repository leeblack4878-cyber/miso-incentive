import {test,expect} from '@playwright/test';

test('운영진은 매장 추가 없이 직원 소속으로 저장·재편집·필터할 수 있다',async({page})=>{
  const branch='대야동_롯데마트점',id='00000000-0000-4000-8000-000000000001';
  const profiles=[{id,name:'소속검증직원',store_name:branch,position:'사원',role:'employee',active:true,hire_date:'2026-08'},
    {id:'a50a0979-acef-40b1-98b7-f05074f1c835',name:'조회관리자',store_name:'운영진',position:'대표',role:'admin',active:true,hire_date:'2026-01'}];
  const writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-27T03:00:00Z'));
  await page.route('https://placeholder.supabase.co/**',async route=>{
    const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').pop();
    if(['PATCH','POST','DELETE'].includes(req.method()))writes.push({table,body:req.postDataJSON(),id:u.searchParams.get('id')});
    if(table==='profiles'){
      if(req.method()==='PATCH'){Object.assign(profiles[0],req.postDataJSON());return route.fulfill({json:{id}});}
      return route.fulfill({json:profiles});
    }
    if(table==='app_config'&&u.searchParams.get('config_key')==='eq.stores')return route.fulfill({json:{value:[branch]}});
    return route.fulfill({json:[]});
  });
  await page.addLocatorHandler(page.getByRole('button',{name:'좋아요!',exact:true}),b=>b.click());
  await page.goto('/tests/ui/calendar.html?actor=admin');
  await page.getByRole('button',{name:'관리자',exact:true}).click();
  await page.getByRole('button',{name:'직원 관리',exact:true}).click();
  const employee=()=>page.getByText('소속검증직원 · 사원',{exact:true}).locator('..').locator('..');
  await employee().getByRole('button',{name:'수정',exact:true}).click();
  const picker=page.getByLabel('직원 소속 수정');
  await expect(picker.locator('optgroup[label="소속 그룹"] option[value="운영진"]')).toHaveCount(1);
  await expect(picker.locator('optgroup[label="매장"] option[value="운영진"]')).toHaveCount(0);
  await picker.selectOption('운영진');await page.getByRole('button',{name:'저장',exact:true}).click();
  await expect(employee()).toContainText('운영진');
  expect(writes.filter(r=>r.table==='profiles')).toEqual([{table:'profiles',id:`eq.${id}`,body:{name:'소속검증직원',store_name:'운영진',position:'사원',hire_date:'2026-08'}}]);
  expect(writes.some(r=>r.table==='app_config'&&r.body?.config_key==='stores')).toBe(false);
  await page.getByLabel('직원 소속 필터').selectOption('운영진');await expect(employee()).toBeVisible();
  await employee().getByRole('button',{name:'수정',exact:true}).click();await expect(picker).toHaveValue('운영진');
  await page.getByRole('button',{name:'취소',exact:true}).click();
  await page.getByLabel('직원 소속 필터').selectOption(branch);await expect(employee()).toHaveCount(0);
  expect(errors).toEqual([]);
});
