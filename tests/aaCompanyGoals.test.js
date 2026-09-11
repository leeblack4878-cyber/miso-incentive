import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('9월 AA 회사 목표는 영업팀 확정표와 일치한다', () => {
  for (const [key, target] of [
    ['mnp', 209], ['simMnp', 84], ['tailoredAmount', 4120864],
    ['subTvHousehold', 77], ['tvFree', 65], ['smartHome', 28], ['otherCustomer', 360],
  ]) assert.match(app, new RegExp(`key:'${key}'.*target:${target}`));
});

test('AA MNP는 일반 MNP와 SIM MNP를 합산한다', () => {
  assert.match(app, /\{key:'mnp',label:'MNP \(HS MNP \+ SIM MNP\)',weight:8,target:209/);
  assert.match(app, /if\(key==='mnp'\)return hsMnp\+simMnp;/);
});

test('확정 HS 비중과 대명·타사개통 가점 목표를 적용한다', () => {
  const hs = [102,63,100,52,70,54,100,64,37,129,39,41,41];
  assert.equal(hs.reduce((sum,value)=>sum+value,0), 892);
  assert.equal(Number((102/892*100).toFixed(2)), 11.43);
  assert.equal(Number((129/892*100).toFixed(2)), 14.46);
  assert.match(app, /daemyungTarget=roundedTarget\(35\*share,'count'\)/);
  assert.match(app, /prospectTarget=roundedTarget\(21\*share,'count'\)/);
});
