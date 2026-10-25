/* =====================================================================
   ECONOMII — 3D jars with moods, 30/60/100-day challenges, streaks,
   badges, unlockable jar looks, advice when a goal is too hard.
   ===================================================================== */

/* ---------- 2D coin jar (canvas): fallback when WebGL is missing ---------- */
const Jar2D=(()=>{
  const JW=200,JH=250,COIN_RX=12.5,COIN_RY=4.6;
  const COIN_COLS=[['#FFE9A0','#E2B23A','#9C7012'],['#F7F8FA','#C3C9D0','#7F8890'],['#FFD3A8','#D08B4F','#8C5524']];
  const hash=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)};
  const SLOTS=(()=>{const out=[];let row=0;for(let y=230-COIN_RY;y>84;y-=6.2,row++){const n=y>212?4:(row%2?4:5),sx=25.5,x0=100-(n-1)*sx/2,rs=[];for(let c=0;c<n;c++){const i=out.length+rs.length,h=hash(i+29);rs.push({x:x0+c*sx+(hash(i)-.5)*4,y:y+(hash(i+7)-.5)*1.6,tilt:(hash(i+13)-.5)*.16,col:COIN_COLS[h<.62?0:h<.9?1:2],ord:hash(i+41)})}rs.sort((a,b)=>a.ord-b.ord);out.push(...rs)}return out})();
  const COIN_MAX=SLOTS.length;
  function jarBody(ctx,close){ctx.beginPath();ctx.moveTo(52,42);ctx.quadraticCurveTo(20,48,20,78);ctx.lineTo(20,212);ctx.quadraticCurveTo(20,240,48,240);ctx.lineTo(152,240);ctx.quadraticCurveTo(180,240,180,212);ctx.lineTo(180,78);ctx.quadraticCurveTo(180,48,148,42);if(close)ctx.closePath()}
  function drawCoin(ctx,x,y,col,tilt,alpha,ry){ry=ry||COIN_RY;ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,alpha));ctx.translate(x,y);ctx.rotate(tilt||0);ctx.fillStyle=col[2];ctx.beginPath();ctx.ellipse(0,1.7,COIN_RX,ry,0,0,Math.PI*2);ctx.fill();const g=ctx.createLinearGradient(-COIN_RX,-ry,COIN_RX*.6,ry);g.addColorStop(0,col[0]);g.addColorStop(1,col[1]);ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,COIN_RX,ry,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  class Jar2D{
    static coinsFor(frac){return frac<=0?0:Math.max(1,Math.min(COIN_MAX,Math.round(frac*COIN_MAX)))}
    constructor(canvas,scale=1){this.c=canvas;const dpr=Math.min(2,window.devicePixelRatio||1)*scale;canvas.width=JW*dpr;canvas.height=JH*dpr;this.ctx=canvas.getContext('2d');this.ctx.setTransform(dpr,0,0,dpr,0,0);this.n=0;this.lid='#f0c766';this.draw()}
    setCount(n){this.n=Math.max(0,Math.min(COIN_MAX,n|0));this.draw()}
    setLid(c){this.lid=c;this.draw()}
    draw(){
      const ctx=this.ctx;ctx.clearRect(0,0,JW,JH);
      ctx.fillStyle='rgba(30,10,90,.28)';ctx.beginPath();ctx.ellipse(100,244,74,5,0,0,Math.PI*2);ctx.fill();
      jarBody(ctx,true);ctx.fillStyle='rgba(255,255,255,.10)';ctx.fill();
      ctx.save();jarBody(ctx,true);ctx.clip();for(let i=0;i<this.n;i++){const s=SLOTS[i];drawCoin(ctx,s.x,s.y,s.col,s.tilt,1)}ctx.restore();
      ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineCap='round';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(32,96);ctx.lineTo(32,196);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=2;ctx.lineJoin='round';jarBody(ctx,false);ctx.stroke();
      ctx.fillStyle=this.lid;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(44,30,112,14,6);else ctx.rect(44,30,112,14);ctx.fill();ctx.stroke();
    }
  }
  return Jar2D;
})();

