import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
import { calculateVerifiedBadges } from './calculator.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
Deno.serve(async(req)=>{
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL')!, token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
    if(!token)return reply({error:'UNAUTHORIZED'},401);
    const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await admin.auth.getUser(token);
    if(authError||!user)return reply({error:'UNAUTHORIZED'},401);
    const body=await req.json();
    if(Object.keys(body).some(k=>k!=='month')||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.month))return reply({error:'BADGE_REQUEST_INVALID'},400);
    for(let attempt=0;attempt<2;attempt++){
      const {data:snapshot,error}=await admin.rpc('badge_source_snapshot',{p_user_id:user.id,p_month:body.month});
      if(error)return reply({error:'BADGE_SOURCE_UNAVAILABLE'},409);
      const keys=calculateVerifiedBadges(snapshot.source,user.id,body.month);
      const saved=await admin.rpc('commit_verified_badges',{p_user_id:user.id,p_month:body.month,p_fingerprint:snapshot.fingerprint,p_badge_keys:keys});
      if(!saved.error)return reply({badges:saved.data});
      if(saved.error.message?.includes('BADGE_SOURCE_CHANGED'))continue;
      return reply({error:'BADGE_SAVE_FAILED'},500);
    }
    return reply({error:'BADGE_SOURCE_CHANGED'},409);
  }catch{return reply({error:'BADGE_SYNC_FAILED'},500);}
});
