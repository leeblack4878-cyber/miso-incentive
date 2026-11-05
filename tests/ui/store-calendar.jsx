import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import StoreCalendar from '../../src/components/StoreCalendar';
import '../../src/index.css';
function Fixture(){const [month,setMonth]=useState('2026-11');return <main className="p-3"><StoreCalendar userId="employee-one" month={month} onMonthChange={setMonth} promiseTools={<p>원본 약속 관리 도구</p>} obTools={<p>원본 OB 활동 기록 도구</p>}/></main>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
