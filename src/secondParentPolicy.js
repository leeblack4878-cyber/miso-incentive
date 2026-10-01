// October owner clarification: only the child sale belongs to this month.
export const PREVIOUS_SECOND_PARENTS = [
  {key:'galaxy_s',label:'갤럭시 S 시리즈 (FE 제외)',apple:false},
  {key:'galaxy_foldable',label:'갤럭시 폴더블',apple:false},
  {key:'iphone18_pro',label:'아이폰18 프로',apple:true},
  {key:'iphone18_pro_max',label:'아이폰18 프로맥스',apple:true},
];
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
  const model=PREVIOUS_SECOND_PARENTS.find(x=>x.key===parent.model);
  if(!model)return '전월 모단말 모델을 선택해주세요.';
  const bounds=previousMonthBounds(saleDate),date=parent.date||'';
  if(!bounds||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<bounds.start||date>bounds.end)return '모단말 판매일은 바로 전월 날짜로 입력해주세요.';
  if(!Number.isInteger(parent.ci)||parent.ci<0||parent.ci>5||parent.ci===3)return '모단말 요금제군을 선택해주세요.';
  if(!bundleKeys.length||bundleKeys.length>2)return '2ND 기기를 1~2개 선택해주세요.';
  if(bundleKeys.some(key=>(key==='b_AppleWatch')!==model.apple))return '모단말과 맞는 2ND 기기를 선택해주세요.';
  if(model.apple&&parent.ci!==0)return '애플워치는 모단말 115군 이상 조건을 확인해주세요.';
  return '';
}
