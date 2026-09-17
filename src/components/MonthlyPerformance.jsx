import PerformanceCard from './PerformanceCard';
import React from 'react';
import {emptyDraft} from '../viewShared';
import {DEFAULT_KPI_ITEMS, DEFAULT_BUNDLE2ND, DEFAULT_SONO, fmtCount, monthKeyOf, monthLabel, daysInMonth, normalizeDay, applyDailyToDraft, hsCount} from '../appShared';
import {useState, useEffect, useMemo} from 'react';
import {Check} from 'lucide-react';
import {MATRIX_ROW_DEFS, MATRIX_COLS, fmtNum, won} from '../uiDefinitions';
import {completedHomeCount} from '../policyRules';
const PERSONAL_GOAL_DEFS = [
  { key: 'hs', label: 'HS', unit: '건', defaultTarget: 20 },
  { key: 'home', label: '홈 실적', unit: '건', defaultTarget: 5 },
  { key: 'tvFree', label: 'TV프리(부)', unit: '건', defaultTarget: 5 },
  { key: 'smartHome', label: '스마트홈', unit: '건', defaultTarget: 5 },
  { key: 'tailoredAmount', label: '맞춤제안 업셀 금액', unit: '원', defaultTarget: 1000000 },
  { key: 'tailored', label: '맞춤제안 업셀 건수', unit: '건', defaultTarget: 15 },
  { key: 'points', label: '성과등급P', unit: 'P', defaultTarget: 35 },
  { key: 'kpi', label: '생산성', unit: 'P', defaultTarget: 35 },
  { key: 'incentive', label: '인센티브', unit: '원', defaultTarget: 1500000 },
];

function getPersonalGoalActuals(mergedDraft, pay) {
  const matrix = mergedDraft?.matrix || [];

  // HS = 신규 + MNP + 기변A/B/C 합산
  const hs = [0, 1, 2, 3, 4].reduce((sum, ri) => {
    const row = matrix[ri] || [];
    return sum + row.reduce((s, v) => s + (Number(v) || 0), 0);
  }, 0);

  return {
    hs,
    home: completedHomeCount(mergedDraft),
    tvFree: Number(mergedDraft?.homeFlat?.tvFree || 0),
    smartHome: Number(mergedDraft?.homeFlat?.smartHome || 0),
    tailoredAmount: Number(mergedDraft?.tailoredAmount || 0),
    tailored: Number(mergedDraft?.tailoredCount || 0),
    points: Number(pay?.totalPoints || 0),
    kpi: Number(pay?.kpiScore || 0),
    incentive: Number(pay?.total || 0),
  };
}

