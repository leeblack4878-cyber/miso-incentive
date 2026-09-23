import {chuseokSalePay} from './chuseokPolicy.js';
import { summarizeStrategicProducts } from './strategicPoints.js';
import { calculateSeptemberBundleSale } from './septemberPolicy.js';
import { dayAfterSaleDeletion } from './saleMutations.js';

export function changeStrategicMetric(metric, meta, direction) {
  if (!metric) return null;
  const part = summarizeStrategicProducts([{source_meta:meta}]);
  return Object.fromEntries(['strategicPointsWithoutDaemyung','daemyungCount'].map(key =>
    [key, Math.max(0, Number((Number(metric[key]||0)+direction*Number(part[key]||0)).toFixed(10)))]));
}

export function mobileSaleOffsets(meta, config, september) {
  let bundleOffset=0, vasOffset=0;
  for(const key of meta.bundle2ndKeys||[]) {
    const rate=Number(config.bundle2nd?.find(x=>x.key===key)?.rate||0);
    const type=meta.bundleSaleTypeMap?.[key]||'normal';
    if(september) bundleOffset+=calculateSeptemberBundleSale({rate,saleType:type,
      insuranceJoined:!(meta.bundleVasMap?.[key]||[]).includes('vasNone'),
      parent115:Number(meta.ci)===0,isAppleWatch:key==='b_AppleWatch'}).offset;
    else if(type==='free') bundleOffset+=rate;
    else continue;
    if(!meta.bundleVasCommissionExcluded) for(const vas of meta.bundleVasMap?.[key]||[])
      vasOffset+=Number(config.vas?.find(x=>x.key===vas)?.rate||0);
  }
  return {bundleOffset,vasOffset};
}

// Shared sale estimate: monthly context determines the applicable band.
// Grade bonuses and other monthly threshold payouts belong only in payroll.
// Existing sales are removed first, so list and unchanged edit have the same basis.
export function estimateMobileSale({meta,existingSale,dayKey,dailyDays,draft,strategicMetric,
  month,config,employee,september,legacyConversion}, {normalizeDay,applyDailyToDraft,computePay}) {
  if(meta.teamOnly)return {incentive:0,rows:[],points:0,productivity:0};
  if(september&&!strategicMetric)return null;
  if(!Number.isInteger(meta.ri)||!Number.isInteger(meta.ci))return null;
  let base=normalizeDay(dailyDays[dayKey]);
  let beforeMetric=strategicMetric;
  if(existingSale&&!existingSale.source_meta?.teamOnly){
    base=dayAfterSaleDeletion(base,existingSale,mobileSaleOffsets(existingSale.source_meta,config,september));
    beforeMetric=changeStrategicMetric(strategicMetric,existingSale.source_meta,-1);
  } else if(legacyConversion?.kind==='mobile') {
    base=structuredClone(base);
    base.matrix[legacyConversion.ri][legacyConversion.ci]=Math.max(0,Number(base.matrix[legacyConversion.ri][legacyConversion.ci]||0)-1);
  }
  const next=structuredClone(base);
  const add=(obj,key,value=1)=>{obj[key]=Number(obj[key]||0)+value;};
  add(next.matrix[meta.ri],meta.ci);
  for(const key of meta.vasKeys||[])if(key!=='vasNone')add(next.groups.vas,key);
  if(!meta.bundleVasCommissionExcluded)for(const key of Object.values(meta.bundleVasMap||{}).flat())if(key!=='vasNone')add(next.groups.vas,key);
  for(const key of meta.bundle2ndKeys||[])add(next.groups.bundle2nd,key);
  if(meta.usedMnpBundle)add(next.groups.mnpBundle,'usedMnpBundle');
  const offsets=mobileSaleOffsets(meta,config,september),sp=meta.specialPolicy||{};
  const replacement=Number(sp.exceptionStatus==='approved'?sp.exceptionApprovedAmount:sp.exceptionStatus==='pending'?0:sp.replacementAmount||0);
  add(next,'bundleFreeOffset',offsets.bundleOffset);add(next,'bundleFreeVasOffset',offsets.vasOffset);
  add(next,'specialMatrixOffset',Number(sp.normalMatrixFee||0));add(next,'specialVasOffset',Number(sp.normalVasFee||0));
  add(next,'specialReplacementPay',replacement);
  const calculate=(day,metric)=>computePay(applyDailyToDraft(draft,{...dailyDays,[dayKey]:day},month,config.categoryMap,config.gibyeonColumnMap),employee?.position||'사원',employee?.hireDate,month,config,0,metric);
  const before=calculate(base,beforeMetric),after=calculate(next,changeStrategicMetric(beforeMetric,meta,1));
  const delta=key=>Number(after[key]||0)-Number(before[key]||0);
  // Apply the current monthly band only to this sale; never attribute a
  // monthly threshold payout (or repricing of other sales) to this customer.
  const hs = meta.ri >= 0 && meta.ri <= 4 ? 1 : 0;
  const strategyPerSale = after.strategicAdjustmentBand === 'bonus' ? hs*10000
    : after.strategicAdjustmentBand === 'demerit' ? -(hs+(meta.usedMnpBundle?1:0))*10000 : 0;
  const rows=[];const line=(label,value)=>{if(value)rows.push([label,value]);};
  line('영업활동 지원금',delta('tenurePay'));
  line('요금제',delta('matrixTotal'));line('VAS·보험',delta('rawVasPay'));line('2ND 기본금액',delta('rawBundle2ndTotal'));
  line('홈 실적 기준 예상 조정',delta('mobilePlanPay')-delta('adjustedMatrixTotal')+delta('bundle2ndPay')-delta('bundle2ndTotal'));
  line('전략포인트 비중 · 해당 판매',strategyPerSale);
  line('중고 MNP 결합',delta('mnpBundlePay'));
  line('2ND 할인·조건 미충족 제외',-offsets.bundleOffset-offsets.vasOffset);
  line('인센미지급 특가 제외',-Number(sp.normalMatrixFee||0)-Number(sp.normalVasFee||0));
  line('특가·지인 추가',replacement);
  line('추석 판매 활성화',chuseokSalePay(draft.chuseokPolicy,{month,dayKey,meta,existingSale}));
  const incentive=rows.reduce((sum,[,value])=>sum+value,0);
  return {incentive,rows,points:delta('totalPoints'),productivity:delta('kpiScore'),beforeRatio:before.strategicRatio,afterRatio:after.strategicRatio};
}
