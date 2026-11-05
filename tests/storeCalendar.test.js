import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,monthBounds,shiftMonth,validDate,calendarEvents,eventStatus,validateSchedule} from '../src/storeCalendar.js';
test('calendar civil date validation, leap days and month boundaries',()=>{assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2026-11-31'),false);assert.deepEqual(monthBounds('2028-02'),{from:'2028-02-01',to:'2028-02-29'});assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');assert.equal(calendarDays('2026-11')[0],'2026-11-01');});
test('calendar deduplicates source identity without merging distinct customer events',()=>{const call={id:'1',kind:'ob_call',date:'2026-11-05',call_result:'부재'},follow={id:'1',kind:'ob_followup',date:'2026-11-06',status:'pending'};assert.deepEqual(calendarEvents([call,call,follow],'ob'),[call,follow]);assert.equal(calendarEvents([call,follow]).length,0);assert.equal(eventStatus(call),'부재');assert.equal(eventStatus(follow),'예정');assert.equal(eventStatus({kind:'installation'}),'확인 필요');});
test('schedule validation does not accept rollover dates or empty titles',()=>{assert.ok(validateSchedule({title:' ',date:'2026-11-05'}));assert.ok(validateSchedule({title:'재케어',date:'2026-11-31'}));assert.ok(validateSchedule({title:'재케어',date:'2026-11-05',time:'24:00'}));assert.equal(validateSchedule({title:'고객 방문',date:'2026-11-05',time:'19:00',notes:'약속 확인'}),null);});

import {friendlyError} from '../src/errorMessages.js';
test('calendar concurrency and permission errors have actionable Korean messages',()=>{
 assert.match(friendlyError({message:'CALENDAR_STALE'}),/새로고침/);
 assert.match(friendlyError({message:'CALENDAR_FORBIDDEN'}),/본인 일정/);
 assert.match(friendlyError({message:'CALENDAR_USE_SPECIALIZED_EDITOR'}),/기존 고객 약속/);
});
