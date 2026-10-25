/* =====================================================================
   CORE — helpers, storage, settings, background, logo, router
   ===================================================================== */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const OS_REDUCED=matchMedia('(prefers-reduced-motion: reduce)');
let calmPref=false;
const calm=()=>OS_REDUCED.matches||calmPref;
/* how much the home hero (logo, hand, coin) may move:
   'none'   — the visitor turned animations off in EcoFin's settings (everything still);
   'gentle' — the system asks for reduced motion: soft fades, a short rise, a slow coin, no big moves;
   'full'   — the complete sequence. */
const heroMotion=()=>calmPref?'none':OS_REDUCED.matches?'gentle':'full';
function applyCalm(){document.documentElement.classList.toggle('calm',calm());document.documentElement.classList.toggle('gentle',heroMotion()==='gentle')}
OS_REDUCED.addEventListener?.('change',()=>{applyCalm();App.emit('calm')});
const now=new Date();
const pad=n=>String(n).padStart(2,'0');
const r2=FinCalc.r2;
const NF0=new Intl.NumberFormat('ro-RO',{maximumFractionDigits:0});
const NF2=new Intl.NumberFormat('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2});
const G=s=>s.replace(/\./g,' ');
const fmt=n=>{n=r2(n);return G(Number.isInteger(n)?NF0.format(n):NF2.format(n))};
const fmt0=n=>G(NF0.format(Math.round(+n||0)));
const fmt2=n=>G(NF2.format(r2(n)));
const lei=n=>fmt(n)+' lei';
const lei0=n=>fmt0(n)+' lei';
const signed=n=>(n<0?'−':'')+lei(Math.abs(n));
const signed0=n=>(n<0?'−':n>0?'+':'')+lei0(Math.abs(n));
const pct=(n,d=2)=>new Intl.NumberFormat('ro-RO',{minimumFractionDigits:d,maximumFractionDigits:d}).format(+n||0)+' %';
const pctS=n=>new Intl.NumberFormat('ro-RO',{maximumFractionDigits:2}).format(+n||0)+' %';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap=s=>{s=String(s||'').trim();return s?s[0].toLocaleUpperCase('ro-RO')+s.slice(1):s};
const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
function compact(n){const a=Math.abs(n),s=n<0?'−':'';const t=v=>String(Math.round(v*10)/10).replace('.',',');if(a>=1e6)return s+t(a/1e6)+'M';if(a>=1e4)return s+Math.round(a/1e3)+'k';if(a>=1e3)return s+t(a/1e3)+'k';return s+fmt(a)}
function parseAmount(s){
  s=String(s??'').replace(/lei|mdl|%/gi,'').replace(/[\s  ]/g,'');
  if(!s)return NaN;
  if(s.includes(',')&&s.includes('.')){s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')}
  else if(s.includes(',')){s=s.replace(',','.')}
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)){s=s.replace(/\./g,'')}
  if(!/^-?\d*\.?\d+$/.test(s))return NaN;
  const n=Number(s);return Number.isFinite(n)?r2(n):NaN;
}
const numIn=v=>String(v??'').replace('.',',');
const MONTHS=['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const MONTHS_L=MONTHS.map(s=>s.toLowerCase());
const MONTHS_S=['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Noi','Dec'];
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const isoOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const dayDiff=FinCalc.dayDiff;
const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return isoOf(d)};
const niceDate=iso=>{if(!iso)return '';const d=new Date(iso+'T12:00:00');return `${d.getDate()} ${MONTHS_L[d.getMonth()]}${d.getFullYear()!==now.getFullYear()?' '+d.getFullYear():''}`};
const dateRO=iso=>{if(!iso)return '';const d=new Date(iso+'T12:00:00');return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`};
const monthsLabel=m=>{const y=Math.floor(m/12),mm=m%12;return (y?`${y} ${y===1?'an':'ani'}`:'')+(y&&mm?' și ':'')+(mm?`${mm} ${mm===1?'lună':'luni'}`:'')};
const plural=(n,one,many)=>`${fmt0(n)} ${Math.abs(n)===1?one:many}`;

/* ---------- labels: where a number comes from ---------- */
const LBL={calc:'Calculat',user:'Introdus de tine',est:'Estimare',hyp:'Ipoteză',chk:'De verificat',doc:'Din document',demo:'Exemplu'};
const lbl=(k,t)=>`<span class="lbl ${k}">${esc(t||LBL[k])}</span>`;

/* ---------- icons ---------- */
const ICON={
  card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
  cal:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  plan:'<path d="M5 20V10M12 20V4M19 20v-7"/><circle cx="5" cy="8" r="2"/><circle cx="12" cy="14" r="2"/><circle cx="19" cy="11" r="2"/>',
  jar:'<path d="M8 3h8M9 3v3C6.5 7 5.5 8.6 5.5 11v7a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3v-7c0-2.4-1-4-3.5-5V3"/><ellipse cx="12" cy="16" rx="3" ry="1.2"/>',
  doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  game:'<rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="17.5" cy="14" r="1"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"/>',
  ai:'<path d="M12 3l1.8 4.6L18.5 9.4l-4.7 1.8L12 16l-1.8-4.8L5.5 9.4l4.7-1.8z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  alert:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.3"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  file:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  shield:'<path d="M12 3l7 3v5c0 4.4-3 8.1-7 9.5C8 19.1 5 15.4 5 11V6z"/><path d="M9 12l2 2 4-4"/>',
  trend:'<path d="M4 18l5-5 4 3 7-8M15 8h5v5"/>',
  env:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 7l9 6 9-6"/>',
  lines:'<path d="M5 12h14M5 7h14M5 17h14"/>',
  ban:'<circle cx="12" cy="12" r="8"/><path d="M8 8l8 8"/>',
  star:'<path d="M12 3.2l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.5l-5.4 2.9 1.2-5.9L3.4 9.4l6-.7z"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  refresh:'<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4v4h-4"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5.5-5 4 3.5 2.5-2 4 3.5"/>',
  rotate:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>'
};
const ico=(k,w=24)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]||''}</svg>`;

/* ---------- toasts, inline confirmation, confetti ---------- */
function toast(msg,{action,onAction,ms=3200}={}){
  const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');
  const s=document.createElement('span');s.textContent=msg;t.append(s);
  let gone=false;
  const kill=()=>{if(gone)return;gone=true;if(calm()){t.remove();return}t.animate([{opacity:1},{opacity:0,transform:'translateY(10px)'}],{duration:260}).finished.then(()=>t.remove(),()=>t.remove())};
  if(action){const b=document.createElement('button');b.type='button';b.textContent=action;b.addEventListener('click',()=>{try{onAction?.()}finally{kill()}});t.append(b);ms=Math.max(ms,7000)}
  const box=$('#toasts');while(box.children.length>2)box.firstChild.remove();
  box.append(t);setTimeout(kill,ms);return kill;
}
/** First press arms the button ("Sigur?"), second press within a few seconds confirms. */
function armConfirm(btn,label='Sigur? Apasă din nou',ms=4000){
  if(btn.dataset.armed){delete btn.dataset.armed;btn.classList.remove('confirm');if(btn.dataset.orig!=null)btn.innerHTML=btn.dataset.orig;return true}
  btn.dataset.orig=btn.innerHTML;btn.dataset.armed='1';btn.classList.add('confirm');btn.textContent=label;
  clearTimeout(btn._armT);btn._armT=setTimeout(()=>{if(btn.isConnected&&btn.dataset.armed){delete btn.dataset.armed;btn.classList.remove('confirm');btn.innerHTML=btn.dataset.orig}},ms);
  return false;
}
const Confetti=(()=>{
  let ctx,parts=[],raf=0;
  const COLS=['#ffffff','#ffd66b','#ff8fc8','#8fdcff','#6cf2b9','#b89cff','#ff9a76'];
  function burst(x=innerWidth/2,y=innerHeight/3,n=140){
    if(calm())return;
    const cv=$('#confetti');const dpr=Math.min(2,devicePixelRatio||1);cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=4+Math.random()*9;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-6,r:4+Math.random()*6,c:COLS[i%COLS.length],rot:Math.random()*6,vr:(Math.random()-.5)*.4,life:0,coin:Math.random()<.18})}
    if(!raf)loop();
  }
  function loop(){
    raf=requestAnimationFrame(loop);ctx.clearRect(0,0,innerWidth,innerHeight);
    parts=parts.filter(p=>p.life<160&&p.y<innerHeight+40);
    for(const p of parts){p.life++;p.vy+=.28;p.vx*=.985;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.max(0,1-p.life/160);
      if(p.coin){ctx.scale(Math.abs(Math.cos(p.rot*2)),1);ctx.fillStyle='#f6c94e';ctx.beginPath();ctx.arc(0,0,p.r*1.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff3c4';ctx.lineWidth=1.5;ctx.stroke()}
      else{ctx.fillStyle=p.c;ctx.fillRect(-p.r/2,-p.r/4,p.r,p.r/2)}
      ctx.restore()}
    if(!parts.length){cancelAnimationFrame(raf);raf=0;ctx.clearRect(0,0,innerWidth,innerHeight)}
  }
  return{burst};
})();

