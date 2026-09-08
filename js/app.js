/* ============================================================
   Shark Tank G1 — versión sitio estático + Supabase
   No hay paso de compilación: esto es JavaScript plano que corre
   tal cual en el navegador. Ver README.md para la lista de
   pendientes de seguridad dejados a propósito.
   ============================================================ */

/* ---------- Modelo de calificación (NO TOCAR sin acuerdo del área) ---------- */
const TIPOS = ['Producto','Proceso','Canales','Modelo de negocio','Experiencia de usuario'];
const CRITERIA = [
  {name:"Impacto potencial", q:"¿Cuál es la magnitud del impacto esperado para Postobón?", accent:"var(--cyan)", opts:["Limitado","","Relevante","","Altamente significativo"]},
  {name:"Relación beneficio–recursos", q:"¿En qué medida los beneficios esperados justifican la inversión, el tiempo y los demás recursos requeridos?", accent:"var(--purple)", opts:["No justifican","","Razonablemente","","Ampliamente"]},
  {name:"Contribución estratégica", q:"¿En qué medida la iniciativa contribuye a las prioridades estratégicas de Postobón?", accent:"var(--pink)", opts:["Limitada","","Parcial","","Directa y significativa"]},
  {name:"Viabilidad", q:"¿Qué tan factible es implementar la iniciativa, considerando su complejidad y el acceso a las capacidades requeridas?", accent:"var(--gold)", opts:["Barreras importantes","","Viable con ajustes","","Ruta clara y viable"]}
];
const DECISIONES = [
  {id:'avanza', label:'Priorizar', color:'#2CB1AE'},
  {id:'resolver', label:'Resolver barreras', color:'#FFD347'},
  {id:'banco', label:'Banco de iniciativas', color:'#3182D3'},
  {id:'no_prioriza', label:'No priorizar', color:'#FF4382'}
];
const QUAD_META = {
  avanza:{label:'Priorizar', bg:'#C1F0F0', text:'#2CB1AE'},
  resolver:{label:'Resolver barreras', bg:'#FFF9E6', text:'#FFD347'},
  banco:{label:'Banco de iniciativas', bg:'#CADFF4', text:'#3182D3'},
  no_prioriza:{label:'No priorizar', bg:'#FFD1E0', text:'#FF4382'}
};
const HORIZON_TARGET = {incremental:70, adyacente:20, disruptivo:10};

// Freno contra clics accidentales en la pantalla del facilitador — NO es
// seguridad real: este archivo es público y cualquiera puede leer esta clave
// en el código fuente. Ver README.md, sección "Pendientes de seguridad".
const FACILITADOR_PIN = 'IDEAR';