function MonthlyGoalCard({ month, mergedDraft, pay, goals, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(() => new Set(Object.keys(goals || {})));
  const [values, setValues] = useState(goals || {});

  useEffect(() => {
    setSelected(new Set(Object.keys(goals || {})));
    setValues(goals || {});
  }, [goals, month]);

  const actuals = useMemo(() => getPersonalGoalActuals(mergedDraft, pay), [mergedDraft, pay]);
  const hasGoals = Object.keys(goals || {}).length > 0;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!(Number(values[key]) > 0)) {
          const def = PERSONAL_GOAL_DEFS.find((d) => d.key === key);
          setValues((v) => ({ ...v, [key]: def?.defaultTarget || 10 }));
        }
      }
      return next;
    });
  };

  const save = async () => {
    const payload = {};
    PERSONAL_GOAL_DEFS.forEach((def) => {
      if (!selected.has(def.key)) return;
      const n = Number(values[def.key]);
      if (Number.isFinite(n) && n > 0) payload[def.key] = n;
    });

    if (!Object.keys(payload).length) return;
    const ok = await onSave(payload);
    if (ok) setEditing(false);
  };

  if (!hasGoals || editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="text-xs font-semibold text-brand-600">
          나의 {parseInt(month.split('-')[1], 10)}월
        </div>
        <div className="text-sm font-bold text-gray-900 mt-1">이번 달 내 목표</div>
        <div className="text-[11px] text-gray-400 mt-1">
          원하는 실적 항목을 선택하고 이번 달 목표를 정해보세요.
        </div>

        <div className="mt-3 space-y-2">
          {PERSONAL_GOAL_DEFS.map((def) => {
            const checked = selected.has(def.key);
            return (
              <div key={def.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(def.key)}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    checked
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-gray-300 text-transparent'
                  }`}
                >
                  <Check size={13} />
                </button>

                <div className="w-20 text-sm text-gray-700">{def.label}</div>

                <input
                  type="number"
                  min="0"
                  step={def.unit === '원' ? '10000' : (def.unit === 'P' ? '0.1' : '1')}
                  disabled={!checked}
                  value={values[def.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [def.key]: e.target.value }))}
                  className="min-w-0 flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-50 disabled:text-gray-300"
                  placeholder="목표"
                />

                <div className="w-6 text-xs text-gray-400">{def.unit}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={saving || selected.size === 0}
            className="flex-1 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? '저장 중' : '목표 저장'}
          </button>

          {hasGoals && (
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm"
            >
              취소
            </button>
          )}
        </div>
      </div>
    );
  }

  const activeDefs = PERSONAL_GOAL_DEFS.filter((def) => Number(goals?.[def.key]) > 0);
  const completeCount = activeDefs.filter((def) => {
    const target = Number(goals[def.key]);
    const current = Number(actuals[def.key] || 0);
    return current >= target;
  }).length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-brand-600">
            나의 {parseInt(month.split('-')[1], 10)}월
          </div>
          <div className="text-sm font-bold text-gray-900 mt-1">이번 달 내 목표</div>
        </div>

        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-brand-600"
        >
          수정
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {activeDefs.map((def) => {
          const target = Number(goals[def.key]);
          const current = Number(actuals[def.key] || 0);
          const pct = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
          const achieved = current >= target;

          const currentLabel = def.unit === '원'
            ? fmtNum(Math.round(current))
            : def.unit === 'P'
              ? current.toFixed(1)
              : Math.round(current).toString();

          const targetLabel = def.unit === '원'
            ? fmtNum(Math.round(target))
            : def.unit === 'P'
              ? target.toFixed(1)
              : Math.round(target).toString();

          return (
            <div key={def.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-700">{def.label}</div>
                <div className={`text-sm font-bold ${achieved ? 'text-emerald-600' : 'text-gray-800'}`}>
                  {currentLabel} / {targetLabel}{def.unit}
                </div>
              </div>

              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    achieved ? 'bg-emerald-500' : 'bg-brand-600'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="text-[11px] mt-1.5">
                {achieved ? (
                  <span className="font-semibold text-emerald-600">목표 달성! 🎉</span>
                ) : (
                  <span className="text-gray-400">{Math.round(pct)}% 진행 중</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeDefs.length > 1 && (
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
          이번 달 목표 {completeCount} / {activeDefs.length}개 달성
        </div>
      )}
    </div>
  );
}

function MyMonthlyPerformanceCard({ scopeRows=[], draft, pay, personalGoals, dailyDays, month, config, onSaveGoals, goalSaving }) {
  const [goalEditing,setGoalEditing]=useState(false);
  const [goalValues,setGoalValues]=useState(personalGoals||{});
  useEffect(()=>setGoalValues(personalGoals||{}),[personalGoals,month]);
  const simMnpTotal=(draft?.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0);
  const secondStandalone=(draft?.matrix?.[7]||[]).reduce((s,v)=>s+Number(v||0),0);
  const secondBundle=Object.values(draft?.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0);
  const metrics=[
    {key:'hs',goalKey:'hs',label:'HS',unit:'count',value:hsCount(draft)},
    {key:'simMnp',goalKey:'simMnp',label:'SIM MNP',unit:'count',value:simMnpTotal},
    {key:'second',goalKey:'second',label:'2ND',unit:'count',value:secondStandalone+secondBundle},
    {key:'productivity',goalKey:'kpi',label:'생산성',unit:'point',value:Number(pay?.kpiScore||0)},
    {key:'home',goalKey:'home',label:'홈',unit:'count',value:completedHomeCount(draft)},
    {key:'tvFree',goalKey:'tvFree',label:'프리',unit:'count',value:Number(draft?.homeFlat?.tvFree||0)},
    {key:'smartHome',goalKey:'smartHome',label:'스홈',unit:'count',value:Number(draft?.homeFlat?.smartHome||0)},
    {key:'sono',goalKey:'sono',label:'소노',unit:'count',value:Object.values(draft?.sono||{}).reduce((s,v)=>s+Number(v||0),0)},
    {key:'tailoredAmount',goalKey:'tailoredAmount',label:'맞춤제안 매출액',unit:'won',value:Number(draft?.tailoredAmount||0)},
    {key:'tailoredCount',goalKey:'tailored',label:'업셀건',unit:'count',value:Number(draft?.tailoredCount||0)},
  ];
  const [detailMetric,setDetailMetric]=useState(null);

  const goalFor=(m)=>Number(personalGoals?.[m.goalKey]||0);

  const forecastFactor=useMemo(()=>{
    const now=new Date(), current=monthKeyOf(now)===month;
    if(!current)return 1;
    const total=daysInMonth(month),today=Math.min(now.getDate(),total);
    let elapsed=0,working=0;
    for(let day=1;day<=total;day++){
      const key=String(day).padStart(2,'0');
      if(normalizeDay(dailyDays?.[key]).dayOff)continue;
      working++;
      if(day<=today)elapsed++;
    }
    return elapsed>0?working/elapsed:1;
  },[dailyDays,month]);

  const forecastFor=(m)=>{
    const value=Number(m.value||0)*forecastFactor;
    return m.unit==='count'?Math.round(value):value;
  };

  const renderMetricValue=(m,value)=>{
    if(m.unit==='won') return won(Math.round(value));
    if(m.unit==='point') return `${fmtNum(Number(value||0),1)}P`;
    return `${fmtNum(Number(value||0),Number(value||0)%1?1:0)}건`;
  };

  const detailRows=useMemo(()=>{
    if(!detailMetric)return [];
    const out=[];
    const days=Object.entries(dailyDays||{}).sort(([a],[b])=>Number(a)-Number(b));
    const add=(day,label,value,unit='count',sub='')=>{
      const n=Number(value||0); if(!n)return;
      out.push({day,label,value:n,unit,sub});
    };
    days.forEach(([dd,raw])=>{
      const d=normalizeDay(raw);
      if(detailMetric.key==='hs'){
        [0,1,2,3,4].forEach(ri=>{
          (d.matrix?.[ri]||[]).forEach((cnt,ci)=>{
            if(!cnt)return;
            const rd=MATRIX_ROW_DEFS[ri];
            add(dd,rd?.dailyLabel||rd?.label||'모바일',cnt,'count',rd?.hasTiers?(MATRIX_COLS[ci]||''):'');
          });
        });
      } else if(detailMetric.key==='simMnp'){
        (d.matrix?.[5]||[]).forEach((cnt,ci)=>{ if(cnt)add(dd,'SIM MNP',cnt,'count',MATRIX_COLS[ci]||''); });
      } else if(detailMetric.key==='second'){
        const standalone=(d.matrix?.[7]||[]).reduce((a,v)=>a+Number(v||0),0); add(dd,'2ND단독',standalone);
        Object.entries(d.groups?.bundle2nd||{}).forEach(([k,cnt])=>{
          const item=(config?.bundle2nd||DEFAULT_BUNDLE2ND).find(x=>x.key===k); add(dd,item?.label||k,cnt);
        });
      } else if(detailMetric.key==='productivity'){
        const one=applyDailyToDraft(emptyDraft(),{[dd]:d},month,config?.categoryMap,config?.gibyeonColumnMap);
        (config?.kpiItems||DEFAULT_KPI_ITEMS).forEach(item=>{
          const cnt=Number(one.kpi?.[item.key]||0); if(cnt)add(dd,item.label,cnt*Number(item.point||0),'point',`${fmtCount(cnt)}건 × ${fmtNum(Number(item.point||0),1)}P`);
        });
      } else if(detailMetric.key==='home'){
        const hb=d.groups?.homeBase||{}; add(dd,'홈 단독',hb.homeOnly); add(dd,'홈+TV',hb.homeTv);
      } else if(detailMetric.key==='tvFree') add(dd,'TV프리(부)',d.groups?.homeFlat?.tvFree);
      else if(detailMetric.key==='smartHome') add(dd,'스마트홈',d.groups?.homeFlat?.smartHome);
      else if(detailMetric.key==='sono'){
        Object.entries(d.groups?.sono||{}).forEach(([k,cnt])=>{const item=(config?.sono||DEFAULT_SONO).find(x=>x.key===k);add(dd,item?.label||k,cnt);});
      } else if(detailMetric.key==='tailoredAmount') add(dd,'맞춤제안 매출액',d.tailoredAmount,'won');
      else if(detailMetric.key==='tailoredCount') add(dd,'맞춤제안 업셀',d.tailoredCount);
    });
    return out;
  },[detailMetric,dailyDays,month,config]);

  const detailTotal=detailRows.reduce((s,r)=>s+Number(r.value||0),0);
  const detailValue=(r)=>r.unit==='won'?won(r.value):r.unit==='point'?`${fmtNum(Number(r.value),1)}P`:`${fmtCount(r.value)}건`;

  return <>
    <PerformanceCard month={month} title="이번 달 실적" scopeLabel="개인" metrics={metrics.map(m=>({...m,target:goalFor(m),forecast:forecastFor(m)}))}
      scopeRows={scopeRows} config={config} testPrefix="personal" onMetricClick={setDetailMetric}
      goalEditor={<div><button type="button" onClick={()=>setGoalEditing(v=>!v)} className="text-sm font-semibold text-brand-700">{goalEditing?'목표 설정 닫기':'목표 설정'}</button>
        {goalEditing&&<div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
          {metrics.map(m=><div key={m.key} className="flex items-center gap-2"><span className="text-[10px] text-gray-500 w-24">{m.label}</span><input type="number" value={goalValues[m.goalKey]??''} onChange={e=>setGoalValues(v=>({...v,[m.goalKey]:e.target.value}))} placeholder="미설정" className="min-w-0 flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs"/><span className="text-[9px] text-gray-400">{m.unit==='won'?'원':m.unit==='point'?'P':'건'}</span></div>)}
          <button disabled={goalSaving} onClick={async()=>{const ok=await onSaveGoals?.(goalValues);if(ok)setGoalEditing(false)}} className="w-full mt-1 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold disabled:opacity-50">{goalSaving?'저장 중':'목표 저장'}</button>
        </div>}
      </div>}
    />
    {detailMetric&&<div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={()=>setDetailMetric(null)}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl max-h-[82vh] overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex justify-between gap-3 items-start">
          <div><div className="text-xs font-semibold text-brand-600">{monthLabel(month)} 실적 상세</div><div className="text-lg font-bold text-gray-900 mt-0.5">{detailMetric.label} · {renderMetricValue(detailMetric,detailMetric.value)}</div></div>
          <button onClick={()=>setDetailMetric(null)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 text-lg">×</button>
        </div>
        <div className="overflow-y-auto max-h-[62vh] divide-y divide-gray-50">
          {detailRows.length===0?<div className="py-12 text-center text-sm text-gray-400">반영된 상세 내역이 없어요.</div>:detailRows.map((r,i)=><div key={`${r.day}-${r.label}-${i}`} className="px-5 py-3 flex justify-between gap-3">
            <div className="min-w-0"><div className="text-sm font-semibold text-gray-800">{parseInt(r.day,10)}일 · {r.label}</div>{r.sub&&<div className="text-[11px] text-gray-400 mt-0.5">{r.sub}</div>}</div>
            <div className="text-sm font-bold text-brand-700 shrink-0">{detailValue(r)}</div>
          </div>)}
        </div>
        <div className="px-5 py-4 border-t bg-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-500">상세 합계</span>
          <span className="font-bold text-gray-900">{detailMetric.unit==='won'?won(detailTotal):detailMetric.unit==='point'?`${fmtNum(detailTotal,1)}P`:`${fmtCount(detailTotal)}건`}</span>
        </div>
      </div>
    </div>}
  </>;
}
export { PERSONAL_GOAL_DEFS, getPersonalGoalActuals, MonthlyGoalCard, MyMonthlyPerformanceCard };
