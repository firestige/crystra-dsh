import {diffArrays,diffLines,diffChars} from 'diff';
/** Exact sentence/line-boundary changes for the host's native DiffBlock. Never used for approval authority. */
export function consensusDiff(oldText,newText){
 // Retain punctuation and newlines verbatim. Chinese prose often puts a whole clause on one line.
 const tokens=text=>(text.match(/[^。！？\n]*[。！？\n]|[^。！？\n]+$/gu)??[]).flatMap(token=>{const prefix=token.match(/^[ \t]*[0-9]+[.)][ \t]+/)?.[0];return prefix?[prefix,token.slice(prefix.length)]:[token];});
 const changes=diffArrays(tokens(oldText),tokens(newText),{timeout:200,maxEditLength:10000});
 // A bounded fallback still preserves both complete bodies, without claiming a minimal diff.
 if(!changes)return [{kind:'modify',oldText,newText,fallback:true}];
 const parts=[];
 for(let i=0;i<changes.length;){
  if(!changes[i].added&&!changes[i].removed){parts.push({kind:'context',text:changes[i++].value.join('')});continue;}
  let oldText='',newText='';
  while(i<changes.length&&(changes[i].added||changes[i].removed)){const c=changes[i++];if(c.removed)oldText+=c.value.join('');else newText+=c.value.join('');}
  parts.push({kind:oldText&&newText?'modify':oldText?'delete':'add',oldText,newText});
 }
 return parts;
}

// Full source lines are retained; paired cells share one layout row and scroll container.
export function consensusDiffRows(oldText,newText){
 const lines=text=>text.match(/[^\n]*\n|[^\n]+$/g)??[];
 const changes=diffLines(oldText,newText,{timeout:200,maxEditLength:10000})??[{removed:true,value:oldText},{added:true,value:newText}];
 const rows=[];let oldNumber=0,newNumber=0;
 const cell=(text,side,segments)=>text===undefined?null:{number:side==='old'?++oldNumber:++newNumber,text,segments:segments??[{text,changed:false}]};
 for(let i=0;i<changes.length;){
  const c=changes[i];
  if(!c.added&&!c.removed){for(const text of lines(c.value))rows.push({kind:'context',old:cell(text,'old'),new:cell(text,'new')});i++;continue;}
  let old=[],next=[];
  while(i<changes.length&&(changes[i].added||changes[i].removed)){const c=changes[i++];if(c.removed)old.push(...lines(c.value));else next.push(...lines(c.value));}
  for(let j=0;j<Math.max(old.length,next.length);j++){
   const a=old[j],b=next[j];let left,right;
   if(a!==undefined&&b!==undefined){
    const chars=diffChars(a,b,{timeout:20,maxEditLength:4000});
    if(chars){left=chars.filter(c=>!c.added).map(c=>({text:c.value,changed:!!c.removed}));right=chars.filter(c=>!c.removed).map(c=>({text:c.value,changed:!!c.added}));}
   }
   rows.push({kind:a===undefined?'add':b===undefined?'delete':'modify',old:cell(a,'old',left??[{text:a??'',changed:true}]),new:cell(b,'new',right??[{text:b??'',changed:true}])});
  }
 }
 return rows;
}