function avg(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function computeAgg(votes){
  const I = avg(votes.map(v=>v.i1)), B = avg(votes.map(v=>v.i2)), C = avg(votes.map(v=>v.i3)), V = avg(votes.map(v=>v.i4));
  const puntaje1_5 = 0.30*I + 0.20*B + 0.30*C + 0.20*V;
  const puntaje = votes.length ? Math.round(25*(puntaje1_5-1)) : null;
  const x1_5 = (30*I + 20*B + 30*C)/80;
  const x = votes.length ? Math.round(25*(x1_5-1)) : null;
  const y = votes.length ? Math.round(25*(V-1)) : null;
  let cuadrante = null;
  if (votes.length){
    if (x>=50 && y>=50) cuadrante='avanza';
    else if (x<50 && y>=50) cuadrante='banco';
    else if (x>=50 && y<50) cuadrante='resolver';
    else cuadrante='no_prioriza';
  }
  return {I,B,C,V,puntaje,x,y,cuadrante,n:votes.length};
}
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function uuid(){
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

/* ---------- Identidad persistente (localStorage) ---------- */
const IDENT_KEY = 'stg1_identidad';
function getIdentidad(){ try { return JSON.parse(localStorage.getItem(IDENT_KEY)); } catch(e){ return null; } }
function setIdentidad(obj){ try { localStorage.setItem(IDENT_KEY, JSON.stringify(obj)); } catch(e){} }
function clearIdentidad(){ try { localStorage.removeItem(IDENT_KEY); } catch(e){} }

/* ---------- Burbujas de fondo ---------- */
(function makeBubbles(){
  const fizz = document.getElementById('fizz');
  if (!fizz) return;
  let html = '';
  for (let i=0; i<16; i++){
    const sz = 6 + ((i*37)%34);
    html += `<b style="left:${(i*61)%100}%;width:${sz}px;height:${sz}px;animation-duration:${8+((i*53)%12)}s;animation-delay:${-((i*29)%12)}s"></b>`;
  }
  fizz.innerHTML = html;
})();

document.getElementById('datelabel').textContent = new Date().toLocaleDateString('es-CO', {day:'numeric', month:'long', year:'numeric'});

/* ---------- Arranque ---------- */
const sb = window.supabase.createClient(window.STG1_CONFIG.SUPABASE_URL, window.STG1_CONFIG.SUPABASE_ANON_KEY);
const bodyEl = document.getElementById('appbody');
const changeRoleBtn = document.getElementById('changerolebtn');
changeRoleBtn.onclick = () => { clearIdentidad(); location.href = location.pathname; };

const params = new URLSearchParams(location.search);
const modoProyeccion = params.get('modo') === 'proyeccion';
const vpParam = params.get('vp');

if (modoProyeccion){
  document.body.classList.add('modo-proyeccion');
  runProyeccion();
} else {
  boot();
}

async function boot(){
  const ident = getIdentidad();
  if (ident && ident.participante_id){
    const {data, error} = await sb.from('sala').select('participante_id').eq('participante_id', ident.participante_id).maybeSingle();
    if (!error && data){
      changeRoleBtn.style.display = '';
      dispatch(ident);
      return;
    }
    // Ya no existe (por ejemplo, el facilitador vació la sala) — hay que volver a entrar.
    clearIdentidad();
  }
  if (vpParam){
    const {data: vp, error} = await sb.from('vp_directorio').select('*').eq('id', vpParam).maybeSingle();
    if (!error && vp){
      await registrar({rol:'vp', vp_id: vp.id, nombre_mostrado: vp.nombre});
      return;
    }
  }
  runRolePicker();
}

async function registrar({rol, vp_id, nombre_mostrado}){
  const participante_id = uuid();
  const {error} = await sb.from('sala').insert({participante_id, rol, vp_id: vp_id||null, nombre_mostrado});
  if (error){
    bodyEl.innerHTML = `<div class="dash centercard"><p>No se pudo conectar con la sala.</p><p class="note">${esc(error.message)}</p></div>`;
    return;
  }
  const ident = {participante_id, rol, vp_id: vp_id||null, nombre_mostrado};
  setIdentidad(ident);
  changeRoleBtn.style.display = '';
  dispatch(ident);
}

function dispatch(ident){
  if (ident.rol === 'facilitador') runFacilitadorView(ident);
  else runVpView(ident);
}

/* ============ SELECTOR DE ROL ============ */
async function runRolePicker(){
  bodyEl.innerHTML = '<div class="dash centercard"><p>Cargando…</p></div>';
  const {data: vps, error} = await sb.from('vp_directorio').select('*').order('nombre', {ascending:true});
  if (error){
    bodyEl.innerHTML = `<div class="dash centercard"><p>No se pudo cargar el directorio de VPs.</p><p class="note">${esc(error.message)}</p></div>`;
    return;
  }
  const vpItems = (vps||[]).map(v => `<button class="opt" data-vp="${esc(v.id)}"><span class="lbl">${esc(v.nombre)}</span></button>`).join('');
  bodyEl.innerHTML = `
    <div class="dash rolepick" style="max-width:704px;margin:0 auto;">
      <p class="smallhead" style="font-size:13.5px;">Selecciona tu rol</p>
      <div class="optlist" style="gap:9px;">
        ${vpItems}
        <div class="opt otheropt">
          <span class="lbl">Invitado</span>
          <input type="text" id="invitadonombre" class="textinput" placeholder="Tu nombre" style="height:36px;">
          <button class="btn" id="invitadobtn" style="width:100%;">Entrar</button>
        </div>
      </div>
      <div class="opt otheropt" style="border-color:var(--cyan);margin-top:9px;">
        <span class="lbl">Facilitador</span>
        <input type="password" id="facpin" class="textinput" placeholder="Clave del facilitador" style="height:36px;">
        <button class="btn" id="facpinbtn" style="width:100%;">Entrar</button>
        <span id="facpinerror" style="display:none;" class="err">Clave incorrecta, intenta de nuevo.</span>
      </div>
    </div>
  `;
  bodyEl.querySelectorAll('[data-vp]').forEach(btn => {
    btn.onclick = () => {
      const vp = (vps||[]).find(v => v.id === btn.dataset.vp);
      registrar({rol:'vp', vp_id: vp.id, nombre_mostrado: vp.nombre});
    };
  });
  document.getElementById('invitadobtn').onclick = () => {
    const nombre = document.getElementById('invitadonombre').value.trim();
    if (!nombre) return;
    registrar({rol:'invitado', vp_id:null, nombre_mostrado: nombre});
  };
  const pinInput = document.getElementById('facpin');
  const tryFacilitador = () => {
    if (pinInput.value === FACILITADOR_PIN){
      registrar({rol:'facilitador', vp_id:null, nombre_mostrado:'Facilitador'});
    } else {
      document.getElementById('facpinerror').style.display = 'block';
      pinInput.value = '';
      pinInput.focus();
    }
  };
  document.getElementById('facpinbtn').onclick = tryFacilitador;
  pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryFacilitador(); });
}