/* ---------- app registry & tiny event bus ---------- */
const App={sec:null,sub:null,mods:{},subs:{},
  on(ev,f){(this.subs[ev]=this.subs[ev]||[]).push(f)},
  emit(ev,...a){(this.subs[ev]||[]).forEach(f=>{try{f(...a)}catch(e){console.error(e)}})}};

/* ---------- storage: the viewer's private db documents + browser fallback ---------- */
const DOC_RE=/^(\d{4}-\d{2}|goals-\d{4}|credite|plan|borcane|provocare|premii|joc|setari|ai-acces)$/;
const Store=(()=>{
  const LS='ecofin-v1';
  const S={data:{},db:null,uid:null,cacheUid:null,synced:false,state:'loading',user:null,me:null};
  const writing={},dirty={},later={},subs=new Set(),syncSubs=new Set();
  let readyRes;const ready=new Promise(r=>readyRes=r);
  const hasDay=dd=>!!dd&&((dd.exp&&dd.exp.length)||(dd.inc&&dd.inc.length));
  const docHasContent=(k,d)=>{
    if(!d)return false;
    if(/^\d{4}-\d{2}$/.test(k))return !!d.days&&Object.values(d.days).some(hasDay);
    if(k.startsWith('goals-'))return ((d.year||[]).length>0)||Object.values(d.months||{}).some(a=>a&&a.length);
    return true;
  };
  function load(){try{const o=JSON.parse(localStorage.getItem(LS)||'null');if(o&&typeof o==='object'&&o.data&&typeof o.data==='object'){S.data=o.data;S.cacheUid=o.uid||null}}catch(e){}}
  function saveLocal(){try{localStorage.setItem(LS,JSON.stringify({uid:S.uid,data:S.data}))}catch(e){}}
  function setState(s){S.state=s;if(s!=='loading'&&s!=='saving')readyRes();syncSubs.forEach(f=>{try{f(s)}catch(e){console.error(e)}})}
  const anyWriting=()=>Object.values(writing).some(Boolean);
  async function writeDoc(k){
    const ref=S.db.collection('data/users/'+S.uid).doc(k);
    const body=clone(S.data[k]??{});
    try{await ref.set(body)}
    catch(e){if(e&&e.code==='unavailable'){await new Promise(r=>setTimeout(r,600+Math.random()*900));await ref.set(body)}else throw e}
  }
  async function persist(k){
    saveLocal();
    if(!S.db||!S.uid)return;
    if(writing[k]){dirty[k]=true;return}
    writing[k]=true;setState('saving');
    let failed=null;
    try{do{dirty[k]=false;await writeDoc(k)}while(dirty[k])}
    catch(e){failed=e}
    finally{writing[k]=false}
    if(failed){console.warn('db write',failed);if(['invalid_argument','revoked','not_granted','capability_disabled'].includes(failed.code)){S.db=null;setState('local')}else setState(failed.code==='quota_exceeded'?'full':'error')}
    else setState(anyWriting()?'saving':'ok');
  }
  function get(k){return S.data[k]}
  function set(k,v){clearTimeout(later[k]);S.data[k]=v;persist(k)}
  /** Keeps the value at once (and in this browser), writes to the account after a pause in typing. */
  function setLater(k,v,ms=500){S.data[k]=v;saveLocal();clearTimeout(later[k]);later[k]=setTimeout(()=>persist(k),ms)}
  function del(k){delete S.data[k];saveLocal();if(S.db&&S.uid){S.db.collection('data/users/'+S.uid).doc(k).delete().catch(e=>console.warn('db delete',e))}}
  async function init(){
    const c=window.claude;
    if(!c||typeof c.use!=='function'){setState('local');return}
    let db=null,user=null;
    try{[db,user]=await Promise.all([c.use('db'),c.use('user')])}catch(e){}
    S.user=user;
    if(user){try{S.me=await user.me()}catch(e){}}
    syncSubs.forEach(f=>f(S.state));
    const uid=S.me?.id||null;
    if(!db||!uid){setState('local');return}
    if(S.cacheUid&&S.cacheUid!==uid){S.data={};subs.forEach(f=>f(null))}
    S.db=db;S.uid=uid;
    let coll;try{coll=db.collection('data/users/'+uid)}catch(e){S.db=null;setState('local');return}
    coll.onSnapshot(snap=>{
      const seen=new Set(),changed=new Set();
      for(const doc of snap.docs){seen.add(doc.id);if(writing[doc.id]||dirty[doc.id]||later[doc.id]&&S.state==='saving')continue;const d=doc.data();const nv=d?clone(d):{};if(JSON.stringify(S.data[doc.id])!==JSON.stringify(nv)){S.data[doc.id]=nv;changed.add(doc.id)}}
      if(!S.synced&&!snap.metadata.fromCache){
        S.synced=true;
        for(const k of Object.keys(S.data)){if(!seen.has(k)&&DOC_RE.test(k)&&docHasContent(k,S.data[k]))persist(k)}
        if(!anyWriting())setState('ok');
      }
      saveLocal();
      if(changed.size)subs.forEach(f=>{try{f(changed)}catch(e){console.error(e)}});
    },err=>{console.warn('db snapshot',err);setState('error')});
    setTimeout(()=>readyRes(),6000);
  }
  return{S,get,set,setLater,del,init,load,saveLocal,persist,ready,on:f=>subs.add(f),onSync:f=>syncSubs.add(f),hasDay,isDocKey:k=>DOC_RE.test(k)};
})();
const SYNC_TXT={loading:['Se conectează…','wait'],ok:['Salvat în contul tău','ok'],saving:['Se salvează…','wait'],local:['Salvat în acest browser','warn'],error:['Nu s-a putut salva. Încearcă din nou.','err'],full:['Spațiul de salvare e plin','err']};
const syncChip=()=>{const[t,c]=SYNC_TXT[Store.S.state]||SYNC_TXT.loading;return `<span class="sync" data-state="${c}"><i></i><span>${t}</span></span>`};
Store.onSync(s=>{
  const[t,c]=SYNC_TXT[s]||SYNC_TXT.loading;
  $$('.sync').forEach(el=>{el.dataset.state=c;const sp=el.querySelector('span');if(sp)sp.textContent=t});
  const me=Store.S.me;const first=me&&me.name?me.name.trim().split(/\s+/)[0]:'';
  $$('.acct-name').forEach(el=>{el.textContent=first||(me&&me.id?'Contul meu':el.closest('.hero-cta')?'log-in':'Cont')});
  App.emit('sync',s);
});

