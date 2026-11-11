import {test,expect} from '@playwright/test';
for(const width of [320,390])test(`${width}px own manager simulator saves separately and preserves unknowns`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.route('https://placeholder.supabase.co/**',route=>route.fulfill({json:route.request().url().includes('store_goals')?[]:null}));
 await page.goto('/tests/ui/evaluation.html?manager&payroll');
 await page.getByRole('button',{name:'본인 급여 가계산기',exact:true}).click();
 await expect(page.getByRole('heading',{name:'본인 급여 가계산기'})).toBeVisible();
 await expect(page.getByText('확인 필요:',{exact:false})).toBeVisible();
 await page.getByLabel('가계산 기본급 (세전·원)',{exact:true}).fill('4000000');
 await page.getByRole('button',{name:'본인 가계산 저장',exact:true}).click();
 await expect(page.getByText('본인 가계산을 저장했어요.',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'본인 급여 가계산기',exact:true}).click();
 await expect(page.getByRole('button',{name:'저장값 불러오기 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'저장값 불러오기 1',exact:true}).click();
 await expect(page.getByLabel('가계산 기본급 (세전·원)',{exact:true})).toHaveValue('4000000');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
