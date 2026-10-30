export function companySohoGradeRate(count=0){return count>=20?154000:count>=15?143000:count>=10?132000:count>=5?110000:count>=3?88000:0;}
export function companySohoInternetCount(orders=[],month){
 return new Set(orders.filter(o=>o.network_type==='soho'&&o.status==='completed'&&o.actual_install_date?.startsWith(`${month}-`)&&['internet100','internet500','internet1g'].includes(o.product_type)).map(o=>o.id).filter(Boolean)).size;
}