/* ============ VISTA VP ============ */
function runVpView(ident){
  bodyEl.innerHTML = `
    <div class="stage"><div class="phone" id="phone">
      <div class="phone-notch"></div>
      <div id="phoneinner"><div class="centercard"><p>Cargando…</p></div></div>
    </div></div>
    <p class="hint">Selecciona una respuesta para avanzar automáticamente</p>
  `;
  const phoneinner = document.getElementById('phoneinner');
  let estado = null, iniciativaActiva = null, localIdx = 0, sel = {}, yaVotado = false, lastIniId = undefined;

  async function cargarEstado(){
    const {data} = await sb.from('estado_sesion').select('*').eq('id', 1).single();
    estado = data;
    if (estado && estado.iniciativa_activa_id){
      const {data: ini} = await sb.from('iniciativas').select('*').eq('id', estado.iniciativa_activa_id).maybeSingle();
      iniciativaActiva = ini;
    } else {
      iniciativaActiva = null;
    }
    const iniId = iniciativaActiva ? iniciativaActiva.id : null;
    if (iniId !== lastIniId){
      lastIniId = iniId;
      localIdx = 0; sel = {}; yaVotado = false;
      if (iniId){
        const {data: voto} = await sb.from('votos').select('iniciativa_id').eq('iniciativa_id', iniId).eq('participante_id', ident.participante_id).maybeSingle();
        yaVotado = !!voto;
      }
    }
    render();
  }

  function render(){
    if (!estado || estado.fase !== 'votando' || !iniciativaActiva){
      if (estado && estado.fase === 'reveal'){
        phoneinner.innerHTML = '<div class="centercard"><div class="checkring">✓</div><h3>Sesión terminada</h3><p>Gracias por participar. Los resultados se revisan en la pantalla del Comité.</p></div>';
      } else {
        phoneinner.innerHTML = `<div class="centercard"><h3>Esperando que inicie la sesión</h3><p>Esta pantalla se actualizará sola cuando el facilitador comience. Hola, ${esc(ident.nombre_mostrado)}.</p></div>`;
      }
      return;
    }
    if (yaVotado){
      phoneinner.innerHTML = '<div class="centercard"><div class="checkring">✓</div><h3>Calificación registrada</h3><p>Los resultados quedan ocultos hasta que termine el último pitch de la sesión.</p></div>';
      return;
    }
    const ini = iniciativaActiva;
    const progressHtml = CRITERIA.map((c,i) => `<i class="${i<localIdx?'done':(i===localIdx?'active':'')}" style="--accent:${c.accent}"></i>`).join('');
    const c = CRITERIA[localIdx];
    let opts = '';
    for (let n=1;n<=5;n++){
      const raw = c.opts[n-1];
      const isMid = raw === '';
      const label = isMid ? 'Posición intermedia' : raw;
      const isSel = sel[localIdx] === n;
      opts += `<button class="opt${isSel?' sel':''}" data-v="${n}"><span class="num">${n}</span><span class="lbl${isMid?' mid':''}">${label}</span></button>`;
    }
    phoneinner.innerHTML = `
      <div class="qheader">
        <button class="backbtn" id="backbtn" ${localIdx===0?'disabled':''}>←</button>
        <div class="progress">${progressHtml}</div>
      </div>
      <span class="badge">${esc(ini.tipo)} · ${esc(ini.nombre)}</span>
      <div class="qview active" style="--accent:${c.accent}">
        <p class="qnum">Pregunta ${localIdx+1} de ${CRITERIA.length}</p>
        <p class="qname">${esc(c.name)}</p>
        <p class="qtext">${esc(c.q)}</p>
        <div class="optlist">${opts}</div>
      </div>
    `;
    document.getElementById('backbtn').onclick = () => { if (localIdx>0){ localIdx--; render(); } };
    phoneinner.querySelectorAll('.opt').forEach(btn => {
      btn.onclick = () => {
        sel[localIdx] = Number(btn.dataset.v);
        if (localIdx < CRITERIA.length-1){
          setTimeout(() => { localIdx++; render(); }, 380);
          render();
        } else {
          setTimeout(async () => {
            yaVotado = true;
            render();
            await sb.from('votos').upsert({
              iniciativa_id: ini.id, participante_id: ident.participante_id,
              i1: sel[0], i2: sel[1], i3: sel[2], i4: sel[3]
            });
          }, 380);
          render();
        }
      };
    });
  }

  cargarEstado();
  sb.channel('vp-estado-'+ident.participante_id)
    .on('postgres_changes', {event:'*', schema:'public', table:'estado_sesion'}, cargarEstado)
    .subscribe();
}

