import {NOVEMBER_SPECIAL_SALES} from './novemberPolicy.js';
export const NOVEMBER_WEEKEND={start:'2026-11-13',end:'2026-11-16',tiers:[[5,10000],[8,13000],[11,16000],[14,20000],[17,23000],[20,25000]]};
export const inNovemberWeekend=date=>typeof date==='string'&&date>=NOVEMBER_WEEKEND.start&&date<=NOVEMBER_WEEKEND.end;
const active=r=>!r.team_only&&!r.deleted&&!r.source_meta?.deleted&&!r.source_meta?.cancelled&&!r.source_meta?.teamOnly&&!['cancelled','deleted'].includes(r.status);
const conflictsInPeriod=(rows,dateOf)=>{
 const seen=new Map(),ids=new Set();for(const row of rows){if(!row.id)continue;const old=seen.get(row.id);if(old&&JSON.stringify(old)!==JSON.stringify(row)&&(inNovemberWeekend(dateOf(old))||inNovemberWeekend(dateOf(row))))ids.add(row.id);seen.set(row.id,row);}return ids;
};
export function novemberWeekendModel(meta={}){
 const policy=NOVEMBER_SPECIAL_SALES.find(p=>p.key===meta.specialPolicy?.policyId);
 const model=String(policy?.model||meta.deviceModel||meta.specialPolicy?.deviceModel||'');
 if(/S741|S26\s*FE/i.test(model))return null; // FE award scope awaits owner confirmation.
 if(/S94[278]|F(?:776|971|976)/i.test(model))return 'strategy';
 if(/아이폰|iphone|A176|A185|A165|M140/i.test(model)||['A176','A185','M140'].includes(meta.baseModel))return 'general';
 return ['general','strategy'].includes(meta.weekendModelKind)?meta.weekendModelKind:null;
}
export function novemberWeekendMobile(sales=[]){
 const bad=conflictsInPeriod(sales,r=>String(r.sale_date||r.source_meta?.saleDate||'').slice(0,10));
 const users=new Set(),seen=new Map(),pendingSales=[],counts={general:0,strategy:0,bundle:0};let pendingCount=bad.size,hsCount=0;
 for(const row of sales){const m=row.source_meta||{},date=String(row.sale_date||m.saleDate||'').slice(0,10);
  if(!inNovemberWeekend(date)||!active(row)||(row.source_type&&!['mobile','daily'].includes(row.source_type)))continue;
  if(bad.has(row.id))continue;
  if(!row.id){pendingCount++;continue;}
  if(row.user_id)users.add(row.user_id);
  if(row.id&&seen.has(row.id)){if(seen.get(row.id)!==JSON.stringify(row))pendingCount++;continue;}if(row.id)seen.set(row.id,JSON.stringify(row));
  if(!Number.isInteger(m.ri)||m.ri<0||m.ri>7){pendingCount++;continue;}
  if(!Array.isArray(m.bundle2ndKeys)){pendingCount++;}else {const keys=new Set(m.bundle2ndKeys);counts.bundle+=keys.size;if(keys.size!==m.bundle2ndKeys.length)pendingCount++;}
  if(m.secondOnlyBundle||m.ri>5)continue;
  hsCount++;
  // HS includes SIM MNP under the existing confirmed definition.
  const kind=m.ri===5?'general':novemberWeekendModel(m);
  if(kind)counts[kind]++;else {pendingCount++;pendingSales.push({id:row.id,date,customer:row.customers?.customer_name||'고객명 확인 필요',reason:'주말 모델 분류 확인 필요'});}
 }
 pendingCount+=users.size>1?1:0;
 return {points:counts.general+counts.strategy*3+counts.bundle*2,counts,hsCount,bundleCount:counts.bundle,pendingCount,pendingSales};
}
export function novemberWeekendHome(orders=[]){
 const bad=conflictsInPeriod(orders,r=>String(r.actual_install_date||'').slice(0,10));
 const users=new Set(),seen=new Map(),rows=[],counts={home:0,free:0,smart:0};let pendingCount=bad.size;
 for(const row of orders){if(!active(row)||bad.has(row.id))continue;
  const date=String(row.actual_install_date||'').slice(0,10);
  if(row.status==='completed'&&!/^20\d{2}-\d{2}-\d{2}$/.test(date)&&String(row.source_work_date||'').startsWith('2026-11')){pendingCount++;continue;}
  if(row.status!=='completed'||!inNovemberWeekend(date))continue;
  if(row.user_id)users.add(row.user_id);
  if(!row.id){pendingCount++;continue;}
  if(seen.has(row.id)){if(seen.get(row.id)!==JSON.stringify(row))pendingCount++;continue;}seen.set(row.id,JSON.stringify(row));rows.push(row);
 }
 const physical=new Set(rows.filter(r=>['internet100','internet500','internet1g'].includes(r.product_type)).map(r=>JSON.stringify([r.user_id,r.customer_id,r.source_work_date,r.network_type])));
 for(const r of rows){if(['internet100','internet500','internet1g'].includes(r.product_type))counts.home++;
  else if(r.product_type==='homeOnly'){if(!r.customer_id)pendingCount++;else if(!physical.has(JSON.stringify([r.user_id,r.customer_id,r.source_work_date,r.network_type])))counts.home++;}
  else if(r.product_type==='tvFree')counts.free++;else if(r.product_type==='smartHome')counts.smart++;
 }
 pendingCount+=users.size>1?1:0;
 return {points:counts.home*2+counts.free+counts.smart,counts,pendingCount,recordCount:orders.filter(r=>inNovemberWeekend(String(r.source_work_date||'').slice(0,10))||inNovemberWeekend(String(r.actual_install_date||'').slice(0,10))).length};
}
export function calculateNovemberWeekendGrade(mobile,home,{expectedHs=null,expectedBundles=null,legacyHome=0}={}){
 const pendingCount=(mobile?.pendingCount||0)+(home?.pendingCount||0)+(!mobile?1:0)+(!home?1:0)
  +(mobile&&expectedHs!=null&&mobile.hsCount!==expectedHs?1:0)+(mobile&&expectedBundles!=null&&mobile.bundleCount!==expectedBundles?1:0)+(home&&home.recordCount===0&&legacyHome>0?1:0);
 const points=Number(mobile?.points||0)+Number(home?.points||0);
 const tier=NOVEMBER_WEEKEND.tiers.filter(([min])=>points>=min).at(-1);const rate=tier?.[1]||0;
 return {points,pendingCount,status:pendingCount?'확인 필요':'입력 기준',rate:pendingCount?null:rate,amount:pendingCount?null:points*rate,mobile:mobile?.counts||null,home:home?.counts||null,pendingSales:mobile?.pendingSales||[]};
}

export function novemberA176Review(sales=[]){
 return sales.filter(r=>active(r)&&String(r.sale_date||r.source_meta?.saleDate||'').slice(0,10)>='2026-11-07'&&String(r.sale_date||r.source_meta?.saleDate||'').slice(0,7)==='2026-11').flatMap(row=>{
  const m=row.source_meta||{},sp=m.specialPolicy;if(!sp||(sp.policyType||sp.policy_type)!=='additive'||NOVEMBER_SPECIAL_SALES.find(p=>p.key===sp.policyId)?.model!=='A176')return [];
  const expected=m.ri===1?50000:[2,3,4].includes(m.ri)?0:null;
  if(expected===null||Number(sp.replacementAmount||0)===expected)return [];
  return [{id:row.id,date:row.sale_date,customer:row.customers?.customer_name||'고객명 확인 필요',saved:Number(sp.replacementAmount||0),expected,reason:sp.exceptionStatus?'별도 승인금액 확인':'판매 정책 재선택·수정 저장 필요'}];
 });
}
