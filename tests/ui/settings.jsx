// Component rendering with mocked API. No Auth/RLS coverage is claimed.
import React,{useState,Suspense,lazy} from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
const Rates=lazy(()=>import('../../src/components/RatesManager'));
const Permissions=lazy(()=>import('../../src/components/PermissionsManager'));
const config={mobilePointItems:[],kpiItems:[],categoryMap:[],gibyeonColumnMap:[],
 basePay:{점장:1000,부점장:1000,매니저:1000,사원:1000,기타:0},positionAllowance:{},tenure:[],tenureCap:2300000,
 ...Object.fromEntries(['grades','homeTiers','homeFlat','homeAddon','renew','vas','bundle2nd','sono','mnpBundle','custRegTiers','tailoredTiers'].map(k=>[k,[]])),
 matrix:Array.from({length:8},()=>Array(6).fill(0))};
function Harness(){
 const [saved,setSaved]=useState(null);
 return <main className="p-3"><Suspense fallback={<p>불러오는 중</p>}>
 {location.search.includes('permissions')?<Permissions employees={[{id:'fixture-employee',name:'권한화면 긴이름검증',branch:'대야동_롯데마트점',position:'사원',role:'employee'}]}/>:<Rates config={config} persistConfig={setSaved}/>}
 </Suspense>{saved&&<output data-testid="saved-config">{JSON.stringify(saved)}</output>}</main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
