/* =====================================================================
   CONTRACTE — reads a contract locally (PDF, DOCX, TXT or photos of the
   pages), finds interest, fees, penalties and clauses worth checking, each
   tied to its passage. Photos are read on the device (OCR in a worker);
   nothing leaves the page unless the user explicitly sends it to the AI.
   ===================================================================== */
const LIBS={
  pdf:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  mammoth:'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
};
const loadScript=src=>new Promise((res,rej)=>{if($(`script[src="${src}"]`)){res();return}const s=document.createElement('script');s.src=src;s.onload=()=>res();s.onerror=()=>rej(new Error('Biblioteca nu s-a putut încărca. Verifică internetul și încearcă din nou.'));document.head.append(s)});

/* ---------- OCR on the device: Tesseract (Romanian), every file served by this site ---------- */
const OCR=(()=>{
  let workerP=null,onLog=null;
  const base=()=>new URL('assets/ocr/',location.href).href;
  const txt=async f=>{const r=await fetch(base()+f);if(!r.ok)throw new Error(f+' '+r.status);return r.text()};
  function wasmOK(){try{new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));return true}catch(e){return false}}
  function simdOK(){try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]))}catch(e){return false}}
  async function worker(){
    if(typeof WebAssembly!=='object'||!wasmOK())throw Object.assign(new Error('Acest browser nu poate rula recunoașterea textului.'),{code:'nowasm'});
    if(!workerP)workerP=(async()=>{
      await loadScript(base()+'tesseract.min.js');
      if(!window.Tesseract)throw new Error('Recunoașterea textului nu s-a putut porni.');
      // one self-contained worker: language data + engine + worker code, so it needs no other network access
      const [ron,core,wsrc]=await Promise.all([txt('ron.b64.txt'),txt(simdOK()?'tesseract-core-simd-lstm.wasm.js':'tesseract-core-lstm.wasm.js'),txt('worker.min.js')]);
      const pre=`self.__RON=${JSON.stringify(ron.trim())};(function(){var f=self.fetch&&self.fetch.bind(self);self.fetch=function(u,o){if(String(u).indexOf('ron.traineddata')>=0){var b=atob(self.__RON),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return Promise.resolve(new Response(a))}return f(u,o)}})();\n`;
      const url=URL.createObjectURL(new Blob([pre,core,'\n;\n',wsrc],{type:'application/javascript'}));
      return window.Tesseract.createWorker('ron',1,{workerPath:url,workerBlobURL:false,langPath:'https://local.invalid/ocr',cacheMethod:'none',gzip:true,logger:m=>{try{onLog&&onLog(m)}catch(e){}}});
    })().catch(e=>{workerP=null;throw e});
    return workerP;
  }
  async function read(canvas,log){onLog=log;const w=await worker();const {data}=await w.recognize(canvas,{},{text:true,blocks:true,hocr:false,tsv:false});onLog=null;return data}
  async function stop(){if(!workerP)return;try{const w=await workerP;await w.terminate()}catch(e){}workerP=null}
  return{read,stop,wasmOK};
})();

