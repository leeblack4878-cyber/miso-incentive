import React from 'react';
import {createRoot} from 'react-dom/client';
import TodayWorkCard from '../../src/components/TodayWorkCard';
import SalesExpensePanel from '../../src/components/SalesExpensePanel';
import PolicyVersionNotice from '../../src/components/PolicyVersionNotice';
import {feedbackBridge} from '../../src/feedback';
import '../../src/index.css';
const won=value=>`${Number(value).toLocaleString()}원`;
function Fixture(){
 const [message,setMessage]=React.useState('');
 React.useEffect(()=>{feedbackBridge.toast=x=>setMessage(x.message);feedbackBridge.confirm=async()=>true;},[]);
 return <main className="p-4 space-y-4"><PolicyVersionNotice month="2026-10"/><TodayWorkCard userId="fixture" onNavigate={()=>{}} onGoInput={()=>{}} onOpenApprovals={()=>{}}/><SalesExpensePanel userId="fixture" month="2026-09" won={won} fmtInputNumber={String}/><div role="status">{message}</div></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
