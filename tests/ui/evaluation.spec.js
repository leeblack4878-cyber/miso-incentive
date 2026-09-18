import {test,expect} from '@playwright/test';
// UI with mocked API; actual wire guards are exercised in evaluationBasis.test.js.
async function setup(page,{loadError=false,saveError=false}={}){
 await page.clock.install({time:new Date('2026-09-18T03:00:00Z')});
 const row={month:'2026-09',store_name:'신천동_삼미시장점',verified_metrics:{hs:0},external_inputs:{companyAsOfDate:'2026-09-16'},verified_at:'2026-09-17T10:00:00Z'};
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const req=route.request(),url=req.url();
  if(url.includes('manager_eval_monthly')){
   if(loadError||saveError&&req.method()!=='GET')return route.fulfill({status:403,json:{code:'42501',message:'permission denied'}});
   if(req.method()!=='GET')Object.assign(row,req.postDataJSON());
   return route.fulfill({json:row});
  }
  if(url.includes('aa_impact_monthly'))return route.fulfill({json:null});
  return route.fulfill({json:[]});
 });
 await page.goto('/tests/ui/evaluation.html');
}
test('basis switch preserves company zero, shows missing inputs, and persists selection',async({page})=>{
 await setup(page);
 await expect(page.getByText('적용 중: 직원입력기준')).toBeVisible();
 await page.getByRole('button',{name:'회사입력기준',exact:true}).click();
 await expect(page.getByText('확인 대기',{exact:true})).toBeVisible();
 await page.getByText('직원·회사 실적 대조',{exact:true}).click();
 await expect(page.getByTestId('evaluation-compare-hs')).toContainText('적용 0건');
 await expect(page.getByTestId('evaluation-compare-home')).toContainText('적용 미입력');
 await page.getByRole('button',{name:'이 기준으로 적용',exact:true}).click();
 await expect(page.getByText('적용 중: 회사입력기준')).toBeVisible();
});
test('failed read blocks scores and failed save preserves applied basis',async({page})=>{
 await setup(page,{loadError:true});await expect(page.getByRole('alert')).toContainText('점수 계산을 보류');
 await page.unrouteAll({behavior:'wait'});await setup(page,{saveError:true});
 await page.getByRole('button',{name:'회사입력기준',exact:true}).click();
 await page.getByRole('button',{name:'이 기준으로 적용',exact:true}).click();
 await expect(page.getByText('적용 중: 직원입력기준')).toBeVisible();
 await expect(page.getByRole('button',{name:'이 기준으로 적용',exact:true})).toBeEnabled();
});
test('320px comparison and company input form fit without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:320,height:844});await setup(page);
 await page.getByText('직원·회사 실적 대조',{exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'목표·실적 최신화',exact:true}).click();
 await expect(page.getByLabel('회사 실적 기준일')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
