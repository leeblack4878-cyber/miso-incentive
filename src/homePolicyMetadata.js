import {readAllPages} from './performanceRoster.js';
import {enrichHomeOrdersForPolicy} from './policyEngine.js';
// Installation month can differ from application month. Resolve metadata by
// source order ID so a Lite installation never silently becomes standard pay.
export async function loadHomePolicyMetadata(client,orders=[]) {
  const refs=[...new Set(orders.map(o=>o.id).filter(Boolean))],sales=[];
  for(let i=0;i<refs.length;i+=200){
    const {data,error}=await readAllPages(()=>client.from('customer_sales').select('source_ref,source_meta')
      .eq('source_type','home_order').in('source_ref',refs.slice(i,i+200)).order('id'));
    if(error)throw error;
    sales.push(...(data||[]));
  }
  return {orders:enrichHomeOrdersForPolicy(orders,sales),sales};
}
