import React from 'react';
import {createRoot} from 'react-dom/client';
import {ManagerEvaluationPanel} from '../../src/components/EvaluationViews';
import {emptyDraft} from '../../src/viewShared';
import {feedbackBridge} from '../../src/feedback';
import '../../src/index.css';
const store='신천동_삼미시장점';
const draft=emptyDraft();draft.matrix[0][0]=20;
function Fixture(){
 const [message,setMessage]=React.useState('');
 React.useEffect(()=>{feedbackBridge.toast=x=>setMessage(x.message);},[]);
 return <main className="p-3"><ManagerEvaluationPanel month="2026-09" employees={[{id:'fixture',branch:store,name:'테스트',position:'점장'}]} rows={[{branch:store,draft,pay:{kpiScore:30,strategicPoints:12}}]} authUserId="fixture" canSwitchStores/><output role="status">{message}</output></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