/* ---------- Dibujo del plano de decisión + lista de puntajes (compartido entre
   la vista de facilitador y el modo proyección, que corren en pestañas/páginas
   distintas, así que esta función vive a nivel superior, no anidada) ---------- */
function construirPlanoYScoreRows(aggs, decisionesPorIni, conBotonesDecision){
  const svgPoints = aggs.map((a,i) => {
    if (a.x===null) return '';
    const PAD = 16;
    const px = 60 + PAD + (a.x/100)*(560-2*PAD);
    const py = 20 + PAD + (1-a.y/100)*(360-2*PAD);
    const meta = QUAD_META[a.cuadrante];
    return `<circle cx="${px}" cy="${py}" r="11" fill="${meta.text}" filter="url(#dotshadow)"/><text x="${px}" y="${py+4}" text-anchor="middle" font-size="13" font-weight="800" fill="#ffffff">${i+1}</text>`;
  }).join('');
  const svg = `
    <svg viewBox="-10 -22 700 446" style="width:100%;max-width:620px;display:block;margin:0 auto 1.8rem;">
      <defs><filter id="dotshadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#04202e" flood-opacity="0.4"/></filter></defs>
      <text x="509" y="7" text-anchor="end" font-size="38" font-weight="500" fill="#86959E">${aggs.length}</text>
      <text x="527" y="-10" text-anchor="start" font-size="14" font-weight="600" fill="#9fc3d6">Iniciativas</text>
      <text x="527" y="7" text-anchor="start" font-size="14" font-weight="600" fill="#9fc3d6">evaluadas</text>
      <rect x="60" y="20" width="560" height="360" fill="#ffffff"/>
      <line x1="340" y1="20" x2="340" y2="380" stroke="#d9dee2" stroke-width="2"/>
      <line x1="60" y1="200" x2="620" y2="200" stroke="#d9dee2" stroke-width="2"/>
      <rect x="60" y="20" width="560" height="360" fill="none" stroke="#b3bec5"/>
      <text x="480" y="45" text-anchor="middle" font-size="18" font-weight="800" fill="#2CB1AE">Priorizar</text>
      <text x="200" y="45" text-anchor="middle" font-size="18" font-weight="800" fill="#3182D3">Banco de iniciativas</text>
      <text x="480" y="356" text-anchor="middle" font-size="18" font-weight="800" fill="#FFD347">Resolver barreras</text>
      <text x="200" y="356" text-anchor="middle" font-size="18" font-weight="800" fill="#FF4382">No priorizar</text>
      <text x="340" y="414" text-anchor="middle" font-size="17" font-weight="600" fill="#86959E">ATRACTIVO</text>
      <text x="26" y="200" text-anchor="middle" font-size="17" font-weight="600" fill="#86959E" transform="rotate(-90 26 200)">VIABILIDAD</text>
      ${svgPoints}
    </svg>
  `;
  const scoreRows = aggs.map((a,i) => {
    const meta = a.cuadrante ? QUAD_META[a.cuadrante] : {label:'Sin votos', text:'#7fa4b8'};
    const dec = decisionesPorIni[a.ini.id];
    const decisionrow = conBotonesDecision ? `
        <div class="decisionrow">
          ${DECISIONES.map(d => `<button class="decisionbtn" data-ini="${a.ini.id}" data-dec="${d.id}" style="color:${d.color};${dec===d.id?'border-color:'+d.color+';background:'+d.color+'22;':''}">${d.label}</button>`).join('')}
        </div>` : '';
    return `
      <div class="scorerow">
        <div class="toprow">
          <span class="num" style="background:${meta.text}">${i+1}</span>
          <div class="name"><b>${esc(a.ini.nombre)}</b><span>${esc(a.ini.tipo)}</span></div>
          <span class="score">${a.puntaje===null?'—':a.puntaje}</span>
          <span class="quad" style="background:${meta.text}22;color:${meta.text}">${meta.label}</span>
        </div>
        ${decisionrow}
      </div>
    `;
  }).join('');
  return {svg, scoreRows};
}

