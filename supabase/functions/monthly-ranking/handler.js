import { captureManagerProgress, latestManagerProgress } from './manager-progress.js';

export async function monthlyRankingRequest(req,admin,calculate,calculateProgress){
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
 if(req.method==='OPTIONS')return reply(null);
 if(req.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return reply({error:'UNAUTHORIZED'},401);
  const body=await req.json();
  if(body?.view==='capture-manager-progress'){
   const {data:allowed,error}=await admin.rpc('authorize_manager_progress_capture',{p_token:token});
   if(error||allowed!==true)return reply({error:'UNAUTHORIZED'},401);
   return reply(await captureManagerProgress(admin,calculateProgress));
  }
  const {data:{user},error}=await admin.auth.getUser(token);if(error||!user)return reply({error:'UNAUTHORIZED'},401);
  if(!body||Object.keys(body).some(k=>k!=='month'&&k!=='view')||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.month))return reply({error:'INVALID_MONTH'},400);
  const progress=body.view==='manager-progress';
  if(body.view!==undefined&&(!progress||body.month!=='2026-11'))return reply({error:'INVALID_VIEW'},400);
  const {data:profile,error:pe}=await admin.from('profiles').select(progress?'id,active,status,role,position,store_name':'id,active,status').eq('id',user.id).maybeSingle();
  if(pe||!profile||profile.active!==true||profile.status!=='approved')return reply({error:'APPROVED_ACTIVE_PROFILE_REQUIRED'},403);
  const storeLeader=profile.role==='manager'&&['점장','부점장'].includes(profile.position)
    &&profile.store_name&&!['휴직','운영진','영업지원팀'].includes(profile.store_name);
  if(progress&&!storeLeader&&!['admin','super_admin'].includes(profile.role))return reply({error:'MANAGER_REQUIRED'},403);
  if(progress)return reply(await latestManagerProgress(admin,body.month,profile));
  const {data:snapshot,error:se}=await admin.rpc('badge_source_snapshot',{p_user_id:user.id,p_month:body.month});if(se||!snapshot?.source)return reply({error:'RANKING_UNAVAILABLE'},503);
  const {data:names,error:ne}=await admin.from('profiles').select('id,name,position').eq('active',true).eq('status','approved');if(ne)return reply({error:'RANKING_UNAVAILABLE'},503);
  return reply({month:body.month,rows:calculate(snapshot.source,body.month,names||[])});
 }catch{return reply({error:'RANKING_UNAVAILABLE'},503);}
}
