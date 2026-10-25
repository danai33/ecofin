/* =====================================================================
   CREDITE — compare offers; explain exactly why the cheapest one is cheaper
   ===================================================================== */
const Credit=(()=>{
  const KEY='credite',MAX=10;
  const blank=()=>({id:rid(),lender:'',product:'',rate:null,rateType:'fixa',type:'ann',fee:0,feeUnit:'%',monthly:0,insurance:0,early:0,term:'',example:false,source:'',date:'',daeDecl:''});
  /* three fictional offers, generated at random each visit: one with a low rate but fees,
     one without fees at a middle rate, one fast microcredit. Names are invented. */
  const BANKS=['Banca Alfa','Banca Beta','Banca Gama','Banca Sigma','Banca Vega','Banca Lyra'];
  const IMFS=['IMF Delta','IMF Omega','IMF Zeta','IMF Nova'];
  function prng(seed){let a=seed>>>0||1;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function genExamples(seed){
    const R=prng(seed);const pick=a=>a[Math.floor(R()*a.length)];const step=(a,b,s)=>Math.round((a+R()*(b-a))/s)*s;
    const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
    const banks=shuffle(BANKS);
    const lowRate={lender:banks[0],product:pick(['Credit de consum','Credit pentru nevoi personale']),rate:+step(8.4,10.6,.1).toFixed(1),rateType:'variabila',type:'ann',fee:+step(1,2.5,.5).toFixed(1),feeUnit:'%',monthly:step(30,70,5),insurance:step(20,45,5),early:pick([0,1,2])};
    const noFees={lender:banks[1],product:pick(['Credit de consum','Credit online','Credit pentru nevoi personale']),rate:+step(11.2,13.9,.1).toFixed(1),rateType:'fixa',type:'ann',fee:pick([0,0,.5,1]),feeUnit:'%',monthly:0,insurance:0,early:pick([0,1])};
    const micro={lender:pick(IMFS),product:pick(['Microcredit rapid','Credit online rapid']),rate:+step(17.5,26.5,.1).toFixed(1),rateType:'fixa',type:pick(['ann','desc']),fee:step(300,1200,50),feeUnit:'lei',monthly:pick([0,0,15,20]),insurance:0,early:0};
    return shuffle([lowRate,noFees,micro]).map((o,i)=>({...blank(),...o,id:`ex-${(seed>>>0).toString(36)}-${i}`,example:true}));
  }
  let st=null,demo=null,saveT=0,built=false,refId=null;
  const isDemo=()=>st&&st.mode==='demo';
  const deck=()=>isDemo()?demo.offers:st.offers;
  function newDemo(seed){const sd=(seed??Math.floor(Math.random()*2**31))>>>0;demo={seed:sd,offers:genExamples(sd)};refId=null}
  const rail=()=>$('#crRail');
  const complete=o=>o&&o.rate!==null&&o.rate!==''&&Number.isFinite(+o.rate);
  const nameOf=(o,k)=>o.lender||(k!=null?`Oferta ${k+1}`:'Oferta fără nume');

  /* ---------- state ---------- */
  function load(){
    const d=Store.get(KEY);
    if(d&&Array.isArray(d.offers)){
      // examples are no longer stored: older versions kept them among the offers
      const own=d.offers.filter(o=>!o.example).map(o=>({...blank(),...o}));
      st={amount:+d.amount||100000,months:+d.months||60,offers:own,mode:d.mode==='own'||d.mode==='demo'?d.mode:(own.length?'own':'demo')};
      if(st.mode==='own'&&!own.length&&!d.mode)st.mode='demo';
    }else st={amount:100000,months:60,offers:[],mode:'demo'};
    if(!demo)newDemo();
  }
  function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.set(KEY,clone(st)),350)}
  function evaluate(list=deck()){
    const idx=list.map((o,k)=>complete(o)?k:-1).filter(k=>k>=0);
    const offers=idx.map(k=>list[k]);
    const cmp=FinCalc.compare(offers,st.amount,st.months);
    const res=list.map(()=>null);idx.forEach((k,j)=>res[k]=cmp.res[j]);
    const best=cmp.best>=0?idx[cmp.best]:-1;
    return{res,best,idx,sameTerm:cmp.sameTerm};
  }

  /* ---------- small renderers ---------- */
  const HUES=[['#ff8fc8','#8a6cff'],['#6cf2b9','#3a8bff'],['#ffb36b','#ff5f8f'],['#8fdcff','#6a5cff'],['#ffd66b','#ff8a5c'],['#c49bff','#ff7ac8'],['#7bf0e2','#4c6cf7']];
  const hue=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))>>>0;return HUES[h%HUES.length]};
  const initials=s=>{const w=String(s||'?').trim().split(/\s+/).filter(Boolean);return((w[0]?.[0]||'?')+(w[1]?.[0]||'')).toUpperCase()};
  const feeTxt=o=>(+o.fee||0)?(o.feeUnit==='%'?pctS(o.fee):lei0(o.fee)):'fără comision';
  const COL={interest:'var(--coral)',upfront:'var(--amber)',monthly:'#c3a6ff',insurance:'var(--sky)'};
  function srcLine(o){
    if(o.example)return 'Exemplu fictiv, nu e o ofertă reală';
    if(o.source||o.date)return `Sursa: ${esc(o.source||'nespecificată')}${o.date?' · '+dateRO(o.date):''}`;
    return `<button class="link" type="button" data-act="add-src">Adaugă sursa și data ofertei</button>`;
  }
  function frontHTML(o,r,ctx){
    const name=nameOf(o,ctx.k);const[h1,h2]=hue(name);
    const head=`<div class="of-head"><div class="mono" style="background:linear-gradient(140deg,${h1},${h2})">${esc(initials(name))}</div><div class="of-name"><b>${esc(name)}</b><span>${esc(o.product||'Credit')}</span></div>${o.example?lbl('demo'):''}</div>`;
    if(!r)return `${head}<div class="of-main"><div class="of-pay" style="font-size:22px;font-weight:600">Ofertă incompletă</div><div class="of-pay-sub">Scrie dobânda anuală ca s-o pot calcula și compara.</div></div><div class="of-btns" style="grid-template-columns:1fr"><button class="pill solid" type="button" data-act="edit">Completează oferta</button></div>`;
    const extra=r.monthlyFee+r.insurance;
    const delta=r.totalCost-ctx.bestCost;
    return `${ctx.isBest?'<div class="best-badge">Cea mai ieftină</div>':''}${head}
      <div class="of-main"><div class="of-pay num">${fmt0(r.firstPayment)}<small>lei/lună</small></div>
        <div class="of-pay-sub">${o.type==='desc'?`prima rată; ultima ${lei0(r.lastPayment)}`:'rată egală lunar'}${extra?` · include ${lei0(extra)} comisioane și asigurare`:''}</div></div>
      <div class="of-cost"><span>Cost total în ${r.n} luni</span><b class="num">${lei0(r.totalCost)}</b></div>
      <div class="of-facts"><span class="fact">Dobândă <b>${pctS(o.rate)}</b> ${o.rateType==='variabila'?'variabilă':'fixă'}</span><span class="fact">DAE <b>${r.dae==null?'—':pct(r.dae*100,1)}</b></span></div>
      ${ctx.n>1?(ctx.isBest?'<div class="of-delta good">Plătești cel mai puțin</div>':`<div class="of-delta">+${lei0(delta)} față de ${esc(ctx.bestName)}</div>`):''}
      <p class="of-src">${srcLine(o)}</p>
      <div class="of-btns"><button class="pill" type="button" data-act="details">Detalii</button><button class="pill solid" type="button" data-act="edit">Editează</button></div>`;
  }
  function fld(o,k,label,val,{unit='',attrs='',hint=''}={}){
    const id=`f-${o.id}-${k}`;
    const inp=`<input class="inp${unit?' num':''}" id="${id}" data-f="${k}" value="${esc(val)}" aria-describedby="e-${id}" ${attrs}>`;
    return `<div class="fld"><label for="${id}">${label}</label>${unit?`<span class="amt">${inp}<em>${unit}</em></span>`:inp}${hint?`<small>${hint}</small>`:''}<span class="err" id="e-${id}" hidden></span></div>`;
  }
  function backHTML(o){
    const sel=(k,opts,v)=>`<select class="inp" id="f-${o.id}-${k}" data-f="${k}">${opts.map(([val,l])=>`<option value="${val}"${String(v)===val?' selected':''}>${l}</option>`).join('')}</select>`;
    return `<div class="back-in">
      <h3>Datele ofertei</h3>
      ${fld(o,'lender','Creditor (bancă sau IMF)',o.lender,{attrs:'maxlength="40" placeholder="ex. Banca mea" autocomplete="off"'})}
      ${fld(o,'product','Produs',o.product,{attrs:'maxlength="50" placeholder="ex. Credit de consum" autocomplete="off"'})}
      <div class="g2">${fld(o,'rate','Dobândă anuală',o.rate==null?'':numIn(o.rate),{unit:'%',attrs:'inputmode="decimal" placeholder="ex. 11,5" autocomplete="off"'})}
        <div class="fld"><label for="f-${o.id}-rateType">Tip dobândă</label>${sel('rateType',[['fixa','fixă'],['variabila','variabilă']],o.rateType)}</div></div>
      <div class="fld"><label for="f-${o.id}-type">Cum rambursezi</label>${sel('type',[['ann','Rate egale (anuități)'],['desc','Rate descrescătoare']],o.type==='desc'?'desc':'ann')}</div>
      <div class="fld"><label for="f-${o.id}-fee">Comision de acordare</label><span class="unit"><input class="inp num" id="f-${o.id}-fee" data-f="fee" inputmode="decimal" value="${esc(numIn(o.fee))}" aria-describedby="e-f-${o.id}-fee" autocomplete="off">${sel('feeUnit',[['%','%'],['lei','lei']],o.feeUnit)}</span><span class="err" id="e-f-${o.id}-fee" hidden></span></div>
      <div class="g2">${fld(o,'monthly','Comision lunar',numIn(o.monthly),{unit:'lei',attrs:'inputmode="decimal" autocomplete="off"'})}${fld(o,'insurance','Asigurare lunară',numIn(o.insurance),{unit:'lei',attrs:'inputmode="decimal" autocomplete="off"'})}</div>
      <details class="more-fields"><summary>Mai multe câmpuri</summary><div>
        <div class="g2">${fld(o,'term','Altă perioadă',o.term,{unit:'luni',attrs:`inputmode="numeric" placeholder="${st.months}" autocomplete="off"`})}${fld(o,'early','Rambursare anticipată',numIn(o.early),{unit:'%',attrs:'inputmode="decimal" autocomplete="off"'})}</div>
        ${fld(o,'daeDecl','DAE declarată de creditor',numIn(o.daeDecl),{unit:'%',attrs:'inputmode="decimal" placeholder="opțional" autocomplete="off"',hint:'O compar cu DAE calculată din datele tale.'})}
        ${fld(o,'source','Sursa ofertei',o.source,{attrs:'maxlength="120" placeholder="ex. site-ul băncii, oferta scrisă" autocomplete="off"'})}
        ${fld(o,'date','Data ofertei',o.date,{attrs:`type="date" max="${todayISO()}"`})}
      </div></details>
      <p class="err" data-form-err hidden>Corectează câmpurile marcate, apoi apasă „Gata”.</p>
      <div class="back-btns"><button class="pill solid" type="button" data-act="done">Gata</button><button class="pill" type="button" data-act="dup">Duplică</button><button class="pill danger" type="button" data-act="del">Șterge</button></div>
    </div>`;
  }
  const plusHTML=(idx,end)=>end
    ?`<div class="cr-plus end"><button type="button" data-plus="${idx}" aria-label="Adaugă o ofertă la final"><b>+</b>Adaugă ofertă</button></div>`
    :`<div class="cr-plus"><button type="button" data-plus="${idx}" aria-label="Adaugă o ofertă în acest loc" title="Adaugă o ofertă aici">+</button></div>`;

  /* ---------- the explanation: why the cheapest offer is cheaper ---------- */
  function partText(p,oa,ob,ra,rb){
    const less=p.diff>0;
    switch(p.key){
      case 'interest':{const b=[];
        if(Math.abs(+oa.rate-+ob.rate)>1e-9)b.push(`dobânda ${pctS(oa.rate)} față de ${pctS(ob.rate)}`);
        if(ra.n!==rb.n)b.push(`${ra.n} luni față de ${rb.n}`);
        if((oa.type==='desc')!==(ob.type==='desc'))b.push(oa.type==='desc'?'rate descrescătoare: datoria scade mai repede':'rate egale față de rate descrescătoare');
        return[less?'Plătești mai puțină dobândă':'Plătești mai multă dobândă',b.join(' · ')||'aceeași dobândă anuală']}
      case 'upfront':return[less?'Comision de acordare mai mic':'Comision de acordare mai mare',`${feeTxt(oa)} (${lei0(ra.upfront)}) față de ${feeTxt(ob)} (${lei0(rb.upfront)})`];
      case 'monthly':return[less?'Comision lunar mai mic':'Comision lunar mai mare',`${lei0(ra.monthlyFee)}/lună față de ${lei0(rb.monthlyFee)}/lună`];
      case 'insurance':return[less?'Asigurare mai ieftină':'Asigurare mai scumpă',`${lei0(ra.insurance)}/lună față de ${lei0(rb.insurance)}/lună`];
    }
    return['',''];
  }
  function verdictHTML(ev){
    const list=deck();
    const comp=ev.idx;
    if(comp.length<2){
      if(comp.length===1){const k=comp[0],o=list[k],r=ev.res[k];
        return `<section class="verdict panel"><div class="row">${lbl('calc')}</div><h2><b>${esc(nameOf(o,k))}</b>: ${lei0(r.firstPayment)} pe lună, cost total <b>${lei0(r.totalCost)}</b> în ${r.n} luni.</h2><p class="muted">Adaugă încă o ofertă cu <b>+</b> ca să vezi care e mai ieftină și de ce.</p></section>`}
      return '';
    }
    const b=ev.best;
    const others=comp.filter(k=>k!==b);
    let ref=others.find(k=>list[k].id===refId);
    if(ref==null){ref=others.slice().sort((x,y)=>ev.res[x].totalCost-ev.res[y].totalCost)[0]}
    const oa=list[b],ob=list[ref],ra=ev.res[b],rb=ev.res[ref];
    const w=FinCalc.whyCheaper(list,ev.res,b,ref);
    const A=esc(nameOf(oa,b)),B=esc(nameOf(ob,ref));
    const anyEx=comp.some(k=>list[k].example);
    const maxAbs=Math.max(1,...w.reasons.map(p=>Math.abs(p.diff)));
    const rows=w.reasons.map(p=>{const[t,d]=partText(p,oa,ob,ra,rb);const good=p.diff>0;
      return `<div class="why-row${good?'':' neg'}"><span><b class="t">${t}</b><small>${esc(d)}</small></span><b class="v num">${good?'−':'+'}${lei0(Math.abs(p.diff))}</b><div class="bar" aria-hidden="true"><i style="width:${(Math.abs(p.diff)/maxAbs*100).toFixed(1)}%;background:${good?'var(--mint)':'var(--rose)'}"></i></div></div>`}).join('');
    const eq=w.reasons.map((p,i)=>`${i?(p.diff>0?' + ':' − '):(p.diff>0?'':'− ')}${fmt0(Math.abs(p.diff))}`).join('');
    const same=w.total<.5||!w.reasons.length;
    const md=r2(ra.firstPayment-rb.firstPayment);
    let monthLine='';
    if(Math.abs(md)>=1)monthLine=md>0?`Atenție: rata lunară la ${A} e cu <b>${lei0(md)}</b> mai mare (${lei0(ra.firstPayment)} față de ${lei0(rb.firstPayment)}), dar în total plătești mai puțin.`:`Și rata lunară e mai mică: ${lei0(ra.firstPayment)} față de ${lei0(rb.firstPayment)} (cu ${lei0(-md)} mai puțin).`;
    let daeLine='';
    if(ra.dae!=null&&rb.dae!=null){daeLine=`DAE calculată: ${pct(ra.dae*100,1)} la ${A} față de ${pct(rb.dae*100,1)} la ${B}.`;if(ra.dae>rb.dae+1e-6)daeLine+=' DAE e mai mare deși costul total e mai mic, pentru că DAE ține cont și de momentul plății: comisionul de acordare se plătește la început și cântărește mai mult.'}
    const warns=[...(anyEx?[{text:'Sunt exemple fictive, generate aleatoriu, nu oferte reale.'}]:[]),...w.warnings];
    const worst=comp.slice().sort((x,y)=>ev.res[y].totalCost-ev.res[x].totalCost)[0];
    return `<section class="verdict panel" aria-live="polite">
      <div class="verdict-top"><div><div class="row">${lbl('calc')}${anyEx?lbl('demo','Include exemple'):''}</div>
        <h2>${same?`<b>${A}</b> și <b>${B}</b> costă la fel în total.`:`<b>${A}</b> e cea mai ieftină: costă cu <b class="num">${lei0(w.total)}</b> mai puțin decât <b>${B}</b>.`}</h2></div>
        ${others.length>1?`<label class="ref-pick" for="crRef">Compară cu<select class="inp" id="crRef">${others.map(k=>`<option value="${list[k].id}"${k===ref?' selected':''}>${esc(nameOf(list[k],k))}</option>`).join('')}</select></label>`:''}
      </div>
      ${same?'':`<div><h3 class="why-h">De unde vine diferența</h3><div class="why">${rows}</div>
        <p class="why-sum"><span class="muted">Socoteala:</span> <b class="num">${eq} = ${lei0(w.total)}</b> economie</p></div>`}
      ${monthLine||daeLine?`<div class="why-notes">${monthLine?`<p>${monthLine}</p>`:''}${daeLine?`<p class="muted">${daeLine}</p>`:''}</div>`:''}
      ${warns.length?`<div class="warns">${warns.map(x=>`<span class="warn">${ico('alert',16)}${esc(x.text)}</span>`).join('')}</div>`:''}
      ${worst!==ref&&worst!==b?`<p class="muted" style="font-size:14px">Față de cea mai scumpă ofertă (${esc(nameOf(list[worst],worst))}) economisești ${lei0(ev.res[worst].totalCost-ra.totalCost)}.</p>`:''}
    </section>`;
  }
  function breakdownHTML(ev){
    const list=deck();
    const comp=ev.idx;if(!comp.length)return '';
    const tot=k=>ev.res[k].totalCost;const max=Math.max(...comp.map(tot))||1;
    const seg=(v,c)=>v>0?`<i style="width:${(v/max*100).toFixed(2)}%;background:${c}"></i>`:'';
    return `<section class="panel pad cr-break"><div class="sec-head"><h2 class="h2s">Din ce e format costul total</h2>
      <div class="legend"><span><i class="sw" style="background:${COL.interest}"></i>Dobândă</span><span><i class="sw" style="background:${COL.upfront}"></i>Comision de acordare</span><span><i class="sw" style="background:${COL.monthly}"></i>Comisioane lunare</span><span><i class="sw" style="background:${COL.insurance}"></i>Asigurare</span></div></div>
      <div class="stack">${comp.map(k=>{const r=ev.res[k],o=list[k];return `<div class="stack-row"><div class="nm">${esc(nameOf(o,k))}${k===ev.best&&comp.length>1?' '+lbl('calc','cea mai ieftină'):''}</div><div class="stack-bar" role="img" aria-label="${esc(nameOf(o,k))}: dobândă ${lei0(r.totalInterest)}, comision de acordare ${lei0(r.upfront)}, comisioane lunare ${lei0(r.totalMonthlyFees)}, asigurare ${lei0(r.totalInsurance)}">${seg(r.totalInterest,COL.interest)}${seg(r.upfront,COL.upfront)}${seg(r.totalMonthlyFees,COL.monthly)}${seg(r.totalInsurance,COL.insurance)}</div><div class="v num">${lei0(r.totalCost)}</div></div>`}).join('')}</div>
      <p class="muted" style="font-size:13.5px;margin-top:12px">Costul total = tot ce plătești peste suma împrumutată. Suma de ${lei0(st.amount)} o returnezi oricum.</p></section>`;
  }
  function modeBarHTML(){
    const mine=st.offers.length;
    const seg=`<div class="seg cr-mode" role="group" aria-label="Ce compari"><button type="button" id="crShowDemo" class="${isDemo()?'on':''}" aria-pressed="${isDemo()}">Exemplu</button><button type="button" id="crMine" class="${isDemo()?'':'on'}" aria-pressed="${!isDemo()}">Ofertele mele${mine?` (${mine})`:''}</button></div>`;
    if(isDemo())return `<div class="mode-bar demo" role="note">
      <div class="mode-txt">${lbl('demo','Exemplu')}<p><b>Așa funcționează comparația.</b> Trei oferte fictive, generate aleatoriu: vezi care e mai ieftină și de ce.</p></div>
      <div class="mode-btns"><button class="pill solid big" type="button" id="crTry">${mine?'Înapoi la ofertele mele':'Încearcă singur'} ${ico('arrow',18)}</button><button class="pill" type="button" id="crShuffle">${ico('refresh',17)}Alte exemple</button></div>
    </div>`;
    return `<div class="mode-bar own">${seg}<p class="muted">${mine?'Ofertele tale se salvează automat.':'Adaugă ofertele primite de la bănci sau IMF-uri.'}</p></div>`;
  }
  function emptyHTML(){
    return `<div class="panel empty"><span class="ico-big">${ico('card',34)}</span><h2>Nicio ofertă de-a ta încă</h2><p>Adaugă ofertele primite de la bănci sau IMF-uri. Pentru fiecare îți calculez rata, costul total și DAE, apoi îți arăt de ce una e mai ieftină.</p><div class="row" style="justify-content:center"><button class="pill solid" type="button" data-plus="0">+ Adaugă o ofertă</button><button class="pill" type="button" id="crBackDemo">Vezi exemplul</button></div></div>`;
  }
  const tryTileHTML=()=>`<div class="cr-plus end try"><button type="button" data-try aria-label="Încearcă singur, cu ofertele tale"><b>${ico('arrow',30)}</b>Încearcă singur<small>cu ofertele tale</small></button></div>`;

  /* ---------- page ---------- */
  function build(){
    const p=$('#pane-credite-compara');
    p.innerHTML=`<div id="crDemo"></div><div class="panel pad cr-controls" id="crControls">
        <div class="cr-ctl" id="crAmountBox"><label for="crAmount">Suma creditului</label><span class="amt"><input class="inp num" id="crAmount" inputmode="decimal" autocomplete="off" aria-describedby="crAmountErr"><em>lei</em></span><input type="range" id="crAmountR" min="1000" max="1500000" step="1000" aria-label="Suma creditului, glisor"><span class="err" id="crAmountErr" hidden></span></div>
        <div class="cr-ctl" id="crMonthsBox"><label for="crMonths">Perioada <span class="muted" id="crYears" style="text-transform:none;letter-spacing:0;font-weight:600"></span></label><span class="amt"><input class="inp num" id="crMonths" inputmode="numeric" autocomplete="off" aria-describedby="crMonthsErr"><em>luni</em></span><input type="range" id="crMonthsR" min="3" max="360" step="1" aria-label="Perioada în luni, glisor"><span class="err" id="crMonthsErr" hidden></span></div>
        <div class="cr-ctl-actions"><button class="pill solid" type="button" id="crAdd">+ Adaugă ofertă</button></div>
      </div>
      <div id="crVerdict"></div>
      <div class="cr-rail-wrap"><div class="cr-rail" id="crRail" aria-label="Ofertele comparate"></div></div>
      <div id="crBreak"></div>
      <div class="row cr-foot" id="crFoot"><button class="pill sm danger" type="button" id="crClear">Golește comparația</button></div>`;
    $('#pane-credite-ghid').innerHTML=guideHTML();
    $('#act-credite').innerHTML=`<button class="pill" type="button" data-ask="credite">${ico('ai',18)}Întreabă asistentul</button>`;
    bind();built=true;
  }
  function render(){
    if(!st)load();
    const list=deck(),ev=evaluate(),demoMode=isDemo();
    const n=list.length;
    $('#crDemo').innerHTML=modeBarHTML();
    $('#crFoot').hidden=demoMode||!n;
    $('#crAdd').innerHTML=demoMode?'+ Adaugă oferta ta':'+ Adaugă ofertă';
    $('#v-credite').classList.toggle('cr-demo',demoMode);
    if(!n){$('#crVerdict').innerHTML=demoMode?'':emptyHTML();rail().innerHTML='';$('#crBreak').innerHTML='';renderControls();return}
    $('#crVerdict').innerHTML=verdictHTML(ev);
    const bestCost=ev.best>=0?ev.res[ev.best].totalCost:0,bestName=ev.best>=0?nameOf(list[ev.best],ev.best):'';
    let h='';
    list.forEach((o,k)=>{
      const r=ev.res[k];const isBest=k===ev.best&&ev.idx.length>1;
      if(!demoMode)h+=plusHTML(k,false);
      h+=`<article class="offer${isBest?' best':''}" data-id="${o.id}" aria-label="${esc(nameOf(o,k))}"><div class="offer-in"><div class="face front">${frontHTML(o,r,{k,isBest,bestCost,bestName,n:ev.idx.length})}</div><div class="face back" inert>${backHTML(o)}</div></div></article>`;
    });
    h+=demoMode?tryTileHTML():plusHTML(n,true);
    const open=$('#crRail .offer.flip')?.dataset.id;
    rail().innerHTML=h;
    if(open){const el=rail().querySelector(`.offer[data-id="${open}"]`);if(el){el.classList.add('flip');el.querySelector('.face.back').inert=false;el.querySelector('.face.front').inert=true}}
    $('#crBreak').innerHTML=breakdownHTML(ev);
    renderControls();
  }
  /** Updates everything except the card being edited, so typing is never interrupted. */
  function refresh(){
    const list=deck(),ev=evaluate();
    $('#crDemo').innerHTML=modeBarHTML();
    $('#crVerdict').innerHTML=verdictHTML(ev);
    const bestCost=ev.best>=0?ev.res[ev.best].totalCost:0,bestName=ev.best>=0?nameOf(list[ev.best],ev.best):'';
    $$('.offer',rail()).forEach(el=>{const k=list.findIndex(o=>o.id===el.dataset.id);if(k<0)return;const isBest=k===ev.best&&ev.idx.length>1;el.classList.toggle('best',isBest);el.querySelector('.face.front').innerHTML=frontHTML(list[k],ev.res[k],{k,isBest,bestCost,bestName,n:ev.idx.length});el.setAttribute('aria-label',nameOf(list[k],k));const t=el.querySelector('[data-f="term"]');if(t)t.placeholder=st.months});
    $('#crBreak').innerHTML=breakdownHTML(ev);
    renderControls();
  }
  function renderControls(){
    const a=$('#crAmount'),m=$('#crMonths');if(!a)return;
    if(document.activeElement!==a)a.value=fmt0(st.amount);
    if(document.activeElement!==m)m.value=st.months;
    const ar=$('#crAmountR'),mr=$('#crMonthsR');
    ar.value=clamp(st.amount,+ar.min,+ar.max);mr.value=clamp(st.months,+mr.min,+mr.max);
    for(const r of [ar,mr])r.style.setProperty('--p',((r.value-r.min)/(r.max-r.min)*100)+'%');
    $('#crYears').textContent=`· ${monthsLabel(st.months)}`;
  }

  /* ---------- validation ---------- */
  function check(k,raw,o){
    const v=String(raw??'').trim();
    const numOr=(def)=>v===''?def:parseAmount(v);
    switch(k){
      case 'lender':case 'product':return{ok:true,value:v.slice(0,k==='lender'?40:50)};
      case 'source':return{ok:true,value:v.slice(0,120)};
      case 'rate':{if(v==='')return{ok:false,msg:'Scrie dobânda anuală, de exemplu 11,5.'};const n=parseAmount(v);if(!Number.isFinite(n))return{ok:false,msg:'Scrie dobânda ca număr, de exemplu 11,5.'};if(n<0||n>100)return{ok:false,msg:'Dobânda anuală trebuie să fie între 0 și 100 %.'};return{ok:true,value:n}}
      case 'fee':{const n=numOr(0);if(!Number.isFinite(n))return{ok:false,msg:'Scrie comisionul ca număr (0 dacă nu există).'};if(n<0)return{ok:false,msg:'Comisionul nu poate fi negativ.'};if(o.feeUnit==='%'&&n>50)return{ok:false,msg:'Un comision peste 50 % pare greșit. Verifică oferta.'};if(o.feeUnit!=='%'&&n>=st.amount)return{ok:false,msg:'Comisionul e cel puțin cât suma creditului. Verifică oferta.'};return{ok:true,value:n}}
      case 'monthly':case 'insurance':{const n=numOr(0);if(!Number.isFinite(n))return{ok:false,msg:'Scrie suma ca număr (0 dacă nu există).'};if(n<0)return{ok:false,msg:'Suma nu poate fi negativă.'};if(n>1e6)return{ok:false,msg:'Suma lunară pare prea mare. Verifică.'};return{ok:true,value:n}}
      case 'term':{if(v==='')return{ok:true,value:''};const n=Number(v.replace(/\s/g,''));if(!Number.isInteger(n)||n<1||n>600)return{ok:false,msg:'Perioada trebuie să fie un număr întreg între 1 și 600 de luni.'};return{ok:true,value:n}}
      case 'early':{const n=numOr(0);if(!Number.isFinite(n)||n<0||n>20)return{ok:false,msg:'Comisionul de rambursare anticipată e între 0 și 20 %.'};return{ok:true,value:n}}
      case 'daeDecl':{if(v==='')return{ok:true,value:''};const n=parseAmount(v);if(!Number.isFinite(n)||n<0||n>300)return{ok:false,msg:'Scrie DAE ca procent, de exemplu 13,8.'};return{ok:true,value:n}}
      case 'date':{if(v&&v>todayISO())return{ok:false,msg:'Data ofertei nu poate fi în viitor.'};return{ok:true,value:v}}
    }
    return{ok:true,value:v};
  }
  function showErr(inp,msg){
    const e=$('#e-'+inp.id);inp.setAttribute('aria-invalid',msg?'true':'false');
    if(e){e.textContent=msg||'';e.hidden=!msg}
  }
  function onField(inp){
    const el=inp.closest('.offer');const o=deck().find(x=>x.id===el.dataset.id);if(!o)return;
    const k=inp.dataset.f;
    if(['rateType','type','feeUnit'].includes(k)){o[k]=inp.value;if(k==='feeUnit'){const f=el.querySelector('[data-f="fee"]');const c=check('fee',f.value,o);showErr(f,c.ok?'':c.msg);if(c.ok)o.fee=c.value}}
    else{const c=check(k,inp.value,o);showErr(inp,c.ok?'':c.msg);if(!c.ok)return;o[k]=c.value}
    el.querySelector('[data-form-err]').hidden=true;
    save();refresh();
  }
  function validateCard(el){
    const o=deck().find(x=>x.id===el.dataset.id);let first=null;
    for(const inp of $$('input[data-f]',el)){const c=check(inp.dataset.f,inp.value,o);showErr(inp,c.ok?'':c.msg);if(!c.ok&&!first)first=inp;else if(c.ok)o[inp.dataset.f]=c.value}
    if(first){const det=first.closest('details');if(det)det.open=true;el.querySelector('[data-form-err]').hidden=false;first.focus();return false}
    return true;
  }
  function setAmount(v,fromRange){
    const n=fromRange?+v:parseAmount(v),err=$('#crAmountErr'),inp=$('#crAmount');
    if(!Number.isFinite(n)||n<100||n>10000000){if(!fromRange){err.textContent='Scrie o sumă între 100 și 10 000 000 lei.';err.hidden=false;inp.setAttribute('aria-invalid','true')}return}
    err.hidden=true;inp.removeAttribute('aria-invalid');st.amount=n;save();refresh();
  }
  function setMonths(v,fromRange){
    const n=Number(String(v).replace(/\s/g,'')),err=$('#crMonthsErr'),inp=$('#crMonths');
    if(!Number.isInteger(n)||n<1||n>600){if(!fromRange){err.textContent='Perioada trebuie să fie între 1 și 600 de luni.';err.hidden=false;inp.setAttribute('aria-invalid','true')}return}
    err.hidden=true;inp.removeAttribute('aria-invalid');st.months=n;save();refresh();
  }

  /* ---------- actions ---------- */
  function flip(el,on){
    el.classList.toggle('flip',on);
    el.querySelector('.face.back').inert=!on;el.querySelector('.face.front').inert=on;
    if(on){el.querySelector('.face.back').scrollTop=0;setTimeout(()=>el.querySelector('[data-f="'+(complete(deck().find(o=>o.id===el.dataset.id))?'lender':'rate')+'"]')?.focus({preventScroll:true}),calm()?0:450)}
    else setTimeout(()=>el.querySelector('[data-act="edit"]')?.focus({preventScroll:true}),calm()?0:300);
  }
  function openCard(o){
    const el=rail().querySelector(`.offer[data-id="${o.id}"]`);
    if(el){
      el.scrollIntoView({behavior:calm()?'auto':'smooth',inline:'center',block:'nearest'});
      if(!calm())el.animate([{transform:'scale(.8) rotateY(-40deg)'},{transform:'none'}],{duration:650,easing:'cubic-bezier(.16,1,.3,1)'});
      setTimeout(()=>flip(el,true),calm()?0:380);
    }
  }
  function insertAt(idx){
    if(isDemo()){tryYourself();return}
    if(st.offers.length>=MAX){toast(`Poți compara cel mult ${MAX} oferte deodată.`);return}
    const o=blank();st.offers.splice(idx,0,o);save();render();openCard(o);
  }
  /** Leaves the demo: the user's own offers (two empty cards the first time). */
  function tryYourself(){
    st.mode='own';
    let fresh=null;
    if(!st.offers.length){st.offers=[blank(),blank()];fresh=st.offers[0]}
    save();render();
    $('#crControls')?.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'});
    if(fresh)setTimeout(()=>openCard(fresh),calm()?0:250);
    toast(fresh?'Scrie datele primei oferte. Exemplul îl revezi oricând.':'Acum vezi ofertele tale.');
  }
  function showDemo(){st.mode='demo';save();render()}
  function setDeck(arr){if(isDemo())demo.offers=arr;else st.offers=arr}
  function removeOffers(pred,msg){
    const list=deck();const before=list.map((o,i)=>({o,i}));const gone=before.filter(x=>pred(x.o));if(!gone.length)return;
    const wasDemo=isDemo();
    setDeck(list.filter(o=>!pred(o)));save();render();
    toast(msg(gone.length),{action:'Anulează',onAction:()=>{if(isDemo()!==wasDemo)return;const arr=deck().slice();gone.forEach(({o,i})=>arr.splice(Math.min(i,arr.length),0,o));setDeck(arr);save();render();toast('Am pus ofertele la loc.')}});
  }
  function dup(el){
    const list=deck();const k=list.findIndex(o=>o.id===el.dataset.id);if(k<0)return;
    if(list.length>=MAX){toast(`Poți compara cel mult ${MAX} oferte deodată.`);return}
    const c={...clone(list[k]),id:(isDemo()?'ex-':'')+rid(),example:isDemo(),lender:(list[k].lender||'Ofertă')+' (copie)'};list.splice(k+1,0,c);save();render();
    const n=rail().querySelector(`.offer[data-id="${c.id}"]`);n?.scrollIntoView({behavior:calm()?'auto':'smooth',inline:'center',block:'nearest'});
    if(n&&!calm())n.animate([{transform:'translateX(-40px) scale(.9)'},{transform:'none'}],{duration:550,easing:'cubic-bezier(.16,1,.3,1)'});
    toast('Am duplicat oferta.');
  }
  function bind(){
    const v=$('#v-credite');
    v.addEventListener('click',e=>{
      const t=e.target;
      const plus=t.closest('[data-plus]');if(plus){insertAt(+plus.dataset.plus);return}
      if(t.closest('#crAdd')){if(isDemo())tryYourself();else insertAt(st.offers.length);return}
      if(t.closest('#crTry,[data-try],#crMine')){if(isDemo()||!st.offers.length)tryYourself();return}
      if(t.closest('#crShowDemo,#crBackDemo')){if(!isDemo())showDemo();return}
      if(t.closest('#crShuffle')){newDemo();render();toast('Alte trei exemple fictive, generate aleatoriu.');return}
      const cl=t.closest('#crClear');if(cl){if(isDemo())return;if(!armConfirm(cl,'Sigur? Șterg toate ofertele mele'))return;removeOffers(()=>true,c=>`Am șters ${c===1?'oferta':'toate cele '+c+' oferte'}.`);return}
      const ask=t.closest('[data-ask]');if(ask){App.AI.open({prompt:'Explică-mi de ce oferta cea mai ieftină costă mai puțin și ce riscuri au ofertele mele.'});return}
      const act=t.closest('[data-act]');if(!act)return;
      const el=act.closest('.offer');const a=act.dataset.act;
      if(a==='edit')flip(el,true);
      else if(a==='add-src'){flip(el,true);setTimeout(()=>{const d=el.querySelector('details');if(d){d.open=true;el.querySelector('[data-f="source"]')?.focus({preventScroll:true})}},calm()?0:480)}
      else if(a==='done'){if(validateCard(el)){save();flip(el,false);refresh()}}
      else if(a==='details')openDetails(el.dataset.id);
      else if(a==='dup')dup(el);
      else if(a==='del'){if(!armConfirm(act,'Sigur?'))return;const id=el.dataset.id;const go=()=>removeOffers(o=>o.id===id,()=>'Am șters oferta.');if(calm())go();else el.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.7) rotateY(50deg)'}],{duration:380,easing:'ease-in'}).finished.then(go,go)}
    });
    v.addEventListener('input',e=>{
      const t=e.target;
      if(t.closest('.face.back')&&t.dataset.f&&t.tagName==='INPUT'&&t.type!=='date')onField(t);
      else if(t.id==='crAmount')setAmount(t.value);
      else if(t.id==='crMonths')setMonths(t.value);
      else if(t.id==='crAmountR')setAmount(t.value,true);
      else if(t.id==='crMonthsR')setMonths(t.value,true);
    });
    v.addEventListener('change',e=>{
      const t=e.target;
      if(t.closest('.face.back')&&t.dataset.f&&(t.tagName==='SELECT'||t.type==='date'))onField(t);
      else if(t.id==='crRef'){refId=t.value;$('#crVerdict').innerHTML=verdictHTML(evaluate());$('#crRef')?.focus()}
      else if(t.id==='crAmount'||t.id==='crMonths'){if($('#crAmountErr').hidden&&$('#crMonthsErr').hidden)renderControls()}
    });
    v.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.closest?.('.face.back input')){e.preventDefault();const el=e.target.closest('.offer');if(validateCard(el)){save();flip(el,false);refresh()}}});
    Store.on(ch=>{if(ch&&!ch.has(KEY))return;const busy=$('#crRail .offer.flip')||v.contains(document.activeElement)&&document.activeElement.matches('input,select');if(busy&&ch)return;load();if(built&&App.sec==='credite')render()});
  }

  /* ---------- details modal ---------- */
  let tblMode='ani',modalId=null;
  function yearly(r){const ys=[];r.rows.forEach(x=>{const y=Math.floor((x.k-1)/12);ys[y]=ys[y]||{y:y+1,int:0,princ:0,fee:0,bal:0};ys[y].int+=x.interest;ys[y].princ+=x.principal;ys[y].fee+=x.fees;ys[y].bal=x.balance});return ys}
  function openDetails(id){
    const list=deck();const k=list.findIndex(x=>x.id===id),o=list[k];if(!o||!complete(o))return;modalId=id;
    const r=FinCalc.loan(o,st.amount,st.months);
    const kpi=(l,v,s='')=>`<div class="kpi"><div class="kpi-l">${l}</div><div class="kpi-v num">${v}</div>${s?`<div class="kpi-s">${s}</div>`:''}</div>`;
    const scen=[1,2,3].map(dp=>{const x=FinCalc.loan({...o,rate:+o.rate+dp},st.amount,st.months);return `<div><b class="num">${lei0(x.firstPayment)}/lună</b><span>dobândă ${pctS(+o.rate+dp)} (+${dp} p.p.) · cost total +${lei0(x.totalCost-r.totalCost)}</span></div>`}).join('');
    const sh=r.totalPaid||1;
    let daeNote='';
    if(o.daeDecl!==''&&o.daeDecl!=null&&r.dae!=null){const d=+o.daeDecl-r.dae*100;daeNote=Math.abs(d)<=.3?`<p class="note">${lbl('user','DAE declarată')} ${pctS(o.daeDecl)} se potrivește cu DAE calculată din datele tale (${pct(r.dae*100,2)}).</p>`:`<p class="note">${lbl('chk')} DAE declarată de creditor (${pctS(o.daeDecl)}) e ${d>0?'mai mare':'mai mică'} decât DAE calculată din datele introduse (${pct(r.dae*100,2)}). ${d>0?'Probabil oferta mai include costuri pe care nu le-ai trecut (alte comisioane, asigurări). Cere creditorului lista completă.':'Verifică dacă ai introdus corect comisioanele și asigurarea.'}</p>`}
    Modal.open({eyebrow:'Detalii ofertă · calcul exact',title:`${nameOf(o,k)}${o.product?' · '+o.product:''}`,html:`
      ${o.example?`<p class="note">${lbl('demo')} Ofertă fictivă, generată aleatoriu ca exemplu. Nu e o ofertă reală.</p>`:''}
      <div class="kpis">
        ${kpi(o.type==='desc'?'Prima rată':'Rata lunară',lei(r.firstPayment),o.type==='desc'?'ultima: '+lei(r.lastPayment):(r.monthlyFee+r.insurance?'include '+lei(r.monthlyFee+r.insurance)+' comisioane și asigurare':'aceeași în fiecare lună'))}
        ${kpi('Dobândă totală',lei(r.totalInterest))}
        ${kpi('Comisioane și asigurare',lei(r.totalFees),r.upfront?'din care acordare: '+lei(r.upfront):'')}
        ${kpi('Total de plată',lei(r.totalPaid),'DAE calculată: '+(r.dae==null?'—':pct(r.dae*100)))}
      </div>
      ${daeNote}
      <section class="sec"><h3>Din ce e format totalul</h3>
        <div class="stack-bar" style="height:22px"><i style="width:${(r.principal/sh*100).toFixed(2)}%;background:rgba(255,255,255,.75)"></i><i style="width:${(r.totalInterest/sh*100).toFixed(2)}%;background:var(--coral)"></i><i style="width:${(r.totalFees/sh*100).toFixed(2)}%;background:var(--amber)"></i></div>
        <div class="legend" style="margin-top:10px"><span><i class="sw" style="background:rgba(255,255,255,.75)"></i>Suma împrumutată ${lei0(r.principal)} (${Math.round(r.principal/sh*100)}%)</span><span><i class="sw" style="background:var(--coral)"></i>Dobândă ${lei0(r.totalInterest)} (${Math.round(r.totalInterest/sh*100)}%)</span><span><i class="sw" style="background:var(--amber)"></i>Comisioane ${lei0(r.totalFees)} (${Math.round(r.totalFees/sh*100)}%)</span></div>
      </section>
      <section class="sec"><div class="sec-head"><h3>Cât plătești în fiecare an</h3><div class="legend"><span><i class="sw" style="background:rgba(255,255,255,.8)"></i>Principal</span><span><i class="sw" style="background:var(--coral)"></i>Dobândă</span><span><i class="sw" style="background:var(--amber)"></i>Comisioane</span></div></div><div class="chart" id="crmChart"></div></section>
      <section class="sec"><div class="sec-head"><h3>Dacă dobânda crește</h3>${lbl('hyp','Scenariu ipotetic')}</div><p class="muted" style="margin:0 0 10px;font-size:14px">${o.rateType==='variabila'?'Dobânda e variabilă, deci poate crește pe parcurs.':'Dobânda e fixă; scenariul arată cât de sensibil e creditul dacă oferta se schimbă până la semnare.'} Presupun că noua dobândă se aplică din prima lună.</p><div class="scen">${scen}</div></section>
      <section class="sec"><div class="sec-head"><h3>Graficul de rambursare</h3><div class="seg" role="group" aria-label="Afișare"><button type="button" data-tbl="ani" class="${tblMode==='ani'?'on':''}">Pe ani</button><button type="button" data-tbl="luni" class="${tblMode==='luni'?'on':''}">Pe luni</button></div></div><div class="tbl-wrap tbl-scroll" id="crmTable"></div></section>
      <div class="row" style="margin-top:20px"><button class="pill solid" type="button" data-act="ask-offer">Întreabă asistentul despre această ofertă</button></div>
      <p class="muted" style="font-size:12.5px;margin-top:16px">Calculele folosesc valori nerotunjite; afișarea e rotunjită. DAE calculată = rata lunară internă de rentabilitate dintre suma primită efectiv (suma minus comisionul de acordare) și plățile lunare (rată + comision lunar + asigurare), anualizată ca (1+r)<sup>12</sup> − 1. DAE din contract poate include și alte costuri.</p>`,onclose:()=>{modalId=null}});
    drawSchedule(r);drawTable(r);
    const body=Modal.body();
    body.addEventListener('click',e=>{
      const tb=e.target.closest('[data-tbl]');if(tb){tblMode=tb.dataset.tbl;$$('[data-tbl]',body).forEach(b=>b.classList.toggle('on',b===tb));drawTable(r);return}
      if(e.target.closest('[data-act="ask-offer"]')){Modal.close();App.AI.open({prompt:`Explică-mi oferta „${nameOf(o,k)}${o.product?' '+o.product:''}”: ce plătesc de fapt, ce riscuri are și ce trebuie să verific în contract.`})}
    });
  }
  function drawSchedule(r){
    const el=$('#crmChart');if(!el)return;const ys=yearly(r);
    Charts.columns(el,{height:220,stacked:true,aria:'Principal, dobândă și comisioane plătite în fiecare an',
      cats:ys.map(y=>({tip:Charts.tipHTML(`Anul ${y.y}`,[['rgba(255,255,255,.8)','Principal',y.princ],['var(--coral)','Dobândă',y.int],['var(--amber)','Comisioane',y.fee]])})),
      series:[{color:'rgba(255,255,255,.8)',values:ys.map(y=>y.princ)},{color:'var(--coral)',values:ys.map(y=>y.int)},{color:'var(--amber)',values:ys.map(y=>y.fee)}],
      labelOf:(i,band)=>band<34&&i%2?'':`anul ${i+1}`});
  }
  function drawTable(r){
    const el=$('#crmTable');if(!el)return;
    const rows=tblMode==='ani'?yearly(r).map(y=>[`Anul ${y.y}`,y.princ+y.int+y.fee,y.princ,y.int,y.fee,y.bal]):r.rows.map(x=>[`Luna ${x.k}`,x.payment+x.fees,x.principal,x.interest,x.fees,x.balance]);
    el.innerHTML=`<table class="tbl"><thead><tr><th>${tblMode==='ani'?'An':'Lună'}</th><th>Plată</th><th>Principal</th><th>Dobândă</th><th>Comisioane</th><th>Sold rămas</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${c[0]}</td>${c.slice(1).map(v=>`<td>${fmt2(v)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th>Total</th><th>${fmt2(r.totalPaid-r.upfront)}</th><th>${fmt2(r.principal)}</th><th>${fmt2(r.totalInterest)}</th><th>${fmt2(r.totalMonthlyFees+r.totalInsurance)}</th><th>—</th></tr></tfoot></table>${r.upfront?`<p class="muted" style="font-size:13px;margin:8px 12px">Comisionul de acordare (${lei(r.upfront)}) se plătește la început și nu apare în tabel.</p>`:''}`;
  }
  addEventListener('resize',()=>{if(modalId&&Modal.isOpen()){const o=deck().find(x=>x.id===modalId);if(o)drawSchedule(FinCalc.loan(o,st.amount,st.months))}});

  /* ---------- guide ---------- */
  const REF={ann:2224.444768490176,daeFee:0.13683017707158207,daeMix:0.12628687713604458,costMix:32987.24451219954,daeDesc:0.2094300343249611,costDesc:48537.5};
  function checks(){
    const out=[];const add=(name,a,b,tol,f=lei)=>out.push({name,a,b,ok:Math.abs(a-b)<=tol,f});
    add('Rata pentru 100 000 lei, 12 %, 60 de luni',FinCalc.annuityPayment(100000,12,60),REF.ann,1e-6);
    const d=FinCalc.loan({rate:12,type:'desc',fee:0},60000,12);
    add('Rate descrescătoare, 60 000 lei, 12 %, 12 luni: dobânda totală',d.totalInterest,3900,1e-6);
    add('DAE cu comision de acordare 2 % (100 000 lei, 12 %, 60 luni)',FinCalc.loan({rate:12,type:'ann',fee:2,feeUnit:'%'},100000,60).dae*100,REF.daeFee*100,1e-7,x=>pct(x,4));
    const m=FinCalc.loan({rate:9.9,type:'ann',fee:1,feeUnit:'%',monthly:50,insurance:30},100000,60);
    add('Cost total cu comision, comision lunar și asigurare',m.totalCost,REF.costMix,1e-6);
    add('DAE pentru aceeași ofertă',m.dae*100,REF.daeMix*100,1e-7,x=>pct(x,4));
    const c=FinCalc.loan({rate:18.9,type:'desc',fee:500,feeUnit:'lei'},100000,60);
    add('DAE, rate descrescătoare și comision fix de 500 lei',c.dae*100,REF.daeDesc*100,1e-7,x=>pct(x,4));
    const offers=[{rate:10.9,type:'ann',fee:1.5,feeUnit:'%',insurance:35},{rate:8.9,type:'ann'},{rate:18.9,type:'desc',fee:500,feeUnit:'lei'}];
    const cmp=FinCalc.compare(offers,200000,60),w=FinCalc.whyCheaper(offers,cmp.res,1,0);
    add('Componentele explică exact diferența de cost',w.parts.reduce((s,p)=>s+p.diff,0),w.total,1e-6);
    return out;
  }
  function guideHTML(){
    const ch=checks(),ok=ch.every(c=>c.ok);
    return `<div class="guide">
      <article class="panel">
        <h2 id="g-cr-1">Cum compari corect două credite</h2>
        <ol><li>Scrie <b>aceeași sumă și aceeași perioadă</b> pentru toate ofertele. Altfel costurile nu se pot compara.</li><li>Pentru fiecare ofertă completează dobânda, comisioanele și asigurarea exact cum apar în oferta scrisă.</li><li>Uită-te la <b>costul total</b>, nu doar la rata lunară. O rată mai mică poate ascunde o perioadă mai lungă sau comisioane mai mari.</li><li>Citește secțiunea <b>„De unde vine diferența”</b>: îți arată câți lei vin din dobândă, din comisioane și din asigurare.</li></ol>
        <h2 id="g-cr-2">Termenii, pe scurt</h2>
        <dl><dt>Dobânda anuală (nominală)</dt><dd>Prețul banilor împrumutați, fără comisioane. Poate fi fixă (nu se schimbă) sau variabilă (se poate schimba pe parcurs).</dd>
          <dt>DAE (dobânda anuală efectivă)</dt><dd>Costul total al creditului exprimat ca procent pe an: include dobânda și costurile obligatorii. E cel mai bun indicator unic, dar verifică și suma în lei.</dd>
          <dt>Comision de acordare</dt><dd>Se plătește o singură dată, la început (procent din sumă sau o sumă fixă). Primești de fapt suma minus comisionul.</dd>
          <dt>Comision lunar și asigurare</dt><dd>Se adaugă la fiecare rată. 50 de lei pe lună înseamnă 3 000 de lei în 5 ani.</dd>
          <dt>Rate egale (anuități) și rate descrescătoare</dt><dd>La rate egale plătești aceeași sumă lunar. La rate descrescătoare principalul se plătește în părți egale, deci prima rată e cea mai mare, dar dobânda totală e mai mică.</dd>
          <dt>Rambursare anticipată</dt><dd>Comisionul plătit dacă închizi creditul mai devreme. Contează dacă plănuiești să plătești mai repede.</dd></dl>
        <h2 id="g-cr-3">Formulele folosite</h2>
        <p>Rata lunară la anuități, cu suma S, dobânda lunară i = dobânda anuală / 12 și n luni:</p>
        <div class="formula">rata = S · i / (1 − (1 + i)<sup>−n</sup>)</div>
        <p>Cost total = dobânda totală + comisionul de acordare + comisioanele lunare + asigurarea.</p>
        <p>DAE: găsesc rata lunară r pentru care suma primită efectiv (S − comision de acordare) e egală cu valoarea actuală a tuturor plăților lunare, apoi:</p>
        <div class="formula">DAE = (1 + r)<sup>12</sup> − 1</div>
        <h2 id="g-cr-4">Verificarea calculelor</h2>
        <p>Formulele sunt scrise și testate separat de asistentul AI. Mai jos, aceleași formule rulează acum în pagina ta și sunt comparate cu valori calculate independent.</p>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Verificare</th><th>Rezultat EcoFin</th><th>Referință</th><th>Stare</th></tr></thead><tbody>${ch.map(c=>`<tr><td style="white-space:normal;min-width:220px">${esc(c.name)}</td><td>${c.f(c.a)}</td><td>${c.f(c.b)}</td><td class="${c.ok?'ok':'bad'}">${c.ok?'corect':'diferit'}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted" style="font-size:13.5px">${ok?`Toate cele ${ch.length} verificări au trecut.`:'Una dintre verificări nu a trecut. Rezultatele pot fi greșite.'}</p>
        <h2 id="g-cr-5">Exemple și oferte reale</h2>
        <p>La prima vedere, comparația îți arată trei oferte fictive, generate aleatoriu și marcate cu eticheta <span class="lbl demo">Exemplu</span>: una cu dobândă mică dar cu comisioane, una fără comisioane și un microcredit rapid. Cu „Alte exemple” primești alte trei. Exemplele nu se salvează și nu se amestecă niciodată cu ofertele tale.</p>
        <p>Când apeși <b>„Încearcă singur”</b>, treci la ofertele tale: completezi datele din ofertele primite și adaugi oricâte cu „+”. Pentru fiecare, trece sursa și data ofertei: condițiile se schimbă, iar oferta finală o stabilește creditorul prin contract.</p>
      </article>
      <aside class="panel"><h3>În acest ghid</h3><nav class="toc">${[['g-cr-1','Cum compari'],['g-cr-2','Termenii'],['g-cr-3','Formulele'],['g-cr-4','Verificarea calculelor'],['g-cr-5','Exemple și oferte reale']].map(([id,l])=>`<button type="button" data-jump="${id}">${l}</button>`).join('')}</nav>
        <button class="pill solid" type="button" data-tour="credite">Arată-mi pe pagină</button></aside>
    </div>`;
  }
  function tour(){
    App.go('credite','compara');
    setTimeout(()=>Tour.start([
      {el:'#crAmountBox',text:'Scrie suma pe care vrei s-o împrumuți. Se aplică tuturor ofertelor, ca să le compari corect.'},
      {el:'#crMonthsBox',text:'Alege perioada în luni. Dacă o bancă oferă altă perioadă, o schimbi doar pentru acea ofertă.'},
      $('.offer')&&{el:()=>$('.offer'),text:'Fiecare card e o ofertă: rata lunară, costul total și DAE. „Editează” întoarce cardul ca să scrii datele din oferta primită.'},
      $('.cr-plus button')&&{el:()=>$('.cr-plus button'),text:'Butonul „+” dintre carduri adaugă o ofertă nouă exact în acel loc.'},
      $('.verdict')&&{el:()=>$('.verdict'),text:'Aici afli de ce oferta cea mai ieftină costă mai puțin: câți lei vin din dobândă, din comisioane și din asigurare.'},
      $('#crTry')&&{el:'#crTry',text:'Acestea sunt exemple fictive. Apasă „Încearcă singur” ca să compari ofertele tale.'},
      $('.cr-mode')&&{el:'.cr-mode',text:'Aici treci oricând între exemplu și ofertele tale.'}
    ]),App.sec==='credite'?120:500);
  }

  /* ---------- for other tools and the assistant ---------- */
  function snapshot(){
    if(!st)load();const list=deck(),ev=evaluate();
    let why=null;
    if(ev.idx.length>=2){const b=ev.best,ref=ev.idx.filter(k=>k!==b).sort((x,y)=>ev.res[x].totalCost-ev.res[y].totalCost)[0];const w=FinCalc.whyCheaper(list,ev.res,b,ref);why={cea_mai_ieftina:nameOf(list[b],b),comparata_cu:nameOf(list[ref],ref),diferenta_cost_total_lei:r2(w.total),componente_lei:Object.fromEntries(w.parts.map(p=>[p.label,r2(p.diff)])),avertismente:w.warnings.map(x=>x.text)}}
    return{ce_se_vede:isDemo()?'exemplu demonstrativ: trei oferte fictive, generate aleatoriu (nu sunt oferte reale)':'ofertele introduse de utilizator',
      oferte_proprii_salvate:st.offers.length,suma_lei:st.amount,perioada_luni:st.months,
      oferte:list.map((o,k)=>{const r=ev.res[k];return{nume:nameOf(o,k),produs:o.product||null,exemplu_fictiv:!!o.example,sursa_oferta:o.source||null,data_ofertei:o.date||null,
        introdus_de_utilizator:o.example?'nu: exemplu generat de site':{dobanda_anuala_proc:o.rate,tip_dobanda:o.rateType==='variabila'?'variabilă':'fixă',rambursare:o.type==='desc'?'rate descrescătoare':'rate egale',comision_acordare:o.feeUnit==='%'?`${o.fee}%`:`${o.fee} lei`,comision_lunar_lei:o.monthly,asigurare_lunara_lei:o.insurance,comision_rambursare_anticipata_proc:o.early,perioada_proprie_luni:o.term||null,dae_declarata_de_creditor_proc:o.daeDecl===''?null:o.daeDecl},
        conditii:o.example?{dobanda_anuala_proc:o.rate,tip_dobanda:o.rateType==='variabila'?'variabilă':'fixă',rambursare:o.type==='desc'?'rate descrescătoare':'rate egale',comision_acordare:o.feeUnit==='%'?`${o.fee}%`:`${o.fee} lei`,comision_lunar_lei:o.monthly,asigurare_lunara_lei:o.insurance}:undefined,
        calculat_exact:r?{prima_rata_lei:r2(r.firstPayment),ultima_rata_lei:r2(r.lastPayment),dobanda_totala_lei:r2(r.totalInterest),comision_acordare_lei:r2(r.upfront),comisioane_lunare_total_lei:r2(r.totalMonthlyFees),asigurare_total_lei:r2(r.totalInsurance),cost_total_lei:r2(r.totalCost),total_de_plata_lei:r2(r.totalPaid),dae_calculata_proc:r.dae==null?null:r2(r.dae*100),luni:r.n,cea_mai_ieftina:k===ev.best}:'ofertă incompletă (lipsește dobânda)'}}),
      de_ce_e_mai_ieftina_calculat:why};
  }
  /** Monthly payments of the user's own offers only (examples never reach the planner). */
  function payments(){if(!st)load();const ev=evaluate(st.offers);return ev.idx.map(k=>({id:st.offers[k].id,name:nameOf(st.offers[k],k),payment:r2(ev.res[k].firstPayment),example:false,best:k===ev.best}))}
  return{
    // offers saved on another device (or arriving after sign-in) must refresh the cached state even
    // before the credit page has been opened (the account page and the assistant read it too)
    init(){Store.on(ch=>{if(built||!st)return;if(ch&&!ch.has(KEY))return;load()})},
    show(sub){
      if(!built){load();build()}
      if(sub==='compara')render();
    },
    snapshot,payments,tour,
    count:()=>{if(!st)load();return st.offers.length},
    mode:()=>{if(!st)load();return st.mode},
    hasExamples:()=>false,
    deleteExamples:()=>0,
    demo(seed){if(!st)load();newDemo(seed);if(built&&App.sec==='credite')render();return demo.offers.map(o=>o.lender)},
    tryYourself:()=>tryYourself()
  };
})();
App.mods.credite=Credit;
