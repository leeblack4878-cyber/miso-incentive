import { hsCount, HS_PARTS, matrixRowCount, MATRIX_ROWS } from './appShared';
import { completedHomeCount } from './policyRules';

export function managerActualFromDraft(d,key){
  if(key==='hs')return hsCount(d);
  if(key==='plan115')return HS_PARTS.reduce((sum,part)=>sum+Number(d.matrix?.[part.idx]?.[0]||0),0);
  const hsMnp=matrixRowCount(d,MATRIX_ROWS.indexOf('일반모델 MNP'));
  const simMnp=(d.matrix?.[5]||[]).reduce((s,v)=>s+Number(v||0),0);
  // AA 임팩트의 MNP 항목은 일반 MNP와 SIM MNP를 합산한다.
  if(key==='mnp')return hsMnp+simMnp;
  if(key==='simMnp')return simMnp;
  if(key==='subTvHousehold')return Number(d.homeAddon?.addSetTop||0)+Number(d.homeFlat?.tvFree||0);
  if(key==='tvFree')return Number(d.homeFlat?.tvFree||0);
  if(key==='smartHome')return Number(d.homeFlat?.smartHome||0);
  if(key==='second')return Object.values(d.bundle2nd||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='tailoredCount')return Number(d.tailoredCount||0);
  if(key==='otherCustomer')return Number(d.custRegCount||0);
  if(key==='tailoredAmount')return Number(d.tailoredAmount||0);
  if(key==='daemyung')return Object.values(d.sono||{}).reduce((s,v)=>s+Number(v||0),0);
  if(key==='prospectMnp')return 0;
  if(key==='home')return completedHomeCount(d);
  return 0;
}
