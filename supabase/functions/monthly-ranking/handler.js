export async function monthlyRankingRequest(req,admin,calculate){
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
 if(req.method==='OPTIONS')return reply(null);
 if(req.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return reply({error:'UNAUTHORIZED'},401);
  const {data:{user},error}=await admin.auth.getUser(token);if(error||!user)return reply({error:'UNAUTHORIZED'},401);
  const body=await req.json();if(!body||Object.keys(body).some(k=>k!=='month')||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.month))return reply({error:'INVALID_MONTH'},400);
  const {data:profile,error:pe}=await admin.from('profiles').select('id,active,status').eq('id',user.id).maybeSingle();
  if(pe||!profile||profile.active!==true||profile.status!=='approved')return reply({error:'APPROVED_ACTIVE_PROFILE_REQUIRED'},403);
  const {data:snapshot,error:se}=await admin.rpc('badge_source_snapshot',{p_user_id:user.id,p_month:body.month});if(se||!snapshot?.source)return reply({error:'RANKING_UNAVAILABLE'},503);
  const {data:names,error:ne}=await admin.from('profiles').select('id,name,position').eq('active',true).eq('status','approved');if(ne)return reply({error:'RANKING_UNAVAILABLE'},503);
  return reply({month:body.month,rows:calculate(snapshot.source,body.month,names||[])});
 }catch{return reply({error:'RANKING_UNAVAILABLE'},503);}
}
