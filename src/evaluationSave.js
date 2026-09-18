// Compare the loaded values in the same UPDATE, so an older tab cannot overwrite
// a newly imported company report. Supabase RLS remains the authorization gate.
export async function saveEvaluationSnapshot(client,{previous,payload}){
  let request;
  if(previous?.month){
    request=client.from('manager_eval_monthly').update(payload)
      .eq('month',previous.month).eq('store_name',previous.store_name)
      .eq('verified_metrics',JSON.stringify(previous.verified_metrics||{}))
      .eq('external_inputs',JSON.stringify(previous.external_inputs||{}));
    request=previous.verified_at?request.eq('verified_at',previous.verified_at):request.is('verified_at',null);
  }else request=client.from('manager_eval_monthly').insert(payload);
  const {data,error}=await request.select().single();
  if(error||!data){
    if(!data&&(!error||['PGRST116','23505'].includes(error.code)))throw new Error('자료가 변경됐거나 저장 권한이 없어요. 새로고침 후 다시 확인해주세요.');
    throw error;
  }
  return data;
}