const Contracts=(()=>{
  let doc=null,built=false,busy=false,consent=null,photos=[],busyMsg='',busySub='';
  const MAXPH=20;const isImg=f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name||'');
  const CATS=[
    {k:'dobanda',t:'Dobânda',re:/dobanz|dobanda|rata dobanzii/,ex:/dobanda anuala efectiva/,why:'Arată dobânda anuală și dacă e fixă sau variabilă. Compar-o cu oferta primită și verifică dacă se aplică pe toată perioada.'},
    {k:'dae',t:'DAE',re:/\bdae\b|dobanda anuala efectiva/,why:'DAE adună dobânda și costurile obligatorii într-un procent pe an. Verifică dacă e aceeași cu cea din oferta primită; o poți recalcula în calculatorul de credite.'},
    {k:'comisioane',t:'Comisioane',re:/comision/,ex:/comision(ul)? (de|pentru) rambursare(a)? anticipat/,why:'Comisioanele se adaugă la dobândă. Notează fiecare sumă și când se plătește: o dată, lunar sau la anumite operațiuni.'},
    {k:'penalitati',t:'Penalități și întârzieri',re:/penalit|intarzier|majorari|dobanda penalizatoare|amenda/,why:'Spune ce plătești dacă întârzii o rată. Verifică din ce sumă se calculează (rata restantă sau tot soldul) și pentru câte zile.'},
    {k:'asigurare',t:'Asigurări',re:/asigur/,why:'Verifică dacă asigurarea e obligatorie, cât costă pe lună și dacă o poți alege de la altă companie.'},
    {k:'anticipat',t:'Rambursare anticipată',re:/anticipat|inainte de termen/,ex:/scadent(a|ei) anticipat/,why:'Spune dacă poți închide creditul mai devreme, total sau parțial, și cu ce cost.'},
    {k:'modificare',t:'Schimbarea condițiilor',re:/variabil|flotant|modific|unilateral|revizu|ajust|indexa|rata de baza|marja/,why:'Spune când și cum se pot schimba dobânda, comisioanele sau alte condiții și cum ești anunțat.'},
    {k:'garantii',t:'Garanții',re:/\bgaj|garant|ipotec|fidejus|cautiune|girant/,why:'Spune cu ce garantezi creditul: un bun (gaj, ipotecă) sau o persoană (fidejusor) care plătește dacă tu nu poți.'},
    {k:'reziliere',t:'Rezilierea și scadența anticipată',re:/rezili|incetar|scadent(a|ei) anticipat|exigibil/,why:'Spune când contractul se poate încheia mai devreme și dacă banca poate cere toată suma deodată.'},
    {k:'altele',t:'Alte clauze de verificat',re:/cesion|cesiun|transmite\w* creant|arbitraj|instant|jurisdic|biroul (istoriilor|de credit)|date(le)? cu caracter personal/,why:'Clauză care merită citită atent înainte de semnare.'}
  ];
  const RISKS=[
    [/unilateral|fara acordul/,'Creditorul poate schimba condițiile fără acordul tău.'],
    [/variabil|flotant/,'Dobânda se poate schimba pe parcurs.'],
    [/pentru fiecare zi|pe zi\b|zilnic/,'Se calculează pe zi: întârzierile cresc repede.'],
    [/scadent(a|ei) anticipat|exigibil/,'Banca poate cere toată suma înainte de termen.'],
    [/cesion|cesiun/,'Datoria poate fi transferată altei firme.'],
    [/\bgaj|ipotec/,'Răspunzi cu un bun.'],
    [/fidejus|girant|cautiune/,'Altă persoană răspunde pentru datoria ta.'],
    [/obligat\w* sa (incheie|contracteze)|obligatorie/,'Este o obligație, nu o opțiune.']
  ];

  /* ---------- reading files ---------- */
  function pdfText(items){
    let out='',py=null,px=null,pw=0;
    for(const it of items){
      if(!('str' in it))continue;
      const x=it.transform[4],y=it.transform[5],h=Math.abs(it.transform[3])||it.height||10;
      if(py!==null&&Math.abs(y-py)>h*.6)out+='\n';
      else if(px!==null&&x-(px+pw)>h*.18&&!out.endsWith(' '))out+=' ';
      out+=it.str;py=y;px=x;pw=it.width||0;
      if(it.hasEOL){out+='\n';py=null;px=null}
    }
    return out;
  }
  async function readFile(f){
    const name=f.name,ext=(name.split('.').pop()||'').toLowerCase();
    if(f.size>20*1024*1024)throw new Error('Fișierul e mai mare de 20 MB. Încarcă o variantă mai mică.');
    if(['txt','md'].includes(ext))return{name,pages:[{n:1,text:await f.text()}]};
    if(ext==='docx'){await loadScript(LIBS.mammoth);const r=await window.mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});return{name,pages:[{n:1,text:r.value||''}]}}
    if(ext==='pdf'){
      await loadScript(LIBS.pdf);await loadScript(LIBS.pdfWorker);
      const lib=window.pdfjsLib;if(!lib)throw new Error('Cititorul de PDF nu s-a putut porni.');
      lib.GlobalWorkerOptions.workerSrc=LIBS.pdfWorker;
      let pdf;try{pdf=await lib.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false}).promise}catch(e){throw new Error(e?.name==='PasswordException'?'PDF-ul e protejat cu parolă. Deschide-l, salvează-l fără parolă și încearcă din nou.':'Fișierul nu pare un PDF valid.')}
      const pages=[];const N=Math.min(pdf.numPages,120);
      for(let p=1;p<=N;p++){const pg=await pdf.getPage(p);const tc=await pg.getTextContent();pages.push({n:p,text:pdfText(tc.items)})}
      const chars=pages.reduce((s,p)=>s+p.text.replace(/\s/g,'').length,0);
      return{name,pages,numPages:pdf.numPages,truncatedPages:pdf.numPages>N,scanned:chars<60*Math.min(N,3),pdf};
    }
    throw new Error('Format nesuportat. Folosește PDF, DOCX, TXT sau poze (JPG, PNG).');
  }

  /* ---------- passages & findings ---------- */
  const startsClause=s=>{const n=norm(s);return /^((\d+\.)+\d*\.?|\d+\)|[a-z]\)|art(\.|icolul)\s*\d+|capitolul|sectiunea|•|-\s)/i.test(n)||/^\d+,\d+\.\s+[a-z]/i.test(n)};
  function passages(pages){
    const out=[];let n=0;
    for(const pg of pages){
      let t=pg.text.replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/(\p{L})-\n(\p{L})/gu,'$1$2');
      const lines=t.split('\n').map(s=>s.trim());
      const units=[];let cur='';
      for(const ln of lines){
        if(!ln){if(cur){units.push(cur);cur=''}continue}
        if(cur&&(startsClause(ln)||/[.;:]$/.test(cur)&&/^[A-ZĂÂÎȘȚŞŢ]/.test(ln)&&cur.length>140)){units.push(cur);cur=ln}
        else cur=cur?cur+' '+ln:ln;
      }
      if(cur)units.push(cur);
      for(const u of units){
        const parts=u.length>650?u.split(/(?<=[.;])\s+(?=[A-ZĂÂÎȘȚŞŢ0-9(])/):[u];
        let buf='';
        for(const p of parts){if((buf+' '+p).length>650&&buf){out.push({id:'P'+(++n),page:pg.n,text:buf.trim()});buf=p}else buf=buf?buf+' '+p:p}
        if(buf.trim())out.push({id:'P'+(++n),page:pg.n,text:buf.trim()});
      }
    }
    return out;
  }
  /** Passages from OCR'd photos: same clause splitting, but every passage keeps the line boxes. */
  function photoPassages(pages){
    const out=[];let n=0;
    const join=(a,b)=>/[\p{L}]-$/u.test(a)&&/^\p{Ll}/u.test(b)?a.slice(0,-1)+b:a+' '+b;
    for(const pg of pages){
      for(const para of pg.paras){
        const units=[];let cur=null;
        for(const ln of para){
          if(cur&&(startsClause(ln.text)||/[.;:]$/.test(cur.text)&&/^[A-ZĂÂÎȘȚŞŢ]/.test(ln.text)&&cur.text.length>140)){units.push(cur);cur=null}
          if(!cur)cur={text:ln.text,boxes:[ln.box]};else{cur.text=join(cur.text,ln.text);cur.boxes.push(ln.box)}
        }
        if(cur)units.push(cur);
        for(const u of units){
          if(u.text.length<=700){out.push({id:'P'+(++n),page:pg.n,text:u.text,boxes:u.boxes});continue}
          const parts=u.text.split(/(?<=[.;])\s+(?=[A-ZĂÂÎȘȚŞŢ0-9(])/);let buf='';
          for(const p of parts){if((buf+' '+p).length>650&&buf){out.push({id:'P'+(++n),page:pg.n,text:buf.trim(),boxes:u.boxes});buf=p}else buf=buf?buf+' '+p:p}
          if(buf.trim())out.push({id:'P'+(++n),page:pg.n,text:buf.trim(),boxes:u.boxes});
        }
      }
    }
    return out;
  }
  function values(text){
    const v=[];const seen=new Set();const add=s=>{s=s.replace(/\s+/g,' ').trim();if(!seen.has(s)){seen.add(s);v.push(s)}};
    for(const m of text.matchAll(/(\d{1,3}(?:[.,]\d{1,3})?)\s?%/g))add(m[1]+' %');
    for(const m of text.matchAll(/(\d{1,3}(?:[ . ]\d{3})*(?:[.,]\d{1,2})?)\s?(lei|MDL|EUR|euro|USD)\b/gi))add(m[1]+' '+m[2]);
    for(const m of text.matchAll(/\b(\d{1,3})\s?(de\s)?(zile|zi|luni|lună|ani)\b/gi))add(m[1]+' '+m[3]);
    return v.slice(0,6);
  }
  function analyze(ps){
    const found=Object.fromEntries(CATS.map(c=>[c.k,[]]));
    for(const p of ps){
      const n=norm(p.text);
      if(p.text.length<60&&!/\d[\d.,]*\s?(%|lei|mdl|eur|zile|luni|ani)/i.test(p.text))continue;
      for(const c of CATS){
        if(!c.re.test(n))continue;
        if(c.ex&&c.ex.test(n)&&!(c.k==='dobanda'&&/dobanda (anuala|lunara|fixa|variabila|nominala)|rata dobanzii/.test(n.replace(/dobanda anuala efectiva/g,''))))continue;
        const risks=RISKS.filter(([re])=>re.test(n)).map(([,t])=>t);
        found[c.k].push({...p,cat:c.k,vals:values(p.text),risks});
      }
    }
    return found;
  }

  /* ---------- demo contract (fictional) ---------- */
  const DEMO={name:'Contract demonstrativ (fictiv).txt',demo:true,pages:[{n:1,text:`CONTRACT DE CREDIT DE CONSUM nr. DEMO-0427
Document fictiv, creat doar pentru demonstrarea analizorului EcoFin. Creditor: Banca Exemplu SA (fictivă).

1. Obiectul contractului
1.1. Creditorul acordă Debitorului un credit de consum în sumă de 60 000 lei, pe o perioadă de 48 de luni.

2. Dobânda
2.1. Pentru primele 12 luni, dobânda anuală este fixă, de 13,9 %.
2.2. Începând cu luna a 13-a, dobânda devine variabilă și se calculează ca rata de bază a Creditorului plus o marjă fixă de 6,5 %.
2.3. Creditorul poate modifica rata de bază, informând Debitorul cu cel puțin 15 zile înainte.

3. Dobânda anuală efectivă (DAE)
3.1. DAE calculată la data semnării este de 18,4 %, presupunând că dobânda rămâne neschimbată pe toată durata creditului.

4. Comisioane
4.1. Comision de acordare: 2,5 % din suma creditului, reținut la eliberarea creditului.
4.2. Comision lunar de administrare: 60 lei, inclus în rata lunară.
4.3. Comision pentru eliberarea certificatelor la cerere: 100 lei pentru fiecare document.`},{n:2,text:`5. Asigurare
5.1. Debitorul este obligat să încheie o asigurare de viață, cu prima lunară de 0,06 % din soldul creditului, plătită odată cu rata.

6. Rambursarea anticipată
6.1. Debitorul poate rambursa anticipat, total sau parțial, cu un comision de 1 % din suma rambursată anticipat.

7. Întârzieri
7.1. Pentru fiecare zi de întârziere se calculează o penalitate de 0,1 % din suma restantă.
7.2. Dacă Debitorul întârzie plata a două rate consecutive, Creditorul poate declara scadența anticipată a întregului credit.

8. Garanții
8.1. Creditul este garantat prin gajul autoturismului Debitorului și prin fidejusiunea unei persoane terțe.

9. Modificarea contractului
9.1. Creditorul poate modifica unilateral cuantumul comisioanelor, notificând Debitorul cu 30 de zile înainte.
9.2. Debitorul poate rezilia contractul în termen de 30 de zile de la notificare, fără penalități, cu rambursarea integrală a soldului.

10. Cesiunea
10.1. Creditorul are dreptul să cesioneze creanța către terți fără acordul Debitorului.

11. Dispoziții finale
11.1. Litigiile se soluționează de instanțele competente de la sediul Creditorului.`}]};

  /* ---------- rendering ---------- */
  const catOf=k=>CATS.find(c=>c.k===k);
  function dropHTML(){
    return `<div class="stack-gap">
      <div class="privacy note">${ico('shield',22)}<div><b>Documentul rămâne la tine.</b> Îl citesc doar în acest browser, inclusiv pozele: nu le salvez și nu le trimit nicăieri. Asistentul AI primește ceva din document numai dacă apeși tu pe buton și confirmi.</div></div>
      <div class="drop-grid">
        <label class="drop" id="ctDrop" for="ctFile"><span>${ico('up',42)}</span><h2>Încarcă contractul</h2><p class="muted">PDF, DOCX, TXT sau poze (JPG, PNG), până la 20 MB. Trage fișierele aici sau apasă ca să le alegi.</p><span class="pill solid" aria-hidden="true">Alege fișierul</span></label>
        <div class="drop-photo panel"><span class="ico-big">${ico('image',32)}</span><h2>Ai contractul pe hârtie?</h2><p class="muted">Adaugă poze cu paginile, din galerie sau direct cu camera. Câte o poză pentru fiecare pagină.</p>
          <div class="row"><button class="pill solid" type="button" id="ctPickPhotos">${ico('image',18)}Din galerie</button><button class="pill" type="button" id="ctPickCam">${ico('camera',18)}Fă o poză</button></div></div>
      </div>
      <div class="row" style="justify-content:center"><button class="pill" type="button" id="ctDemo">Încearcă un contract demonstrativ</button></div>
      <p class="err" id="ctErr" hidden></p>
    </div>`;
  }
  /* ---------- photos: tray, reading on the device, assistant fallback ---------- */
  function trayHTML(){
    return `<section class="panel pad photo-tray" aria-label="Pozele contractului">
      <div class="sec-head"><h2 class="h2s">Pozele contractului</h2><span class="muted">${plural(photos.length,'pagină','pagini')}, în ordinea în care le citesc</span></div>
      <div class="thumbs">${photos.map((p,i)=>`<figure class="thumb"><div class="thumb-img"><img src="${p.url}" alt="Pagina ${i+1}" style="transform:rotate(${p.rot}deg)${p.rot%180?';scale:.72':''}"></div><figcaption>Pagina ${i+1}</figcaption>
          <div class="thumb-btns"><button class="icon-btn" type="button" data-ph-rot="${i}" aria-label="Rotește pagina ${i+1}" title="Rotește">${ico('rotate',17)}</button>${i?`<button class="icon-btn" type="button" data-ph-left="${i}" aria-label="Mută pagina ${i+1} mai devreme" title="Mută mai devreme">←</button>`:''}<button class="icon-btn" type="button" data-ph-rm="${i}" aria-label="Scoate pagina ${i+1}" title="Scoate">${ico('x',17)}</button></div></figure>`).join('')}
        ${photos.length<MAXPH?`<button class="thumb add" type="button" id="ctMore"><b>+</b>Adaugă pagini</button>`:''}</div>
      <p class="muted" style="font-size:14px;margin:0">Pentru un rezultat bun: poză dreaptă, cu lumină bună, fără umbre și cu toată pagina în cadru. Dacă o poză e pe o parte, apasă ${ico('rotate',15)}.</p>
      <div class="row"><button class="pill solid big" type="button" id="ctRead">Citește textul din poze</button><button class="pill" type="button" id="ctPhClear">Renunță</button></div>
      <p class="err" id="ctErr" hidden></p>
    </section>`;
  }
  function addPhotos(files){
    const imgs=[...files].filter(isImg);if(!imgs.length)return false;
    const room=MAXPH-photos.length;
    for(const f of imgs.slice(0,Math.max(0,room))){if(f.size>25*1024*1024){toast(`„${f.name}” e mai mare de 25 MB.`);continue}photos.push({id:rid(),file:f,url:URL.createObjectURL(f),rot:0,name:f.name})}
    if(imgs.length>room)toast(`Poți adăuga cel mult ${MAXPH} poze.`);
    doc=null;render();return true;
  }
  function clearPhotos(){for(const p of photos)URL.revokeObjectURL(p.url);photos=[]}
  async function decode(p){
    try{return await createImageBitmap(p.file,{imageOrientation:'from-image'})}
    catch(e){return await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error(`Poza „${p.name}” nu poate fi deschisă aici. Salveaz-o ca JPG sau PNG.`));im.src=p.url})}
  }
  /** Straightened, rotated, contrast-stretched grayscale copy, 1400–2600 px on the long side. */
  async function prep(p){
    const bmp=await decode(p);const w0=bmp.width,h0=bmp.height;const rot=((p.rot%360)+360)%360;
    const sw=rot%180?h0:w0,sh=rot%180?w0:h0;const long=Math.max(sw,sh);
    const sc=long>2600?2600/long:long<1400?1400/long:1;
    const c=document.createElement('canvas');c.width=Math.round(sw*sc);c.height=Math.round(sh*sc);
    const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
    x.translate(c.width/2,c.height/2);x.rotate(rot*Math.PI/180);x.drawImage(bmp,-w0*sc/2,-h0*sc/2,w0*sc,h0*sc);x.setTransform(1,0,0,1,0,0);
    bmp.close?.();
    const im=x.getImageData(0,0,c.width,c.height),d=im.data,hist=new Uint32Array(256);
    for(let i=0;i<d.length;i+=4){const g=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8;d[i]=g;hist[g]++}
    const tot=d.length/4;let lo=0,hi=255,acc=0;for(let v=0;v<256;v++){acc+=hist[v];if(acc>tot*.01){lo=v;break}}acc=0;for(let v=255;v>=0;v--){acc+=hist[v];if(acc>tot*.04){hi=v;break}}
    const k=255/Math.max(30,hi-lo);
    for(let i=0;i<d.length;i+=4){const g=Math.max(0,Math.min(255,(d[i]-lo)*k));d[i]=d[i+1]=d[i+2]=g}
    x.putImageData(im,0,0);
    const url=URL.createObjectURL(await new Promise(r=>c.toBlob(r,'image/jpeg',.82)));
    return{canvas:c,url,w:c.width,h:c.height};
  }
  function linesOf(data){
    const paras=[];
    for(const b of data.blocks||[])for(const pa of b.paragraphs||[]){
      const ls=(pa.lines||[]).map(l=>({text:String(l.text||'').replace(/\s+/g,' ').trim(),box:l.bbox,conf:l.confidence})).filter(l=>l.text&&/[\p{L}\d]/u.test(l.text));
      if(ls.length)paras.push(ls);
    }
    return paras;
  }
  async function readPhotos(){
    if(!photos.length)return;
    busy=true;busyMsg='Citesc textul din poze…';busySub='Prima dată pornesc recunoașterea textului (câteva secunde).';render();
    const pages=[];
    try{
      for(let i=0;i<photos.length;i++){
        busyMsg=`Citesc pagina ${i+1} din ${photos.length}…`;setBusyText();
        const pr=await prep(photos[i]);
        const data=await OCR.read(pr.canvas,m=>{if(m.status==='recognizing text'){busySub=`${Math.round((m.progress||0)*100)} %`;setBusyText()}else if(/loading|initializ/.test(m.status||'')){busySub='Pornesc recunoașterea textului…';setBusyText()}});
        pages.push({n:i+1,paras:linesOf(data),text:data.text||'',conf:data.confidence||0,img:pr.url,w:pr.w,h:pr.h});
      }
    }catch(e){
      busy=false;for(const p of pages)URL.revokeObjectURL(p.img);
      if(e&&e.code==='nowasm'||/wasm|WebAssembly|Worker|importScripts|CompileError|Content Security/i.test(String(e&&(e.message||e)))){doc={photoFail:true,name:photosName()};render();return}
      doc=null;render();const er=$('#ctErr');if(er){er.textContent=e.message||'Nu am putut citi pozele.';er.hidden=false}return;
    }
    const ps=photoPassages(pages);
    setDoc({name:photosName(),photo:'local',photoPages:pages.map(p=>({n:p.n,img:p.img,w:p.w,h:p.h,conf:p.conf})),pages:pages.map(p=>({n:p.n,text:p.paras.map(l=>l.map(x=>x.text).join('\n')).join('\n\n')}))},ps);
  }
  const photosName=()=>`Poze contract (${plural(photos.length,'pagină','pagini')})`;
  function setBusyText(){const a=$('#ctBusyMsg'),b=$('#ctBusySub');if(a)a.textContent=busyMsg;if(b)b.textContent=busySub}
  async function readWithAssistant(){
    busy=true;busyMsg='Asistentul transcrie textul din poze…';busySub='Durează puțin, câteva secunde pe pagină.';render();
    const pages=[];
    try{
      const blobs=[];for(const p of photos){const pr=await prep(p);pages.push({n:pages.length+1,img:pr.url,w:pr.w,h:pr.h,conf:null});blobs.push(await new Promise(r=>pr.canvas.toBlob(r,'image/jpeg',.85)))}
      const texts=await App.AI.transcribe(blobs);
      busy=false;
      setDoc({name:photosName(),photo:'ai',photoPages:pages,pages:pages.map((p,i)=>({n:p.n,text:texts[i]||''}))});
    }catch(e){busy=false;for(const p of pages)URL.revokeObjectURL(p.img);doc={photoFail:true,name:photosName(),aiErr:e.message||'Asistentul nu a putut citi pozele.'};render()}
  }
  function findingHTML(f){
    const c=catOf(f.cat);const short=f.text.length>320?f.text.slice(0,300).replace(/\s\S*$/,'')+'…':f.text;
    return `<div class="finding${f.risks.length?' risk':''}">
      <div class="row" style="justify-content:space-between"><span class="row">${lbl('doc',`Pagina ${f.page} · ${f.id}`)}${f.vals.length?`<span class="vals">${f.vals.map(v=>`<span class="val num">${esc(v)}</span>`).join('')}</span>`:''}</span><button class="link" type="button" data-see="${f.id}">Vezi în document</button></div>
      <blockquote>„${esc(short)}”</blockquote>
      ${f.risks.length?`<p class="explain">${lbl('chk')} ${f.risks.map(esc).join(' ')}</p>`:''}
      <p class="muted" style="font-size:14px;margin:0">${esc(c.why)}</p></div>`;
  }
  function resultHTML(){
    const F=doc.found;const cats=CATS.filter(c=>F[c.k].length);const missing=CATS.filter(c=>!F[c.k].length&&c.k!=='altele');
    const total=cats.reduce((s,c)=>s+F[c.k].length,0);
    const risky=cats.reduce((s,c)=>s+F[c.k].filter(f=>f.risks.length).length,0);
    const low=doc.photoPages?doc.photoPages.filter(p=>p.conf!=null&&p.conf<62).map(p=>p.n):[];
    return `<div class="panel ct-file">${ico(doc.photo?'image':'file',26)}<div style="flex:1;min-width:0"><b>${esc(doc.name)}</b><div class="muted" style="font-size:14px">${doc.demo?lbl('demo','Document fictiv')+' ':''}${doc.photo==='local'?lbl('doc','Text recunoscut din poze, pe dispozitiv')+' ':doc.photo==='ai'?lbl('chk','Text transcris de asistentul AI')+' ':''}${plural(doc.pages.length,'pagină','pagini')} · ${plural(doc.ps.length,'pasaj','pasaje')}${doc.truncatedPages?' · am citit primele 120 de pagini':''}</div></div>
        ${App.AI.available()?`<button class="pill solid" type="button" id="ctAsk">${ico('ai',18)}Explică cu asistentul</button>`:''}<button class="pill" type="button" id="ctClose">Închide documentul</button></div>
      <div id="ctConsent"></div>
      ${doc.photo?`<div class="note">${lbl('chk')} Textul vine din poze, deci poate avea greșeli de citire${low.length?`, mai ales pe ${low.length===1?'pagina':'paginile'} ${low.join(', ')} (poză neclară)`:''}. Înainte să te bazezi pe o cifră, apasă „Vezi în document” și verific-o pe poză.</div>`:''}
      <div class="ct-layout"><div class="stack-gap">
        <div class="note">${lbl('doc')} Am găsit <b>${total}</b> ${total===1?'pasaj relevant':'pasaje relevante'} în ${cats.length} categorii${risky?`, dintre care <b>${risky}</b> ${risky===1?'merită':'merită'} verificate cu atenție`:''}. Fiecare constatare are textul exact din contract. Explicațiile spun ce înseamnă tipul de clauză, nu interpretează contractul în locul tău.</div>
        ${cats.map(c=>`<section class="find-group"><h3>${esc(c.t)} <span class="muted">(${F[c.k].length})</span></h3>${F[c.k].map(findingHTML).join('')}</section>`).join('')}
        ${missing.length?`<div class="missing"><b>${lbl('chk')} Nu am găsit mențiuni despre:</b><ul>${missing.map(c=>`<li>${esc(c.t)}</li>`).join('')}</ul><p class="muted" style="font-size:14px;margin:6px 0 0">Poate apar în anexe, în tabele pe care nu le-am putut citi sau sub alte cuvinte. Întreabă creditorul.</p></div>`:''}
      </div>
      <section class="panel docview" aria-label="Documentul"><header><b>${doc.photo?'Pozele documentului':'Textul documentului'}</b><span class="muted" style="font-size:13px">pasajele găsite sunt marcate</span></header><div class="doc-text" id="ctText">${doc.photo?photoDocHTML():docHTML()}</div></section></div>`;
  }
  function docHTML(){
    const hit=new Map();for(const arr of Object.values(doc.found))for(const f of arr){const h=hit.get(f.id)||{risk:false};h.risk=h.risk||f.risks.length>0;hit.set(f.id,h)}
    let pg=0,out='';
    for(const p of doc.ps){if(p.page!==pg){pg=p.page;out+=`<div class="pg">Pagina ${pg}</div>`}const h=hit.get(p.id);out+=`<p id="p-${p.id}">${h?`<mark id="mk-${p.id}" class="${h.risk?'risk':''}">${esc(p.text)}</mark>`:esc(p.text)}</p>`}
    return out||'<p>Documentul nu conține text.</p>';
  }
  function photoDocHTML(){
    const hit=new Map();for(const arr of Object.values(doc.found))for(const f of arr){const h=hit.get(f.id)||{risk:false};h.risk=h.risk||f.risks.length>0;hit.set(f.id,h)}
    let out='';
    for(const pg of doc.photoPages){
      const ps=doc.ps.filter(p=>p.page===pg.n);
      const boxes=doc.photo==='local'?ps.filter(p=>hit.has(p.id)&&p.boxes).map(p=>p.boxes.map((b,j)=>`<span class="pbox${hit.get(p.id).risk?' risk':''}" ${j?`data-pbox="${p.id}"`:`id="mk-${p.id}" data-pbox="${p.id}"`} style="left:${(b.x0/pg.w*100).toFixed(2)}%;top:${(b.y0/pg.h*100).toFixed(2)}%;width:${((b.x1-b.x0)/pg.w*100).toFixed(2)}%;height:${((b.y1-b.y0)/pg.h*100).toFixed(2)}%"></span>`).join('')).join(''):'';
      out+=`<div class="pg" id="pg-${pg.n}">Pagina ${pg.n}</div><div class="photo-page" style="aspect-ratio:${pg.w}/${pg.h}"><img src="${pg.img}" alt="Pagina ${pg.n} a contractului" loading="lazy">${boxes}</div>
        <details class="ocr-text"${doc.photo==='ai'?' open':''}><summary>${doc.photo==='ai'?'Textul transcris':'Textul recunoscut'} (pagina ${pg.n})</summary>${ps.map(p=>{const h=hit.get(p.id);return `<p id="p-${p.id}">${h?`<mark ${doc.photo==='ai'?`id="mk-${p.id}"`:''} class="${h.risk?'risk':''}">${esc(p.text)}</mark>`:esc(p.text)}</p>`}).join('')||'<p class="muted">Nu am găsit text pe această pagină.</p>'}</details>`;
    }
    return out;
  }
  function photoFailHTML(){
    const can=App.AI.available()&&App.AI.canImages();
    return `<div class="panel ct-file">${ico('image',26)}<div style="flex:1"><b>${esc(doc.name)}</b></div><button class="pill" type="button" id="ctPhBack">Înapoi la poze</button></div>
      <div class="panel empty"><h2>${doc.aiErr?'Asistentul nu a putut citi pozele':'Nu pot citi pozele direct în acest browser'}</h2>
      <p>${doc.aiErr?esc(doc.aiErr):'Recunoașterea textului nu poate porni aici.'} ${can?'Pot trimite pozele asistentului AI doar ca să transcrie textul, cuvânt cu cuvânt. Analiza o fac apoi aici, ca la un PDF, iar fiecare pasaj îl verifici pe poză.':'Încarcă varianta PDF sau DOCX a contractului (de exemplu cea primită pe e-mail de la bancă).'}</p>
      ${can?`<div id="ctPhConsent"><button class="pill solid" type="button" id="ctPhAsk">Trimite pozele asistentului</button></div>`:''}</div>`;
  }
  function render(){
    const host=$('#pane-contracte-analizeaza');
    if(busy){host.innerHTML=`<div class="panel empty"><span class="thinking"><i></i><i></i><i></i></span><h2 id="ctBusyMsg">${esc(busyMsg||'Citesc documentul…')}</h2><p id="ctBusySub">${esc(busySub||'Pentru un PDF mare poate dura câteva secunde.')}</p></div>`;return}
    if(doc&&doc.photoFail){host.innerHTML=photoFailHTML();return}
    if(!doc&&photos.length){host.innerHTML=trayHTML();return}
    if(!doc){host.innerHTML=dropHTML();bindDrop();return}
    if(doc.scanned){host.innerHTML=`<div class="panel ct-file">${ico('file',26)}<div style="flex:1"><b>${esc(doc.name)}</b><div class="muted" style="font-size:14px">${plural(doc.numPages||doc.pages.length,'pagină','pagini')}</div></div><button class="pill" type="button" id="ctClose">Închide documentul</button></div>
      <div class="panel empty"><h2>PDF-ul pare scanat</h2><p>Nu conține text pe care să-l pot citi, doar imagini. Analizorul local caută cuvinte în text, deci nu poate lucra cu el. Încarcă o variantă cu text (de exemplu PDF-ul primit pe e-mail de la bancă) sau un document DOCX.</p>${App.AI.available()&&App.AI.canImages()?`<p class="muted">Poți trimite asistentului AI imaginile primelor pagini, dacă vrei. Le trimit doar după ce confirmi.</p><button class="pill" type="button" id="ctImgs">Trimite primele pagini asistentului</button>`:''}</div>`;return}
    host.innerHTML=resultHTML();
  }
  function bindDrop(){
    const d=$('#ctDrop');if(!d)return;
    d.addEventListener('dragover',e=>{e.preventDefault();d.classList.add('over')});
    d.addEventListener('dragleave',()=>d.classList.remove('over'));
    d.addEventListener('drop',e=>{e.preventDefault();d.classList.remove('over');const fs=[...(e.dataTransfer?.files||[])];if(!fs.length)return;if(fs.some(isImg)){addPhotos(fs);return}open(fs[0])});
    d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#ctFile').click()}});
    d.tabIndex=0;d.setAttribute('role','button');
  }
  async function open(f){
    busy=true;busyMsg='Citesc documentul…';busySub='Pentru un PDF mare poate dura câteva secunde.';render();
    try{const r=await readFile(f);setDoc(r)}
    catch(e){busy=false;doc=null;render();const er=$('#ctErr');if(er){er.textContent=e.message||'Documentul nu a putut fi citit.';er.hidden=false}return}
  }
  function setDoc(r,ps0){
    busy=false;const ps=ps0||passages(r.pages);
    doc={...r,ps,found:analyze(ps)};
    if(!doc.scanned&&!doc.photo&&!ps.length)doc.scanned=true;
    consent=null;render();
    toast(doc.demo?'Am încărcat contractul demonstrativ.':doc.photo==='ai'?'Asistentul a transcris pozele; analiza am făcut-o aici.':doc.photo?'Am citit pozele pe dispozitiv. Nimic nu a fost trimis.':'Am citit documentul. Nimic nu a fost trimis.');
  }
  function closeDoc(){if(doc?.photoPages)for(const p of doc.photoPages)URL.revokeObjectURL(p.img);doc=null;consent=null;clearPhotos()}
  function see(id){
    const el=$('#mk-'+id)||$('#p-'+id);if(!el)return;
    const box=$('#ctText');
    const det=el.closest('details');if(det&&!det.open)det.open=true;
    const wide=matchMedia('(min-width:1001px)').matches;
    if(wide){const top=el.getBoundingClientRect().top-box.getBoundingClientRect().top+box.scrollTop-Math.min(120,box.clientHeight*.25);box.scrollTo({top,behavior:calm()?'auto':'smooth'})}
    else el.scrollIntoView({block:'center',behavior:calm()?'auto':'smooth'});
    $$('#ctText .focus').forEach(m=>m.classList.remove('focus'));
    const group=el.dataset.pbox?$$(`[data-pbox="${el.dataset.pbox}"]`):[el];
    if(el.tagName==='MARK'||el.dataset.pbox){group.forEach(g=>g.classList.add('focus'));setTimeout(()=>group.forEach(g=>g.classList.remove('focus')),2600)}
  }
  function selected(){const out=[];const seen=new Set();for(const c of CATS)for(const f of doc.found[c.k])if(!seen.has(f.id)){seen.add(f.id);out.push({id:f.id,page:f.page,cat:c.t,text:f.text})}return out.slice(0,40)}
  function consentHTML(){
    const s=selected();const chars=s.reduce((a,p)=>a+p.text.length,0);
    return `<div class="note consent" role="alertdialog" aria-label="Confirmă trimiterea"><p><b>Trimit asistentului doar ${plural(s.length,'pasaj','pasaje')} găsite (${fmt0(chars)} caractere), nu documentul întreg.</b> Le folosește ca să explice clauzele și trebuie să citeze pasajul pentru fiecare explicație.</p><div class="row"><button class="pill sm white" type="button" id="ctSend">Trimite pasajele</button><button class="pill sm" type="button" id="ctCancel">Renunță</button></div></div>`;
  }
  function guideHTML(){
    return `<div class="guide"><article class="panel">
      <h2 id="g-ct-1">Ce face analizorul</h2><p>Citește textul contractului direct în browser și caută pasajele despre dobândă, DAE, comisioane, penalități, asigurări, rambursare anticipată, schimbarea condițiilor, garanții și reziliere. Pentru fiecare pasaj găsit vezi textul exact, pagina și sumele sau procentele din el.</p>
      <h2 id="g-ct-5">Poze din galerie sau de la cameră</h2><p>Dacă ai contractul pe hârtie, fă câte o poză fiecărei pagini (sau alege-le din galerie). Textul îl recunosc direct pe dispozitivul tău, fără să trimit pozele nicăieri. Rezultatele au aceleași categorii ca la PDF, iar „Vezi în document” îți arată pasajul încadrat chiar pe poză. Dacă browserul nu poate rula recunoașterea textului, îți propun, doar cu acordul tău, să trimiți pozele asistentului AI numai pentru transcriere.</p>
      <h2 id="g-ct-2">Ce nu face</h2><ul><li>Nu inventează condiții: dacă o clauză nu apare în text, o trec la „Nu am găsit”.</li><li>Textul din poze poate avea greșeli de citire. Verifică cifrele importante pe poză.</li><li>Nu dă sfaturi juridice. Explicațiile arată ce înseamnă tipul de clauză și ce să verifici.</li></ul>
      <h2 id="g-ct-3">Lista de verificat înainte să semnezi</h2><ol><li>Dobânda e fixă sau variabilă? Dacă e variabilă, de ce depinde și cât de des se schimbă?</li><li>DAE din contract e aceeași cu cea din oferta primită?</li><li>Ce comisioane plătești o dată și ce plătești lunar?</li><li>Asigurarea e obligatorie? Cât costă și o poți alege tu?</li><li>Cât costă întârzierea unei rate și din ce sumă se calculează penalitatea?</li><li>Poți rambursa mai devreme? Cu ce comision?</li><li>Ce garanții dai (bunuri, fidejusori)?</li><li>În ce situații banca poate cere toată suma înainte de termen?</li><li>Banca poate schimba singură condițiile? Cum ești anunțat și ce poți face atunci?</li></ol>
      <h2 id="g-ct-4">Confidențialitate</h2><p>Documentul și pozele nu se salvează în cont și nu se trimit nicăieri. Dacă ceri o explicație de la asistentul AI, îi trimit doar pasajele găsite, după ce confirmi, iar asistentul trebuie să citeze pasajul pentru fiecare explicație. Când închizi documentul sau reîncarci pagina, textul dispare.</p>
    </article><aside class="panel"><h3>În acest ghid</h3><nav class="toc">${[['g-ct-1','Ce face analizorul'],['g-ct-5','Poze'],['g-ct-2','Ce nu face'],['g-ct-3','Lista de verificat'],['g-ct-4','Confidențialitate']].map(([id,l])=>`<button type="button" data-jump="${id}">${l}</button>`).join('')}</nav><button class="pill solid" type="button" data-goto="contracte">Analizează un contract</button></aside></div>`;
  }
  function build(){
    $('#pane-contracte-ghid').innerHTML=guideHTML();
    // file pickers live outside the re-rendered pane, so they survive every render
    $('#v-contracte').insertAdjacentHTML('beforeend',`<input type="file" id="ctFile" accept=".pdf,.docx,.txt,.md,application/pdf,image/*" multiple hidden><input type="file" id="ctPhotos" accept="image/*" multiple hidden><input type="file" id="ctCam" accept="image/*" capture="environment" hidden>`);
    $('#act-contracte').innerHTML=`<span class="lbl doc">${ico('shield',14)} Rămâne în browser</span>`;
    const v=$('#v-contracte');
    v.addEventListener('change',e=>{
      const t=e.target;if(!['ctFile','ctPhotos','ctCam','ctMoreIn'].includes(t.id))return;
      const fs=[...(t.files||[])];t.value='';if(!fs.length)return;
      if(t.id!=='ctFile'||fs.some(isImg)){if(!addPhotos(fs))toast('Alege poze (JPG, PNG).');return}
      open(fs[0]);
    });
    v.addEventListener('click',async e=>{
      const t=e.target;
      if(t.closest('#ctDemo')){clearPhotos();setDoc(clone(DEMO));return}
      if(t.closest('#ctPickPhotos')){$('#ctPhotos').click();return}
      if(t.closest('#ctPickCam')){$('#ctCam').click();return}
      if(t.closest('#ctMore')){$('#ctPhotos').click();return}
      const pr=t.closest('[data-ph-rot]');if(pr){const p=photos[+pr.dataset.phRot];p.rot=(p.rot+90)%360;render();$(`[data-ph-rot="${pr.dataset.phRot}"]`)?.focus();return}
      const pl=t.closest('[data-ph-left]');if(pl){const i=+pl.dataset.phLeft;[photos[i-1],photos[i]]=[photos[i],photos[i-1]];render();return}
      const pm=t.closest('[data-ph-rm]');if(pm){const i=+pm.dataset.phRm;URL.revokeObjectURL(photos[i].url);photos.splice(i,1);render();toast(`Am scos pagina ${i+1}.`);return}
      if(t.closest('#ctPhClear')){clearPhotos();render();return}
      if(t.closest('#ctRead')){readPhotos();return}
      if(t.closest('#ctPhBack')){if(doc?.photoPages)for(const p of doc.photoPages)URL.revokeObjectURL(p.img);doc=null;render();return}
      if(t.closest('#ctPhAsk')){$('#ctPhConsent').innerHTML=`<div class="note consent" role="alertdialog" aria-label="Confirmă trimiterea"><p><b>Trimit asistentului ${plural(photos.length,'poză','poze')} ca să transcrie textul.</b> Îi cer doar transcrierea, fără interpretări; analiza o fac apoi aici.</p><div class="row"><button class="pill sm white" type="button" id="ctPhSend">Trimite pozele</button><button class="pill sm" type="button" id="ctPhNo">Renunță</button></div></div>`;$('#ctPhSend')?.focus();return}
      if(t.closest('#ctPhNo')){$('#ctPhConsent').innerHTML='<button class="pill solid" type="button" id="ctPhAsk">Trimite pozele asistentului</button>';return}
      if(t.closest('#ctPhSend')){readWithAssistant();return}
      const cl=t.closest('#ctClose');if(cl){closeDoc();render();toast('Am închis documentul. Textul și pozele nu mai sunt în pagină.');return}
      const s=t.closest('[data-see]');if(s){see(s.dataset.see);return}
      if(t.closest('#ctAsk')){$('#ctConsent').innerHTML=consentHTML();$('#ctSend')?.focus();return}
      if(t.closest('#ctCancel')){$('#ctConsent').innerHTML='';return}
      if(t.closest('#ctSend')){const sel=selected();$('#ctConsent').innerHTML='';App.AI.explainPassages({name:doc.name,demo:!!doc.demo,photo:doc.photo||null,passages:sel});return}
      if(t.closest('#ctImgs')){
        const b=t.closest('#ctImgs');if(!armConfirm(b,'Confirm: trimite imaginile primelor pagini'))return;
        try{const imgs=[];const N=Math.min(doc.pdf.numPages,App.AI.maxImages());for(let p=1;p<=N;p++){const pg=await doc.pdf.getPage(p);const vp=pg.getViewport({scale:1.6});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;imgs.push(await new Promise(r=>c.toBlob(r,'image/jpeg',.85)))}App.AI.explainImages({name:doc.name,images:imgs})}catch(err){toast('Nu am putut pregăti imaginile.')}
      }
    });
    built=true;
  }
  return{
    init(){},
    show(sub){if(!built)build();if(sub==='analizeaza')render()},
    see,
    has:()=>!!doc&&!doc.scanned&&!doc.photoFail,
    passageIds:()=>doc?new Set(doc.ps.map(p=>p.id)):new Set(),
    _test:{passages,photoPassages,analyze,values,DEMO,OCR}
  };
})();
App.mods.contracte=Contracts;
