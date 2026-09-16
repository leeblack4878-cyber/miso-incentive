import {readFile} from 'node:fs/promises';
export async function readAppSource(){
 return (await Promise.all(['App.jsx','appShared.jsx','viewShared.js','components/EvaluationViews.jsx','components/MonthlyPerformance.jsx','components/DailyInputTab.jsx','components/CustomerCareManager.jsx','components/HomeOrderManager.jsx'].map(p=>readFile(new URL(`../../src/${p}`,import.meta.url),'utf8')))).join('\n');
}
