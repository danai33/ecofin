/* =====================================================================
   PLANIFICATOR — monthly plan, possible savings, unexpected expenses.
   The plan is also the budget used in Contabilitate.
   ===================================================================== */
const Planner=(()=>{
  const KEY='plan';
  const GROUPS=[
    ['income','Venituri','Salariul și alte venituri sigure din lună.'],
    ['essentials','Cheltuieli esențiale','Ce plătești oricum: locuință, facturi, mâncare, transport, sănătate.'],
    ['credits','Rate la credite','Rata lunară a fiecărui credit, cu tot cu comisioane.'],
    ['other','Alte cheltuieli','Ieșiri, haine, abonamente, cadouri.']
  ];
  const L=(name,amount,ex=true)=>({id:'ex-'+norm(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name,amount,ex});
  const EXAMPLE=()=>({
    income:[L('Salariu',14000),L('Alte venituri',1500)],
    essentials:[L('Locuință (chirie, întreținere)',3500),L('Facturi și utilități',1500),L('Alimente',2800),L('Transport',700),L('Sănătate',400)],
    credits:[L('Rată credit',2200)],
    other:[L('Ieșiri și distracții',1000),L('Haine',600),L('Abonamente',300)],
    fund:{amount:6000,ex:true}
  });
  let plan=null,built=false;
  const UE={amount:4000,rate:18,months:12,label:'Reparație auto'};
  function load(){
    const d=Store.get(KEY);
    if(d&&Array.isArray(d.income))plan={income:[],essentials:[],credits:[],other:[],fund:{amount:0,ex:false},...clone(d)};
    else plan=EXAMPLE();
    for(const[g]of GROUPS)plan[g]=(plan[g]||[]).map(x=>({id:x.id||rid(),name:String(x.name||''),amount:Math.max(0,+x.amount||0),ex:!!x.ex}));
    plan.fund={amount:Math.max(0,+plan.fund?.amount||0),ex:!!plan.fund?.ex};
  }
  function data(){if(!plan)load();return plan}
  function save(now){if(now)Store.set(KEY,clone(plan));else Store.setLater(KEY,clone(plan),600);App.emit('plan')}
  const calc=()=>FinCalc.plan(data());
  const exampleCount=()=>{const p=data();return GROUPS.reduce((s,[g])=>s+p[g].filter(x=>x.ex).length,0)+(p.fund.ex?1:0)};

  /* ---------- plan pane ---------- */
  function rowHTML(g,x){
    return `<div class="plan-row${x.ex?' ex':''}" data-id="${x.id}" data-g="${g}">
      <input class="inp" data-k="name" value="${esc(x.name)}" maxlength="40" aria-label="Numele liniei" placeholder="Nume" autocomplete="off">
      <span class="amt"><input class="inp num" data-k="amount" inputmode="decimal" value="${x.amount?fmt(x.amount):''}" placeholder="0" aria-label="Suma pentru ${esc(x.name||'linie')}${x.ex?' (exemplu)':''}" autocomplete="off"><em>lei</em></span>
      <button class="icon-btn" type="button" data-del aria-label="Șterge ${esc(x.name||'linia')}">✕</button></div>`;
  }
  function groupHTML([g,title,hint]){
    const tot=r2(data()[g].reduce((s,x)=>s+x.amount,0));
    return `<section class="panel plan-group" data-group="${g}"><h3><span>${title}</span><span class="num" data-gtot="${g}">${lei0(tot)}</span></h3><p class="muted" style="font-size:14px;margin-top:2px">${hint}</p>
      <div class="plan-rows">${data()[g].map(x=>rowHTML(g,x)).join('')}</div>
      <p class="err" data-gerr="${g}" hidden></p>
      <div class="plan-add"><button class="pill sm" type="button" data-add="${g}">+ Adaugă</button>${g==='credits'?'<button class="pill sm" type="button" data-import>Importă din calculatorul de credite</button>':''}</div>
      ${g==='credits'?'<div id="plImport"></div>':''}</section>`;
  }
  function demoHTML(){
    const n=exampleCount();if(!n)return '';
    return `<div class="demo-bar" role="note">${lbl('demo')}<p>Planul pornește de la un exemplu. ${n===1?'O sumă e':`${n} sume sunt`} încă din exemplu (chenar galben punctat). Înlocuiește-le cu sumele tale.</p><div class="row"><button class="pill sm" type="button" id="plClearEx">Golește sumele din exemplu</button><button class="pill sm" type="button" id="plKeep">Sunt sumele mele</button></div></div>`;
  }
  function resultHTML(){
    const p=calc(),n=exampleCount();
    const neg=p.canSave<0,inc=p.income||0;
    const w=v=>inc>0?(Math.max(0,v)/Math.max(inc,p.essentials+p.credits+p.other)*100).toFixed(2)+'%':'0%';
    let fix='';
    if(neg){const d=-p.canSave;fix=`<div class="advice"><h3>Cum ajungi pe zero</h3><ul>${p.other>=d?`<li>Reduce alte cheltuieli cu <b>${lei0(d)}</b> (de la ${lei0(p.other)} la ${lei0(p.other-d)}).</li>`:`<li>Chiar fără alte cheltuieli, lipsesc <b>${lei0(d-p.other)}</b>: e nevoie de un venit mai mare sau de cheltuieli esențiale mai mici.</li>`}<li>Sau crește venitul lunar cu <b>${lei0(d)}</b>.</li></ul></div>`}
    const months12=r2(Math.max(0,p.canSave)*12);
    const base=p.essentials+p.credits,fund=data().fund.amount;
    const cover=base>0?fund/base:null;
    return `${n?`<p class="note">${lbl('demo')} Rezultatul include ${plural(n,'sumă','sume')} din exemplu.</p>`:''}
      <div class="res-big${p.afterEssentials<0?' neg':''}"><span>Rămân după esențiale și rate ${lbl('calc')}</span><b class="num">${p.afterEssentials<0?'−':''}${lei0(Math.abs(p.afterEssentials))}</b><small> pe lună</small></div>
      <div class="res-lines">
        <div class="res-line"><span>Venituri</span><b class="num">${lei0(p.income)}</b></div>
        <div class="res-line"><span>− Cheltuieli esențiale</span><b class="num">${lei0(p.essentials)}</b></div>
        <div class="res-line"><span>− Rate la credite</span><b class="num">${lei0(p.credits)}</b></div>
        <div class="res-line total"><span>= Rămân</span><b class="num">${signed0(p.afterEssentials).replace('+','')}</b></div>
        <div class="res-line"><span>− Alte cheltuieli</span><b class="num">${lei0(p.other)}</b></div>
        <div class="res-line total"><span>= ${neg?'Lipsesc':'Poți economisi'}</span><b class="num">${lei0(Math.abs(p.canSave))}${neg?'':' / lună'}</b></div>
      </div>
      <div class="wf" role="img" aria-label="Din venit: esențiale ${lei0(p.essentials)}, rate ${lei0(p.credits)}, alte cheltuieli ${lei0(p.other)}, economii ${lei0(Math.max(0,p.canSave))}"><i style="width:${w(p.essentials)};background:var(--sky)"></i><i style="width:${w(p.credits)};background:var(--coral)"></i><i style="width:${w(p.other)};background:var(--amber)"></i><i style="width:${w(p.canSave)};background:var(--mint)"></i></div>
      <div class="legend"><span><i class="sw" style="background:var(--sky)"></i>Esențiale</span><span><i class="sw" style="background:var(--coral)"></i>Rate</span><span><i class="sw" style="background:var(--amber)"></i>Alte</span><span><i class="sw" style="background:var(--mint)"></i>Economii</span></div>
      ${fix}
      <dl class="hl">
        <div><dt>Rata de economisire ${lbl('calc')}</dt><dd>${p.savingsRate==null?'—':Math.round(p.savingsRate*100)+'%'}<small>din venit</small></dd></div>
        <div><dt>Ratele din venit ${lbl('calc')}</dt><dd>${p.creditShare==null?'—':Math.round(p.creditShare*100)+'%'}<small>${p.creditShare>.4?'o parte mare din venit merge pe datorii':'cât din venit merge pe datorii'}</small></dd></div>
        <div><dt>În 12 luni ${lbl('hyp','dacă planul se repetă')}</dt><dd>${lei0(months12)}<small>economisite</small></dd></div>
        <div><dt>Fond de urgență ${lbl('est','reper')}</dt><dd>${cover==null?'—':`${fmt(Math.round(cover*10)/10)} luni`}<small>acoperite de ${lei0(fund)}; un reper des folosit e 3–6 luni (${lei0(p.emergencyMin)}–${lei0(p.emergencyMax)})</small></dd></div>
      </dl>
      <div class="row"><button class="pill" type="button" data-goto="planificator-neprevazute">Dacă apare o cheltuială neprevăzută?</button>${p.canSave>0?'<button class="pill solid" type="button" id="plToJar">Pune economiile într-un borcan</button>':''}</div>`;
  }
  function renderPlan(){
    const host=$('#pane-planificator-lunar');
    host.innerHTML=`<div id="plDemo">${demoHTML()}</div><div class="plan-layout"><div>${GROUPS.map(groupHTML).join('')}
      <section class="panel plan-group"><h3><span>Fond de urgență</span></h3><p class="muted" style="font-size:14px;margin-top:2px">Bani puși deoparte doar pentru neprevăzute.</p><div class="plan-rows"><div class="plan-row${data().fund.ex?' ex':''}" data-fund style="grid-template-columns:minmax(0,1fr) 150px"><span class="muted">Ai acum</span><span class="amt"><input class="inp num" id="plFund" inputmode="decimal" value="${data().fund.amount?fmt(data().fund.amount):''}" placeholder="0" aria-label="Fond de urgență disponibil" autocomplete="off"><em>lei</em></span></div></div><p class="err" data-gerr="fund" hidden></p></section>
      </div><aside class="result panel" id="plResult" aria-live="polite">${resultHTML()}</aside></div>`;
  }
  function refreshResult(){
    $('#plResult').innerHTML=resultHTML();$('#plDemo').innerHTML=demoHTML();
    for(const[g]of GROUPS){const el=$(`[data-gtot="${g}"]`);if(el)el.textContent=lei0(data()[g].reduce((s,x)=>s+x.amount,0))}
  }
  function onInput(t){
    const row=t.closest('.plan-row');if(!row)return;
    if(t.id==='plFund'){const n=t.value.trim()===''?0:parseAmount(t.value);const e=$('[data-gerr="fund"]');if(!Number.isFinite(n)||n<0){t.setAttribute('aria-invalid','true');e.textContent='Scrie suma ca număr pozitiv, de exemplu 5 000.';e.hidden=false;return}t.removeAttribute('aria-invalid');e.hidden=true;data().fund={amount:n,ex:false};row.classList.remove('ex');save();refreshResult();return}
    const g=row.dataset.g,x=data()[g].find(z=>z.id===row.dataset.id);if(!x)return;
    const e=$(`[data-gerr="${g}"]`);
    if(t.dataset.k==='name'){x.name=t.value.slice(0,40);save();return}
    const n=t.value.trim()===''?0:parseAmount(t.value);
    if(!Number.isFinite(n)||n<0){t.setAttribute('aria-invalid','true');e.textContent='Scrie suma ca număr pozitiv, de exemplu 1 200.';e.hidden=false;return}
    if(n>1e8){t.setAttribute('aria-invalid','true');e.textContent='Suma pare prea mare. Verifică cifrele.';e.hidden=false;return}
    t.removeAttribute('aria-invalid');e.hidden=true;x.amount=n;if(x.ex){x.ex=false;row.classList.remove('ex')}
    save();refreshResult();
  }
  function importHTML(){
    const list=Credit.payments();
    if(!list.length)return `<p class="note">În calculatorul de credite nu ai nicio ofertă completă. <button class="link" type="button" data-goto="credite">Deschide calculatorul</button></p>`;
    return `<div class="note row"><label class="fld" style="flex:1 1 220px" for="plImpSel">Oferta<select class="inp" id="plImpSel">${list.map(o=>`<option value="${o.id}">${esc(o.name)} · ${lei0(o.payment)}/lună${o.example?' (exemplu)':''}${o.best?' · cea mai ieftină':''}</option>`).join('')}</select></label><button class="pill sm solid" type="button" id="plImpGo">Adaugă rata</button></div>`;
  }
  function addLine(g,name='',amount=0){const x={id:rid(),name,amount,ex:false};data()[g].push(x);save(true);renderPlan();const el=$(`.plan-row[data-id="${x.id}"] [data-k="${name?'amount':'name'}"]`);el?.focus();return x}

  /* ---------- unexpected expense pane ---------- */
  function renderShock(){
    const host=$('#pane-planificator-neprevazute');
    const p=calc();
    host.innerHTML=`<div class="shock-grid"><section class="panel pad stack-gap">
        <h2 class="h2s">O cheltuială neprevăzută</h2>
        <div class="fld"><label for="ueAmount">Cât costă</label><span class="amt"><input class="inp num" id="ueAmount" inputmode="decimal" value="${fmt(UE.amount)}" aria-describedby="ueErr" autocomplete="off"><em>lei</em></span><span class="err" id="ueErr" hidden></span></div>
        <div class="chips">${[['Reparație auto',4000],['Dentist',2500],['Frigider nou',7000],['Medicamente',1200]].map(([l,v])=>`<button type="button" class="chip${UE.label===l?' on':''}" data-ue="${v}" data-uel="${l}">${l} · ${lei0(v)}</button>`).join('')}</div>
        <div class="note"><b>Din planul tău</b> ${lbl('user','Planificator')}<br>Fond de urgență: <b>${lei0(data().fund.amount)}</b> · poți economisi: <b>${lei0(Math.max(0,p.canSave))}</b> pe lună. <button class="link" type="button" data-goto="planificator">Schimbă planul</button>${exampleCount()?`<br>${lbl('demo')} Planul include sume din exemplu.`:''}</div>
        <details class="more-fields"><summary>Alternativa: un credit pentru rest</summary><div>
          <div class="g2"><div class="fld"><label for="ueRate">Dobândă anuală ${lbl('hyp')}</label><span class="amt"><input class="inp num" id="ueRate" inputmode="decimal" value="${numIn(UE.rate)}" autocomplete="off"><em>%</em></span></div><div class="fld"><label for="ueMonths">Perioada</label><span class="amt"><input class="inp num" id="ueMonths" inputmode="numeric" value="${UE.months}" autocomplete="off"><em>luni</em></span></div></div>
          <p class="muted" style="font-size:13.5px">Dobânda e o ipoteză pe care o alegi tu, nu o ofertă reală.</p></div></details>
      </section><section class="panel pad" id="ueResult" aria-live="polite"></section></div>`;
    renderShockResult();
  }
  function renderShockResult(){
    const p=calc(),fund=data().fund.amount,S=Math.max(0,p.canSave);
    const u=FinCalc.unexpected({amount:UE.amount,fund,monthlySavings:S});
    const out=[];
    out.push(`<div class="row">${lbl('calc')}${exampleCount()?lbl('demo','Plan cu exemple'):''}</div>`);
    out.push(`<h2 class="h2s" style="margin-top:8px">${esc(UE.label||'Cheltuiala')} de ${lei0(u.amount)}</h2>`);
    const steps=[];
    if(u.fromFund>0)steps.push(`<li><b>${lei0(u.fromFund)}</b> vin din fondul de urgență${u.rest<=0?`, care rămâne cu ${lei0(u.fundLeft)}`:', care se golește'}.</li>`);
    if(u.rest>0){
      if(u.covered)steps.push(`<li>Restul de <b>${lei0(u.rest)}</b> îl acoperi din economiile lunare în <b>${plural(u.months,'lună','luni')}</b>${u.months>1?` (${lei0(u.perMonth)} pe lună${Math.abs(u.lastMonth-u.perMonth)>.5?`, ultima lună ${lei0(u.lastMonth)}`:''})`:''}.</li>`);
      else steps.push(`<li>Restul de <b>${lei0(u.rest)}</b> nu se poate acoperi din economii: cu planul actual nu rămâne nimic de economisit.</li>`);
    }
    if(u.fromFund>0&&u.rebuildMonths!=null)steps.push(`<li>Refaci fondul de urgență în încă <b>${plural(u.rebuildMonths,'lună','luni')}</b>, dacă pui deoparte ${lei0(S)} pe lună.</li>`);
    else if(u.fromFund>0)steps.push(`<li>Ca să refaci fondul, ai nevoie de bani rămași la final de lună. Acum planul nu lasă nimic de economisit.</li>`);
    out.push(`<ol class="ue-steps">${steps.join('')}</ol>`);
    const total=(u.months||0)+(u.rebuildMonths||0);
    if(u.covered&&total>0){
      const cells=[];for(let k=0;k<Math.min(total,24);k++)cells.push(`<i class="${k<(u.months||0)?'pay':'fund'}" title="Luna ${k+1}"></i>`);
      out.push(`<div class="ue-time" role="img" aria-label="${u.months||0} luni de acoperit restul, apoi ${u.rebuildMonths||0} luni de refăcut fondul">${cells.join('')}</div><div class="legend">${u.months?'<span><i class="sw" style="background:var(--coral)"></i>Acoperi restul</span>':''}${u.rebuildMonths?'<span><i class="sw" style="background:var(--sky)"></i>Refaci fondul</span>':''}</div>`);
      out.push(`<p class="muted" style="font-size:14px">În total, economiile tale lunare sunt ocupate ${plural(total,'lună','luni')}. Abia apoi merg din nou spre alte obiective.</p>`);
    }
    if(u.rest>0){
      const L=FinCalc.loan({rate:UE.rate,type:'ann'},u.rest,UE.months);
      const left=r2(S-L.firstPayment);
      out.push(`<div class="sec"><h3>Dacă iei un credit pentru restul de ${lei0(u.rest)} ${lbl('hyp')}</h3><p>La ${pctS(UE.rate)} pe ${plural(UE.months,'lună','luni')}: rata ar fi <b>${lei0(L.firstPayment)}</b> pe lună și ai plăti <b>${lei0(L.totalInterest)}</b> dobândă. ${S>0?(left>=0?`Din economiile lunare ți-ar mai rămâne ${lei0(left)}.`:`Rata e mai mare decât ce poți economisi lunar, cu ${lei0(-left)}.`):''}</p>${u.covered?`<p class="muted" style="font-size:14px">Din economii plătești 0 lei dobândă, dar îți ia ${plural(u.months,'lună','luni')}.</p>`:''}</div>`);
    }
    if(!u.covered){out.push(`<div class="advice"><h3>Ce poți face</h3><ul><li>Revezi „Alte cheltuieli” din plan ca să rămână ceva lunar.</li><li>Construiește un fond de urgență, chiar și 200–300 lei pe lună contează.</li><li>Dacă iei un credit, compară ofertele în calculator înainte.</li></ul><div class="row"><button class="pill sm" type="button" data-goto="planificator">Revezi planul</button><button class="pill sm" type="button" data-goto="credite">Compară credite</button></div></div>`)}
    $('#ueResult').innerHTML=out.join('');
  }
  function guideHTML(){
    return `<div class="guide"><article class="panel">
      <h2 id="g-pl-1">La ce folosește planul lunar</h2><p>Scrii o singură dată venitul și cheltuielile obișnuite ale unei luni. EcoFin calculează cât îți rămâne după cheltuielile esențiale și rate și cât poți economisi. Același plan devine bugetul din Contabilitate, unde compari planul cu ce cheltui de fapt.</p>
      <h2 id="g-pl-2">Ce intră la esențiale</h2><p>Cheltuielile pe care nu le poți amâna: locuința, facturile, mâncarea, transportul până la serviciu, medicamentele. Restul (ieșiri, haine, abonamente) intră la „Alte cheltuieli”. Ratele la credite stau separat, ca să vezi cât din venit merge pe datorii.</p>
      <h2 id="g-pl-3">Socoteala</h2>
      <div class="formula">rămân = venituri − esențiale − rate</div><div class="formula">poți economisi = rămân − alte cheltuieli</div>
      <p>Toate rezultatele sunt calculate exact din sumele tale. „În 12 luni” presupune că luna se repetă la fel, de aceea are eticheta <span class="lbl hyp">Ipoteză</span>.</p>
      <h2 id="g-pl-4">Fondul de urgență</h2><p>Un reper des folosit în educația financiară este un fond egal cu 3–6 luni de cheltuieli esențiale și rate. E un reper orientativ, nu o regulă. În fila <b>Neprevăzute</b> vezi ce se întâmplă cu planul când apare o cheltuială mare: cât acoperă fondul, în câte luni acoperi restul din economii și cât ar costa varianta cu credit.</p>
      <h2 id="g-pl-5">Exemplul de pornire</h2><p>Planul pornește cu un exemplu, ca să vezi cum arată. Sumele din exemplu au chenar galben punctat și eticheta <span class="lbl demo">Exemplu</span>. Când scrii o sumă, devine a ta. Butonul „Golește sumele din exemplu” pune 0 la toate sumele din exemplu.</p>
    </article><aside class="panel"><h3>În acest ghid</h3><nav class="toc">${[['g-pl-1','La ce folosește'],['g-pl-2','Ce intră la esențiale'],['g-pl-3','Socoteala'],['g-pl-4','Fondul de urgență'],['g-pl-5','Exemplul de pornire']].map(([id,l])=>`<button type="button" data-jump="${id}">${l}</button>`).join('')}</nav><button class="pill solid" type="button" data-tour="planificator">Arată-mi pe pagină</button></aside></div>`;
  }
  function build(){
    $('#pane-planificator-ghid').innerHTML=guideHTML();
    $('#act-planificator').innerHTML=`<button class="pill" type="button" data-ask="plan">${ico('ai',18)}Întreabă asistentul</button>`;
    const v=$('#v-planificator');
    v.addEventListener('input',e=>{const t=e.target;if(t.closest('#pane-planificator-lunar'))onInput(t);
      else if(t.id==='ueAmount'){const n=parseAmount(t.value),er=$('#ueErr');if(!Number.isFinite(n)||n<=0||n>1e8){er.textContent='Scrie o sumă mai mare ca 0, de exemplu 3 000.';er.hidden=false;t.setAttribute('aria-invalid','true');return}er.hidden=true;t.removeAttribute('aria-invalid');UE.amount=n;UE.label='Cheltuiala';$$('[data-ue]').forEach(c=>c.classList.remove('on'));renderShockResult()}
      else if(t.id==='ueRate'){const n=parseAmount(t.value);if(Number.isFinite(n)&&n>=0&&n<=100){UE.rate=n;renderShockResult()}}
      else if(t.id==='ueMonths'){const n=Number(t.value);if(Number.isInteger(n)&&n>=1&&n<=120){UE.months=n;renderShockResult()}}});
    v.addEventListener('change',e=>{if(e.target.matches('#pane-planificator-lunar input[data-k="amount"],#plFund')){const n=parseAmount(e.target.value);if(Number.isFinite(n))e.target.value=n?fmt(n):''}});
    v.addEventListener('click',e=>{
      const t=e.target;
      const add=t.closest('[data-add]');if(add){addLine(add.dataset.add);return}
      const del=t.closest('[data-del]');if(del){const row=del.closest('.plan-row'),g=row.dataset.g;const arr=data()[g];const i=arr.findIndex(x=>x.id===row.dataset.id);if(i<0)return;const[x]=arr.splice(i,1);save(true);renderPlan();toast(`Am șters „${x.name||'linia'}”.`,{action:'Anulează',onAction:()=>{data()[g].splice(Math.min(i,data()[g].length),0,x);save(true);renderPlan()}});return}
      if(t.closest('[data-import]')){const h=$('#plImport');h.innerHTML=h.innerHTML?'':importHTML();return}
      if(t.closest('#plImpGo')){const o=Credit.payments().find(x=>x.id===$('#plImpSel').value);if(o){addLine('credits',`Rată ${o.name}`,o.payment);toast(`Am adăugat rata de ${lei0(o.payment)} pe lună.`)}return}
      const ce=t.closest('#plClearEx');if(ce){if(!armConfirm(ce,'Sigur? Pun 0 la sumele din exemplu'))return;const prev=clone(plan);for(const[g]of GROUPS)data()[g].forEach(x=>{if(x.ex){x.amount=0;x.ex=false}});if(plan.fund.ex)plan.fund={amount:0,ex:false};save(true);renderPlan();toast('Am golit sumele din exemplu. Scrie-le pe ale tale.',{action:'Anulează',onAction:()=>{plan=prev;save(true);renderPlan()}});return}
      const kp=t.closest('#plKeep');if(kp){if(!armConfirm(kp,'Confirmi că toate sumele sunt ale tale?'))return;for(const[g]of GROUPS)data()[g].forEach(x=>x.ex=false);plan.fund.ex=false;save(true);renderPlan();toast('Planul e acum al tău.');return}
      if(t.closest('#plToJar')){const p=calc();App.go('economii','borcane');setTimeout(()=>Savings.prefill({name:'Fond de urgență',target:Math.max(1000,Math.round((p.emergencyMin-data().fund.amount)/100)*100)}),80);return}
      const ue=t.closest('[data-ue]');if(ue){UE.amount=+ue.dataset.ue;UE.label=ue.dataset.uel;renderShock();return}
      const ask=t.closest('[data-ask]');if(ask){App.AI.open({prompt:App.sub==='neprevazute'?'Dacă apare o cheltuială neprevăzută, cum o acopăr cu planul meu și cât timp îmi ia?':'Analizează planul meu lunar: cât pot economisi realist și unde pot ajusta?'});return}
    });
    Store.on(ch=>{if(ch&&!ch.has(KEY))return;load();App.emit('plan');if(!built||App.sec!=='planificator')return;if(v.contains(document.activeElement)&&document.activeElement.matches('input'))return;if(App.sub==='lunar')renderPlan();else if(App.sub==='neprevazute')renderShock()});
    built=true;
  }
  function tour(){
    App.go('planificator','lunar');
    setTimeout(()=>Tour.start([
      {el:'.plan-group[data-group="income"]',text:'Scrie venitul lunar. Poți avea mai multe linii.'},
      {el:'.plan-group[data-group="essentials"]',text:'Cheltuielile esențiale: tot ce plătești oricum în fiecare lună.'},
      {el:'.plan-group[data-group="credits"]',text:'Ratele la credite. Poți importa rata direct din calculatorul de credite.'},
      {el:'#plResult',text:'Aici vezi imediat cât îți rămâne după esențiale și rate și cât poți economisi.'},
      {el:()=>$('#sub-planificator [data-sub="neprevazute"]'),text:'În „Neprevăzute” simulezi o cheltuială mare apărută din senin.'}
    ]),App.sec==='planificator'?120:500);
  }
  function snapshot(){
    const p=data(),c=calc();
    const lines=g=>p[g].map(x=>({nume:x.name,suma_lei:x.amount,exemplu_fictiv:x.ex}));
    return{nota:'sumele sunt introduse de utilizator (sau din exemplul de pornire, unde exemplu_fictiv=true); rezultatele sunt calculate exact',
      introdus:{venituri:lines('income'),cheltuieli_esentiale:lines('essentials'),rate_credite:lines('credits'),alte_cheltuieli:lines('other'),fond_de_urgenta_lei:p.fund.amount},
      calculat:{venit_total:c.income,esentiale_total:c.essentials,rate_total:c.credits,alte_total:c.other,raman_dupa_esentiale_si_rate:c.afterEssentials,poate_economisi_lunar:c.canSave,rata_de_economisire_proc:c.savingsRate==null?null:r2(c.savingsRate*100),rate_din_venit_proc:c.creditShare==null?null:r2(c.creditShare*100),fond_urgenta_reper_3_luni:c.emergencyMin,fond_urgenta_reper_6_luni:c.emergencyMax}};
  }
  return{
    init(){Store.on(ch=>{if(built||!plan)return;if(ch&&!ch.has(KEY))return;load();App.emit('plan')})},
    show(sub){if(!built)build();if(sub==='lunar')renderPlan();else if(sub==='neprevazute')renderShock()},
    data,calc,exampleCount,snapshot,tour,
    hasExamples:()=>exampleCount()>0,
    deleteExamples(){data();for(const[g]of GROUPS)plan[g].forEach(x=>{if(x.ex){x.amount=0;x.ex=false}});if(plan.fund.ex)plan.fund={amount:0,ex:false};save(true);if(built&&App.sec==='planificator')renderPlan()}
  };
})();
App.mods.planificator=Planner;
