import React from 'react';
import {createRoot} from 'react-dom/client';
import HomeOrderManager from '../../src/components/HomeOrderManager';
import SalesExpensePanel from '../../src/components/SalesExpensePanel';
import '../../src/index.css';
createRoot(document.getElementById('root')).render(<main><HomeOrderManager userId="fixture" month="2026-09" dailyDays={{}}/><SalesExpensePanel userId="fixture" month="2026-09" won={x=>`${x.toLocaleString()}원`} fmtInputNumber={x=>x}/></main>);
