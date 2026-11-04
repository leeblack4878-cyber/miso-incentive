import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const manager='00000000-0000-0000-0000-000000000001';
const deputy='00000000-0000-0000-0000-000000000002';
const admin='a50a0979-acef-40b1-98b7-f05074f1c835';

test('AA company writes are admin-only while own-store evaluation writes remain scoped',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role authenticated; create role anon;
   create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;
   create table profiles(id uuid primary key,name text,role text,position text,store_name text,active boolean,status text);
   grant select on profiles to authenticated;
   create table aa_impact_monthly(month text primary key,metrics jsonb not null default '[]');
   create table manager_eval_monthly(month text,store_name text,verified_metrics jsonb not null default '{}',external_inputs jsonb not null default '{}',primary key(month,store_name));
   alter table aa_impact_monthly enable row level security;
   alter table manager_eval_monthly enable row level security;
   grant select,insert,update,delete on aa_impact_monthly,manager_eval_monthly to authenticated,anon;
   create policy aa_impact_manager_only on aa_impact_monthly for all to authenticated using(exists(select 1 from profiles where id=auth.uid() and role in ('manager','admin')));
   insert into profiles values
    ('${manager}','Test manager','manager','점장','Store A',true,'approved'),
    ('${deputy}','Test deputy','manager','부점장','Store A',true,'approved'),
    ('${admin}','Test admin','admin','대표','운영진',true,'approved');
   insert into aa_impact_monthly values('2000-01','[]');
   insert into manager_eval_monthly(month,store_name) values('2000-01','Store B');
  `);
  const scope=read('sql/bind_permission_scopes_to_ids.sql').match(/create or replace function public\.can_write_target[\s\S]*?\$\$;/i)?.[0];
  assert.ok(scope,'Use the real checked-in target-scope function');
  await db.exec(scope);
  await db.exec(read('supabase/migrations/20261102051022_november_manager_store_edit.sql'));
  await db.exec(read('supabase/migrations/20261104035515_restrict_company_aa_writes.sql'));
  const as=async id=>db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`);
  const denied=sql=>assert.rejects(db.query(sql),error=>error.code==='42501');
  for(const id of [manager,deputy]) {
   await as(id);
   assert.equal((await db.query('select * from aa_impact_monthly')).rows.length,1);
   await denied(`insert into aa_impact_monthly values('2000-02','[]')`);
   await denied(`insert into aa_impact_monthly values('2000-01','[]') on conflict(month) do update set metrics=excluded.metrics`);
   assert.equal((await db.query(`update aa_impact_monthly set metrics='[1]' returning *`)).rows.length,0);
   assert.equal((await db.query(`delete from aa_impact_monthly returning *`)).rows.length,0);
   await db.query(`insert into manager_eval_monthly(month,store_name) values('2000-01','Store A') on conflict do nothing`);
   assert.equal((await db.query(`update manager_eval_monthly set verified_metrics='{"hs":55}' where store_name='Store A' returning *`)).rows.length,1);
   await denied(`insert into manager_eval_monthly(month,store_name) values('2000-02','Store B')`);
   assert.equal((await db.query(`update manager_eval_monthly set verified_metrics='{"hs":99}' where store_name='Store B' returning *`)).rows.length,0);
   await denied(`update manager_eval_monthly set store_name='Store B' where store_name='Store A'`);
   await denied(`update manager_eval_monthly set month='2000-03' where store_name='Store A'`);
   for(const key of ['companyNoExperienceRate','companyAixioRate','companyTailTagCount','companyNpsScore','companyAaScore','closing']) {
    await denied(`update manager_eval_monthly set external_inputs=jsonb_build_object('${key}',1) where store_name='Store A'`);
   }
  }
  await as(admin);
  await db.query(`insert into aa_impact_monthly values('2000-02','[]')`);
  assert.equal((await db.query(`update aa_impact_monthly set metrics='[1]' where month='2000-02' returning *`)).rows.length,1);
  assert.equal((await db.query(`delete from aa_impact_monthly where month='2000-02' returning *`)).rows.length,1);
  for(const change of ["active=false","status='pending'","role='employee'"]) {
   await db.exec(`reset role; update profiles set active=true,status='approved',role='admin' where id='${admin}'; update profiles set ${change} where id='${admin}';`);
   await as(admin);
   assert.equal((await db.query('select * from aa_impact_monthly')).rows.length,0);
   await denied(`insert into aa_impact_monthly values('2000-02','[]')`);
  }
  await db.exec('reset role; set role anon');
  assert.equal((await db.query('select * from aa_impact_monthly')).rows.length,0);
  await denied(`insert into aa_impact_monthly values('2000-02','[]')`);
 } finally {await db.close();}
});
