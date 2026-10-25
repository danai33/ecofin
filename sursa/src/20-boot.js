/* =====================================================================
   CONT, GLOBAL CONTROLS & BOOT
   ===================================================================== */
const Account=(()=>{
  let built=false,pending=null;
  const ACC_SRC=[['credite','Ofertele de credit'],['contabilitate','Contabilitatea și bugetul'],['plan','Planul lunar'],['economii','Borcanele și provocarea']];
  function render(){
    const el=$('#pane-cont-date');if(!el)return;
    const me=Store.S.me,signed=!!(me&&me.id),stt=Store.S.state;
    const months=Object.keys(Store.S.data).filter(k=>/^\d{4}-\d{2}$/.test(k)&&Store.S.data[k]?.days&&Object.values(Store.S.data[k].days).some(Store.hasDay)).length;
    const jars=(Store.get('borcane')?.jars||[]).length;
    const set=Settings.get();const a={credite:false,contabilitate:false,plan:false,economii:false,...(Store.get('ai-acces')||{})};
    const plEx=Planner.hasExamples();
    el.innerHTML=`<div class="stack-gap" style="max-width:920px">
      <div class="acct-card panel">
        ${signed&&me.avatarUrl?`<img src="${esc(me.avatarUrl)}" alt="">`:`<div class="mono" style="width:84px;height:84px;font-size:30px;border-radius:50%;background:linear-gradient(140deg,#ff8fc8,#8a6cff)">${signed?esc((me.name||'?').trim()[0]||'?'):'?'}</div>`}
        <div style="min-width:0"><div class="eyebrow">${signed?'Conectat':'Fără cont'}</div><h2 class="acct-h"></h2>
          ${Web.on?Web.accountIntro(signed,me||{}):`<p class="muted" style="margin:6px 0 12px;max-width:58ch">${signed?'Bugetele, comparațiile și obiectivele se salvează privat în contul tău Claude. Doar tu le vezi și le regăsești după reîncărcare, pe orice dispozitiv.':'Datele se păstrează în acest browser și rămân după reîncărcare. Deschide EcoFin în Claude, autentificat, ca să le salvezi în cont și să le vezi pe orice dispozitiv.'}</p>`}
          ${syncChip()}</div>
      </div>
      <div class="kpis"><div class="kpi"><div class="kpi-l">Oferte de credit</div><div class="kpi-v num">${Credit.count()}</div></div><div class="kpi"><div class="kpi-l">Luni cu înregistrări</div><div class="kpi-v num">${months}</div></div><div class="kpi"><div class="kpi-l">Borcane</div><div class="kpi-v num">${jars}</div></div><div class="kpi"><div class="kpi-l">Plan lunar</div><div class="kpi-v" style="font-size:18px">${plEx?'cu exemple':'al tău'}</div></div></div>
      <section class="panel pad"><h2 class="h2s">Setări</h2>
        <div class="set-row"><div><b>Oprește animațiile</b><span>Oprește complet mișcarea mâinii, a monedei, a fundalului și a cardurilor. Dacă sistemul tău cere animații reduse, pagina principală folosește singură o variantă blândă: apariții lente și moneda care se rotește încet.</span></div><input type="checkbox" class="switch" id="setCalm"${set.calm?' checked':''} aria-label="Oprește animațiile"></div>
        <div class="set-row"><div><b>Animația de început</b><span>Rulează la fiecare deschidere a paginii: logoul se formează, mâna urcă și moneda se rotește pe deget.</span></div><button class="pill sm" type="button" id="setIntro">Arată-o din nou</button></div>
      </section>
      <section class="panel pad"><h2 class="h2s">Ce poate vedea asistentul AI</h2><p class="muted" style="font-size:14.5px">Asistentul primește doar sursele bifate, numai când îi trimiți o întrebare. Contractele nu se trimit niciodată automat.</p>
        ${ACC_SRC.map(([k,l])=>`<div class="set-row"><div><b>${l}</b></div><input type="checkbox" class="switch" data-acc="${k}"${a[k]?' checked':''} aria-label="Permite asistentului acces la ${l}"></div>`).join('')}</section>
      <section class="panel pad"><h2 class="h2s">Date demonstrative</h2>
        <p class="muted" style="font-size:14.5px">Exemplele sunt marcate cu ${lbl('demo')} și nu sunt date reale.</p>
        <div class="set-row"><div><b>Ofertele exemplu din calculatorul de credite</b><span>Sunt generate aleatoriu la fiecare vizită, nu se salvează și nu se amestecă cu ofertele tale.</span></div></div>
        <div class="set-row"><div><b>Sumele exemplu din planul lunar</b><span>${plEx?`${plural(Planner.exampleCount(),'sumă','sume')} din exemplu.`:'Planul conține doar sumele tale.'}</span></div>${plEx?'<button class="pill sm danger" type="button" id="delPlEx">Golește-le</button>':''}</div>
      </section>
      <section class="panel pad stack-gap"><h2 class="h2s">Copie de siguranță</h2>
        <p class="muted" style="margin:0">Descarcă toate datele într-un fișier JSON sau încarcă o copie salvată anterior. Fișierul conține date financiare personale: păstrează-l în siguranță.</p>
        <div class="row"><button class="pill solid" type="button" id="expBtn">Descarcă o copie</button><button class="pill" type="button" id="impBtn">Încarcă o copie</button><input type="file" id="impFile" accept=".json,application/json" hidden></div>
        <div id="impMsg"></div></section>
      ${Web.on?Web.accountExtra(signed):''}
    </div>`;
    el.querySelector('.acct-h').textContent=signed?(me.name||'Contul tău'):'Folosești EcoFin fără cont';
  }
  function bind(){
    const v=$('#v-cont');
    v.addEventListener('change',async e=>{
      const t=e.target;
      if(t.id==='setCalm'){Settings.set({calm:t.checked});toast(t.checked?'Animațiile sunt oprite.':'Animațiile sunt pornite.');return}
      if(t.dataset.acc){const a={...(Store.get('ai-acces')||{})};a[t.dataset.acc]=t.checked;delete a.borcane;Store.set('ai-acces',a);toast(t.checked?'Acces permis.':'Acces retras.');return}
      if(t.id==='impFile'){const f=t.files[0];t.value='';if(!f)return;
        try{const o=JSON.parse(await f.text());const d=o&&o.date&&typeof o.date==='object'?o.date:null;if(!d)throw 0;const keys=Object.keys(d).filter(Store.isDocKey);if(!keys.length)throw 0;
          pending=Object.fromEntries(keys.map(k=>[k,d[k]]));
          $('#impMsg').innerHTML=`<div class="note"><p style="margin:0 0 10px">Copia conține ${plural(keys.length,'secțiune','secțiuni')} de date. Le înlocuiesc pe cele curente cu aceleași nume?</p><div class="row"><button class="pill sm white" type="button" id="impYes">Da, înlocuiește</button><button class="pill sm" type="button" id="impNo">Renunță</button></div></div>`;
        }catch(err){$('#impMsg').innerHTML='<p class="err">Fișierul nu este o copie EcoFin validă.</p>'}}
    });
    v.addEventListener('click',async e=>{
      const t=e.target;
      if(t.closest('#setIntro')){Hero.resetIntro();App.go('acasa');return}
      const dp=t.closest('#delPlEx');if(dp){if(!armConfirm(dp,'Sigur?'))return;Planner.deleteExamples();toast('Am golit sumele din exemplu.');render();return}
      if(t.closest('#expBtn')){
        const data={};for(const k of Object.keys(Store.S.data))if(Store.isDocKey(k))data[k]=Store.S.data[k];
        const body=JSON.stringify({app:'EcoFin',versiune:2,exportat:new Date().toISOString(),date:data},null,1);
        let dl=null;try{dl=await window.claude?.use?.('downloads')}catch(err){}
        if(!dl){$('#impMsg').innerHTML='<p class="muted" style="margin:0">Descărcarea nu e disponibilă aici. Copiază textul de mai jos și salvează-l într-un fișier .json:</p><textarea class="inp" rows="6" readonly style="margin-top:8px;font-size:12px" aria-label="Copia datelor"></textarea>';$('#impMsg textarea').value=body;$('#impMsg textarea').select();return}
        try{await dl.save({filename:`ecofin-copie-${todayISO()}.json`,data:body});toast('Copia a fost descărcată.')}catch(err){if(err?.code!=='declined')toast('Descărcarea nu a reușit. Încearcă din nou.')}
        return;
      }
      if(t.closest('#impBtn')){$('#impFile').click();return}
      if(t.closest('#impYes')&&pending){for(const[k,val]of Object.entries(pending))Store.set(k,val);pending=null;toast('Datele au fost importate.');setTimeout(()=>location.reload(),700);return}
      if(t.closest('#impNo')){pending=null;$('#impMsg').innerHTML=''}
    });
    App.on('sync',()=>{if(App.sec==='cont')render()});
    built=true;
  }
  return{init(){},show(){if(!built){bind();$('#act-cont').innerHTML=''}render()}};
})();
App.mods.cont=Account;

