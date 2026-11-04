import React from 'react';
import {createRoot} from 'react-dom/client';
import {ManagerEvaluationPanel,ManagerPayrollPanel} from '../../src/components/EvaluationViews';
import {emptyDraft} from '../../src/viewShared';
import {feedbackBridge} from '../../src/feedback';
import '../../src/index.css';
const isManager=new URLSearchParams(location.search).has('manager');
const store=new URLSearchParams(location.search).get('suspended')==='1'?'신천동_삼미시장점':'신천동_삼미시장2호점';
const draft=emptyDraft();draft.matrix[0][0]=20;
const Panel=new URLSearchParams(location.search).has('payroll')?ManagerPayrollPanel:ManagerEvaluationPanel;
function Fixture(){
 const [message,setMessage]=React.useState('');
 React.useEffect(()=>{feedbackBridge.toast=x=>setMessage(x.message);},[]);
 return <main className="p-3"><Panel month={isManager?"2026-11":"2026-09"} employees={[{id:'fixture',branch:store,name:'테스트',position:'점장',role:isManager?'manager':'admin'}]} rows={[{branch:store,draft,pay:{kpiScore:30,strategicPoints:12}}]} authUserId="fixture" canSwitchStores={!isManager} loginBranch={store}/><output role="status">{message}</output></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
