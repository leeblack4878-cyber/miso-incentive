import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../supabase/migrations/20261105071453_shared_store_calendar.sql',import.meta.url),'utf8');
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const [owner,peer,manager,deputy,other,admin,pending]=[1,2,3,4,5,6,7].map(id);
const read=async db=>(await db.query("select read_store_calendar('2026-11-01','2026-11-30') as x")).rows[0].x;
const as=async(db,user)=>db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated`);
const fail=(db,sql,params=[],message)=>assert.rejects(db.query(sql,params),message?new RegExp(message):undefined);

test('store calendar RPC scope, fixed store, privacy, source integrity, history and OB facts',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role authenticated;create role anon;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 create table profiles(id uuid primary key,name text,role text,position text,store_name text,active boolean,status text);
 create table customers(id uuid primary key,user_id uuid,customer_name text);
 create table customer_tasks(id uuid primary key,user_id uuid,customer_id uuid,source_sale_id uuid,task_type text,title text,due_date date,note text,status text,completed_at timestamptz,updated_at timestamptz default now(),task_meta jsonb);
 create table home_orders(id bigint primary key,user_id uuid,customer_name text,product_type text,status text,planned_install_date date,actual_install_date date,completed_at timestamptz,updated_at timestamptz default now());
 create function public.can_write_target(target_user_id uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles v join public.profiles t on t.id=target_user_id where v.id=auth.uid() and v.role='manager' and v.store_name=t.store_name)$$;
 insert into profiles values ('${owner}','Owner','employee','사원','A',true,'approved'),('${peer}','Peer','employee','사원','A',true,'approved'),('${manager}','Manager','manager','점장','A',true,'approved'),('${deputy}','Deputy','manager','부점장','A',true,'approved'),('${other}','Other','manager','점장','B',true,'approved'),('${admin}','Admin','admin','대표','A',true,'approved'),('${pending}','Pending','employee','사원','A',true,'pending');
 insert into customers values('${id(20)}','${owner}','비밀고객');
 insert into customer_tasks(id,user_id,customer_id,task_type,title,due_date,status) values('${id(21)}','${owner}','${id(20)}','custom','Legacy','2026-11-05','pending');
 insert into home_orders(id,user_id,customer_name,product_type,status,planned_install_date) values(21,'${owner}','비밀고객','internet500','pending','2026-11-05');
 `);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261010082543_ob_contact_activity.sql',import.meta.url),'utf8'));
 await db.exec(migration);
 await as(db,owner);
 let x=await read(db);assert.equal(x.events.length,2);assert.ok(x.events.every(e=>e.legacy_store_basis));
 assert.ok(!JSON.stringify(x).includes('비밀고객'));
 await as(db,peer);assert.equal((await read(db)).events.length,0,'legacy does not leak to peers');
 await as(db,manager);assert.equal((await read(db)).events.length,2,'existing manager legacy scope retained');
 await as(db,deputy);assert.equal((await read(db)).events.length,0,'not a calendar proxy');
 await as(db,owner);
 const create="select save_store_schedule($1,null,null,$2,$3,$4,$5,$6,'pending') as id";
 const args=[id(30),'재케어','메모','2026-11-05','14:00','recare'];
 const sid=(await db.query(create,args)).rows[0].id;
 assert.equal((await db.query(create,args)).rows[0].id,sid,'same request retries exactly once');
 await fail(db,create,[id(30),'different','메모','2026-11-05','14:00','recare'],'REQUEST_CONFLICT');
 let s=(await read(db)).events.find(e=>e.source_id===sid);assert.equal(s.status,'pending');
 const update="select save_store_schedule($1,$2,$3,$4,$5,$6,$7,$8,$9)";
 const updateArgs=[id(31),sid,s.updated_at,'재케어','점장 처리','2026-11-06','15:00','recare','completed'];
 for(const u of [peer,deputy,other,admin]){await as(db,u);await fail(db,update,updateArgs,'FORBIDDEN');}
 await as(db,manager);await db.query(update,updateArgs);
 let history=(await db.query("select read_store_calendar_history('schedule',$1) as x",[sid])).rows[0].x;
 assert.equal(history.length,2);assert.equal(history[0].actor_id,manager);assert.equal(history[0].assignee_id,owner);assert.equal(history[0].is_proxy,true);assert.equal(history[0].actor_position,'점장');
 await fail(db,update,updateArgs,'STALE');
 // Direct table operations are denied even to manager, including forged actor/store/history.
 for(const sql of ['select * from store_schedules',"update store_schedules set store_name='B'",'delete from store_schedules','select * from store_calendar_history',"insert into store_calendar_history(source,source_id,assignee_id,actor_name,action) values('schedule','x',auth.uid(),'forged','update')"]){await fail(db,sql,[],'permission denied');}
 await db.exec(`reset role; insert into customer_tasks(id,user_id,customer_id,task_type,title,due_date,status) values('${id(22)}','${owner}','${id(20)}','custom','New promise','2026-11-05','pending'),('${id(23)}','${owner}','${id(20)}','usedPhone','Used phone','2026-11-05','pending'),('${id(24)}','${owner}','${id(20)}','affiliateCard','Card','2026-11-05','pending');
 insert into home_orders(id,user_id,customer_name,product_type,status,planned_install_date,actual_install_date,completed_at) values(22,'${owner}','비밀고객','homeTv','completed','2026-11-04','2026-11-06',null),(23,'${owner}','비밀고객','simulMnp','pending','2026-11-05',null,null),(24,'${owner}','비밀고객','internet500','cancelled','2026-11-05',null,null);
 update home_orders set planned_install_date='2026-11-07' where id=24; delete from home_orders where id=24;
 `);
 await as(db,peer);x=await read(db);assert.ok(x.events.some(e=>e.source_id===id(22)));assert.ok(!x.events.some(e=>e.source_id===id(21)));assert.ok(!x.events.some(e=>e.source==='home_order'&&e.source_id==='23'));
 const tv=x.events.find(e=>e.source==='home_order'&&e.source_id==='22');assert.equal(tv.title,'TV(주) 설치');assert.equal(tv.event_date,'2026-11-06');assert.equal(tv.can_edit,false);
 await as(db,manager);x=await read(db);
 for(const n of [23,24]){const e=x.events.find(e=>e.source_id===id(n));assert.equal(e.can_edit,false);await fail(db,"select update_calendar_promise($1,$2,'2026-11-05','','completed')",[id(n),e.updated_at],'SPECIALIZED');}
 const promise=x.events.find(e=>e.source_id===id(22));await db.query("select update_calendar_promise($1,$2,'2026-11-08','processed','completed')",[id(22),promise.updated_at]);
 history=(await db.query("select read_store_calendar_history('customer_task',$1) as x",[id(22)])).rows[0].x;assert.equal(history[0].is_proxy,true);
 // Original source history triggers handle all operations and do not break existing saves.
 await db.exec(`reset role; delete from customer_tasks where id='${id(22)}';`);
 await as(db,manager);history=(await db.query("select read_store_calendar_history('customer_task',$1) as x",[id(22)])).rows[0].x;assert.equal(history[0].action,'delete');
 // Immutable store is server-derived even for a forged insert value.
 await db.exec(`reset role; insert into customer_tasks(id,user_id,customer_id,task_type,title,due_date,status,calendar_store_name) values('${id(25)}','${owner}','${id(20)}','custom','fixed','2026-11-05','pending','B')`);
 assert.equal((await db.query(`select calendar_store_name from customer_tasks where id='${id(25)}'`)).rows[0].calendar_store_name,'A');
 await fail(db,`update customer_tasks set calendar_store_name='B' where id='${id(25)}'`,[],'IMMUTABLE');
 await db.exec(`update customer_tasks set status='cancelled',task_meta='{"cancel_reason":"home_cancelled"}' where id='${id(25)}'`);
 await as(db,manager);x=await read(db);const cancelled=x.events.find(e=>e.source_id===id(25));assert.equal(cancelled.can_edit,false);await fail(db,"select update_calendar_promise($1,$2,'2026-11-05','','pending')",[id(25),cancelled.updated_at],'SPECIALIZED');
 await db.exec('reset role');

 // OB same subscription across employees remains independent; latest per employee, Korean visit boundary.
 await db.exec(`insert into ob_contact_logs(id,request_id,user_id,employee_name,store_name,subscription_number,customer_name,phone,purpose,call_result,contact_date,contacted_at,follow_up_date,visit_at,memo) values
 ('${id(40)}','${id(140)}','${owner}','Old owner name','A','ACCOUNT','비밀고객','01012345678','고객 케어','부재',(now() at time zone 'Asia/Seoul')::date,'2026-11-04 12:00Z','2026-11-07','2026-11-07 16:00Z','old'),
 ('${id(41)}','${id(141)}','${owner}','Old owner name','A','ACCOUNT','비밀고객','01012345678','고객 케어','통화 거절',(now() at time zone 'Asia/Seoul')::date,'2026-11-05 12:00Z','2026-11-09','2026-11-08 16:00Z','new'),
 ('${id(42)}','${id(142)}','${peer}','Peer','A','ACCOUNT','비밀고객','01012345678','고객 케어','부재',(now() at time zone 'Asia/Seoul')::date,'2026-11-05 13:00Z','2026-11-10',null,'peer');`);
 await as(db,owner);x=await read(db);
 assert.equal(x.today_ob.filter(r=>r.user_id===owner).length,1,'name change no duplicated employee count');assert.equal(x.today_ob.find(r=>r.user_id===owner).activity,2);assert.equal(x.today_ob.find(r=>r.user_id===owner).connected,0);assert.equal(x.today_ob.find(r=>r.user_id===deputy).activity,0);
 assert.equal(x.events.filter(e=>e.kind==='ob_followup').length,2);assert.ok(!x.events.some(e=>e.kind==='ob_followup'&&e.source_id===id(40)));assert.equal(x.events.find(e=>e.kind==='ob_visit').event_date,'2026-11-09');
 assert.ok(!JSON.stringify(x).includes('01012345678'));assert.ok(!JSON.stringify(x).includes('ACCOUNT'));
 let obEvent=x.events.find(e=>e.kind==='ob_followup'&&e.assignee_id===owner);assert.equal(obEvent.status,'unconfirmed');
 const obUpdate="select update_calendar_ob($1,'ob_followup',$2,'handled','completed')";
 for(const u of [peer,deputy,other,admin]){await as(db,u);await fail(db,obUpdate,[id(41),obEvent.updated_at],'FORBIDDEN');}
 await as(db,manager);await db.query(obUpdate,[id(41),obEvent.updated_at]);x=await read(db);assert.equal(x.events.find(e=>e.kind==='ob_followup'&&e.assignee_id===owner).status,'completed');assert.equal(x.today_ob.find(r=>r.user_id===owner).activity,2,'handling never creates a call');
 await fail(db,obUpdate,[id(40),'2026-11-04T12:00:00Z'],'STALE');
 for(const sql of ["update store_calendar_ob_actions set status='completed'",'delete from store_calendar_ob_actions','select * from store_calendar_ob_actions'])await fail(db,sql,[],'permission denied');
 // Transfer keeps new records at original store, old owner loses shared access/write; new manager retains handling.
 await db.exec(`reset role;update profiles set store_name='B' where id='${owner}'`);
 await as(db,owner);x=await read(db);assert.ok(!x.events.some(e=>e.source_id===sid));assert.ok(!x.events.some(e=>e.source_id===id(25)));assert.ok(x.events.some(e=>e.source_id===id(21)),'legacy own read preserved, not relabeled history');
 await fail(db,update,updateArgs,'FORBIDDEN');
 await as(db,manager);x=await read(db);s=x.events.find(e=>e.source_id===sid);assert.equal(s.can_edit,true);await db.query(update,[id(32),sid,s.updated_at,'재케어','cancelled','2026-11-06','15:00','recare','cancelled']);
 // Inactive, unapproved, anonymous and invalid ranges fail closed.
 await as(db,pending);await fail(db,"select read_store_calendar('2026-11-01','2026-11-30')",[],'FORBIDDEN');
 await db.exec(`reset role;update profiles set active=false where id='${peer}'`);await as(db,peer);await fail(db,"select read_store_calendar('2026-11-01','2026-11-30')",[],'FORBIDDEN');
 await as(db,manager);await fail(db,"select read_store_calendar('2026-01-01','2026-11-30')",[],'DATE_RANGE');
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon");await fail(db,"select read_store_calendar('2026-11-01','2026-11-30')",[],'permission denied');
 }finally{await db.close();}
});