// Review compares complete sentence/line units first. Word matching cannot cross
// those boundaries, and parenthetical phrases are indivisible display units.
function reviewSentenceUnits(oldText,newText){
 const units=text=>{
  const result=[];let buffer='',depth=0;
  for(const char of text){
   if(char==='\n'){if(buffer){result.push(buffer+char);buffer='';}else if(result.length&&!result.at(-1).endsWith('\n'))result[result.length-1]+=char;else result.push(char);depth=0;continue;}
   buffer+=char;if(char==='（'||char==='(')depth++;else if(char==='）'||char===')')depth=Math.max(0,depth-1);
   if(!depth&&'。！？；，'.includes(char)){result.push(buffer);buffer='';}
  }
  if(buffer)result.push(buffer);return result;
 };
 const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
 const words=text=>(text.match(/（[^（）\n]*）|\([^()\n]*\)|[^（）()]+|[（）()]/gu)??[]).flatMap(part=>/^(?:（.*）|\(.*\))$/u.test(part)?[part]:[...segmenter.segment(part)].map(s=>s.segment));
 const result=[];
 const push=(kind,text)=>{if(!text)return;const previous=result.at(-1);if(previous?.kind===kind)previous.text+=text;else result.push({kind,text});};
 const pair=(a,b)=>{
  const wa=words(a),wb=words(b);
  const changes=diffArrays(wa,wb,{timeout:20,maxEditLength:4000});
  // Unrelated phrases are whole replacements, rather than scattered shared words.
  const shared=changes?.filter(c=>!c.added&&!c.removed).flatMap(c=>c.value).filter(t=>/[\p{L}\p{N}]/u.test(t)).join('').length??0;
  if(!changes||(shared<6&&2*shared/Math.max(1,a.length+b.length)<.35)){push('delete',a);push('add',b);return;}
  const pieces=changes.map(c=>({kind:c.added?'add':c.removed?'delete':'context',text:c.value.join('')}));
  for(let i=0;i<pieces.length;){
   const p=pieces[i];if(p.kind==='context'){push('context',p.text);i++;continue;}
   let old='',next='';
   while(i<pieces.length){
    const p=pieces[i];
    if(p.kind==='delete'){old+=p.text;i++;continue;}
    if(p.kind==='add'){next+=p.text;i++;continue;}
    // Keep short connective islands inside the replacement rather than making
    // a phrase alternate red/unchanged/green just to reuse a grammatical word.
    if(i+1<pieces.length&&pieces[i+1].kind!=='context'&&/^[\p{Script=Han}]{1,4}$/u.test(p.text)){old+=p.text;next+=p.text;i++;continue;}
    // A one-character Chinese suffix (e.g. 性) is not a useful unchanged anchor.
    const first=[...segmenter.segment(p.text)][0]?.segment;
    if(old&&next&&first&&/^[\p{Script=Han}]$/u.test(first)){old+=first;next+=first;p.text=p.text.slice(first.length);}
    break;
   }
   push('delete',old);push('add',next);
  }

 };
 const old=units(oldText),next=units(newText);
 // Align sentence units monotonically by shared words, allowing inserted headings
 // and paragraphs to remain additions instead of consuming the next old sentence.
 if(old.length*next.length>20000){push('delete',oldText);push('add',newText);return result;}
 const bag=text=>{const m=new Map();for(const w of words(text))if(/[\p{L}\p{N}]/u.test(w))m.set(w,(m.get(w)??0)+1);return m;};
 const oldWords=old.map(bag),newWords=next.map(bag);
 const width=next.length+1,score=new Float64Array((old.length+1)*width),choice=new Uint8Array(score.length);
 for(let i=1;i<=old.length;i++)choice[i*width]=1;
 for(let j=1;j<=next.length;j++)choice[j]=2;
 for(let i=1;i<=old.length;i++)for(let j=1;j<=next.length;j++){
  const k=i*width+j,up=score[k-width],left=score[k-1];score[k]=Math.max(up,left);choice[k]=up>left?1:2;
  let shared=0;for(const [w,count] of oldWords[i-1])shared+=Math.min(count,newWords[j-1].get(w)??0)*w.length;
  const a=old[i-1],b=next[j-1],weight=a===b?Math.max(1,a.length*2):(shared>=6||2*shared/Math.max(1,a.length+b.length)>=.35)?shared:0;
  if(weight>0&&score[k-width-1]+weight>=score[k]){score[k]=score[k-width-1]+weight;choice[k]=3;}
 }
 const actions=[];let i=old.length,j=next.length;
 while(i||j){const c=choice[i*width+j];if(c===3){actions.push(['pair',old[--i],next[--j]]);}else if(c===1)actions.push(['delete',old[--i]]);else actions.push(['add',next[--j]]);}
 for(const [kind,a,b] of actions.reverse()){if(kind==='pair'){if(a===b)push('context',a);else pair(a,b);}else push(kind,a);}
 return result;
}

// Exact paragraph anchors isolate local work and preserve untouched prose even
// when a changed region reaches its bounded fine-comparison limit.
export function consensusReview(oldText,newText){
 if(oldText===newText)return oldText?[{kind:'context',text:oldText}]:[];
 const paragraphs=text=>text.match(/[\s\S]*?(?:\r?\n[ \t]*\r?\n|$)/g)?.filter(Boolean)??[];
 const changes=diffArrays(paragraphs(oldText),paragraphs(newText),{timeout:200,maxEditLength:10000});
 if(!changes)return [{kind:'delete',text:oldText},{kind:'add',text:newText}].filter(p=>p.text);
 const result=[];
 const push=(kind,text)=>{if(!text)return;const p=result.at(-1);if(p?.kind===kind)p.text+=text;else result.push({kind,text});};
 for(let i=0;i<changes.length;){
  const c=changes[i];if(!c.added&&!c.removed){push('context',c.value.join(''));i++;continue;}
  let a='',b='';while(i<changes.length&&(changes[i].added||changes[i].removed)){const c=changes[i++];if(c.removed)a+=c.value.join('');else b+=c.value.join('');}
  const fine=reviewSentenceUnits(a,b);
  const retained=fine.filter(p=>p.kind==='context').reduce((n,p)=>n+p.text.length,0);
  // When most of a changed paragraph region is rewritten, show the replacement
  // as a whole. A few coincidental shared words must not fragment that rewrite.
  const firstEdit=fine.findIndex(p=>p.kind!=='context'),lastEdit=fine.findLastIndex(p=>p.kind!=='context');
  const internalAnchor=fine.slice(firstEdit+1,lastEdit).some(p=>p.kind==='context'&&p.text.trim());
  if(a&&b&&internalAnchor&&retained/Math.max(1,Math.min(a.length,b.length))<.6){push('delete',a);push('add',b);}
  else for(const p of fine)push(p.kind,p.text);
 }
 return result;
}
