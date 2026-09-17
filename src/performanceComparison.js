import {supabase} from './supabase';
import {applyDailyToDraft,normalizeDay,DAILY_GROUP_KEYS,DAILY_NUMERIC_KEYS,hsCount,computePay} from './appShared';
import {emptyDraft} from './viewShared';
import {homeOrdersForMonth,homePerformanceDate,calculateHomePolicyFromOrders,completedHomeCount} from './policyRules';
import {POLICY_HISTORY_CONFIG_KEY,resolvePolicyConfigForMonth} from './policyCalendar';
import {comparisonPeriods} from './performancePeriod';

// Rebuild only dated inputs for the same visible people. Monthly-only legacy
// totals cannot be assigned to a day and are deliberately excluded on both sides.
async function allPages(query,columns=['id']){
  const result=[];
  for(let offset=0;;offset+=1000){
    let request=query();for(const column of columns)request=request.order(column);
    const {data,error}=await request.range(offset,offset+999);
    if(error)throw error;
    result.push(...(data||[]));
    if((data||[]).length<1000)return result;
  }
}
function mergeDay(left,right){
  const a=normalizeDay(left),b=normalizeDay(right),groups={...a.groups};
  for(const group of DAILY_GROUP_KEYS){groups[group]={...(a.groups[group]||{})};for(const [key,value] of Object.entries(b.groups[group]||{}))groups[group][key]=Number(groups[group][key]||0)+Number(value||0);}
  const result={...a,groups,matrix:a.matrix.map((row,i)=>row.map((v,j)=>Number(v||0)+Number(b.matrix[i]?.[j]||0))),householdRenewals:[...(a.householdRenewals||[]),...(b.householdRenewals||[])]};
  for(const key of DAILY_NUMERIC_KEYS)result[key]=Number(a[key]||0)+Number(b[key]||0);
  return result;
}
function valuesFor(draft,config,month,mode){
  const sum=obj=>Object.values(obj||{}).reduce((n,v)=>n+Number(v||0),0);
  const free=Number(draft.homeFlat?.tvFree||0),smart=Number(draft.homeFlat?.smartHome||0),count=Number(draft.tailoredCount||0),amount=Number(draft.tailoredAmount||0);
  return {hs:hsCount(draft),simMnp:mode==='admin'?sum(draft.mnpBundle):sum(draft.matrix?.[5]),second:sum(draft.bundle2nd)+(mode==='admin'?0:sum(draft.matrix?.[7])),productivity:computePay(draft,'기타',null,month,config).kpiScore,home:completedHomeCount(draft),free,tvFree:free,smart,smartHome:smart,sono:sum(draft.sono),tailored:count,tailoredCount:count,upsell:count,tailoredAmount:amount,upsellAmount:amount};
}
const legacyProduct={homeOnly:['homeBase','homeOnly'],homeTv:['homeBase','homeTv'],tvFree:['homeFlat','tvFree'],smartHome:['homeFlat','smartHome'],internet100:['homeFlat','home100Only'],internet500:['homeFlat','home500Only'],internet1g:['homeFlat','home1GBOnly']};

export async function loadPerformanceComparison({month,rows,branches=[],config,mode='personal'}){
  const periods=comparisonPeriods(month);
  if(periods.future||!rows.length)return {current:null,previous:null};
  const ids=[...new Set(rows.filter(r=>!r.teamOnly&&!r.storeAggregate).map(r=>r.id).filter(Boolean))];
  const aggregate=rows.some(r=>r.storeAggregate);
  const {data:settings,error}=await supabase.from('app_config').select('config_key,value').in('config_key',['config',POLICY_HISTORY_CONFIG_KEY]);
  if(error)throw error;
  const saved=Object.fromEntries((settings||[]).map(r=>[r.config_key,r.value]));
  const legacy={...config,...(saved.config||{})};
  async function load(period,end){
    const from=`${period}-01`,to=`${period}-${String(end).padStart(2,'0')}`;
    const inPeriod=date=>String(date||'')>=from&&String(date||'').slice(0,10)<=to;
    const [daily,orders,sales,credits,anonymous]=await Promise.all([
      ids.length?allPages(()=>supabase.from('daily_records').select('user_id,work_date,data').in('user_id',ids).gte('work_date',from).lte('work_date',to),['work_date','user_id']):[],
      ids.length?allPages(()=>supabase.from('home_orders').select('id,user_id,customer_id,customer_name,product_type,network_type,sale_type,main_tv_plan,status,source_work_date,source_group,source_key,actual_install_date').in('user_id',ids).or(`source_work_date.gte.${from},actual_install_date.gte.${from}`)):[],
      ids.length?allPages(()=>supabase.from('customer_sales').select('id,source_ref').eq('source_type','home_order').in('user_id',ids).gte('sale_date',from).lte('sale_date',to)):[],
      mode!=='personal'&&branches.length?allPages(()=>supabase.from('team_sales_credits').select('id,credited_store,sale_date,source_type,metrics,is_completed').in('credited_store',branches).gte('sale_date',from).lte('sale_date',to)):[],
      aggregate?supabase.rpc('get_my_store_performance_days',{p_month:period}).then(({data,error})=>{if(error)throw error;return data||[];}):[],
    ]);
    const daysById={};let hasData=false;
    const add=(id,date,data)=>{if(!inPeriod(date))return;hasData=true;daysById[id]||={};const key=date.slice(8,10);daysById[id][key]=mergeDay(daysById[id][key],data);};
    for(const row of daily)if(ids.includes(row.user_id))add(row.user_id,row.work_date,row.data);
    for(const row of anonymous)add('aggregate',row.work_date,row.data);
    for(const row of credits)if(branches.includes(row.credited_store)&&(row.source_type!=='home'||row.is_completed))add(`team:${row.credited_store}`,row.sale_date,row.metrics);
    const linked=new Set(sales.map(r=>String(r.source_ref)));
    for(const order of orders){
      if(!ids.includes(order.user_id)||order.status!=='cancelled'||linked.has(String(order.id))||!inPeriod(order.source_work_date))continue;
      const day=daysById[order.user_id]?.[order.source_work_date.slice(8,10)];if(!day)continue;
      const fallback=legacyProduct[order.product_type],group=order.source_group||fallback?.[0],key=order.source_key||fallback?.[1];
      if(group&&key&&day.groups[group])day.groups[group][key]=Math.max(0,Number(day.groups[group][key]||0)-1);
    }
    const periodConfig=resolvePolicyConfigForMonth(period,legacy,saved[POLICY_HISTORY_CONFIG_KEY]);
    const completed=homeOrdersForMonth(orders,period,'completed').filter(o=>ids.includes(o.user_id)&&inPeriod(homePerformanceDate(o)));
    if(completed.length)hasData=true;
    if(!hasData)return null;
    const result={};
    for(const id of new Set([...Object.keys(daysById),...completed.map(o=>o.user_id)])){
      const draft=applyDailyToDraft(emptyDraft(),daysById[id]||{},period,periodConfig.categoryMap,periodConfig.gibyeonColumnMap);
      const homes=completed.filter(o=>o.user_id===id);
      if(homes.length)draft.homePolicy=calculateHomePolicyFromOrders(homes,periodConfig);
      for(const [key,value] of Object.entries(valuesFor(draft,periodConfig,period,mode)))result[key]=(result[key]||0)+value;
    }
    return result;
  }
  const [current,previous]=await Promise.all([load(month,periods.end),load(periods.previous,periods.previousEnd)]);
  return {current,previous};
}
