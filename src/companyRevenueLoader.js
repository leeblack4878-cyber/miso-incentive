import {readAllPages} from './performanceRoster.js';
async function rows(factory){const r=await readAllPages(factory);if(r.error)throw r.error;return r.data||[];}
async function chunks(values,fetch){const out=[];for(let i=0;i<values.length;i+=100)out.push(...await fetch(values.slice(i,i+100)));return out;}
export async function loadCompanyRevenue(client,month){
 const [y,m]=month.split('-').map(Number),start=`${month}-01`,end=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
 const installed=await rows(()=>client.from('home_orders').select('*').eq('status','completed').gte('actual_install_date',start).lt('actual_install_date',end).order('id'));
 const dates=[...new Set(installed.map(o=>o.source_work_date).filter(Boolean))];
 // Include pending/cancelled siblings to avoid treating an unfinished TV bundle as internet-only.
 const orders=dates.length?await chunks(dates,part=>rows(()=>client.from('home_orders').select('*').in('source_work_date',part).order('id'))):[];
 const ids=[...new Set(orders.map(o=>o.id))];
 const homeSales=ids.length?await chunks(ids,part=>rows(()=>client.from('customer_sales').select('id,user_id,customer_id,source_type,source_ref,source_meta,sale_date').eq('source_type','home_order').in('source_ref',part).order('id'))):[];
 const earliest=[start,...dates].sort()[0];
 const mobile=await rows(()=>client.from('customer_sales').select('id,user_id,customer_id,source_type,source_meta,sale_date').in('source_type',['mobile','daily']).gte('sale_date',earliest).lt('sale_date',end).order('id'));
 return {sales:[...mobile,...homeSales],orders};
}