/* ---------- settings (reduced motion, migrations) ---------- */
const Settings={
  get(){return {calm:false,...(Store.get('setari')||{})}},
  set(patch){const s={...this.get(),...patch};Store.set('setari',s);this.apply();return s},
  apply(){calmPref=!!this.get().calm;applyCalm();App.emit('calm')}
};

/* ---------- background: iridescent silk shader ---------- */
const BG=(()=>{
  const cv=$('#bg');
  let gl=null,prog,uR,uT,uM,raf=0,last=0;const t0=performance.now();
  const mouse=[.5,.5],tm=[.5,.5];
  const VS='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS=`precision highp float;
uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float band(float d,float w){return exp(-d*d/(w*w));}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  float a=r.x/r.y;
  vec2 p=vec2(uv.x*a,uv.y);
  float T=t*.05;
  p+= (m-.5)*vec2(.05,.035);
  p.y+=.018*sin(p.x*3.1+T*2.3)+.012*sin(p.x*7.3-T*3.1);
  p.x+=.02*sin(p.y*2.7+T*1.7);
  float X=p.x/a;
  vec3 deep=vec3(.31,.36,.99),blue=vec3(.33,.52,.99),peri=vec3(.52,.53,.99),vio=vec3(.62,.52,.97),lav=vec3(.82,.71,.98),pink=vec3(.99,.60,.78),peach=vec3(.99,.70,.66),coral=vec3(.97,.40,.36),ice=vec3(.76,.85,.98);
  vec3 col=mix(vio,peri,smoothstep(.0,.9,X));
  col=mix(col,blue,smoothstep(.55,1.,uv.y)*smoothstep(.15,.6,X)*smoothstep(1.,.55,X));
  col=mix(col,deep,smoothstep(.75,1.05,X)*smoothstep(.35,.75,uv.y)*.85);
  col=mix(col,lav,smoothstep(.95,.65,uv.y)*.35);
  float yC=.47+.10*sin(X*3.4+1.2+T*1.1)+.05*sin(X*7.0-T*1.6);
  float dC=p.y-yC;
  col=mix(col,lav,band(dC,.16)*.75);
  col+=vec3(1.)*band(dC-.035,.03)*.14;
  float yP=.58+.07*sin(X*4.2+T*1.4)-.12*X;
  float dP=p.y-yP;
  float wP=smoothstep(1.05,.15,X);
  col=mix(col,mix(pink,peach,smoothstep(.4,0.,X)),band(dP,.075)*wP*.95);
  col+=vec3(1.,.95,.95)*band(dP+.03,.022)*wP*.16;
  float yR=.30+.09*sin(X*3.0+2.4+T*.9)+.04*sin(X*9.-T*2.);
  float dR=p.y-yR;
  float wR=smoothstep(.45,.95,X);
  col=mix(col,mix(pink,coral,smoothstep(.55,.95,X)),band(dR,.11)*wR*.9);
  col+=vec3(1.,.85,.8)*band(dR-.06,.02)*wR*.3;
  float yI=.14+.05*sin(X*5.+T*1.3);
  float dI=p.y-yI;
  col=mix(col,ice,band(dI,.12)*smoothstep(.75,.05,X)*.9);
  col=mix(col,vio,smoothstep(.12,0.,uv.y)*smoothstep(.2,.6,X)*.6);
  float f=sin((p.x*1.3+p.y*2.6)*3.2+T*2.)*.5+.5;
  col+=vec3(.06,.04,.08)*f;
  col+=(h(gl_FragCoord.xy+t)-.5)/255.*2.;
  gl_FragColor=vec4(col,1.);
}`;
  function init(){
    try{gl=cv.getContext('webgl',{antialias:false,alpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'})}catch(e){gl=null}
    if(!gl){cv.style.display='none';return}
    const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn(gl.getShaderInfoLog(s));return null}return s};
    const vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,FS);
    if(!vs||!fs){cv.style.display='none';gl=null;return}
    prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);gl.useProgram(prog);
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    uR=gl.getUniformLocation(prog,'r');uT=gl.getUniformLocation(prog,'t');uM=gl.getUniformLocation(prog,'m');
    resize();addEventListener('resize',resize);
    addEventListener('pointermove',e=>{tm[0]=e.clientX/innerWidth;tm[1]=1-e.clientY/innerHeight},{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else start()});
    App.on('calm',()=>{if(calm()){cancelAnimationFrame(raf);raf=0;draw(performance.now())}else start()});
    draw(performance.now());start();
  }
  function resize(){if(!gl)return;const s=.5;cv.width=Math.max(2,Math.round(innerWidth*s));cv.height=Math.max(2,Math.round(innerHeight*s));gl.viewport(0,0,cv.width,cv.height);draw(performance.now())}
  function draw(t){gl.uniform2f(uR,cv.width,cv.height);gl.uniform1f(uT,(t-t0)/1000);mouse[0]+=(tm[0]-mouse[0])*.04;mouse[1]+=(tm[1]-mouse[1])*.04;gl.uniform2f(uM,mouse[0],mouse[1]);gl.drawArrays(gl.TRIANGLES,0,3)}
  function start(){if(calm()||raf||!gl||document.hidden)return;const loop=t=>{raf=requestAnimationFrame(loop);if(t-last<33)return;last=t;draw(t)};raf=requestAnimationFrame(loop)}
  return{init};
})();

/* ---------- logo: the geometric "ecofin" wordmark ---------- */
const Logo=(()=>{
  const NS='http://www.w3.org/2000/svg';
  const arcD=(cx,cy,R,a0,a1)=>{const p=a=>[cx+R*Math.cos(a*Math.PI/180),cy+R*Math.sin(a*Math.PI/180)];const[x0,y0]=p(a0),[x1,y1]=p(a1);return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${a1-a0>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`};
  // id, kind, geometry, letter anchor, letter index
  const P=[
    ['eTop','arc',[50,50,38,180,360],[50,50],0],['eBot','arc',[50,50,38,35,180],[50,50],0],['eBar','rect',[0,40,100,20],[50,50],0],
    ['cTop','arc',[162,50,38,180,315],[162,50],1],['cBot','arc',[162,50,38,45,180],[162,50],1],
    ['oTop','arc',[274,50,38,180,360],[274,50],2],['oBot','arc',[274,50,38,0,180],[274,50],2],
    ['fStem','rect',[348,-6,24,106],[360,50],3],['fHook','arc',[390,-6,30,180,295],[360,50],3],['fBar','rect',[334,0,64,20],[360,50],3],
    ['iStem','rect',[422,0,24,100],[434,50],4],
    ['nStemL','rect',[458,0,24,100],[508,50],5],['nArch','arc',[508,50,38,180,360],[508,50],5],['nStemR','rect',[534,50,24,50],[508,50],5],
  ];
  // the "pulled apart" composition from the brand video
  const A={eBar:{d:[0,0],s:[0,1],o:0},cTop:{d:[0,-26],o:0},oTop:{d:[0,-30],o:0},fHook:{d:[0,-24],o:0},fBar:{d:[0,0],s:[0,1],o:0},fStem:{d:[0,3],s:[1,.95]},nStemL:{d:[0,25],s:[1,.5]},nStemR:{d:[0,10],s:[1,0],o:0},dot:{c:[592,88]}};
  const B={eTop:{a:[40,12],s:.62},eBot:{a:[40,12],s:.62},fStem:{c:[118,12],s:.62},iStem:{c:[160,12],s:.66},nStemL:{c:[200,12],s:.66},oBot:{c:[262,26],s:.62},nArch:{c:[340,-2],s:.62},cTop:{a:[420,12],s:.62},cBot:{a:[420,12],s:.62},eBar:{c:[40,88],r:90,s:.62},fHook:{c:[104,82],s:.7},oTop:{c:[180,78],r:180,s:.62},fBar:{c:[246,88],r:90,s:.82},nStemR:{c:[290,88],s:[1,1.25]},dot:{c:[470,72],s:3}};
  function build(container){
    const svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','-8 -54 620 160');svg.setAttribute('class','logo');svg.setAttribute('role','img');svg.setAttribute('aria-label','ecofin');
    const defs=document.createElementNS(NS,'defs');const gid='lg'+Math.random().toString(36).slice(2,7);
    defs.innerHTML=`<radialGradient id="${gid}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6d6"/><stop offset=".35" stop-color="#ffb3dc"/><stop offset=".7" stop-color="#ff8a5c"/><stop offset="1" stop-color="#5b6cf6"/></radialGradient>`;
    svg.append(defs);
    const pieces={},letter={};
    for(const[id,kind,g,,li]of P){
      const grp=document.createElementNS(NS,'g');grp.setAttribute('class','pc');let el;
      if(kind==='arc'){el=document.createElementNS(NS,'path');el.setAttribute('d',arcD(...g));el.setAttribute('class','ring')}
      else{el=document.createElementNS(NS,'rect');el.setAttribute('x',g[0]);el.setAttribute('y',g[1]);el.setAttribute('width',g[2]);el.setAttribute('height',g[3]);el.setAttribute('class','bar')}
      grp.append(el);svg.append(grp);pieces[id]=grp;letter[id]=li;
    }
    const dg=document.createElementNS(NS,'g');dg.setAttribute('class','pc');
    dg.innerHTML=`<circle cx="434" cy="-30" r="15" fill="url(#${gid})"/><circle class="dotw" cx="434" cy="-30" r="15" fill="#fff"/>`;
    svg.append(dg);pieces.dot=dg;letter.dot=6;
    container.textContent='';container.append(svg);
    let anims=[];
    function centers(){const out={};for(const[id,,,anc]of P){const b=pieces[id].getBBox();out[id]={c:[b.x+b.width/2,b.y+b.height/2],anc}}out.dot={c:[434,-30],anc:[434,-30]};return out}
    function tf(st,info){
      if(!st)return{transform:'translate(0px,0px) rotate(0deg) scale(1,1)',opacity:1};
      const[cx,cy]=info.c;const r=st.r||0;const s=Array.isArray(st.s)?st.s:[st.s??1,st.s??1];let tx=cx,ty=cy;
      if(st.c){tx=st.c[0];ty=st.c[1]}
      else if(st.a){const rad=r*Math.PI/180,vx=(cx-info.anc[0])*s[0],vy=(cy-info.anc[1])*s[1];tx=st.a[0]+vx*Math.cos(rad)-vy*Math.sin(rad);ty=st.a[1]+vx*Math.sin(rad)+vy*Math.cos(rad)}
      else if(st.d){tx=cx+st.d[0];ty=cy+st.d[1]}
      return{transform:`translate(${(tx-cx).toFixed(2)}px,${(ty-cy).toFixed(2)}px) rotate(${r}deg) scale(${s[0]},${s[1]})`,opacity:st.o??1};
    }
    function stop(){anims.forEach(a=>a.cancel());anims=[]}
    /* light that sweeps across the finished wordmark: a gradient band masked by the letters */
    const mid='lm'+gid,sgid='ls'+gid;
    const mask=document.createElementNS(NS,'mask');mask.setAttribute('id',mid);mask.setAttribute('maskUnits','userSpaceOnUse');
    mask.setAttribute('x','-8');mask.setAttribute('y','-54');mask.setAttribute('width','620');mask.setAttribute('height','160');
    for(const id of Object.keys(pieces)){const c=pieces[id].cloneNode(true);c.removeAttribute('class');c.querySelectorAll('.dotw').forEach(x=>x.remove());c.querySelectorAll('circle').forEach(x=>x.setAttribute('fill','#fff'));mask.append(c)}
    defs.append(mask);
    defs.insertAdjacentHTML('beforeend',`<linearGradient id="${sgid}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ffd6f0" stop-opacity="0"/><stop offset=".3" stop-color="#ffb8e2" stop-opacity=".9"/><stop offset=".5" stop-color="#b9a4ff" stop-opacity="1"/><stop offset=".7" stop-color="#ffcf9e" stop-opacity=".9"/><stop offset="1" stop-color="#ffd6f0" stop-opacity="0"/></linearGradient>`);
    const shineG=document.createElementNS(NS,'g');shineG.setAttribute('mask',`url(#${mid})`);shineG.setAttribute('aria-hidden','true');
    const band=document.createElementNS(NS,'rect');band.setAttribute('x','-150');band.setAttribute('y','-70');band.setAttribute('width','130');band.setAttribute('height','200');band.setAttribute('fill',`url(#${sgid})`);band.setAttribute('opacity','0');
    shineG.append(band);svg.append(shineG);
    function shine(delay=0,dur=1100){
      if(calm())return;
      anims.push(band.animate([{transform:'translateX(0px) skewX(-18deg)',opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.85},{transform:'translateX(800px) skewX(-18deg)',opacity:0}],{duration:dur,delay,easing:'cubic-bezier(.45,.05,.35,1)',fill:'backwards'}));
    }
    /** First visit (about 5 s): geometric pieces pop in as the brand pattern, regroup into
        the pulled-apart letters, lock into the wordmark, the dot hops onto the i, light sweeps across. */
    function reveal({delay=0,gentle=false}={}){
      if(calmPref)return;
      if(OS_REDUCED.matches)gentle=true;
      stop();let info;try{info=centers()}catch(e){return}
      if(gentle){
        // reduced-motion version: the finished wordmark fades in letter by letter, nothing travels
        for(const id of Object.keys(pieces))anims.push(pieces[id].animate([{opacity:0},{opacity:1}],{duration:900,delay:delay+letter[id]*120,easing:'ease-out',fill:'backwards'}));
        return;
      }
      const D=3900;
      const OVER='cubic-bezier(.34,1.45,.64,1)',GLIDE='cubic-bezier(.66,0,.24,1)',POP='cubic-bezier(.2,.9,.3,1.2)';
      for(const id of Object.keys(pieces)){
        if(id==='dot')continue;
        const b=tf(B[id],info[id]),a=tf(A[id],info[id]),R=tf(null);
        const bs=b.transform.replace(/scale\(([^,]+),([^)]+)\)/,(m,x,y)=>`scale(${(+x*.35).toFixed(3)},${(+y*.35).toFixed(3)})`);
        const kf=[
          {transform:bs,opacity:0,offset:0,easing:POP},
          {transform:b.transform,opacity:1,offset:.2,easing:'linear'},
          {transform:b.transform,opacity:1,offset:.38,easing:GLIDE},
          {transform:a.transform,opacity:a.opacity,offset:.62,easing:'linear'},
          {transform:a.transform,opacity:a.opacity,offset:.7,easing:OVER},
          {transform:R.transform,opacity:1,offset:.9,easing:'ease-out'},
          {transform:R.transform,opacity:1,offset:1}
        ];
        anims.push(pieces[id].animate(kf,{duration:D,delay:delay+letter[id]*70,fill:'backwards'}));
      }
      // the dot: big gradient ball in the pattern, rolls to the end of the word, then hops onto the i
      const db=tf(B.dot,info.dot),da=tf(A.dot,info.dot);
      const fin='translate(0px,0px) rotate(0deg) scale(1,1)';
      anims.push(pieces.dot.animate([
        {transform:db.transform.replace(/scale\(([^,]+),([^)]+)\)/,'scale(.4,.4)'),opacity:0,offset:0,easing:POP},
        {transform:db.transform,opacity:1,offset:.2,easing:'linear'},
        {transform:db.transform,offset:.4,easing:GLIDE},
        {transform:da.transform,offset:.64,easing:'linear'},
        {transform:da.transform,offset:.74,easing:'cubic-bezier(.3,0,.7,1)'},
        {transform:'translate(70px,-78px) rotate(0deg) scale(1,1)',offset:.84,easing:'cubic-bezier(.4,0,.9,.6)'},
        {transform:'translate(0px,4px) rotate(0deg) scale(1.18,.82)',offset:.92,easing:'ease-out'},
        {transform:'translate(0px,-6px) rotate(0deg) scale(.96,1.05)',offset:.96,easing:'ease-in-out'},
        {transform:fin,opacity:1,offset:1}
      ],{duration:D+500,delay,fill:'backwards'}));
      anims.push(pieces.dot.querySelector('.dotw').animate([{opacity:0},{opacity:0,offset:.86},{opacity:1}],{duration:D+500,delay,fill:'backwards'}));
      shine(delay+D+380,1150);
    }
    /** Short hover sequence: the letters pull apart and snap back. */
    function pulse(){
      if(calm()||anims.some(a=>a.playState==='running'))return;stop();let info;try{info=centers()}catch(e){return}
      const E='cubic-bezier(.66,0,.24,1)';
      for(const id of Object.keys(pieces)){const R=tf(null),a=tf(A[id],info[id]);anims.push(pieces[id].animate([{...R,offset:0},{...a,offset:.45},{...a,offset:.55},{...R,offset:1}],{duration:1600,easing:E}))}
      anims.push(pieces.dot.querySelector('.dotw').animate([{opacity:1},{opacity:0,offset:.3},{opacity:0,offset:.7},{opacity:1}],{duration:1600}));
    }
    return{svg,reveal,pulse,stop,shine};
  }
  return{build};
})();

