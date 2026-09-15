/* ============================================================
   Shark Tank G1 — versión sitio estático + Supabase
   No hay paso de compilación: esto es JavaScript plano que corre
   tal cual en el navegador. Ver README.md para la lista de
   pendientes de seguridad dejados a propósito.
   ============================================================ */

/* ---------- Modelo de calificación (NO TOCAR sin acuerdo del área) ---------- */
const TIPOS = ['Producto','Proceso','Canales','Modelo de negocio','Experiencia de usuario'];
// Los 4 criterios se muestran como referencia al VP antes de votar (ya no se
// califican uno por uno de 1 a 5 — el VP vota directo una de las 3 opciones).
const CRITERIA = [
  {name:"Impacto potencial", q:"¿Cuál es la magnitud del impacto esperado para Postobón?", accent:"var(--cyan)"},
  {name:"Relación beneficio–recursos", q:"¿En qué medida los beneficios esperados justifican la inversión, el tiempo y los demás recursos requeridos?", accent:"var(--purple)"},
  {name:"Contribución estratégica", q:"¿En qué medida la iniciativa contribuye a las prioridades estratégicas de Postobón?", accent:"var(--pink)"},
  {name:"Viabilidad", q:"¿Qué tan factible es implementar la iniciativa, considerando su complejidad y el acceso a las capacidades requeridas?", accent:"var(--gold)"}
];
const DECISIONES = [
  {id:'priorizar', label:'Priorizar', color:'#2CB1AE'},
  {id:'resolver', label:'Resolver barreras', color:'#FFD347'},
  {id:'descartar', label:'Descartar', color:'#FF4382'}
];
// Orden fijo en el que aparecen los botones de "Selecciona tu rol" (Presidente
// primero, luego las VPs, luego COE y Riesgos). Cualquier id del directorio
// que no esté en esta lista (un rol nuevo que se agregue después) cae al
// final, en orden alfabético.
const ORDEN_ROLES = ['presidente','tecnica_innovacion','generacion_demanda','logistica_fp','ventas','gestion_humana','administrativa_financiera','juridica_ac','coe','riesgos_cumplimiento'];

// Freno contra clics accidentales en la pantalla del facilitador — NO es
// seguridad real: este archivo es público y cualquiera puede leer esta clave
// en el código fuente. Ver README.md, sección "Pendientes de seguridad".
const FACILITADOR_PIN = 'IDEAR';

