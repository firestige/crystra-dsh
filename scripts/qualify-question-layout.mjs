// Geometry regression using the exact rc.2 stylesheet and semantic composer fixture.
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.CRYSTRA_PLAYWRIGHT_MODULE ?? 'playwright');
const source=await readFile(new URL('../node_modules/@deepseek-ai/dsh-client-ui-user-questions/lib/client.js',import.meta.url),'utf8');
const css=JSON.parse(source.match(/const css = ("\.Mbwy4a_frame[^\n]+);/)[1]);
const fix=await readFile(new URL('../src/client/questions/questions.css',import.meta.url),'utf8');
const b=await chromium.launch({headless:true,executablePath:process.env.CRYSTRA_CHROME_BINARY});
try{for(const width of [420,800,1280]){
const p=await b.newPage({viewport:{width,height:800}});
await p.setContent(`<style>${css}\n${fix}</style><div data-question-key="fixture" class="Mbwy4a_frame"><section class="Mbwy4a_card"><header class="Mbwy4a_header"><div class="Mbwy4a_headingBlock"><h2 class="Mbwy4a_title">${'多行长题干：\n背景说明和重复选项。'.repeat(30)}</h2></div></header><div class="Mbwy4a_body" data-question-scroll><div class="Mbwy4a_options">${['A','B','C'].map(v=>`<button class="Mbwy4a_option" role="radio">${v}. 候选选项</button>`).join('')}</div></div><footer class="Mbwy4a_footer">提交</footer></section></div>`);
const result=await p.evaluate(()=>{const h=document.querySelector('header'),o=document.querySelector('[role=radio]'),c=document.querySelector('section');return{header:h.getBoundingClientRect().height,option:o.getBoundingClientRect().height,card:c.getBoundingClientRect().height,body:document.querySelector('[data-question-scroll]').getBoundingClientRect().height,whiteSpace:getComputedStyle(document.querySelector('h2')).whiteSpace};});
console.log(width,result);if(result.body<80||result.card>521||result.whiteSpace!=='pre-wrap')throw Error('OPTIONS_NOT_VISIBLE');await p.close();}
}finally{await b.close();}