/* ---------- three.js, loaded on demand ---------- */
let THREE_P=null;
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
function getThree(){if(!THREE_P)THREE_P=import(THREE_URL).catch(e=>{console.warn('three.js indisponibil',e);return null});return THREE_P}
const T3={
  env(T,renderer){
    const s=new T.Scene();
    s.add(new T.Mesh(new T.BoxGeometry(24,24,24),new T.MeshBasicMaterial({color:new T.Color(.30,.28,.72),side:T.BackSide})));
    const g=new T.BoxGeometry(1,1,1);
    const add=(hex,k,pos,sc)=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({color:new T.Color(hex).multiplyScalar(k)}));m.position.set(...pos);m.scale.set(...sc);s.add(m)};
    add('#ffffff',5,[0,9,3],[12,.2,7]);add('#ff9fd6',3.2,[-9,1,3],[.2,9,7]);add('#86b4ff',3.2,[9,2,1],[.2,9,7]);add('#ffb37a',2.6,[2,-7,5],[9,.2,5]);add('#ffffff',3.2,[0,2,10],[7,5,.2]);add('#b79cff',2.4,[0,3,-10],[10,6,.2]);
    const pm=new T.PMREMGenerator(renderer);const tex=pm.fromScene(s,.03).texture;pm.dispose();return tex;
  },
  texCache:{},
  tex(T,url){
    if(this.texCache[url])return this.texCache[url];
    const t=new T.TextureLoader().load(url);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;t.center.set(.5,.5);t.rotation=Math.PI/2;
    return this.texCache[url]=t;
  },
  edgeTex(T){
    if(this._edge)return this._edge;
    const c=document.createElement('canvas');c.width=256;c.height=8;const x=c.getContext('2d');
    for(let i=0;i<256;i+=4){x.fillStyle=i%8?'#f2f4f8':'#9aa1ad';x.fillRect(i,0,4,8)}
    const t=new T.CanvasTexture(c);t.wrapS=T.RepeatWrapping;t.repeat.set(3,1);t.colorSpace=T.SRGBColorSpace;return this._edge=t;
  },
  coinMats(T){
    if(this._mats)return this._mats;
    const side=new T.MeshStandardMaterial({color:0xe6e8ee,map:this.edgeTex(T),metalness:1,roughness:.3});
    const ft=this.tex(T,'assets/coin-front.png'),bt=this.tex(T,'assets/coin-back.png');
    const top=new T.MeshStandardMaterial({map:ft,emissiveMap:ft,emissive:0xffffff,emissiveIntensity:.32,metalness:.3,roughness:.32,envMapIntensity:1.2});
    const bot=new T.MeshStandardMaterial({map:bt,emissiveMap:bt,emissive:0xffffff,emissiveIntensity:.32,metalness:.3,roughness:.32,envMapIntensity:1.2});
    return this._mats=[side,top,bot];
  },
  coinGeo(T,r=1,th=.13,seg=96){const g=new T.CylinderGeometry(r,r,th,seg,1,false);g.rotateX(Math.PI/2);return g}
};

