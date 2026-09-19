import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import CustomerCareManager from '../../src/components/CustomerCareManager';
import ReminderChoices from '../../src/components/ReminderChoices';
import '../../src/index.css';
function Fixture(){const [value,setValue]=useState({plan:'keep',services:{}});return <main><ReminderChoices value={value} onChange={setValue} services={[{key:'vasSafePass',label:'폰안심패스',insurance:true},{key:'vasKyobo',label:'교보문고',insurance:false}]}/><CustomerCareManager userId="fixture" month="2026-09" homeProps={{userId:'fixture',month:'2026-09',dailyDays:{}}}/></main>};
createRoot(document.getElementById('root')).render(<Fixture/>);
