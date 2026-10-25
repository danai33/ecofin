/* =====================================================================
   HERO — the supplied chrome hand (the exact photo, only cut out of its white
   background) rises slowly from the bottom, the 10-lei coin turns slowly on the
   raised index fingertip (three.js, CSS fallback) and the logo assembles.
   The full sequence plays every time the page is opened (as soon as it is
   actually on screen); coming back to Acasă inside the page gives a short settle.
   Motion levels (heroMotion): full · gentle (system asks for reduced motion:
   fades, a short rise, a slow coin) · none (animations turned off in Setări).
   ===================================================================== */
const HAND_DEFAULT={ar:0,tip:[0,0],axis:[0,-1]}; /*__HAND__*/
const Hero=(()=>{
  // where the index fingertip is in the image (fractions of width/height), from assets/hand-v5.json
  let HAND=HAND_DEFAULT;
  let T=null,renderer=null,scene,cam,coin,pivot,loadP=null,ready=false,failed=false;
  let active=false,visible=true,raf=0,spin=0,rate=0,lastT=0,coinD=100;
  let introPlaying=false,introShown=false,rising=false,heroLogo=null,topLogo=null,floatAnim=null;
  const ptr={x:0,y:0},cur={x:0,y:0};
  // coin speed in rad/s: a full turn about every 7.5 s, slower while the hand is still rising
  const SPIN={full:.85,rise:.32,gentle:.4};
  const stage=$('#handStage'),rig=$('#handRig'),move=$('#handMove'),flo=$('#handFloat'),img=$('#handImg'),cv=$('#coinCanvas'),fb=$('#fbCoin');

  function setup(){
    const h=$('#heroTitle');const words=h.textContent.trim().split(/\s+/);
    h.innerHTML=words.map((w,k)=>`<span class="w" style="animation-delay:${(1.5+k*.08).toFixed(2)}s">${esc(w)}</span>`).join(' ');
    heroLogo=Logo.build($('#heroLogo'));topLogo=Logo.build($('#topLogo'));
    $('#topLogo').addEventListener('pointerenter',()=>topLogo.pulse());
    $('#heroLogo').addEventListener('pointerenter',()=>{if(!introPlaying)heroLogo.pulse()});
    const hero=$('#hero'),card=$('#heroCard');
    if(matchMedia('(hover:hover)').matches){
      hero.addEventListener('pointermove',e=>{if(innerWidth<=860||heroMotion()!=='full')return;const x=e.clientX/innerWidth-.5,y=e.clientY/innerHeight-.5;ptr.x=x;ptr.y=y;card.style.transform=`rotateY(${(x*-5).toFixed(2)}deg) rotateX(${(y*3.5).toFixed(2)}deg)`;kick()});
      hero.addEventListener('pointerleave',()=>{ptr.x=0;ptr.y=0;card.style.transform='';kick()});
    }
    $('#scrollCue').addEventListener('click',()=>$('#homeTools').scrollIntoView({behavior:calm()?'auto':'smooth'}));
    new IntersectionObserver(es=>{visible=es[0].isIntersecting;kick()}).observe(stage);
    document.addEventListener('visibilitychange',kick);
    App.on('calm',()=>{
      const m=heroMotion();
      if(m!=='full'){document.documentElement.classList.remove('intro');floatAnim?.cancel();floatAnim=null;ptr.x=ptr.y=0;card.style.transform=''}
      if(m==='none'){move.getAnimations().forEach(a=>a.finish());cancelAnimationFrame(raf);raf=0;renderOnce()}
      else{if(m==='full')startFloat();kick()}
    });
    let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{fit();renderOnce()},80)});
    img.addEventListener('load',()=>{stage.classList.add('shown');fit()});
    if(img.complete&&img.naturalWidth)stage.classList.add('shown');
    fetch('assets/hand-v5.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.tip){HAND=j;fit();renderOnce()}}).catch(()=>{});
    fit();
  }

  /* ---------- framing: the hand is the main visual; the coin stands on the index fingertip ---------- */
  function fit(){
    const W=Math.max(2,stage.clientWidth),H=Math.max(2,stage.clientHeight);
    const narrow=innerWidth<=860;
    let rh,rw,left,top;
    if(narrow){
      // phone: the coin near the top of the stage, the arm runs behind the card; the hand is centred
      coinD=Math.min(W*.27,H*.2);
      const tipY=H*.15+coinD/2,bottom=H*1.04;
      rh=(bottom-tipY)/(1-HAND.tip[1]);rw=rh*HAND.ar;
      const l=HAND.tip[0]*rw,r=Math.max(coinD/2,(1-HAND.tip[0])*rw);
      const cx=Math.min(W-r-6,Math.max(l+6,W/2+(l-r)/2));
      left=cx-HAND.tip[0]*rw;top=tipY-HAND.tip[1]*rh;
    }else{
      // desktop: about 78% of the hero's height, centred a little right of the column's middle
      // (clear of the logo), never so tall that the coin touches the top edge
      coinD=Math.min(H*.18,W*.26);
      const bottom=H*1.08,minTip=coinD+H*.04;
      rh=Math.min(H*.78,W*.62/HAND.ar,(bottom-minTip)/(1-HAND.tip[1]));rw=rh*HAND.ar;
      top=bottom-rh;left=W*.6-rw/2;
      // keep the coin clear of the logo (both sit in .hero, so offsets share one frame): slide the hand
      // to the right within its column first, and only if that is not enough make it a little smaller
      const lg=$('#heroLogo'),m=16;
      const L={x0:lg.offsetLeft-m,x1:lg.offsetLeft+lg.offsetWidth+m,y0:lg.offsetTop-m,y1:lg.offsetTop+lg.offsetHeight+m};
      const hits=()=>{const cx=left+HAND.tip[0]*rw,cy=top+HAND.tip[1]*rh-coinD/2;
        const nx=Math.max(L.x0,Math.min(cx,L.x1)),ny=Math.max(L.y0,Math.min(cy,L.y1));return Math.hypot(cx-nx,cy-ny)<coinD/2};
      for(let k=0;k<80&&hits()&&left+rw<W*.94;k++)left+=4;
      for(let k=0;k<40&&hits()&&rh>H*.5;k++){const c=left+rw/2;rh*=.97;rw=rh*HAND.ar;top=bottom-rh;left=c-rw/2}
    }
    Object.assign(rig.style,{left:left+'px',top:top+'px',width:rw+'px',height:rh+'px'});
    // coin box, in the rig's coordinates (so it rises with the hand); the coin's lowest point rests on the fingertip
    const box=coinD*2.3;
    const bx=HAND.tip[0]*rw-box/2,by=HAND.tip[1]*rh-coinD/2-box/2;
    for(const el of [cv,fb])Object.assign(el.style,{left:bx+'px',top:by+'px',width:box+'px',height:box+'px'});
    fb.style.setProperty('--d',coinD+'px');
    if(renderer&&cam){renderer.setSize(Math.round(box),Math.round(box),false);cam.aspect=1;cam.updateProjectionMatrix()}
  }

  /* ---------- the coin (three.js) ---------- */
  function env(){
    const s=new T.Scene();
    s.add(new T.Mesh(new T.BoxGeometry(30,30,30),new T.MeshBasicMaterial({color:new T.Color(.12,.09,.26),side:T.BackSide})));
    const g=new T.BoxGeometry(1,1,1);
    const add=(hex,k,pos,sc)=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({color:new T.Color(hex).multiplyScalar(k)}));m.position.set(...pos);m.scale.set(...sc);s.add(m)};
    add('#ffffff',6,[0,10,3],[10,.2,5]);add('#ff7ac8',4,[-10,3,3],[.2,8,6]);add('#6fa8ff',4,[10,1,1],[.2,9,6]);add('#ffb070',3,[4,-9,5],[7,.2,4]);
    add('#ffffff',3.5,[-3,4,11],[4,5,.2]);add('#9f7bff',3.5,[2,3,-11],[8,6,.2]);
    const pm=new T.PMREMGenerator(renderer);const tex=pm.fromScene(s,.02).texture;pm.dispose();return tex;
  }
  async function coinTex(url){const t=await new T.TextureLoader().loadAsync(url);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;t.center.set(.5,.5);t.rotation=Math.PI/2;return t}
  function load(){
    if(loadP)return loadP;
    loadP=(async()=>{
      const three=await getThree();if(!three)throw new Error('three.js indisponibil');
      T=three;
      renderer=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:true,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
      renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
      cv.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback()});
      scene=new T.Scene();scene.environment=env();
      const edgeC=document.createElement('canvas');edgeC.width=256;edgeC.height=8;const ex=edgeC.getContext('2d');for(let i=0;i<256;i+=4){ex.fillStyle=i%8?'#f2f4f8':'#9aa1ad';ex.fillRect(i,0,4,8)}
      const et=new T.CanvasTexture(edgeC);et.wrapS=T.RepeatWrapping;et.repeat.set(3,1);et.colorSpace=T.SRGBColorSpace;
      const [ft,bt]=await Promise.all([coinTex('assets/coin-front.png'),coinTex('assets/coin-back.png')]);
      const mats=[new T.MeshStandardMaterial({color:0xf3f4f8,map:et,metalness:.6,roughness:.3,emissive:0x2a2440,emissiveIntensity:.5}),
        new T.MeshStandardMaterial({map:ft,emissiveMap:ft,emissive:0xffffff,emissiveIntensity:.42,metalness:.35,roughness:.3}),
        new T.MeshStandardMaterial({map:bt,emissiveMap:bt,emissive:0xffffff,emissiveIntensity:.42,metalness:.35,roughness:.3})];
      // a solid coin: rim + two opaque faces, so the front and the reverse never show through each other
      const cg=new T.CylinderGeometry(1,1,.14,96);cg.rotateX(Math.PI/2);
      coin=new T.Mesh(cg,mats);
      pivot=new T.Group();pivot.add(coin);scene.add(pivot);
      const key=new T.DirectionalLight(0xffffff,.9);key.position.set(-2,3,3);scene.add(key);
      const rimL=new T.DirectionalLight(0xff9fd6,.6);rimL.position.set(3,1,-2);scene.add(rimL);
      // the coin (diameter 2) fills coinD of a box 2.3*coinD wide
      const fov=22;cam=new T.PerspectiveCamera(fov,1,.1,100);
      const d=2.3/Math.tan(fov*Math.PI/360);cam.position.set(0,0,d);cam.lookAt(0,0,0);
      // compile the shaders and draw once now, so this heavy step never lands in the middle of the opening
      fit();renderer.compile(scene,cam);coin.rotation.set(-.05,.55,0);renderer.render(scene,cam);
      ready=true;stage.classList.add('ready');window.__heroReady=true;
      return true;
    })().catch(e=>{console.warn('Hero coin',e);fallback();return false});
    return loadP;
  }
  function fallback(){
    failed=true;ready=false;cancelAnimationFrame(raf);raf=0;
    try{renderer?.dispose()}catch(e){}
    cv.hidden=true;fb.hidden=false;stage.classList.add('ready','fb');window.__heroReady=true;
  }
  function render(t){
    if(!ready)return;
    const s=Math.min(.1,Math.max(0,(t-lastT)/1000));lastT=t;
    const m=heroMotion();
    if(m==='none'){coin.rotation.set(-.05,.55,0);pivot.rotation.z=0;stage.style.translate=''}
    else{
      // ease the speed toward its target: slow while the hand rises, then the steady turn
      const target=m==='gentle'?SPIN.gentle:rising?SPIN.rise:SPIN.full;
      rate+=(target-rate)*Math.min(1,s*1.6);
      spin+=s*rate;
      coin.rotation.y=spin;
      if(m==='full'){
        cur.x+=(ptr.x-cur.x)*.06;cur.y+=(ptr.y-cur.y)*.06;
        coin.rotation.x=-.06+cur.y*.08;pivot.rotation.z=Math.sin(t/1600)*.02;
        stage.style.translate=`${(cur.x*-14).toFixed(1)}px ${(cur.y*-8).toFixed(1)}px`;
      }else{coin.rotation.x=-.05;pivot.rotation.z=0;stage.style.translate=''}
    }
    renderer.render(scene,cam);
  }
  function renderOnce(){if(ready){lastT=performance.now();render(lastT)}}
  function kick(){
    if(!ready||raf||!active||!visible||document.hidden)return;
    if(heroMotion()==='none'){renderOnce();return}
    lastT=performance.now();
    const loop=t=>{raf=0;if(!active||!visible||document.hidden||heroMotion()==='none'||!ready)return;render(t);raf=requestAnimationFrame(loop)};
    raf=requestAnimationFrame(loop);
  }
  function startFloat(){
    if(heroMotion()!=='full'||floatAnim)return;
    floatAnim=flo.animate([{transform:'translateY(0) rotate(0deg)'},{transform:'translateY(-0.8%) rotate(-.3deg)'},{transform:'translateY(0) rotate(0deg)'}],{duration:8000,iterations:Infinity,easing:'ease-in-out'});
  }

  /* ---------- the opening sequence (about 6 s) and the short one ---------- */
  function rise(dur,from,delay=0){
    const dy=from==='below'?Math.max(stage.clientHeight-rig.offsetTop+coinD*1.4,stage.clientHeight*.75):from;
    rising=true;
    return move.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:dur,delay,easing:'cubic-bezier(.37,.08,.2,1)',fill:'backwards'}).finished.catch(()=>{}).then(()=>{rising=false});
  }
  function playIntro(){
    const m=heroMotion(),root=document.documentElement;
    fit();load();
    if(m==='none'){renderOnce();return}
    introPlaying=true;
    // 1) the logo assembles (gentle: fades in letter by letter)
    heroLogo.reveal({delay:150,gentle:m==='gentle'});
    if(m==='gentle'){
      // 2) the hand appears with a short, soft lift; the coin already turns slowly
      rising=true;
      move.animate([{transform:'translateY(4%)',opacity:0},{transform:'none',opacity:1}],{duration:1800,delay:250,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'})
        .finished.catch(()=>{}).then(()=>{rising=false;introPlaying=false});
      return;
    }
    // 2) the hand rises from below the hero, the coin on its fingertip; 3) it settles and floats
    root.classList.add('intro');
    rise(4200,'below',300).then(startFloat);
    setTimeout(()=>{root.classList.remove('intro');introPlaying=false;heroLogo.stop()},6000);
  }
  function playShort(){
    fit();load();
    const m=heroMotion();
    if(m==='none')return;
    if(m==='gentle'){move.animate([{opacity:0},{opacity:1}],{duration:600,easing:'ease-out'});return}
    rise(1100,Math.round(coinD*.6)).then(startFloat);
    heroLogo.shine(500,1000);
  }
  // start the opening only when the visitor can see it (a tab or panel opened in the background waits)
  function whenVisible(fn){
    if(!document.hidden){fn();return}
    const on=()=>{if(document.hidden)return;document.removeEventListener('visibilitychange',on);if(active)fn();else introShown=false};
    document.addEventListener('visibilitychange',on);
  }
  // the coin's 3D set-up is the only heavy step: let it finish first (at most ~2.5 s), keeping the logo,
  // the hand and the card hidden meanwhile, so the whole opening then runs smoothly from its first frame
  function startIntro(){
    if(heroMotion()==='none'){playIntro();return}
    const root=document.documentElement;root.classList.add('pre-intro');
    const go=()=>{if(!root.classList.contains('pre-intro'))return;root.classList.remove('pre-intro');if(active)playIntro();else introShown=false};
    Promise.race([load(),new Promise(r=>setTimeout(r,2500))]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(go)));
  }
  return{
    init(){setup()},
    show(){
      active=true;
      if(!introShown){introShown=true;whenVisible(startIntro)}
      else playShort();
      kick();Router.updateTopbar();
      load().then(()=>kick());
    },
    hide(){active=false;cancelAnimationFrame(raf);raf=0;document.documentElement.classList.remove('pre-intro')},
    resetIntro(){introShown=false},
    preload(){load()},
    get ready(){return ready||failed}
  };
})();
App.mods.acasa=Hero;
