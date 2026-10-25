/* =====================================================================
   EDUCAȚIE — short decision games with points and an explanation for
   every answer. All scenarios are fictional; every number is computed.
   ===================================================================== */
const Game=(()=>{
  const KEY='joc';
  let built=false,play=null;
  const st=()=>({points:0,answered:0,correct:0,streak:0,best:0,history:[],modes:{},budgetBest:null,...(Store.get(KEY)||{})});
  const LEVELS=[[0,'Începător'],[100,'Atent'],[250,'Priceput'],[500,'Expert']];
  function level(p){let cur=LEVELS[0],next=null;for(let i=0;i<LEVELS.length;i++){if(p>=LEVELS[i][0]){cur=LEVELS[i];next=LEVELS[i+1]||null}}return{name:cur[1],from:cur[0],next}}
  function award(mode,ok,pts){
    const s=st();const before=Savings.Rewards.got();const lvBefore=level(s.points).name;
    s.points+=pts;s.answered++;if(ok){s.correct++;s.streak++;s.best=Math.max(s.best,s.streak)}else s.streak=0;
    s.modes[mode]=s.modes[mode]||{n:0,ok:0};s.modes[mode].n++;if(ok)s.modes[mode].ok++;
    s.history=[...(s.history||[]),{mode,ok,pts,ts:Date.now()}].slice(-30);
    Store.set(KEY,s);
    const lv=level(s.points).name;if(lv!==lvBefore)setTimeout(()=>toast(`Nivel nou: ${lv}!`,{ms:4000}),400);
    Savings.Rewards.announce(before);
    return s;
  }
  const shuffle=(arr,seed)=>{const a=arr.slice();let s=seed>>>0||1;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};for(let k=a.length-1;k>0;k--){const j=Math.floor(rnd()*(k+1));[a[k],a[j]]=[a[j],a[k]]}return a};

  /* ---------- 1. choose the cheaper loan ---------- */
  const CQ=[
    {id:'c1',P:30000,m:24,a:{name:'Banca Alfa',rate:9.5,fee:5,feeUnit:'%'},b:{name:'Banca Beta',rate:12.5},hint:'Uită-te și la comisionul de acordare.'},
    {id:'c2',P:50000,m:0,a:{name:'Credit Scurt',rate:11,term:36},b:{name:'Credit Lejer',rate:10,term:60},hint:'Rata lunară mai mică nu înseamnă cost total mai mic.'},
    {id:'c3',P:80000,m:48,a:{name:'Banca Nord',rate:10.9,monthly:120},b:{name:'Banca Sud',rate:12.4},hint:'Înmulțește comisionul lunar cu numărul de luni.'},
    {id:'c4',P:40000,m:36,a:{name:'Credit Plus',rate:8.9,insurance:90},b:{name:'Credit Simplu',rate:10.9},hint:'Asigurarea lunară se adună la cost.'},
    {id:'c5',P:100000,m:60,a:{name:'Rate egale',rate:14},b:{name:'Rate descrescătoare',rate:14,type:'desc'},hint:'Aceeași dobândă, dar datoria scade în ritmuri diferite.'},
    {id:'c6',P:20000,m:12,a:{name:'IMF Rapid',rate:16},b:{name:'Banca Est',rate:13,fee:300,feeUnit:'lei'},hint:'Compară dobânda economisită cu comisionul.'},
    {id:'c7',P:15000,m:12,a:{name:'Promo 0%',rate:0,fee:12,feeUnit:'%'},b:{name:'Credit Clasic',rate:15},hint:'„0 % dobândă” nu înseamnă gratuit.'},
    {id:'c8',P:60000,m:48,a:{name:'Banca Vest',rate:10.5,fee:1,feeUnit:'%'},b:{name:'Banca Centru',rate:12.9},hint:'Un comision mic poate merita dacă dobânda e mult mai mică.'},
    {id:'c9',P:25000,m:24,a:{name:'Credit Sigur',rate:11.9,insurance:15},b:{name:'Credit Liber',rate:13.9},hint:'Calculează cât te costă asigurarea în total.'},
    {id:'c10',P:120000,m:0,a:{name:'Ipotecar 5 ani',rate:9.8,term:60},b:{name:'Ipotecar 7 ani',rate:9.2,term:84},hint:'Mai mulți ani înseamnă mai multe luni cu dobândă.'}
  ];
  const offerLines=(o,r)=>`<div class="lines"><span>Dobândă: <b>${pctS(o.rate)}</b>${o.type==='desc'?' · rate descrescătoare':''}</span><span>Perioadă: <b>${r.n} luni</b></span>${+o.fee?`<span>Comision de acordare: <b>${o.feeUnit==='%'?pctS(o.fee):lei0(o.fee)}</b></span>`:''}${+o.monthly?`<span>Comision lunar: <b>${lei0(o.monthly)}</b></span>`:''}${+o.insurance?`<span>Asigurare: <b>${lei0(o.insurance)}/lună</b></span>`:''}<span>${o.type==='desc'?'Prima rată':'Rata lunară'}: <b>${lei0(r.firstPayment)}</b></span></div>`;
  function creditQ(){
    const s=st();const order=shuffle(CQ,(s.modes.credit?.n||0)>=CQ.length?Date.now():1234567);
    const q=order[(s.modes.credit?.n||0)%CQ.length];
    const offers=[{...q.a,type:q.a.type||'ann'},{...q.b,type:q.b.type||'ann'}];
    const res=offers.map(o=>FinCalc.loan(o,q.P,q.m));const best=res[0].totalCost<=res[1].totalCost?0:1;
    return{q,offers,res,best};
  }
  function renderCredit(){
    const{q,offers,res}=play.data;
    return `<div class="q-top"><span class="row">${lbl('demo','Scenariu fictiv')}<span class="muted">Alege creditul · runda ${play.round}</span></span><span class="muted num">${lei0(q.P)} împrumutați</span></div>
      <h2>Care credit te costă mai puțin în total?</h2>
      <div class="opts">${offers.map((o,i)=>`<button type="button" class="opt" data-ans="${i}"><h3>${esc(o.name)}</h3>${offerLines(o,res[i])}</button>`).join('')}</div>
      <p class="muted" style="font-size:14px;margin:0">Indiciu: ${esc(q.hint)}</p><div id="gFb"></div>`;
  }
  function feedbackCredit(i){
    const{offers,res,best}=play.data;const ok=i===best;const other=1-best;
    const w=FinCalc.whyCheaper(offers,res,best,other);
    const rows=w.reasons.map(p=>`<li>${p.diff>0?'Economisești':'Plătești în plus'} <b>${lei0(Math.abs(p.diff))}</b> la ${p.label}.</li>`).join('');
    const extra=[];
    if(res[best].firstPayment>res[other].firstPayment+.5)extra.push(`Atenție: rata lunară la ${esc(offers[best].name)} e mai mare (${lei0(res[best].firstPayment)} față de ${lei0(res[other].firstPayment)}), dar costul total e mai mic.`);
    if(res[best].n!==res[other].n)extra.push('Perioadele diferă: pe termen mai lung plătești dobândă mai multe luni.');
    if(offers.some(o=>o.rate===0))extra.push('Cu 0 % dobândă, tot costul vine din comision. DAE arată costul real: '+offers.map((o,k)=>`${esc(o.name)} ${pct(res[k].dae*100,1)}`).join(', ')+'.');
    if(offers[0].rate===offers[1].rate&&offers.some(o=>o.type==='desc'))extra.push('La rate descrescătoare returnezi principalul mai repede, așa că plătești dobândă pe o datorie mai mică.');
    const pts=ok?20+(st().streak>=2?5:0):5;
    return{ok,pts,html:`<div class="feedback ${ok?'good':'bad'}"><h3>${ok?'Corect!':'Nu chiar.'} ${esc(offers[best].name)} costă cu ${lei0(w.total)} mai puțin.</h3>
      <p>${lbl('calc')} Cost total: ${offers.map((o,k)=>`${esc(o.name)} <b>${lei0(res[k].totalCost)}</b>`).join(' față de ')}.</p><ul>${rows}</ul>${extra.map(x=>`<p>${x}</p>`).join('')}</div>`};
  }

  /* ---------- 2. spot the misleading offer ---------- */
  function teaser(P,n,r1,k,r2){const A1=FinCalc.annuityPayment(P,r1,n);let bal=P;const i=r1/1200;for(let j=0;j<k;j++)bal=bal*(1+i)-A1;return{A1,A2:FinCalc.annuityPayment(bal,r2,n-k)}}
  const MISLEAD=[
    ()=>{const L=FinCalc.loan({rate:0,fee:15,feeUnit:'%'},10000,12);return{name:'Banca Zâmbet',head:'Credit cu dobândă 0 %!',small:'Comision de acordare 15 %, reținut din suma creditului. Exemplu: 10 000 lei pe 12 luni.',why:`Primești doar ${lei0(L.netReceived)}, dar returnezi 10 000 lei. Comisionul de ${lei0(L.upfront)} face ca DAE să fie ${pct(L.dae*100,1)}, deși dobânda e 0 %.`}},
    ()=>{const L=FinCalc.loan({rate:19},15000,84);return{name:'IMF Ușor',head:`Doar ${lei0(L.firstPayment)} pe lună!`,small:'Pentru 15 000 lei pe 84 de luni, dobândă anuală 19 %.',why:`Rata e mică pentru că plătești 7 ani. În total dai ${lei0(L.totalPaid)}, adică ${lei0(L.totalCost)} peste suma împrumutată (DAE ${pct(L.dae*100,1)}).`}},
    ()=>{const L=FinCalc.loan({rate:14,insurance:240},20000,24);return{name:'Banca Fără Griji',head:'Fără comisioane!',small:'Asigurare obligatorie: 1,2 % pe lună din suma inițială. Dobândă 14 %, 20 000 lei pe 24 de luni.',why:`Nu are comisioane, dar asigurarea obligatorie costă ${lei0(240)} pe lună, adică ${lei0(L.totalInsurance)} în total. Cu ea, DAE ajunge la ${pct(L.dae*100,1)}.`}},
    ()=>{const t=teaser(30000,48,9.9,3,23);return{name:'Banca Promo',head:'Dobândă 9,9 %*',small:'*Doar în primele 3 luni. Apoi dobândă variabilă, în prezent 23 %. 30 000 lei pe 48 de luni.',why:`Rata pornește de la ${lei0(t.A1)} pe lună, dar din luna a 4-a urcă la aproximativ ${lei0(t.A2)}, la dobânda de azi de 23 %. Iar dobânda variabilă poate crește și mai mult.`}},
    ()=>{const L=FinCalc.loan({rate:85},5000,6);return{name:'Bani Acum',head:'Aprobare în 10 minute, fără acte!',small:'Dobândă anuală 85 %. Exemplu: 5 000 lei pe 6 luni.',why:`Viteza costă: pentru 5 000 lei pe 6 luni plătești ${lei0(L.totalCost)} dobândă, adică DAE ${pct(L.dae*100,1)}.`}}
  ];
  const FAIR=[
    ()=>{const L=FinCalc.loan({rate:12.5},50000,48);return{name:'Banca Clară',head:'Credit de consum la 12,5 % fixă',small:`Fără comision de acordare. Exemplu: 50 000 lei pe 48 de luni, rata ${lei0(L.firstPayment)}, DAE ${pct(L.dae*100,2)}.`}},
    ()=>{const L=FinCalc.loan({rate:10.9,fee:1,feeUnit:'%'},150000,60);return{name:'Banca Auto',head:'Credit auto la 10,9 % fixă',small:`Comision de acordare 1 %. Exemplu: 150 000 lei pe 60 de luni, rata ${lei0(L.firstPayment)}, DAE ${pct(L.dae*100,2)}.`}},
    ()=>{const L=FinCalc.loan({rate:8},30000,36);return{name:'Banca Studiu',head:'Credit pentru studii la 8 % fixă',small:`Fără comisioane. Exemplu: 30 000 lei pe 36 de luni, rata ${lei0(L.firstPayment)}, DAE ${pct(L.dae*100,2)}.`}},
    ()=>{const L=FinCalc.loan({rate:11.9,monthly:25},80000,60);return{name:'Banca Unu',head:'Refinanțare la 11,9 % fixă',small:`Comision lunar 25 lei. Exemplu: 80 000 lei pe 60 de luni, rata ${lei0(L.firstPayment)}, DAE ${pct(L.dae*100,2)}.`}}
  ];
  function adsQ(){
    const s=st();const n=s.modes.ads?.n||0;
    const m=MISLEAD[n%MISLEAD.length]();const f=shuffle(FAIR,n+7).slice(0,2).map(x=>x());
    const ads=shuffle([{...m,bad:true},...f],n*31+3);
    return{ads,bad:ads.findIndex(a=>a.bad)};
  }
  function renderAds(){
    const{ads}=play.data;
    return `<div class="q-top"><span class="row">${lbl('demo','Reclame fictive')}<span class="muted">Oferta înșelătoare · runda ${play.round}</span></span></div>
      <h2>Care reclamă te poate păcăli?</h2>
      <div class="opts">${ads.map((a,i)=>`<button type="button" class="opt" data-ans="${i}"><span class="muted" style="font-size:13px">${esc(a.name)}</span><h3>${esc(a.head)}</h3><p class="fine">${esc(a.small)}</p></button>`).join('')}</div>
      <p class="muted" style="font-size:14px;margin:0">Indiciu: citește textul mic și gândește-te cât plătești în total.</p><div id="gFb"></div>`;
  }
  function feedbackAds(i){
    const{ads,bad}=play.data;const ok=i===bad;const a=ads[bad];
    return{ok,pts:ok?25:5,html:`<div class="feedback ${ok?'good':'bad'}"><h3>${ok?'Corect!':'Nu chiar.'} Reclama înșelătoare: „${esc(a.head)}”</h3><p>${lbl('calc')} ${a.why}</p><p class="muted">Celelalte reclame arată dobânda, comisioanele, un exemplu și DAE la vedere: așa poți compara.</p></div>`};
  }

  /* ---------- 3. manage a month's budget ---------- */
  const EVENTS=[
    {t:'Prietenii te invită la un concert. Biletul costă 600 lei.',o:[['Merg și iau taxi',-750,0,'Distracția e ok, dar taxiul a dublat costul transportului.'],['Merg cu transportul public',-610,2,'Te bucuri de concert și economisești 140 lei la drum.'],['Nu merg de data asta',0,1,'Ai economisit, dar și timpul cu prietenii contează. Planifică astfel de ieșiri în buget.']]},
    {t:'Telefonul ți s-a spart.',o:[['Îl repar cu 900 lei',-900,2,'Reparația e cea mai ieftină soluție care rezolvă problema.'],['Iau unul nou în rate „0 %”: 450 lei pe lună, 12 luni',-450,1,'Plătești mai puțin luna asta, dar te-ai legat de 450 lei pe lună pentru un an. Verifică și comisioanele.'],['Cumpăr unul nou cu 6 000 lei',-6000,0,'Ai consumat o mare parte din buget pe o cumpărătură care putea fi evitată.']]},
    {t:'Reduceri: o geacă de 1 500 lei costă acum 900 lei.',o:[['O iau, e la reducere',-900,0,'O reducere la ceva ce nu planificai tot cheltuială este.'],['O las, am o geacă bună',0,2,'Bine gândit: reducerea nu e economie dacă nu aveai nevoie.'],['O pun pe listă pentru luna viitoare',0,2,'Excelent: amâni decizia și o incluzi în buget dacă încă o vrei.']]},
    {t:'Factura la gaz a venit cu 350 lei mai mare.',o:[['Plătesc din bugetul lunii',-350,2,'Corect: facturile sunt cheltuieli esențiale și se plătesc la timp.'],['Amân plata o lună',-35,0,'Întârzierea aduce penalități și o factură și mai mare luna viitoare.']]},
    {t:'Ai trei abonamente de streaming, fiecare 150 lei.',o:[['Le păstrez pe toate',-450,0,'450 de lei pe lună înseamnă 5 400 pe an.'],['Păstrez unul singur',-150,2,'Economisești 300 lei pe lună, adică 3 600 pe an.'],['Le opresc pe toate',0,1,'Economie maximă, dar e ok să păstrezi ceva ce folosești des.']]},
    {t:'Se apropie ziua mamei.',o:[['Cadou de 800 lei',-800,0,'Gest frumos, dar peste ce permite bugetul acestei luni.'],['Cadou de 300 lei',-300,2,'Un cadou atent, în limitele bugetului.'],['Un cadou făcut de mână, 50 lei',-50,2,'Cadourile personale contează mult și costă puțin.']]},
    {t:'Colegii comandă prânzul zilnic, 120 lei pe zi.',o:[['Comand și eu în fiecare zi',-2400,0,'20 de zile lucrătoare × 120 lei = 2 400 lei pe lună.'],['Iau mâncare de acasă 3 zile din 5',-960,2,'Economisești 1 440 lei pe lună față de comanda zilnică.'],['Gătesc acasă în fiecare zi',-500,2,'Cea mai mare economie, dacă ai timp să gătești.']]},
    {t:'Primești un bonus de 1 000 lei.',o:[['Îl cheltui pe un weekend',-1000,0,'Banii au dispărut, iar ținta de economisire e mai departe.'],['Pun jumătate în borcan',-500,2,'Un echilibru bun între bucurie și economii.'],['Îl pun tot în fondul de urgență',0,2,'Fondul de urgență te ferește de credite scumpe când apare ceva neprevăzut.']]}
  ];
  const BUDGET={income:12000,ess:7500,goal:1500};
  function budgetQ(){const s=st();const n=s.modes.budget?.n||0;return{events:shuffle(EVENTS,n*97+11).slice(0,5),step:0,left:BUDGET.income-BUDGET.ess,score:0,log:[]}}
  function renderBudget(){
    const b=play.data;
    if(b.step>=b.events.length){
      const ok=b.left>=BUDGET.goal&&b.left>=0;
      return `<div class="q-top"><span class="row">${lbl('demo','Scenariu fictiv')}<span class="muted">Bugetul lunii · final</span></span></div>
        <h2>${ok?'Ai atins ținta de economisire!':b.left<0?'Luna s-a încheiat pe minus.':'Ai rămas pe plus, dar sub țintă.'}</h2>
        <div class="kpis"><div class="kpi${ok?' hi':b.left<0?' bad':''}"><div class="kpi-l">Rămas la final ${lbl('calc')}</div><div class="kpi-v num">${lei0(b.left)}</div></div><div class="kpi"><div class="kpi-l">Ținta de economisire</div><div class="kpi-v num">${lei0(BUDGET.goal)}</div></div><div class="kpi"><div class="kpi-l">Alegeri bune</div><div class="kpi-v num">${b.score} / ${b.events.length*2}</div></div><div class="kpi"><div class="kpi-l">Puncte primite</div><div class="kpi-v num">${b.pts||0}</div></div></div>
        <ul class="hist">${b.log.map(l=>`<li><span>${esc(l.t)}</span><span class="amt-v">${l.a<0?'−':''}${lei0(Math.abs(l.a))}</span></li>`).join('')}</ul>
        <div class="row"><button class="pill solid" type="button" data-next>Joacă altă lună</button><button class="pill" type="button" data-hub>Înapoi la jocuri</button></div>`;
    }
    const ev=b.events[b.step];
    return `<div class="q-top"><span class="row">${lbl('demo','Scenariu fictiv')}<span class="muted">Bugetul lunii · pasul ${b.step+1} din ${b.events.length}</span></span><span class="progress-dots">${b.events.map((_,k)=>`<i class="${k<b.step?(b.log[k].s>=2?'ok':b.log[k].s===0?'no':'ok'):k===b.step?'cur':''}"></i>`).join('')}</span></div>
      <div class="budget-sim"><div class="kpi"><div class="kpi-l">Venit</div><div class="kpi-v num">${lei0(BUDGET.income)}</div></div><div class="kpi"><div class="kpi-l">Esențiale plătite</div><div class="kpi-v num">${lei0(BUDGET.ess)}</div></div><div class="kpi${b.left<BUDGET.goal?' bad':' hi'}"><div class="kpi-l">Îți rămân ${lbl('calc')}</div><div class="kpi-v num">${b.left<0?'−':''}${lei0(Math.abs(b.left))}</div><div class="kpi-s">ținta: să rămână cel puțin ${lei0(BUDGET.goal)}</div></div></div>
      <h2>${esc(ev.t)}</h2>
      <div class="opts">${ev.o.map((o,i)=>`<button type="button" class="opt" data-ans="${i}"><h3>${esc(o[0])}</h3><span class="lines"><span>${o[1]<0?`Costă <b>${lei0(-o[1])}</b> luna asta`:'Nu costă nimic luna asta'}</span></span></button>`).join('')}</div><div id="gFb"></div>`;
  }
  function feedbackBudget(i){
    const b=play.data,ev=b.events[b.step],o=ev.o[i];
    b.left+=o[1];b.score+=o[2];b.log.push({t:o[0],a:o[1],s:o[2]});
    const best=Math.max(...ev.o.map(x=>x[2]));const ok=o[2]===best;
    const pts=o[2]*5;b.pts=(b.pts||0)+pts;
    return{ok,pts,html:`<div class="feedback ${ok?'good':'bad'}"><h3>${ok?'Alegere bună.':'Se putea mai bine.'}</h3><p>${esc(o[3])}</p><p class="muted">${lbl('calc')} Îți rămân acum ${b.left<0?'−':''}${lei0(Math.abs(b.left))}.</p></div>`};
  }

  /* ---------- screens ---------- */
  function scoreBar(){
    const s=st(),lv=level(s.points);const acc=s.answered?Math.round(s.correct/s.answered*100):null;
    const prog=lv.next?(s.points-lv.from)/(lv.next[0]-lv.from):1;
    return `<div class="panel score-bar"><div><div class="eyebrow">Nivel</div><div class="lvl">${lv.name}</div></div>
      <div style="flex:1 1 220px;min-width:0"><div class="row" style="justify-content:space-between"><b class="num">${fmt0(s.points)} puncte</b><span class="muted" style="font-size:14px">${lv.next?`${fmt0(lv.next[0]-s.points)} până la „${lv.next[1]}”`:'nivel maxim'}</span></div><div class="meter" style="margin-top:8px"><i style="width:${(prog*100).toFixed(1)}%"></i></div></div>
      <div class="muted" style="font-size:14px">${s.answered?`${s.correct} răspunsuri corecte din ${s.answered} (${acc}%) · serie ${s.streak}`:'Încă nu ai jucat.'}</div></div>`;
  }
  function hub(){
    const s=st();const m=k=>s.modes[k]||{n:0,ok:0};
    $('#pane-educatie-joc').innerHTML=scoreBar()+`<div class="game-hub">
      <button type="button" class="mode panel" data-mode="credit" data-tilt><span class="ch-ico">${ico('card')}</span><h3>Alege creditul</h3><p>Două oferte, aceeași sumă. Care costă mai puțin în total? Afli exact de ce.</p><span class="meta"><span>+20 puncte</span><span class="muted">${m('credit').ok}/${m('credit').n} corecte</span></span></button>
      <button type="button" class="mode panel" data-mode="ads" data-tilt><span class="ch-ico">${ico('alert')}</span><h3>Găsește oferta înșelătoare</h3><p>Trei reclame, una te poate păcăli. Citește textul mic și găsește-o.</p><span class="meta"><span>+25 puncte</span><span class="muted">${m('ads').ok}/${m('ads').n} corecte</span></span></button>
      <button type="button" class="mode panel" data-mode="budget" data-tilt><span class="ch-ico">${ico('cal')}</span><h3>Bugetul lunii</h3><p>Cinci situații dintr-o lună. Rămâi pe plus și economisește cel puțin ${lei0(BUDGET.goal)}.</p><span class="meta"><span>până la +80 puncte</span><span class="muted">${m('budget').n} decizii</span></span></button>
    </div><p class="muted" style="font-size:13.5px;margin-top:14px">Toate scenariile sunt fictive. Băncile din jocuri nu există. Punctele se adună și la Recompense, în Economii.</p>`;
    bindTilt($('#pane-educatie-joc'));
  }
  function start(mode){
    play={mode,round:(st().modes[mode]?.n||0)+1,answered:false};
    play.data=mode==='credit'?creditQ():mode==='ads'?adsQ():budgetQ();
    renderPlay();
  }
  function renderPlay(){
    const body=play.mode==='credit'?renderCredit():play.mode==='ads'?renderAds():renderBudget();
    $('#pane-educatie-joc').innerHTML=scoreBar()+`<section class="panel q-card" aria-live="polite"><div><button class="ghost" type="button" data-hub>← Toate jocurile</button></div>${body}</section>`;
    $('#pane-educatie-joc .opt')?.focus({preventScroll:true});
  }
  function answer(i){
    if(play.answered)return;play.answered=true;
    const f=play.mode==='credit'?feedbackCredit(i):play.mode==='ads'?feedbackAds(i):feedbackBudget(i);
    const correct=play.mode==='credit'?play.data.best:play.mode==='ads'?play.data.bad:null;
    $$('#pane-educatie-joc .opt').forEach((b,k)=>{b.disabled=true;if(correct!=null){if(k===correct)b.classList.add('correct');else if(k===i)b.classList.add('wrong')}else if(k===i)b.classList.add(f.ok?'correct':'wrong')});
    award(play.mode,f.ok,f.pts);
    const last=play.mode==='budget'&&play.data.step+1>=play.data.events.length;
    if(last){const ok=play.data.left>=BUDGET.goal;if(ok){const s=st();s.points+=30;s.budgetBest=Math.max(s.budgetBest||0,play.data.left);Store.set(KEY,s);play.data.pts=(play.data.pts||0)+30}}
    $('#gFb').innerHTML=f.html+`<p class="muted" style="margin:10px 0">+${f.pts} puncte${last&&play.data.left>=BUDGET.goal?' · +30 bonus pentru ținta atinsă':''}</p><div class="row"><button class="pill solid" type="button" data-next>${play.mode==='budget'&&!last?'Mai departe':last?'Vezi rezultatul':'Altă întrebare'}</button><button class="pill" type="button" data-hub>Înapoi la jocuri</button></div>`;
    if(f.ok&&!calm()){const r=$$('#pane-educatie-joc .opt')[i].getBoundingClientRect();Confetti.burst(r.left+r.width/2,r.top+20,50)}
    $('#gFb [data-next]')?.focus({preventScroll:true});
    $('#gFb').scrollIntoView({block:'nearest',behavior:calm()?'auto':'smooth'});
  }
  function next(){
    if(play.mode==='budget'&&play.data.step<play.data.events.length){play.data.step++;play.answered=false;renderPlay();return}
    start(play.mode);
  }
  function guideHTML(){
    return `<div class="guide"><article class="panel">
      <h2 id="g-ed-1">Cum funcționează</h2><p>Alegi un joc și răspunzi la situații scurte. După fiecare răspuns primești explicația, cu cifrele calculate exact. Răspunsurile greșite primesc și ele câteva puncte, pentru că și ele te învață ceva.</p>
      <h2 id="g-ed-2">Ce înveți în fiecare joc</h2><dl><dt>Alege creditul</dt><dd>Să compari costul total, nu doar dobânda sau rata lunară. Explicația arată câți lei vin din dobândă, comisioane și asigurare.</dd><dt>Găsește oferta înșelătoare</dt><dd>Să citești textul mic: „0 % dobândă” cu comision mare, rata mică pe mulți ani, dobânda promoțională care crește.</dd><dt>Bugetul lunii</dt><dd>Să faci alegeri mici care contează: ce amâni, ce compari, ce pui deoparte.</dd></dl>
      <h2 id="g-ed-3">Puncte și niveluri</h2><p>Corect la „Alege creditul”: 20 de puncte (+5 când ai o serie). Corect la „Găsește oferta înșelătoare”: 25. La „Bugetul lunii” primești până la 10 puncte pe decizie și 30 bonus dacă atingi ținta. Nivelurile: Începător, Atent (100), Priceput (250), Expert (500).</p>
      <h2 id="g-ed-4">Scenariile sunt fictive</h2><p>Băncile și ofertele din jocuri sunt inventate pentru exerciții. Pentru oferte reale folosește calculatorul de credite cu datele primite de la creditor.</p>
    </article><aside class="panel"><h3>În acest ghid</h3><nav class="toc">${[['g-ed-1','Cum funcționează'],['g-ed-2','Ce înveți'],['g-ed-3','Puncte și niveluri'],['g-ed-4','Scenariile sunt fictive']].map(([id,l])=>`<button type="button" data-jump="${id}">${l}</button>`).join('')}</nav><button class="pill solid" type="button" data-goto="educatie">Joacă</button></aside></div>`;
  }
  function build(){
    $('#pane-educatie-ghid').innerHTML=guideHTML();
    $('#act-educatie').innerHTML='';
    $('#v-educatie').addEventListener('click',e=>{
      const t=e.target;
      const m=t.closest('[data-mode]');if(m){start(m.dataset.mode);return}
      const a=t.closest('[data-ans]');if(a&&!a.disabled){answer(+a.dataset.ans);return}
      if(t.closest('[data-next]')){next();return}
      if(t.closest('[data-hub]')){play=null;hub();return}
    });
    built=true;
  }
  return{
    init(){},
    show(sub){if(!built)build();if(sub==='joc'){if(play)renderPlay();else hub()}},
    snapshot(){const s=st();return{puncte:s.points,nivel:level(s.points).name,raspunsuri:s.answered,corecte:s.correct}}
  };
})();
App.mods.educatie=Game;
