/* =====================================================================
   WEB — EcoFin as its own website (outside Claude): real accounts
   (Supabase Auth: email + password, optional Google), each person's data
   in the database (row-level security: nobody sees anyone else's data),
   the assistant through the server function that keeps the Claude key.
   It offers the same small interface the app uses inside Claude
   (window.claude.use('db' | 'user' | 'sample' | 'downloads')), so the
   calculators, accounting, jars and assistant code stay the same.
   Active only when the page defines window.ECOFIN_WEB (the web build).
   ===================================================================== */
const Web=(()=>{
  const W=window.ECOFIN_WEB;
  if(!W||typeof W!=='object')return{on:false};
  const LEGAL={operator:'EcoFin',email:'',reviewed:false,...(W.legal||{})};
  const configured=!!(W.supabaseUrl&&W.supabaseKey&&window.supabase&&typeof window.supabase.createClient==='function');
  const FN=n=>`${String(W.supabaseUrl).replace(/\/$/,'')}/functions/v1/${n}`;
  const siteUrl=()=>location.origin+location.pathname;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const fail=(code,extra)=>Object.assign(new Error(code),{code},extra||{});
  // what came back in the address after an email link (read before the client tidies the address)
  const landing=(()=>{const h=new URLSearchParams(location.hash.replace(/^#/,''));const q=new URLSearchParams(location.search);
    return{type:h.get('type')||q.get('type')||'',error:h.get('error_description')||q.get('error_description')||'',errorCode:h.get('error_code')||q.get('error_code')||''}})();
  let sb=null,session=null,user=null,byMe=false;
  if(configured){
    sb=window.supabase.createClient(W.supabaseUrl,W.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'ecofin-auth'}});
    // "Continue with Google" appears by itself once Google is switched on in Supabase (no rebuild needed)
    if(W.google!==true)fetch(`${String(W.supabaseUrl).replace(/\/$/,'')}/auth/v1/settings`,{headers:{apikey:W.supabaseKey}}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.external)W.google=!!j.external.google}).catch(()=>{});
  }
  const ready=(async()=>{
    if(!sb)return null;
    try{const{data}=await sb.auth.getSession();session=data.session||null;user=session?.user||null}catch(e){console.warn('auth',e)}
    tidyAddress();
    sb.auth.onAuthStateChange((ev,s)=>{
      if(ev==='PASSWORD_RECOVERY'){session=s;user=s?.user||null;setTimeout(()=>openAuth('new'),300);return}
      if(ev==='TOKEN_REFRESHED'||ev==='USER_UPDATED'){session=s;user=s?.user||user;return}
      if(ev==='SIGNED_OUT'&&user&&!byMe){clearLocal();toast('Ai fost deconectat. Intră din nou în cont.');setTimeout(()=>location.reload(),900)}
    });
    return session;
  })();
  function tidyAddress(){
    if(/access_token|refresh_token|error_description|type=/.test(location.hash+location.search)){
      history.replaceState(null,'',location.pathname+(landing.type==='recovery'?'#cont':landing.type==='signup'?'#cont':'#acasa'));
    }
  }
  function clearLocal(){try{localStorage.removeItem('ecofin-v1')}catch(e){}}

  /* ---------- the person's documents (same shape the app uses inside Claude) ---------- */
  function dbErr(error){
    const m=String(error?.message||error||''),c=String(error?.code||'');
    if(/size_ok|too_many_documents/.test(m)||c==='P0001')return fail('quota_exceeded');
    if(c==='42501'||/row-level security/i.test(m))return fail('not_granted');
    return fail('unavailable',{detail:m});
  }
  async function retry(fn){let last;for(const w of [0,900,2500,6000]){if(w)await sleep(w);try{return await fn()}catch(e){last=e;if(e.code!=='unavailable')throw e}}throw last}
  function makeDb(uid){
    return{collection(){return{
      doc(k){return{
        set:body=>retry(async()=>{const{error}=await sb.from('user_docs').upsert({user_id:uid,key:k,data:body},{onConflict:'user_id,key'});if(error)throw dbErr(error)}),
        delete:()=>retry(async()=>{const{error}=await sb.from('user_docs').delete().eq('user_id',uid).eq('key',k);if(error)throw dbErr(error)})
      }},
      onSnapshot(cb,errCb){
        let alive=true,timer=0,chan=null,busy=false,again=false;
        const pull=async()=>{
          if(busy){again=true;return}busy=true;
          try{const{data,error}=await sb.from('user_docs').select('key,data').eq('user_id',uid);
            if(!alive)return;if(error){errCb?.(dbErr(error));return}
            cb({docs:(data||[]).map(r=>({id:r.key,data:()=>r.data})),metadata:{fromCache:false}});
          }catch(e){if(alive)errCb?.(dbErr(e))}
          finally{busy=false;if(again&&alive){again=false;pull()}}
        };
        pull();
        // another device of the same person changed something: fetch again (live, plus on return to the tab)
        try{chan=sb.channel('docs-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'user_docs',filter:'user_id=eq.'+uid},()=>{clearTimeout(timer);timer=setTimeout(pull,300)}).subscribe()}catch(e){}
        const back=()=>{if(!document.hidden)pull()};
        document.addEventListener('visibilitychange',back);addEventListener('online',back);
        return()=>{alive=false;clearTimeout(timer);try{chan&&sb.removeChannel(chan)}catch(e){}document.removeEventListener('visibilitychange',back);removeEventListener('online',back)};
      }
    }}};
  }
  const meOf=u=>{const md=u?.user_metadata||{};return{id:u.id,name:String(md.full_name||md.name||(u.email||'').split('@')[0]||'').trim(),avatarUrl:md.avatar_url||md.picture||'',email:u.email||''}};
  const userApi={me:async()=>user?meOf(user):{id:null}};

  /* ---------- the assistant: same call shape as inside Claude, answered by the server function ---------- */
  async function token(){if(!sb)return null;try{const{data}=await sb.auth.getSession();return data.session?.access_token||null}catch(e){return null}}
  async function jpeg64(blob){
    let bmp;try{bmp=await createImageBitmap(blob)}catch(e){throw fail('image_rejected')}
    const s=Math.min(1,1600/Math.max(bmp.width,bmp.height));const w=Math.max(1,Math.round(bmp.width*s)),h=Math.max(1,Math.round(bmp.height*s));
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(bmp,0,0,w,h);bmp.close?.();
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.86));if(!b)throw fail('image_rejected');
    return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=()=>rej(fail('image_rejected'));fr.readAsDataURL(b)});
  }
  async function round(body,signal,emit){
    const tok=await token();if(!tok)throw fail('signed_out');
    let res;
    try{res=await fetch(FN('assistant'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok,apikey:W.supabaseKey},body:JSON.stringify(body),signal})}
    catch(e){throw fail(signal?.aborted?'cancelled':'upstream_error')}
    if(!res.ok){let j=null;try{j=await res.json()}catch(e){}throw fail(j?.error?.code||(res.status===401?'signed_out':'upstream_error'),{limit:j?.error?.limit})}
    const used=+res.headers.get('x-daily-used')||0,limit=+res.headers.get('x-daily-limit')||0;if(limit)Web.usage={used,limit};
    const reader=res.body.getReader(),dec=new TextDecoder();let buf='',stop=null;const blocks=[];
    const on=ev=>{
      if(ev.type==='content_block_start'){const b=ev.content_block||{};blocks[ev.index]=b.type==='text'?{type:'text',text:''}:b.type==='tool_use'?{type:'tool_use',id:b.id,name:b.name,json:''}:{type:b.type,skip:true}}
      else if(ev.type==='content_block_delta'){const b=blocks[ev.index];if(!b||b.skip)return;if(ev.delta?.type==='text_delta'){b.text+=ev.delta.text;emit(ev.delta.text)}else if(ev.delta?.type==='input_json_delta')b.json+=ev.delta.partial_json}
      else if(ev.type==='message_delta'){if(ev.delta?.stop_reason)stop=ev.delta.stop_reason}
      else if(ev.type==='error')throw fail(ev.error?.type==='overloaded_error'?'rate_limited':'upstream_error');
    };
    for(;;){
      let r;try{r=await reader.read()}catch(e){throw fail(signal?.aborted?'cancelled':'upstream_error')}
      if(r.done)break;
      buf+=dec.decode(r.value,{stream:true}).replace(/\r\n/g,'\n');
      let i;while((i=buf.indexOf('\n\n'))>=0){
        const chunk=buf.slice(0,i);buf=buf.slice(i+2);
        const data=chunk.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('');
        if(!data)continue;let ev;try{ev=JSON.parse(data)}catch(e){continue}on(ev);
      }
    }
    const content=blocks.filter(b=>b&&!b.skip).map(b=>b.type==='text'?{type:'text',text:b.text}:{type:'tool_use',id:b.id,name:b.name,input:(()=>{try{return b.json?JSON.parse(b.json):{}}catch(e){return{}}})()});
    return{content,stop};
  }
  async function sample(input,opts={}){
    const tools=Array.isArray(opts.tools)?opts.tools:[];
    const defs=tools.map(t=>({name:t.name,description:t.description||'',input_schema:t.inputSchema||{type:'object',properties:{}}}));
    const msgs=(Array.isArray(input)?input:[{role:'user',content:String(input)}]).map(m=>({role:m.role,content:m.content}));
    let system;
    // inside EcoFin the first message carries the instructions: send them as the system prompt
    if(msgs.length>1&&msgs[0].role==='user'&&msgs[1].role==='user')system=String(msgs.shift().content);
    if(opts.images?.length){
      const imgs=await Promise.all(opts.images.slice(0,4).map(jpeg64));
      const last=msgs[msgs.length-1];
      last.content=[...imgs.map(d=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data:d}})),{type:'text',text:String(last.content)}];
    }
    const purpose=['chat','contract','transcribe'].includes(opts.purpose)?opts.purpose:'chat';
    let full='',truncated=false;
    const emit=d=>{full+=d;try{opts.onText?.({text:full,delta:d})}catch(e){}};
    try{
      for(let k=0;k<6;k++){
        if(k>0&&full&&!/\n\s*$/.test(full))emit('\n\n');
        const{content,stop}=await round({purpose,system,messages:msgs,...(defs.length?{tools:defs}:{})},opts.signal,emit);
        const clean=content.filter(b=>!(b.type==='text'&&!b.text.trim()));
        if(stop!=='tool_use'){truncated=stop==='max_tokens';break}
        msgs.push({role:'assistant',content:clean});
        const results=[];
        for(const b of clean.filter(x=>x.type==='tool_use')){
          const t=tools.find(x=>x.name===b.name);let out,bad=false;
          try{if(!t)throw new Error('instrument necunoscut');out=await t.execute(b.input||{})}catch(e){out=String(e?.message||e);bad=true}
          results.push({type:'tool_result',tool_use_id:b.id,content:typeof out==='string'?out:JSON.stringify(out),...(bad?{is_error:true}:{})});
        }
        msgs.push({role:'user',content:results});
        if(k===5)truncated=true;
      }
    }catch(e){
      if(e.code==='cancelled'||opts.signal?.aborted)throw Object.assign(new Error('cancelled'),{code:'cancelled',text:full});
      e.text=full;throw e;
    }
    return{text:full.trim(),truncated};
  }
  sample.limits=async()=>({tools:true,images:{maxCount:4}});

  /* ---------- files to keep: a normal browser download ---------- */
  const downloads={async save({filename,data}){
    const blob=data instanceof Blob?data:new Blob([data],{type:/\.json$/i.test(filename)?'application/json':'text/plain'});
    const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename||'ecofin.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);
  }};

  // the small interface the app already speaks inside Claude
  if(!window.claude)window.claude={use:async name=>{
    if(name==='downloads')return downloads;
    await ready;if(!sb||!user)return null;
    if(name==='db')return makeDb(user.id);
    if(name==='user')return userApi;
    if(name==='sample')return sample;
    return null;
  }};

  /* ---------- sign in · new account · forgotten password · new password ---------- */
  const AUTH_ERR={invalid_credentials:'Email sau parolă greșită.',email_not_confirmed:'Contul nu e activat încă. Deschide linkul din emailul de confirmare (verifică și Spam).',user_already_exists:'Există deja un cont cu acest email. Intră în cont sau cere o parolă nouă.',weak_password:'Parola e prea slabă. Folosește cel puțin 8 caractere, cu litere și cifre.',over_email_send_rate_limit:'Am trimis prea multe emailuri în ultimul timp. Încearcă din nou peste câteva minute.',over_request_rate_limit:'Prea multe încercări. Așteaptă puțin și încearcă din nou.',email_address_invalid:'Adresa de email nu pare corectă.',signup_disabled:'Crearea de conturi noi este oprită momentan.',same_password:'Parola nouă trebuie să fie diferită de cea veche.',validation_failed:'Verifică datele introduse.',email_provider_disabled:'Intrarea cu email este oprită momentan.',provider_disabled:'Intrarea cu Google nu este pornită încă.',email_exists:'Există deja un cont cu acest email. Intră în cont sau cere o parolă nouă.',email_address_not_authorized:'Deocamdată site-ul nu poate trimite emailuri la această adresă. Încearcă din nou mai târziu.',user_banned:'Acest cont este suspendat.',captcha_failed:'Verificarea anti-robot nu a reușit. Încearcă din nou.'};
  const authMsg=e=>AUTH_ERR[e?.code]||(/invalid login/i.test(e?.message||'')?AUTH_ERR.invalid_credentials:/not confirmed/i.test(e?.message||'')?AUTH_ERR.email_not_confirmed:/already registered/i.test(e?.message||'')?AUTH_ERR.user_already_exists:/sending.*email|confirmation email|recovery email/i.test(e?.message||'')?'Nu am putut trimite emailul acum. Încearcă din nou peste câteva minute.':/fetch|network/i.test(e?.message||'')?'Nu m-am putut conecta. Verifică internetul și încearcă din nou.':'Nu a mers. Încearcă din nou.');
  const TITLE={in:'Intră în cont',up:'Creează un cont gratuit',reset:'Ai uitat parola?',new:'Alege o parolă nouă'};
  const GO={in:'Intră în cont',up:'Creează contul',reset:'Trimite linkul',new:'Salvează parola'};
  const GSVG='<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
  function authHtml(mode){
    const two=mode==='in'||mode==='up';
    return `<form class="auth" id="authForm" novalidate data-mode="${mode}">
      ${two?`<div class="auth-tabs" role="tablist" aria-label="Cont"><button type="button" role="tab" class="chip${mode==='in'?' on':''}" aria-selected="${mode==='in'}" data-auth-mode="in">Am cont</button><button type="button" role="tab" class="chip${mode==='up'?' on':''}" aria-selected="${mode==='up'}" data-auth-mode="up">Cont nou</button></div>`:''}
      ${mode==='up'?'<p class="muted auth-lead">Contul e gratuit. Datele tale se salvează privat și le vezi de pe orice dispozitiv. Ce ai notat deja în acest browser trece automat în cont.</p>':''}
      ${mode==='in'?'<p class="muted auth-lead">Intră ca să-ți vezi datele de pe orice dispozitiv și să folosești asistentul AI.</p>':''}
      ${mode==='reset'?'<p class="muted auth-lead">Scrie adresa contului și îți trimitem un link pentru o parolă nouă.</p>':''}
      ${mode==='new'?'<p class="muted auth-lead">Alege parola nouă pentru contul tău.</p>':''}
      ${two&&W.google?`<button type="button" class="pill auth-google" id="authGoogle">${GSVG}<span>Continuă cu Google</span></button><div class="auth-or"><span>sau cu email</span></div>`:''}
      ${mode==='up'?'<label class="fld"><span>Numele tău <small>(opțional)</small></span><input class="inp" name="name" autocomplete="name" maxlength="60"></label>':''}
      ${mode!=='new'?'<label class="fld">Email<input class="inp" type="email" name="email" autocomplete="email" inputmode="email" maxlength="160" required></label>':''}
      ${mode!=='reset'?`<label class="fld">${mode==='new'?'Parola nouă':'Parola'}<span class="pw"><input class="inp" type="password" name="password" autocomplete="${mode==='in'?'current-password':'new-password'}" maxlength="72" required><button type="button" class="link pw-eye" data-pw-eye aria-pressed="false">Arată</button></span>${mode!=='in'?'<small>Cel puțin 8 caractere.</small>':''}</label>`:''}
      ${mode==='up'?'<label class="auth-terms"><input type="checkbox" name="terms"><span>Am citit <button type="button" class="link" data-legal="privacy">Politica de confidențialitate</button> și accept <button type="button" class="link" data-legal="terms">Termenii de utilizare</button>.</span></label>':''}
      <p class="err" id="authErr" role="alert" hidden></p>
      <div class="note" id="authOk" role="status" hidden></div>
      <button class="pill solid auth-go" type="submit">${GO[mode]}</button>
      ${mode==='in'?'<button type="button" class="link auth-alt" data-auth-mode="reset">Am uitat parola</button>':''}
      ${mode==='reset'?'<button type="button" class="link auth-alt" data-auth-mode="in">Înapoi la intrare</button>':''}
    </form>`;
  }
  function openAuth(mode='in',note){
    if(!configured){Modal.open({eyebrow:'Cont EcoFin',title:'Conturile nu sunt pornite încă',size:'narrow',html:'<p>Pe această copie a site-ului conturile nu sunt conectate încă la server. Poți folosi toate calculatoarele: datele se păstrează în acest browser.</p>'});return}
    const body=Modal.open({eyebrow:'Cont EcoFin',title:TITLE[mode]||TITLE.in,html:authHtml(mode),size:'narrow'});
    const f=body.querySelector('#authForm');
    const errEl=f.querySelector('#authErr'),okEl=f.querySelector('#authOk'),go=f.querySelector('.auth-go');
    const say=(t,good)=>{errEl.hidden=!!good||!t;okEl.hidden=!good;(good?okEl:errEl).textContent=t||''};
    if(note)say(note,true);
    setTimeout(()=>f.querySelector('input:not([type=checkbox])')?.focus({preventScroll:true}),60);
    f.addEventListener('click',async e=>{
      const m=e.target.closest('[data-auth-mode]');if(m){openAuth(m.dataset.authMode);return}
      const eye=e.target.closest('[data-pw-eye]');if(eye){const i=f.querySelector('input[name=password]');const show=i.type==='password';i.type=show?'text':'password';eye.textContent=show?'Ascunde':'Arată';eye.setAttribute('aria-pressed',show);return}
      if(e.target.closest('#authGoogle')){say('');try{const{error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:siteUrl()}});if(error)say(authMsg(error))}catch(err){say(authMsg(err))}}
    });
    f.addEventListener('submit',async e=>{
      e.preventDefault();say('');
      const v=k=>String(f.elements[k]?.value||'').trim();
      const email=v('email').toLowerCase(),pw=f.elements.password?.value||'';
      if(mode!=='new'&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){say(AUTH_ERR.email_address_invalid);f.elements.email.focus();return}
      if(mode==='in'&&!pw){say('Scrie parola.');f.elements.password.focus();return}
      if((mode==='up'||mode==='new')&&pw.length<8){say('Parola trebuie să aibă cel puțin 8 caractere.');f.elements.password.focus();return}
      if(mode==='up'&&!f.elements.terms.checked){say('Bifează că ai citit politica de confidențialitate și accepți termenii.');return}
      const label=go.textContent;go.disabled=true;go.textContent='Se trimite…';
      try{
        if(mode==='in'){
          const{error}=await sb.auth.signInWithPassword({email,password:pw});
          if(error)throw error;
          say('Gata, ești în cont.',true);setTimeout(()=>location.reload(),350);return;
        }
        if(mode==='up'){
          const{data,error}=await sb.auth.signUp({email,password:pw,options:{data:{full_name:v('name')},emailRedirectTo:siteUrl()}});
          if(error)throw error;
          if(data.session){say('Contul e gata.',true);setTimeout(()=>location.reload(),350);return}
          f.querySelectorAll('label,.auth-tabs,.auth-google,.auth-or,.auth-lead').forEach(x=>x.hidden=true);go.hidden=true;
          say(`Ți-am trimis un email la ${email}. Deschide linkul din el ca să-ți activezi contul, apoi intră aici. Dacă nu-l găsești, verifică și Spam.`,true);return;
        }
        if(mode==='reset'){
          const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:siteUrl()});
          if(error)throw error;
          say('Dacă există un cont cu această adresă, ți-am trimis un link pentru o parolă nouă.',true);go.hidden=true;return;
        }
        if(mode==='new'){
          const{error}=await sb.auth.updateUser({password:pw});
          if(error)throw error;
          say('Parola a fost schimbată. Ești în cont.',true);setTimeout(()=>location.reload(),700);return;
        }
      }catch(err){say(authMsg(err))}
      finally{go.disabled=false;if(go.textContent==='Se trimite…')go.textContent=label}
    });
  }
  async function signOut(){byMe=true;try{await sb?.auth.signOut({scope:'local'})}catch(e){}clearLocal();location.hash='acasa';location.reload()}
  async function deleteAccount(){
    const tok=await token();if(!tok)throw fail('signed_out');
    const r=await fetch(FN('delete-account'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok,apikey:W.supabaseKey},body:'{}'}).catch(()=>null);
    if(!r||!r.ok)throw fail('upstream_error');
    byMe=true;try{await sb.auth.signOut({scope:'local'})}catch(e){}clearLocal();
  }

  /* ---------- privacy policy and terms (drafts to be reviewed before launch) ---------- */
  const today=LEGAL.updated||'';
  const contact=()=>LEGAL.email?`<a href="mailto:${esc(LEGAL.email)}">${esc(LEGAL.email)}</a>`:'adresa de contact afișată pe site';
  function privacyHtml(){return `<div class="legal">
    ${LEGAL.reviewed?'':'<p class="note">Versiune preliminară.</p>'}${today?`<p class="muted">Ultima actualizare: ${esc(today)}</p>`:''}
    <h3>Cine răspunde de date</h3><p>${esc(LEGAL.operator)}. Pentru orice întrebare despre datele tale scrie-ne la ${contact()}.</p>
    <h3>Ce date păstrăm</h3><ul><li>Adresa de email și numele, când îți faci cont (sau datele de bază ale contului Google, dacă intri cu Google).</li><li>Datele pe care le scrii tu: ofertele de credit, cheltuielile și veniturile, planul lunar, borcanele, provocările și setările.</li><li>Câte întrebări ai pus asistentului AI în fiecare zi și volumul lor, ca să putem aplica limita zilnică.</li></ul>
    <p>Nu cerem și nu păstrăm date de card, parole bancare sau acte de identitate. Contractele pe care le analizezi se citesc pe dispozitivul tău și nu se salvează în cont.</p>
    <h3>Unde se păstrează</h3><p>Fără cont, datele rămân doar în browserul tău. Cu cont, se păstrează în baza de date a serviciului Supabase, pe servere din Uniunea Europeană (Frankfurt, Germania). Fiecare persoană poate vedea și schimba doar datele ei.</p>
    <h3>Asistentul AI</h3><p>Când trimiți o întrebare, textul întrebării și doar datele pe care le-ai permis în „Acces la datele tale” sunt trimise către Anthropic, furnizorul modelului Claude, ca să se genereze răspunsul. Pasajele sau pozele unui contract se trimit doar după ce confirmi. Conversația nu se salvează în contul tău.</p>
    <h3>Ce nu facem</h3><p>Nu vindem datele, nu le folosim pentru reclame și nu folosim cookie-uri de urmărire. Browserul păstrează doar sesiunea de conectare și datele tale locale.</p>
    <h3>Cât timp le păstrăm</h3><p>Cât timp ai cont. Din pagina Cont poți descărca oricând o copie a datelor și poți șterge contul: atunci datele tale se șterg din baza de date. Copiile de siguranță ale furnizorului se rescriu după o perioadă limitată.</p>
    <h3>Drepturile tale</h3><p>Poți cere acces la date, corectarea sau ștergerea lor, o copie într-un format ușor de folosit și poți retrage acordul pentru asistent oricând. Poți depune o plângere la autoritatea pentru protecția datelor cu caracter personal din țara ta.</p>
  </div>`}
  function termsHtml(){return `<div class="legal">
    ${LEGAL.reviewed?'':'<p class="note">Versiune preliminară.</p>'}${today?`<p class="muted">Ultima actualizare: ${esc(today)}</p>`:''}
    <h3>Ce este EcoFin</h3><p>EcoFin oferă instrumente gratuite de calcul și educație financiară: compararea creditelor, contabilitate personală, plan lunar, economii și analiza contractelor. Este oferit de ${esc(LEGAL.operator)}.</p>
    <h3>Nu este consultanță</h3><p>Calculele și explicațiile au rol informativ. Nu sunt consultanță financiară, juridică sau fiscală și nu înlocuiesc oferta oficială a creditorului: condițiile finale le stabilește creditorul, prin contract. Ofertele marcate „Exemplu” sunt fictive.</p>
    <h3>Asistentul AI</h3><p>Asistentul poate greși. Verifică informațiile importante în documentele oficiale. Fiecare persoană are o limită zilnică de întrebări.</p>
    <h3>Contul tău</h3><p>Ai grijă de parola ta și nu o împărți. Poți folosi EcoFin și fără cont. Poți șterge contul oricând, din pagina Cont.</p>
    <h3>Folosire corectă</h3><p>Nu încerca să accesezi datele altor persoane, să supraîncarci serviciul sau să folosești asistentul în alt scop decât cel al site-ului. Putem suspenda conturile care fac asta.</p>
    <h3>Disponibilitate și schimbări</h3><p>Serviciul este oferit așa cum este, fără garanția că va funcționa fără întreruperi. Când schimbăm acești termeni, anunțăm pe site.</p>
    <h3>Contact</h3><p>${contact()}</p>
  </div>`}
  function openLegal(which){Modal.open({eyebrow:'EcoFin',title:which==='terms'?'Termeni de utilizare':'Politica de confidențialitate',html:which==='terms'?termsHtml():privacyHtml(),size:'read'})}

  /* ---------- the account page (web) ---------- */
  function accountIntro(signed,me){
    if(signed)return `<p class="muted" style="margin:6px 0 4px;max-width:58ch">Datele tale se salvează privat în contul tău EcoFin, pe servere din UE. Doar tu le vezi, de pe orice dispozitiv.</p>${me.email?`<p class="muted num" style="margin:0 0 12px;font-size:14px">${esc(me.email)}</p>`:''}`;
    return `<p class="muted" style="margin:6px 0 12px;max-width:58ch">Fără cont, datele rămân doar în acest browser. Fă-ți un cont gratuit ca să le salvezi și să le vezi pe orice dispozitiv; ce ai notat deja trece automat în cont.</p><div class="row" style="margin-bottom:12px"><button class="pill solid" type="button" data-auth="up">Creează cont</button><button class="pill" type="button" data-auth="in">Intră în cont</button></div>`;
  }
  function accountExtra(signed){
    const links=`<p class="muted" style="font-size:14px;margin:0"><button type="button" class="link" data-legal="privacy">Politica de confidențialitate</button> · <button type="button" class="link" data-legal="terms">Termenii de utilizare</button></p>`;
    if(!signed)return `<section class="panel pad stack-gap"><h2 class="h2s">Despre datele tale</h2>${links}</section>`;
    const u=Web.usage?`<p class="muted" style="margin:0;font-size:14px">Asistentul AI: ${Web.usage.used} din ${Web.usage.limit} cereri folosite azi.</p>`:'';
    return `<section class="panel pad stack-gap"><h2 class="h2s">Contul tău</h2>${u}
      <div class="row"><button class="pill" type="button" id="webSignOut">Ieși din cont</button></div>${links}
      <div class="set-row"><div><b>Șterge contul</b><span>Șterge contul și toate datele salvate în el. Nu se poate anula. Descarcă mai întâi o copie, dacă vrei să le păstrezi.</span></div><button class="pill sm danger" type="button" id="webDelete">Șterge contul</button></div>
      <div id="webDelMsg"></div></section>`;
  }

  /* ---------- wiring ---------- */
  function bind(){
    document.addEventListener('click',async e=>{
      const a=e.target.closest('[data-auth]');
      if(a){e.preventDefault();openAuth(a.dataset.auth);return}
      const l=e.target.closest('[data-legal]');
      if(l){e.preventDefault();openLegal(l.dataset.legal);return}
      // the hero's "log-in" goes to the sign-in form while nobody is signed in
      const hero=e.target.closest('.hero-cta a[href="#cont"]');
      if(hero&&!user&&configured){e.preventDefault();openAuth('in');return}
      if(e.target.closest('#webSignOut')){signOut();return}
      const d=e.target.closest('#webDelete');
      if(d){
        if(!armConfirm(d,'Sigur? Apasă din nou'))return;
        d.disabled=true;d.textContent='Se șterge…';
        try{await deleteAccount();toast('Contul și datele au fost șterse.');setTimeout(()=>{location.hash='acasa';location.reload()},900)}
        catch(err){d.disabled=false;d.textContent='Șterge contul';$('#webDelMsg').innerHTML='<p class="err">Nu am putut șterge contul acum. Încearcă din nou peste puțin timp.</p>'}
      }
    });
    const foot=$('#siteFoot');
    if(foot&&!foot.querySelector('[data-legal]'))foot.insertAdjacentHTML('beforeend',' <span class="foot-links"><button type="button" class="link" data-legal="privacy">Confidențialitate</button> · <button type="button" class="link" data-legal="terms">Termeni</button></span>');
    ready.then(()=>{
      if(landing.error){const exp=/expired|invalid/i.test(landing.error+landing.errorCode);setTimeout(()=>openAuth(landing.type==='recovery'?'reset':'in',null),200);if(exp)setTimeout(()=>toast('Linkul a expirat sau a fost deja folosit. Cere unul nou.'),400)}
      else if(user&&landing.type==='signup')setTimeout(()=>toast('Contul e activat. Bine ai venit!'),400);
    });
  }
  return{on:true,configured,ready,openAuth,openLegal,signOut,accountIntro,accountExtra,bind,signed:()=>!!user,usage:null};
})();
