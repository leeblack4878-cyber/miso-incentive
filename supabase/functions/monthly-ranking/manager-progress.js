const COMPANY_AMOUNT_VIEWERS = new Set([
 'a50a0979-acef-40b1-98b7-f05074f1c835', 'f0329992-ced4-4407-b71d-ed58c5d74aaf',
]);

export function maySeeProgressAmount(viewer, store) {
 return (['admin','super_admin'].includes(viewer.role) && COMPANY_AMOUNT_VIEWERS.has(viewer.id))
   || (viewer.role==='manager' && ['점장','부점장'].includes(viewer.position) && viewer.store_name===store);
}

export function progressSlot(now) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
   timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',minute:'2-digit',
 }).formatToParts(now).map(({type,value})=>[type,value]));
 const {year,month,day,hour,minute}=parts;
 if (!['10','15','21'].includes(hour) || Number(minute)>10) return null;
 return {month:`${year}-${month}`,slotAt:`${year}-${month}-${day}T${hour}:00:00+09:00`};
}

export async function latestManagerProgress(admin, month, profile) {
 const {data,error}=await admin.from('manager_progress_latest').select('slot_at,rows').eq('month',month).maybeSingle();
 if(error)throw error;
 return {
   month, slotAt:data?.slot_at??null,
   rows:(data?.rows??[]).map(({amounts,...row})=>maySeeProgressAmount(profile,row.store_name)?{...row,amounts}:row),
 };
}

export async function captureManagerProgress(admin, calculate, now = new Date()) {
 const slot=progressSlot(now);
 if(slot?.month!=='2026-11')return {skipped:true};
 const {data:profiles,error:profileError}=await admin.from('profiles').select('id')
   .eq('active',true).eq('status','approved').limit(1);
 if(profileError||!profiles?.length)throw new Error('Snapshot source unavailable');
 const [snapshot,verified]=await Promise.all([
   admin.rpc('badge_source_snapshot',{p_user_id:profiles[0].id,p_month:slot.month}),
   admin.from('manager_eval_monthly')
     .select('store_name,verified_at,managerBundleCount:verified_metrics->managerBundleCount,strategyModelCount:verified_metrics->strategyModelCount')
     .eq('month',slot.month),
 ]);
 if(snapshot.error||!snapshot.data?.source||verified.error)throw new Error('Snapshot source unavailable');
 const inputs=(verified.data??[]).map(({store_name,verified_at,managerBundleCount,strategyModelCount})=>({
   store_name,verified_at,verified_metrics:{managerBundleCount,strategyModelCount},
 }));
 const rows=calculate(snapshot.data.source,slot.month,inputs,now);
 const {error}=await admin.rpc('save_manager_progress_latest',{p_month:slot.month,p_slot_at:slot.slotAt,p_rows:rows});
 if(error)throw error;
 return {slotAt:slot.slotAt};
}
