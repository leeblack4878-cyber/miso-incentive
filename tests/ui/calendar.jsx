import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../../src/App';
import '../../src/index.css';
const id='00000000-0000-4000-8000-000000000001';
localStorage.setItem(`miso_quick_guide_v1:${id}`,'seen');
createRoot(document.getElementById('root')).render(<App authUser={{id,email:'calendar@example.test'}} authProfile={{id,name:'캘린더검증',store_name:'대야동_롯데마트점',position:'사원',role:'employee',active:true,status:'approved'}} onSignOut={()=>{}}/>);