/* ---------- 3D tilt for glass tiles (desktop pointer only) ---------- */
function bindTilt(root=document){
  if(!matchMedia('(hover:hover)').matches)return;
  $$('[data-tilt]',root).forEach(el=>{
    if(el._tilt)return;el._tilt=1;
    el.addEventListener('pointermove',e=>{if(calm())return;const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;el.style.transform=`perspective(1100px) rotateX(${(-y*6).toFixed(2)}deg) rotateY(${(x*8).toFixed(2)}deg) translateZ(6px)`});
    el.addEventListener('pointerleave',()=>{el.style.transform=''});
  });
}

/* ---------- spotlight guide ---------- */
const Tour=(()=>{
  let steps=[],i=0,onEnd=null;
  const spot=$('#spot'),hole=$('#spotHole'),tip=$('#spotTip');
  function place(){
    const st=steps[i];if(!st)return;
    const el=typeof st.el==='function'?st.el():$(st.el);
    if(!el){next();return}
    const r=el.getBoundingClientRect(),m=8;
    Object.assign(hole.style,{left:(r.left-m)+'px',top:(r.top-m)+'px',width:(r.width+m*2)+'px',height:(r.height+m*2)+'px'});
    const tw=Math.min(350,innerWidth-32),th=tip.offsetHeight||150;
    let top=r.bottom+18;if(top+th>innerHeight-16)top=Math.max(16,r.top-th-18);
    const left=clamp(r.left+r.width/2-tw/2,16,innerWidth-tw-16);
    Object.assign(tip.style,{top:top+'px',left:left+'px'});
  }
  function show(k){
    i=k;const st=steps[i];if(!st){end();return}
    if(st.before)st.before();
    const el=typeof st.el==='function'?st.el():$(st.el);
    tip.innerHTML=`<div class="eyebrow">Pasul ${i+1} din ${steps.length}</div><p>${st.text}</p><div class="row"><button class="pill sm" type="button" data-t="x">Închide</button>${i?'<button class="pill sm" type="button" data-t="b">Înapoi</button>':''}<button class="pill sm white" type="button" data-t="n">${i===steps.length-1?'Gata':'Următorul'}</button></div>`;
    spot.hidden=false;
    if(el){el.scrollIntoView({block:'center',behavior:calm()?'auto':'smooth'});setTimeout(place,calm()?0:420)}
    place();
    tip.querySelector('[data-t="n"]').focus({preventScroll:true});
  }
  function next(){show(i+1)}
  function end(){spot.hidden=true;steps=[];if(onEnd){const f=onEnd;onEnd=null;f()}}
  tip.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;if(b.dataset.t==='n')next();else if(b.dataset.t==='b')show(i-1);else end()});
  addEventListener('resize',()=>{if(!spot.hidden)place()});
  addEventListener('scroll',()=>{if(!spot.hidden)place()},{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!spot.hidden){end();e.stopPropagation()}},true);
  return{start(s,cb){steps=s.filter(Boolean);onEnd=cb||null;show(0)},end,active:()=>!spot.hidden};
})();