/* ---------- controls shared by every screen ---------- */
function bindGlobal(){
  document.addEventListener('click',e=>{
    const g=e.target.closest('[data-goto]');
    if(g){e.preventDefault();const[sec,sub]=String(g.dataset.goto).split('-');App.go(sec,sub);return}
    const j=e.target.closest('[data-jump]');
    if(j){const el=document.getElementById(j.dataset.jump);if(el){el.scrollIntoView({block:'start',behavior:calm()?'auto':'smooth'});el.setAttribute('tabindex','-1');el.focus({preventScroll:true})}return}
    const t=e.target.closest('[data-tour]');
    if(t){App.mods[t.dataset.tour]?.tour?.();return}
  });
  Store.on(ch=>{if(!ch||ch.has('setari'))Settings.apply()});
}

/* ---------- boot ---------- */
function boot(){
  Store.load();
  Settings.apply();
  BG.init();
  Router.build();
  Hero.init();
  for(const m of [Credit,Acc,Planner,Savings,Contracts,Game,Account])m.init?.();
  AI.init();
  if(Web.on)Web.bind();
  bindGlobal();
  Router.route();
  Store.init();
  window.__E={App,Store,FinCalc,Credit,Acc,Planner,Savings,Contracts,Game,AI,Hero,Router,Settings};
}
boot();
