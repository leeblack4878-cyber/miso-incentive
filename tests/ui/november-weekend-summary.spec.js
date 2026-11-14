import {test,expect} from '@playwright/test';
for(const width of [320,390])for(const unknown of [false,true])test(`${width}px own manager weekend ${unknown?'unknown':'confirmed'} amount is separate from store manager incentive`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.route('https://placeholder.supabase.co/**',route=>route.fulfill({json:route.request().url().includes('store_goals')?[]:null}));
 await page.goto(`/tests/ui/evaluation.html?manager&payroll&weekend${unknown?'&unknown':''}`);
 const card=page.getByRole('region',{name:'본인 주말 판촉비'});await expect(card).toContainText('14P');await expect(card).toContainText('점장정책 수수료와 별도');
 if(unknown){await expect(card).toContainText('확인 필요');await expect(card).not.toContainText('280,000');}else await expect(card).toContainText('280,000원');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
