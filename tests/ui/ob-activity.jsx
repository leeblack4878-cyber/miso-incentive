import React from 'react';
import {createRoot} from 'react-dom/client';
import ObActivityPanel from '../../src/components/ObActivityPanel';
import '../../src/index.css';
createRoot(document.getElementById('root')).render(<main className="p-3"><ObActivityPanel userId="ob-owner" admin={location.search.includes('admin')} employees={[{id:'ob-owner',name:'김미소',branch:'대야점'},{id:'ob-other',name:'이소원',branch:'상록점'},{id:'ob-zero',name:'활동없는직원',branch:'대야점'}]}/></main>);
