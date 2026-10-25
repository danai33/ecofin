/* =====================================================================
   ASISTENT AI — knows which tool is open, sees only the data the user
   allows, labels every number: calculated, entered by the user, estimate.
   ===================================================================== */
const AI=(()=>{
  const KEY='ai-acces';
  const MODES=[
    {id:'explicatii',l:'Explicații',d:'Explic termenii financiari pe înțeles.',need:[],s:['Ce înseamnă DAE și de ce diferă de dobândă?','Care e diferența dintre rate egale și rate descrescătoare?','Ce este comisionul de rambursare anticipată?']},
    {id:'oferte',l:'Ofertele de credit',d:'Compar ofertele din calculator și explic de ce una e mai ieftină.',need:['credite'],s:['De ce e mai ieftină oferta câștigătoare?','Unde plătesc cele mai mari costuri?','Ce riscuri au ofertele mele?']},
    {id:'buget',l:'Unde se duc banii',d:'Citesc cheltuielile și bugetul tău și îți arăt unde se duc banii.',need:['contabilitate'],opt:['plan'],s:['Unde se duc banii mei luna aceasta?','Ce categorii îmi depășesc bugetul?','Unde aș putea economisi lunar?']},
    {id:'plan',l:'Planul lunar',d:'Verific planul lunar și ce se întâmplă la o cheltuială neprevăzută.',need:['plan'],s:['Cât pot economisi realist pe lună?','Ce fac dacă apare o cheltuială de 5 000 lei?','Unde aș putea ajusta planul?']},
    {id:'economii',l:'Plan de economisire',d:'Îți propun un plan realist pentru borcane și provocări.',need:['economii'],opt:['plan'],s:['Propune-mi un plan realist pentru obiectivul meu.','Cum nu mai ratez zile în provocare?','E realist termenul pe care l-am pus?']},
    {id:'contract',l:'Contracte',d:'Explic pasajele găsite în contract, citând fiecare pasaj.',need:[],s:['Ce clauze din contract merită verificate?','Explică-mi penalitățile din contract.','Ce comisioane apar în contract?']},
    {id:'simulari',l:'Simulări',d:'Răspund la întrebări „ce se întâmplă dacă…”, cu calculele EcoFin.',need:[],s:['Dacă dobânda crește cu 2 p.p., cât plătesc în plus pentru 100 000 lei pe 5 ani?','Cât strâng în 2 ani dacă pun 1 000 lei pe lună?','Ce credit costă mai puțin: 10 % pe 5 ani sau 9 % pe 7 ani?']},
    {id:'ghid',l:'Ghidare',d:'Te conduc pas cu pas prin EcoFin.',need:[],s:['Arată-mi cum compar două credite','Cum adaug o cheltuială?','Cum pornesc o provocare de 30 de zile?']}
  ];
  const MODE_FOR={acasa:'ghid',credite:'oferte',contabilitate:'buget',planificator:'plan',economii:'economii',contracte:'contract',educatie:'explicatii',cont:'ghid'};
  const SOURCES=[
    ['credite','Ofertele de credit',()=>`${plural(Credit.count(),'ofertă','oferte')} în calculator, cu rezultatele calculate`],
    ['contabilitate','Contabilitatea și bugetul',()=>Acc.hasData()?'totaluri pe luni, categorii, bugetul lunii și tranzacțiile din ultimele 2 luni':'încă nu ai înregistrări'],
    ['plan','Planul lunar',()=>`venituri, cheltuieli și rezultatul planului${Planner.exampleCount()?' (are sume din exemplu)':''}`],
    ['economii','Borcanele și provocarea',()=>{const s=Savings.snapshot();return `${plural(s.borcane.length,'borcan','borcane')}${s.provocare_activa?', o provocare activă':''}`}]
  ];
  const SRC_NAME=k=>SOURCES.find(s=>s[0]===k)?.[1].toLowerCase()||k;
  const ERR={not_granted:'Asistentul nu are voie să ruleze pe această pagină. Poți schimba asta din meniul de permisiuni al paginii.',sampling_disabled:'Asistentul nu este disponibil pentru contul tău.',not_declared:'Asistentul nu este activ pe această pagină.',capability_disabled:'Asistentul nu poate rula în această vizualizare.',capability_removed:'Aplicația Claude trebuie actualizată ca asistentul să funcționeze.',rate_limited:'Prea multe întrebări într-un timp scurt sau limita de utilizare a fost atinsă. Încearcă puțin mai târziu.',session_expired:'Sesiunea a expirat. Autentifică-te din nou în Claude.',refused:'Asistentul nu poate răspunde la această întrebare. Reformulează-o.',prompt_too_large:'Conversația e prea lungă. Începe una nouă.',image_rejected:'Imaginea nu a putut fi folosită.',images_unavailable:'Aici nu se pot trimite imagini.',tools_unavailable:'Instrumentele de calcul nu sunt disponibile aici.',empty_completion:'Nu a venit niciun răspuns. Încearcă o întrebare mai scurtă.',invalid_request:'Cererea nu a putut fi trimisă.',upstream_error:'Conexiunea s-a întrerupt. Încearcă din nou.',signed_out:'Sesiunea a expirat. Intră din nou în cont ca să folosești asistentul.',daily_limit:'Ai folosit toate întrebările de azi. Asistentul revine mâine.',site_limit:'Asistentul a ajuns la limita de folosire pentru tot site-ul. Încearcă din nou mai târziu; calculatoarele merg în continuare.',not_configured:'Asistentul nu este pornit încă pe acest site.'};
  const FATAL=['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed','signed_out','not_configured'];
  const errText=e=>e?.code==='daily_limit'&&e.limit?`Ai folosit toate cele ${e.limit} cereri de azi către asistent. Revine mâine; calculatoarele merg în continuare.`:(ERR[e?.code]||ERR.upstream_error);
  let mode='explicatii',manual=false,turns=[],ctl=null,busy=false,samplePromise=null,sample=null,limits=null,dead=false,accessOpen=false,docCtx=null,pendingImages=null;
  const access=()=>{const a={credite:false,contabilitate:false,plan:false,economii:false,...(Store.get(KEY)||{})};if(a.borcane&&!('economii' in (Store.get(KEY)||{})))a.economii=true;delete a.borcane;return a};
  const log=()=>$('#aiLog');

  /* ---------- safe markdown with source labels ---------- */
  const TAGS={'CALCULAT':['calc','calculat'],'EXACT':['calc','calculat'],'INTRODUS':['user','introdus de tine'],'INTRODUS DE TINE':['user','introdus de tine'],'ESTIMARE':['est','estimare'],'IPOTEZE':['hyp','ipoteze'],'IPOTEZĂ':['hyp','ipoteză'],'IPOTEZA':['hyp','ipoteză'],'DE VERIFICAT':['chk','de verificat']};
  function inline(s){
    return esc(s)
      .replace(/\[(CALCULAT|EXACT|INTRODUS DE TINE|INTRODUS|ESTIMARE|IPOTEZE|IPOTEZĂ|IPOTEZA|DE VERIFICAT)\]/g,(m,t)=>`<span class="lbl ${TAGS[t][0]}">${TAGS[t][1]}</span>`)
      .replace(/\[(?:DOCUMENT\s+)?(P\d{1,4})\]/g,(m,id)=>`<button type="button" class="lbl doc pref" data-pref="${id}">${id}</button>`)
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g,'$1<i>$2</i>');
  }
  function md(src){
    const L=String(src||'').replace(/\r/g,'').split('\n');let out='',i=0;
    while(i<L.length){
      const l=L[i];
      if(/^```/.test(l)){let j=i+1,buf=[];while(j<L.length&&!/^```/.test(L[j]))buf.push(L[j++]);out+=`<pre style="white-space:pre-wrap;margin:6px 0"><code>${esc(buf.join('\n'))}</code></pre>`;i=j+1;continue}
      if(/^\s*\|/.test(l)){let j=i,rows=[];while(j<L.length&&/^\s*\|/.test(L[j]))rows.push(L[j++]);const cells=r=>r.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());const body=rows.filter(r=>!/^\s*\|?\s*:?-{2,}/.test(r));const head=cells(body.shift()||'');out+=`<table><thead><tr>${head.map(c=>`<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${cells(r).map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;i=j;continue}
      const h=l.match(/^(#{1,4})\s+(.*)/);if(h){out+=`<h${h[1].length<3?3:4}>${inline(h[2])}</h${h[1].length<3?3:4}>`;i++;continue}
      if(/^\s*([-*•]|\d+[.)])\s+/.test(l)){const ord=/^\s*\d/.test(l);let j=i,items=[];while(j<L.length&&/^\s*([-*•]|\d+[.)])\s+/.test(L[j])){items.push(L[j].replace(/^\s*([-*•]|\d+[.)])\s+/,''));j++}out+=`<${ord?'ol':'ul'}>${items.map(x=>`<li>${inline(x)}</li>`).join('')}</${ord?'ol':'ul'}>`;i=j;continue}
      if(/^>\s?/.test(l)){let j=i,b=[];while(j<L.length&&/^>\s?/.test(L[j]))b.push(L[j++].replace(/^>\s?/,''));out+=`<blockquote>${inline(b.join(' '))}</blockquote>`;i=j;continue}
      if(!l.trim()){i++;continue}
      let j=i,p=[];while(j<L.length&&L[j].trim()&&!/^(```|\s*\||#{1,4}\s|\s*([-*•]|\d+[.)])\s+|>)/.test(L[j]))p.push(L[j++]);
      if(!p.length){p.push(L[j]);j++}
      out+=`<p>${p.map(inline).join('<br>')}</p>`;i=j;
    }
    return out;
  }

  /* ---------- what the assistant reads ---------- */
  const RULES=`Ești asistentul financiar al site-ului EcoFin, pentru utilizatori din Republica Moldova (moneda: lei, MDL). Răspunzi în limba română, simplu și concret, pentru cineva fără pregătire financiară.

REGULI OBLIGATORII
1. Marchează sursa fiecărei cifre, la începutul propoziției sau al elementului de listă:
   [CALCULAT] = rezultat calculat exact de instrumentele EcoFin sau prin aritmetică directă pe datele primite;
   [INTRODUS] = valoare scrisă de utilizator (sumele introduse, dobânzile din oferte, ținte, termene);
   [ESTIMARE] = aproximare, medie proiectată, presupunere despre viitor.
   Datele utilizatorului de mai jos au câmpuri care spun deja ce e introdus și ce e calculat; păstrează aceeași distincție.
2. Când faci calcule sau simulări, adaugă o secțiune care începe cu [IPOTEZE] și enumeră ipotezele (de exemplu: dobânda rămâne fixă, venitul scade din luna următoare).
3. Nu inventa condiții contractuale, comisioane, dobânzi, praguri, termene sau reguli fiscale ori legale. Dacă o informație nu apare în datele primite, spune că lipsește și pune [DE VERIFICAT] în fața a ceea ce trebuie confirmat (la creditor, în contract, la Serviciul Fiscal de Stat sau la un specialist). Nu cita legi, articole sau cote de impozit care nu apar în textul primit.
4. Folosește doar datele incluse mai jos. O sursă marcată NEAUTORIZAT nu îți este accesibilă: spune-i utilizatorului că o poate permite din „Acces la datele tale” și nu ghici ce conține.
5. Pentru calcule de credit, economii sau neprevăzute folosește instrumentele disponibile în loc să calculezi în minte. Rezultatele lor sunt [CALCULAT] pentru ipotezele date. Dacă instrumentele nu sunt disponibile, arată formula și marchează ca [ESTIMARE] orice rezultat rotunjit.
6. Ofertele, planurile sau documentele marcate exemplu/fictiv nu sunt reale: spune asta când le folosești.
7. Nu da verdicte de tipul „semnează” sau „nu semna”. Arată cifrele, avantajele, riscurile și ce trebuie verificat. Oferta finală o stabilește creditorul, prin contract.
8. Format: răspunsuri scurte, cu titluri mici, liste și tabele Markdown când ajută.`;
  const SITE=`DESPRE ECOFIN (pentru explicații și ghidare)
- Credite: suma și perioada sunt comune; fiecare ofertă are dobândă (fixă/variabilă), rate egale sau descrescătoare, comision de acordare (% sau lei), comision lunar, asigurare lunară, sursa și data ofertei. Butonul „+” dintre carduri adaugă o ofertă; „Editează” întoarce cardul; panoul „De unde vine diferența” împarte diferența de cost dintre cea mai ieftină ofertă și alta în dobândă, comision de acordare, comisioane lunare și asigurare; La început se vede un exemplu cu trei oferte fictive generate aleatoriu (eticheta Exemplu); butonul „Încearcă singur” trece la ofertele utilizatorului, iar „Alte exemple” generează alte trei.
  Formule: rata la anuități = S·i/(1−(1+i)^−n), i = dobânda anuală/12. Rate descrescătoare: principal lunar S/n, dobânda lunii = sold·i. Cost total = dobânzi + comisioane + asigurări. DAE = (1+r)^12 − 1, unde r egalează suma primită efectiv (S − comision de acordare) cu valoarea actuală a plăților lunare.
- Contabilitate: calendar cu cheltuieli și venituri pe zile; fila Buget compară planificat cu real pe categorii (din planul lunar) și dă alerte la depășire; fila Analiză arată graficele; „rămân după esențiale și rate” = venit − esențiale − rate.
- Planificator: venituri, cheltuieli esențiale, rate la credite, alte cheltuieli, fond de urgență → cât rămâne și cât poți economisi; fila Neprevăzute simulează o cheltuială neașteptată.
- Economii: borcane 3D cu țintă și termen; borcanul „se supără” în glumă dacă trece o zi fără depunere; provocări de 30, 60 sau 100 de zile, serii, insigne, puncte și aspecte de borcan.
- Contracte: analizorul citește local PDF-ul, găsește pasaje despre dobândă, DAE, comisioane, penalități etc. și le leagă de text.
- Educație: jocuri cu credite, reclame înșelătoare și bugetul unei luni.`;
  const MODE_TXT={
    explicatii:'MOD: Explicații. Explică pe înțeles, apoi un exemplu numeric scurt calculat cu instrumentele, dacă ajută.',
    oferte:'MOD: Ofertele de credit. Pornește de la secțiunea „de_ce_e_mai_ieftina_calculat” și explică de ce oferta cea mai ieftină costă mai puțin: câți lei vin din dobândă, comision de acordare, comisioane lunare și asigurare. Arată un tabel scurt cu rata lunară, costul total și DAE. Menționează riscurile (dobândă variabilă, rate descrescătoare, perioade diferite, exemple fictive, oferte fără sursă).',
    buget:'MOD: Unde se duc banii. Explică pe ce categorii s-au dus banii (sume și procente), ce categorii depășesc bugetul și cu cât, cât rămâne după esențiale și rate, apoi 3 propuneri concrete de economisire, fiecare cu economia lunară marcată [ESTIMARE].',
    plan:'MOD: Planul lunar. Verifică planul: cât rămâne după esențiale și rate, cât poate economisi, cât din venit merge pe rate, fondul de urgență. Pentru o cheltuială neprevăzută folosește simuleaza_neprevazut.',
    economii:'MOD: Plan de economisire. Propune un plan realist: pornește de la ce poate economisi lunar (din plan sau din istoricul depunerilor) și de la ritmul necesar pentru fiecare borcan. Dacă un obiectiv e prea greu, propune un termen nou sau o țintă mai mică, calculate cu verifica_obiectiv. Împarte suma pe lună, pe săptămână și pe zi.',
    contract:'MOD: Contracte. Lucrează doar cu pasajele din document primite mai jos, fiecare cu un ID de forma P12. Pentru fiecare explicație pune ID-ul pasajului între paranteze drepte, de exemplu [P12]. Nu adăuga condiții care nu apar în pasaje. Dacă o clauză importantă lipsește din pasaje, spune că nu apare și marchează [DE VERIFICAT]. Dacă nu ai primit niciun pasaj, cere utilizatorului să încarce contractul în secțiunea Contracte și să apese „Explică cu asistentul”.',
    simulari:'MOD: Simulări. Răspunde la „ce se întâmplă dacă” cu instrumentele de calcul. Arată înainte și după într-un tabel și scrie obligatoriu [IPOTEZE].',
    ghid:'MOD: Ghidare. Condu utilizatorul pas cu pas. La fiecare pas folosește deschide_sectiune ca să deschizi ecranul și să evidențiezi elementul. Un singur pas pe mesaj, apoi întreabă dacă a reușit.'
  };
  function dataBlock(){
    const a=access();const d=new Date();
    const part=(k,label,fn)=>{let v;try{v=a[k]?JSON.stringify(fn()):'NEAUTORIZAT (utilizatorul nu a permis accesul)'}catch(e){v='indisponibil'}return `${label}: ${v}`};
    return `DATELE UTILIZATORULUI (azi: ${dateRO(todayISO())})
${part('credite','Calculatorul de credite',()=>Credit.snapshot())}
${part('contabilitate','Contabilitatea și bugetul',()=>Acc.snapshot())}
${part('plan','Planul lunar',()=>Planner.snapshot())}
${part('economii','Borcanele și provocarea',()=>Savings.snapshot())}`;
  }
  function context(){
    const s=SEC[App.sec];const sub=s?.subs.find(x=>x[0]===App.sub)?.[1];
    return s?`${s.eyebrow}${sub&&s.subs.length>1?' → '+sub:''}`:'Pagina principală';
  }
  function instructions(){
    let s=`${RULES}\n\n${SITE}\n\nECRANUL DESCHIS ACUM: ${context()}\n\n${dataBlock()}\n\n${MODE_TXT[mode]}`;
    if(docCtx)s+=`\n\nPASAJE DIN DOCUMENTUL „${docCtx.name}”${docCtx.demo?' (document fictiv, demonstrativ)':''}, trimise de utilizator cu acordul lui (nu ai documentul întreg):\n${docCtx.passages.map(p=>`[${p.id}] (pagina ${p.page}, ${p.cat}) ${p.text}`).join('\n')}`;
    if(pendingImages)s+=`\n\nUtilizatorul a trimis imaginile primelor ${pendingImages.length} pagini dintr-un document scanat („${pendingImages.name}”). Citește doar ce se vede clar; nu completa textul ilizibil.`;
    s+=`\n\nInstrumente de calcul disponibile: ${limits?.tools?'da':'nu'}.`;
    return s;
  }

  /* ---------- tools the assistant can call ---------- */
  let actEl=null;
  const act=t=>{if(actEl){const p=document.createElement('p');p.className='act';p.textContent=t;actEl.append(p)}};
  const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d};
  const offerFrom=x=>{const fp=num(x?.comision_acordare_procent),fl=num(x?.comision_acordare_lei);return{rate:num(x?.dobanda_anuala),type:x?.tip_rambursare==='descrescatoare'?'desc':'ann',fee:fp>0?fp:fl,feeUnit:fp>0?'%':'lei',monthly:num(x?.comision_lunar_lei),insurance:num(x?.asigurare_lunara_lei),term:num(x?.luni)||'',lender:x?.nume||''}};
  const loanOut=r=>({prima_rata:r2(r.firstPayment),ultima_rata:r2(r.lastPayment),dobanda_totala:r2(r.totalInterest),comision_acordare:r2(r.upfront),comisioane_lunare_total:r2(r.totalMonthlyFees),asigurare_total:r2(r.totalInsurance),cost_total:r2(r.totalCost),total_de_plata:r2(r.totalPaid),dae_calculata_proc:r.dae==null?null:r2(r.dae*100),luni:r.n});
  const OFFER_SCHEMA={type:'object',properties:{nume:{type:'string'},dobanda_anuala:{type:'number',description:'procente, ex. 11.5'},tip_rambursare:{type:'string',enum:['anuitati','descrescatoare']},comision_acordare_procent:{type:'number'},comision_acordare_lei:{type:'number'},comision_lunar_lei:{type:'number'},asigurare_lunara_lei:{type:'number'},luni:{type:'number',description:'doar dacă are altă perioadă'}},required:['dobanda_anuala']};
  const EL={credite:{suma:'#crAmountBox',perioada:'#crMonthsBox',oferta:'.offer',plus:'.cr-plus button',explicatie:'.verdict',exemple:'#crTry'},contabilitate:{calendar:'#mvCard',ramas:'#accStrip .kpi.hi',zi:'#dayPanel',buget:'#sub-contabilitate [data-sub="buget"]',analiza:'#sub-contabilitate [data-sub="analiza"]'},planificator:{venituri:'.plan-group[data-group="income"]',esentiale:'.plan-group[data-group="essentials"]',rate:'.plan-group[data-group="credits"]',rezultat:'#plResult',neprevazute:'#sub-planificator [data-sub="neprevazute"]'},economii:{borcan:'#jar3d',depunere:'#jarMove',provocari:'#sub-economii [data-sub="provocari"]',recompense:'#sub-economii [data-sub="recompense"]'},contracte:{incarca:'#ctDrop'},educatie:{jocuri:'.game-hub'}};
  function tools(){
    return[
      {name:'calculeaza_credit',description:'Calculează exact un credit cu formulele EcoFin. Întoarce prima și ultima rată, dobânda totală, comisioanele, asigurarea, costul total, totalul de plată și DAE calculată (%).',
        inputSchema:{type:'object',properties:{suma:{type:'number',description:'lei'},luni:{type:'number'},...OFFER_SCHEMA.properties},required:['suma','luni','dobanda_anuala']},
        execute(x){const S=num(x.suma),n=Math.round(num(x.luni));if(!(S>0)||!(n>0))throw new Error('suma și luni trebuie să fie pozitive');const o=offerFrom({...x,luni:0});const r=FinCalc.loan(o,S,n);act(`Calculator de credite: ${lei0(S)}, ${n} luni, ${pctS(o.rate)}`);return{...loanOut(r),precizie:'calcul exact, rotunjit la bani'}}},
      {name:'compara_doua_credite',description:'Compară exact două oferte pentru aceeași sumă și explică diferența de cost total pe componente (dobândă, comision de acordare, comisioane lunare, asigurare).',
        inputSchema:{type:'object',properties:{suma:{type:'number'},luni:{type:'number'},oferta_a:OFFER_SCHEMA,oferta_b:OFFER_SCHEMA},required:['suma','luni','oferta_a','oferta_b']},
        execute(x){const S=num(x.suma),n=Math.round(num(x.luni));if(!(S>0)||!(n>0))throw new Error('suma și luni trebuie să fie pozitive');const offers=[offerFrom(x.oferta_a),offerFrom(x.oferta_b)];const c=FinCalc.compare(offers,S,n);const w=FinCalc.whyCheaper(offers,c.res,c.best,1-c.best);act(`Comparație: ${offers.map(o=>pctS(o.rate)).join(' vs ')}`);return{a:loanOut(c.res[0]),b:loanOut(c.res[1]),mai_ieftina:c.best===0?'a':'b',diferenta_cost_total:r2(w.total),componente:Object.fromEntries(w.parts.map(p=>[p.label,r2(p.diff)])),avertismente:w.warnings.map(z=>z.text),precizie:'calcul exact'}}},
      {name:'calculeaza_economii',description:'Calculează exact cât strângi depunând aceeași sumă la sfârșitul fiecărei luni, opțional cu sumă inițială și dobândă anuală capitalizată lunar.',
        inputSchema:{type:'object',properties:{suma_lunara:{type:'number'},luni:{type:'number'},dobanda_anuala:{type:'number',description:'procent, 0 dacă banii stau în borcan'},suma_initiala:{type:'number'}},required:['suma_lunara','luni']},
        execute(x){const n=Math.round(num(x.luni));if(!(n>0))throw new Error('luni trebuie să fie pozitiv');const r=FinCalc.savings(num(x.suma_lunara),n,num(x.dobanda_anuala),num(x.suma_initiala));act(`Economii: ${lei0(num(x.suma_lunara))}/lună, ${n} luni`);return{suma_finala:r2(r.final),total_depus:r2(r.deposited),dobanda_castigata:r2(r.interest),precizie:'calcul exact'}}},
      {name:'verifica_obiectiv',description:'Verifică dacă un obiectiv de economisire e realist: ritmul necesar pe lună și pe zi, câte luni durează la o capacitate dată, data realistă și cât se strânge până la termen.',
        inputSchema:{type:'object',properties:{tinta:{type:'number'},strans:{type:'number'},termen:{type:'string',description:'AAAA-LL-ZZ'},capacitate_lunara:{type:'number',description:'cât poate pune pe lună'}},required:['tinta']},
        execute(x){const g=FinCalc.goalCheck({target:num(x.tinta),saved:num(x.strans),deadline:/^\d{4}-\d{2}-\d{2}$/.test(String(x.termen||''))?x.termen:'',today:todayISO(),capacityPerMonth:num(x.capacitate_lunara)});act('Verific obiectivul de economisire');return{stare:g.status,ramas:r2(g.left||0),lei_pe_luna:g.perMonth?r2(g.perMonth):null,lei_pe_zi:g.perDay?r2(g.perDay):null,luni_necesare:g.monthsNeeded?r2(g.monthsNeeded):null,data_realista:g.reachDate||null,strans_pana_la_termen:g.reachableByDeadline?r2(g.reachableByDeadline):null,precizie:'calcul exact pentru capacitatea dată'}}},
      {name:'simuleaza_neprevazut',description:'Simulează o cheltuială neprevăzută: cât acoperă fondul de urgență, în câte luni acoperi restul din economiile lunare și cât durează refacerea fondului.',
        inputSchema:{type:'object',properties:{suma:{type:'number'},fond_urgenta:{type:'number'},economii_lunare:{type:'number'}},required:['suma','fond_urgenta','economii_lunare']},
        execute(x){const u=FinCalc.unexpected({amount:num(x.suma),fund:num(x.fond_urgenta),monthlySavings:num(x.economii_lunare)});act(`Simulare: cheltuială de ${lei0(num(x.suma))}`);return{din_fond:r2(u.fromFund),rest:r2(u.rest),fond_ramas:r2(u.fundLeft),luni_pentru_rest:u.months,acoperit:u.covered,luni_refacere_fond:u.rebuildMonths,precizie:'calcul exact'}}},
      {name:'deschide_sectiune',description:'Deschide un ecran EcoFin și, opțional, evidențiază un element. Secțiuni: acasa, credite, contabilitate, planificator, economii, contracte, educatie. Subsecțiuni: credite: compara, ghid; contabilitate: calendar, buget, analiza, ghid; planificator: lunar, neprevazute, ghid; economii: borcane, provocari, recompense, ghid; contracte: analizeaza, ghid; educatie: joc, ghid. Elemente: '+Object.entries(EL).map(([k,v])=>`${k}: ${Object.keys(v).join(', ')}`).join('; ')+'.',
        inputSchema:{type:'object',properties:{sectiune:{type:'string',enum:['acasa',...Object.keys(EL)]},subsectiune:{type:'string'},element:{type:'string'},text:{type:'string',description:'explicația scurtă afișată lângă element'}},required:['sectiune']},
        async execute(x){const sec=String(x.sectiune);if(sec!=='acasa'&&!SEC[sec])throw new Error('secțiune necunoscută');const subs=SEC[sec]?.subs.map(s=>s[0])||[];const sub=subs.includes(x.subsectiune)?x.subsectiune:undefined;act(`Deschid „${SEC[sec]?.label||'Acasă'}”${x.element?`, evidențiez „${x.element}”`:''}`);App.go(sec,sub);await new Promise(r=>setTimeout(r,450));const sel=EL[sec]?.[x.element];if(sel)highlight(sel,String(x.text||''));return{ok:true,element_gasit:!!(sel&&$(sel))}}},
      {name:'porneste_ghid',description:'Pornește turul ghidat pas cu pas al unei secțiuni: credite, contabilitate, planificator sau economii. Închide temporar panoul asistentului.',
        inputSchema:{type:'object',properties:{sectiune:{type:'string',enum:['credite','contabilitate','planificator','economii']}},required:['sectiune']},
        execute(x){const m=App.mods[x.sectiune];if(!m?.tour)throw new Error('secțiune necunoscută');act(`Pornesc ghidul pentru „${SEC[x.sectiune].label}”`);setTimeout(()=>{close();m.tour()},500);return{ok:true}}}
    ];
  }
  function highlight(sel,text){
    const el=$(sel);if(!el)return;
    if(innerWidth<1100){close();Tour.start([{el:sel,text:esc(text)||'Aici.'}],()=>openDrawer());return}
    el.scrollIntoView({block:'center',behavior:calm()?'auto':'smooth'});
    $$('.ai-hl').forEach(x=>x.classList.remove('ai-hl'));el.classList.add('ai-hl');setTimeout(()=>el.classList.remove('ai-hl'),7000);
    if(text){const b=document.createElement('div');b.className='hl-bubble glass';b.textContent=text;document.body.append(b);
      const place=()=>{const r=el.getBoundingClientRect();b.style.left=clamp(r.left,12,Math.max(12,innerWidth-560-b.offsetWidth))+'px';b.style.top=(r.bottom+14>innerHeight-80?r.top-b.offsetHeight-14:r.bottom+14)+'px'};
      setTimeout(place,calm()?0:450);setTimeout(()=>b.remove(),7000)}
  }

  /* ---------- drawer ---------- */
  function renderCtx(){$('#aiCtx').innerHTML=`Ești în: <b>${esc(context())}</b>`}
  function renderModes(){$('#aiModes').innerHTML=MODES.map(m=>`<button type="button" class="chip${m.id===mode?' on':''}" role="tab" aria-selected="${m.id===mode}" data-mode="${m.id}">${m.l}</button>`).join('')}
  function renderAccess(){
    const a=access();const n=Object.values(a).filter(Boolean).length;
    $('#aiAccessCnt').textContent=`${n} din ${SOURCES.length} permise`;
    $('#aiAccessBtn').setAttribute('aria-expanded',accessOpen);
    const list=$('#aiAccessList');list.hidden=!accessOpen;if(!accessOpen)return;
    list.innerHTML=SOURCES.map(([k,l,info])=>`<label class="acc-row"><div><b>${l}</b><span>${esc((()=>{try{return info()}catch(e){return ''}})())}</span></div><input type="checkbox" class="switch" data-src="${k}"${a[k]?' checked':''} aria-label="Permite acces la ${l}"></label>`).join('')+
      `<p class="muted" style="margin:0;font-size:12.5px">Asistentul primește doar sursele bifate, numai când trimiți o întrebare. Documentele din Contracte nu se trimit niciodată automat. Conversația nu se salvează.</p><details style="font-size:12.5px"><summary style="cursor:pointer;min-height:32px">Vezi exact ce se trimite</summary><pre style="white-space:pre-wrap;max-height:220px;overflow:auto;background:rgba(0,0,0,.22);padding:8px;border-radius:10px;margin:6px 0 0">${esc(dataBlock().slice(0,6000))}</pre></details>`;
  }
  function welcome(){
    const m=MODES.find(x=>x.id===mode);const a=access();
    const missing=m.need.filter(k=>!a[k]),opt=(m.opt||[]).filter(k=>!a[k]);
    if(dead){log().innerHTML=`<div class="ai-off">${esc(dead)}${Web.on&&Web.configured&&!Web.signed()?'<div style="margin-top:12px"><button class="pill sm white" type="button" data-auth="in">Intră în cont</button></div>':''}</div>`;return}
    log().innerHTML=`<div class="ai-start msg bot">
      <p><b>${esc(m.l)}.</b> ${esc(m.d)}</p>
      ${missing.length?`<p>Pentru asta am nevoie de acces la: <b>${missing.map(SRC_NAME).join(', ')}</b>.</p><div><button class="pill sm white" type="button" data-grant="${missing.join(',')}">Permite accesul</button></div>`:opt.length?`<p class="muted" style="font-size:14px">Răspunsul e mai bun dacă îmi permiți și: ${opt.map(SRC_NAME).join(', ')}. <button class="link" type="button" data-grant="${opt.join(',')}">Permite</button></p>`:''}
      ${mode==='contract'&&!docCtx?`<p class="muted" style="font-size:14px">Încarcă contractul în secțiunea Contracte, apoi apasă „Explică cu asistentul”. Îmi trimiți doar pasajele găsite, după ce confirmi.</p><div><button class="pill sm" type="button" data-goto="contracte">Deschide Contracte</button></div>`:''}
      <div class="legend-lbls">${lbl('calc')}${lbl('user')}${lbl('est')}${lbl('hyp','Ipoteze')}${lbl('chk')}</div>
      <p class="muted" style="font-size:13px;margin:0">Așa marchez fiecare cifră: calculată exact, scrisă de tine sau estimată.</p>
      <div class="starters">${m.s.map(s=>`<button type="button" class="chip" data-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    </div>`;
  }
  function setMode(id,byUser){mode=id;if(byUser)manual=true;renderModes();if(!turns.length)welcome()}
  function bubble(role,html){const d=document.createElement('div');d.className='msg '+(role==='user'?'me':'bot');d.innerHTML=html;log().append(d);scroll(true);return d}
  function scroll(force){const l=log();if(force||l.scrollHeight-l.scrollTop-l.clientHeight<140)l.scrollTop=l.scrollHeight}
  function setBusy(b){busy=b;$('#aiSend').hidden=b;$('#aiStop').hidden=!b}
  async function ensureSample(){
    if(sample||dead)return sample;
    if(!samplePromise)samplePromise=(async()=>{const c=window.claude;if(!c||typeof c.use!=='function')return null;try{return await c.use('sample')}catch(e){return null}})();
    sample=await samplePromise;
    if(!sample){dead=Web.on?(Web.configured?'Intră în cont ca să folosești asistentul AI. Calculatoarele, planificatorul și analizorul de contracte funcționează și fără cont.':'Asistentul AI nu este pornit încă pe acest site. Calculatoarele, planificatorul și analizorul de contracte funcționează și fără el.'):'Asistentul AI funcționează când EcoFin e deschis în Claude. Calculatoarele, planificatorul și analizorul de contracte funcționează și fără el.';return null}
    try{limits=await sample.limits()}catch(e){limits=null}
    return sample;
  }
  function validateRefs(text){
    if(!docCtx)return '';
    const sent=new Set(docCtx.passages.map(p=>p.id));const cited=[...String(text).matchAll(/\[(?:DOCUMENT\s+)?(P\d{1,4})\]/g)].map(m=>m[1]);
    const bad=[...new Set(cited.filter(id=>!sent.has(id)))];
    if(bad.length)return `<p class="err">Răspunsul citează ${bad.length===1?'un pasaj':'pasaje'} pe care nu l-am trimis (${bad.join(', ')}). Nu te baza pe acea parte; verifică direct în document.</p>`;
    if(!cited.length)return `<p class="note">${lbl('chk')} Răspunsul nu citează niciun pasaj. Verifică fiecare afirmație direct în document.</p>`;
    return `<p class="muted" style="font-size:12.5px;margin-top:6px">Apasă pe un cod de pasaj (de exemplu ${cited[0]}) ca să-l vezi în document.</p>`;
  }
  async function send(text,{images}={}){
    text=String(text||'').trim();if(!text||busy)return;
    if(!turns.length)log().innerHTML='';
    bubble('user',esc(text).replace(/\n/g,'<br>'));
    $('#aiInput').value='';autosize();
    const b=bubble('bot','<div class="acts"></div><div class="txt"><span class="thinking"><i></i><i></i><i></i> Se gândește…</span></div>');
    actEl=b.querySelector('.acts');const txt=b.querySelector('.txt');
    const s=await ensureSample();
    if(!s){txt.innerHTML=`<p>${esc(dead)}</p>`;actEl=null;return}
    turns.push({role:'user',content:text});
    while(turns.length>14)turns.shift();
    if(turns[0].role!=='user')turns.shift();
    // keep each request well under the size the assistant accepts: the oldest turns go first
    const instr=instructions(),size=()=>turns.reduce((n,t)=>n+String(t.content).length,0);
    while(turns.length>1&&instr.length+size()>200000){turns.shift();if(turns.length>1&&turns[0].role!=='user')turns.shift()}
    const input=[{role:'user',content:instr},...turns];
    const opts={cache:false,signal:(ctl=new AbortController()).signal,onText:({text:t})=>{txt.innerHTML=md(t);scroll()}};
    if(limits?.tools)opts.tools=tools();
    if(images?.length&&limits?.images)opts.images=images.slice(0,limits.images.maxCount||4);
    if(Web.on)opts.purpose=(mode==='contract'||docCtx||images?.length)?'contract':'chat';
    setBusy(true);
    try{
      const r=await s(input,opts);
      txt.innerHTML=md(r.text)+validateRefs(r.text)+(r.truncated?'<p class="muted" style="font-size:12.5px">Răspunsul a fost scurtat. Cere mai puține lucruri odată.</p>':'');
      turns.push({role:'assistant',content:r.text});
    }catch(e){
      const code=e?.code||'upstream_error';
      if(code==='cancelled'){txt.innerHTML=e.text?md(e.text)+'<p class="muted" style="font-size:12.5px">Oprit.</p>':'<p class="muted">Oprit.</p>';if(e.text)turns.push({role:'assistant',content:e.text})}
      else{
        txt.innerHTML=(e.text&&code!=='refused'?md(e.text):'')+`<p class="err">${esc(errText(e))}</p>`+(code==='signed_out'&&Web.on?'<div><button class="pill sm white" type="button" data-auth="in">Intră în cont</button></div>':'');
        if(FATAL.includes(code)){dead=ERR[code];$('#aiForm').hidden=true}
        if(e.text&&code!=='refused')turns.push({role:'assistant',content:e.text});
      }
    }finally{setBusy(false);ctl=null;actEl=null;pendingImages=null;scroll()}
  }
  let lastFocus=null;
  function openDrawer(){
    if(!$('#ai').hidden)return;
    lastFocus=document.activeElement;
    if(!manual)mode=MODE_FOR[App.sec]||'explicatii';
    renderCtx();renderModes();renderAccess();
    $('#ai').hidden=false;$('#aiOrb').hidden=true;document.documentElement.classList.add('modal-open');
    if(!turns.length)welcome();
    setTimeout(()=>$('#aiInput').focus({preventScroll:true}),60);
    ensureSample().then(()=>{if(dead&&!turns.length)welcome()});
  }
  function close(){if($('#ai').hidden)return;$('#ai').hidden=true;$('#aiOrb').hidden=false;document.documentElement.classList.remove('modal-open');lastFocus?.focus?.({preventScroll:true})}
  function needFor(m){return MODES.find(x=>x.id===m).need.filter(k=>!access()[k])}
  function open({mode:m,prompt}={}){
    if(m&&MODES.some(x=>x.id===m)){mode=m;manual=true}else if(!manual)mode=MODE_FOR[App.sec]||'explicatii';
    openDrawer();renderModes();
    if(!turns.length)welcome();
    if(prompt){
      const need=needFor(mode);
      if(need.length){$('#aiInput').value=prompt;autosize();const b=bubble('bot',`<p>Ca să răspund am nevoie de acces la: <b>${need.map(SRC_NAME).join(', ')}</b>.</p><div class="row"><button class="pill sm white" type="button" data-grant-send="${need.join(',')}">Permite și trimite</button><button class="pill sm" type="button" data-send-anyway>Trimite fără acces</button></div>`);b.dataset.pending='1'}
      else send(prompt);
    }
  }
  function autosize(){const t=$('#aiInput');t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'}
  function grant(keys){const a=access();keys.split(',').forEach(k=>a[k]=true);Store.set(KEY,a);renderAccess()}
  function bind(){
    renderModes();
    document.addEventListener('click',e=>{if(e.target.closest('[data-ai-open]')){e.preventDefault();open()}});
    $('#aiClose').addEventListener('click',close);$('#aiScrim').addEventListener('click',close);
    $('#aiNew').addEventListener('click',()=>{ctl?.abort();turns=[];docCtx=null;pendingImages=null;$('#aiFile').hidden=true;manual=false;mode=MODE_FOR[App.sec]||'explicatii';renderModes();welcome()});
    $('#aiAccessBtn').addEventListener('click',()=>{accessOpen=!accessOpen;renderAccess()});
    $('#aiAccessList').addEventListener('change',e=>{const k=e.target.dataset.src;if(!k)return;const a=access();a[k]=e.target.checked;Store.set(KEY,a);renderAccess();if(!turns.length)welcome()});
    $('#aiModes').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)setMode(b.dataset.mode,true)});
    $('#aiLog').addEventListener('click',e=>{
      const st=e.target.closest('[data-starter]');if(st){send(st.dataset.starter);return}
      const g=e.target.closest('[data-grant]');if(g){grant(g.dataset.grant);welcome();return}
      const gs=e.target.closest('[data-grant-send]');if(gs){grant(gs.dataset.grantSend);gs.closest('.msg').remove();send($('#aiInput').value);return}
      if(e.target.closest('[data-send-anyway]')){e.target.closest('.msg').remove();send($('#aiInput').value);return}
      const pr=e.target.closest('[data-pref]');if(pr){if(Contracts.passageIds().has(pr.dataset.pref)){close();App.go('contracte','analizeaza');setTimeout(()=>Contracts.see(pr.dataset.pref),200)}else toast('Documentul nu mai e deschis în Contracte.');return}
      const gt=e.target.closest('[data-goto]');if(gt){close()}
    });
    $('#aiFile').addEventListener('click',e=>{if(e.target.closest('#aiFileX')){docCtx=null;$('#aiFile').hidden=true;toast('Asistentul nu mai folosește pasajele din document.')}});
    $('#aiForm').addEventListener('submit',e=>{e.preventDefault();$$('#aiLog .msg[data-pending]').forEach(m=>m.remove());send($('#aiInput').value)});
    $('#aiInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#aiForm').requestSubmit()}});
    $('#aiInput').addEventListener('input',autosize);
    $('#aiStop').addEventListener('click',()=>ctl?.abort());
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#ai').hidden&&!Tour.active())close()});
    App.on('route',()=>{manual=false;if(!$('#ai').hidden){renderCtx()}});
    Store.on(()=>{if(!$('#ai').hidden)renderAccess()});
    setTimeout(()=>ensureSample(),2500);
  }
  function showDocChip(){
    const el=$('#aiFile');if(!docCtx){el.hidden=true;return}
    el.hidden=false;el.innerHTML=`${ico('file',22)}<div><b>${esc(docCtx.name)}</b><span>${plural(docCtx.passages.length,'pasaj trimis','pasaje trimise')}, nu documentul întreg</span></div><button class="icon-btn" type="button" id="aiFileX" aria-label="Nu mai folosi pasajele" style="width:36px;height:36px">✕</button>`;
  }
  return{
    init:bind,open,close,
    available:()=>!dead&&!!window.claude,
    canImages:()=>!!limits?.images,
    maxImages:()=>limits?.images?.maxCount||4,
    explainPassages(d){
      docCtx=d;turns=[];mode='contract';manual=true;openDrawer();renderModes();showDocChip();log().innerHTML='';
      send(`Explică-mi pe înțeles pasajele găsite în contractul „${d.name}”: dobânda, costurile, penalitățile și clauzele care merită verificate. Citează pasajul pentru fiecare explicație.${d.photo?' Textul a fost citit automat din poze, deci poate avea greșeli de citire: dacă o cifră sau un cuvânt pare greșit, spune-mi să-l verific pe poză.':''}`);
    },
    /** Transcription only (no interpretation) of photographed pages; the analysis stays local. */
    async transcribe(images){
      const s=await ensureSample();
      if(!s)throw new Error(dead||'Asistentul nu este disponibil aici.');
      if(!limits?.images)throw new Error('Aici nu se pot trimite imagini asistentului.');
      const max=limits.images.maxCount||4;const out=[];
      for(let i=0;i<images.length;i+=max){
        const chunk=images.slice(i,i+max);
        const prompt=`Transcrie exact textul din ${chunk.length===1?'imaginea atașată':`cele ${chunk.length} imagini atașate`}: sunt pagini dintr-un contract, în ordine. Reguli: scrie doar textul care apare, cuvânt cu cuvânt, în limba originală; nu rezuma, nu corecta, nu explica și nu adăuga nimic. Păstrează numerotarea clauzelor și pune un rând gol între paragrafe. Unde un cuvânt sau un număr nu se poate citi sigur, scrie [ilizibil]. Înaintea fiecărei pagini scrie pe un rând separat === PAGINA N ===, cu N de la ${i+1} la ${i+chunk.length}.`;
        let r;try{r=await s([{role:'user',content:prompt}],{images:chunk,cache:false,...(Web.on?{purpose:'transcribe'}:{})})}catch(e){throw new Error(ERR[e?.code]?errText(e):'Asistentul nu a putut citi pozele.')}
        const txt=String(r?.text||'');const parts=txt.split(/^\s*=+\s*PAGINA\s*(\d+)\s*=+\s*$/mi);const got={};
        for(let k=1;k<parts.length;k+=2)got[+parts[k]]=String(parts[k+1]||'').trim();
        for(let j=0;j<chunk.length;j++)out.push(got[i+j+1]??(chunk.length===1?txt.trim():''));
      }
      return out;
    },
    explainImages(d){
      pendingImages={length:d.images.length,name:d.name};turns=[];mode='contract';manual=true;openDrawer();renderModes();log().innerHTML='';
      send(`Citește imaginile primelor pagini din documentul „${d.name}” și spune-mi ce scrie despre dobândă, comisioane, penalități și alte clauze importante. Spune clar ce nu se poate citi.`,{images:d.images});
    }
  };
})();
App.AI=AI;
