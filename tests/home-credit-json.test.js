import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

// Exercise the actual SDK serialization used by both completion paths.
const source=readFileSync(new URL('../src/components/HomeOrderManager.jsx',import.meta.url),'utf8');
const calls=[...source.matchAll(/\.contains\('source_refs',([^;]+?)\)\.maybeSingle\(\)/g)];
test('single and batch completion both use valid JSONB containment over the wire',async()=>{
  assert.equal(calls.length,2);
  for(const call of calls){
    const order={id:'00000000-0000-4000-8000-000000000001'};
    const value=Function('order',`return ${call[1]}`)(order);
    let requests=0;
    const client=createClient('https://example.supabase.co','test-key',{global:{fetch:async url=>{
      requests++;
      const params=new URL(url).searchParams;
      assert.equal(params.get('source_type'),'eq.home');
      const filter=params.get('source_refs');
      assert.equal(filter,'cs.'+JSON.stringify([order.id]));
      assert.deepEqual(JSON.parse(filter.slice(3)),[order.id]);
      return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    }}});
    const result=await client.from('team_sales_credits').select('id,credited_store').eq('source_type','home').contains('source_refs',value).maybeSingle();
    assert.equal(result.error,null);
    assert.equal(requests,1);
  }
});
