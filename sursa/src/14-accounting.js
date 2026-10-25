/* =====================================================================
   CONTABILITATE — calendar of expenses and income, planned vs real budget,
   alerts, analysis. Same logic as the original app, simpler screens.
   ===================================================================== */
const Acc=(()=>{
  const WD_FULL=['Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă','Duminică'];
  const WD_LETTER=['L','M','M','J','V','S','D'];
  const TAB_L={exp:'Cheltuieli',inc:'Venituri',sav:'Economii'};
  const SUGGEST={exp:['Alimente','Transport','Facturi','Chirie','Sănătate','Ieșiri'],inc:['Salariu','Bonus','Vânzare','Cadou']};
  const mqSheet=matchMedia('(max-width: 999px)');
  const S={view:'month',year:now.getFullYear(),month:now.getMonth(),day:null,tab:'exp',cat:null,an:'month',anY:now.getFullYear(),anM:now.getMonth(),bY:now.getFullYear(),bM:now.getMonth(),warn:null};
  const D=()=>Store.S.data;
  const key=(y,m)=>`${y}-${pad(m+1)}`;
  const dim=(y,m)=>new Date(y,m+1,0).getDate();
  const firstWd=(y,m)=>(new Date(y,m,1).getDay()+6)%7;
  const isToday=(y,m,d)=>{const t=new Date();return y===t.getFullYear()&&m===t.getMonth()&&d===t.getDate()};
  const sum=a=>r2((a||[]).reduce((s,x)=>s+(+x.a||0),0));
  const cellAmt=n=>n>=1e5?compact(n):n>=100?fmt(Math.round(n)):fmt(n);
  const dayData=(y,m,d)=>{const dd=D()[key(y,m)]?.days?.[d];return{exp:dd?.exp||[],inc:dd?.inc||[]}};
  let built=false;

  /* ---------- budget categories come from the monthly plan ---------- */
  function cats(){const p=Planner.data();return[...p.essentials.map(x=>({...x,kind:'ess'})),...p.credits.map(x=>({...x,kind:'credit'})),...p.other.map(x=>({...x,kind:'other'}))]}
  const planReal=()=>Planner.exampleCount()===0;
  function catOf(x,list){
    if(x.c){const c=list.find(z=>z.id===x.c);if(c)return c}
    const n=norm(x.t);if(!n)return null;
    if(n.length<3)return list.find(z=>norm(z.name)===n)||null;
    return list.find(z=>norm(z.name)===n)||list.find(z=>{const m=norm(z.name),first=m.split(/[\s/,()]+/)[0];return m.startsWith(n)||(first.length>=3&&n.startsWith(first))})||null;
  }
  function budgetFor(y,m){
    const list=cats(),md=D()[key(y,m)]?.days||{};
    const rows=list.map(c=>({...c,actual:0}));const byId=Object.fromEntries(rows.map(r=>[r.id,r]));
    let unassigned=0,spent=0,inc=0;const un={};
    for(const dd of Object.values(md)){
      for(const x of (dd?.exp||[])){const a=+x.a||0;spent+=a;const c=catOf(x,list);if(c)byId[c.id].actual+=a;else{unassigned+=a;const k=cap(x.t||'Diverse');un[k]=(un[k]||0)+a}}
      for(const x of (dd?.inc||[]))inc+=+x.a||0;
    }
    rows.forEach(r=>{r.actual=r2(r.actual);Object.assign(r,FinCalc.budgetState(r.amount,r.actual))});
    const p=Planner.calc();
    const essReal=r2(rows.filter(r=>r.kind==='ess').reduce((s,r)=>s+r.actual,0)),credReal=r2(rows.filter(r=>r.kind==='credit').reduce((s,r)=>s+r.actual,0));
    return{rows,unassigned:r2(unassigned),un,spent:r2(spent),inc:r2(inc),plan:p,essReal,credReal,planned:r2(p.essentials+p.credits+p.other)};
  }

  /* ---------- money strip: what remains after essentials and loan payments ---------- */
  function stripHTML(y,m){
    const b=budgetFor(y,m),p=b.plan;
    if(!planReal()){
      const n=Planner.exampleCount();
      return `<div class="kpi hi wide"><div class="kpi-l">Rămân după esențiale și rate</div><p style="margin:6px 0 10px">Scrie în Planificator venitul, cheltuielile esențiale și ratele creditelor ca să vezi aici, imediat, câți bani îți rămân. ${n?`Acum planul mai conține ${plural(n,'sumă','sume')} din exemplu.`:''}</p><button class="pill sm white" type="button" data-goto="planificator">Completează planul</button></div>
        <div class="kpi"><div class="kpi-l"><i class="dot d-inc"></i>Venituri în ${MONTHS_L[m]}</div><div class="kpi-v num">${fmt(b.inc)}<small>lei</small></div><div class="kpi-s">${lbl('user','Notate de tine')}</div></div>
        <div class="kpi"><div class="kpi-l"><i class="dot d-exp"></i>Cheltuieli în ${MONTHS_L[m]}</div><div class="kpi-v num">${fmt(b.spent)}<small>lei</small></div><div class="kpi-s">${lbl('user','Notate de tine')}</div></div>`;
    }
    const left=p.afterEssentials;
    const realLeft=r2(b.inc-b.essReal-b.credReal);
    return `<div class="kpi hi${left<0?' bad':''}"><div class="kpi-l">Rămân după esențiale și rate ${lbl('calc')}</div><div class="kpi-v num big">${left<0?'−':''}${fmt(Math.abs(left))}<small>lei pe lună</small></div>
        <div class="kpi-s">${lei0(p.income)} venit − ${lei0(p.essentials)} esențiale − ${lei0(p.credits)} rate, din plan</div></div>
      <div class="kpi"><div class="kpi-l"><i class="dot d-inc"></i>Venituri în ${MONTHS_L[m]}</div><div class="kpi-v num">${fmt(b.inc)}<small>lei</small></div><div class="kpi-s">din ${lei0(p.income)} planificat</div></div>
      <div class="kpi"><div class="kpi-l"><i class="dot d-exp"></i>Rămas real până acum</div><div class="kpi-v num">${realLeft<0?'−':''}${fmt(Math.abs(realLeft))}<small>lei</small></div><div class="kpi-s">încasat − esențiale − rate notate în ${MONTHS_L[m]}</div></div>`;
  }
  function alertHTML(y,m){
    if(!planReal())return '';
    const b=budgetFor(y,m);
    const over=b.rows.filter(r=>r.state==='over'),warn=b.rows.filter(r=>r.state==='warn');
    let h='';
    if(over.length)h+=`<div class="alert" role="alert">${ico('alert')}<p>${over.length===1?`Ai depășit bugetul la <b>${esc(over[0].name)}</b>: ${lei0(over[0].actual)} din ${lei0(over[0].amount)} (+${lei0(over[0].over)}).`:`Ai depășit bugetul la ${over.length} categorii: ${over.map(r=>`<b>${esc(r.name)}</b> (+${lei0(r.over)})`).join(', ')}.`}</p><button class="pill sm" type="button" data-goto="contabilitate-buget">Vezi bugetul</button></div>`;
    else if(warn.length)h+=`<div class="alert warn">${ico('alert')}<p>Aproape de limită: ${warn.map(r=>`<b>${esc(r.name)}</b> (${Math.round(r.ratio*100)}%)`).join(', ')}.</p><button class="pill sm" type="button" data-goto="contabilitate-buget">Vezi bugetul</button></div>`;
    return h;
  }

  /* ---------- calendar: year ---------- */
  function renderYear(){
    $('#yearTitle').textContent=S.year;
    let h='';
    for(let m=0;m<12;m++){
      const md=D()[key(S.year,m)]?.days||{};const n=dim(S.year,m),off=firstWd(S.year,m);
      let cells=WD_LETTER.map(w=>`<span class="mw">${w}</span>`).join('');
      for(let i=0;i<off;i++)cells+='<span></span>';
      let count=0;
      for(let d=1;d<=n;d++){const dd=md[d];let cls='md';if(Store.hasDay(dd)){count++;cls+=' has'+((sum(dd.inc)-sum(dd.exp))<0?' neg':'')}if((off+d-1)%7>4)cls+=' we';if(isToday(S.year,m,d))cls+=' today';cells+=`<span class="${cls}">${d}</span>`}
      const cur=S.year===now.getFullYear()&&m===now.getMonth();
      h+=`<button class="mcard panel${cur?' current':''}" data-m="${m}" type="button" aria-label="${MONTHS[m]} ${S.year}${count?`, ${count} zile cu înregistrări`:''}"><span class="mc-head"><span class="mc-name">${MONTHS[m]}</span><span class="mc-num">${pad(m+1)}</span></span><span class="mc-grid" aria-hidden="true">${cells}</span><span class="mc-foot"><span>${count?`<b>${count}</b> ${count===1?'zi notată':'zile notate'}`:'Nicio înregistrare'}</span>${cur?'<span class="mc-tag">Luna curentă</span>':''}</span></button>`;
    }
    $('#months').innerHTML=h;
  }
  /* ---------- calendar: month ---------- */
  function renderMonthHead(){$('#monthTitle').textContent=`${MONTHS[S.month]} ${S.year}`}
  function renderDays(){
    const y=S.year,m=S.month,n=dim(y,m),off=firstWd(y,m);let h='';
    for(let i=0;i<off;i++)h+='<span class="day-empty" aria-hidden="true"></span>';
    for(let d=1;d<=n;d++){
      const dd=dayData(y,m,d),e=sum(dd.exp),i=sum(dd.inc),net=r2(i-e),has=Store.hasDay(dd);
      let cls='day';if((off+d-1)%7>4)cls+=' we';if(has)cls+=' has';if(S.day===d)cls+=' sel';if(isToday(y,m,d))cls+=' today';
      const aria=`${d} ${MONTHS_L[m]}`+(e?`, cheltuieli ${lei(e)}`:'')+(i?`, venituri ${lei(i)}`:'');
      h+=`<button class="${cls}" data-d="${d}" type="button" aria-label="${aria}" aria-pressed="${S.day===d}"><span class="dn">${pad(d)}</span>${e?`<span class="dl dl-exp">−${cellAmt(e)}</span>`:''}${i?`<span class="dl dl-inc">+${cellAmt(i)}</span>`:''}${has?`<span class="dnet ${net<0?'neg':'pos'}">${net<0?'':'+'}${compact(net)}</span>`:''}</button>`;
    }
    $('#days').innerHTML=h;
  }
  function renderPanel(){
    const p=$('#dayPanel');
    if(S.day===null){p.className='day-panel panel deep empty';p.innerHTML=`<div class="dp-empty"><div class="dp-empty-n">01 – ${pad(dim(S.year,S.month))}</div><p><b>Alege o zi din calendar.</b></p><p class="muted">Acolo adaugi cheltuieli și venituri. Economiile zilei se calculează singure.</p></div>`;updateBackdrop();return}
    p.className='day-panel panel deep';
    const wd=WD_FULL[(new Date(S.year,S.month,S.day).getDay()+6)%7];
    p.innerHTML=`<div class="dp-head"><div><div class="dp-wd">${wd}</div><div class="dp-date">${S.day} ${MONTHS_L[S.month]} ${S.year}</div></div>
        <div class="dp-btns"><button class="icon-btn" id="dpPrev" type="button" aria-label="Ziua anterioară">‹</button><button class="icon-btn" id="dpNext" type="button" aria-label="Ziua următoare">›</button><button class="icon-btn" id="dpClose" type="button" aria-label="Închide ziua">✕</button></div></div>
      <div class="dp-tabs" role="tablist">${['exp','inc','sav'].map(t=>`<button role="tab" type="button" class="tab${S.tab===t?' on':''}" data-tab="${t}" aria-selected="${S.tab===t}"><span class="tab-l"><i class="dot d-${t}"></i>${TAB_L[t]}</span><span class="tab-v" id="tv-${t}"></span></button>`).join('')}</div>
      <div id="dpBody"></div>`;
    renderBody();renderPanelData();updateBackdrop();
  }
  function renderBody(){
    const b=$('#dpBody');if(!b)return;const t=S.tab;
    if(t==='sav'){b.innerHTML='<div class="ledger" id="savBox"></div>';return}
    b.innerHTML=`<form class="entry-pill" id="entryForm" autocomplete="off" novalidate>
        <label class="sr" for="fLabel">Descriere</label><input id="fLabel" type="text" placeholder="${t==='exp'?'ex. market':'ex. salariu'}" maxlength="60" enterkeyhint="next">
        <span class="pill-sep" aria-hidden="true"></span>
        <label class="sr" for="fAmount">Sumă în lei</label><input id="fAmount" type="text" inputmode="decimal" placeholder="0" maxlength="14" enterkeyhint="done" aria-describedby="formErr">
        <span class="pill-cur">lei</span><button class="plus" type="submit" aria-label="Adaugă">+</button>
      </form>
      <p class="err" id="formErr" hidden style="margin-top:8px"></p>
      <div class="chips" id="chips"></div>
      <div id="budgetWarn"></div>
      <ul class="entries" id="entries"></ul>
      <div class="total-row" id="totalRow"></div>`;
  }
  function topLabels(t){
    const c={};
    for(const[k,mo]of Object.entries(D())){if(!/^\d{4}-\d{2}$/.test(k))continue;for(const dd of Object.values(mo?.days||{}))for(const x of (dd?.[t]||[])){const kk=norm(x.t);if(!kk)continue;c[kk]=c[kk]||{l:cap(x.t),n:0};c[kk].n++}}
    const out=Object.values(c).sort((a,b)=>b.n-a.n).map(o=>o.l).slice(0,6);
    for(const s of SUGGEST[t]){if(out.length>=6)break;if(!out.some(l=>norm(l)===norm(s)))out.push(s)}
    return out;
  }
  function chipsHTML(t){
    if(t==='exp'&&planReal()){
      const b=budgetFor(S.year,S.month);
      return `<span class="chips-l">Categorie:</span>`+b.rows.map(r=>`<button type="button" class="chip${S.cat===r.id?' on':''}" data-cat="${r.id}" aria-pressed="${S.cat===r.id}">${esc(r.name)}${r.amount>0?` <small>${r.state==='over'?'depășit':'mai ai '+compact(r.left)}</small>`:''}</button>`).join('');
    }
    if(t==='inc'&&planReal()){const inc=Planner.data().income;if(inc.length)return `<span class="chips-l">Rapid:</span>`+inc.map(r=>`<button type="button" class="chip" data-label="${esc(r.name)}">${esc(r.name)}</button>`).join('')}
    return `<span class="chips-l">Rapid:</span>`+topLabels(t).map(l=>`<button type="button" class="chip" data-label="${esc(l)}">${esc(l)}</button>`).join('');
  }
  function renderPanelData(){
    if(S.day===null)return;
    const dd=dayData(S.year,S.month,S.day),e=sum(dd.exp),i=sum(dd.inc),s=r2(i-e);
    const tv=(id,v)=>{const el=$('#tv-'+id);if(el)el.textContent=v};
    tv('exp',lei(e));tv('inc',lei(i));tv('sav',signed(s));
    const t=S.tab;
    if(t==='exp'||t==='inc'){
      const arr=dd[t],ul=$('#entries');if(!ul)return;const list=cats();
      ul.innerHTML=arr.length?arr.map(x=>{const c=t==='exp'&&planReal()?catOf(x,list):null;return `<li><span class="e-l">${esc(x.t)}${c&&norm(c.name)!==norm(x.t)?` <span class="e-cat">${esc(c.name)}</span>`:''}</span><span class="e-dots" aria-hidden="true"></span><span class="e-a">${lei(x.a)}</span><button class="del" type="button" data-id="${esc(x.id)}" aria-label="Șterge ${esc(x.t)}">✕</button></li>`}).join('')
        :`<li class="e-empty">${t==='exp'?'Nicio cheltuială în această zi.':'Niciun venit în această zi.'}</li>`;
      $('#totalRow').innerHTML=`<span>Total ${t==='exp'?'cheltuieli':'venituri'}</span><b class="dbl">${lei(t==='exp'?e:i)}</b>`;
      $('#chips').innerHTML=chipsHTML(t);
      $('#budgetWarn').innerHTML=S.warn?`<div class="alert${S.warn.state==='over'?'':' warn'} budget-warn" role="alert">${ico('alert')}<p>${S.warn.text}</p></div>`:'';
    }
    if(t==='sav'){
      let mtd=0;for(let d=1;d<=S.day;d++){const x=dayData(S.year,S.month,d);mtd+=sum(x.inc)-sum(x.exp)}mtd=r2(mtd);
      const box=$('#savBox');if(!box)return;
      box.innerHTML=`<div class="lg-row"><span>Venituri</span><span class="lg-a">${lei(i)}</span></div><div class="lg-row"><span>Cheltuieli</span><span class="lg-a">− ${lei(e)}</span></div><div class="lg-rule"></div>
        <div class="lg-row lg-res ${s<0?'neg':'pos'}"><span>${s<0?'Deficit în această zi':'Economii în această zi'}</span><span class="lg-a dbl">${signed(s)}</span></div>
        <p class="lg-note">${(e||i)?'':'Încă nu ai notat nimic în această zi. '}Sold de la 1 până la ${S.day} ${MONTHS_L[S.month]}: <b>${signed(mtd)}</b></p>`;
    }
  }
  function updateBackdrop(){$('#backdrop').hidden=!(App.sec==='contabilitate'&&App.sub==='calendar'&&mqSheet.matches&&S.view==='month'&&S.day!==null)}
  function renderStrip(){
    const y=S.view==='month'?S.year:now.getFullYear(),m=S.view==='month'?S.month:now.getMonth();
    $('#accStrip').innerHTML=stripHTML(y,m);$('#accAlert').innerHTML=alertHTML(y,m);
  }
  function showView(v){S.view=v;$('#yearView').hidden=v!=='year';$('#monthView').hidden=v!=='month';renderStrip()}
  function openMonth(m,fromEl){
    const from=fromEl?fromEl.getBoundingClientRect():null;
    S.month=m;S.day=null;S.warn=null;showView('month');renderMonthHead();renderDays();renderPanel();
    if(from&&!calm()){const card=$('#mvCard'),to=card.getBoundingClientRect();card.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`},{transform:'none'}],{duration:480,easing:'cubic-bezier(.2,.75,.15,1)'})}
  }
  function closeMonth(){S.day=null;updateBackdrop();showView('year');renderYear();const card=$(`.mcard[data-m="${S.month}"]`);card?.scrollIntoView({block:'nearest'});card?.focus({preventScroll:true})}
  function stepMonth(delta){
    let m=S.month+delta,y=S.year;if(m<0){m=11;y--}if(m>11){m=0;y++}
    S.year=y;S.month=m;S.day=null;S.warn=null;renderMonthHead();renderDays();renderPanel();renderStrip();
    if(!calm())$('#days').animate([{transform:`translateX(${delta*20}px)`},{transform:'none'}],{duration:280,easing:'ease-out'});
  }
  function selectDay(d){S.day=d;S.warn=null;renderDays();renderPanel();if(mqSheet.matches)$('#dpClose')?.focus({preventScroll:true})}
  function stepDay(delta){
    let d=S.day+delta,m=S.month,y=S.year;
    if(d<1){m--;if(m<0){m=11;y--}d=dim(y,m)}else if(d>dim(y,m)){m++;if(m>11){m=0;y++}d=1}
    const changed=m!==S.month||y!==S.year;S.year=y;S.month=m;S.day=d;S.warn=null;
    if(changed){renderMonthHead();renderStrip()}renderDays();renderPanel();
  }
  function closeDay(){const d=S.day;S.day=null;renderDays();renderPanel();$(`.day[data-d="${d}"]`)?.focus({preventScroll:true})}
  function setTab(t){S.tab=t;S.warn=null;$$('#dayPanel .tab').forEach(b=>{const on=b.dataset.tab===t;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});renderBody();renderPanelData();if(t!=='sav')$('#fLabel')?.focus({preventScroll:true})}

  /* ---------- edits ---------- */
  function mutateDay(fn){
    const k=key(S.year,S.month);
    const month=clone(D()[k])||{days:{}};month.days=month.days||{};
    const d=String(S.day);
    const dd=month.days[d]?{exp:[...(month.days[d].exp||[])],inc:[...(month.days[d].inc||[])]}:{exp:[],inc:[]};
    fn(dd);
    if(!dd.exp.length&&!dd.inc.length)delete month.days[d];else month.days[d]=dd;
    Store.set(k,month);renderDays();renderPanelData();renderStrip();
  }
  function onSubmit(ev){
    ev.preventDefault();
    const t=S.tab;if(t!=='exp'&&t!=='inc')return;
    const L=$('#fLabel'),A=$('#fAmount'),err=$('#formErr');
    let label=L.value.trim(),raw=A.value.trim();
    if(!raw){const mm=label.match(/^(.*?)[\s:=-]*(\d[\d\s.,]*)\s*(lei|mdl)?\.?$/i);if(mm){label=mm[1].trim();raw=mm[2]}else if(label){err.textContent='Scrie și suma, de exemplu 120.';err.hidden=false;A.setAttribute('aria-invalid','true');A.focus();return}}
    const a=parseAmount(raw);
    if(!(a>0)){err.textContent='Scrie o sumă mai mare ca 0, de exemplu 100.';err.hidden=false;A.setAttribute('aria-invalid','true');A.focus();return}
    if(a>1e8){err.textContent='Suma pare prea mare. Verifică cifrele.';err.hidden=false;A.focus();return}
    err.hidden=true;A.removeAttribute('aria-invalid');
    const list=cats();const chosen=t==='exp'&&S.cat?list.find(c=>c.id===S.cat):null;
    label=cap(label||(chosen?chosen.name:(t==='exp'?'Diverse':'Venit'))).slice(0,60);
    const entry={id:rid(),t:label,a};if(chosen)entry.c=chosen.id;
    let before=null;const target=t==='exp'&&planReal()?(chosen||catOf(entry,list)):null;
    if(target)before=budgetFor(S.year,S.month).rows.find(r=>r.id===target.id);
    mutateDay(dd=>{dd[t].push(entry)});
    S.warn=null;
    if(target&&before&&before.amount>0){
      const after=budgetFor(S.year,S.month).rows.find(r=>r.id===target.id);
      if(after.state==='over'&&before.state!=='over'){S.warn={state:'over',text:`Ai depășit bugetul pentru <b>${esc(after.name)}</b>: ${lei0(after.actual)} din ${lei0(after.amount)} planificat (+${lei0(after.over)}).`};toast(`Ai depășit bugetul pentru ${after.name} cu ${lei0(after.over)}.`,{ms:5000})}
      else if(after.state==='over'){S.warn={state:'over',text:`Bugetul pentru <b>${esc(after.name)}</b> e deja depășit: ${lei0(after.actual)} din ${lei0(after.amount)}.`}}
      else if(after.state==='warn'&&before.state==='ok'){S.warn={state:'warn',text:`Ai folosit ${Math.round(after.ratio*100)}% din bugetul pentru <b>${esc(after.name)}</b>. Mai ai ${lei0(after.left)}.`};toast(`Atenție: ${Math.round(after.ratio*100)}% din bugetul pentru ${after.name}.`,{ms:4500})}
      renderPanelData();
    }
    L.value='';A.value='';L.focus({preventScroll:true});
  }
  function onDelete(btn){
    if(!armConfirm(btn,'Șterge?'))return;
    const id=btn.dataset.id,t=S.tab;let removed=null,idx=-1;
    const y=S.year,m=S.month,d=S.day;
    mutateDay(dd=>{idx=dd[t].findIndex(x=>x.id===id);if(idx>=0)removed=dd[t].splice(idx,1)[0]});
    if(removed)toast(`Am șters „${removed.t}”.`,{action:'Anulează',onAction:()=>{const k=key(y,m);const month=clone(D()[k])||{days:{}};month.days=month.days||{};const dd=month.days[d]||{exp:[],inc:[]};dd[t]=dd[t]||[];dd[t].splice(Math.min(idx,dd[t].length),0,removed);month.days[d]=dd;Store.set(k,month);refresh()}});
  }

  /* ---------- statistics ---------- */
  function addCat(map,label,a){const k=norm(label)||'diverse';if(!map[k])map[k]={label:cap(label||'Diverse'),sum:0,n:0};map[k].sum=r2(map[k].sum+(+a||0));map[k].n++}
  function monthStats(y,m){
    const md=D()[key(y,m)]?.days||{},n=dim(y,m),list=planReal()?cats():[];
    const daily=[],catsMap={};let inc=0,exp=0,biggest=null,topDay=null,daysWith=0,expDays=0;
    for(let d=1;d<=n;d++){
      const dd=md[d],e=dd?sum(dd.exp):0,i=dd?sum(dd.inc):0;
      daily.push({d,e,i});inc+=i;exp+=e;if(Store.hasDay(dd))daysWith++;if(e>0)expDays++;
      for(const x of (dd?.exp||[])){const c=list.length?catOf(x,list):null;addCat(catsMap,c?c.name:x.t,x.a);if(!biggest||x.a>biggest.a)biggest={t:x.t,a:x.a,d,m}}
      if(e>0&&(!topDay||e>topDay.e))topDay={d,e};
    }
    inc=r2(inc);exp=r2(exp);
    return{inc,exp,sav:r2(inc-exp),daily,cats:catsMap,biggest,topDay,daysWith,expDays,n};
  }
  function yearStats(y){
    const months=[],catsMap={};let inc=0,exp=0,biggest=null,daysWith=0;
    for(let m=0;m<12;m++){const s=monthStats(y,m);months.push(s);inc+=s.inc;exp+=s.exp;daysWith+=s.daysWith;for(const c of Object.values(s.cats)){const k=norm(c.label);if(!catsMap[k])catsMap[k]={label:c.label,sum:0,n:0};catsMap[k].sum=r2(catsMap[k].sum+c.sum);catsMap[k].n+=c.n}if(s.biggest&&(!biggest||s.biggest.a>biggest.a))biggest=s.biggest}
    inc=r2(inc);exp=r2(exp);
    return{inc,exp,sav:r2(inc-exp),months,cats:catsMap,biggest,daysWith};
  }

  /* ---------- budget pane ---------- */
  function renderBudget(){
    const host=$('#pane-contabilitate-buget');const y=S.bY,m=S.bM;
    const head=`<div class="mv-bar"><div class="mv-nav"><button class="icon-btn" type="button" data-bstep="-1" aria-label="Luna anterioară">‹</button><h2 class="mv-title">${MONTHS[m]} ${y}</h2><button class="icon-btn" type="button" data-bstep="1" aria-label="Luna următoare">›</button></div><div class="row"><button class="pill sm" type="button" data-goto="planificator">Editează bugetul</button><button class="pill sm" type="button" data-ask="buget">${ico('ai',16)}Unde se duc banii?</button></div></div>`;
    if(!planReal()){
      host.innerHTML=head+`<div class="panel empty"><span class="ico-big">${ico('plan',34)}</span><h2>Bugetul vine din planul lunar</h2><p>Pune în Planificator venitul și cât vrei să cheltui pe fiecare categorie. Aici vei vedea apoi planificat față de real, cu alertă când depășești o limită.${Planner.exampleCount()?` Acum planul mai conține ${plural(Planner.exampleCount(),'sumă','sume')} din exemplu.`:''}</p><button class="pill solid" type="button" data-goto="planificator">Completează planul</button></div>`;return;
    }
    const b=budgetFor(y,m);
    const row=r=>{const w=r.amount>0?clamp(r.actual/r.amount,0,1)*100:(r.actual>0?100:0);
      const status=r.amount>0?(r.state==='over'?`<small>+${lei0(r.over)} peste buget</small>`:`<small>mai ai ${lei0(r.left)}</small>`):(r.actual>0?'<small>fără limită</small>':'<small>fără limită</small>');
      return `<div class="bud-row ${r.state}"><div class="nm">${esc(r.name)}${r.kind==='ess'?'<span class="tag-ess">esențial</span>':''}${r.ex?lbl('demo'):''}</div><div class="bud-bar" role="img" aria-label="${esc(r.name)}: ${lei0(r.actual)} din ${lei0(r.amount)}"><i style="width:${w.toFixed(1)}%"></i></div><div class="v num">${lei0(r.actual)} <span class="muted">/ ${lei0(r.amount)}</span>${status}</div></div>`};
    const grp=(kind,title)=>{const rs=b.rows.filter(r=>r.kind===kind);if(!rs.length)return '';const pl=r2(rs.reduce((s,r)=>s+r.amount,0)),ac=r2(rs.reduce((s,r)=>s+r.actual,0));return `<section class="bud-group"><div class="sec-head"><h3>${title}</h3><span class="muted num">${lei0(ac)} din ${lei0(pl)}</span></div>${rs.map(row).join('')}</section>`};
    const unk=Object.entries(b.un).sort((a,c)=>c[1]-a[1]).slice(0,6);
    host.innerHTML=head+`<div class="money-strip">${stripHTML(y,m)}</div>${alertHTML(y,m).replace(/<button[^>]*data-goto="contabilitate-buget"[^>]*>.*?<\/button>/,'')}
      <div class="panel pad stack-gap">
        <div class="row" style="justify-content:space-between"><div class="row">${lbl('user','Plan: din Planificator')}${lbl('user','Real: notat în calendar')}${lbl('calc','Diferențe')}</div><span class="muted num">Total: ${lei0(b.spent)} cheltuit din ${lei0(b.planned)} planificat</span></div>
        ${grp('ess','Cheltuieli esențiale')}${grp('credit','Rate la credite')}${grp('other','Alte cheltuieli')}
        ${b.unassigned>0?`<section class="bud-group"><div class="sec-head"><h3>Fără categorie</h3><span class="muted num">${lei0(b.unassigned)}</span></div><p class="muted" style="font-size:14px;margin:0 0 6px">Cheltuieli care nu se potrivesc cu nicio categorie din plan: ${unk.map(([l,v])=>`${esc(l)} ${lei0(v)}`).join(', ')}. Alege o categorie când adaugi cheltuiala, ca să intre în buget.</p></section>`:''}
      </div>`;
  }

  /* ---------- analysis pane ---------- */
  const kpiVal=n=>`${n<0?'−':''}${fmt(Math.abs(n))}<small>lei</small>`;
  const kpi=(t,l,n)=>`<div class="kpi"><div class="kpi-l"><i class="dot d-${t}"></i>${l}</div><div class="kpi-v num">${kpiVal(n)}</div></div>`;
  function donut(st){
    const e=st.exp,s=Math.max(0,st.sav),tot=e+s,R=64,SW=18,C=2*Math.PI*R;let arcs='';
    if(tot>0){const segs=[['exp',e],['sav',s]].filter(x=>x[1]>0),gap=segs.length>1?3:0;let off=0;for(const[t,v]of segs){const len=v/tot*C;arcs+=`<circle cx="82" cy="82" r="${R}" fill="none" stroke="var(--${t})" stroke-width="${SW}" stroke-dasharray="${Math.max(0.01,len-gap)} ${C}" stroke-dashoffset="${-(off+gap/2)}" transform="rotate(-90 82 82)"/>`;off+=len}}
    let big,small,aria;
    if(st.inc>0&&st.sav>=0){const p=Math.round(st.sav/st.inc*100);big=p+'%';small='economisit';aria=`Din venituri ai cheltuit ${100-p}% și ai economisit ${p}%`}
    else if(st.sav<0){big='Deficit';small=compact(st.sav)+' lei';aria=`Ai cheltuit cu ${lei(-st.sav)} mai mult decât ai câștigat`}
    else{big='—';small='fără venituri';aria='Nu există venituri notate'}
    return`<div class="donut" role="img" aria-label="${esc(aria)}"><svg viewBox="0 0 164 164" width="164" height="164" aria-hidden="true"><circle cx="82" cy="82" r="${R}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="${SW}"/>${arcs}</svg><div class="donut-c"><b>${big}</b><span>${small}</span></div></div>`;
  }
  function totalsBars(st){const max=Math.max(st.inc,st.exp,Math.abs(st.sav))||1;const row=(t,l,v,neg)=>`<div class="tb-row"><div class="tb-l"><i class="dot d-${neg?'exp':t}"></i>${l}</div><div class="tb-track"><div class="tb-bar b-${t}${neg?' neg':''}" style="width:${Math.max(0.5,v/max*100)}%"></div></div><div class="tb-v">${neg?'−':''}${lei(v)}</div></div>`;return`<div class="tb">${row('inc','Venituri',st.inc)}${row('exp','Cheltuieli',st.exp)}${row('sav',st.sav<0?'Deficit':'Economii',Math.abs(st.sav),st.sav<0)}</div>`}
  function catBars(st){
    const arr=Object.values(st.cats).sort((a,b)=>b.sum-a.sum);if(!arr.length)return'<p class="muted">Nicio cheltuială notată.</p>';
    const top=arr.slice(0,7),rest=arr.slice(7);if(rest.length)top.push({label:`Altele (${rest.length})`,sum:r2(rest.reduce((s,x)=>s+x.sum,0))});
    const max=Math.max(...top.map(x=>x.sum))||1,tot=st.exp||1;const essN=new Set(Planner.data().essentials.map(x=>norm(x.name)));
    return`<div class="cb">${top.map(x=>`<div class="cb-row"><div class="cb-l">${esc(x.label)}</div><div class="cb-track"><div class="cb-bar${essN.has(norm(x.label))?' ess':''}" style="width:${Math.max(0.5,x.sum/max*100)}%"></div></div><div class="cb-v">${lei(x.sum)}<span>${Math.round(x.sum/tot*100)}%</span></div></div>`).join('')}</div>`;
  }
  function whereSentence(st){
    const arr=Object.values(st.cats).sort((a,b)=>b.sum-a.sum);if(!arr.length||!st.exp)return '';
    const top=arr.slice(0,3),share=Math.round(top.reduce((s,x)=>s+x.sum,0)/st.exp*100);
    if(arr.length===1)return `<p class="where">${lbl('calc')} Toate cheltuielile notate (${lei0(st.exp)}) au fost la <b>${esc(arr[0].label)}</b>.</p>`;
    return `<p class="where">${lbl('calc')} Cei mai mulți bani s-au dus pe ${top.map(x=>`<b>${esc(x.label)}</b> (${Math.round(x.sum/st.exp*100)}%)`).join(top.length>2?', ':' și ').replace(/, ([^,]*)$/,' și $1')}: împreună ${share}% din cheltuieli.</p>`;
  }
  function highlights(st,m){
    const items=[];
    if(st.biggest)items.push(['Cea mai mare cheltuială',`${esc(st.biggest.t)} · ${lei(st.biggest.a)}`,`${st.biggest.d} ${MONTHS_L[m]}`]);
    if(st.topDay)items.push(['Ziua cu cele mai multe cheltuieli',`${st.topDay.d} ${MONTHS_L[m]}`,lei(st.topDay.e)]);
    if(st.expDays)items.push(['Medie pe zi cu cheltuieli',lei(r2(st.exp/st.expDays)),`din ${st.expDays} ${st.expDays===1?'zi':'zile'}`]);
    items.push(['Zile notate',`${st.daysWith} din ${st.n}`,'zile cu cheltuieli sau venituri']);
    return`<section class="sec"><h3>Repere</h3><dl class="hl">${items.map(([a,b,c])=>`<div><dt>${a}</dt><dd>${b}<small>${c}</small></dd></div>`).join('')}</dl></section>`;
  }
  function yearTable(st,y){
    const cell=(v,neg,force)=>(v||force)?`<td class="${neg&&v<0?'neg':''}">${neg&&v<0?'−':''}${fmt(Math.abs(v))}</td>`:'<td class="none">—</td>';
    const rows=st.months.map((s,m)=>`<tr><td><button class="link" type="button" data-open-month="${m}">${MONTHS[m]}</button></td>${cell(s.inc)}${cell(s.exp)}${(s.inc||s.exp)?cell(s.sav,true,true):'<td class="none">—</td>'}</tr>`).join('');
    return`<section class="sec"><h3>Tabel lunar (lei)</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Luna</th><th>Venituri</th><th>Cheltuieli</th><th>Economii</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th>Total ${y}</th><th>${fmt(st.inc)}</th><th>${fmt(st.exp)}</th><th>${st.sav<0?'−':''}${fmt(Math.abs(st.sav))}</th></tr></tfoot></table></div></section>`;
  }
  function renderAnalysis(){
    const host=$('#pane-contabilitate-analiza');const isY=S.an==='year',y=S.anY,m=S.anM;
    const st=isY?yearStats(y):monthStats(y,m);
    const head=`<div class="mv-bar"><div class="seg" role="group" aria-label="Perioada analizei"><button type="button" data-an="month" class="${isY?'':'on'}" aria-pressed="${!isY}">Lunar</button><button type="button" data-an="year" class="${isY?'on':''}" aria-pressed="${isY}">Anual</button></div><div class="mv-nav"><button class="icon-btn" type="button" data-astep="-1" aria-label="Perioada anterioară">‹</button><h2 class="mv-title">${isY?y:`${MONTHS[m]} ${y}`}</h2><button class="icon-btn" type="button" data-astep="1" aria-label="Perioada următoare">›</button></div><button class="pill sm" type="button" data-ask="buget">${ico('ai',16)}Întreabă asistentul</button></div>`;
    if(!st.inc&&!st.exp){host.innerHTML=head+`<div class="panel empty"><span class="ico-big">${ico('trend',34)}</span><h2>Nimic de analizat încă</h2><p>Nu ai înregistrări ${isY?'în '+y:'în '+MONTHS_L[m]+' '+y}. Adaugă cheltuieli și venituri în calendar, apoi revino aici.</p><button class="pill solid" type="button" data-goto="contabilitate">Deschide calendarul</button></div>`;return}
    const rate=st.inc>0?Math.round(st.sav/st.inc*100):null;
    host.innerHTML=head+`<div class="panel pad">
      ${whereSentence(st)}
      <div class="kpis">${kpi('inc','Venituri',st.inc)}${kpi('exp','Cheltuieli',st.exp)}${kpi(st.sav<0?'exp':'sav',st.sav<0?'Deficit':'Economii',st.sav)}<div class="kpi"><div class="kpi-l">Rata de economisire</div><div class="kpi-v">${rate===null?'—':rate+'%'}</div><div class="kpi-s">${rate===null?'fără venituri notate':'din venituri'}</div></div></div>
      <section class="sec"><h3>Cât am cheltuit și cât am economisit</h3><div class="split">${donut(st)}${totalsBars(st)}</div></section>
      <section class="sec"><div class="sec-head"><h3>${isY?'Pe luni: cheltuit și economisit':'Cheltuieli pe zile'}</h3>${isY?'<div class="legend"><span><i class="dot d-exp"></i>Cheltuieli</span><span><i class="dot d-sav"></i>Economii</span></div>':''}</div><div class="chart" id="anChart"></div></section>
      <section class="sec"><h3>Pe ce s-au dus banii</h3>${catBars(st)}${planReal()?'<p class="muted" style="font-size:13px;margin-top:8px">Categoriile vin din planul lunar; barele albastre sunt cheltuieli esențiale.</p>':''}</section>
      ${isY?yearTable(st,y):highlights(st,m)}</div>`;
    drawChart(st);
  }
  function drawChart(st){
    const el=$('#anChart');if(!el)return;const isY=S.an==='year',y=S.anY,m=S.anM;
    if(isY){st=st||yearStats(y);Charts.columns(el,{height:230,aria:`Cheltuieli și economii pe fiecare lună din ${y}`,
      cats:st.months.map((s,i)=>({tip:Charts.tipHTML(`${MONTHS[i]} ${y}`,[['var(--inc)','Venituri',s.inc],['var(--exp)','Cheltuieli',s.exp],[s.sav<0?'var(--exp)':'var(--sav)',s.sav<0?'Deficit':'Economii',s.sav]])})),
      series:[{color:'var(--exp)',values:st.months.map(s=>s.exp)},{color:'var(--sav)',values:st.months.map(s=>s.sav)}],labelOf:(i,band)=>band<26?(i%2===0?MONTHS_S[i]:''):MONTHS_S[i]})}
    else{st=st||monthStats(y,m);Charts.columns(el,{height:210,aria:`Cheltuieli pe fiecare zi din ${MONTHS_L[m]} ${y}`,
      cats:st.daily.map(x=>({tip:Charts.tipHTML(`${x.d} ${MONTHS_L[m]}`,[['var(--exp)','Cheltuieli',x.e],['var(--inc)','Venituri',x.i]])})),
      series:[{color:'var(--exp)',values:st.daily.map(x=>x.e)}],labelOf:(i,band)=>{const d=i+1;return band>=22||d===1||d%5===0?String(d):''}})}
  }

  /* ---------- guide ---------- */
  function guideHTML(){
    return `<div class="guide"><article class="panel">
      <h2 id="g-ac-1">Cum notezi o cheltuială</h2>
      <ol><li>În <b>Calendar</b> deschide luna și apasă pe zi.</li><li>Alege <b>Cheltuieli</b> sau <b>Venituri</b>, scrie descrierea și suma, apoi apasă <b>+</b>. Poți scrie și totul într-un rând, de exemplu „market 230”.</li><li>Alege o <b>categorie</b> din plan, ca cheltuiala să intre în buget. Dacă descrierea are același nume ca o categorie, o recunosc singur.</li></ol>
      <h2 id="g-ac-2">Buget planificat față de real</h2>
      <p>Bugetul folosește planul lunar din <b>Planificator</b>: venitul, cheltuielile esențiale, ratele creditelor și celelalte cheltuieli. În fila <b>Buget</b> vezi pentru fiecare categorie cât ai planificat și cât ai cheltuit de fapt în luna aleasă.</p>
      <ul><li><b>Verde</b>: ai folosit sub 80% din limită.</li><li><b>Galben</b>: ai ajuns la 80% sau mai mult.</li><li><b>Roșu</b>: ai depășit limita. Primești o alertă chiar când adaugi cheltuiala.</li></ul>
      <h2 id="g-ac-3">Cât îți rămâne după esențiale și rate</h2>
      <div class="formula">rămân = venit − cheltuieli esențiale − ratele creditelor</div>
      <p>Cifra din plan îți arată cât rămâne pe lună pentru restul cheltuielilor și economii. „Rămas real până acum” face aceeași socoteală cu ce ai notat în calendar în luna respectivă.</p>
      <h2 id="g-ac-4">Analiza</h2>
      <p>Fila <b>Analiză</b> arată, pe lună sau pe an, veniturile, cheltuielile, economiile și pe ce s-au dus banii. Toate cifrele sunt calculate din ce ai notat tu.</p>
      <h2 id="g-ac-5">Unde se salvează</h2>
      <p>Când EcoFin e deschis în Claude și ești autentificat, datele se salvează privat în contul tău. Altfel rămân doar în acest browser. Starea se vede în pagina <b>Cont</b>.</p>
    </article>
    <aside class="panel"><h3>În acest ghid</h3><nav class="toc">${[['g-ac-1','Cum notezi o cheltuială'],['g-ac-2','Buget planificat și real'],['g-ac-3','Cât îți rămâne'],['g-ac-4','Analiza'],['g-ac-5','Unde se salvează']].map(([id,l])=>`<button type="button" data-jump="${id}">${l}</button>`).join('')}</nav><button class="pill solid" type="button" data-tour="contabilitate">Arată-mi pe pagină</button></aside></div>`;
  }

  /* ---------- build & events ---------- */
  function build(){
    $('#pane-contabilitate-calendar').innerHTML=`<div class="money-strip" id="accStrip"></div><div id="accAlert"></div>
      <section id="yearView" hidden><div class="acc-top"><div class="yearnav"><button class="icon-btn" id="prevYear" type="button" aria-label="Anul anterior">‹</button><h2 class="year" id="yearTitle"></h2><button class="icon-btn" id="nextYear" type="button" aria-label="Anul următor">›</button></div><p class="muted" style="max-width:46ch">Alege o lună. Punctul verde arată o zi pe plus, cel portocaliu o zi pe minus.</p></div><div class="months" id="months"></div></section>
      <section id="monthView"><div class="mv-bar"><button class="ghost" id="backBtn" type="button">← Toate lunile</button><div class="mv-nav"><button class="icon-btn" id="prevMonth" type="button" aria-label="Luna anterioară">‹</button><h2 class="mv-title" id="monthTitle"></h2><button class="icon-btn" id="nextMonth" type="button" aria-label="Luna următoare">›</button></div>${syncChip()}</div>
        <div class="mv-layout"><div class="mv-card panel" id="mvCard"><div class="wk" aria-hidden="true">${WD_FULL.map((w,i)=>`<span><b class="l">${w}</b><b class="s">${WD_LETTER[i]}</b></span>`).join('')}</div><div class="days" id="days"></div></div><aside class="day-panel panel deep empty" id="dayPanel" aria-label="Ziua selectată"></aside></div></section>`;
    $('#pane-contabilitate-ghid').innerHTML=guideHTML();
    $('#act-contabilitate').innerHTML=`<button class="pill" type="button" data-ask="buget">${ico('ai',18)}Întreabă asistentul</button>`;
    const v=$('#v-contabilitate');
    v.addEventListener('click',e=>{
      const t=e.target;
      const mc=t.closest('.mcard');if(mc){openMonth(+mc.dataset.m,mc);return}
      const day=t.closest('.day');if(day){selectDay(+day.dataset.d);return}
      const tab=t.closest('.tab');if(tab){setTab(tab.dataset.tab);return}
      const cc=t.closest('[data-cat]');if(cc){S.cat=S.cat===cc.dataset.cat?null:cc.dataset.cat;$('#chips').innerHTML=chipsHTML('exp');const L=$('#fLabel');(L&&L.value?$('#fAmount'):L)?.focus();return}
      const chip=t.closest('[data-label]');if(chip){const L=$('#fLabel');if(L){L.value=chip.dataset.label;$('#fAmount').focus()}return}
      const del=t.closest('.del');if(del){onDelete(del);return}
      const ask=t.closest('[data-ask]');if(ask){App.AI.open({prompt:App.sub==='analiza'?'Unde s-au dus banii în perioada pe care o analizez și unde aș putea economisi?':'Unde se duc banii mei luna aceasta și ce categorii depășesc bugetul?'});return}
      const bs=t.closest('[data-bstep]');if(bs){let m=S.bM+ +bs.dataset.bstep,y=S.bY;if(m<0){m=11;y--}if(m>11){m=0;y++}S.bM=m;S.bY=y;renderBudget();return}
      const an=t.closest('[data-an]');if(an){S.an=an.dataset.an;renderAnalysis();return}
      const as=t.closest('[data-astep]');if(as){const d=+as.dataset.astep;if(S.an==='year')S.anY+=d;else{let m=S.anM+d,y=S.anY;if(m<0){m=11;y--}if(m>11){m=0;y++}S.anM=m;S.anY=y}renderAnalysis();return}
      const om=t.closest('[data-open-month]');if(om){S.year=S.anY;S.month=+om.dataset.openMonth;S.day=null;App.go('contabilitate','calendar');showView('month');renderMonthHead();renderDays();renderPanel();return}
      switch(t.closest('button')?.id){
        case 'backBtn':closeMonth();break;case 'prevMonth':stepMonth(-1);break;case 'nextMonth':stepMonth(1);break;
        case 'prevYear':S.year--;renderYear();break;case 'nextYear':S.year++;renderYear();break;
        case 'dpClose':closeDay();break;case 'dpPrev':stepDay(-1);break;case 'dpNext':stepDay(1);break;
      }
    });
    $('#backdrop').addEventListener('click',()=>{if(App.sec==='contabilitate')closeDay()});
    v.addEventListener('submit',e=>{if(e.target.id==='entryForm')onSubmit(e)});
    v.addEventListener('input',e=>{if(e.target.id==='fAmount'||e.target.id==='fLabel'){const er=$('#formErr');if(er&&!er.hidden){er.hidden=true;$('#fAmount')?.removeAttribute('aria-invalid')}}});
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||App.sec!=='contabilitate'||Tour.active()||!$('#ai').hidden||Modal.isOpen())return;
      if(App.sub==='calendar'){if(S.day!==null){closeDay();return}if(S.view==='month')closeMonth()}
    });
    mqSheet.addEventListener?.('change',updateBackdrop);
    let rz=null;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(App.sec==='contabilitate'&&App.sub==='analiza')drawChart()},150)});
    Store.on(()=>{if(built&&App.sec==='contabilitate')refresh()});
    App.on('plan',()=>{if(built&&App.sec==='contabilitate')refresh()});
    built=true;
  }
  function refresh(){
    const sub=App.sub;
    if(sub==='calendar'){renderStrip();if(S.view==='year')renderYear();else{renderDays();if(!$('#dayPanel').contains(document.activeElement)||!document.activeElement.matches('input'))renderPanelData()}}
    else if(sub==='buget')renderBudget();
    else if(sub==='analiza')renderAnalysis();
  }
  let firstShow=true;
  function show(sub){
    if(!built)build();
    if(sub==='calendar'){
      if(firstShow&&!mqSheet.matches&&S.view==='month'&&S.year===now.getFullYear()&&S.month===now.getMonth())S.day=now.getDate();
      firstShow=false;
      showView(S.view);if(S.view==='month'){renderMonthHead();renderDays();renderPanel()}else renderYear();
    }else if(sub==='buget')renderBudget();
    else if(sub==='analiza')renderAnalysis();
    updateBackdrop();
  }
  function tour(){
    App.go('contabilitate','calendar');
    setTimeout(()=>{if(S.view!=='month'){showView('month');renderMonthHead();renderDays();renderPanel()}Tour.start([
      {el:'#accStrip .kpi.hi',text:'Aici vezi imediat câți bani îți rămân după cheltuielile esențiale și ratele creditelor.'},
      {el:'#mvCard',text:'Apasă pe o zi ca să adaugi cheltuieli sau venituri.'},
      {el:()=>$('#dayPanel:not(.empty)')||$('#mvCard'),text:'Scrie descrierea și suma, alege categoria din buget și apasă +. Dacă depășești bugetul, primești o alertă.'},
      {el:()=>$('#sub-contabilitate [data-sub="buget"]'),text:'În „Buget” compari ce ai planificat cu ce ai cheltuit, pe categorii.'},
      {el:()=>$('#sub-contabilitate [data-sub="analiza"]'),text:'În „Analiză” vezi grafice pe lună sau pe an.'}
    ])},App.sec==='contabilitate'?120:500);
  }
  function snapshot(){
    const months=[];
    for(let k=0;k<12;k++){let m=now.getMonth()-k,yy=now.getFullYear();while(m<0){m+=12;yy--}const st=monthStats(yy,m);if(st.inc||st.exp)months.push({luna:`${MONTHS[m]} ${yy}`,venituri_calculat:st.inc,cheltuieli_calculat:st.exp,economii_calculat:st.sav,pe_categorii_calculat:Object.values(st.cats).sort((a,b)=>b.sum-a.sum).slice(0,10).map(c=>({categorie:c.label,suma:c.sum,tranzactii:c.n}))})}
    const recent=[];
    for(let k=0;k<62&&recent.length<80;k++){const d=new Date();d.setDate(d.getDate()-k);const dd=dayData(d.getFullYear(),d.getMonth(),d.getDate());for(const x of dd.exp)recent.push({data:dateRO(isoOf(d)),tip:'cheltuială',descriere:x.t,suma:x.a});for(const x of dd.inc)recent.push({data:dateRO(isoOf(d)),tip:'venit',descriere:x.t,suma:x.a})}
    let buget=null;
    if(planReal()){const b=budgetFor(now.getFullYear(),now.getMonth());buget={luna:`${MONTHS[now.getMonth()]} ${now.getFullYear()}`,categorii:b.rows.map(r=>({categorie:r.name,tip:r.kind==='ess'?'esențial':r.kind==='credit'?'rată credit':'altă cheltuială',planificat_introdus:r.amount,cheltuit_real_calculat:r.actual,stare_calculat:r.state==='over'?'depășit':r.state==='warn'?'peste 80%':'în regulă'})),fara_categorie_calculat:b.unassigned,raman_dupa_esentiale_si_rate_calculat_din_plan:b.plan.afterEssentials}}
    return{nota:'sumele din tranzacții sunt introduse de utilizator; totalurile și stările sunt calculate de EcoFin',ultimele_12_luni:months,buget_luna_curenta:buget,tranzactii_recente_introduse:recent};
  }
  return{
    init(){},show,hide(){$('#backdrop').hidden=true;Charts.hideTip();if(mqSheet.matches&&S.day!==null){S.day=null;S.warn=null}},
    monthStats,yearStats,snapshot,tour,budgetFor,planReal,
    hasData:()=>Object.keys(D()).some(k=>/^\d{4}-\d{2}$/.test(k)&&D()[k]?.days&&Object.values(D()[k].days).some(Store.hasDay))
  };
})();
App.mods.contabilitate=Acc;
