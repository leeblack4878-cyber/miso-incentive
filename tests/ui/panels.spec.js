// Browser rendering and API-error UX only. Network is mocked; no Auth/RLS claims.
import {test,expect} from '@playwright/test';
async function routes(page,{failWork=false,emptyDelete=false}={}){
 await page.route('https://placeholder.supabase.co/**',async route=>{
  const url=route.request().url();const method=route.request().method();
  if(url.includes('sales_expenses'))return route.fulfill({json:method==='DELETE'?(emptyDelete?[]:[{id:'expense'}]):[{id:'expense',category:'고객 사은품',amount:33000,expense_date:'2026-09-16',customer_name:'모바일 화면 긴 고객명 검증',memo:'설치 사은품 비용'}]});
  if(failWork)return route.fulfill({status:403,json:{message:'permission denied',code:'42501'}});
  return route.fulfill({json:[]});
 });
}
test('조회 실패를 업무 0건으로 표시하지 않는다',async({page})=>{
 await routes(page,{failWork:true});await page.goto('/tests/ui/panels.html');
 await expect(page.getByRole('alert')).toContainText('불러오지 못했어요');
 await expect(page.getByRole('button',{name:'— 오늘 고객 약속 ›'})).toBeVisible();
});
test('RLS 0건 비용 삭제는 성공 문구와 합계 차감이 없다',async({page})=>{
 await routes(page,{emptyDelete:true});await page.goto('/tests/ui/panels.html');
 await page.getByRole('button',{name:/영업비용/}).click();await page.getByRole('button',{name:'삭제',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('이미 삭제됐거나 처리 권한');
 await expect(page.getByRole('button',{name:/영업비용/})).toContainText('33,000원');
 await expect(page.getByRole('status')).not.toContainText('삭제했어요');
});
for(const width of [320,390])test(`${width}px 모바일에서 정책·업무·비용 카드가 가로로 넘치지 않는다`,async({page})=>{
 await page.setViewportSize({width,height:844});await routes(page);await page.goto('/tests/ui/panels.html');
 await page.getByRole('button',{name:/영업비용/}).click();
 await expect(page.getByLabel('적용 지급기준')).toContainText('2026-09 지급기준');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
