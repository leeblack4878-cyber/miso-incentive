import {novemberManagerGoals} from './novemberManagerPolicy.js';
// Read-time policy resolution only; never rewrites saved historical goal rows.
export function applyApprovedNovemberGoals(store,month,existing={}){if(month!=='2026-11')return {...existing};const {match,...goals}=novemberManagerGoals(store);return {...existing,...goals};}
