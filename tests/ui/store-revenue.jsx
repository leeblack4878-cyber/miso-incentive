import React from 'react';
import {createRoot} from 'react-dom/client';
import StoreRevenue from '../../src/components/StoreRevenue';
import '../../src/index.css';
const actor=new URLSearchParams(location.search).get('actor');
const id=actor==='owner'?'f0329992-ced4-4407-b71d-ed58c5d74aaf':actor==='admin'?'a50a0979-acef-40b1-98b7-f05074f1c835':'employee';
createRoot(document.getElementById('root')).render(<div className="mx-auto max-w-3xl p-3"><StoreRevenue month="2026-10" authUserId={id} stores={['A','B']} payrollRows={[{id:'a',name:'직원가',branch:'A',pay:{total:3000000}},{id:'b',name:'직원나',branch:'A',pay:{total:2500000}}]}/></div>);
