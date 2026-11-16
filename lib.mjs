import {createEmptyCard,fsrs,Rating} from 'ts-fsrs';
export const scheduler=fsrs({request_retention:.9,enable_fuzz:false});
export const day=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function shuffle(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
export function groupWords(words,size){const seen=new Set();return words.filter(w=>{const key=w.core.replace(/\s/g,'');if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,size)}
export function review(card,success,now=new Date()){
 if(card){card={...card,due:new Date(card.due),...(card.last_review?{last_review:new Date(card.last_review)}:{})}}
 return scheduler.next(card||createEmptyCard(now),now,success?Rating.Good:Rating.Again).card;
}
