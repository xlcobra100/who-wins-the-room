const fs=require('fs'),path=require('path');
const dir=process.argv[2];
const D=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))).filter(d=>d.protocol===2);
console.log('debates',D.length);
const words=s=>s.toLowerCase().replace(/[^a-z0-9%' ]+/g,' ').split(/\s+/).filter(Boolean);
const grams=(s,n)=>{const w=words(s),g=new Set();for(let i=0;i+n<=w.length;i++)g.add(w.slice(i,i+n).join(' '));return g;};
const STOP=new Set(['the','a','of','to','and','in','is','that','it','for','on','we','our','their','this','with','be','are','as','by','but','not','his','her','they','will','from','an','or','at','if']);
const shares=(why,speech,n=4)=>{const G=grams(speech,n);for(const g of grams(why,n)){const ws=g.split(' ');if(ws.filter(w=>!STOP.has(w)).length>=2&&G.has(g))return true;}return false;};
// 1. position bias in blind round 1 vs later rounds
const R={1:{A:0,B:0,U:0},2:{A:0,B:0,U:0},3:{A:0,B:0,U:0}};
let keep=0,keepN=0,sw={1:[0,0],2:[0,0]};
const echo={own:{1:0,2:0,3:0},opp:{1:0,2:0,3:0},n:0};
const dens={};
for(const d of D){
  for(const L of d.listeners){
    L.memory.forEach(m=>R[m.round][m.leanSide||'U']++);
    const l1=L.memory[0].leanSide, fin=L.memory[2].leanSide;
    if(l1==='A'||l1==='B'){keepN++; if(l1===fin)keep++;}
    for(const r of [1,2]){const a=L.memory[r-1].leanSide,b=L.memory[r].leanSide; if(a==='A'||a==='B'){sw[r][1]++; if(b!==a)sw[r][0]++;}}
    // echo of final why
    const v=fin, o=v==='A'?'B':'A', why=L.memory[2].why;
    echo.n++;
    for(const t of d.transcript){ if(t.side===v && shares(why,t.speech)) echo.own[t.round]++; if(t.side===o && shares(why,t.speech)) echo.opp[t.round]++; }
  }
  for(const t of d.transcript){const st=t.type.split('-')[0];const w=words(t.speech);const nums=w.filter(x=>/\d/.test(x)||/^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|percent|half|quarter)$/.test(x)).length;
    dens[st]=dens[st]||{n:0,w:0,num:0,you:0};dens[st].n++;dens[st].w+=w.length;dens[st].num+=nums;dens[st].you+=w.filter(x=>/^(families|family|people|ordinary|kitchen|children|mothers|workers|elites|insiders|experts|consultants)$/.test(x)).length;}
}
const pct=(a,b)=>(100*a/b).toFixed(0)+'%';
for(const r of [1,2,3]){const x=R[r];console.log(`R${r} leans: A(first) ${x.A}  B(second/last) ${x.B}  U ${x.U}  -> B share of decided ${pct(x.B,x.A+x.B)}`);}
console.log('R1 decided lean == final vote:',pct(keep,keepN),`(${keep}/${keepN})`);
console.log('switch rate from decided lean: R1->R2',pct(sw[1][0],sw[1][1]),' R2->R3',pct(sw[2][0],sw[2][1]));
console.log('final why shares a 4-gram with VOTED side speech  R1',pct(echo.own[1],echo.n),' R2',pct(echo.own[2],echo.n),' R3',pct(echo.own[3],echo.n));
console.log('final why shares a 4-gram with OTHER side speech   R1',pct(echo.opp[1],echo.n),' R2',pct(echo.opp[2],echo.n),' R3',pct(echo.opp[3],echo.n));
for(const [k,v] of Object.entries(dens))console.log(`style ${k}: ${(v.num/v.w*100).toFixed(1)} number-words per 100 words; ${(v.you/v.w*100).toFixed(1)} people/elite words per 100; mean ${(v.w/v.n).toFixed(0)} words/speech`);
// 5-0 rate vs independent-judges expectation
let fives=0;const pv=[];for(const d of D){const a=d.votes.A,b=d.votes.B;if(a===5||b===5)fives++;}
console.log('5-0 debates',pct(fives,D.length));
