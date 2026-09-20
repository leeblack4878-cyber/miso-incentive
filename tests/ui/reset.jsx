import React from 'react';
import {createRoot} from 'react-dom/client';
import PerformanceResetPanel,{PerformanceResetApprovals} from '../../src/components/PerformanceResetPanel';
import '../../src/index.css';
const admin=new URLSearchParams(location.search).has('admin');
createRoot(document.getElementById('root')).render(<main className="p-3">{admin?<PerformanceResetApprovals month="2026-09" authUserId="manager" employees={[{id:'employee',name:'테스트 직원',branch:'테스트점'},{id:'manager',name:'관리자',branch:'테스트점'}]}/>:<PerformanceResetPanel month="2026-09" userId="employee"/>}</main>);
