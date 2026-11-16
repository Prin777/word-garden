import test from 'node:test';
import assert from 'node:assert/strict';
import {day,groupWords,review} from '../lib.mjs';
test('计划日期以北京时间换日',()=>{assert.equal(day(new Date('2026-11-10T15:59:59Z')),'2026-11-10');assert.equal(day(new Date('2026-11-10T16:00:00Z')),'2026-11-11')});
test('同组释义排重并允许不足数量',()=>{const words=[{id:1,core:'准确'},{id:2,core:'准确'},{id:3,core:'传统'}];assert.deepEqual(groupWords(words,5).map(w=>w.id),[1,3])});
test('真实 FSRS 调度且 JSON 状态可恢复',()=>{const now=new Date('2026-11-10T00:00:00Z');const good=review(null,true,now),again=review(null,false,now);assert.ok(good.due>now);assert.ok(again.due>now);const restored=review(JSON.parse(JSON.stringify(good)),true,new Date('2026-11-15T00:00:00Z'));assert.ok(restored.reps>good.reps)});