/* ---------- 3D jar (three.js) ---------- */
class Jar3D{
  constructor(host){this.host=host;this.level=0;this.count=0;this.fly=[];this.label={name:'',pct:0,sum:'',mood:'ok'};this.skin=null;this.ready=this.init().catch(e=>{console.warn('Jar3D',e);this.fallback();return false})}
  static MAX=360;
  fallback(){
    this.failed=true;this.host.querySelector('canvas')?.remove();
    const c=document.createElement('canvas');c.style.cssText='width:min(240px,64%);height:auto;aspect-ratio:200/250;margin:auto;display:block';
    const w=document.createElement('div');w.className='fallback';w.append(c);this.host.prepend(w);
    this.j2=new Jar2D(c,1.4);this.j2.setCount(Jar2D.coinsFor(this.level));if(this.skin)this.j2.setLid(this.skin.lid);
  }
  async init(){
    const T=await getThree();if(!T)throw new Error('three missing');
    this.T=T;
    const r=this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    r.setPixelRatio(Math.min(2,devicePixelRatio||1));r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.1;
    this.host.prepend(r.domElement);
    const sc=this.scene=new T.Scene();sc.environment=T3.env(T,r);
    const cam=this.cam=new T.PerspectiveCamera(30,1,.1,100);cam.position.set(0,2.15,7.1);cam.lookAt(0,1.3,0);
    const key=new T.DirectionalLight(0xffffff,1.5);key.position.set(3,6,5);sc.add(key);
    const rimL=new T.DirectionalLight(0xff9fd6,1.1);rimL.position.set(-5,3,-2);sc.add(rimL);
    sc.add(new T.AmbientLight(0xffffff,.35));
    const g=this.group=new T.Group();sc.add(g);
    const P=[[0,0],[.86,0],[.96,.02],[1.0,.09],[1.0,1.9],[.985,2.02],[.94,2.13],[.86,2.22],[.79,2.29],[.78,2.34],[.78,2.46],[.84,2.48],[.85,2.55]].map(([x,y])=>new T.Vector2(x,y));
    const jarGeo=new T.LatheGeometry(P,96);
    this.glass=new T.MeshPhysicalMaterial({color:0xf4f0ff,metalness:0,roughness:.04,transparent:true,opacity:.09,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.5,side:T.DoubleSide,depthWrite:false});
    const jar=new T.Mesh(jarGeo,this.glass);jar.renderOrder=3;g.add(jar);
    this.rimMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{c:{value:new T.Color('#ffffff')},p:{value:2.8},k:{value:.7}},
      vertexShader:'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader:'uniform vec3 c;uniform float p;uniform float k;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),p);gl_FragColor=vec4(c*f*k,f*k);}'});
    const rimMesh=new T.Mesh(jarGeo,this.rimMat);rimMesh.scale.setScalar(1.004);rimMesh.renderOrder=4;g.add(rimMesh);
    this.lidMat=new T.MeshStandardMaterial({color:0xf0c766,metalness:1,roughness:.24});
    const lid=new T.Mesh(new T.CylinderGeometry(.9,.92,.24,72),this.lidMat);lid.position.y=2.66;g.add(lid);
    const lidTop=new T.Mesh(new T.CylinderGeometry(.86,.9,.05,72),this.lidMat);lidTop.position.y=2.8;g.add(lidTop);
    const slot=new T.Mesh(new T.BoxGeometry(.62,.06,.13),new T.MeshStandardMaterial({color:0x2a1b5c,roughness:.8}));slot.position.y=2.83;g.add(slot);
    this.labelCanvas=document.createElement('canvas');this.labelCanvas.width=1024;this.labelCanvas.height=420;
    this.labelTex=new T.CanvasTexture(this.labelCanvas);this.labelTex.colorSpace=T.SRGBColorSpace;this.labelTex.anisotropy=8;
    const lab=new T.Mesh(new T.CylinderGeometry(1.014,1.014,.62,64,1,true,-.72,1.44),new T.MeshStandardMaterial({map:this.labelTex,transparent:true,roughness:.55,metalness:0}));
    lab.position.y=1.32;lab.renderOrder=5;g.add(lab);
    const sh=document.createElement('canvas');sh.width=sh.height=256;const sx=sh.getContext('2d');const gr=sx.createRadialGradient(128,128,10,128,128,128);gr.addColorStop(0,'rgba(30,10,90,.45)');gr.addColorStop(1,'rgba(30,10,90,0)');sx.fillStyle=gr;sx.fillRect(0,0,256,256);
    const shadow=new T.Mesh(new T.PlaneGeometry(3.4,3.4),new T.MeshBasicMaterial({map:new T.CanvasTexture(sh),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.01;sc.add(shadow);
    this.coinGeo=new T.CylinderGeometry(.2,.2,.05,40);this.coinMats=T3.coinMats(T);
    this.mesh=new T.InstancedMesh(this.coinGeo,this.coinMats,Jar3D.MAX);this.mesh.count=0;this.mesh.frustumCulled=false;g.add(this.mesh);
    this.slots=this.makeSlots();
    const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),s=new T.Vector3(1,1,1);
    this.slots.forEach((sl,i)=>{e.set(sl.rx,sl.ry,sl.rz);q.setFromEuler(e);v.set(sl.x,sl.y,sl.z);m.compose(v,q,s);this.mesh.setMatrixAt(i,m)});
    this.mesh.instanceMatrix.needsUpdate=true;
    this.rotV=0;this.drag=null;
    const el=r.domElement;el.setAttribute('aria-hidden','true');
    el.addEventListener('pointerdown',ev=>{this.drag={x:ev.clientX};el.setPointerCapture(ev.pointerId)});
    el.addEventListener('pointermove',ev=>{if(!this.drag)return;const dx=ev.clientX-this.drag.x;this.drag.x=ev.clientX;this.group.rotation.y+=dx*.012;this.rotV=dx*.012;this.kick()});
    const up=()=>{this.drag=null};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
    this.ro=new ResizeObserver(()=>this.size());this.ro.observe(this.host);this.size();
    this.vis=true;new IntersectionObserver(es=>{this.vis=es[0].isIntersecting;this.kick()}).observe(this.host);
    if(this.skin)this.setSkin(this.skin);
    this.drawLabel();this.setCountNow(this.targetCount());this.kick();
    return true;
  }
  makeSlots(){
    const out=[];const h=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)};
    const R=.72,sp=.4;let i=0;
    for(let L=0;out.length<Jar3D.MAX;L++){const off=(L%2)*sp/2,y0=.06+L*.056;
      for(let gx=-3;gx<=3;gx++)for(let gz=-3;gz<=3;gz++){let x=gx*sp+off+(h(i)-.5)*.1,z=gz*sp*.866+(gx%2?sp*.433:0)+(h(i+3)-.5)*.1;i++;const d=Math.hypot(x,z);if(d>R)continue;out.push({x,z,y:y0+(R-d)*.09+h(i+7)*.03,rx:(h(i+11)-.5)*.5,ry:h(i+13)*6.28,rz:(h(i+17)-.5)*.5});if(out.length>=Jar3D.MAX)break}
      if(y0>2.1)break}
    out.sort((a,b)=>a.y-b.y);return out;
  }
  targetCount(){return this.level<=0?0:Math.max(1,Math.min(Jar3D.MAX,Math.round(this.level*Jar3D.MAX)))}
  size(){if(!this.renderer)return;const w=this.host.clientWidth||300,h=this.host.clientHeight||300;this.renderer.setSize(w,h,false);this.cam.aspect=w/h;const fit=w/h<.8?1.25:1;this.cam.position.set(0,2.15,7.1*fit);this.cam.lookAt(0,1.3,0);this.cam.updateProjectionMatrix();this.kick()}
  setSkin(s){this.skin=s;if(this.j2)this.j2.setLid(s.lid);if(!this.glass)return;this.glass.color.set(s.glass);this.lidMat.color.set(s.lid);this.rimMat.uniforms.c.value.set(s.rim||'#ffffff');this.drawLabel();this.kick()}
  setLabel(name,pct,sum,mood){this.label={name,pct,sum,mood};this.drawLabel()}
  async drawLabel(){
    if(!this.labelCanvas)return;
    const tok=this._lt=(this._lt||0)+1;
    try{await document.fonts.load('700 70px Comfortaa')}catch(e){}
    let face=null;try{face=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(faceSVG(this.label.mood||'ok',200).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '))})}catch(e){}
    if(tok!==this._lt)return;
    const c=this.labelCanvas,x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
    const col=this.skin?.label||['#3a2fa8','#ef4f9d','#5b6cf6'];
    x.fillStyle='rgba(255,255,255,.9)';x.strokeStyle='#fff';x.lineWidth=6;x.beginPath();x.roundRect?x.roundRect(40,40,944,340,60):x.rect(40,40,944,340);x.fill();x.stroke();
    if(face)x.drawImage(face,90,110,200,200);
    x.textAlign='center';x.fillStyle=col[0];
    let n=this.label.name||'Borcanul meu';x.font='700 70px Comfortaa, sans-serif';while(x.measureText(n).width>620&&n.length>4)n=n.slice(0,-2)+'…';
    x.fillText(n,615,165);
    x.font='700 100px Comfortaa, sans-serif';x.fillStyle=col[1];x.fillText(Math.round(this.label.pct||0)+'%',615,285);
    x.font='600 38px Comfortaa, sans-serif';x.fillStyle=col[2];x.fillText(this.label.sum||'',615,348);
    if(this.labelTex)this.labelTex.needsUpdate=true;this.kick();
  }
  setLevel(frac,{animate=true}={}){
    this.level=clamp(+frac||0,0,1);
    if(this.failed){this.j2?.setCount(Jar2D.coinsFor(this.level));return}
    if(!this.mesh)return;
    const n=this.targetCount();
    if(!animate||calm()){this.setCountNow(n);return}
    const cur=this.count+this.fly.filter(f=>f.dir>0).length;
    if(n>cur){const add=n-cur,anim=Math.min(add,26),instant=add-anim;if(instant)this.setCountNow(this.count+instant);const base=this.count+this.fly.filter(f=>f.dir>0).length;for(let k=0;k<anim;k++)this.spawn(base+k,1,k*85)}
    else if(n<cur){this.fly.filter(f=>f.dir>0).forEach(f=>this.killFly(f));const rem=this.count-n,anim=Math.min(rem,14);for(let k=0;k<anim;k++)this.spawn(this.count-1-k,-1,k*60);this.setCountNow(n)}
    this.kick();
  }
  setCountNow(n){if(!this.mesh)return;this.fly.slice().forEach(f=>this.killFly(f));this.count=clamp(n,0,Jar3D.MAX);this.mesh.count=this.count;this.landed=new Set();this.kick()}
  spawn(idx,dir,delay){
    const T=this.T;const sl=this.slots[idx];if(!sl)return;
    const mesh=new T.Mesh(this.coinGeo,this.coinMats);const f={mesh,idx,dir,t0:performance.now()+delay,sl};
    if(dir>0){f.from={x:(Math.random()-.5)*.25,y:3.25,z:(Math.random()-.5)*.08};mesh.position.set(f.from.x,f.from.y,f.from.z);mesh.rotation.set(Math.PI/2,0,0);mesh.visible=false}
    else{mesh.position.set(sl.x,sl.y,sl.z);mesh.rotation.set(sl.rx,sl.ry,sl.rz)}
    this.group.add(mesh);this.fly.push(f);
  }
  destroy(){this.vis=false;cancelAnimationFrame(this.raf);this.raf=0;try{this.ro?.disconnect();this.renderer?.dispose();this.renderer?.forceContextLoss()}catch(e){}this.renderer=null}
  killFly(f){this.group.remove(f.mesh);this.fly=this.fly.filter(x=>x!==f)}
  kick(){if(this.raf||!this.renderer)return;this.last=performance.now();const loop=t=>{this.raf=0;if(!this.vis||!this.host.isConnected||App.sec!=='economii'||document.hidden)return;this.frame(t);if(!calm()||this.fly.length||this.drag||Math.abs(this.rotV)>.0005)this.raf=requestAnimationFrame(loop)};this.raf=requestAnimationFrame(loop)}
  frame(t){
    const dt=Math.min(.05,(t-this.last)/1000);this.last=t;
    if(!this.drag){this.rotV*=.94;this.group.rotation.y+=this.rotV+(calm()?0:dt*.22)}
    for(const f of [...this.fly]){
      const el=(t-f.t0)/1000;if(el<0)continue;
      if(f.dir>0){f.mesh.visible=true;const sl=f.sl;const dur=.75+(3.25-sl.y)*.12;const p=Math.min(1,el/dur);const e=p*p;
        f.mesh.position.set(f.from.x+(sl.x-f.from.x)*Math.min(1,p*1.4),f.from.y+(sl.y-f.from.y)*e,f.from.z+(sl.z-f.from.z)*Math.min(1,p*1.4));
        f.mesh.rotation.set(Math.PI/2*(1-p)+sl.rx*p,sl.ry*p+el*9,sl.rz*p);
        if(p>=1){this.landed=this.landed||new Set();this.landed.add(f.idx);this.killFly(f);while(this.landed.has(this.count)){this.landed.delete(this.count);this.count++}this.mesh.count=this.count;
          for(const li of this.landed){if(!this.fly.some(x=>x.idx===li&&x.dir===0)){const m=new this.T.Mesh(this.coinGeo,this.coinMats);const s2=this.slots[li];m.position.set(s2.x,s2.y,s2.z);m.rotation.set(s2.rx,s2.ry,s2.rz);this.group.add(m);this.fly.push({mesh:m,idx:li,dir:0,t0:0,sl:s2})}}}
      }else if(f.dir<0){const p=Math.min(1,el/.9);f.mesh.position.y=f.sl.y+p*2.2;f.mesh.position.x=f.sl.x*(1-p);f.mesh.rotation.y+=dt*10;f.mesh.scale.setScalar(1-p*.6);if(p>=1)this.killFly(f)}
      else if(f.dir===0){if(this.count>f.idx)this.killFly(f)}
    }
    this.renderer.render(this.scene,this.cam);
  }
}

const Savings=(()=>{
  const KEY='borcane',CKEY='provocare',PKEY='premii';
  const COLORS=['#ff8fc8','#8fdcff','#6cf2b9','#ffcf5c','#b89cff','#ff9a76'];
  let jar3d=null,built=false,showNew=false,prefillData=null;
  const data=()=>{const d=Store.get(KEY);return d&&Array.isArray(d.jars)?clone(d):{jars:[],sel:null}};
  const ch=()=>{const c=Store.get(CKEY);return c?clone(c):{active:null,past:[]}};
  const prem=()=>({skin:'clasic',seen:{},...(Store.get(PKEY)||{})});
  const total=j=>r2((j.moves||[]).reduce((s,m)=>s+(+m.a||0),0));
  const saveJars=d=>Store.set(KEY,d);
  function selJar(d=data()){return d.jars.find(j=>j.id===d.sel)||d.jars[0]||null}
  function ring(p,col){const R=21,C=2*Math.PI*R;return `<svg class="jl-ring" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="${R}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="6"/><circle cx="25" cy="25" r="${R}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C*clamp(p,0,1)).toFixed(1)} ${C}" transform="rotate(-90 25 25)"/><text x="25" y="29" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="Comfortaa,sans-serif">${Math.round(p*100)}</text></svg>`}
  const hashStr=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h};

  /* ---------- moods: the jar reacts when a day passes with no coin ---------- */
  const MOOD_TXT={
    ecstatic:['Sunt plin! Cel mai fericit borcan din oraș.','Ținta e atinsă. Simt cum strălucesc monedele în mine.','Am ajuns la capăt și mă simt foarte important.'],
    happy:['Mmm, monede proaspete. Mulțumesc!','Azi m-ai hrănit. Sunt un borcan mulțumit.','Încă o depunere și încep să zornăi de fericire.'],
    ok:['Azi încă n-am primit nimic, dar ziua e lungă.','Mă simt bine. Totuși, o monedă n-ar strica.','Stau cuminte pe raft și aștept.'],
    sad:['Ieri n-am primit nimic. Nu că aș număra… bine, număr.','O zi întreagă fără monede. Am început să-mi aud ecoul.','Ieri am stat singur pe raft și am vorbit cu pușculița de alături.'],
    dramatic:['{n} zile fără o monedă. Sunt un borcan, nu un muzeu.','Am început să scriu poezii triste. Prima se cheamă „Gol”.','Încă puțin și mă mut la vecini. Ei economisesc.'],
    abandoned:['Dacă găsești borcanul ăsta, spune-i stăpânului că încă îl aștept.','S-a pus praf pe capac și îmi vine să strănut. Hapciu!','Am uitat cum sună o monedă. Îmi aduci aminte?']
  };
  function moodOf(j){
    const t=total(j);if(j.target>0&&t>=j.target)return{mood:'ecstatic',days:0};
    const deps=(j.moves||[]).filter(m=>m.a>0);
    const last=deps.length?Math.max(...deps.map(m=>m.ts)):(j.created||Date.now());
    const days=dayDiff(isoOf(new Date(last)),todayISO());
    if(!deps.length&&days<=1)return{mood:'ok',days};
    const mood=days<=0?'happy':days===1?'ok':days===2?'sad':days<=6?'dramatic':'abandoned';
    return{mood,days};
  }
  function moodText(j,m){const arr=MOOD_TXT[m.mood];const i=(hashStr(j.id)+Math.floor(Date.now()/864e5))%arr.length;return arr[i].replace('{n}',Math.max(0,m.days-1))}
  const MOOD_SUB={ecstatic:'Borcanul e în culmea fericirii',happy:'Ai pus bani azi',ok:'Ultima monedă: ieri sau azi',sad:'O zi fără depunere',dramatic:'Câteva zile fără depunere',abandoned:'Peste o săptămână fără depunere'};

  /* ---------- is the goal realistic? ---------- */
  function capacity(){
    if(Acc.planReal()){const c=Planner.calc().canSave;if(c>0)return{v:c,src:'plan'}}
    const since=Date.now()-60*864e5;let s=0,n=0;
    for(const j of data().jars)for(const m of (j.moves||[]))if(m.a>0&&m.ts>=since){s+=m.a;n++}
    if(n>=2)return{v:r2(s/(60/FinCalc.MONTH_DAYS)),src:'istoric'};
    return{v:0,src:null};
  }
  function adviceHTML(j){
    if(!j.deadline)return '';
    const cap0=capacity();
    const g=FinCalc.goalCheck({target:j.target,saved:total(j),deadline:j.deadline,today:todayISO(),capacityPerMonth:cap0.v});
    const capTxt=cap0.src==='plan'?`${lbl('user','din planul lunar')} poți economisi ${lei0(cap0.v)} pe lună`:cap0.src==='istoric'?`${lbl('est','după ultimele 60 de zile')} pui în medie ${lei0(cap0.v)} pe lună`:'';
    if(g.status==='expired')return `<div class="advice"><h3>Termenul a trecut</h3><p>Termenul (${niceDate(j.deadline)}) a trecut și mai ai de strâns ${lei0(g.left)}. Alege o dată nouă:</p><div class="row"><button class="pill sm" type="button" data-deadline="${addDays(todayISO(),91)}">+3 luni</button><button class="pill sm" type="button" data-deadline="${addDays(todayISO(),182)}">+6 luni</button>${g.reachDate?`<button class="pill sm" type="button" data-deadline="${g.reachDate}">${niceDate(g.reachDate)} (realist)</button>`:''}</div></div>`;
    if(g.status==='hard'){
      const lower=Math.floor((g.reachableByDeadline||0)/50)*50;
      return `<div class="advice"><h3>Obiectivul pare prea greu</h3><p>${lbl('calc')} Ca să strângi ${lei0(g.left)} până pe ${niceDate(j.deadline)}, ar trebui să pui <b>${lei0(g.perMonth)}</b> pe lună (${lei(r2(g.perDay))} pe zi). ${capTxt}.</p>
        <ul>${g.reachDate?`<li>Mută termenul pe <b>${niceDate(g.reachDate)}</b>: ajungi acolo în ritmul tău.</li>`:''}${lower>total(j)?`<li>Sau scade ținta la <b>${lei0(lower)}</b>: atât strângi realist până la termen.</li>`:''}<li>Sau împarte drumul în bucăți: o provocare de 30 de zile te ajută să pui bani zilnic.</li></ul>
        <div class="row">${g.reachDate?`<button class="pill sm white" type="button" data-deadline="${g.reachDate}">Mută termenul</button>`:''}${lower>total(j)?`<button class="pill sm" type="button" data-target="${lower}">Scade ținta</button>`:''}<button class="pill sm" type="button" data-goto="economii-provocari">Pornește o provocare</button></div></div>`;
    }
    if(g.status==='tight')return `<div class="advice"><h3>E strâns, dar se poate</h3><p>${lbl('calc')} Ai nevoie de ${lei0(g.perMonth)} pe lună până pe ${niceDate(j.deadline)}. ${capTxt}, deci aproape tot ce rămâne merge aici.</p></div>`;
    if(g.status==='unknown')return `<p class="note">${lbl('calc')} Până pe ${niceDate(j.deadline)} ai nevoie de ${lei0(g.perMonth)} pe lună (${lei(r2(g.perDay))} pe zi). Completează planul lunar ca să verific dacă e realist pentru tine.</p>`;
    if(g.status==='ok')return `<p class="note">${lbl('calc')} Până pe ${niceDate(j.deadline)}: ${lei0(g.perMonth)} pe lună (${lei(r2(g.perDay))} pe zi). ${capTxt}: e realist.</p>`;
    return '';
  }

  /* ---------- jars pane ---------- */
  const SUGG=['Fond de urgență','Vacanță','Telefon nou','Cadouri de sărbători','Avans pentru casă'];
  function newJarForm(id){
    const p=prefillData||{};
    return `<form class="new-jar-form" id="${id}Form" autocomplete="off" novalidate>
      <div class="fld"><label for="${id}Name">Pentru ce strângi?</label><input class="inp" id="${id}Name" maxlength="40" placeholder="ex. Vacanță la mare" value="${esc(p.name||'')}"></div>
      <div class="fld"><label for="${id}Target">Suma țintă</label><span class="amt"><input class="inp num" id="${id}Target" inputmode="decimal" placeholder="10 000" value="${p.target?fmt(p.target):''}" aria-describedby="${id}Err"><em>lei</em></span></div>
      <div class="fld"><label for="${id}Date">Până când (opțional)</label><input class="inp" id="${id}Date" type="date" min="${todayISO()}"></div>
      <div class="chips" style="grid-column:1/-1">${SUGG.map(s=>`<button type="button" class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <p class="err" id="${id}Err" hidden style="grid-column:1/-1"></p>
      <div class="row" style="grid-column:1/-1"><button class="pill solid" type="submit">Creează borcanul</button>${id==='nj2'?'<button class="pill" type="button" data-act="cancel-new">Renunță</button>':''}</div>
    </form>`;
  }
  function renderJars(){
    const pane=$('#pane-economii-borcane');const d=data();
    if(!d.jars.length){
      if(jar3d){jar3d.destroy();jar3d=null}
      pane.innerHTML=`<div class="panel empty"><span class="ico-big">${ico('jar',34)}</span><h2>Pentru ce vrei să strângi bani?</h2><p>Alege un scop și o sumă țintă. Fiecare depunere adaugă monede în borcanul 3D. Dacă trece o zi fără nicio monedă, borcanul se supără (în glumă).</p>${newJarForm('nj')}</div>`;
      prefillData=null;return;
    }
    const j=selJar(d);
    if(!$('#jarStage')){
      pane.innerHTML=`<div class="jar-layout"><div class="jar-list" id="jarList"></div><section class="jar-stage panel" id="jarStage"><div class="jar3d" id="jar3d"><div class="mood" id="jarMood" aria-live="polite"></div><span class="drag-hint">trage ca să rotești</span></div><div class="jar-info" id="jarInfo"></div></section></div>`;
      jar3d=new Jar3D($('#jar3d'));jar3d.ready.then(()=>jar3d.setSkin(currentSkin()));jar3d.skin=currentSkin();
    }
    $('#jarList').innerHTML=d.jars.map((x,k)=>{const t=total(x),p=x.target>0?t/x.target:0;const m=moodOf(x);return `<button type="button" class="jl-item panel${x.id===j.id?' on':''}" data-jar="${x.id}" aria-pressed="${x.id===j.id}">${ring(p,x.color||COLORS[k%COLORS.length])}<span class="jl-name">${esc(x.name)}</span><span class="jl-sub num">${lei0(t)} din ${lei0(x.target)} ${faceSVG(m.mood,20)}</span></button>`}).join('')
      +(showNew?`<div class="panel" style="padding:16px">${newJarForm('nj2')}</div>`:`<button type="button" class="jl-item panel jl-new" data-act="new-jar"><span class="jl-ring" style="display:grid;place-items:center;font-size:26px;border:1.5px dashed #fff;border-radius:50%">+</span><span class="jl-name">Borcan nou</span><span class="jl-sub">alt scop, altă țintă</span></button>`);
    if(showNew){const f=$('#jarList .new-jar-form');if(f)f.style.gridTemplateColumns='minmax(0,1fr)'}
    prefillData=null;
    renderInfo(j);
  }
  function renderInfo(j,animate=false){
    const t=total(j),p=j.target>0?t/j.target:0,left=Math.max(0,j.target-t),m=moodOf(j);
    const mv=(j.moves||[]).slice(-5).reverse();
    $('#jarMood').innerHTML=`${faceSVG(m.mood,46)}<div class="mood-bubble">${esc(moodText(j,m))}<small>${MOOD_SUB[m.mood]}</small></div>`;
    $('#jarInfo').innerHTML=`
      <div><div class="eyebrow">${p>=1?'Țintă atinsă':'Borcan'}${j.from==='contabilitate'?' · mutat din Contabilitate':''}</div><h2>${esc(j.name)}</h2></div>
      <div class="jar-big num">${fmt(t)}<small>din ${lei0(j.target)}</small></div>
      <div class="meter" aria-hidden="true"><i style="width:${Math.min(100,p*100).toFixed(1)}%"></i></div>
      <div class="muted" style="font-size:14.5px">${p>=1?`Ai strâns toată suma${t>j.target?` și ai depășit-o cu <b style="color:#fff">${lei(r2(t-j.target))}</b>`:''}. Felicitări!`:`Mai ai de strâns <b style="color:#fff">${lei(r2(left))}</b> · ${Math.round(p*100)}% din țintă${j.deadline?` · termen ${niceDate(j.deadline)}`:''}`}</div>
      ${p<1?adviceHTML(j):''}
      <form class="jar-form" id="jarMove" autocomplete="off" novalidate>
        <span class="amt"><label class="sr" for="jarAmt">Sumă în lei</label><input class="inp num" id="jarAmt" inputmode="decimal" placeholder="Sumă" aria-describedby="jarErr"><em>lei</em></span>
        <button class="pill solid" type="submit">+ Pune</button><button class="pill" type="button" data-act="out">− Scoate</button>
      </form>
      <p class="err" id="jarErr" hidden></p>
      <div class="quick">${[50,100,200,500].map(v=>`<button type="button" class="chip" data-quick="${v}">+${v} lei</button>`).join('')}</div>
      ${mv.length?`<ul class="hist">${mv.map(x=>`<li><span class="amt-v">${x.a<0?'−':'+'}${lei(Math.abs(x.a))}${x.src?' <span class="muted" style="font-weight:500">· provocare</span>':''}</span><span class="when">${new Date(x.ts).getDate()} ${MONTHS_L[new Date(x.ts).getMonth()].slice(0,3)}</span></li>`).join('')}</ul>`:'<p class="muted" style="margin:0;font-size:14px">Încă nicio depunere. Prima monedă e cea mai importantă.</p>'}
      <div class="row"><button class="pill sm" type="button" data-act="edit-jar">Modifică</button><button class="pill sm danger" type="button" data-act="del-jar">Șterge borcanul</button></div>
      <form class="stack-gap" id="jarEdit" hidden autocomplete="off" novalidate>
        <div class="fld"><label for="jeName">Nume</label><input class="inp" id="jeName" maxlength="40"></div>
        <div class="g2"><div class="fld"><label for="jeTarget">Suma țintă</label><span class="amt"><input class="inp num" id="jeTarget" inputmode="decimal"><em>lei</em></span></div><div class="fld"><label for="jeDate">Până când</label><input class="inp" id="jeDate" type="date"></div></div>
        <p class="err" id="jeErr" hidden></p>
        <div class="row"><button class="pill solid" type="submit">Salvează</button><button class="pill" type="button" data-act="cancel-edit">Renunță</button></div>
      </form>`;
    if(jar3d){jar3d.ready.then(()=>{jar3d.setLabel(j.name,p*100,`${lei0(t)} / ${lei0(j.target)}`,m.mood);jar3d.setLevel(p,{animate})})}
  }
  function updateList(){const d=data();$$('#jarList .jl-item[data-jar]').forEach(b=>{const x=d.jars.find(j=>j.id===b.dataset.jar);if(!x)return;const t=total(x),p=x.target>0?t/x.target:0;b.querySelector('svg').outerHTML=ring(p,x.color||COLORS[0]);b.querySelector('.jl-sub').innerHTML=`${lei0(t)} din ${lei0(x.target)} ${faceSVG(moodOf(x).mood,20)}`})}
  function createJar(prefix){
    const name=$(`#${prefix}Name`).value.trim(),target=parseAmount($(`#${prefix}Target`).value),date=$(`#${prefix}Date`).value,err=$(`#${prefix}Err`);
    if(!(target>0)){err.textContent='Scrie suma țintă, de exemplu 10 000.';err.hidden=false;$(`#${prefix}Target`).setAttribute('aria-invalid','true');$(`#${prefix}Target`).focus();return}
    if(target>1e9){err.textContent='Suma țintă pare prea mare. Verifică cifrele.';err.hidden=false;return}
    if(date&&date<todayISO()){err.textContent='Termenul trebuie să fie azi sau mai târziu.';err.hidden=false;$(`#${prefix}Date`).focus();return}
    const d=data();const j={id:rid(),name:cap(name||'Borcanul meu').slice(0,40),target,deadline:date||'',moves:[],created:Date.now(),color:COLORS[d.jars.length%COLORS.length]};
    d.jars.push(j);d.sel=j.id;saveJars(d);showNew=false;renderJars();toast(`Borcanul „${j.name}” e gata.`);
  }
  function move(sign,amt){
    const d=data();const j=selJar(d);if(!j)return;
    const inp=$('#jarAmt'),err=$('#jarErr');const a=amt??parseAmount(inp.value);
    if(!(a>0)){err.textContent='Scrie o sumă mai mare ca 0.';err.hidden=false;inp.setAttribute('aria-invalid','true');inp.focus();return}
    if(a>1e8){err.textContent='Suma pare prea mare. Verifică cifrele.';err.hidden=false;return}
    const t=total(j);
    if(sign<0&&a>t){err.textContent=t>0?`În borcan sunt doar ${lei(t)}.`:'Borcanul e gol, nu ai ce scoate.';err.hidden=false;return}
    err.hidden=true;inp.removeAttribute('aria-invalid');
    const before=t>=j.target;const badgesBefore=Rewards.got();
    j.moves=j.moves||[];j.moves.push({id:rid(),a:r2(sign*a),ts:Date.now()});saveJars(d);
    renderInfo(j,true);updateList();inp.value='';
    if(!before&&total(j)>=j.target){Confetti.burst(innerWidth*.35,innerHeight*.4,180);toast('Ținta e atinsă! Bravo.')}
    else if(sign>0)toast(`+${lei(a)} în „${j.name}”.`);
    Rewards.announce(badgesBefore);
  }

  /* ---------- challenges: 30, 60 or 100 days ---------- */
  const TYPES={
    crescator:{t:'Suma crescătoare',d:'Ziua 1 pui un pas, ziua 2 doi pași și tot așa. Începi ușor și termini puternic.',ico:'trend'},
    plicuri:{t:'Plicurile surpriză',d:'Aceleași sume ca la cea crescătoare, amestecate. Afli suma zilei când deschizi plicul.',ico:'env'},
    fix:{t:'Aceeași sumă zilnic',d:'O sumă mică, în fiecare zi. Cea mai simplă cale spre un obicei.',ico:'lines'},
    fara:{t:'Zile fără cheltuieli inutile',d:'Bifezi fiecare zi fără cheltuieli inutile și pui deoparte suma economisită.',ico:'ban'}
  };
  const DEF_STEP={30:10,60:5,100:2},DEF_FIX={30:50,60:30,100:20};
  let setup={type:'crescator',days:30,step:10,fixed:50,jar:'new',start:todayISO(),stepTouched:false};
  const MSG=['Nu contează cât de mult pui azi. Contează că pui.','Economisirea e un mușchi: crește în fiecare zi.','Înainte de o cumpărătură, întreabă-te: o vreau sau doar o văd?','Plătește-te pe tine primul: pune deoparte înainte să cheltui.','Notează cheltuielile mici. Ele fac diferența mare.','Regula celor 24 de ore: amână o cumpărătură neplanificată o zi.','Gătitul acasă de două ori pe săptămână se vede repede în borcan.','O zi ratată nu strică provocarea. Recuperează și mergi mai departe.','Pune un nume clar scopului tău. Motivația crește când știi pentru ce.','Rotunjește în sus: diferența de la fiecare plată merge în borcan.','Spune-le celor apropiați de provocare. Ajută să te ții de ea.','Vinde un lucru pe care nu-l mai folosești și pune banii în borcan.','Economisirea constantă bate economisirea mare, dar rară.','Recompensează-te pentru progres cu ceva care nu costă bani.','Verifică abonamentele: cele uitate costă lună de lună.'];
  function chState(a){
    const idx=dayDiff(a.start,todayISO());
    const done=a.done||{};const doneN=Object.keys(done).length;
    const saved=r2(Object.keys(done).reduce((s,k)=>s+(+done[k].a||0),0));
    const plan=r2(a.amounts.reduce((s,v)=>s+v,0));
    const sk=idx>=0?FinCalc.streaks(done,Math.min(idx,a.days),a.days):{current:0,best:0,missed:0};
    return{idx,doneN,saved,plan,streak:sk.current,best:sk.best,missed:sk.missed};
  }
  function renderChallenge(){
    const pane=$('#pane-economii-provocari');const c=ch();
    if(c.active){renderDash(c.active);return}
    const d=data();
    if(!setup.stepTouched){setup.step=DEF_STEP[setup.days];setup.fixed=DEF_FIX[setup.days]}
    const amounts=FinCalc.challengeAmounts(setup.type,setup.days,setup.step,setup.fixed,'x');const tot=r2(amounts.reduce((s,v)=>s+v,0));
    const isStep=setup.type==='crescator'||setup.type==='plicuri';
    pane.innerHTML=`
      <div class="ch-days-pick"><span class="eyebrow">Durata</span><div class="seg" role="group" aria-label="Durata provocării">${[30,60,100].map(n=>`<button type="button" data-days="${n}" class="${setup.days===n?'on':''}" aria-pressed="${setup.days===n}">${n} de zile</button>`).join('')}</div></div>
      <div class="ch-pick">${Object.entries(TYPES).map(([k,v])=>`<button type="button" class="ch-opt panel${setup.type===k?' on':''}" data-type="${k}" aria-pressed="${setup.type===k}"><span class="ch-ico">${ico(v.ico)}</span><h3>${v.t}</h3><p>${v.d}</p></button>`).join('')}</div>
      <div class="ch-setup panel">
        <div class="fld"><label for="chAmt">${isStep?'Pasul zilnic':setup.type==='fara'?'Suma pusă pe zi bifată':'Suma zilnică'}</label><span class="amt"><input class="inp num" id="chAmt" inputmode="decimal" value="${numIn(isStep?setup.step:setup.fixed)}" aria-describedby="chErr"><em>lei</em></span></div>
        <div class="fld"><label for="chJar">Banii merg în</label><select class="inp" id="chJar"><option value="new"${setup.jar==='new'?' selected':''}>Borcan nou pentru provocare</option>${d.jars.map(j=>`<option value="${j.id}"${setup.jar===j.id?' selected':''}>${esc(j.name)}</option>`).join('')}</select></div>
        <div class="fld"><label for="chStart">Începe pe</label><input class="inp" id="chStart" type="date" min="${todayISO()}" value="${setup.start}"></div>
        <p class="err" id="chErr" hidden style="grid-column:1/-1"></p>
        <div class="ch-preview"><div>${lbl('calc')} <span class="muted">La final vei avea</span><br><b class="num">${lei(tot)}</b> <span class="muted">în ${setup.days} de zile · ultima zi: ${niceDate(addDays(setup.start,setup.days-1))}${setup.type==='crescator'?` · cea mai mare zi: ${lei(amounts[amounts.length-1])}`:''}</span></div><button class="pill solid" type="button" data-act="start-ch">Pornește provocarea</button></div>
      </div>
      ${c.past?.length?`<section class="panel pad" style="margin-top:16px"><h2 class="h2s">Provocări anterioare</h2><ul class="hist">${c.past.slice(-6).reverse().map(p=>`<li><span>${esc(TYPES[p.type]?.t||p.type)} · ${p.days} zile · ${p.done} bifate${p.best?` · cea mai lungă serie ${p.best}`:''}</span><span class="amt-v">${lei(p.saved)}</span></li>`).join('')}</ul></section>`:''}`;
  }
  function chMood(a,s){
    if(s.idx<0)return{mood:'ok',txt:`Provocarea începe pe ${niceDate(a.start)}. Borcanul își face încălzirea.`};
    if(s.idx>=a.days)return{mood:s.doneN>=a.days?'ecstatic':'ok',txt:s.doneN>=a.days?'Ai terminat toate zilele! Borcanul dansează.':'Provocarea s-a terminat. Poți recupera zilele rămase sau o arhivezi.'};
    if(a.done?.[s.idx])return{mood:'happy',txt:'Ziua de azi e bifată. Borcanul toarce ca o pisică.'};
    const y=s.idx-1;
    if(y>=0&&!a.done?.[y]){const run=(()=>{let n=0;for(let k=s.idx-1;k>=0&&!a.done?.[k];k--)n++;return n})();return run>=3?{mood:'dramatic',txt:`${run} zile la rând fără monedă. Borcanul a început un jurnal trist. Recuperează o zi și îi trece.`}:{mood:'sad',txt:`Ieri ai sărit ziua ${y+1}. Borcanul e bosumflat, dar te iartă dacă o recuperezi.`}}
    return{mood:'ok',txt:'Azi încă n-ai pus nimic. Borcanul se uită lung la tine.'};
  }
  function renderDash(a){
    const s=chState(a),pane=$('#pane-economii-provocari');
    const R=74,C=2*Math.PI*R,pv=s.doneN/a.days;
    const jar=data().jars.find(j=>j.id===a.jarId);
    const md=chMood(a,s);
    const tiles=a.amounts.map((v,k)=>{
      const done=a.done?.[k],future=k>s.idx,today=k===s.idx,missed=!done&&k<s.idx;
      const hidden=a.type==='plicuri'&&!done&&!a.opened?.[k];
      const cls=done?'done':future?'lock':(today?'avail today':'avail missed');
      const amt=hidden?'?':compact(v);
      return `<button type="button" class="dtile ${cls}" data-day="${k}" aria-label="Ziua ${k+1}${done?', bifată':future?', încă nu a venit':missed?', ratată, o poți recupera':', azi'}${hidden?'':', '+lei(v)}"><span class="n">ziua ${k+1}</span><span class="a">${done?compact(done.a):amt}</span>${missed?'<span class="n" style="font-size:9.5px">recuperează</span>':''}</button>`;
    }).join('');
    pane.innerHTML=`<div class="ch-dash"><div>
        <section class="ch-hero panel">
          <div class="ring3d"><svg viewBox="0 0 170 170" aria-hidden="true"><defs><linearGradient id="rg" x1="0" x2="1"><stop offset="0" stop-color="#8fdcff"/><stop offset=".5" stop-color="#ff8fc8"/><stop offset="1" stop-color="#ffcf5c"/></linearGradient></defs><circle cx="85" cy="85" r="${R}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="14"/><circle cx="85" cy="85" r="${R}" fill="none" stroke="url(#rg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(C*pv).toFixed(1)} ${C}"/></svg><div class="c"><b class="num">${s.doneN}</b><span>din ${a.days} zile</span></div></div>
          <div style="min-width:0">
            <div class="eyebrow">${esc(TYPES[a.type]?.t||'Provocare')} · ${a.days} de zile</div>
            <h2 style="font-size:clamp(22px,2.6vw,30px);font-weight:400;margin-top:6px">${s.idx<0?`Începe pe ${niceDate(a.start)}`:s.idx>=a.days?'Provocarea s-a terminat':`Ziua ${s.idx+1}${a.done?.[s.idx]?' e bifată':': pune banii de azi'}`}</h2>
            <div class="ch-stats">
              <div><b class="num">${lei0(s.saved)}</b><span>strânși din ${lei0(s.plan)}</span></div>
              <div><b class="num">${s.streak}</b><span>zile la rând · record ${s.best}</span></div>
              <div><b class="num">${s.missed}</b><span>${s.missed===1?'zi ratată':'zile ratate'}</span></div>
            </div>
            <div class="ch-mood">${faceSVG(md.mood,44)}<p>${esc(md.txt)}</p></div>
          </div>
        </section>
        <section class="panel pad" style="margin-top:16px">
          <div class="sec-head"><h2 class="h2s">Zilele provocării</h2><span class="muted" style="font-size:14px">Apasă pe ziua de azi după ce ai pus banii deoparte. Zilele ratate le poți recupera.</span></div>
          <div class="days-grid" id="daysGrid">${tiles}</div>
        </section></div>
      <aside class="stack-gap">
        <section class="panel pad"><h2 class="h2s">Insigne din provocări</h2><div class="badges">${Rewards.list().filter(b=>b.group==='streak'||b.group==='challenge').map(Rewards.badgeHTML).join('')}</div><button class="link" type="button" data-goto="economii-recompense" style="margin-top:12px">Toate recompensele</button></section>
        <section class="panel pad stack-gap">
          <p class="muted" style="font-size:14px;margin:0">Banii merg în: <b style="color:#fff">${esc(jar?.name||'borcan șters')}</b></p>
          <p class="ch-msg">${esc(MSG[Math.max(0,s.idx)%MSG.length])}</p>
          ${jar?'<button class="pill" type="button" data-act="see-jar">Vezi borcanul 3D</button>':''}
          <button class="pill" type="button" data-act="ask-ch">${ico('ai',18)}Cere un plan de la asistent</button>
          <button class="pill danger" type="button" data-act="quit-ch">${s.idx>=a.days?'Încheie și arhivează':'Renunță la provocare'}</button>
        </section>
      </aside></div>`;
  }
  function startChallenge(){
    const amt=parseAmount($('#chAmt')?.value),err=$('#chErr');const isStep=setup.type==='crescator'||setup.type==='plicuri';
    if(!(amt>0)||amt>100000){err.textContent=isStep?'Scrie un pas zilnic mai mare ca 0, de exemplu 10.':'Scrie o sumă zilnică mai mare ca 0, de exemplu 50.';err.hidden=false;$('#chAmt').focus();return}
    if(setup.start<todayISO()){err.textContent='Provocarea poate începe azi sau mai târziu.';err.hidden=false;return}
    if(isStep)setup.step=amt;else setup.fixed=amt;
    const d=data();
    const amounts=FinCalc.challengeAmounts(setup.type,setup.days,setup.step,setup.fixed,rid());
    const tot=r2(amounts.reduce((s,v)=>s+v,0));
    let jarId=setup.jar;
    if(jarId==='new'||!d.jars.some(j=>j.id===jarId)){const j={id:rid(),name:`Provocarea de ${setup.days} de zile`,target:tot>0?tot:1000,deadline:addDays(setup.start,setup.days-1),moves:[],created:Date.now(),color:'#ffcf5c'};d.jars.push(j);jarId=j.id;saveJars(d)}
    const c=ch();c.active={id:rid(),type:setup.type,days:setup.days,step:setup.step,fixed:setup.fixed,jarId,start:setup.start,amounts,done:{},opened:{}};
    Store.set(CKEY,c);renderChallenge();toast('Provocarea a început. Succes!');
    if(!calm())$$('#daysGrid .dtile').forEach((t,k)=>t.animate([{transform:'rotateY(-70deg) scale(.7)'},{transform:'none'}],{duration:480,delay:Math.min(k,60)*14,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));
  }
  function tapDay(btn){
    const c=ch(),a=c.active;if(!a)return;const k=+btn.dataset.day;const s=chState(a);
    if(k>s.idx){toast(`Ziua ${k+1} se deblochează pe ${niceDate(addDays(a.start,k))}.`);return}
    const d=data();const jar=d.jars.find(j=>j.id===a.jarId);
    if(a.done?.[k]){
      if(!armConfirm(btn,'anulezi?',3000))return;
      const tag=`ch:${a.id}:${k}`;if(jar){jar.moves=(jar.moves||[]).filter(m=>m.src!==tag);saveJars(d)}
      delete a.done[k];Store.set(CKEY,c);renderChallenge();toast(`Am anulat ziua ${k+1}.`);return;
    }
    if(a.type==='plicuri'&&!a.opened?.[k]){
      a.opened=a.opened||{};a.opened[k]=1;Store.set(CKEY,c);
      if(!calm()){btn.classList.add('flipping');setTimeout(()=>{btn.classList.remove('flipping');btn.querySelector('.a').textContent=compact(a.amounts[k])},420)}else renderChallenge();
      toast(`Plicul zilei ${k+1}: ${lei(a.amounts[k])}. Apasă din nou după ce pui banii.`);
      return;
    }
    const v=r2(a.amounts[k]||0);const late=k<s.idx;
    const before=Rewards.got();
    a.done=a.done||{};a.done[k]={a:v,ts:Date.now(),...(late?{late:1}:{})};Store.set(CKEY,c);
    if(jar&&v>0){jar.moves=jar.moves||[];jar.moves.push({id:rid(),a:v,ts:Date.now(),src:`ch:${a.id}:${k}`});saveJars(d)}
    const r=btn.getBoundingClientRect();
    renderChallenge();
    Confetti.burst(r.left+r.width/2,r.top+r.height/2,late?40:60);
    if(!Rewards.announce(before))toast(late?`Ai recuperat ziua ${k+1}: +${lei(v)}.`:`+${lei(v)} în borcan. Ziua ${k+1} e bifată.`);
  }
  function quit(btn){
    if(!armConfirm(btn,'Sigur? Apasă din nou'))return;
    const c=ch(),a=c.active;if(!a)return;const s=chState(a);
    c.past=c.past||[];c.past.push({type:a.type,days:a.days,done:s.doneN,saved:s.saved,best:s.best,ended:todayISO(),late:Object.values(a.done||{}).some(x=>x.late)});c.active=null;Store.set(CKEY,c);renderChallenge();
    toast(s.doneN>=a.days?'Provocarea e arhivată. Felicitări!':'Provocarea e arhivată.');
  }

  /* ---------- rewards: points, badges, jar looks ---------- */
  const Rewards=(()=>{
    const SKINS=[
      {id:'clasic',name:'Clasic',pts:0,glass:'#f4f0ff',lid:'#f0c766',rim:'#ffffff',label:['#3a2fa8','#ef4f9d','#5b6cf6'],sw:'linear-gradient(135deg,#f4f0ff,#f0c766)'},
      {id:'aurora',name:'Aurora',pts:150,glass:'#c9f5ff',lid:'#8fdcff',rim:'#b8f0ff',label:['#155e75','#0e7490','#4f46e5'],sw:'linear-gradient(135deg,#8fdcff,#b89cff)'},
      {id:'menta',name:'Mentă',pts:300,glass:'#d4ffe9',lid:'#6cf2b9',rim:'#c8ffe4',label:['#065f46','#059669','#2563eb'],sw:'linear-gradient(135deg,#6cf2b9,#d4ffe9)'},
      {id:'apus',name:'Apus',pts:500,glass:'#ffe1d6',lid:'#ff9a76',rim:'#ffd0c0',label:['#9a3412','#e11d48','#7c3aed'],sw:'linear-gradient(135deg,#ff9a76,#ff8fc8)'},
      {id:'galaxie',name:'Galaxie',pts:800,glass:'#e2d4ff',lid:'#8d6ef2',rim:'#d9c8ff',label:['#3b0764','#9333ea','#1d4ed8'],sw:'linear-gradient(135deg,#3b2fb8,#8d6ef2 50%,#ff8fc8)'},
      {id:'aur',name:'Aur',pts:1200,badge:'provocare-100',glass:'#fff3c4',lid:'#e2b23a',rim:'#fff1b0',label:['#713f12','#b45309','#a16207'],sw:'linear-gradient(135deg,#fff3c4,#e2b23a)'}
    ];
    function stats(){
      const d=data(),c=ch();const st={deposits:0,depDays:new Set(),half:false,full:0,bestStreak:0,done:{30:false,60:false,100:false},late:false,chDays:0,streakDays:0};
      for(const j of d.jars){const t=total(j);if(j.target>0&&t>=j.target*.5)st.half=true;if(j.target>0&&t>=j.target)st.full++;for(const m of (j.moves||[]))if(m.a>0){st.deposits++;st.depDays.add(isoOf(new Date(m.ts)))}}
      const days=[...st.depDays].sort();let run=0,prev=null;for(const dd of days){run=prev&&dayDiff(prev,dd)===1?run+1:1;prev=dd;st.bestStreak=Math.max(st.bestStreak,run)}
      const chs=[...(c.past||[]).map(p=>({...p,cur:false}))];
      if(c.active){const s=chState(c.active);chs.push({days:c.active.days,done:s.doneN,best:s.best,late:Object.values(c.active.done||{}).some(x=>x.late),cur:true,a:c.active})}
      for(const p of chs){st.bestStreak=Math.max(st.bestStreak,p.best||0);if(p.done>=p.days){if(p.days>=30)st.done[30]=true;if(p.days>=60)st.done[60]=true;if(p.days>=100)st.done[100]=true}if(p.late)st.late=true;st.chDays+=p.done||0}
      // streak bonus: days done while a streak of 3+ was running
      for(const p of chs){if(!p.cur||!p.a)continue;const done=p.a.done||{};let r=0;for(let k=0;k<p.a.days;k++){if(done[k]){r++;if(r>=3)st.streakDays++}else r=0}}
      for(const p of chs)if(!p.cur&&p.best>=3)st.streakDays+=Math.max(0,(p.done||0)-2);
      return st;
    }
    function points(st=stats()){
      const game=+(Store.get('joc')?.points||0);
      const parts={zile:st.chDays*10,serii:st.streakDays*5,depuneri:st.depDays.size*3,provocari:(st.done[30]?100:0)+(st.done[60]?200:0)+(st.done[100]?350:0),borcane:st.full*50,jocuri:game};
      return{total:Object.values(parts).reduce((a,b)=>a+b,0),parts};
    }
    function list(st=stats()){
      const credit=(()=>{try{return Credit.payments().filter(o=>!o.example).length>=2}catch(e){return false}})();
      const budgetOk=(()=>{try{if(!Acc.planReal())return false;const t=new Date();t.setDate(1);t.setMonth(t.getMonth()-1);const b=Acc.budgetFor(t.getFullYear(),t.getMonth());return b.spent>0&&b.rows.every(r=>r.state!=='over')}catch(e){return false}})();
      const game=Store.get('joc')||{};
      return[
        {id:'prima-moneda',group:'jar',n:'1',l:'Prima monedă',how:'Pune primii bani într-un borcan.',got:st.deposits>0},
        {id:'serie-3',group:'streak',n:'3',l:'Serie de 3 zile',how:'Pune bani 3 zile la rând.',got:st.bestStreak>=3},
        {id:'serie-7',group:'streak',n:'7',l:'Serie de 7 zile',how:'O săptămână fără pauză.',got:st.bestStreak>=7},
        {id:'serie-14',group:'streak',n:'14',l:'Serie de 14 zile',how:'Două săptămâni la rând.',got:st.bestStreak>=14},
        {id:'serie-30',group:'streak',n:'30',l:'Serie de 30 de zile',how:'O lună întreagă fără pauză.',got:st.bestStreak>=30},
        {id:'provocare-30',group:'challenge',n:'30',l:'Provocare de 30 de zile',how:'Bifează toate zilele unei provocări de 30 de zile.',got:st.done[30]},
        {id:'provocare-60',group:'challenge',n:'60',l:'Provocare de 60 de zile',how:'Bifează toate zilele unei provocări de 60 de zile.',got:st.done[60]},
        {id:'provocare-100',group:'challenge',n:'100',l:'Provocare de 100 de zile',how:'Bifează toate zilele unei provocări de 100 de zile.',got:st.done[100]},
        {id:'recuperare',group:'challenge',n:'↺',l:'Recuperare',how:'Recuperează o zi ratată dintr-o provocare.',got:st.late},
        {id:'jumatate',group:'jar',n:'½',l:'Jumătatea drumului',how:'Umple un borcan pe jumătate.',got:st.half},
        {id:'borcan-plin',group:'jar',n:'✓',l:'Borcan plin',how:'Atinge ținta unui borcan.',got:st.full>0},
        {id:'analist',group:'other',n:'%',l:'Analist de credite',how:'Compară cel puțin două oferte reale (nu exemple).',got:credit},
        {id:'bugetar',group:'other',n:'B',l:'O lună în buget',how:'Termină o lună fără nicio categorie peste buget.',got:budgetOk},
        {id:'elev',group:'other',n:'5',l:'Elev atent',how:'Răspunde corect la 5 întrebări în Educație.',got:(game.correct||0)>=5},
        {id:'expert',group:'other',n:'★',l:'Expert în bani',how:'Strânge 500 de puncte în jocurile din Educație.',got:(game.points||0)>=500}
      ];
    }
    const got=()=>new Set(list().filter(b=>b.got).map(b=>b.id));
    function announce(before){
      const now=list().filter(b=>b.got&&!before.has(b.id));
      if(!now.length)return false;
      const p=prem();p.seen=p.seen||{};now.forEach(b=>p.seen[b.id]=Date.now());Store.set(PKEY,p);
      toast(`Insignă nouă: ${now[0].l}!`,{ms:4500});Confetti.burst(innerWidth/2,innerHeight/3,160);return true;
    }
    const badgeHTML=b=>{const fresh=b.got&&prem().seen?.[b.id]&&Date.now()-prem().seen[b.id]<864e5;return `<button type="button" class="badge3d${b.got?' got':''}${fresh?' new':''}" data-badge="${b.id}" title="${esc(b.how)}" aria-label="${esc(b.l)}: ${b.got?'câștigată':'încă blocată'}. ${esc(b.how)}"><span><b>${esc(b.n)}</b>${esc(b.l)}</span></button>`};
    function unlocked(s,pt,ids){return pt>=s.pts||(s.badge&&ids.has(s.badge))}
    function render(){
      const st=stats(),pt=points(st),bl=list(st),ids=new Set(bl.filter(b=>b.got).map(b=>b.id)),p=prem();
      const next=SKINS.find(s=>!unlocked(s,pt.total,ids));
      $('#pane-economii-recompense').innerHTML=`<div class="grid2">
        <section class="panel pad stack-gap"><div class="eyebrow">Punctele tale</div><div class="pts"><b class="num">${fmt0(pt.total)}</b><span class="muted">puncte EcoFin ${lbl('calc')}</span></div>
          <div class="tbl-wrap"><table class="tbl" style="min-width:0"><tbody>${[['Zile bifate în provocări','zile','10 / zi'],['Zile bifate în serie (3+)','serii','+5 / zi'],['Zile cu depuneri','depuneri','3 / zi'],['Provocări încheiate','provocari','100–350'],['Borcane pline','borcane','50 / borcan'],['Jocurile din Educație','jocuri','după răspunsuri']].map(([l,k,h])=>`<tr><td style="white-space:normal">${l} <span class="muted">(${h})</span></td><td>${fmt0(pt.parts[k])}</td></tr>`).join('')}</tbody></table></div>
          ${next?`<p class="muted" style="font-size:14px">Următorul aspect de borcan, „${next.name}”, se deblochează la ${fmt0(next.pts)} puncte${next.badge?' sau cu insigna „Provocare de 100 de zile”':''}. Mai ai ${fmt0(Math.max(0,next.pts-pt.total))}.</p>`:'<p class="muted">Ai deblocat toate aspectele borcanului.</p>'}</section>
        <section class="panel pad"><div class="eyebrow">Insigne · ${ids.size} din ${bl.length}</div><div class="badges" style="margin-top:12px">${bl.map(badgeHTML).join('')}</div><p class="muted" style="font-size:13.5px;margin-top:12px">Apasă pe o insignă ca să vezi cum o câștigi.</p></section>
      </div>
      <section class="panel pad" style="margin-top:16px"><div class="sec-head"><h2 class="h2s">Aspectul borcanului</h2><span class="muted" style="font-size:14px">Recompense virtuale, fără valoare în bani</span></div>
        <div class="skins">${SKINS.map(s=>{const ok=unlocked(s,pt.total,ids);return `<button type="button" class="skin panel${p.skin===s.id?' on':''}${ok?'':' locked'}" data-skin="${s.id}" ${ok?'':'aria-disabled="true"'} aria-pressed="${p.skin===s.id}"><span class="sw2" style="background:${s.sw}"></span><b>${s.name}</b><small>${ok?(p.skin===s.id?'Folosit acum':'Deblocat · apasă ca să-l folosești'):`${ico('lock',14)} ${fmt0(s.pts)} puncte${s.badge?' sau insigna de 100 de zile':''}`}</small></button>`}).join('')}</div></section>`;
    }
    function current(){const st=stats(),pt=points(st),ids=new Set(list(st).filter(b=>b.got).map(b=>b.id)),p=prem();const s=SKINS.find(x=>x.id===p.skin);return s&&unlocked(s,pt.total,ids)?s:SKINS[0]}
    function pick(id){const st=stats(),pt=points(st),ids=new Set(list(st).filter(b=>b.got).map(b=>b.id));const s=SKINS.find(x=>x.id===id);if(!s)return;if(!unlocked(s,pt.total,ids)){toast(`Aspectul „${s.name}” se deblochează la ${fmt0(s.pts)} puncte.`);return}const p=prem();p.skin=id;Store.set(PKEY,p);render();jar3d?.setSkin(s);toast(`Borcanul folosește acum aspectul „${s.name}”.`)}
    return{list,got,announce,badgeHTML,render,current,pick,points,stats};
  })();
  const currentSkin=()=>Rewards.current();

  /* ---------- migration: goals that used to live in Contabilitate ---------- */
  function migrate(){
    const set=Settings.get();if(set.migratedGoals)return;
    const d=data();let n=0;
    for(const k of Object.keys(Store.S.data)){
      const mm=k.match(/^goals-(\d{4})$/);if(!mm)continue;const y=+mm[1];const g=Store.S.data[k]||{};
      const add=(goal,deadline)=>{if(!goal||!goal.id||d.jars.some(j=>j.id==='g-'+goal.id))return;d.jars.push({id:'g-'+goal.id,name:cap(goal.title||'Obiectiv').slice(0,40),target:+goal.target||0,deadline,moves:(goal.moves||[]).map(m=>({id:m.id||rid(),a:+m.a||0,ts:m.ts||Date.now()})),created:goal.created||Date.now(),color:COLORS[d.jars.length%COLORS.length],from:'contabilitate'});n++};
      (g.year||[]).forEach(x=>add(x,`${y}-12-31`));
      for(const[m,arr]of Object.entries(g.months||{}))(arr||[]).forEach(x=>add(x,isoOf(new Date(y,+m,0))));
    }
    if(n){if(!d.sel)d.sel=d.jars[0]?.id||null;saveJars(d);toast(`Am mutat ${n===1?'un obiectiv':n+' obiective'} din Contabilitate în Economii.`,{ms:5000})}
    Settings.set({migratedGoals:true});
  }

  /* ---------- guide ---------- */
  function guideHTML(){
    return `<div class="guide"><article class="panel">
      <h2 id="g-ec-1">Borcanele</h2><p>Fiecare borcan are un scop, o sumă țintă și, dacă vrei, un termen. Când pui bani, monedele cad în borcanul 3D, iar eticheta arată cât ai strâns. Dacă ai pus un termen, îți spun cât trebuie să pui pe lună și pe zi și dacă e realist față de planul tău lunar.</p>
      <h2 id="g-ec-2">De ce se supără borcanul</h2><p>Borcanul ține minte când ai pus ultima monedă. Azi sau ieri: e mulțumit. Dacă trece o zi întreagă fără nicio monedă, se plânge, în glumă. După câteva zile devine dramatic, iar după o săptămână se simte părăsit. Fața de pe etichetă se schimbă la fel.</p>
      <h2 id="g-ec-3">Provocările de 30, 60 și 100 de zile</h2>
      <dl><dt>Suma crescătoare</dt><dd>Ziua k pui k × pas. Totalul pentru n zile este pas × n × (n + 1) / 2: cu pasul de 10 lei, 30 de zile înseamnă 4 650 de lei.</dd>
        <dt>Plicurile surpriză</dt><dd>Aceleași sume, în altă ordine. Afli suma zilei când deschizi plicul.</dd>
        <dt>Aceeași sumă zilnic</dt><dd>Total = suma zilnică × numărul de zile.</dd>
        <dt>Zile fără cheltuieli inutile</dt><dd>Bifezi ziua și pui deoparte suma aleasă.</dd></dl>
      <p>O zi ratată nu strică provocarea: o poți recupera mai târziu. Seria de zile reușite se rupe însă dacă sari o zi.</p>
      <h2 id="g-ec-4">Puncte, insigne și aspecte</h2><p>Primești 10 puncte pentru fiecare zi bifată, 5 în plus când ești într-o serie de cel puțin 3 zile, 3 puncte pentru fiecare zi cu depuneri, 100–350 pentru o provocare încheiată și 50 pentru un borcan plin. Punctele din jocurile de la Educație se adună tot aici. Cu ele deblochezi aspecte noi pentru borcan. Sunt recompense virtuale, fără valoare în bani.</p>
      <h2 id="g-ec-5">Când obiectivul e prea greu</h2><p>Dacă suma necesară pe lună depășește cât poți economisi (din planul lunar sau, dacă nu ai plan, din media depunerilor din ultimele 60 de zile), îți propun două variante calculate exact: un termen nou, la care ajungi în ritmul tău, sau o țintă mai mică pentru termenul ales.</p>
    </article><aside class="panel"><h3>În acest ghid</h3><nav class="toc">${[['g-ec-1','Borcanele'],['g-ec-2','De ce se supără borcanul'],['g-ec-3','Provocările'],['g-ec-4','Puncte și insigne'],['g-ec-5','Obiective prea grele']].map(([id,l])=>`<button type="button" data-jump="${id}">${l}</button>`).join('')}</nav><button class="pill solid" type="button" data-tour="economii">Arată-mi pe pagină</button></aside></div>`;
  }

  /* ---------- events ---------- */
  function build(){
    $('#pane-economii-ghid').innerHTML=guideHTML();
    $('#act-economii').innerHTML=`<button class="pill" type="button" data-ask="economii">${ico('ai',18)}Plan realist cu asistentul</button>`;
    const v=$('#v-economii');
    v.addEventListener('click',e=>{
      const t=e.target;
      const jb=t.closest('[data-jar]');if(jb){const d=data();d.sel=jb.dataset.jar;saveJars(d);$$('#jarList .jl-item').forEach(b=>{const on=b===jb;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});renderInfo(d.jars.find(j=>j.id===d.sel),false);return}
      const sg=t.closest('[data-sugg]');if(sg){const f=sg.closest('form');f.querySelector('input').value=sg.dataset.sugg;f.querySelector('input[inputmode]').focus();return}
      const q=t.closest('[data-quick]');if(q){move(1,+q.dataset.quick);return}
      const dl=t.closest('[data-deadline]');if(dl){const d=data(),j=selJar(d);const old=j.deadline;j.deadline=dl.dataset.deadline;saveJars(d);renderInfo(j);toast(`Termen nou: ${niceDate(j.deadline)}.`,{action:'Anulează',onAction:()=>{const d2=data(),j2=d2.jars.find(x=>x.id===j.id);if(j2){j2.deadline=old;saveJars(d2);renderInfo(j2)}}});return}
      const tg=t.closest('[data-target]');if(tg){const d=data(),j=selJar(d);const old=j.target;j.target=+tg.dataset.target;saveJars(d);renderInfo(j);updateList();toast(`Țintă nouă: ${lei0(j.target)}.`,{action:'Anulează',onAction:()=>{const d2=data(),j2=d2.jars.find(x=>x.id===j.id);if(j2){j2.target=old;saveJars(d2);renderInfo(j2);updateList()}}});return}
      const dy=t.closest('[data-days]');if(dy){setup.days=+dy.dataset.days;setup.stepTouched=false;renderChallenge();return}
      const ty=t.closest('[data-type]');if(ty){setup.type=ty.dataset.type;renderChallenge();return}
      const dt=t.closest('.dtile');if(dt){tapDay(dt);return}
      const sk=t.closest('[data-skin]');if(sk){Rewards.pick(sk.dataset.skin);return}
      const bd=t.closest('[data-badge]');if(bd){const x=Rewards.list().find(z=>z.id===bd.dataset.badge);if(x)toast(`${x.l}: ${x.got?'câștigată.':x.how}`,{ms:4200});return}
      const ask=t.closest('[data-ask]');if(ask){const j=selJar();App.AI.open({prompt:j?`Propune-mi un plan realist pentru borcanul „${j.name}”: cât să pun pe lună și pe săptămână ca să ating ținta.`:'Propune-mi un plan realist de economisire pornind de la planul meu lunar.'});return}
      const act=t.closest('[data-act]');if(!act)return;const a=act.dataset.act;
      if(a==='new-jar'){showNew=true;renderJars();$('#nj2Name')?.focus()}
      else if(a==='cancel-new'){showNew=false;renderJars()}
      else if(a==='out')move(-1);
      else if(a==='edit-jar'){const j=selJar();const f=$('#jarEdit');f.hidden=false;$('#jeName').value=j.name;$('#jeTarget').value=numIn(j.target);$('#jeDate').value=j.deadline||'';$('#jeName').focus()}
      else if(a==='cancel-edit')$('#jarEdit').hidden=true;
      else if(a==='del-jar'){if(!armConfirm(act,'Sigur? Apasă din nou'))return;const d=data();const j=selJar(d);const i=d.jars.findIndex(x=>x.id===j.id);d.jars.splice(i,1);d.sel=d.jars[0]?.id||null;saveJars(d);renderJars();toast(`Am șters borcanul „${j.name}”.`,{action:'Anulează',onAction:()=>{const d2=data();d2.jars.splice(Math.min(i,d2.jars.length),0,j);d2.sel=j.id;saveJars(d2);renderJars()}})}
      else if(a==='start-ch')startChallenge();
      else if(a==='quit-ch')quit(act);
      else if(a==='see-jar'){const d=data();d.sel=ch().active?.jarId||d.sel;saveJars(d);App.go('economii','borcane')}
      else if(a==='ask-ch')App.AI.open({prompt:'Sunt într-o provocare de economisire. Fă-mi un plan simplu ca să nu ratez zile și să găsesc banii pentru fiecare zi.'});
    });
    v.addEventListener('submit',e=>{
      e.preventDefault();const f=e.target;
      if(f.id==='njForm')createJar('nj');else if(f.id==='nj2Form')createJar('nj2');
      else if(f.id==='jarMove')move(1);
      else if(f.id==='jarEdit'){const d=data();const j=selJar(d);const tg=parseAmount($('#jeTarget').value),dt=$('#jeDate').value,er=$('#jeErr');if(!(tg>0)){er.textContent='Scrie o sumă țintă mai mare ca 0.';er.hidden=false;return}j.name=cap($('#jeName').value.trim()||j.name).slice(0,40);j.target=tg;j.deadline=dt||'';saveJars(d);renderJars();toast('Am salvat borcanul.')}
    });
    v.addEventListener('change',e=>{
      const t=e.target;
      if(t.id==='chAmt'){const n=parseAmount(t.value);if(n>0){if(setup.type==='crescator'||setup.type==='plicuri')setup.step=n;else setup.fixed=n;setup.stepTouched=true;$('#chErr').hidden=true;renderChallenge()}else{$('#chErr').textContent='Scrie o sumă mai mare ca 0.';$('#chErr').hidden=false}}
      else if(t.id==='chJar')setup.jar=t.value;
      else if(t.id==='chStart'){if(t.value&&t.value>=todayISO()){setup.start=t.value;renderChallenge()}else{$('#chErr').textContent='Provocarea poate începe azi sau mai târziu.';$('#chErr').hidden=false}}
    });
    Store.on(chg=>{if(!built||App.sec!=='economii')return;if(chg&&![KEY,CKEY,PKEY,'joc','plan'].some(k=>chg.has(k)))return;if(v.contains(document.activeElement)&&document.activeElement.matches('input,select'))return;show(App.sub)});
    built=true;
  }
  function show(sub){
    if(!built)build();
    if(sub==='borcane'){renderJars();jar3d?.kick()}
    else if(sub==='provocari')renderChallenge();
    else if(sub==='recompense')Rewards.render();
  }
  function tour(){
    App.go('economii','borcane');
    setTimeout(()=>Tour.start([
      {el:()=>$('#jarList')||$('#njForm'),text:'Aici sunt borcanele tale. Fiecare are un scop și o sumă țintă.'},
      $('#jar3d')&&{el:'#jar3d',text:'Borcanul 3D se umple cu monede. Dacă trece o zi fără nicio monedă, se plânge (în glumă).'},
      $('#jarMove')&&{el:'#jarMove',text:'Scrie suma și apasă „+ Pune”. Dacă folosești din bani, apasă „− Scoate”.'},
      {el:()=>$('#sub-economii [data-sub="provocari"]'),text:'În „Provocări” pornești o provocare de 30, 60 sau 100 de zile.'},
      {el:()=>$('#sub-economii [data-sub="recompense"]'),text:'În „Recompense” vezi punctele, insignele și aspectele deblocate pentru borcan.'}
    ]),App.sec==='economii'?160:500);
  }
  function snapshot(){
    const d=data(),c=ch(),cap0=capacity();
    return{nota:'numele, țintele și termenele sunt introduse de utilizator; sumele strânse, procentele și calculele de ritm sunt calculate',
      borcane:d.jars.map(j=>{const t=total(j);const g=j.deadline?FinCalc.goalCheck({target:j.target,saved:t,deadline:j.deadline,today:todayISO(),capacityPerMonth:cap0.v}):null;return{nume:j.name,tinta_lei_introdus:j.target,termen_introdus:j.deadline||null,strans_lei_calculat:t,procent_calculat:j.target>0?Math.round(t/j.target*100):0,stare_borcan:moodOf(j).mood,depuneri:(j.moves||[]).length,
        ritm_necesar_calculat:g&&g.perMonth?{lei_pe_luna:r2(g.perMonth),lei_pe_zi:r2(g.perDay),stare:g.status,luni_necesare_in_ritmul_actual:g.monthsNeeded?r2(g.monthsNeeded):null,data_realista:g.reachDate||null}:null}}),
      capacitate_lunara:cap0.src?{lei:cap0.v,sursa:cap0.src==='plan'?'calculat din planul lunar':'estimare din depunerile din ultimele 60 de zile'}:null,
      provocare_activa:c.active?(()=>{const s=chState(c.active);return{tip:TYPES[c.active.type]?.t,zile:c.active.days,ziua_curenta:s.idx+1,zile_bifate:s.doneN,serie_curenta:s.streak,record_serie:s.best,zile_ratate:s.missed,strans_lei:s.saved,total_planificat_lei:s.plan}})():null,
      puncte_calculat:Rewards.points().total};
  }
  return{
    init(){Store.ready.then(()=>{try{migrate()}catch(e){console.warn('migrare',e)}})},
    show,hide(){},snapshot,tour,Rewards,
    prefill(p){prefillData=p;showNew=true;if(App.sec==='economii'&&App.sub==='borcane')renderJars();setTimeout(()=>{const f=$('#nj2Name')||$('#njName');f?.focus();f?.scrollIntoView({block:'center'})},60)}
  };
})();
App.mods.economii=Savings;