/* ---------- generic modal with focus handling ---------- */
const Modal=(()=>{
  let last=null,onClose=null;
  const el=$('#modal');
  function open({eyebrow='',title='',html='',onclose,size=''}={}){
    if(!el.hidden)close(true);
    last=document.activeElement;onClose=onclose||null;
    el.classList.toggle('narrow',size==='narrow');el.classList.toggle('read',size==='read');
    $('#modalEyebrow').textContent=eyebrow;$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;
    el.hidden=false;$('#modal .modal-box').scrollTop=0;document.documentElement.classList.add('modal-open');
    setTimeout(()=>$('#modalClose').focus({preventScroll:true}),30);
    return $('#modalBody');
  }
  function close(silent){
    if(el.hidden)return;el.hidden=true;document.documentElement.classList.remove('modal-open');
    const f=onClose;onClose=null;$('#modalBody').innerHTML='';f?.();
    if(!silent)last?.focus?.({preventScroll:true});
  }
  el.addEventListener('click',e=>{if(e.target.closest('[data-modal-close]'))close()});
  document.addEventListener('keydown',e=>{
    if(el.hidden)return;
    if(e.key==='Escape'&&!Tour.active()){e.preventDefault();close();return}
    if(e.key==='Tab'){const f=$$('#modal button,#modal [href],#modal input,#modal select,#modal textarea,#modal [tabindex]:not([tabindex="-1"])').filter(x=>!x.disabled&&x.offsetParent!==null);if(!f.length)return;const a=f[0],b=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus()}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus()}}
  });
  return{open,close,isOpen:()=>!el.hidden,body:()=>$('#modalBody')};
})();

