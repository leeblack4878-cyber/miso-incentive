import {test,expect} from '@playwright/test';
const id='00000000-0000-4000-8000-000000000001';
async function open(page,{fail=false,width=390}={}){
 await page.clock.setFixedTime(new Date('2026-10-10T03:00:00Z'));await page.setViewportSize({width,height:844});
 const profile={id,name:'본인직원',store_name:'대야점',position:'사원',role:'employee',active:true,hire_date:'2026-01-01'};
 await page.route('https://placeholder.supabase.co/**',async route=>{const u=new URL(route.request().url()),table=u.pathname.split('/').pop();
  if(table==='monthly-ranking')return route.fulfill(fail?{status:503,json:{error:'RANKING_UNAVAILABLE'}}:{json:{month:route.request().postDataJSON().month,rows:[{id,name:'본인직원',branch:'대야점',position:'사원',publicMetrics:{hs:15,home:1,free:1,smart:1,productivity:20,upsell:2}},{id:'other',name:'전체회사우수직원',branch:'상록점',position:'사원',publicMetrics:{hs:30,home:4,free:3,smart:2,productivity:40,upsell:5}}]}});
  if(table==='profiles')return route.fulfill({json:[profile]});
  if(table==='daily_records')return route.fulfill({json:[{user_id:id,work_date:'2026-10-10',data:{matrix:[[15]]}}]});
  return route.fulfill({json:[]});
 });
 await page.addLocatorHandler(page.getByRole('button',{name:'좋아요!',exact:true}),b=>b.click());await page.goto('/tests/ui/calendar.html');
}
for(const width of [320,390])test(`${width}px employee recognition uses company rows despite own-only private profile/sales`,async({page})=>{
 await open(page,{width});const hub=page.locator('section').filter({hasText:'명예의 전당 · 월간 순위'});
 await expect(hub.getByRole('button',{name:/미소 MVP.*전체회사우수직원/})).toBeVisible();
 await expect(hub.getByText('나 · 2위',{exact:true})).toBeVisible();
 await hub.getByRole('button',{name:'전체 직원 프로필 보기 ›'}).click();await page.getByRole('button',{name:/전체회사우수직원.*상록점/}).click();
 await expect(page.getByRole('dialog',{name:'직원 공개 프로필'}).getByText('30건',{exact:true})).toBeVisible();expect(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth)).toBe(true);
});
test('company ranking load failure never presents own-only first place',async({page})=>{
 await open(page,{fail:true});const hub=page.locator('section').filter({hasText:'명예의 전당 · 월간 순위'});await expect(hub.getByRole('alert')).toBeVisible();await expect(hub.getByText('나 · 1위',{exact:true})).toHaveCount(0);await expect(hub.getByText('미소 MVP',{exact:true})).toHaveCount(0);
});
