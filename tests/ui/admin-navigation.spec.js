import {test,expect} from '@playwright/test';

const labels=['오늘의 운영','실적','OB/고객관리','평가·급여','비용·승인','관리 설정'];
async function open(page,actor='admin'){
 const id=actor==='admin'?'a50a0979-acef-40b1-98b7-f05074f1c835':actor==='area'?'471280af-a046-4d25-a27d-63a0c5978403':'00000000-0000-4000-8000-000000000001';
 const profile={id,name:'메뉴검증',store_name:'대야동_롯데마트점',position:actor==='admin'?'대표':actor==='area'?'담당':actor==='manager'?'점장':'사원',role:actor==='admin'?'admin':actor==='employee'?'employee':'manager',active:true,status:'approved',hire_date:'2026-01-01'};
 await page.clock.setFixedTime(new Date('2026-11-05T03:00:00Z'));
 await page.route('https://placeholder.supabase.co/**',route=>{
  const request=route.request(),table=new URL(request.url()).pathname.split('/').pop();
  return route.fulfill({json:table==='profiles'?(request.headers().accept?.includes('vnd.pgrst.object')?profile:[profile]):[]});
 });
 await page.addLocatorHandler(page.getByRole('button',{name:'좋아요!',exact:true}),b=>b.click());
 await page.goto(`/tests/ui/calendar.html?actor=${actor}`);
 if(actor!=='employee')await page.getByRole('button',{name:'관리자',exact:true}).click();
}
for(const width of [320,390,768])for(const actor of ['admin','manager','area'])test(`${actor} ${width}px six bottom sections fit and preserve role menus`,async({page})=>{
 await page.setViewportSize({width,height:844});await open(page,actor);
 const nav=page.getByRole('navigation',{name:'관리자 주요 메뉴'});
 await expect(nav).toBeVisible();await expect(nav.getByRole('button')).toHaveCount(6);
 for(const label of labels){
  const button=nav.getByRole('button',{name:label,exact:true});await button.click();await expect(button).toHaveAttribute('aria-current','page');
  expect(await button.evaluate(el=>{
   const b=el.getBoundingClientRect();
   const visible=[...el.querySelectorAll('span')].filter(x=>x.getClientRects().length&&x.children.length===0);
   return b.width>=44&&b.height>=44&&visible.every(x=>{const r=x.getBoundingClientRect();return x.scrollWidth<=x.clientWidth+1&&r.left>=b.left-1&&r.right<=b.right+1;});
  })).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await expect(page.getByRole('button',{name:'직원 관리',exact:true})).toBeVisible();
 if(actor!=='admin'){
  await expect(page.getByRole('button',{name:'지급기준 관리',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'권한 관리',exact:true})).toHaveCount(0);
 }else await expect(page.getByRole('button',{name:'지급기준 관리',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'OB/고객관리',exact:true}).click();
 await expect(page.getByRole('button',{name:'고객 관리',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'홈 케어',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'OB 활동',exact:true}).click();await expect(page.getByRole('button',{name:'OB 활동',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'고객 약속',exact:true}).click();
 await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
 const box=await nav.boundingBox();expect(box.y+box.height).toBeCloseTo(844,0);
 expect(await page.locator('.admin-content').evaluate(el=>parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThanOrEqual(box.height);
 await page.getByRole('button',{name:'직원',exact:true}).click();await expect(nav).toHaveCount(0);
 await expect(page.locator('.app-bottom-nav').getByRole('button')).toHaveCount(5);
 await expect(page.locator('.app-bottom-nav').getByRole('button',{name:'OB/고객관리',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'관리자',exact:true}).click();await expect(nav).toBeVisible();await expect(nav.getByRole('button',{name:'OB/고객관리',exact:true})).toHaveAttribute('aria-current','page');
});
test('bottom navigation supports keyboard, history and existing favorites',async({page})=>{
 await open(page);const nav=page.getByRole('navigation',{name:'관리자 주요 메뉴'});
 await nav.getByRole('button',{name:'실적',exact:true}).focus();await page.keyboard.press('Enter');await expect(nav.getByRole('button',{name:'실적',exact:true})).toHaveAttribute('aria-current','page');
 await page.keyboard.press('Tab');await expect(nav.getByRole('button',{name:'OB/고객관리',exact:true})).toBeFocused();await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'고객 관리 즐겨찾기 추가',exact:true}).click();
 await nav.getByRole('button',{name:'비용·승인',exact:true}).click();
 await page.goBack();await expect(nav.getByRole('button',{name:'OB/고객관리',exact:true})).toHaveAttribute('aria-current','page');
 await page.goForward();await expect(nav.getByRole('button',{name:'비용·승인',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'고객 관리',exact:true}).click();await expect(nav.getByRole('button',{name:'OB/고객관리',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'고객 관리 즐겨찾기 해제',exact:true}).click();
});
test('employee cannot access admin navigation',async({page})=>{
 await open(page,'employee');await expect(page.getByRole('button',{name:'관리자',exact:true})).toHaveCount(0);await expect(page.getByRole('navigation',{name:'관리자 주요 메뉴'})).toHaveCount(0);
});