/* ============ VISTA FACILITADOR ============ */
function runFacilitadorView(ident){
  let estado = null, iniciativas = [], votosPorIni = {}, decisionesPorIni = {}, participanteNombreMap = {}, salaCount = 0;

  async function cargarTodo(){
    const [{data: est}, {data: inis}, {data: decs}, {data: salaRows}] = await Promise.all([
      sb.from('estado_sesion').select('*').eq('id', 1).single(),
      sb.from('iniciativas').select('*').order('orden', {ascending:true}),
      sb.from('decisiones').select('*'),
      sb.from('sala').select('*')
    ]);
    estado = est;
    iniciativas = inis || [];
    decisionesPorIni = {};
    (decs||[]).forEach(d => { decisionesPorIni[d.iniciativa_id] = d.decision_id; });
    participanteNombreMap = {};
    (salaRows||[]).forEach(r => { participanteNombreMap[r.participante_id] = r.nombre_mostrado; });
    salaCount = (salaRows||[]).filter(r => r.rol !== 'facilitador').length;
    if (iniciativas.length){
      const {data: votos} = await sb.from('votos').select('*').in('iniciativa_id', iniciativas.map(i=>i.id));
      votosPorIni = {};
      (votos||[]).forEach(v => { (votosPorIni[v.iniciativa_id] = votosPorIni[v.iniciativa_id]||[]).push(v); });
    } else {
      votosPorIni = {};
    }
    render();
  }

  function suscribir(){
    ['estado_sesion','iniciativas','votos','decisiones','sala'].forEach(tabla => {
      sb.channel('fac-'+tabla+'-'+ident.participante_id)
        .on('postgres_changes', {event:'*', schema:'public', table:tabla}, cargarTodo)
        .subscribe();
    });
  }

  async function actualizarEstado(patch){
    await sb.from('estado_sesion').update(patch).eq('id', 1);
  }

  function abrirProyeccion(){ window.open(location.pathname + '?modo=proyeccion', '_blank'); }

  function render(){
    if (!estado) return;
    if (estado.fase === 'espera') renderSetup();
    else if (estado.fase === 'votando') renderControl();
    else renderReveal();
  }

  function renderSetup(){
    bodyEl.innerHTML = `
      <div class="dash" style="max-width:704px;margin:0 auto;">
        <p class="smallhead">Preparar sesión — agregar iniciativas</p>
        <div class="row2">
          <div class="field" style="margin-bottom:0;"><label>Nombre de la iniciativa</label><input type="text" class="textinput" id="ininame" placeholder="Ej. Punto único de venta"></div>
          <div class="field" style="margin-bottom:0;"><label>Tipo</label><select class="select" id="initype">${TIPOS.map(t=>`<option>${esc(t)}</option>`).join('')}</select></div>
          <button class="btn" id="addbtn">Agregar</button>
        </div>
        <div class="inilist">
          ${iniciativas.length ? iniciativas.map((ini,i)=>`
            <div class="inirow"><b>${i+1}. ${esc(ini.nombre)}</b><span>${esc(ini.tipo)}</span><button class="rmbtn" data-id="${ini.id}">✕</button></div>
          `).join('') : '<p class="note" style="margin:0;">Aún no hay iniciativas agregadas.</p>'}
        </div>
        <p class="smallhead">Mix de horizonte actual del portafolio (%)</p>
        <div class="row2" style="grid-template-columns:1fr 1fr 1fr;">
          <div class="field" style="margin-bottom:0;"><label>Incremental</label><input type="number" class="textinput" id="hmix-inc" placeholder="% real" value="${estado.horizon_incremental ?? ''}"></div>
          <div class="field" style="margin-bottom:0;"><label>Adyacente</label><input type="number" class="textinput" id="hmix-ady" placeholder="% real" value="${estado.horizon_adyacente ?? ''}"></div>
          <div class="field" style="margin-bottom:0;"><label>Disruptivo</label><input type="number" class="textinput" id="hmix-dis" placeholder="% real" value="${estado.horizon_disruptivo ?? ''}"></div>
        </div>
        <button class="btn" id="startbtn" ${iniciativas.length===0?'disabled':''} style="width:100%;">Iniciar sesión</button>
        <p class="note"><span class="connectedbadge"><span class="dot"></span>${salaCount} conectados</span></p>
        <p class="note">
          <button class="linklike" id="proyeccionbtn">Abrir pantalla de proyección (QR de espera) ↗</button>
          &nbsp;·&nbsp;
          <button class="linklike" id="vaciarbtn">Vaciar sala</button>
        </p>
        <p class="note">Comparte el enlace de este sitio con el Comité, o proyecta el código QR desde "Abrir pantalla de proyección". La primera vez que cada persona entre, la herramienta le pedirá "Selecciona tu rol" y lo recordará desde entonces en ese dispositivo (aunque se le caiga el wifi o recargue la página).</p>
      </div>
    `;
    document.getElementById('addbtn').onclick = async () => {
      const nombre = document.getElementById('ininame').value.trim();
      const tipo = document.getElementById('initype').value;
      if (!nombre) return;
      await sb.from('iniciativas').insert({nombre, tipo, orden: iniciativas.length});
    };
    bodyEl.querySelectorAll('.rmbtn').forEach(b => {
      b.onclick = async () => { await sb.from('iniciativas').delete().eq('id', b.dataset.id); };
    });
    document.getElementById('startbtn').onclick = async () => {
      const hinc = Number(document.getElementById('hmix-inc').value)||0;
      const hady = Number(document.getElementById('hmix-ady').value)||0;
      const hdis = Number(document.getElementById('hmix-dis').value)||0;
      await actualizarEstado({
        horizon_incremental: hinc, horizon_adyacente: hady, horizon_disruptivo: hdis,
        fase: 'votando', iniciativa_activa_id: iniciativas[0].id
      });
    };
    document.getElementById('proyeccionbtn').onclick = abrirProyeccion;
    document.getElementById('vaciarbtn').onclick = async () => {
      if (!confirm('¿Vaciar la sala?\n\nEsto desconecta a todos los VPs e invitados (tendrán que volver a escanear el QR o abrir su enlace). Úsalo solo para limpiar pruebas antes del Comité real — no afecta al facilitador.')) return;
      await sb.from('sala').delete().in('rol', ['vp','invitado']);
    };
  }

  function renderControl(){
    const idx = iniciativas.findIndex(i => i.id === estado.iniciativa_activa_id);
    const ini = iniciativas[idx];
    const count = (votosPorIni[ini.id]||[]).length;
    const isLast = idx === iniciativas.length-1;
    bodyEl.innerHTML = `
      <div class="dash controlcard" style="max-width:704px;margin:0 auto;">
        <p class="smallhead" style="text-align:center;">Iniciativa ${idx+1} de ${iniciativas.length}</p>
        <h2>${esc(ini.nombre)}</h2>
        <p>${esc(ini.tipo)}</p>
        <div class="countbadge">${count} de ${salaCount} han respondido</div>
        <div>
          <button class="btn secondary" id="prevbtn" ${idx===0?'disabled':''}>← Iniciativa anterior</button>
          <button class="btn" id="nextbtn" style="margin-left:10px;">${isLast?'Ver reveal':'Siguiente iniciativa →'}</button>
        </div>
        <p class="note"><button class="linklike" id="proyeccionbtn">Abrir pantalla de proyección ↗</button></p>
      </div>
    `;
    document.getElementById('prevbtn').onclick = async () => { await actualizarEstado({iniciativa_activa_id: iniciativas[idx-1].id}); };
    document.getElementById('nextbtn').onclick = async () => {
      if (isLast) await actualizarEstado({fase:'reveal', iniciativa_activa_id:null});
      else await actualizarEstado({iniciativa_activa_id: iniciativas[idx+1].id});
    };
    document.getElementById('proyeccionbtn').onclick = abrirProyeccion;
  }

  function renderReveal(){
    const aggs = iniciativas.map(ini => Object.assign({ini}, computeAgg(votosPorIni[ini.id]||[])));
    const hm = {incremental: estado.horizon_incremental||0, adyacente: estado.horizon_adyacente||0, disruptivo: estado.horizon_disruptivo||0};
    const {svg, scoreRows} = construirPlanoYScoreRows(aggs, decisionesPorIni, true);
    let hmixRows = '';
    [['Incremental','incremental'],['Adyacente','adyacente'],['Disruptivo','disruptivo']].forEach(([label,key]) => {
      const target = HORIZON_TARGET[key];
      const real = Math.min(Math.max(hm[key],0),100);
      hmixRows += `<div class="hmix-row"><div class="label-row"><span>${label}</span><b>${hm[key]}%</b></div><div class="hmix-track"><div class="hmix-fill" style="width:${real}%;"></div><div class="hmix-target" style="left:${target}%;"></div><span class="hmix-target-label" style="left:${target}%;">${target}%</span></div></div>`;
    });
    bodyEl.innerHTML = `
      <div class="dash" style="max-width:704px;margin:0 auto;">
        <p class="smallhead" style="font-size:14.5px;color:var(--cyan);max-width:620px;margin:0 auto 14px;text-align:center;">DECISION ROUND</p>
        ${svg}
        <p class="smallhead" style="max-width:620px;margin:0 auto 14px;">Puntuación de las iniciativas</p>
        <div class="scorelist">${scoreRows}</div>
        <p class="smallhead" style="max-width:620px;margin:0 auto 14px;">Mix de horizonte vs. meta 70/20/10</p>
        <div class="hmix">${hmixRows}</div>
        <div style="max-width:620px;margin:0 auto;">
          <p class="note">Línea amarilla = meta corporativa</p>
          <div style="text-align:center;margin-top:20px;"><button class="btn secondary" id="downloadxlsxbtn">Descargar Excel</button></div>
          <div style="text-align:center;margin-top:16px;"><button class="btn secondary" id="nuevarondabtn">Nueva ronda</button></div>
          <p class="note" style="text-align:center;"><button class="linklike" id="proyeccionbtn">Abrir pantalla de proyección ↗</button></p>
        </div>
      </div>
    `;
    bodyEl.querySelectorAll('.decisionbtn').forEach(b => {
      b.onclick = async () => { await sb.from('decisiones').upsert({iniciativa_id: b.dataset.ini, decision_id: b.dataset.dec}); };
    });
    document.getElementById('proyeccionbtn').onclick = abrirProyeccion;
    document.getElementById('downloadxlsxbtn').onclick = () => descargarExcel(aggs);
    document.getElementById('nuevarondabtn').onclick = async () => {
      if (!confirm('¿Empezar una nueva ronda?\n\nEsto borra permanentemente las iniciativas, votos y decisiones de esta ronda de la base de datos (no se puede deshacer). Asegúrate de haber descargado el Excel antes de continuar.\n\nLos participantes conectados NO se desconectan — no tienen que volver a escanear el QR.')) return;
      const ids = iniciativas.map(i=>i.id);
      if (ids.length) await sb.from('iniciativas').delete().in('id', ids); // borra votos y decisiones en cascada
      await actualizarEstado({fase:'espera', iniciativa_activa_id:null, horizon_incremental:50, horizon_adyacente:30, horizon_disruptivo:20, ronda_id: uuid()});
    };
  }

  function descargarExcel(aggs){
    const dateStr = document.getElementById('datelabel').textContent;
    const sessionId = estado.ronda_id || dateStr;

    const resumenRows = [
      ['Fecha','Sesión','#','Iniciativa','Tipo','Votantes','Promedio Impacto','Promedio Beneficio-recursos','Promedio Contribución','Promedio Viabilidad','Coordenada X (Atractivo)','Coordenada Y (Viabilidad)','Puntaje','Cuadrante calculado','Decisión final']
    ];
    aggs.forEach((a, i) => {
      const decId = decisionesPorIni[a.ini.id];
      const decLabel = decId ? (DECISIONES.find(d=>d.id===decId)||{}).label : null;
      const quadLabel = a.cuadrante ? QUAD_META[a.cuadrante].label : 'Sin votos';
      resumenRows.push([
        dateStr, sessionId, i+1, a.ini.nombre, a.ini.tipo, a.n,
        a.n ? Math.round(a.I*100)/100 : '—', a.n ? Math.round(a.B*100)/100 : '—',
        a.n ? Math.round(a.C*100)/100 : '—', a.n ? Math.round(a.V*100)/100 : '—',
        a.x===null?'—':a.x, a.y===null?'—':a.y, a.puntaje===null?'—':a.puntaje,
        quadLabel, decLabel || 'Sin decisión registrada'
      ]);
    });
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
    wsResumen['!cols'] = [{wch:12},{wch:16},{wch:4},{wch:26},{wch:14},{wch:9},{wch:11},{wch:14},{wch:11},{wch:11},{wch:11},{wch:11},{wch:9},{wch:18},{wch:20}];

    const detalleRows = [
      ['Fecha','Sesión','#','Iniciativa','Tipo','Participante','Impacto potencial (1-5)','Beneficio-recursos (1-5)','Contribución estratégica (1-5)','Viabilidad (1-5)','Puntaje del participante (0-100)']
    ];
    aggs.forEach((a, i) => {
      const votos = votosPorIni[a.ini.id] || [];
      votos.forEach(v => {
        const nombre = participanteNombreMap[v.participante_id] || 'Participante';
        const puntajeVp = Math.round(25*((0.30*v.i1 + 0.20*v.i2 + 0.30*v.i3 + 0.20*v.i4) - 1));
        detalleRows.push([dateStr, sessionId, i+1, a.ini.nombre, a.ini.tipo, nombre, v.i1, v.i2, v.i3, v.i4, puntajeVp]);
      });
    });
    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows);
    wsDetalle['!cols'] = [{wch:12},{wch:16},{wch:4},{wch:26},{wch:14},{wch:28},{wch:12},{wch:12},{wch:14},{wch:11},{wch:12}];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen por iniciativa');
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle por VP');
    const arrayBuf = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    const blob = new Blob([arrayBuf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Shark Tank G1 - resumen.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  cargarTodo();
  suscribir();
}

/* ============ MODO PROYECCIÓN (pantalla del salón, solo lectura) ============ */
function runProyeccion(){
  changeRoleBtn.style.display = 'none';
  bodyEl.innerHTML = '<div class="dash centercard"><p>Cargando…</p></div>';
  let estado = null, iniciativas = [], votosPorIni = {}, decisionesPorIni = {}, salaCount = 0;

  async function cargar(){
    const [{data: est}, {data: inis}, {data: decs}] = await Promise.all([
      sb.from('estado_sesion').select('*').eq('id', 1).single(),
      sb.from('iniciativas').select('*').order('orden', {ascending:true}),
      sb.from('decisiones').select('*')
    ]);
    estado = est;
    iniciativas = inis || [];
    decisionesPorIni = {};
    (decs||[]).forEach(d => { decisionesPorIni[d.iniciativa_id] = d.decision_id; });
    if (iniciativas.length){
      const {data: votos} = await sb.from('votos').select('*').in('iniciativa_id', iniciativas.map(i=>i.id));
      votosPorIni = {};
      (votos||[]).forEach(v => { (votosPorIni[v.iniciativa_id] = votosPorIni[v.iniciativa_id]||[]).push(v); });
    } else {
      votosPorIni = {};
    }
    const {count} = await sb.from('sala').select('*', {count:'exact', head:true}).in('rol', ['vp','invitado']);
    salaCount = count || 0;
    render();
  }

  function render(){
    if (!estado) return;
    if (estado.fase === 'espera') renderEspera();
    else if (estado.fase === 'votando') renderVotando();
    else renderRevealProyeccion();
  }

  function renderEspera(){
    const url = location.origin + location.pathname;
    let qrSvg = '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      qrSvg = qr.createSvgTag(6);
    } catch(e){
      qrSvg = '<p>No se pudo generar el QR</p>';
    }
    bodyEl.innerHTML = `
      <div class="dash qrcard" style="max-width:900px;margin:0 auto;">
        <h2>Escanea para unirte</h2>
        <div class="qrbox">${qrSvg}</div>
        <p>${esc(url)}</p>
        <span class="connectedbadge"><span class="dot"></span>${salaCount} conectados</span>
      </div>
    `;
  }

  function renderVotando(){
    const idx = iniciativas.findIndex(i => i.id === estado.iniciativa_activa_id);
    const ini = iniciativas[idx];
    if (!ini){ bodyEl.innerHTML = '<div class="dash centercard"><p>Preparando…</p></div>'; return; }
    const count = (votosPorIni[ini.id]||[]).length;
    bodyEl.innerHTML = `
      <div class="dash controlcard" style="max-width:900px;margin:0 auto;">
        <p class="smallhead" style="text-align:center;">Iniciativa ${idx+1} de ${iniciativas.length}</p>
        <h2>${esc(ini.nombre)}</h2>
        <p>${esc(ini.tipo)}</p>
        <div class="countbadge">${count} de ${salaCount} han respondido</div>
      </div>
    `;
  }

  function renderRevealProyeccion(){
    const aggs = iniciativas.map(ini => Object.assign({ini}, computeAgg(votosPorIni[ini.id]||[])));
    // Reusa el mismo dibujo de plano/score que el facilitador, sin botones de decisión.
    const {svg, scoreRows} = construirPlanoYScoreRows(aggs, decisionesPorIni, false);
    bodyEl.innerHTML = `
      <div class="dash" style="max-width:900px;margin:0 auto;">
        <p class="smallhead" style="font-size:14.5px;color:var(--cyan);max-width:800px;margin:0 auto 14px;text-align:center;">DECISION ROUND</p>
        ${svg}
        <p class="smallhead" style="max-width:800px;margin:0 auto 14px;">Puntuación de las iniciativas</p>
        <div class="scorelist" style="max-width:800px;">${scoreRows}</div>
      </div>
    `;
  }

  cargar();
  ['estado_sesion','iniciativas','votos','decisiones','sala'].forEach(tabla => {
    sb.channel('proy-'+tabla).on('postgres_changes', {event:'*', schema:'public', table:tabla}, cargar).subscribe();
  });
}
