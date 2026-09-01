import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ADMIN_ID="a50a0979-acef-40b1-98b7-f05074f1c835";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
function temporaryPassword(){const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";const bytes=crypto.getRandomValues(new Uint8Array(9));return `Miso!${Array.from(bytes,b=>alphabet[b%alphabet.length]).join("")}`;}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json(),action=String(body?.action||"");
    if(action==="request"){
      const email=String(body?.email||"").trim().toLowerCase();
      if(!email||email.length>254)return json({ok:true});
      const {data:list,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000});if(listError)throw listError;
      const target=(list.users||[]).find(user=>String(user.email||"").toLowerCase()===email);
      if(target){const {data:recent}=await admin.from("password_reset_requests").select("id").eq("target_user_id",target.id).eq("status","pending").gte("requested_at",new Date(Date.now()-10*60*1000).toISOString()).maybeSingle();if(!recent)await admin.from("password_reset_requests").insert({target_user_id:target.id,requested_email:email});}
      return json({ok:true});
    }
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!token)return json({error:"Unauthorized"},401);
    const {data:{user},error:userError}=await admin.auth.getUser(token);if(userError||!user)return json({error:"Unauthorized"},401);
    if(action==="complete"){
      const {error:profileError}=await admin.from("profiles").update({must_change_password:false}).eq("id",user.id);if(profileError)throw profileError;
      await admin.from("password_reset_requests").update({status:"completed",completed_at:new Date().toISOString()}).eq("target_user_id",user.id).eq("status","issued");return json({ok:true});
    }
    if(user.id!==ADMIN_ID)return json({error:"Forbidden"},403);
    const requestId=String(body?.requestId||"");
    const {data:requestRow,error:requestError}=await admin.from("password_reset_requests").select("id,target_user_id,status").eq("id",requestId).single();
    if(requestError||!requestRow||requestRow.status!=="pending")return json({error:"처리할 요청이 없어요."},409);
    if(action==="reject"){await admin.from("password_reset_requests").update({status:"rejected",reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",requestId);return json({ok:true});}
    if(action!=="issue")return json({error:"Unknown action"},400);
    const password=temporaryPassword();const {error:passwordError}=await admin.auth.admin.updateUserById(requestRow.target_user_id,{password});if(passwordError)throw passwordError;
    const {error:profileError}=await admin.from("profiles").update({must_change_password:true}).eq("id",requestRow.target_user_id);if(profileError)throw profileError;
    const {error:updateError}=await admin.from("password_reset_requests").update({status:"issued",reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",requestId);if(updateError)throw updateError;
    return json({ok:true,temporaryPassword:password});
  }catch(error){console.error(error);return json({error:String(error?.message||error)},500)}
});
