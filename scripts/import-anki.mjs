import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
fs.mkdirSync('data/media',{recursive:true});
const source='research/collection.anki2';
if(!fs.existsSync(source)) throw Error('请先将 Anki 卡包中的 collection.anki2 和 media 提取到 research 目录');
const clean=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
const db=new DatabaseSync(source,{readOnly:true});
const media=JSON.parse(fs.readFileSync('research/media','utf8'));
const seen=new Set(); const words=[];
for(const row of db.prepare('select flds from notes order by id').all()){
 const f=row.flds.split('\x1f').map(clean),word=f[0].trim();
 if(seen.has(word.toLowerCase()))continue;seen.add(word.toLowerCase());
 const audio=f[2].match(/\[sound:([^\]]+)\]/)?.[1]||'';
 words.push({id:words.length+1,word,ipa:f[1],audio,english:f[3],chinese:f[4],core:f[4].split(/[；;\n]/)[0].trim(),example:f[5],pos:f[7],accent:'待核对美音',source:'Anki-IELTS v1.0.0'});
}
fs.writeFileSync('data/words.json',JSON.stringify(words));
fs.writeFileSync('data/media-map.json',JSON.stringify(media));
if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-Command',fs.readFileSync('scripts/extract-audio.ps1','utf8').replace('Split-Path -Parent $PSScriptRoot',"(Get-Location).Path")],{stdio:'inherit'});
console.log(`已导入 ${words.length} 个单词；原始音频口音仍待核对。`);
