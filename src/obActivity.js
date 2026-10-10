export const OB_PURPOSES=['기변 권유','선약 안내','홈상품 권유','고객 케어','기타'];
export const OB_RESULTS=['부재','선단절','통화 거절','통화 완료','기타'];
export const OB_REACTIONS=['거부','관심 없음','관심 있음','재연락 희망'];
export const subscriptionKey=value=>String(value||'').replace(/\s/g,'').toUpperCase();
export const phoneDigits=value=>String(value||'').replace(/[^0-9]/g,'');
export function koreaDate(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function obSummary(rows=[]){
 const connected=rows.filter(r=>r.call_result==='통화 완료').length;
 return {activity:rows.length,connected,rate:rows.length?Math.round(connected/rows.length*100):0,
 interested:rows.filter(r=>r.call_result==='통화 완료'&&r.reaction==='관심 있음').length,visits:rows.filter(r=>r.visit_at).length};
}
export function latestObCustomers(rows=[]){
 const latest=new Map();
 for(const row of rows){const key=subscriptionKey(row.subscription_number);const old=latest.get(key);if(!old||row.contacted_at>old.contacted_at||row.contacted_at===old.contacted_at&&row.id>old.id)latest.set(key,row);}
 return [...latest.values()];
}
export function validateObDraft(d){
 if(!String(d.customer_name||'').trim()||!subscriptionKey(d.subscription_number)||!phoneDigits(d.phone))return '고객명·가입번호·연락처를 모두 입력해주세요.';
 if(String(d.customer_name).trim().length>80||subscriptionKey(d.subscription_number).length>60)return '고객명 또는 가입번호가 너무 길어요.';
 if(!/^[0-9]{8,15}$/.test(phoneDigits(d.phone)))return '연락처를 확인해주세요.';
 if(!OB_PURPOSES.includes(d.purpose)||!OB_RESULTS.includes(d.call_result))return 'OB콜 목적과 통화 결과를 선택해주세요.';
 if(d.call_result==='통화 완료'&&!OB_REACTIONS.includes(d.reaction))return '통화 완료 시 고객 반응을 선택해주세요.';
 if(String(d.memo||'').length>2000)return '메모는 2,000자 이내로 입력해주세요.';
 return null;
}
export function obTel(value){const digits=phoneDigits(value);return /^[0-9]{8,15}$/.test(digits)?`tel:${digits}`:null;}
