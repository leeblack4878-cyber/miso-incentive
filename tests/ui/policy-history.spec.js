import {test,expect} from '@playwright/test';
async function open(page,actor='admin'){
 await page.clock.setFixedTime(new Date('2026-10-01T01:00:00Z'));
 await page.route('https://placeholder.supabase.co/**',async route=>route.fulfill({json:[]}));
 await page.goto(`/tests/ui/calendar.html?actor=${actor}`);
 await page.getByRole('button',{name:'관리자',exact:true}).click();
 await page.getByRole('button',{name:'관리 설정',exact:true}).click();
}
for(const width of [320,390])test(`${width}px 정책 히스토리: 월 선택과 세부 변경`,async({page})=>{
 await page.setViewportSize({width,height:844});await open(page);
 await page.getByRole('button',{name:'정책 히스토리',exact:true}).click();
 const panel=page.getByRole('region',{name:'정책 히스토리'});
 await expect(panel.getByText('SIM MNP 115군: 8만원 → 9만원')).toBeVisible();
 await panel.getByText('세부 변경 5개',{exact:true}).click();
 await expect(panel.getByText(/6개월 미만 단기기변은 실적 입력 대상/)).toBeVisible();
 await panel.getByLabel('정책 이력 월').selectOption('2026-09');
 await expect(panel.getByText('10월 기본 정책',{exact:true})).toHaveCount(0);
 await expect(panel.getByText('애플워치·건별 금액 정정',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===390)await page.screenshot({path:'/tmp/miso-policy-history.png',fullPage:true});
});
test('매장 관리자에게 지급기준 관리 범위의 이력 메뉴를 노출하지 않는다',async({page})=>{
 await open(page,'manager');
 await expect(page.getByRole('button',{name:'정책 히스토리',exact:true})).toHaveCount(0);
});
