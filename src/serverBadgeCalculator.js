// Server entry: use the same policy and badge functions as the app. No request-supplied scores.
import { defaultConfig, mergeDefaultVas } from './policyDefaults';
import { evaluateAutomaticBadges } from './badgeRules';
import { emptyDraft } from './viewShared';
import { normalizeDay, applyDailyToDraft, computePay } from './appShared';
import { homeOrdersForMonth, calculateHomePolicyFromOrders } from './policyRules';
import { resolvePolicyConfigForMonth } from './policyCalendar';

export function calculateVerifiedBadges(source,userId,month){
  const values=Object.fromEntries(source.config.map(x=>[x.key,x.value]));
  const saved=values.config||{};
  const legacy={...defaultConfig(),...saved,vas:mergeDefaultVas(saved.vas)};
  const resolved=resolvePolicyConfigForMonth(month,legacy,values.policy_history_v1);
  const config={...defaultConfig(),...resolved,vas:mergeDefaultVas(resolved.vas)};
  const linked=new Set(source.home_links.map(x=>String(x.source_ref)));
  const daysFor=(id,records)=>{
    const days=Object.fromEntries(records.filter(x=>x.user_id===id).map(x=>[x.work_date,normalizeDay(x.data)]));
    for(const o of source.home_orders.filter(x=>x.user_id===id&&x.status==='cancelled'&&!linked.has(String(x.id)))){
      const day=days[o.source_work_date];if(!day)continue;
      const fallback={homeOnly:['homeBase','homeOnly'],homeTv:['homeBase','homeTv'],tvFree:['homeFlat','tvFree'],smartHome:['homeFlat','smartHome'],internet100:['homeFlat','home100Only'],internet500:['homeFlat','home500Only'],internet1g:['homeFlat','home1GBOnly']}[o.product_type];
      const group=o.source_group||fallback?.[0],key=o.source_key||fallback?.[1];
      if(group&&key)day.groups[group]={...day.groups[group],[key]:Math.max(0,Number(day.groups[group]?.[key]||0)-1)};
    }
    return days;
  };
  const teamRefs=new Set((source.team_credits||[]).flatMap(x=>x.source_refs||[]).map(String));
  const rows=source.profiles.map(p=>{
    const status=source.monthly.find(x=>x.user_id===p.id);
    const draft={...emptyDraft(),...status?.data?.draft,activityTimeMet:status?.activity_time_met??true};
    const dailyDays=Object.fromEntries(Object.entries(daysFor(p.id,source.daily)).map(([d,v])=>[d.slice(8,10),v]));
    const orders=homeOrdersForMonth(source.home_orders.filter(x=>x.user_id===p.id&&!teamRefs.has(String(x.id))),month,'completed');
    const mergedDraft={...applyDailyToDraft(draft,dailyDays,month,config.categoryMap,config.gibyeonColumnMap),homePolicy:orders.length?calculateHomePolicyFromOrders(orders,config):null};
    const pay=computePay(mergedDraft,p.position,p.hire_date,month,config,0,null);
    return {id:p.id,branch:p.store_name,draft:mergedDraft,pay,dailyDays};
  });
  const me=rows.find(x=>x.id===userId);if(!me)throw Error('BADGE_USER_UNAVAILABLE');
  const lifetimeTotals={home:0,free:0,smart:0,upsell:0,sono:0};
  for(const d of Object.values(daysFor(userId,source.history))){
    const base=d.groups?.homeBase||{},flat=d.groups?.homeFlat||{};
    const home=Number(base.homeOnly||0)+Number(base.homeTv||0);
    lifetimeTotals.home+=home>0?home:Number(flat.home100Only||0)+Number(flat.home500Only||0)+Number(flat.home1GBOnly||0);
    lifetimeTotals.free+=Number(flat.tvFree||0);lifetimeTotals.smart+=Number(flat.smartHome||0);
    lifetimeTotals.upsell+=Number(d.tailoredCount||0);
    lifetimeTotals.sono+=Object.values(d.groups?.sono||{}).reduce((sum,x)=>sum+Number(x||0),0);
  }
  return [...evaluateAutomaticBadges({userId,month,dailyDays:me.dailyDays,mergedDraft:me.draft,pay:me.pay,competitionRows:rows,personalGoals:source.goals||{},lifetimeTotals})];
}
