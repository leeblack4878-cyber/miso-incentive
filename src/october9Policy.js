// Confirmed notices for October 9–12. Customer support is never employee pay.
export const OCTOBER9_START='2026-10-09';
export const OCTOBER9_END='2026-10-12';
const models=[
 ['A176',0,0],
 ...['S942-256/512','S947-256/512','S948-256/512'].map(model=>[model,500000,300000]),
 ['S741',0,300000],
 ...['F776-512','F971-256','F976-256'].map(model=>[model,600000,400000]),
 ...['F776-256','F971-512','F976-512'].map(model=>[model,400000,200000]),
 ['아이폰18 프로/프로맥스 (용량 무관)',350000,200000],
];
export const OCTOBER9_SPECIAL_SALES=models.flatMap(([model,mnp,change],i)=>
 [['MNP',mnp],['기기변경',change]].map(([saleType,customerDiscount],j)=>({
  key:`oct9_weekend_${i}_${j}`,model:`10/9~12 주말 · ${model}`,deviceModel:model,saleType,
  customerDiscount,customerZeroPrice:model==='A176'||model==='S741'&&saleType==='MNP',
  additionalAmount:0,policyType:'incentive_unpaid',weekend:true,
  requiredStrategicPoints:model==='A176'?null:2,startDate:OCTOBER9_START,endDate:OCTOBER9_END,
  policyVersion:'2026-10-09-weekend',
  conditionLabel:model==='A176'?'일반55군/시니어·주니어47군 이상 · 교보sam 또는 V컬러링 패키지 + 보험 · 요금제6개월·전략상품/보험93일 유지':'115군 이상(청소년85 인정) · 전략P2P 이상 · 요금제6개월·전략상품93일 유지',
 })));
