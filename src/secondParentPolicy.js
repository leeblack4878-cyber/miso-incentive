// October owner clarification: only the child sale belongs to this month.
export const PREVIOUS_SECOND_PARENTS = [
  {key:'galaxy_s',label:'갤럭시 S 시리즈 (FE 제외)',apple:false},
  {key:'galaxy_foldable',label:'갤럭시 폴더블',apple:false},
  {key:'iphone18_pro',label:'아이폰18 프로',apple:true},
  {key:'iphone18_pro_max',label:'아이폰18 프로맥스',apple:true},
];
export const CURRENT_SECOND_PARENTS = [...PREVIOUS_SECOND_PARENTS,{key:'iphone_other',label:'아이폰14~18 기타 모델 (에어 포함)',apple:true}];
export const isSecondOnlyBundle = (meta={}) => meta.secondOnlyBundle===true && meta.ri===7;
export const secondParentCi = (meta={}) => isSecondOnlyBundle(meta)?meta.secondParent?.ci:meta.ci;
export function previousMonthBounds(saleDate) {
  const match=/^(\d{4})-(\d{2})-\d{2}$/.exec(saleDate||'');
  if(!match||Number(match[2])<1||Number(match[2])>12)return null;
  const year=Number(match[1]),month=Number(match[2]);
  const end=new Date(Date.UTC(year,month-1,0)).toISOString().slice(0,10);
  return {start:`${end.slice(0,7)}-01`,end};
}
export function validatePreviousSecond({saleDate,parent={},bundleKeys=[]}={}) {
  if(String(saleDate).slice(0,7)<'2026-10')return '전월 모단말 2ND는 10월 정책부터 적용해요.';
  const sameMonth=String(parent.date).slice(0,7)===String(saleDate).slice(0,7);
  const model=(sameMonth?CURRENT_SECOND_PARENTS:PREVIOUS_SECOND_PARENTS).find(x=>x.key===parent.model);
  if(!model)return '판매월에 인정되는 모단말 모델을 선택해주세요.';
  const bounds=previousMonthBounds(saleDate),date=parent.date||'';
  if(!bounds||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<bounds.start||date>saleDate||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)return '모단말 판매일은 전월 또는 이번 달 2ND 판매일 이전 날짜로 입력해주세요.';
  if(!Number.isInteger(parent.ci)||parent.ci<0||parent.ci>5)return '모단말 요금제군을 선택해주세요.';
  if(!bundleKeys.length||bundleKeys.length>2)return '2ND 기기를 1~2개 선택해주세요.';
  if(bundleKeys.some(key=>(key==='b_AppleWatch')!==model.apple))return '모단말과 맞는 2ND 기기를 선택해주세요.';
  if(model.apple&&parent.ci!==0)return '애플워치는 모단말 115군 이상 조건을 확인해주세요.';
  return '';
}

export function validateSecondCustomer(customer,parentCustomer) {
  if(!String(parentCustomer||'').trim())return '모단말에 등록했던 고객명을 입력해주세요.';
  if(String(customer||'').trim()!==String(parentCustomer).trim())return '2ND 고객명은 모단말 고객명과 같아야 해요.';
  return '';
}