/* ---------- charts: shared column chart + tooltip ---------- */
const Charts=(()=>{
  const TIPS=new Map();
  function niceTicks(min,max,count){
    const raw=(max-min||1)/count,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p;
    const step=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;
    const lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step,out=[];
    for(let v=lo;v<=hi+step/2;v+=step)out.push(Math.round(v*1000)/1000);
    return out;
  }
  function barD(x,yb,yt,w){
    const h=Math.abs(yb-yt),r=Math.min(4,w/2,h);
    if(yt<=yb)return`M${x},${yb}V${yt+r}Q${x},${yt} ${x+r},${yt}H${x+w-r}Q${x+w},${yt} ${x+w},${yt+r}V${yb}Z`;
    return`M${x},${yb}V${yt-r}Q${x},${yt} ${x+r},${yt}H${x+w-r}Q${x+w},${yt} ${x+w},${yt-r}V${yb}Z`;
  }
  /** series: [{color, values}] — colors are CSS values; cats: [{tip}] */
  function columns(el,{cats,series,height,labelOf,aria,stacked=false}){
    const W=Math.max(260,Math.floor(el.clientWidth||el.parentElement?.clientWidth||300)),H=height;
    const ml=46,mr=6,mt=10,mb=24,pw=W-ml-mr,ph=H-mt-mb;
    let max=0,min=0;
    if(stacked){cats.forEach((_,i)=>{const s=series.reduce((a,se)=>a+Math.max(0,se.values[i]||0),0);if(s>max)max=s})}
    else for(const s of series)for(const v of s.values){if(v>max)max=v;if(v<min)min=v}
    if(max===0&&min===0)max=100;
    const ticks=niceTicks(min,max,4),lo=ticks[0],hi=ticks[ticks.length-1];
    const y=v=>mt+ph-(v-lo)/(hi-lo)*ph;
    const n=cats.length,band=pw/n,ns=stacked?1:series.length,g=2;
    const bw=Math.max(2,Math.min(26,(band*0.72-g*(ns-1))/ns));
    let grid='',hits='',bars='',xl='';
    for(const t of ticks){const yy=Math.round(y(t))+.5;grid+=`<line x1="${ml}" x2="${W-mr}" y1="${yy}" y2="${yy}" class="${t===0?'axis':'grid'}"/><text x="${ml-8}" y="${yy}" dy=".32em" text-anchor="end" class="tick">${compact(t)}</text>`}
    const key='c'+Math.random().toString(36).slice(2,6);
    cats.forEach((c,i)=>{
      const x0=ml+band*i,cx=x0+band/2,id=key+i;TIPS.set(id,c.tip);
      hits+=`<rect class="hit" x="${x0.toFixed(1)}" y="${mt}" width="${band.toFixed(1)}" height="${ph}" data-tip="${id}"/>`;
      if(stacked){let base=0;const x=cx-bw/2;for(const s of series){const v=Math.max(0,s.values[i]||0);if(v){bars+=`<path d="${barD(+x.toFixed(1),y(base),y(base+v),bw)}" fill="${s.color}"/>`;base+=v}}}
      else{const gw=ns*bw+(ns-1)*g;let x=cx-gw/2;for(const s of series){const v=s.values[i];if(v)bars+=`<path d="${barD(+x.toFixed(1),y(0),y(v),bw)}" fill="${s.color}"/>`;x+=bw+g}}
      const lab=labelOf(i,band);if(lab)xl+=`<text x="${cx.toFixed(1)}" y="${H-6}" text-anchor="middle" class="tick">${lab}</text>`;
    });
    el.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${grid}${hits}<g class="bars">${bars}</g>${xl}</svg>`;
  }
  const tipRow=(color,l,v)=>`<div class="tp-r"><i class="dot" style="background:${color}"></i><span>${esc(l)}</span><b>${v<0?'−':''}${lei(Math.abs(v))}</b></div>`;
  const tipHTML=(title,rows)=>`<div class="tp-t">${esc(title)}</div>`+rows.map(r=>tipRow(...r)).join('');
  const tip=$('#tip');
  function showTip(e){
    const h=e.target.closest?.('[data-tip]');
    if(!h||!TIPS.has(h.dataset.tip)){tip.hidden=true;return}
    tip.innerHTML=TIPS.get(h.dataset.tip)||'';tip.hidden=false;
    const w=tip.offsetWidth,ht=tip.offsetHeight;
    let x=e.clientX+14,yy=e.clientY-ht-12;
    if(x+w>innerWidth-8)x=e.clientX-w-14;if(x<8)x=8;if(yy<8)yy=e.clientY+18;
    tip.style.left=x+'px';tip.style.top=yy+'px';
  }
  document.addEventListener('pointermove',showTip,{passive:true});
  document.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')showTip(e)});
  addEventListener('scroll',()=>{tip.hidden=true},{passive:true});
  return{columns,niceTicks,tipHTML,hideTip:()=>{tip.hidden=true}};
})();

/* ---------- faces for the jar moods ---------- */
function faceSVG(mood,size=40){
  const ink='#2c2384';let eyes,mouth,extra='';
  const dots='<circle cx="15" cy="18" r="2.6" fill="'+ink+'"/><circle cx="29" cy="18" r="2.6" fill="'+ink+'"/>';
  switch(mood){
    case 'ecstatic':eyes=`<path d="M11 19q4-6 8 0M25 19q4-6 8 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;mouth=`<path d="M12 25q10 12 20 0z" fill="${ink}"/><path d="M17 30q5 3 10 0" fill="#ff8fb3"/>`;extra='<circle cx="9" cy="24" r="3" fill="#ffb3cf" opacity=".8"/><circle cx="35" cy="24" r="3" fill="#ffb3cf" opacity=".8"/>';break;
    case 'happy':eyes=dots;mouth=`<path d="M13 25q9 9 18 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;extra='<circle cx="9" cy="24" r="2.6" fill="#ffb3cf" opacity=".7"/><circle cx="35" cy="24" r="2.6" fill="#ffb3cf" opacity=".7"/>';break;
    case 'ok':eyes=dots;mouth=`<path d="M15 28q7 3 14 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;break;
    case 'sad':eyes=dots+`<path d="M11 12l6 2M33 12l-6 2" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;mouth=`<path d="M14 31q8-7 16 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;break;
    case 'dramatic':eyes=`<path d="M11 15l7 4M33 15l-7 4" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;mouth=`<path d="M13 31q3-4 6 0t6 0 6 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;extra=`<path d="M14 22q-2.4 4 0 5.5 2.4-1.5 0-5.5z" fill="#8fdcff"/>`;break;
    default:eyes=`<path d="M11 19h7M26 19h7" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;mouth=`<circle cx="22" cy="29" r="2.6" fill="none" stroke="${ink}" stroke-width="2"/>`;extra=`<text x="33" y="10" font-size="9" font-weight="700" fill="${ink}" font-family="Comfortaa,sans-serif">z</text><text x="38" y="5" font-size="7" font-weight="700" fill="${ink}" font-family="Comfortaa,sans-serif">z</text>`;
  }
  return `<svg class="mood-face" viewBox="0 0 44 44" width="${size}" height="${size}" aria-hidden="true"><circle cx="22" cy="22" r="20" fill="#fff"/><circle cx="22" cy="22" r="20" fill="none" stroke="rgba(44,35,132,.18)" stroke-width="1.5"/>${extra}${eyes}${mouth}</svg>`;
}

/* ---------- sections & router ---------- */
const SECTIONS=[
  {id:'credite',label:'Credite',icon:'card',eyebrow:'Calculator de credite',title:'Compară ofertele de credit',subs:[['compara','Compară'],['ghid','Ghid']],
    blurb:'Pune ofertele una lângă alta și vezi de ce una e mai ieftină.'},
  {id:'contabilitate',label:'Contabilitate',icon:'cal',eyebrow:'Contabilitate personală',title:'Unde se duc banii',subs:[['calendar','Calendar'],['buget','Buget'],['analiza','Analiză'],['ghid','Ghid']],
    blurb:'Notează cheltuielile și vezi cât îți rămâne după esențiale și rate.'},
  {id:'planificator',label:'Planificator',icon:'plan',eyebrow:'Planificator financiar lunar',title:'Planul lunii',subs:[['lunar','Plan lunar'],['neprevazute','Neprevăzute'],['ghid','Ghid']],
    blurb:'Planifică luna, vezi cât poți economisi și ce faci dacă apare o cheltuială neprevăzută.'},
  {id:'economii',label:'Economii',icon:'jar',eyebrow:'Borcanul de economii',title:'Strânge bani, monedă cu monedă',subs:[['borcane','Borcane'],['provocari','Provocări'],['recompense','Recompense'],['ghid','Ghid']],
    blurb:'Borcane care se umplu, provocări de 30, 60 sau 100 de zile și insigne.'},
  {id:'contracte',label:'Contracte',icon:'doc',eyebrow:'Analizor de contracte',title:'Citește contractul înainte să semnezi',subs:[['analizeaza','Analizează'],['ghid','Ghid']],
    blurb:'Încarci contractul PDF și vezi dobânda, comisioanele și penalitățile, cu pasajul din document.'},
  {id:'educatie',label:'Educație',icon:'game',eyebrow:'Educație financiară prin joc',title:'Învață jucându-te',subs:[['joc','Joacă'],['ghid','Ghid']],
    blurb:'Alegi între două credite, găsești oferta înșelătoare sau gestionezi bugetul unei luni.'},
  {id:'cont',label:'Cont',icon:'user',eyebrow:'Cont',title:'Contul tău EcoFin',subs:[['date','Date și setări']],nav:false,
    blurb:'Unde se salvează datele, setări și copie de siguranță.'}
];
const SEC=Object.fromEntries(SECTIONS.map(s=>[s.id,s]));
const Router=(()=>{
  function build(){
    const main=$('#main');
    for(const s of SECTIONS){
      const v=document.createElement('section');v.className='view';v.id='v-'+s.id;v.hidden=true;v.setAttribute('aria-labelledby','h-'+s.id);
      v.innerHTML=`<div class="page">
        <header class="page-head"><div><div class="eyebrow">${esc(s.eyebrow)}</div><h1 id="h-${s.id}" tabindex="-1">${esc(s.title)}</h1></div><div class="row head-actions" id="act-${s.id}"></div></header>
        ${s.subs.length>1?`<div class="subnav-wrap"><nav class="subnav" id="sub-${s.id}" aria-label="Meniul secțiunii ${esc(s.label)}">${s.subs.map(([k,l])=>`<button type="button" data-sub="${k}">${esc(l)}</button>`).join('')}</nav><div class="row" id="subx-${s.id}"></div></div>`:''}
        ${s.subs.map(([k])=>`<div class="pane-host" id="pane-${s.id}-${k}" hidden></div>`).join('')}
      </div>`;
      main.append(v);
    }
    $('#mainNav').innerHTML=SECTIONS.filter(s=>s.nav!==false).map(s=>`<a class="pill" href="#${s.id}" data-nav="${s.id}">${esc(s.label)}</a>`).join('');
    $('#toolGrid').innerHTML=SECTIONS.filter(s=>s.nav!==false).map((s,k)=>`<a class="tool panel${k===0?' first':''}" href="#${s.id}" data-tilt><span class="ico">${ico(s.icon)}</span><h3>${esc(s.eyebrow)}</h3><p>${esc(s.blurb)}</p></a>`).join('');
    $('#sheetGrid').innerHTML=[...['planificator','contracte','educatie'].map(id=>`<button type="button" data-go="${id}">${ico(SEC[id].icon)}${esc(SEC[id].label)}</button>`),`<button type="button" data-ai-open>${ico('ai')}Asistent AI</button>`,`<button type="button" data-go="cont">${ico('user')}Cont</button>`].join('');
    $$('.subnav').forEach(n=>n.addEventListener('click',e=>{const b=e.target.closest('[data-sub]');if(b)go(n.id.slice(4),b.dataset.sub)}));
    $('#tabbar').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(!b)return;if(b.dataset.go==='more')openSheet();else go(b.dataset.go)});
    $('#sheet').addEventListener('click',e=>{if(e.target.closest('[data-sheet-close]')){closeSheet();return}const b=e.target.closest('[data-go]');if(b){closeSheet();go(b.dataset.go)}else if(e.target.closest('[data-ai-open]'))closeSheet()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#sheet').hidden)closeSheet()});
    addEventListener('hashchange',route);
    addEventListener('scroll',()=>{if(App.sec==='acasa')updateTopbar()},{passive:true});
    $('#skip').addEventListener('click',()=>{const h=App.sec&&App.sec!=='acasa'?$('#h-'+App.sec):$('#main');h?.focus()});
  }
  function openSheet(){$('#sheet').hidden=false;setTimeout(()=>$('#sheetGrid button')?.focus({preventScroll:true}),40)}
  function closeSheet(){$('#sheet').hidden=true}
  function parse(h){
    h=String(h||'').replace(/^#/,'');
    let [sec,sub]=h.split('-');
    if(sec==='borcan')sec='economii'; // link-uri din prima versiune
    if(!SEC[sec])return{sec:'acasa',sub:null};
    const subs=SEC[sec].subs.map(x=>x[0]);
    return{sec,sub:subs.includes(sub)?sub:subs[0]};
  }
  function hashFor(sec,sub){if(sec==='acasa')return'acasa';const d=SEC[sec]?.subs[0][0];return !sub||sub===d?sec:`${sec}-${sub}`}
  function go(sec,sub){const h=hashFor(sec,sub);if(location.hash.replace('#','')===h)show(parse(h));else location.hash=h}
  function route(){show(parse(location.hash))}
  let first=true;
  function show({sec,sub}){
    const prevSec=App.sec,prevSub=App.sub;
    if(sec===prevSec&&sub===prevSub)return;
    App.sec=sec;App.sub=sub;
    if(sec!==prevSec){
      if(prevSec)App.mods[prevSec]?.hide?.();
      Modal.close(true);Charts.hideTip();$('#backdrop').hidden=true;
      document.documentElement.classList.toggle('inner',sec!=='acasa');
      $$('[data-nav]').forEach(a=>{const on=a.dataset.nav===sec;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
      const tab=['acasa','credite','contabilitate','economii'].includes(sec)?sec:'more';
      $$('#tabbar [data-go]').forEach(b=>{const on=b.dataset.go===tab;b.classList.toggle('on',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
      $$('.view').forEach(v=>{v.hidden=v.id!=='v-'+sec});
      window.scrollTo(0,0);
      const view=$('#v-'+sec);
      if(!first&&!calm())view.animate([{opacity:.55,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:260,easing:'ease-out'});
      if(!first&&sec!=='acasa')$('#h-'+sec)?.focus({preventScroll:true});
      updateTopbar();
      App.emit('route',sec,sub);
    }
    if(sec!=='acasa'){
      const s=SEC[sec];
      for(const[k]of s.subs){const p=$(`#pane-${sec}-${k}`);const on=k===sub;if(p.hidden===on){p.hidden=!on;if(on){p.classList.remove('pane');void p.offsetWidth;p.classList.add('pane')}}}
      $$(`#sub-${sec} [data-sub]`).forEach(b=>{const on=b.dataset.sub===sub;b.classList.toggle('on',on);if(on){b.setAttribute('aria-current','page');const n=b.parentElement;if(n.scrollWidth>n.clientWidth+2){const l=b.offsetLeft-n.offsetLeft,r=l+b.offsetWidth;if(l<n.scrollLeft||r>n.scrollLeft+n.clientWidth)n.scrollLeft=Math.max(0,l-24)}}else b.removeAttribute('aria-current')});
      if(sec===prevSec&&sub!==prevSub){const n=$('#sub-'+sec);if(n){const top=n.getBoundingClientRect().top;if(top<70)window.scrollTo({top:Math.max(0,scrollY+top-96),behavior:'auto'})}App.emit('route',sec,sub)}
      try{App.mods[sec]?.show?.(sub,prevSec===sec?prevSub:null)}catch(e){console.error(e);const p=$(`#pane-${sec}-${sub}`);if(p&&!p.innerHTML)p.innerHTML=`<div class="panel empty"><h2>Secțiunea nu s-a putut încărca</h2><p>Reîncarcă pagina. Datele tale sunt salvate.</p></div>`}
    }else App.mods.acasa?.show?.();
    first=false;
  }
  function updateTopbar(){
    const home=App.sec==='acasa';
    const past=window.scrollY>(($('#hero')?.offsetHeight||600)*.7);
    $('#topbar').classList.toggle('off',home&&!past);
  }
  return{build,go,route,parse,hashFor,openSheet,closeSheet,updateTopbar};
})();
App.go=(sec,sub)=>Router.go(sec,sub);
