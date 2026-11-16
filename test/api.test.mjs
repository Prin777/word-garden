import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
test('完整会话：失败不被纠正覆盖、幂等提交、恢复与用户隔离',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'word-garden-'));
 fs.writeFileSync(path.join(dir,'words.json'),JSON.stringify(Array.from({length:8},(_,i)=>({id:i+1,word:'word'+i,core:'释义'+i,chinese:'释义'+i,audio:'test.mp3',ipa:'',english:'meaning',example:'',pos:'noun'}))));
 const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,DATA_DIR:dir,PORT:'3097'},stdio:['ignore','pipe','pipe']});
 try{
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('服务启动超时')),15000);server.stdout.on('data',s=>{if(s.toString().includes('已启动')){clearTimeout(timeout);resolve()}});server.on('exit',c=>{clearTimeout(timeout);reject(Error('服务退出 '+c))})});
 const call=async(p,b,user=1)=>{const r=await fetch('http://127.0.0.1:3097/api/'+p+'?user='+user,{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify({...b,user}):undefined});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j};
 let s=await call('session',{mode:'spell'});const id=s.id,[a,b]=s.current.left;
 assert.equal(s.current.left.length,5);
 const wrong={session:id,word:a,chosen:b,attempt:'wrong-1'};
 s=await call('answer',wrong);assert.equal(s.graded,1);assert.equal(s.correct,0);
 s=await call('answer',wrong);assert.equal(s.graded,1);
 s=await call('answer',{session:id,word:a,chosen:a,attempt:'correct-1'});assert.equal(s.correct,0);assert.ok(s.current.done.includes(a));
 const resumed=await call('session',{mode:'spell'});assert.equal(resumed.id,id);assert.deepEqual(resumed.current,s.current);
 for(const word of s.current.left.filter(x=>x!==a)){s=await call('answer',{session:id,word,chosen:word,attempt:'loop-correct-'+word})}
 assert.equal(s.current.done.length,5);assert.equal(s.graded,4);assert.equal(s.correct,3);
 const list=await call('words');assert.equal(list.find(w=>w.id===a).errors,1);
 await call('users',{name:'隔离用户'});const users=await call('users');const u2=users.find(x=>x.name==='隔离用户');
 const isolated=await call('words',null,u2.id);assert.ok(isolated.every(w=>w.errors===0&&!w.learned));
 const listen=await call('session',{mode:'listen'});assert.notEqual(listen.id,id);
 const html=await fetch('http://127.0.0.1:3097/');assert.equal(html.status,200);assert.match(await html.text(),/单词小径/);
 }finally{server.kill();await new Promise(r=>server.once('exit',r));fs.rmSync(dir,{recursive:true,force:true})}
});
