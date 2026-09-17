const monthDays = month => { const [y,m]=month.split('-').map(Number); return new Date(Date.UTC(y,m,0)).getUTCDate(); };
export function comparisonPeriods(month,now=new Date()) {
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now);
  const [y,m]=month.split('-').map(Number);
  const previous=new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7);
  const currentMonth=today.slice(0,7)===month;
  const end=currentMonth?Number(today.slice(8,10)):monthDays(month);
  const previousEnd=currentMonth?Math.min(end,monthDays(previous)):monthDays(previous);
  return {month,previous,end,previousEnd,future:month>today.slice(0,7),currentMonth};
}
export function comparisonChange(current,previous) {
  if(current==null||previous==null)return null;
  const difference=Number(current)-Number(previous);
  return {difference,percent:Number(previous)===0?null:difference/Math.abs(Number(previous))*100};
}
