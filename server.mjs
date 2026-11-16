import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {day,shuffle,groupWords,review} from './lib.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));process.chdir(root);
const data=process.env.DATA_DIR||path.join(root,'data');fs.mkdirSync(data,{recursive:true});
const db=new DatabaseSync(path.join(data,'learning.sqlite'));db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,active INTEGER DEFAULT 1,target INTEGER DEFAULT 10,size INTEGER DEFAULT 5); INSERT OR IGNORE INTO users(id,name) VALUES(1,'默认用户'); CREATE TABLE IF NOT EXISTS words(id INTEGER PRIMARY KEY,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS states(user INTEGER,word INTEGER,mode TEXT,card TEXT,errors INTEGER DEFAULT 0,seen TEXT,PRIMARY KEY(user,word,mode)); CREATE TABLE IF NOT EXISTS plans(user INTEGER,date TEXT,ids TEXT,PRIMARY KEY(user,date)); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user INTEGER,mode TEXT,body TEXT,active INTEGER DEFAULT 1); CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user INTEGER,session TEXT,word INTEGER,chosen INTEGER,correct INTEGER,candidates INTEGER,time TEXT);`);
if(!db.prepare('select id from words limit 1').get()&&fs.existsSync(path.join(data,'words.json'))){const add=db.prepare('insert or ignore into words values(?,?)');db.exec('BEGIN');for(const w of JSON.parse(fs.readFileSync(path.join(data,'words.json'))))add.run(w.id,JSON.stringify(w));db.exec('COMMIT')}
const all=()=>db.prepare('select body from words order by id').all().map(x=>JSON.parse(x.body));
const audioMode = process.env.WORD_AUDIO_MODE || 'original';
const generateAudio = process.argv.includes('--generate-piper');
const piper = audioMode === 'original' && !generateAudio ? null : await import('./piper.mjs');
const batchDir = path.join(data, 'piper-media');
const piperWorker = audioMode === 'live' && !generateAudio ? await piper.createPiper(root) : null;
const getWord = db.prepare('select body from words where id=?');

if (generateAudio) {
  const words = all();
  let created = 0;
  let generator;
  await fs.promises.mkdir(batchDir, {recursive:true});
  try {
    for (const [index, word] of words.entries()) {
      const file = path.join(batchDir, piper.audioName(word));
      if (!fs.existsSync(file)) {
        generator ??= await piper.createPiper(root);
        const audio = await generator.synthesize(word.word.trim());
        const temporary = file + '.' + randomUUID() + '.tmp';
        try {
          await fs.promises.writeFile(temporary, audio);
          await fs.promises.rename(temporary, file);
        } finally {
          await fs.promises.rm(temporary, {force:true});
        }
        created++;
      }
      if ((index + 1) % 100 === 0) console.log(`Piper: ${index + 1}/${words.length}`);
    }
    console.log(`Piper: ${words.length} words ready, ${created} WAV files generated.`);
  } finally {
    generator?.close();
  }
}

async function pronunciation(id, res) {
  const row = getWord.get(id);
  if (!row) {
    res.writeHead(404).end();
    return;
  }
  const word = JSON.parse(row.body);
  if (audioMode === 'original') {
    if (word.audio) {
      res.writeHead(302, {Location:'/media/' + encodeURIComponent(word.audio)}).end();
    } else {
      res.writeHead(404).end();
    }
    return;
  }
  const audio = audioMode === 'live'
    ? await piperWorker.synthesize(word.word.trim())
    : await fs.promises.readFile(path.join(batchDir, piper.audioName(word)));
  res.writeHead(200, {'Content-Type':'audio/wav', 'Content-Length':audio.length, 'Cache-Control':'no-store'});
  res.end(audio);
}

const user=id=>{const u=db.prepare('select * from users where id=? and active=1').get(Number(id));if(!u)throw Error('用户不存在');return u};
function plan(u){let p=db.prepare('select ids from plans where user=? and date=?').get(u.id,day());if(p)return JSON.parse(p.ids);const prior=db.prepare('select ids from plans where user=? order by date desc limit 1').get(u.id);const seen=new Set(db.prepare('select distinct word from states where user=?').all(u.id).map(x=>x.word));const pending=prior?JSON.parse(prior.ids).filter(id=>!seen.has(id)):[];const ids=[...pending,...all().map(w=>w.id).filter(id=>!seen.has(id)&&!pending.includes(id))].slice(0,u.target);db.prepare('insert into plans values(?,?,?)').run(u.id,day(),JSON.stringify(ids));return ids}
function stateMap(uid,mode){return new Map(db.prepare('select * from states where user=? and mode=?').all(uid,mode).map(s=>[s.word,s]))}
function dueWords(uid,mode){const states=stateMap(uid,mode);return all().filter(w=>{const s=states.get(w.id);return s&&JSON.parse(s.card).due<=new Date().toISOString()}).sort((a,b)=>JSON.parse(states.get(a.id).card).due.localeCompare(JSON.parse(states.get(b.id).card).due))}
function save(s){db.prepare('update sessions set body=?,active=? where id=?').run(JSON.stringify(s),s.finished?0:1,s.id)}
function nextGroup(s){const words=all(),map=new Map(words.map(w=>[w.id,w]));const candidates=s.queue.map(id=>map.get(id)).filter(Boolean);const chosen=groupWords(candidates,s.size);const ids=chosen.map(w=>w.id);s.queue=s.queue.filter(id=>!ids.includes(id));s.round++;s.current={left:shuffle(ids),right:shuffle(ids),done:[],failed:[],evaluated:[]};if(!ids.length){s.finished=true;s.current=null}save(s);return s}
function publicSession(s){const map=new Map(all().map(w=>[w.id,w]));return {...s,words:s.current?s.current.left.map(id=>map.get(id)):[],errorWords:s.errors.map(id=>map.get(id)),newCount:s.completed.filter(id=>plan(user(s.user)).includes(id)).length,reviewCount:s.completed.filter(id=>!plan(user(s.user)).includes(id)).length}}
async function body(req){let str='';for await(const chunk of req){str+=chunk;if(str.length>100000)throw Error('请求过大')}return str?JSON.parse(str):{}}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
async function api(req,url){const b=req.method==='GET'?{}:await body(req);const p=url.pathname;
 if(p==='/api/users'&&req.method==='GET')return db.prepare('select * from users where active=1').all();
 if(p==='/api/users'&&req.method==='POST'){const name=String(b.name||'').trim().slice(0,40);if(!name)throw Error('请填写用户名称');if(b.id){user(b.id);db.prepare('update users set name=? where id=?').run(name,b.id)}else db.prepare('insert into users(name) values(?)').run(name);return {ok:true}}
 const u=user(url.searchParams.get('user')||b.user||1);
 if(p==='/api/settings'){if(!Number.isInteger(b.target)||b.target<1||b.target>100||!Number.isInteger(b.size)||b.size<5||b.size>10)throw Error('每日新词需为 1–100，每组数量需为 5–10');db.prepare('update users set target=?,size=? where id=?').run(b.target,b.size,u.id);return {ok:true}}
 if(p==='/api/dashboard'){const ids=plan(u);const today=db.prepare('select distinct word from states where user=? and seen=?').all(u.id,day()).map(x=>x.word);const sessions=db.prepare('select body from sessions where user=? and active=1').all(u.id).map(x=>JSON.parse(x.body));return {user:u,ids,done:ids.filter(id=>today.includes(id)).length,due:{spell:dueWords(u.id,'spell').length,listen:dueWords(u.id,'listen').length},sessions,total:all().length}}
 if(p==='/api/words'){const mode=url.searchParams.get('mode')||'spell';const states=stateMap(u.id,mode),ids=plan(u);let words=all();const scope=url.searchParams.get('scope');if(scope==='new')words=words.filter(w=>ids.includes(w.id));if(scope==='review')words=dueWords(u.id,mode);const q=url.searchParams.get('q')?.toLowerCase();if(q)words=words.filter(w=>`${w.word} ${w.chinese}`.toLowerCase().includes(q));return words.slice(0,scope==='all'?100:1000).map(w=>({...w,errors:states.get(w.id)?.errors||0,learned:!!states.get(w.id)}))}
 if(p==='/api/word'&&req.method==='POST'){const row=db.prepare('select body from words where id=?').get(b.id);if(!row)throw Error('单词不存在');const w=JSON.parse(row.body);for(const key of ['core','ipa','chinese','english'])if(typeof b[key]==='string')w[key]=b[key].trim().slice(0,10000);if(!w.core)throw Error('核心释义不能为空');db.prepare('update words set body=? where id=?').run(JSON.stringify(w),w.id);return {ok:true}}
 if(p==='/api/session'&&req.method==='POST'){if(!['spell','listen'].includes(b.mode))throw Error('未知模式');const prior=db.prepare('select body from sessions where user=? and mode=? and active=1').get(u.id,b.mode);if(prior)return publicSession(JSON.parse(prior.body));const states=stateMap(u.id,b.mode);const newIds=plan(u).filter(id=>!states.has(id));const queue=[...dueWords(u.id,b.mode).map(w=>w.id),...newIds];const s={id:randomUUID(),user:u.id,mode:b.mode,size:u.size,queue:[...new Set(queue)].filter(id=>b.mode!=='listen'||audioMode!=='original'||JSON.parse(getWord.get(id)?.body || '{}').audio),round:0,current:null,finished:false,correct:0,graded:0,errors:[],completed:[],retry:[]};db.prepare('insert into sessions values(?,?,?,?,1)').run(s.id,u.id,s.mode,JSON.stringify(s));return publicSession(nextGroup(s))}
 if(p==='/api/next'){const row=db.prepare('select body from sessions where id=? and user=?').get(b.session,u.id);if(!row)throw Error('练习不存在');const s=JSON.parse(row.body);if(s.finished)return publicSession(s);if(s.current.done.length!==s.current.left.length)throw Error('请先完成本组');for(const id of s.retry){if(!s.queue.includes(id))s.queue.push(id)}s.retry=[];return publicSession(nextGroup(s))}
 if(p==='/api/answer'){if(typeof b.attempt!=='string'||b.attempt.length>100)throw Error('作答标识无效');const row=db.prepare('select body from sessions where id=? and user=?').get(b.session,u.id);if(!row)throw Error('练习不存在');const s=JSON.parse(row.body);if(db.prepare('select id from attempts where id=?').get(b.attempt))return publicSession(s);const c=s.current;if(s.finished||!c||!c.left.includes(b.word)||!c.right.includes(b.chosen)||c.done.includes(b.word)||c.done.includes(b.chosen))throw Error('本题状态已变化，请刷新');const correct=b.word===b.chosen,n=c.left.length-c.done.length,now=new Date();db.exec('BEGIN IMMEDIATE');try{db.prepare('insert into attempts values(?,?,?,?,?,?,?,?)').run(b.attempt,u.id,s.id,b.word,b.chosen,Number(correct),n,now.toISOString());let old=db.prepare('select * from states where user=? and word=? and mode=?').get(u.id,b.word,s.mode);const first=!c.evaluated.includes(b.word);let card=old?JSON.parse(old.card):null;let errors=old?.errors||0;if(!correct){errors++;if(!c.failed.includes(b.word))c.failed.push(b.word);if(!s.errors.includes(b.word))s.errors.push(b.word)}if(first&&(!correct||n>1)){card=review(card,correct,now);c.evaluated.push(b.word);s.graded++;if(correct)s.correct++}if(!card){card=review(null,false,now)}if(correct){c.done.push(b.word);if(!s.completed.includes(b.word))s.completed.push(b.word);if(c.failed.includes(b.word)&&!s.retry.includes(b.word)&&!s.retried?.includes(b.word)){s.retry.push(b.word);s.retried=[...(s.retried||[]),b.word]}}db.prepare('insert into states values(?,?,?,?,?,?) on conflict(user,word,mode) do update set card=excluded.card,errors=excluded.errors,seen=excluded.seen').run(u.id,b.word,s.mode,JSON.stringify(card),errors,correct?day():(old?.seen||''));save(s);db.exec('COMMIT');return {...publicSession(s),answerCorrect:correct}}catch(e){db.exec('ROLLBACK');throw e}}
 throw Error('未知操作');
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const pronunciationId = req.method === 'GET' && url.pathname.match(/^\/pronunciation\/(\d+)$/);if(pronunciationId){await pronunciation(Number(pronunciationId[1]),res);return}if(url.pathname.startsWith('/api/')){const result=await api(req,url);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(result));return}const base=url.pathname.startsWith('/media/')?path.join(data,'media'):path.join(root,'public');const relative=url.pathname.startsWith('/media/')?url.pathname.slice(7):url.pathname==='/'?'index.html':url.pathname.slice(1);const file=path.resolve(base,decodeURIComponent(relative));if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res)}catch(e){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:e.message}))}});
if (!generateAudio) server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('单词小径已启动：http://localhost:'+(process.env.PORT||3000)));
