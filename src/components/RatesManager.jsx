import React, {useState,useEffect} from 'react';
import {Plus,Trash2} from 'lucide-react';
import Section from './Section';
import ColHeader from './ColHeader';
import {POSITIONS,DEFAULT_ACTIVITY_SUPPORT_MAX,MATRIX_ROW_DEFS,MATRIX_COLS,fmtInputNumber,won} from '../uiDefinitions';

function MobilePointItemsEditor({ items, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newPoint, setNewPoint] = useState('');
  const [newCountsTenure, setNewCountsTenure] = useState(true);

  const updateItem = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => {
    if (!newLabel.trim()) return;
    const key = `custom_${Date.now()}`;
    onChange([...items, { key, label: newLabel.trim(), point: parseFloat(newPoint || '0'), countsTenure: newCountsTenure }]);
    setNewLabel(''); setNewPoint(''); setNewCountsTenure(true);
  };

  return (
    <Section title="모바일 실적 항목 관리" sub={`${items.length}개 항목`} defaultOpen>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">항목을 직접 추가·삭제·수정할 수 있어요. "근속수당 건수 포함"을 체크하면 이 항목이 근속기간별 건당 지급액 계산에도 반영돼요.</div>
      <div className="divide-y divide-gray-50">
        {items.map((it, idx) => (
          <div key={it.key} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <input value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            <div className="flex items-center gap-1">
              <input type="number" step="0.1" value={it.point} onChange={(e) => updateItem(idx, { point: parseFloat(e.target.value || '0') })} className="w-16 text-right border border-gray-200 rounded-lg px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">P</span>
            </div>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={it.countsTenure !== false} onChange={(e) => updateItem(idx, { countsTenure: e.target.checked })} className="w-3.5 h-3.5" />
              근속수당 건수 포함
            </label>
            <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-gray-50">
        <input placeholder="새 항목명 (예: 기변(신규정책))" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
        <div className="flex items-center gap-1">
          <input type="number" step="0.1" placeholder="포인트" value={newPoint} onChange={(e) => setNewPoint(e.target.value)} className="w-20 text-right border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm" />
          <span className="text-xs text-gray-400">P</span>
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" checked={newCountsTenure} onChange={(e) => setNewCountsTenure(e.target.checked)} className="w-3.5 h-3.5" />
          근속수당 포함
        </label>
        <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"><Plus size={14} /> 항목 추가</button>
      </div>
    </Section>
  );
}

function KpiItemsEditor({ items, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newPoint, setNewPoint] = useState('');

  const updateItem = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => {
    if (!newLabel.trim()) return;
    const key = `kpi_custom_${Date.now()}`;
    onChange([...items, { key, label: newLabel.trim(), point: parseFloat(newPoint || '0') }]);
    setNewLabel(''); setNewPoint('');
  };

  return (
    <Section title="개인 생산성 항목 관리" sub={`${items.length}개 항목`}>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">인센티브 금액에는 반영되지 않는 참고용 생산성 점수예요. 항목을 직접 추가·삭제·수정할 수 있어요.</div>
      <div className="divide-y divide-gray-50">
        {items.map((it, idx) => (
          <div key={it.key} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <input value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            <div className="flex items-center gap-1">
              <input type="number" step="0.1" value={it.point} onChange={(e) => updateItem(idx, { point: parseFloat(e.target.value || '0') })} className="w-16 text-right border border-gray-200 rounded-lg px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">P</span>
            </div>
            <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-gray-50">
        <input placeholder="새 항목명" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
        <div className="flex items-center gap-1">
          <input type="number" step="0.1" placeholder="포인트" value={newPoint} onChange={(e) => setNewPoint(e.target.value)} className="w-20 text-right border border-gray-200 rounded-lg px-1.5 py-1.5 text-sm" />
          <span className="text-xs text-gray-400">P</span>
        </div>
        <button onClick={addItem} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"><Plus size={14} /> 항목 추가</button>
      </div>
    </Section>
  );
}

function CategoryMapEditor({ map, mobilePointItems, kpiItems, onChange }) {
  const update = (idx, field, value) => {
    const next = map.map((m, i) => (i === idx ? { ...m, [field]: value } : m));
    onChange(next);
  };
  return (
    <Section title="가입구분 ↔ 성과등급P / KPI 매핑" sub="일일입력 자동 연결 기준" defaultOpen>
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">직원이 일일입력 탭에서 이 가입구분에 건수를 넣으면, 아래 지정한 성과등급P 항목과 KPI 항목에 그 건수가 자동으로 더해져요. 기변A/B/C는 타겟 상관없이 요금제군 기준으로 성과등급P가 배분되므로 아래 "기변 요금제군별 매핑" 표를 따로 사용해요.</div>
      <div className="divide-y divide-gray-50">
        {MATRIX_ROW_DEFS.map((rowDef, idx) => (
          <div key={rowDef.label} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <span className="text-sm text-gray-700 min-w-[110px]">{rowDef.label}</span>
            {rowDef.isGibyeon ? (
              <span className="text-xs text-gray-400 flex-1 min-w-[130px]">성과등급P: 요금제군별 매핑 사용</span>
            ) : (
              <select value={map[idx]?.mobilePointKey || ''} onChange={(e) => update(idx, 'mobilePointKey', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
                <option value="">성과등급P 미연결</option>
                {mobilePointItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
              </select>
            )}
            <select value={map[idx]?.kpiKey || ''} onChange={(e) => update(idx, 'kpiKey', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
              <option value="">KPI 미연결</option>
              {kpiItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}

function GibyeonColumnMapEditor({ colMap, mobilePointItems, onChange }) {
  const update = (ci, value) => onChange(colMap.map((v, i) => (i === ci ? value : v)));
  return (
    <Section title="기변 요금제군별 성과등급P 매핑" sub="기변A/B/C 공통 적용 (타겟 무관)">
      <div className="px-4 pt-3 pb-1 text-[11px] text-gray-400">기변A/B/C 중 어느 행에 입력해도, 고른 요금제군에 따라 여기 지정한 성과등급P 항목으로 자동 배분돼요.</div>
      <div className="divide-y divide-gray-50">
        {MATRIX_COLS.map((col, ci) => (
          <div key={col} className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <span className="text-sm text-gray-700 min-w-[150px]">{col}</span>
            <select value={colMap[ci] || ''} onChange={(e) => update(ci, e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[130px]">
              <option value="">미연결</option>
              {mobilePointItems.map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RatesManager({ config, persistConfig }) {
  const [draft, setDraftCfg] = useState(config);
  useEffect(() => setDraftCfg(config), [config]);
  const save = () => persistConfig(draft);

  const updateFlatTable = (group, idx, field, val) => {
    const next = { ...draft, [group]: draft[group].map((t, i) => (i === idx ? { ...t, [field]: val } : t)) };
    setDraftCfg(next);
  };
  const updateMatrix = (ri, ci, val) => {
    const next = draft.matrix.map((row) => [...row]);
    next[ri][ci] = val;
    setDraftCfg({ ...draft, matrix: next });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">항목을 수정한 뒤 맨 아래 "저장" 버튼을 눌러야 모든 직원 화면에 반영돼요.</div>

      <MobilePointItemsEditor items={draft.mobilePointItems} onChange={(items) => setDraftCfg({ ...draft, mobilePointItems: items })} />

      <KpiItemsEditor items={draft.kpiItems} onChange={(items) => setDraftCfg({ ...draft, kpiItems: items })} />

      <CategoryMapEditor map={draft.categoryMap} mobilePointItems={draft.mobilePointItems} kpiItems={draft.kpiItems}
        onChange={(m) => setDraftCfg({ ...draft, categoryMap: m })} />

      <GibyeonColumnMapEditor colMap={draft.gibyeonColumnMap} mobilePointItems={draft.mobilePointItems}
        onChange={(m) => setDraftCfg({ ...draft, gibyeonColumnMap: m })} />

      <Section title="직급별 최저 보장금액" defaultOpen>
        <div className="p-3 grid grid-cols-2 gap-2">
          {POSITIONS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">{p}</span>
              <input type="text" inputMode="numeric" value={fmtInputNumber(draft.basePay[p])} onChange={(e) => setDraftCfg({ ...draft, basePay: { ...draft.basePay, [p]: parseInt(e.target.value.replace(/\D/g,'') || '0', 10) } })} className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="직급별 직책수당">
        <div className="p-3 text-[11px] text-gray-400">직책수당은 영업활동 지원금과 별도로 가산돼요. 실적으로 직책수당만큼 다시 채울 필요가 없어요.</div>
        <div className="p-3 pt-0 grid grid-cols-2 gap-2">
          {POSITIONS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-600">{p}</span>
              <input type="text" inputMode="numeric" value={fmtInputNumber(draft.positionAllowance?.[p] || 0)} onChange={(e) => setDraftCfg({ ...draft, positionAllowance: { ...draft.positionAllowance, [p]: parseInt(e.target.value.replace(/\D/g,'') || '0', 10) } })} className="w-28 text-right border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="영업 활동 지원 정책" defaultOpen>
        <div className="px-4 py-3 bg-gray-50 text-[11px] text-gray-500 leading-relaxed">
          대상 실적은 <b>HS · SIM MNP · 2ND</b>입니다. 6개월 미만은 실적과 무관하게 고정 지급하고,
          이후 구간은 건당 금액을 누적하되 영업 활동 지원 정책 지급액은 MAX를 넘지 않습니다.
        </div>
        <div className="divide-y divide-gray-50">
          {(draft.tenure||[]).map((t,i)=><div key={t.key} className="flex items-center justify-between px-4 py-2.5 gap-3">
            <div>
              <div className="text-sm text-gray-700">{t.label}</div>
              {t.key==='under6'&&<div className="text-[10px] text-gray-400">실적 무관 고정 지급</div>}
            </div>
            {t.key==='under6' ? (
              <div className="text-sm font-bold text-gray-700">{won(draft.tenureCap||DEFAULT_ACTIVITY_SUPPORT_MAX)}</div>
            ) : (
              <div className="flex items-center gap-1">
                <input type="text" inputMode="numeric" value={fmtInputNumber(t.rate)}
                  onChange={(e)=>updateFlatTable('tenure',i,'rate',parseInt(e.target.value.replace(/\D/g,'')||'0',10))}
                  className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-sm"/>
                <span className="text-xs text-gray-400">원/건</span>
              </div>
            )}
          </div>)}
          <div className="flex items-center justify-between px-4 py-3 gap-3 bg-brand-50/40">
            <div><div className="text-sm font-semibold text-gray-700">영업 활동 지원 정책 MAX</div><div className="text-[10px] text-gray-400">6개월 미만 고정 지급액도 이 금액을 사용합니다.</div></div>
            <div className="flex items-center gap-1">
              <input type="text" inputMode="numeric" value={fmtInputNumber(draft.tenureCap||DEFAULT_ACTIVITY_SUPPORT_MAX)}
                onChange={(e)=>setDraftCfg({...draft,tenureCap:parseInt(e.target.value.replace(/\D/g,'')||'0',10)})}
                className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm bg-white"/>
              <span className="text-xs text-gray-400">원</span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="최저 보장 비교 기준">
        <div className="p-4 text-xs text-gray-600 leading-relaxed space-y-2">
          <div><b>비교 대상</b> · 영업 활동 지원 정책 + 요금제 + VAS + 2ND + 승인된 모바일 스팟 + 특판·지인판매 대체 인센티브 + 직책수당</div>
          <div><b>비교 제외</b> · 성과등급 보너스 + 홈 관련 수수료 + 소노 + 중고MNP 결합 + 고객등록 + 맞춤제안</div>
          <div className="text-gray-400">비교 대상 합계가 직급별 최저 보장금액보다 낮으면 해당 직급의 최저 보장금액으로 보정한 뒤, 비교 제외 항목을 추가합니다.</div>
        </div>
      </Section>
      <RateTable title="성과등급 보너스" group="grades" data={draft.grades} updateFlatTable={updateFlatTable} field="bonus" labelKey="grade" extraField="min" />
      <RateTable title="홈 그레이드 (누적건수별)" group="homeTiers" data={draft.homeTiers} updateFlatTable={updateFlatTable} field="rate" labelKey="min" labelSuffix="건 이상" />
      <RateTable title="홈 단독 / TV프리 / 스마트홈" group="homeFlat" data={draft.homeFlat} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="동시판매 수수료" group="homeAddon" data={draft.homeAddon} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="인터넷 재약정" group="renew" data={draft.renew} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="VAS" group="vas" data={draft.vas} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="2ND 번들" group="bundle2nd" data={draft.bundle2nd} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="소노" group="sono" data={draft.sono} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="중고MNP 결합" group="mnpBundle" data={draft.mnpBundle} updateFlatTable={updateFlatTable} field="rate" />
      <RateTable title="고객등록 구간 보너스" group="custRegTiers" data={draft.custRegTiers} updateFlatTable={updateFlatTable} field="bonus" labelKey="min" labelSuffix="건 이상" />
      <RateTable title="맞춤제안 구간 보너스" group="tailoredTiers" data={draft.tailoredTiers} updateFlatTable={updateFlatTable} field="bonus" labelKey="min" labelSuffix="건 이상" />

      <Section title="요금제 유치 수수료">
        <div className="overflow-x-auto p-2">
          <table className="text-xs">
            <thead><tr><th className="p-1 text-left sticky left-0 bg-white">가입구분</th>{MATRIX_COLS.map((c) => <th key={c} className="p-1 text-gray-400"><ColHeader label={c} /></th>)}</tr></thead>
            <tbody>
              {MATRIX_ROW_DEFS.map((rowDef, ri) => (
                <tr key={rowDef.label} className="border-t border-gray-50">
                  <td className="p-1 whitespace-nowrap sticky left-0 bg-white">{rowDef.label}</td>
                  {rowDef.hasTiers ? (
                    MATRIX_COLS.map((c, ci) => (
                      <td key={c} className="p-1">
                        <input type="number" value={draft.matrix[ri][ci]} onChange={(e) => updateMatrix(ri, ci, parseInt(e.target.value || '0', 10))} className="w-16 text-center border border-gray-200 rounded px-1 py-1" />
                      </td>
                    ))
                  ) : (
                    <td className="p-1" colSpan={MATRIX_COLS.length}>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={draft.matrix[ri][0]} onChange={(e) => updateMatrix(ri, 0, parseInt(e.target.value || '0', 10))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1" />
                        <span className="text-gray-400">원 / 건 (요금제군 구분 없음)</span>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <button onClick={save} className="px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">지급 기준 저장</button>
    </div>
  );
}

function RateTable({ title, group, data, updateFlatTable, field, labelKey, labelSuffix, extraField }) {
  return (
    <Section title={title}>
      <div className="divide-y divide-gray-50">
        {data.map((t, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-2">
            <span className="text-sm text-gray-700">{labelKey ? `${t[labelKey]}${labelSuffix || ''}` : t.label}</span>
            <div className="flex items-center gap-1">
              {extraField && (
                <input type="number" value={t[extraField]} onChange={(e) => updateFlatTable(group, i, extraField, parseFloat(e.target.value || '0'))} className="w-16 text-right border border-gray-200 rounded px-1.5 py-1 text-xs" title={extraField} />
              )}
              <input type="text" inputMode="numeric" value={fmtInputNumber(t[field])} onChange={(e) => updateFlatTable(group, i, field, parseInt(e.target.value.replace(/\D/g,'') || '0', 10))} className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-sm" />
              <span className="text-xs text-gray-400">원</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export default RatesManager;