function tallyVotes(votos){
  const counts = {priorizar:0, resolver:0, descartar:0};
  votos.forEach(v => { if (v.voto && counts.hasOwnProperty(v.voto)) counts[v.voto]++; });
  return {counts, n: votos.length};
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
  // Para un VP, el id de participante es fijo por rol (no al azar): si esa
  // misma persona entra desde otro celular/navegador (o le tocó recargar
  // borrando el localStorage), reconecta la MISMA fila en vez de crear una
  // nueva — así el contador de conectados no se llena de duplicados con el
  // paso de los días. Invitados y facilitador sí usan un id nuevo cada vez,
  // porque no son un rol fijo enumerable.
  const participante_id = (rol === 'vp' && vp_id) ? ('vp-' + vp_id) : uuid();
  const {error} = await sb.from('sala').upsert({participante_id, rol, vp_id: vp_id||null, nombre_mostrado, conectado_en: new Date().toISOString()});
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
  const {data: vps, error} = await sb.from('vp_directorio').select('*');
  if (error){
    bodyEl.innerHTML = `<div class="dash centercard"><p>No se pudo cargar el directorio de VPs.</p><p class="note">${esc(error.message)}</p></div>`;
    return;
  }
  const vpsOrdenados = (vps||[]).slice().sort((a,b) => {
    const ia = ORDEN_ROLES.indexOf(a.id), ib = ORDEN_ROLES.indexOf(b.id);
    if (ia===-1 && ib===-1) return a.nombre.localeCompare(b.nombre);
    if (ia===-1) return 1;
    if (ib===-1) return -1;
    return ia-ib;
  });
  const vpItems = vpsOrdenados.map(v => `<button class="opt" data-vp="${esc(v.id)}"><span class="lbl">${esc(v.nombre)}</span></button>`).join('');
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
  `;
  const phoneinner = document.getElementById('phoneinner');
  let estado = null, iniciativaActiva = null, yaVotado = false, enviando = false, seleccionado = null, lastIniId = undefined;

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
      yaVotado = false;
      enviando = false;
      seleccionado = null;
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
      phoneinner.innerHTML = '<div class="centercard"><div class="checkring">✓</div><h3>Voto registrado</h3><p>Los resultados quedan ocultos hasta que termine el último pitch de la sesión.</p></div>';
      return;
    }
    const ini = iniciativaActiva;
    const roleLabel = ident.rol === 'invitado' ? `Invitado · ${ident.nombre_mostrado}` : ident.nombre_mostrado;
    const criterios = CRITERIA.map(c => `
      <div class="criteriaitem">
        <b>${esc(c.name)}</b>
        <span>${esc(c.q)}</span>
      </div>
    `).join('');
    phoneinner.innerHTML = `
      <span class="badge">${esc(roleLabel)}</span>
      <p class="ininame">${esc(ini.nombre)}</p>
      <div class="criterialist">${criterios}</div>
      <p class="votehint">Considerando estos cuatro criterios, ¿qué decisión recomiendas para esta iniciativa?</p>
      <div class="voteoptions">
        ${DECISIONES.map(d => `<button class="votebtn${seleccionado===d.id?' sel':''}" data-dec="${d.id}" style="--vc:${d.color}">${esc(d.label)}</button>`).join('')}
      </div>
    `;
    phoneinner.querySelectorAll('.votebtn').forEach(btn => {
      btn.onclick = () => {
        if (enviando) return;
        enviando = true;
        seleccionado = btn.dataset.dec;
        render();
        setTimeout(async () => {
          yaVotado = true;
          render();
          await sb.from('votos').upsert({
            iniciativa_id: ini.id, participante_id: ident.participante_id, voto: seleccionado
          });
        }, 380);
      };
    });
  }

  cargarEstado();
  sb.channel('vp-estado-'+ident.participante_id)
    .on('postgres_changes', {event:'*', schema:'public', table:'estado_sesion'}, cargarEstado)
    .subscribe();
}

/* ---------- Resumen de votos por iniciativa (compartido entre la vista de
   facilitador y el modo proyección, que corren en pestañas/páginas distintas,
   así que esta función vive a nivel superior, no anidada) ---------- */
function construirResumenVotos(items, decisionesPorIni, conBotonesDecision){
  return items.map((it,i) => {
    const dec = decisionesPorIni[it.ini.id];
    const total = it.n || 0;
    const barHtml = total
      ? DECISIONES.map(d => `<div class="voteseg" style="flex:${it.counts[d.id]};background:${d.color};"></div>`).join('')
      : '<div class="voteseg empty"></div>';
    const pctHtml = DECISIONES.map(d => {
      const c = it.counts[d.id]||0;
      const pct = total ? Math.round((c/total)*100) : 0;
      return `<div class="votepct" style="flex:${total ? (c||0.0001) : 1};color:${d.color}">${pct}%</div>`;
    }).join('');
    const countsHtml = DECISIONES.map(d => `<span style="color:${d.color}">${it.counts[d.id]||0} · ${esc(d.label)}</span>`).join('');
    const decisionrow = conBotonesDecision ? `
        <div class="decisionrow">
          ${DECISIONES.map(d => `<button class="decisionbtn" data-ini="${it.ini.id}" data-dec="${d.id}" style="color:${d.color};${dec===d.id?'border-color:'+d.color+';background:'+d.color+'22;':''}">${esc(d.label)}</button>`).join('')}
        </div>` : '';
    return `
      <div class="scorerow">
        <div class="vt-toprow">
          <span class="num" style="background:#7fa4b8">${i+1}</span>
          <div class="name"><b>${esc(it.ini.nombre)}</b><span>${esc(it.ini.tipo)}</span></div>
          <span class="votetotal">${total} ${total===1?'voto':'votos'}</span>
        </div>
        <div class="votepercents">${pctHtml}</div>
        <div class="votebar">${barHtml}</div>
        <div class="votecounts">${countsHtml}</div>
        ${decisionrow}
      </div>
    `;
  }).join('');
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
      await actualizarEstado({fase:'votando', iniciativa_activa_id: iniciativas[0].id});
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
    const items = iniciativas.map(ini => Object.assign({ini}, tallyVotes(votosPorIni[ini.id]||[])));
    const scoreRows = construirResumenVotos(items, decisionesPorIni, true);
    const matrizHtml = iniciativas.map(ini => {
      const votos = votosPorIni[ini.id] || [];
      const filas = votos.length ? votos.map(v => {
        const nombre = participanteNombreMap[v.participante_id] || 'Participante';
        const dec = DECISIONES.find(d => d.id === v.voto);
        return `<div class="matrizfila"><span>${esc(nombre)}</span><b style="color:${dec?dec.color:'inherit'}">${dec?esc(dec.label):esc(v.voto||'—')}</b></div>`;
      }).join('') : '<p class="note" style="margin:4px 0;">Sin votos.</p>';
      return `<div class="matrizini"><p class="matrizininame">${esc(ini.nombre)}</p>${filas}</div>`;
    }).join('');
    bodyEl.innerHTML = `
      <div class="dash" style="max-width:704px;margin:0 auto;">
        <p class="smallhead" style="font-size:14.5px;color:var(--cyan);max-width:620px;margin:0 auto 14px;text-align:center;">DECISION ROUND</p>
        <p class="smallhead" style="max-width:620px;margin:0 auto 14px;">Votos por iniciativa</p>
        <div class="scorelist">${scoreRows}</div>
        <p class="smallhead" style="max-width:620px;margin:26px auto 14px;">Detalle de votos (solo facilitador)</p>
        <div class="matrizlist">${matrizHtml}</div>
        <div style="max-width:620px;margin:0 auto;">
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
    document.getElementById('downloadxlsxbtn').onclick = () => descargarExcel(items);
    document.getElementById('nuevarondabtn').onclick = async () => {
      if (!confirm('¿Empezar una nueva ronda?\n\nEsto borra permanentemente las iniciativas, votos y decisiones de esta ronda de la base de datos (no se puede deshacer). Asegúrate de haber descargado el Excel antes de continuar.\n\nAdemás desconecta a todos los VPs e invitados (cada ronda es una sesión distinta, con gente que puede cambiar) — van a tener que volver a escanear el QR o abrir su enlace. El facilitador no se desconecta.')) return;
      const ids = iniciativas.map(i=>i.id);
      if (ids.length) await sb.from('iniciativas').delete().in('id', ids); // borra votos y decisiones en cascada
      await sb.from('sala').delete().in('rol', ['vp','invitado']);
      await actualizarEstado({fase:'espera', iniciativa_activa_id:null, ronda_id: uuid()});
    };
  }

  function descargarExcel(items){
    const dateStr = document.getElementById('datelabel').textContent;
    const sessionId = estado.ronda_id || dateStr;

    const resumenRows = [
      ['Fecha','Sesión','#','Iniciativa','Tipo','Votantes','Votos Priorizar','Votos Resolver barreras','Votos Descartar','Decisión final']
    ];
    items.forEach((it, i) => {
      const decId = decisionesPorIni[it.ini.id];
      const decLabel = decId ? (DECISIONES.find(d=>d.id===decId)||{}).label : null;
      resumenRows.push([
        dateStr, sessionId, i+1, it.ini.nombre, it.ini.tipo, it.n,
        it.counts.priorizar, it.counts.resolver, it.counts.descartar,
        decLabel || 'Sin decisión registrada'
      ]);
    });
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
    wsResumen['!cols'] = [{wch:12},{wch:16},{wch:4},{wch:26},{wch:14},{wch:9},{wch:14},{wch:20},{wch:14},{wch:20}];

    const detalleRows = [
      ['Fecha','Sesión','#','Iniciativa','Tipo','Participante','Voto']
    ];
    items.forEach((it, i) => {
      const votos = votosPorIni[it.ini.id] || [];
      votos.forEach(v => {
        const nombre = participanteNombreMap[v.participante_id] || 'Participante';
        const dec = DECISIONES.find(d => d.id === v.voto);
        detalleRows.push([dateStr, sessionId, i+1, it.ini.nombre, it.ini.tipo, nombre, dec ? dec.label : (v.voto || '—')]);
      });
    });
    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows);
    wsDetalle['!cols'] = [{wch:12},{wch:16},{wch:4},{wch:26},{wch:14},{wch:28},{wch:18}];

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
  let estado = null, iniciativas = [], votosPorIni = {}, decisionesPorIni = {}, salaRows = [], salaCount = 0;

  function etiquetaParticipante(row){
    return row.rol === 'invitado' ? `Invitado · ${row.nombre_mostrado}` : row.nombre_mostrado;
  }

  async function cargar(){
    const [{data: est}, {data: inis}, {data: decs}, {data: sala}] = await Promise.all([
      sb.from('estado_sesion').select('*').eq('id', 1).single(),
      sb.from('iniciativas').select('*').order('orden', {ascending:true}),
      sb.from('decisiones').select('*'),
      sb.from('sala').select('*').in('rol', ['vp','invitado'])
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
    salaRows = sala || [];
    salaCount = salaRows.length;
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
    const conectadosChips = salaRows.length
      ? `<div class="rolechips">${salaRows.map(r => `<span class="rolechip">${esc(etiquetaParticipante(r))}</span>`).join('')}</div>`
      : '';
    bodyEl.innerHTML = `
      <div class="dash qrcard" style="max-width:900px;margin:0 auto;">
        <h2>Escanea para unirte</h2>
        <div class="qrbox">${qrSvg}</div>
        <p>${esc(url)}</p>
        <span class="connectedbadge"><span class="dot"></span>${salaCount} conectados</span>
        ${conectadosChips}
      </div>
    `;
  }

  function renderVotando(){
    const idx = iniciativas.findIndex(i => i.id === estado.iniciativa_activa_id);
    const ini = iniciativas[idx];
    if (!ini){ bodyEl.innerHTML = '<div class="dash centercard"><p>Preparando…</p></div>'; return; }
    const votantes = new Set((votosPorIni[ini.id]||[]).map(v => v.participante_id));
    const count = votantes.size;
    const respondieronChips = count
      ? `<div class="rolechips">${salaRows.filter(r => votantes.has(r.participante_id)).map(r => `<span class="rolechip done">${esc(etiquetaParticipante(r))}</span>`).join('')}</div>`
      : '';
    bodyEl.innerHTML = `
      <div class="dash controlcard" style="max-width:900px;margin:0 auto;">
        <p class="smallhead" style="text-align:center;">Iniciativa ${idx+1} de ${iniciativas.length}</p>
        <h2>${esc(ini.nombre)}</h2>
        <p>${esc(ini.tipo)}</p>
        <div class="countbadge">${count} de ${salaCount} han respondido</div>
        ${respondieronChips}
      </div>
    `;
  }

  function renderRevealProyeccion(){
    const items = iniciativas.map(ini => Object.assign({ini}, tallyVotes(votosPorIni[ini.id]||[])));
    // Reusa el mismo resumen de votos que el facilitador, sin botones de decisión.
    const scoreRows = construirResumenVotos(items, decisionesPorIni, false);
    bodyEl.innerHTML = `
      <div class="dash" style="max-width:900px;margin:0 auto;">
        <p class="smallhead" style="font-size:14.5px;color:var(--cyan);max-width:800px;margin:0 auto 14px;text-align:center;">DECISION ROUND</p>
        <p class="smallhead" style="max-width:800px;margin:0 auto 14px;">Votos por iniciativa</p>
        <div class="scorelist" style="max-width:800px;">${scoreRows}</div>
      </div>
    `;
  }

  cargar();
  ['estado_sesion','iniciativas','votos','decisiones','sala'].forEach(tabla => {
    sb.channel('proy-'+tabla).on('postgres_changes', {event:'*', schema:'public', table:tabla}, cargar).subscribe();
  });
}
