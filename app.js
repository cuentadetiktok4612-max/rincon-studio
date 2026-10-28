/* FocoShorts Studio — motor local determinista para Shorts. Sin dependencias externas. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const APP_KEY = 'focoshorts_studio_v1';
const KEY_PREFIX = 'focoshorts_key_';
const IMAGE_KEY_PREFIX = 'focoshorts_image_';
const LAYOUTS = ['question','think','explain','point','confident','celebrate','curious','worried'];
const LAYOUT_LABELS = {question:'Preguntar',think:'Pensar',explain:'Explicar',point:'Señalar',confident:'Confianza',celebrate:'Celebrar',curious:'Curiosidad',worried:'Preocupación'};
const PALETTES = {
  lavanda:{bg:'#18152b',bg2:'#28203f',text:'#ffffff',muted:'#c9c2df',a:'#c5ff70',b:'#a99aff',c:'#ffb8a8'},
  menta:{bg:'#122d2c',bg2:'#1c4945',text:'#fbfffd',muted:'#bfdfd6',a:'#a9f5d0',b:'#ffab98',c:'#fff0ac'},
  atardecer:{bg:'#25152f',bg2:'#4b2451',text:'#fff9f4',muted:'#e5c7df',a:'#ffd166',b:'#ff8c75',c:'#c4a4ff'},
  blanco:{bg:'#f6f4fb',bg2:'#e7e2f1',text:'#25213a',muted:'#676178',a:'#7c5ce0',b:'#ff856b',c:'#343046'}
};
const PROVIDERS = {
 gemini:{name:'Google Gemini',logo:'G',model:'gemini-3.8-flash',desc:'Investiga en vivo con Google Search grounding, propone temas inéditos y genera guiones. La clave se guarda en este navegador; para una web pública usa backend.',link:'https://ai.google.dev/gemini-api/docs/rate-limits',url:'https://generativelanguage.googleapis.com/v1beta/models/',type:'gemini'},
 groq:{name:'Groq',logo:'Gq',model:'openai/gpt-oss-20b',desc:'Pulido opcional del guion: añade naturalidad y variedad sin alterar los hechos investigados por Gemini. Los modelos y cuotas pueden cambiar.',link:'https://console.groq.com/docs/rate-limits',url:'https://api.groq.com/openai/v1/chat/completions',type:'openai'},
 openrouter:{name:'OpenRouter',logo:'OR',model:'openrouter/free',desc:'Enruta entre modelos gratuitos disponibles. Disponibilidad, privacidad y límites dependen del modelo y de tu cuenta.',link:'https://openrouter.ai/pricing',url:'https://openrouter.ai/api/v1/chat/completions',type:'openai'}
};
const uid = () => 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
const words = s => String(s||'').trim().split(/\s+/).filter(Boolean);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = x => JSON.parse(JSON.stringify(x));
function defaultProject(topic='Una comparación que merece explicarse', layout='question') {
 const now=new Date().toISOString();
 const facts=[
  {id:'f1',claim:'Borrador inicial: genera un Short para investigar un tema original',value:null,unit:'',sourceName:'Pendiente de investigación IA',sourceUrl:'',excerpt:'',status:'pending'}
 ];
 const scenes=Array.from({length:6},(_,i)=>({id:'s'+(i+1),start:i*8,duration:8,kind:layout,beat:['La pregunta inicial','Primera idea','Segunda idea','La diferencia clave','Un ejemplo cotidiano','La conclusión'][i],headline:['¿Cuál es la diferencia?','Primera idea','Segunda idea','La clave está aquí','Míralo en la vida real','Quédate con esto'][i],subtitle:'Pulsa “Generar y descargar Short” para crear un guion nuevo con IA.',factRefs:[],transitionOut:['cut','fade','wipe','zoom'][i%4],pose:['question','think','explain','point','confident','celebrate'][i],imageQuery:'',images:[]}));
 return {schemaVersion:2,id:uid(),topic,language:'es',durationSec:48,fps:30,size:[1080,1920],character:normalizeMascotProfile(loadMascotProfile()),style:{palette:'blanco',mood:'Editorial blanco y negro',layoutFamily:layout},hook:{text:'¿Cuál es la diferencia real?',visual:'Collage de imágenes de fuentes abiertas y protagonista de líneas',endSec:3},facts,scenes,sound:{master:.65,events:[]},comparison:{leftLabel:'CONCEPTO A',rightLabel:'CONCEPTO B',leftQuery:'concepto A ejemplo',rightQuery:'concepto B ejemplo',leftImages:[],rightImages:[]},fullNarration:'',aiGrounded:false,description:{title:topic,text:'Proyecto inicial. Genera un Short para investigar un tema nuevo y sus fuentes.',hashtags:['#psicologia','#comportamiento','#curiosidades','#shorts'],sourcesText:''},sourceName:'',sourceUrl:'',sourceExcerpt:'',createdAt:now,updatedAt:now};
}
function blankProject(topic='Mi nuevo Short', layout='question') {
 const p=defaultProject(topic,layout); p.id=uid(); p.topic=topic; p.facts=[{id:'f1',claim:'Añade una afirmación verificable',value:null,unit:'',sourceName:'',sourceUrl:'',excerpt:'',status:'pending'}];
 p.scenes = Array.from({length:6},(_,i)=>({id:'s'+(i+1),start:i*8,duration:8,kind:layout,pose:DEFAULT_STICK_POSES[i%DEFAULT_STICK_POSES.length],imageQuery:'',images:[],beat:i===0?'Presenta la comparación':`Idea de la escena ${i+1}`,headline:i===0?'¿Cuál es la diferencia?':`Idea ${i+1}`,subtitle:i===0?'Una comparación visual respaldada por fuentes':'Completa esta escena con una idea',factRefs:i===0?['f1']:[],transitionOut:'cut'}));
 p.durationSec=48;p.hook={text:'¿Cuál es la diferencia?',visual:'Collage comparativo y protagonista vectorial',endSec:3};p.comparison={leftLabel:'CONCEPTO A',rightLabel:'CONCEPTO B',leftQuery:'concepto A',rightQuery:'concepto B',leftImages:[],rightImages:[]};p.description={title:topic,text:'Añade contexto y enlaces de las fuentes.',hashtags:['#psicologia','#comportamiento','#curiosidades'],sourcesText:''}; return p;
}
// Generador de ideas sin catálogo temático fijo. Cada ejecución investiga un tema nuevo.
const DEFAULT_STICK_POSES=['question','think','explain','point','confident','celebrate','curious','worried'];
const AVATAR_STATE_POSES=['neutral','greet','explain','think','analyze','excited','surprised','confused','error','completed','waiting','point'];
const imageCache = new Map();
const pendingImageSignals = new Set();
const uploadedObjectUrls = new Map();
const LOCAL_IMAGE_DB = 'focoshorts_local_photos_v1';
const LOCAL_IMAGE_STORE = 'photos';
let imageSearchState = { sceneIndex: 0, slot: 0, query: '', results: [], busy: false };
let pendingUploadSlot = 0;
const PAPER_TEXTURE_URL = 'assets/paper-texture.jpg';
const USED_TOPIC_MEMORY = 'focoshorts_topic_memory_v2';
let selectedContentCategory = 'differences';
const CONTENT_CATEGORIES = { differences: {label:'Diferencias que pocos conocen', brief:'Crea una comparación clara entre DOS cosas que suelen confundirse o parecer iguales: animales parecidos, títulos y rangos, conceptos, objetos, fenómenos o palabras. El núcleo del vídeo debe explicar diferencias reales con ejemplos visuales. No fuerces psicología ni comportamiento humano si el tema no lo requiere.'}, curiosities: {label:'Curiosidades sorprendentes', brief:'Crea una curiosidad real y sorprendente sobre animales, ciencia, naturaleza, cuerpo humano, tecnología, geografía o vida cotidiana. Parte de una pregunta intrigante y revela por qué ocurre, cómo funciona o qué evidencia lo demuestra. No conviertas el vídeo en una comparación si no es natural.'}, mysteries: {label:'Misterios, historia y secretos', brief:'Crea un vídeo fascinante sobre historia, arqueología, lugares extraordinarios, inventos, sucesos poco conocidos o misterios documentados. Separa con claridad los hechos comprobados de las hipótesis; nada de conspiraciones presentadas como verdad ni leyendas inventadas.'} };
const MASCOT_PROFILE_KEY = 'focoshorts_mascot_profile_v1';
const FALLBACK_MASCOT = {hair:'curly',accessory:'none',accentColor:'#ee624b',outfitColor:'#ffffff'};
function normalizeMascotProfile(raw){raw=raw&&typeof raw==='object'?{...raw}:{};if(raw.hair==='curly'&&raw.accessory==='headband'&&String(raw.accentColor||'').toLowerCase()==='#ee624b'&&String(raw.outfitColor||'').toLowerCase()==='#f2c45c'){raw.accessory='none';raw.outfitColor='#ffffff';}const color=(value,fallback)=>/^#[0-9a-fA-F]{6}$/.test(String(value||''))?String(value):fallback;return {hair:['short','curly','spiky','ponytail','none'].includes(raw.hair)?raw.hair:FALLBACK_MASCOT.hair,accessory:['headband','glasses','earring','none'].includes(raw.accessory)?raw.accessory:FALLBACK_MASCOT.accessory,accentColor:color(raw.accentColor,FALLBACK_MASCOT.accentColor),outfitColor:color(raw.outfitColor,FALLBACK_MASCOT.outfitColor)};}
function loadMascotProfile(){try{const raw=JSON.parse(localStorage.getItem(MASCOT_PROFILE_KEY)||'null');if(raw&&raw.hair==='curly'&&raw.accessory==='headband'&&String(raw.accentColor||'').toLowerCase()==='#ee624b'&&String(raw.outfitColor||'').toLowerCase()==='#f2c45c'){raw.accessory='none';raw.outfitColor='#ffffff';try{localStorage.setItem(MASCOT_PROFILE_KEY,JSON.stringify(raw));}catch{}}return normalizeMascotProfile(raw);}catch{return normalizeMascotProfile(null);}}
function saveMascotProfile(profile){const safe=normalizeMascotProfile(profile);try{localStorage.setItem(MASCOT_PROFILE_KEY,JSON.stringify(safe));}catch{}return safe;}
function normalizeTopic(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function topicOverlap(a,b){const A=new Set(normalizeTopic(a).split(' ').filter(x=>x.length>3)),B=new Set(normalizeTopic(b).split(' ').filter(x=>x.length>3));if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++;});return hit/Math.max(A.size,B.size);}
function recentTopics(){const stored=(()=>{try{return JSON.parse(localStorage.getItem(USED_TOPIC_MEMORY)||'[]')}catch{return []}})();return [...new Set([...state.projects.slice(0,45).map(p=>p.topic),...stored])].filter(Boolean).slice(0,65);}
function rememberTopic(topic){const list=recentTopics().filter(x=>normalizeTopic(x)!==normalizeTopic(topic));list.unshift(topic);try{localStorage.setItem(USED_TOPIC_MEMORY,JSON.stringify(list.slice(0,100)));}catch{}}
function getGeminiModel(){return (state.settings.models?.gemini||PROVIDERS.gemini.model||'gemini-3.8-flash').trim();}
async function requestGroundedShortIdea(retryNote=''){
 const key=apiKeyFor('gemini');if(!key&&!apiKeyFor('groq'))throw new Error('Conecta Gemini o Groq en “IA, claves y cuotas” para generar una idea nueva.');
 const oldTopics=recentTopics();const existingMascot=(()=>{try{return localStorage.getItem(MASCOT_PROFILE_KEY)?loadMascotProfile():null}catch{return null}})();
 const mascotBrief=existingMascot?`MASCOTA PERMANENTE: ${JSON.stringify(normalizeMascotProfile(existingMascot))}`:'Usa un monigote editorial cercano al avatar de referencia: cabeza redonda sonriente, mechones negros, cuerpo delgado y líneas negras limpias; sin diadema ni corbata, ropa blanca y acento coral discreto. hair=curly recomendado; accessory=none recomendado (también puede usar glasses o earring si es esencial); colores hex. Mantén esta identidad.';
 const nonce=(window.crypto?.randomUUID?.()||Math.random().toString(36).slice(2))+Date.now().toString(36);
 const category=CONTENT_CATEGORIES[selectedContentCategory]||CONTENT_CATEGORIES.differences;
 const prompt=`Eres director creativo y guionista profesional de Shorts en español latino para el canal «El Rincón de lo Desconocido». CATEGORÍA SELECCIONADA: ${category.label}. INSTRUCCIÓN TEMÁTICA OBLIGATORIA: ${category.brief} Elige un tema concreto, original, visual y fácil de entender; no lo limites a psicología ni comportamiento humano salvo que corresponda a la categoría. Evita pseudociencia, afirmaciones sensacionalistas y estadísticas inventadas.
Piensa internamente en varias ideas distintas y elige solo una que no repita ni reformule de cerca estos temas recientes: ${JSON.stringify(oldTopics)}. Debe ser interesante y visualizable en 35–50 segundos. Si hay búsqueda web disponible, usa fuentes reales y nunca inventes URLs o cifras; si no hay una cita fiable, formula observaciones prudentes y deja la fuente pendiente. Propón dos conceptos relacionados con el tema y que puedan ilustrarse con fotografías, consultas de imagen específicas y seis escenas con narración original de 130–160 palabras en total (unas 22–27 por escena): arranca con un gancho que impacte, en cada escena da un dato concreto o ejemplo específico que enseñe algo nuevo, usa emoción (asombro, intriga, humor ligero), un giro inesperado a mitad y cierra con pregunta. Canal: «El Rincón de lo Desconocido» (curiosidades fascinantes). Frases cortas, ritmo rápido, sin relleno. ${mascotBrief}
${retryNote}
Token de variedad: ${nonce}.
Devuelve SOLO JSON válido: {"character":{"hair":"curly","accessory":"none","accentColor":"#ee624b","outfitColor":"#ffffff"},"topic":"título atractivo","tone":"serio|neutral|ligero","allowedEmotions":["id_exacto","id_exacto","id_exacto"],"hook":"gancho de 3 a 8 palabras","description":"descripción con pregunta","leftLabel":"etiqueta izquierda","rightLabel":"etiqueta derecha","leftImageQuery":"consulta concreta de imagen","rightImageQuery":"consulta concreta de imagen","sources":[{"title":"título real si lo tienes","url":"https://..."}],"facts":[{"claim":"afirmación prudente","excerpt":"resumen fiel","sourceTitle":"título si está disponible","sourceUrl":"URL real si está disponible"}],"scenes":[{"headline":"máximo 7 palabras","subtitle":"máximo 12 palabras","narration":"frase original","imageQuery":"consulta muy concreta en inglés para encontrar fotografías reales que ilustren esta escena, no una consulta genérica","pose":"question|think|explain|point|confident|celebrate|curious|worried",\"emotions\":[\"id_exacto\"],"factIds":["f1"]}]}. Exactamente seis escenas. PERSONAJE (emociones): primero decide el TONO real del tema: "serio" (misterio, tragedia, peligro, muerte, injusticia, algo inquietante), "neutral" (ciencia, historia, psicología, curiosidad) o "ligero" (humor, motivación, algo positivo). Luego elige en allowedEmotions de 3 a 6 ids de la lista que sean COHERENTES con ese tono y con el tema; no es obligatorio usar todas, y casi nunca conviene hacerlo. Cada escena lleva en emotions de 1 a 3 ids tomados SOLO de allowedEmotions, en el orden en que ocurren en la narración, y cada emoción debe corresponder a lo que se dice en ese momento (miedo_nervioso solo si se habla de algo amenazante; sorprendido o mente_explotada solo en el dato asombroso; duda_pensando o curioso en preguntas e intriga). Si la escena es informativa y sin giro emocional, usa UN solo id sobrio. Está prohibido usar alegría, risa, amor o celebración (feliz_pulgar, celebra_salto, risa, enamorado, alegre_abierto, animado_puno, paz_guino, comiendo, tierno) en temas serios, y tristeza, miedo o enojo en temas ligeros. Nunca repitas el mismo id seguido. Lista de ids y su significado: ${EMO_IDS.map(k=>k+' ('+EMO[k]+')').join('; ')}. Cada imageQuery debe ser distinto y describir una foto real apropiada para la idea específica narrada; prioriza personas, lugares u objetos reales y evita iconos, diagramas y collages. IDs factuales f1, f2, etc. No inventes fuentes para llenar la plantilla.`;
 const preferred=getGeminiModel();const models=[...new Set([preferred,'gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash'].filter(Boolean))];let lastError='';
 for(let idx=0;key&&idx<models.length;idx++){
  const model=models[idx];try{
   const url=PROVIDERS.gemini.url+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key);
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{temperature:.88,maxOutputTokens:6144}})});
   captureRateHeaders(res,'gemini');const data=await res.json().catch(()=>({}));
   if(!res.ok){lastError=data.error?.message||`Gemini HTTP ${res.status}`;const transient=[408,429,500,502,503,504].includes(res.status)||/high demand|temporar|overload|rate limit|unavailable/i.test(lastError);if(transient&&idx<models.length-1){log(`Modelo ${model} ocupado; probando una alternativa.`);continue;}throw new Error(lastError);}
   const candidate=data.candidates?.[0],textOut=(candidate?.content?.parts||[]).map(x=>x.text||'').join('\n');let raw;try{raw=parseJSONResponse(textOut)}catch{lastError='Gemini no devolvió JSON válido';if(idx<models.length-1)continue;throw new Error(lastError)}
   if(!Array.isArray(raw.scenes)||raw.scenes.length!==6){lastError='Gemini no produjo seis escenas válidas';if(idx<models.length-1)continue;throw new Error(lastError)}
   const chunks=candidate?.groundingMetadata?.groundingChunks||[],grounded=chunks.map(c=>c.web).filter(w=>w?.uri&&/^https:\/\//i.test(w.uri)).map(w=>({title:String(w.title||safeHost(w.uri)),url:w.uri}));
   const suggested=Array.isArray(raw.sources)?raw.sources.filter(x=>x?.url&&/^https:\/\//i.test(x.url)).map(x=>({title:String(x.title||safeHost(x.url)),url:x.url})):[];
   const supports=candidate?.groundingMetadata?.groundingSupports||[];
   raw._factSourceUrls=(raw.facts||[]).map(f=>{const claim=String(f.claim||''),pos=claim?textOut.indexOf(claim):-1,end=pos>=0?pos+claim.length:-1,terms=new Set(normalizeTopic(claim).split(' ').filter(w=>w.length>3)),indices=new Set();for(const sup of supports){const seg=sup.segment||{},st=Number(seg.startIndex),en=Number(seg.endIndex);let related=pos>=0&&Number.isFinite(st)&&Number.isFinite(en)&&st<end&&en>pos;if(!related&&terms.size&&seg.text){const q=normalizeTopic(seg.text).split(' ').filter(w=>w.length>3);related=q.filter(w=>terms.has(w)).length/terms.size>=.28;}if(related)(sup.groundingChunkIndices||[]).forEach(i=>indices.add(i));}return [...indices].map(i=>chunks[i]?.web?.uri).filter(u=>u&&/^https:\/\//i.test(u));});
   raw._hasGrounding=grounded.length>0;raw.sources=grounded.length?grounded.slice(0,12):suggested.slice(0,12);raw._groundingQueries=candidate?.groundingMetadata?.webSearchQueries||[];raw._modelUsed=model;noteCall('gemini',`Idea generada (${model})${raw._hasGrounding?' con citas':' con fuentes pendientes de revisión'}`);return raw;
  }catch(e){lastError=String(e.message||e);if(idx===models.length-1)log('Gemini no disponible: '+lastError.slice(0,130));}
 }
 const groqKey=apiKeyFor('groq');if(groqKey){try{const cfg=PROVIDERS.groq,model=(state.settings.models?.groq||cfg.model).trim();const r=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+groqKey},body:JSON.stringify({model,messages:[{role:'system',content:'Eres director creativo de Shorts en español latino. Devuelve solo JSON, no inventes estudios, cifras ni fuentes.'},{role:'user',content:prompt}],temperature:.9,max_tokens:6000,response_format:{type:'json_object'}})});captureRateHeaders(r,'groq');const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error?.message||`Groq HTTP ${r.status}`);const raw=parseJSONResponse(d.choices?.[0]?.message?.content||'');if(!Array.isArray(raw.scenes)||raw.scenes.length!==6)throw new Error('Groq no devolvió seis escenas');raw._hasGrounding=false;raw.sources=Array.isArray(raw.sources)?raw.sources.filter(x=>x?.url&&/^https:\/\//i.test(x.url)).slice(0,12):[];raw._factSourceUrls=[];raw._modelUsed=model;raw._generatedBy='groq';noteCall('groq','Idea de respaldo creada');return raw;}catch(e){lastError+='; Groq: '+String(e.message||e);}}
 throw new Error('Los modelos de IA no respondieron tras intentar alternativas. '+lastError+' Revisa las cuotas y claves.');
}
function safeHost(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return 'Fuente web'}}

async function polishWithGroq(raw){
 const key=apiKeyFor('groq');if(!key)return raw;
 try{
  const cfg=PROVIDERS.groq,model=(state.settings.models?.groq||cfg.model).trim();
  const locked={topic:raw.topic,hook:raw.hook,leftLabel:raw.leftLabel,rightLabel:raw.rightLabel,scenes:raw.scenes.map(s=>({headline:s.headline,subtitle:s.subtitle,narration:s.narration,pose:s.pose}))};
  const prompt=`Mejora profesionalmente SOLO la escritura visible y la narración de este Short para español latino natural. Hazlo más interesante, conversacional, preciso y variado, sin tono robótico, sin relleno ni promesas falsas. La narración debe sonar como un narrador HOMBRE adulto en español latino: voz masculina media-grave, segura y cálida. Escribe para interpretación emocional, no para leer datos: gancho intenso al inicio, intriga que crece, pausas antes de revelaciones, asombro genuino en hallazgos, énfasis en palabras clave, humor ligero solo si encaja y cierre que deje curiosidad. Alterna frases cortas y largas y evita el tono plano de enciclopedia. No cambies tema, etiquetas, datos factuales, fuentes, estructura ni poses. Devuelve JSON con topic, hook, leftLabel, rightLabel y scenes (headline, subtitle, narration, pose) exactamente 6. No agregues ni cambies hechos o cifras. Datos originales: ${JSON.stringify(locked)}`;
  const res=await fetch(cfg.url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model,messages:[{role:'system',content:'Editor creativo estricto. Preserva los hechos. Devuelve solo JSON válido.'},{role:'user',content:prompt}],temperature:.78,max_tokens:4000,response_format:{type:'json_object'}})});
  captureRateHeaders(res,'groq');const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error?.message||`Groq HTTP ${res.status}`);noteCall('groq','Pulido creativo HTTP '+res.status);
  const polished=parseJSONResponse(data.choices?.[0]?.message?.content||'');
  if(Array.isArray(polished.scenes)&&polished.scenes.length===6){raw.topic=polished.topic||raw.topic;raw.hook=polished.hook||raw.hook;raw.leftLabel=polished.leftLabel||raw.leftLabel;raw.rightLabel=polished.rightLabel||raw.rightLabel;raw.scenes=raw.scenes.map((s,i)=>({...s,headline:String(polished.scenes[i]?.headline||s.headline),subtitle:String(polished.scenes[i]?.subtitle||s.subtitle),narration:String(polished.scenes[i]?.narration||s.narration),pose:DEFAULT_STICK_POSES.includes(polished.scenes[i]?.pose)?polished.scenes[i].pose:s.pose}));}
 }catch(e){log('Groq no pudo pulir esta narración; se conserva la versión investigada por Gemini: '+String(e.message||e).slice(0,120));}
 return raw;
}
async function fetchImageJSON(url, options={}, timeoutMs=4600){
 const controller=typeof AbortController!=='undefined'?new AbortController():null;
 const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
 try{
  const response=await fetch(url,{...options,...(controller?{signal:controller.signal}:{})});
  if(!response.ok)throw new Error('HTTP '+response.status);
  return await response.json();
 }finally{if(timer)clearTimeout(timer);}
}
function imageApiKey(name){try{return localStorage.getItem(IMAGE_KEY_PREFIX+name)||'';}catch{return '';}}
function compactImageQuery(query){
 const stop=new Set(['photography','photograph','photo','photos','real','life','scene','moment','editorial','vertical','image','images','portrait','high','quality','una','uno','para','con','del','los','las','que','como','sobre']);
 const terms=normalImageText(query).split(/\s+/).filter(w=>w.length>2&&!stop.has(w));
 return [...new Set(terms)].slice(0,7).join(' ')||String(query||'').trim().slice(0,70);
}
async function searchCommonsImages(query,limit=12){
 const q=String(query||'').trim();if(!q)return [];
 const url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(q)+'&gsrnamespace=6&gsrlimit='+Math.max(1,Math.min(20,limit))+'&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1600&format=json&origin=*';
 try{
  const data=await fetchImageJSON(url,{headers:{'Accept':'application/json'}});
  return Object.values(data.query?.pages||{}).map(page=>{
   const info=page.imageinfo?.[0]||{},meta=info.extmetadata||{};
   const rawVal=k=>String(meta[k]?.value||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
   return {title:String(page.title||'').replace(/^File:/,''),url:info.thumburl||info.url||'',sourceUrl:info.descriptionurl||'',license:rawVal('LicenseShortName')||'Consultar licencia',artist:rawVal('Artist'),credit:rawVal('Credit'),width:+info.thumbwidth||+info.width||0,height:+info.thumbheight||+info.height||0,mime:String(info.mime||''),sourceName:'Wikimedia Commons'};
  }).filter(x=>/^https:\/\//i.test(x.url)&&/^https:\/\//i.test(x.sourceUrl)&&(!x.mime||x.mime.startsWith('image/')));
 }catch(e){log('Commons no disponible para “'+q+'”: '+String(e.message||e).slice(0,85));return [];}
}
async function searchOpenverseImages(query,limit=12){
 const q=String(query||'').trim();if(!q)return [];
 try{
  const url='https://api.openverse.org/v1/images/?q='+encodeURIComponent(q)+'&page_size='+Math.min(20,Math.max(1,limit))+'&license=cc0,pdm,by,by-sa';
  const data=await fetchImageJSON(url,{headers:{'Accept':'application/json'}});
  return (data.results||[]).map(x=>({title:String(x.title||x.creator||x.tags?.map(t=>t.name).join(' ')||'Fotografía Openverse'),url:String(x.thumbnail||x.url||''),sourceUrl:String(x.foreign_landing_url||x.detail_url||''),license:String(x.license||'Consultar licencia').toUpperCase(),artist:String(x.creator||''),credit:String(x.attribution||''),tags:Array.isArray(x.tags)?x.tags.map(t=>t.name||t).join(' '):'',width:+x.width||0,height:+x.height||0,mime:String(x.mime_type||''),sourceName:'Openverse'})).filter(x=>/^https:\/\//i.test(x.url)&&/^https:\/\//i.test(x.sourceUrl));
 }catch(e){log('Openverse no disponible: '+String(e.message||e).slice(0,85));return [];}
}
async function searchWikipediaImages(query,limit=10){
 const q=compactImageQuery(query);if(!q)return [];
 const languages=['es','en'];
 const batches=await Promise.all(languages.map(async lang=>{
  const url='https://'+lang+'.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(q)+'&gsrnamespace=0&gsrlimit='+Math.min(15,Math.max(1,limit))+'&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=1600&format=json&origin=*';
  try{
   const data=await fetchImageJSON(url,{headers:{'Accept':'application/json'}});
   return Object.values(data.query?.pages||{}).filter(page=>page.thumbnail?.source&&page.fullurl).map(page=>({title:String(page.title||''),url:String(page.thumbnail.source),sourceUrl:String(page.fullurl),license:'Consultar licencia de la imagen original',artist:'',credit:'Imagen de artículo de Wikipedia; comprobar la página original',tags:String(page.title||''),width:+page.thumbnail.width||0,height:+page.thumbnail.height||0,mime:'image/jpeg',sourceName:'Wikipedia '+lang.toUpperCase()})).filter(x=>/^https:\/\//i.test(x.url)&&/^https:\/\//i.test(x.sourceUrl));
  }catch(e){log('Wikipedia '+lang.toUpperCase()+' no disponible: '+String(e.message||e).slice(0,85));return [];}
 }));
 const unique=new Map();for(const item of batches.flat()){const key=imageDedupeKey(item);if(!unique.has(key))unique.set(key,item);}
 return [...unique.values()].slice(0,Math.max(1,limit));
}
async function searchPexelsImages(query,limit=12){
 const key=imageApiKey('pexels');if(!key)return [];
 try{
  const url='https://api.pexels.com/v1/search?query='+encodeURIComponent(compactImageQuery(query))+'&per_page='+Math.min(30,Math.max(1,limit));
  const data=await fetchImageJSON(url,{headers:{'Authorization':key,'Accept':'application/json'}});
  return (data.photos||[]).map(x=>({title:String(x.alt||x.photographer||'Pexels photo'),url:String(x.src?.large2x||x.src?.large||x.src?.original||''),sourceUrl:String(x.url||''),license:'Pexels License',artist:String(x.photographer||''),credit:'Photo by '+String(x.photographer||'Pexels contributor'),tags:String(x.alt||''),width:+x.width||0,height:+x.height||0,mime:'image/jpeg',sourceName:'Pexels'})).filter(x=>/^https:\/\//i.test(x.url)&&/^https:\/\//i.test(x.sourceUrl));
 }catch(e){log('Pexels no disponible: '+String(e.message||e).slice(0,90));return [];}
}
async function searchPixabayImages(query,limit=12){
 const key=imageApiKey('pixabay');if(!key)return [];
 try{
  const url='https://pixabay.com/api/?key='+encodeURIComponent(key)+'&q='+encodeURIComponent(compactImageQuery(query))+'&image_type=photo&safesearch=true&per_page='+Math.min(30,Math.max(1,limit))+'&lang=en';
  const data=await fetchImageJSON(url,{headers:{'Accept':'application/json'}});
  return (data.hits||[]).map(x=>({title:String(x.tags||'Pixabay photo'),url:String(x.largeImageURL||x.webformatURL||''),sourceUrl:String(x.pageURL||''),license:'Pixabay Content License',artist:String(x.user||''),credit:'Photo by '+String(x.user||'Pixabay contributor'),tags:String(x.tags||''),width:+x.imageWidth||+x.webformatWidth||0,height:+x.imageHeight||+x.webformatHeight||0,mime:'image/jpeg',sourceName:'Pixabay'})).filter(x=>/^https:\/\//i.test(x.url)&&/^https:\/\//i.test(x.sourceUrl));
 }catch(e){log('Pixabay no disponible: '+String(e.message||e).slice(0,90));return [];}
}
async function searchImageSources(query,stage=0){
 // Automatic retrieval uses open-media endpoints and providers with documented APIs.
 // Reddit/Pinterest remain one-tap browser searches; do not scrape their pages from this app.
 const tasks=stage===0?[searchCommonsImages(query,12),searchOpenverseImages(query,12)]:[searchWikipediaImages(query,12),searchCommonsImages(query,8),searchOpenverseImages(query,8)];
 if(imageApiKey('pexels'))tasks.push(searchPexelsImages(query,12));
 if(imageApiKey('pixabay'))tasks.push(searchPixabayImages(query,12));
 const results=await Promise.all(tasks.map(task=>task.catch(()=>[])));
 return results.flat();
}
function proxyImageUrl(url){
 if(!/^https?:\/\//i.test(String(url||'')))return String(url||'');
 return 'https://images.weserv.nl/?url='+encodeURIComponent(String(url))+'&output=jpg&q=86';
}
function loadImage(url){
 if(!url)return Promise.resolve(null);
 const cached=imageCache.get(url);
 if(cached){if(cached instanceof HTMLImageElement&&cached.complete&&cached.naturalWidth>0)return Promise.resolve(cached);if(cached&&typeof cached.then==='function')return cached;}
 const promise=(async()=>{
  const input=String(url),isRemote=/^https?:\/\//i.test(input);
  // Try a CORS-enabled image proxy first; remote providers often allow <img> display
  // but forbid drawing the same image into a canvas for MP4 export.
  const attempts=isRemote?[
   {url:proxyImageUrl(input),timeout:2500},
   {url:'https://wsrv.nl/?url='+encodeURIComponent(input)+'&output=jpg&q=84',timeout:2500},
   {url:input,timeout:1500}
  ]:[{url:input,timeout:3200}];
  for(const attempt of attempts){
   const candidate=attempt.url;if(!candidate)continue;
   const loaded=await new Promise(resolve=>{
    const img=new Image();let settled=false,timer;
    if(!candidate.startsWith('data:')&&!candidate.startsWith('blob:'))img.crossOrigin='anonymous';
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
    img.onload=()=>{if(img.naturalWidth>0&&img.naturalHeight>0){img.__loadedImage=true;img.__originalUrl=input;finish(img);}else finish(null);};
    img.onerror=()=>finish(null);
    timer=setTimeout(()=>finish(null),attempt.timeout);
    img.src=candidate;
   });
   if(loaded){imageCache.set(url,loaded);return loaded;}
  }
  imageCache.delete(url);return null;
 })();
 imageCache.set(url,promise);return promise;
}

async function preloadProjectImages(p){
 const sceneUrls=(p.scenes||[]).flatMap(s=>Array.isArray(s.images)?s.images:[]).map(x=>x?.url).filter(Boolean);
 const legacyUrls=[...(p.comparison?.leftImages||[]),...(p.comparison?.rightImages||[])].map(x=>x?.url).filter(Boolean);
 const urls=[...new Set([...sceneUrls,...legacyUrls])];
 await Promise.all(urls.map(loadImage));
 return urls.filter(url=>{const img=imageCache.get(url);return !!(img&&img.__loadedImage&&img.naturalWidth>0);}).length;
}
function imageDedupeKey(item){return String(item?.url||'').split('#')[0].split('?')[0].replace(/\/(?:large|medium|small)\.(jpg|jpeg|png|webp)$/i,'/.$1');}
function buildFreshProject(raw){
 const sources=(raw.sources||[]).filter(x=>x?.url&&/^https:\/\//i.test(x.url));
 const trulyGrounded=!!raw._hasGrounding;
 const facts=(raw.facts||[]).slice(0,6).map((f,i)=>{
  const supportUrls=Array.isArray(raw._factSourceUrls?.[i])?raw._factSourceUrls[i]:[];
  const supported=supportUrls.map(u=>sources.find(x=>x.url===u)).find(Boolean);
  const selected=supported||sources.find(x=>x.url===f.sourceUrl)||null;
  return {id:'f'+(i+1),claim:String(f.claim||'').trim(),value:null,unit:'',sourceName:String(selected?.title||f.sourceTitle||'Fuente por revisar'),sourceUrl:String(selected?.url||f.sourceUrl||''),excerpt:String(f.excerpt||''),status:trulyGrounded&&selected?'verified':'pending',aiGrounded:!!(trulyGrounded&&selected)};
 }).filter(f=>f.claim);
 // If the model provides no separate facts, keep the scenes usable and transparently label their statements as pending review.
 if(!facts.length){(raw.scenes||[]).slice(0,4).forEach((sc,i)=>facts.push({id:'f'+(i+1),claim:String(sc.narration||sc.subtitle||sc.headline||'Idea narrativa').trim(),value:null,unit:'',sourceName:'Afirmación narrativa; fuente pendiente',sourceUrl:'',excerpt:'Revisar antes de publicar.',status:'pending',aiGrounded:false}));}
 const projTone=EMO_BLOCK[raw.tone]?raw.tone:'neutral',projAllowed=cleanEmos(raw.allowedEmotions,projTone);
 const scenes=(raw.scenes||[]).map((sc,i)=>({id:'s'+(i+1),start:i*8,duration:8,kind:DEFAULT_STICK_POSES.includes(sc.pose)?sc.pose:DEFAULT_STICK_POSES[i%DEFAULT_STICK_POSES.length],beat:String(sc.headline||'Idea principal').slice(0,100),headline:words(String(sc.headline||'Idea principal')).slice(0,10).join(' ').slice(0,70),subtitle:words(String(sc.subtitle||'')).slice(0,12).join(' ').slice(0,105),emotions:cleanEmos(sc.emotions,projTone,projAllowed),factRefs:(Array.isArray(sc.factIds)?sc.factIds:[]).map(id=>String(id)).filter(id=>facts.some(f=>f.id===id)),transitionOut:['cut','fade','wipe','zoom','fade','cut'][i],pose:DEFAULT_STICK_POSES.includes(sc.pose)?sc.pose:DEFAULT_STICK_POSES[i%DEFAULT_STICK_POSES.length],narration:String(sc.narration||sc.subtitle||sc.headline||'').trim(),imageQuery:String(sc.imageQuery||sc.image_query||sc.visualQuery||`${sc.headline||raw.topic||'human behavior'} real life photography`).trim(),images:[]}));
 scenes.forEach((sc,i)=>{if(!sc.factRefs.length&&facts.length)sc.factRefs=[facts[i%facts.length].id];});
 const leftLabel=String(raw.leftLabel||'IDEA A').slice(0,24),rightLabel=String(raw.rightLabel||'IDEA B').slice(0,24);const topic=String(raw.topic||'Una diferencia que pocos notan').slice(0,80);const sourceNames=sources.map(x=>x.title+' — '+x.url).join('\n');
 const sourceNote=trulyGrounded?'Fuentes enlazadas por la búsqueda web; revisa que respalden cada afirmación.':'Fuentes sugeridas por IA o pendientes; no se recibieron citas verificables de búsqueda. Revisa los datos antes de publicar.';
 return {schemaVersion:2,id:uid(),topic,tone:projTone,allowedEmotions:projAllowed,language:'es',durationSec:48,fps:30,size:[1080,1920],character:normalizeMascotProfile(raw.character||loadMascotProfile()),style:{palette:'blanco',mood:'Editorial blanco y negro con acentos coral',layoutFamily:DEFAULT_STICK_POSES.includes(raw.scenes[0]?.pose)?raw.scenes[0].pose:'question'},hook:{text:words(String(raw.hook||topic)).slice(0,8).join(' '),visual:'Collage web de dos conceptos + protagonista de dibujo lineal',endSec:3},facts,scenes,comparison:{leftLabel,rightLabel,leftQuery:String(raw.leftImageQuery||leftLabel),rightQuery:String(raw.rightImageQuery||rightLabel),leftImages:[],rightImages:[]},fullNarration:scenes.map(x=>x.narration).join(' '),aiGrounded:trulyGrounded,description:{title:topic,text:String(raw.description||'')+'\n\n'+sourceNote+(sourceNames?'\nFuentes consultadas:\n'+sourceNames:''),hashtags:['#psicologia','#comportamientohumano','#curiosidades','#shorts'],sourcesText:sourceNames},sourceName:sources[0]?.title||'Fuente por revisar',sourceUrl:sources[0]?.url||'',sourceExcerpt:facts.map(f=>f.claim+' — '+f.excerpt).join('\n'),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
const IMAGE_STOPWORDS=new Set(['the','and','for','with','from','that','this','into','real','life','photo','photography','image','images','people','person','example','scene','foto','fotografia','imagen','imagenes','personas','persona','una','uno','unos','unas','del','de','por','para','sobre','como','que','con','los','las','una','vida']);
function normalImageText(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\.(jpg|jpeg|png|webp|tif|tiff|svg|gif)$/i,'').replace(/[^a-z0-9]+/g,' ').trim();}
function imageRelevance(query,item){
 const terms=normalImageText(query).split(/\s+/).filter(w=>w.length>=3&&!IMAGE_STOPWORDS.has(w));
 const title=normalImageText([item.title,item.tags,item.credit,item.artist].filter(Boolean).join(' '));
 const matches=terms.filter(w=>title.includes(w)).length;
 let score=terms.length?matches/Math.min(terms.length,7):0;
 if(item.width&&item.height){if(Math.min(item.width,item.height)<180)score-=.35;else if(Math.min(item.width,item.height)>=600)score+=.09;}
 if(/\.(svg|gif)(?:$|\?)/i.test(item.title||'')||/svg|gif/i.test(item.mime||''))score-=.9;
 if(/logo|icon|clip.?art|diagram|infographic|chart|screenshot|book cover|poster|vector|watermark/i.test(item.title||''))score-=.55;
 return score;
}
function rankImageCandidates(query,items,limit=24){
 const seen=new Set();
 return (items||[]).filter(x=>x&&/^https:\/\//i.test(x.url||'')&&/^https:\/\//i.test(x.sourceUrl||'')).map((item,index)=>({...item,__score:imageRelevance(query,item),__rank:index})).filter(item=>{
  const key=normalImageText(item.title)+'|'+imageDedupeKey(item);if(seen.has(key))return false;seen.add(key);
  if(/\.(svg|gif)(?:$|\?)/i.test(item.url)||/svg|gif/i.test(item.mime||''))return false;
  // Do not reject landscape, panorama or square photos: the vertical editor crops them safely.
  return !(item.width&&item.height&&Math.min(item.width,item.height)<140);
 }).sort((a,b)=>b.__score-a.__score||((b.width||0)*(b.height||0))-((a.width||0)*(a.height||0))||a.__rank-b.__rank).slice(0,limit);
}
async function loadUsableCandidates(query,candidates,maxLoad=14,returnLimit=8){
 const chosen=(candidates||[]).slice(0,maxLoad),loaded=[];
 // Load in small batches to avoid opening dozens of image connections on a phone at once.
 for(let at=0;at<chosen.length&&loaded.length<returnLimit;at+=4){
  const batch=await Promise.all(chosen.slice(at,at+4).map(async item=>({item,img:await loadImage(item.url)})));
  for(const {item,img} of batch){
   if(!img||!img.naturalWidth||!img.naturalHeight)continue;
   if(img.naturalWidth<240||img.naturalHeight<180)continue;
   if(imageRelevance(query,item)<-.10)continue;
   loaded.push(item);
  }
 }
 return loaded.sort((a,b)=>imageRelevance(query,b)-imageRelevance(query,a)).slice(0,returnLimit);
}
async function searchTwoSceneImages(scene,p,index,usedUrls=new Set(),neededCount=2){
 const original=String(scene.imageQuery||`${scene.headline||scene.beat||p.topic} real photography`).trim();
 const short=compactImageQuery(original);
 const variants=[original,short,compactImageQuery(`${scene.headline||scene.beat||''} ${p.topic} people objects real photo`)].filter((q,i,a)=>q&&a.indexOf(q)===i);
 const selected=[],repeatPool=[],localKeys=new Set();
 for(let qi=0;qi<Math.min(variants.length,2)&&selected.length<neededCount;qi++){
  const q=variants[qi];
  for(let stage=0;stage<2&&selected.length<neededCount;stage++){
   const raw=await searchImageSources(q,stage);
   const ranked=rankImageCandidates(q,raw,28);
   const loaded=await loadUsableCandidates(q,ranked,3,3);
   for(const item of loaded){
    const key=imageDedupeKey(item);if(!key||localKeys.has(key))continue;localKeys.add(key);
    if(usedUrls.has(key)){repeatPool.push(item);continue;}
    selected.push(item);usedUrls.add(key);
    if(selected.length>=neededCount)break;
   }
   if(selected.length>=neededCount)break;
  }
 }
 // Prefer unique photos across the whole Short, but reuse a valid relevant photo rather than leaving a blank card.
 for(const item of repeatPool){if(selected.length>=neededCount)break;const key=imageDedupeKey(item);if(selected.some(x=>imageDedupeKey(x)===key))continue;selected.push(item);}
 return selected.slice(0,neededCount).map(({__score,__rank,...item})=>item);
}
function openLocalPhotoDB(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('Este navegador no permite guardar fotos localmente.'));return;}
  const request=indexedDB.open(LOCAL_IMAGE_DB,1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(LOCAL_IMAGE_STORE))db.createObjectStore(LOCAL_IMAGE_STORE,{keyPath:'id'});};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('No se pudo abrir el almacén de fotos.'));
 });
}
async function putLocalPhoto(id,blob,name){const db=await openLocalPhotoDB();return new Promise((resolve,reject)=>{const tx=db.transaction(LOCAL_IMAGE_STORE,'readwrite');tx.objectStore(LOCAL_IMAGE_STORE).put({id,blob,name,updatedAt:Date.now()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error||new Error('No se pudo guardar la foto.'));};});}
async function getLocalPhoto(id){const db=await openLocalPhotoDB();return new Promise((resolve,reject)=>{const tx=db.transaction(LOCAL_IMAGE_STORE,'readonly');const req=tx.objectStore(LOCAL_IMAGE_STORE).get(id);req.onsuccess=()=>{const val=req.result;db.close();resolve(val||null);};req.onerror=()=>{db.close();reject(req.error||new Error('No se pudo leer una foto guardada.'));};});}
async function hydrateUploadedImages(){
 const found=[];for(const project of state.projects||[])for(const scene of project.scenes||[])for(const item of scene.images||[]){if(item?.localId){try{let src=uploadedObjectUrls.get(item.localId);if(!src){const saved=await getLocalPhoto(item.localId);if(saved?.blob){src=URL.createObjectURL(saved.blob);uploadedObjectUrls.set(item.localId,src);}}if(src){item.url=src;item.local=true;found.push(src);}else{item.url='';item.localMissing=true;}}catch(e){item.url='';item.localMissing=true;log('Una foto local no se pudo recuperar; vuelve a subirla desde el editor.');}}}
 if(found.length)saveState();return found.length;
}
function compressPhoto(file){
 return new Promise((resolve,reject)=>{
  const src=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const max=1600,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);canvas.toBlob(blob=>{URL.revokeObjectURL(src);if(blob&&blob.size){resolve({blob,width:w,height:h});}else reject(new Error('No se pudo convertir la imagen.'));},'image/jpeg',.84);}catch(e){URL.revokeObjectURL(src);reject(e);}};img.onerror=()=>{URL.revokeObjectURL(src);reject(new Error('No se pudo abrir esa imagen. Prueba con JPG o PNG.'));};img.src=src;
 });
}
async function uploadPhotoToSlot(file,slot=pendingUploadSlot){
 if(!file)return;if(!/^image\//i.test(file.type||'')){toast('Elige una foto en JPG, PNG o WebP.','error');return;}
 const p=activeProject(),scene=p?.scenes[state.selectedScene];if(!p||!scene)return;
 try{
  toast('Preparando y guardando tu imagen…');const {blob,width,height}=await compressPhoto(file);const localId=uid();await putLocalPhoto(localId,blob,file.name||'foto subida');const url=URL.createObjectURL(blob);uploadedObjectUrls.set(localId,url);const item={title:file.name||`Foto escena ${state.selectedScene+1}`,url,localId,local:true,sourceUrl:'',sourceName:'Imagen subida desde el dispositivo',license:'Archivo aportado por el usuario',artist:'',credit:'Imagen local del usuario',width,height,mime:'image/jpeg',tags:[scene.headline,scene.beat,p.topic].filter(Boolean).join(' ')};
  const arr=Array.isArray(scene.images)?scene.images.slice(0,2):[null,null];while(arr.length<2)arr.push(null);arr[slot]=item;scene.images=arr;await loadImage(url);updateImageAttributions(p);touch();renderSceneImagesEditor();renderPreview();renderHistory();toast(`Foto subida y guardada en la escena ${state.selectedScene+1}, imagen ${slot+1}.`,'success');
 }catch(e){toast('No se pudo guardar la foto: '+String(e.message||e),'error');}
}
function photoThumb(item){if(!item)return '';const im=item.url?imageCache.get(item.url):null;return im&&im.__loadedImage?im.src:(item.url||'');}
function renderSceneImagesEditor(){
 const box=$('sceneImagesEditor');if(!box)return;const p=activeProject(),scene=p?.scenes[state.selectedScene];if(!p||!scene){box.innerHTML='';return;}
 const images=Array.isArray(scene.images)?scene.images:[null,null];
 box.innerHTML='<div class="scene-images-heading"><div><b>Imágenes de esta escena</b><small>Hasta dos fotos grandes; una basta si es pertinente. Si la búsqueda falla, descarga una imagen del navegador y súbela al hueco correcto.</small></div><button type="button" class="btn small" id="searchRelatedBoth">Completar fotos</button></div><div class="scene-image-slots">'+[0,1].map(slot=>{const item=images[slot];const ready=!!(item?.url&&imageCache.get(item.url)?.__loadedImage);const title=item?.title||'';const src=ready?photoThumb(item):'';return `<article class="scene-image-slot ${ready?'has-photo':'missing-photo'}"><div class="scene-image-thumb">${src?`<img src="${esc(src)}" alt="Foto ${slot+1}" loading="lazy">`:'<div class="image-empty-symbol">▧</div><b>FOTO ${slot+1} FALTANTE</b>'}</div><div class="scene-image-slot-info"><b>Imagen ${slot+1} ${ready?'✓':'· pendiente'}</b><small>${esc(title||'Todavía no hay una foto asignada')}</small></div><div class="scene-image-actions"><button type="button" class="btn small primary" data-image-search="${slot}">⌕ Buscar relacionadas</button><button type="button" class="btn small" data-image-upload="${slot}">↑ Subir imagen</button>${item?`<button type="button" class="btn small danger" data-image-remove="${slot}">Quitar</button>`:''}</div></article>`;}).join('')+'</div><small class="fineprint">Las fotos subidas se guardan en este navegador y se pueden dibujar en la exportación. Las fotos encontradas en páginas externas se prueban mediante fuentes abiertas/proxy; si una web bloquea su descarga, usa la subida manual.</small>';
}
function setRelatedSearchLinks(query){
 const box=$('imageSearchLinks');if(!box)return;const q=encodeURIComponent(String(query||''));const links=[['Google Imágenes',`https://www.google.com/search?tbm=isch&q=${q}`],['Bing Imágenes',`https://www.bing.com/images/search?q=${q}`],['DuckDuckGo',`https://duckduckgo.com/?q=${q}&iax=images&ia=images`],['Reddit',`https://www.reddit.com/search/?q=${q}`],['Pinterest',`https://www.pinterest.com/search/pins/?q=${q}`],['Pexels',`https://www.pexels.com/search/${q}/`],['Pixabay',`https://pixabay.com/images/search/${q}/`],['Unsplash',`https://unsplash.com/s/photos/${q}`],['Flickr',`https://www.flickr.com/search/?text=${q}`],['Commons',`https://commons.wikimedia.org/w/index.php?search=${q}`]];
 box.innerHTML=links.map(([label,url])=>`<a class="btn small" href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`).join('');
}
function renderRelatedResults(){
 const box=$('imageSearchResults');if(!box)return;const results=imageSearchState.results||[];
 if(imageSearchState.busy){box.innerHTML='<div class="image-search-message">Buscando en fuentes abiertas y probando resultados…</div>';return;}
 if(!results.length){box.innerHTML='<div class="image-search-message">No salieron resultados utilizables de las fuentes automáticas. Usa Google/Bing/Reddit/Pinterest arriba, descarga la foto y pulsa “Subir imagen” en el hueco correspondiente.</div>';return;}
 box.innerHTML=results.map((item,index)=>{const preview=item.url;return `<article class="related-result"><a class="related-result-image" href="${esc(item.sourceUrl||item.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(preview)}" loading="lazy" alt="${esc(item.title||'Fotografía relacionada')}"></a><div class="related-result-copy"><b>${esc(item.title||'Fotografía relacionada')}</b><small>${esc(item.sourceName||'Fuente abierta')}${item.license?' · '+esc(item.license):''}</small><div class="related-result-actions"><button type="button" class="btn small primary" data-use-related="${index}">Usar esta foto</button><a href="${esc(item.sourceUrl||item.url)}" target="_blank" rel="noopener noreferrer" class="text-link">Ver original ↗</a></div></div></article>`;}).join('');box.querySelectorAll('img').forEach((img,i)=>img.addEventListener('error',()=>{const item=results[i];if(item&&img.dataset.proxyTried!=='1'){img.dataset.proxyTried='1';img.src=proxyImageUrl(item.url);}}));
}
async function searchRelatedForSlot(queryOverride=''){
 const p=activeProject(),scene=p?.scenes[imageSearchState.sceneIndex];if(!p||!scene)return;const query=String(queryOverride||$('relatedQuery')?.value||scene.imageQuery||`${scene.headline} ${p.topic}`).trim();imageSearchState.query=query;imageSearchState.results=[];imageSearchState.busy=true;if($('relatedQuery'))$('relatedQuery').value=query;setRelatedSearchLinks(query);renderRelatedResults();
 try{
  const variants=[query,compactImageQuery(query),compactImageQuery(`${scene.headline||scene.beat||''} ${p.topic}`)].filter((v,i,a)=>v&&a.indexOf(v)===i).slice(0,3);const combined=[];const seen=new Set();
  for(const q of variants){const rounds=await Promise.all([searchImageSources(q,0),searchImageSources(q,1)]);for(const raw of rounds){for(const item of rankImageCandidates(q,raw,22)){const key=imageDedupeKey(item);if(!key||seen.has(key))continue;seen.add(key);combined.push(item);if(combined.length>=28)break;}if(combined.length>=28)break;}if(combined.length>=28)break;}
  imageSearchState.results=combined.slice(0,24);
 }catch(e){log('Búsqueda relacionada falló: '+String(e.message||e).slice(0,100));imageSearchState.results=[];}
 finally{imageSearchState.busy=false;renderRelatedResults();}
}
function openRelatedSearch(slot){
 const p=activeProject(),scene=p?.scenes[state.selectedScene];if(!p||!scene)return;imageSearchState={sceneIndex:state.selectedScene,slot,query:String(scene.imageQuery||`${scene.headline||scene.beat||p.topic} fotografía real`),results:[],busy:false};if($('imageSearchSubtitle'))$('imageSearchSubtitle').textContent=`Escena ${state.selectedScene+1} · imagen ${slot+1}. Elige una fotografía y pulsa “Usar esta foto”, o búscala en otra web y súbela desde este hueco.`;if($('imageSearchModal')?.showModal)$('imageSearchModal').showModal();else $('imageSearchModal')?.setAttribute('open','');setRelatedSearchLinks(imageSearchState.query);searchRelatedForSlot(imageSearchState.query);
}
async function useRelatedResult(index){
 const item=imageSearchState.results[index],p=activeProject(),scene=p?.scenes[imageSearchState.sceneIndex];if(!item||!p||!scene)return;const btn=document.querySelector(`[data-use-related="${index}"]`);if(btn){btn.disabled=true;btn.textContent='Comprobando…';}
 try{const img=await loadImage(item.url);if(!img||!img.__loadedImage||img.naturalWidth<180||img.naturalHeight<120)throw new Error('El servidor bloqueó la incorporación de esta foto. Abre el resultado, descárgalo y súbelo manualmente.');const arr=Array.isArray(scene.images)?scene.images.slice(0,2):[null,null];while(arr.length<2)arr.push(null);arr[imageSearchState.slot]={...item,local:false};scene.images=arr;updateImageAttributions(p);touch();renderSceneImagesEditor();renderPreview();renderHistory();$('imageSearchModal')?.close?.();toast(`Foto incorporada en escena ${imageSearchState.sceneIndex+1}, imagen ${imageSearchState.slot+1}.`,'success');}catch(e){toast(String(e.message||e),'error');if(btn){btn.disabled=false;btn.textContent='Usar esta foto';}}
}
function updateImageAttributions(p){
 const all=(p.scenes||[]).flatMap((scene,i)=>(scene.images||[]).filter(Boolean).map(item=>({scene:i+1,item})));
 const lines=[...new Set(all.filter(x=>x.item?.sourceUrl).map(({scene,item})=>`Escena ${scene} — ${item.title||'Fotografía'} (${item.sourceName||'Fuente abierta'}): ${item.sourceUrl} · Licencia: ${item.license||'Consultar licencia'}${item.artist?' · Autor: '+item.artist:''}`))];
 const marker='\n\nAtribución de imágenes (fotografías por escena):\n';
 const old=p._imageAttributionText||'';
 if(old&&p.description?.sourcesText)p.description.sourcesText=p.description.sourcesText.replace(old,'').trim();
 p.description=p.description&&typeof p.description==='object'&&!Array.isArray(p.description)?p.description:{};
 const base=String(p.description.text||'').split(marker)[0].trimEnd();
 p.description.text=lines.length?base+marker+lines.join('\n'):base;
 p._imageAttributionText=lines.join('\n');
 p.description.sourcesText=[String(p.description.sourcesText||'').trim(),p._imageAttributionText].filter(Boolean).join('\n');
}
async function fetchComparisonImages(p){
 const scenes=p.scenes||[];if(!scenes.length)throw new Error('El proyecto no tiene escenas para ilustrar.');
 const usedUrls=new Set();
 for(let index=0;index<scenes.length;index++){
  const scene=scenes[index],prior=Array.isArray(scene.images)?scene.images.slice(0,2):[null,null];
  const loaded=await Promise.all([0,1].map(slot=>prior[slot]?.url?loadImage(prior[slot].url):Promise.resolve(null)));
  const keep=[0,1].map(slot=>{const im=loaded[slot],item=prior[slot];return item&&im&&im.__loadedImage&&im.naturalWidth>=240&&im.naturalHeight>=180?item:null;});
  keep.filter(Boolean).forEach(item=>usedUrls.add(imageDedupeKey(item)));
  const need=2-keep.filter(Boolean).length;
  const found=need>0?await searchTwoSceneImages(scene,p,index,usedUrls,need):[];
  let next=0;for(let slot=0;slot<2&&next<found.length;slot++){if(!keep[slot])keep[slot]=found[next++];}
  scene.images=keep;scene.images.filter(Boolean).forEach(item=>usedUrls.add(imageDedupeKey(item)));
 }
 await preloadProjectImages(p);
 const ready=item=>{if(!item?.url)return false;const cached=imageCache.get(item.url);return !!(cached&&cached.__loadedImage&&cached.naturalWidth>=240&&cached.naturalHeight>=180);};
 scenes.forEach(scene=>{scene.images=[0,1].map(i=>ready(scene.images?.[i])?scene.images[i]:null);});
 const usable=scenes.reduce((sum,scene)=>sum+(scene.images||[]).filter(Boolean).length,0);
 updateImageAttributions(p);saveState();renderPreview();renderSceneImagesEditor();
 const missing=scenes.map((scene,i)=>({n:i+1,count:(scene.images||[]).filter(Boolean).length})).filter(x=>x.count<2);
 const empty=missing.filter(x=>x.count===0);
 if(missing.length){const brief=missing.map(x=>`escena ${x.n}: ${x.count}/2`).join(', ');log(`Fotos parciales: ${brief}. Una foto puede ocupar la composición completa; la segunda es opcional.`);toast(empty.length?`Se encontraron ${usable} fotos. Aún faltan escenas sin foto: ${empty.map(x=>x.n).join(', ')}.`:`Se encontraron ${usable} fotos. Algunas escenas usarán una foto amplia; la segunda es opcional.`,empty.length?'error':'success');}
 return usable;
}
async function ensureProjectImagesReady(p,searchMissing=true){
 await preloadProjectImages(p);
 const isReady=item=>{if(!item?.url)return false;const img=imageCache.get(item.url);return !!(img&&img.__loadedImage&&img.naturalWidth>=240&&img.naturalHeight>=180);};
 const usedUrls=new Set();
 p.scenes.forEach(scene=>{scene.images=[0,1].map(i=>isReady(scene.images?.[i])?scene.images[i]:null);scene.images.filter(Boolean).forEach(item=>usedUrls.add(imageDedupeKey(item)));});
 let missing=p.scenes.map((scene,index)=>({scene,index})).filter(x=>x.scene.images.filter(Boolean).length<2);
 if(missing.length&&searchMissing){
  for(const {scene,index} of missing){
   const needed=2-scene.images.filter(Boolean).length;
   const add=(await searchTwoSceneImages(scene,p,index,usedUrls,needed)).slice(0,needed);
   let cursor=0;for(let slot=0;slot<2&&cursor<add.length;slot++){if(!scene.images[slot]){scene.images[slot]=add[cursor++];usedUrls.add(imageDedupeKey(scene.images[slot]));}}
  }
  await preloadProjectImages(p);
  p.scenes.forEach(scene=>{scene.images=[0,1].map(i=>isReady(scene.images?.[i])?scene.images[i]:null);});
  updateImageAttributions(p);touch();renderSceneImagesEditor();renderPreview();
 }
 const counts=p.scenes.map((scene,index)=>({index:index+1,count:scene.images.filter(Boolean).length}));
 const incomplete=counts.filter(x=>x.count===0);
 if(incomplete.length)throw new Error('No se exportó para evitar escenas completamente vacías. Faltan fotografías en '+incomplete.map(x=>`escena ${x.index}`).join(', ')+'. Abre el editor y usa “Buscar relacionadas” o “Subir imagen”. Las escenas con una foto válida sí se pueden exportar.');
 return counts.reduce((sum,x)=>sum+x.count,0);
}
async function refreshSelectedSceneImages(){
 const p=activeProject(),scene=p?.scenes[state.selectedScene];if(!scene)return;
 const button=$('refreshSceneImages'),old=button?.textContent;if(button){button.disabled=true;button.textContent='Completando fotos…';}
 try{
  const prior=Array.isArray(scene.images)?scene.images.slice(0,2):[null,null];
  const loaded=await Promise.all([0,1].map(slot=>prior[slot]?.url?loadImage(prior[slot].url):Promise.resolve(null)));
  const keep=[0,1].map(slot=>{const im=loaded[slot],item=prior[slot];return item&&im&&im.__loadedImage&&im.naturalWidth>=240&&im.naturalHeight>=180?item:null;});
  const used=new Set(p.scenes.flatMap(s=>s.images||[]).filter(Boolean).map(imageDedupeKey));
  const need=2-keep.filter(Boolean).length,found=need?await searchTwoSceneImages(scene,p,state.selectedScene,used,need):[];let cursor=0;
  for(let slot=0;slot<2&&cursor<found.length;slot++){if(!keep[slot])keep[slot]=found[cursor++];}
  scene.images=keep;await preloadProjectImages(p);
  scene.images=[0,1].map(i=>{const item=scene.images[i],im=item?.url?imageCache.get(item.url):null;return im&&im.__loadedImage&&im.naturalWidth>=240&&im.naturalHeight>=180?item:null;});
  updateImageAttributions(p);touch();renderPreview();renderSceneImagesEditor();renderHistory();log(`Fotos completadas para escena ${state.selectedScene+1}.`);
  const count=scene.images.filter(Boolean).length;toast(count===2?'Las dos fotos están listas; se conservaron las imágenes que ya tenías.':count===1?'La escena ya tiene una foto válida. La segunda es opcional; puedes exportar.':'No se encontró ninguna foto. Añade al menos una antes de exportar.',count>0?'success':'error');
 }catch(e){toast('No se pudieron completar las fotos: '+String(e.message||e),'error');}
 finally{if(button){button.disabled=false;button.textContent=old||'＋ Completar fotos';}}
}
async function refreshAllSceneImages(){
 const p=activeProject();if(!p)return;const button=$('refreshAllImages'),old=button?.textContent;if(button){button.disabled=true;button.textContent='Buscando 2 fotos por escena…';}
 try{
  const n=await fetchComparisonImages(p);touch();syncEditor();renderHistory();log('Fotos comprobadas: '+n+' para '+p.topic);
  const missing=p.scenes.map((scene,i)=>({scene:i+1,count:(scene.images||[]).filter(Boolean).length})).filter(x=>x.count===0);
  if(missing.length)toast(`Se encontraron ${n} fotos. Aún hay escenas sin ninguna foto: ${missing.map(x=>x.scene).join(', ')}. Completa al menos una por escena.`,'error');
  else toast(`Hay al menos una foto válida en cada escena. Las fotos adicionales son opcionales.`,'success');
 }catch(e){toast(String(e.message||e),'error');}
 finally{if(button){button.disabled=false;button.textContent=old||'✦ Buscar todas';}}
}

const EMO={
 feliz_pulgar:'sonriente con pulgar arriba: aprobación, buena noticia, "esto funciona"',
 guino_senala:'guiño señalando al espectador: complicidad, dato curioso dirigido al público, "tú"',
 celebra_salto:'risa eufórica con puños y salto: gran logro, victoria, éxito rotundo',
 sorprendido:'boca en O con manos en las mejillas: sorpresa por un dato inesperado',
 cool_gafas:'gafas de sol y gesto de señalar: confianza, algo genial o impresionante',
 triste_lagrimas:'llorando de tristeza: pérdida, tragedia, injusticia, final triste',
 enojado:'ceño fruncido y puños: enojo, indignación, conflicto',
 miedo_nervioso:'manos en la boca y gota de sudor: miedo, nervios, suspenso, amenaza',
 enamorado:'ojos de corazón: algo que encanta, amor, adoración',
 grita_estres:'gritando con ojos cerrados: estrés, caos, pánico, ruido',
 tierno:'sonrojado con sonrisa y ojos cerrados: ternura, cariño, alivio dulce',
 duda_pensando:'mano en la barbilla: pregunta, reflexión, "¿y si…?"',
 risa:'carcajada señalando: humor, algo gracioso',
 musica_calma:'audífonos y ojos cerrados: calma, música, relajación, concentración',
 sueno_aburrido:'cansado con zzz: aburrimiento, sueño, rutina, monotonía',
 ojos_estrella:'ojos de estrella y boca abierta: fascinación, maravilla, descubrimiento increíble',
 timido:'sonrojado y apenado: vergüenza, timidez, incomodidad leve',
 curioso:'boca en o, mano en la barbilla y signo de pregunta: curiosidad, intriga, misterio ligero (emoción base neutra)',
 malicioso:'cejas fruncidas, sonrisa torcida y brazos cruzados: plan oculto, travesura, sospecha, engaño',
 alegre_abierto:'risa con brazos abiertos: bienvenida alegre, entusiasmo, "¡y hay más!"',
 llanto_abrazado:'llorando abrazando las rodillas: dolor profundo, soledad, desconsuelo',
 animado_puno:'guiño con puño arriba: ánimo, motivación, determinación',
 indiferente:'párpados caídos y sonrisa ladeada: escepticismo, ironía, "como si nada", desinterés',
 molesto:'brazos cruzados, ceño fruncido y bufido: fastidio, desacuerdo',
 alerta:'boca abierta con signos de exclamación: alerta, advertencia, atención, descubrimiento repentino',
 comiendo:'comiendo fideos con un corazón: comida, disfrutar un gusto cotidiano',
 orgulloso:'ojos cerrados, sonrisa de suficiencia y brillo: orgullo, presumir, "lo sabía"',
 agobiado:'cara decaída con sudor y líneas azules: desánimo, agobio, mala noticia, decepción',
 paz_guino:'guiño con doble señal de paz: tono ligero, despedida simpática',
 corazon_roto:'abrazando un corazón roto: desamor, traición, pérdida emocional',
 saluda:'sonriente saludando con la mano: bienvenida, intro, despedida',
 mente_explotada:'cabeza explotando: dato alucinante que rompe la mente, giro inesperado enorme'
};
const EMO_IDS=Object.keys(EMO);
// Nombres de la versión anterior (proyectos guardados) → sprite equivalente actual.
const EMO_LEGACY={llora:'triste_lagrimas',preocupado:'agobiado',aburrido:'sueno_aburrido',calma_meditar:'musica_calma',asombro_leve:'curioso',celebra_punos:'animado_puno',grita_estres:'grita_estres'};
// Tono del tema → emociones PROHIBIDAS (incoherentes) y emoción base sobria.
const EMO_BLOCK={
 serio:['feliz_pulgar','celebra_salto','cool_gafas','enamorado','tierno','risa','sueno_aburrido','alegre_abierto','animado_puno','comiendo','orgulloso','paz_guino','guino_senala','timido','musica_calma'],
 neutral:['celebra_salto','enamorado','comiendo','paz_guino','llanto_abrazado','corazon_roto','grita_estres'],
 ligero:['triste_lagrimas','llanto_abrazado','corazon_roto','miedo_nervioso','grita_estres','enojado','agobiado','molesto']
};
const EMO_BASE={serio:'duda_pensando',neutral:'curioso',ligero:'feliz_pulgar'};
// Palabras clave (sin acentos) → emoción, para cuando la IA no devuelve emociones válidas.
const EMO_KEYWORDS=[
 [/miedo|peligro|amenaza|terror|oscur|muerte|morir|mortal|fantasma|inquiet|desaparec|acech/,'miedo_nervioso'],
 [/tragedia|murio|murier|fallec|perdio|perdida|dolor|lloro|tristeza|luto|naufrag/,'triste_lagrimas'],
 [/enoj|furios|indign|injust|rabia|\bira\b/,'enojado'],
 [/engan|truco|oculto|manipul|mentira|trampa|encubr/,'malicioso'],
 [/increible|sorprend|asombr|inesperad|de repente|nadie esperaba|sin embargo|resulta que/,'sorprendido'],
 [/explot|imposible|alucin|millones|record|jamas/,'mente_explotada'],
 [/descubr|maravill|fascin|extraordinari/,'ojos_estrella'],
 [/cuidado|atencion|advert|ojo con|alerta/,'alerta'],
 [/gracioso|risa|chiste|divertid|humor/,'risa'],
 [/aburr|rutina|monoton|cansanc|sueno\b/,'sueno_aburrido'],
 [/calma|relaj|tranquil|musica|escuch/,'musica_calma'],
 [/amor|enamor|encant|adora|pareja|romance/,'enamorado'],
 [/vergonz|pena|incomod|rubor|apenad/,'timido'],
 [/traicion|corazon roto|desamor|abandono/,'corazon_roto'],
 [/orgull|presum|merecid|lo sabia/,'orgulloso'],
 [/indiferent|no le import|le da igual|desinteres/,'indiferente'],
 [/fastidio|molest|queja|irrit|harto/,'molesto'],
 [/aplaud|celebr|festej|lo consigu|lo logro/,'animado_puno'],
 [/comida|comer|receta|sabor|platillo|hambre/,'comiendo'],
 [/bienvenid|hola a todos|comenzamos|nos vemos|hasta pronto/,'saluda'],
 [/musica|melodia|cancion|ritmo|relajacion/,'musica_calma'],
 [/agot|estresad|presion|demasiadas cosas/,'agobiado'],
 [/fallo|error|salio mal|no funciona|decepcion/,'agobiado'],
 [/curioso|intriga|misterio|enigma|que pasaria/,'curioso'],
 [/wow|increible|extraordinario|nunca visto|rompe todos los records/,'mente_explotada'],
 [/\?/,'duda_pensando']
];
const EMO_NOACC=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function cleanEmos(a,tone,allowed){
 let e=Array.isArray(a)?a.map(x=>{x=String(x);return EMO[x]?x:(EMO_LEGACY[x]||x)}).filter(x=>EMO[x]):[];
 if(tone&&EMO_BLOCK[tone])e=e.filter(x=>!EMO_BLOCK[tone].includes(x));
 if(allowed&&allowed.length>=3)e=e.filter(x=>allowed.includes(x));
 return e.filter((x,i)=>x!==e[i-1]).slice(0,tone?5:7);
}
const POSE_EMO={question:'duda_pensando',think:'duda_pensando',explain:'guino_senala',point:'cool_gafas',confident:'feliz_pulgar',celebrate:'animado_puno',curious:'curioso',worried:'miedo_nervioso',neutral:'curioso',greet:'saluda',analyze:'duda_pensando',excited:'animado_puno',surprised:'sorprendido',confused:'agobiado',error:'triste_lagrimas',completed:'celebra_salto',waiting:'sueno_aburrido'};
function emoUrl(id){return 'assets/emo/'+(EMO[id]?id:(EMO_LEGACY[id]||POSE_EMO[id]||'curioso'))+'.png';}
const emoSeqCache=new Map();
// Emociones de una escena: las que eligió la IA (validadas por tono) o, si no hay, las deducidas de la narración.
function emotionSeq(sc,p){
 const tone=EMO_BLOCK[p&&p.tone]?p.tone:'neutral',allowed=Array.isArray(p&&p.allowedEmotions)?p.allowedEmotions:[];
 const key=tone+'|'+allowed.join(',')+'|'+(sc.emotions||[]).join(',')+'|'+(sc.narration||'');
 if(emoSeqCache.has(key))return emoSeqCache.get(key);
 let e=cleanEmos(sc.emotions,tone,allowed);
 if(!e.length){
  const txt=EMO_NOACC(sc.narration),found=[];
  EMO_KEYWORDS.forEach(([re,id])=>{const m=re.exec(txt);if(m&&!EMO_BLOCK[tone].includes(id))found.push([m.index,id]);});
  found.sort((x,y)=>x[0]-y[0]);
  const ids=[...new Set(found.map(x=>x[1]))].slice(0,4),base=EMO_BASE[tone];
  e=ids.length?((found[0][0]<txt.length*.25)?ids:[base,...ids]):[base];
  e=e.filter((x,i)=>x!==e[i-1]).slice(0,5);
 }
 if(emoSeqCache.size>400)emoSeqCache.clear();
 emoSeqCache.set(key,e);return e;
}
function svgPoseData(pose='question',profile){return emoUrl(pose);}
function svgPoseDataOld(pose='question',profile=loadMascotProfile()){
 const mascot=normalizeMascotProfile(profile),accent=mascot.accentColor||'#ee624b';
 const hair='<path d="M194 54 Q185 39 198 29 Q210 22 218 40 M225 39 Q229 11 248 19 Q262 22 264 39 M270 38 Q282 13 299 27 Q308 34 304 48" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M196 49 Q201 39 209 39 M238 26 Q248 18 257 29 M280 28 Q291 24 297 35" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>';
 const poses={
  question:{left:'M250 166 L173 219 L214 269',right:'M250 166 L327 219 L286 269',lh:[214,269],rh:[286,269],eyes:'<path d="M220 91 L220 111 M277 91 L277 111"/>',brows:'<path d="M207 75 Q220 66 234 75 M265 75 Q278 66 291 75"/>',mouth:'<path d="M207 124 Q250 160 293 124"/>',legs:'<path d="M250 314 L250 548 M250 314 L307 390 L323 431 L250 476 L270 548"/>' ,extra:'<path d="M363 44 l0 -15 M363 44 l11 7" stroke="'+accent+'" stroke-width="5"/>'},
  think:{left:'M250 166 L180 218 L213 266',right:'M250 166 L302 202 L284 132',lh:[213,266],rh:[284,132],eyes:'<path d="M220 91 L220 111 M277 92 Q284 89 285 99"/>',brows:'<path d="M207 75 Q220 65 234 75 M267 72 L291 66"/>',mouth:'<path d="M230 130 Q250 121 271 130"/>',legs:'<path d="M250 314 L250 548 M250 314 L304 386 L296 434 L340 548"/>',extra:'<circle cx="346" cy="27" r="9" fill="none" stroke="'+accent+'" stroke-width="5"/><circle cx="369" cy="12" r="5" fill="'+accent+'"/>'},
  explain:{left:'M250 166 L176 219 L213 267',right:'M250 166 L326 180 L405 160',lh:[213,267],rh:[405,160],eyes:'<path d="M220 91 L220 111 M277 91 L277 111"/>',brows:'<path d="M207 75 L234 75 M265 75 L292 75"/>',mouth:'<path d="M207 124 Q250 160 293 124"/>',legs:'<path d="M250 314 L250 425 L203 467 L210 548 M250 314 L250 421 L304 465 L350 548"/>',extra:'<path d="M405 160 l-15 -10 M405 160 l-14 12" stroke="'+accent+'" stroke-width="5" fill="none"/>'},
  point:{left:'M250 166 L174 220 L213 267',right:'M250 166 L306 129 L395 73',lh:[213,267],rh:[395,73],eyes:'<path d="M216 98 Q225 88 234 98 M277 91 L277 111"/>',brows:'<path d="M207 75 Q220 65 234 75 M266 72 L291 66"/>',mouth:'<path d="M207 124 Q250 160 293 124"/>',legs:'<path d="M250 314 L250 421 L298 466 L247 548 M250 314 L250 421 L208 470 L207 548"/>',extra:'<path d="M395 73 l-18 2 M395 73 l-4 17 M379 49 l-8 -8" stroke="'+accent+'" stroke-width="5" fill="none"/>'},
  confident:{left:'M250 166 L167 214 L213 267',right:'M250 166 L333 214 L287 267',lh:[213,267],rh:[287,267],eyes:'<path d="M216 99 Q225 90 235 99 M265 99 Q275 90 285 99"/>',brows:'<path d="M207 75 L234 75 M265 75 L292 75"/>',mouth:'<path d="M205 122 Q250 163 295 122"/>',legs:'<path d="M250 314 L250 423 L208 471 L219 548 M250 314 L250 423 L298 470 L284 548"/>',extra:'<path d="M159 55 l-11 -12 M341 55 l11 -12" stroke="'+accent+'" stroke-width="5" stroke-linecap="round"/>'},
  celebrate:{left:'M250 166 L206 103 L145 45',right:'M250 166 L294 103 L355 45',lh:[145,45],rh:[355,45],eyes:'<path d="M211 99 Q225 84 239 99 M261 99 Q275 84 289 99"/>',brows:'<path d="M207 75 Q224 62 239 75 M261 75 Q277 62 292 75"/>',mouth:'<path d="M207 120 Q250 176 293 120 Q250 190 207 120 Z" fill="#111"/>',legs:'<path d="M250 314 L213 410 L159 455 L130 529 M250 314 L295 409 L344 450 L385 519"/>',extra:'<path d="M111 55 l-15 -12 M149 29 l-4 -16 M250 8 l0 -16 M389 55 l15 -12 M351 29 l4 -16" stroke="'+accent+'" stroke-width="6" stroke-linecap="round"/>'},
  curious:{left:'M250 166 L169 192 L104 174',right:'M250 166 L329 208 L393 229',lh:[104,174],rh:[393,229],eyes:'<ellipse cx="220" cy="101" rx="7" ry="12" fill="#111"/><ellipse cx="278" cy="100" rx="9" ry="13" fill="#111"/>',brows:'<path d="M207 74 Q220 61 236 75 M264 68 Q278 54 293 70"/>',mouth:'<ellipse cx="250" cy="130" rx="12" ry="16" fill="#111"/>',legs:'<path d="M250 314 L250 421 L298 465 L248 548 M250 314 L250 421 L207 470 L207 548"/>',extra:'<circle cx="368" cy="27" r="10" fill="'+accent+'"/><path d="M102 164 l-12 -10 M102 164 l-2 -15" stroke="#111" stroke-width="5" stroke-linecap="round"/>'},
  worried:{left:'M250 166 L187 221 L229 248',right:'M250 166 L313 221 L271 248',lh:[229,248],rh:[271,248],eyes:'<path d="M220 91 L220 110 M277 91 L277 110"/>',brows:'<path d="M207 83 L236 69 M264 69 L293 83"/>',mouth:'<path d="M224 140 Q250 119 276 140"/>',legs:'<path d="M250 314 L250 421 L214 466 L221 548 M250 314 L250 421 L291 466 L284 548"/>',extra:'<path d="M300 110 Q321 123 308 143 Q291 129 300 110Z" fill="#9cdcf3" stroke="#111" stroke-width="3"/><path d="M176 96 l-9 -12 M324 96 l9 -12" stroke="#111" stroke-width="5"/>'}
 };
 Object.assign(poses,{
  neutral:{...poses.confident,eyes:'<path d="M220 94 L220 108 M278 94 L278 108"/>',brows:'<path d="M208 76 Q221 72 234 76 M266 76 Q279 72 292 76"/>',mouth:'<path d="M222 128 Q250 145 278 128"/>',extra:''},
  greet:{...poses.explain,right:'M250 166 L302 132 L333 91',rh:[333,91],extra:'<path d="M346 80 q12 10 0 20 M355 72 q15 14 0 28 M360 91 q9 8 0 16" stroke="'+accent+'" stroke-width="5" fill="none" stroke-linecap="round"/>'},
  analyze:{...poses.think,extra:'<circle cx="354" cy="26" r="10" fill="none" stroke="'+accent+'" stroke-width="5"/><path d="M370 44 h15 M377 36 v16" stroke="#365CFF" stroke-width="5" stroke-linecap="round"/>'},
  excited:{...poses.celebrate},
  surprised:{...poses.curious},
  confused:{...poses.worried,eyes:'<ellipse cx="220" cy="101" rx="7" ry="12" fill="#111"/><ellipse cx="279" cy="101" rx="7" ry="12" fill="#111"/>',brows:'<path d="M208 72 L234 82 M266 82 L291 69"/>',mouth:'<path d="M233 132 Q250 119 268 137"/>',extra:'<path d="M355 28 q20 22 -1 42 q-20 0 -7 -14 q10 -8 8 -16" fill="none" stroke="'+accent+'" stroke-width="5" stroke-linecap="round"/><circle cx="354" cy="79" r="3.5" fill="'+accent+'"/>'},
  error:{...poses.worried,extra:'<path d="M354 36 l25 25 M379 36 l-25 25" stroke="#FF4F70" stroke-width="7" stroke-linecap="round"/><path d="M365 70 v5" stroke="#FF4F70" stroke-width="6" stroke-linecap="round"/>'},
  completed:{...poses.celebrate,extra:'<path d="M343 54 l13 13 l28 -32" stroke="#23956D" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'},
  waiting:{...poses.think,eyes:'<path d="M216 100 h12 M272 100 h12"/>',brows:'<path d="M207 76 Q220 70 234 76 M265 76 Q278 70 292 76"/>',mouth:'<path d="M230 132 Q250 126 270 132"/>',extra:'<circle cx="345" cy="30" r="4" fill="'+accent+'"/><circle cx="361" cy="30" r="4" fill="'+accent+'"/><circle cx="377" cy="30" r="4" fill="'+accent+'"/>'}
 });
 const z=poses[pose]||poses.question;
 const accessory='';
 const headTilt=['think','analyze','waiting'].includes(pose)?-4:['curious','surprised','confused'].includes(pose)?4:['worried','error'].includes(pose)?-3:['celebrate','excited','completed'].includes(pose)?2:0;
 const footAnchors={question:[[225,548],[285,548]],think:[[225,548],[340,548]],explain:[[210,548],[350,548]],point:[[245,548],[207,548]],confident:[[219,548],[284,548]],celebrate:[[130,529],[385,519]],curious:[[250,548],[190,548]],worried:[[221,548],[284,548]],neutral:[[219,548],[284,548]],greet:[[210,548],[350,548]],analyze:[[225,548],[340,548]],excited:[[130,529],[385,519]],surprised:[[250,548],[190,548]],confused:[[221,548],[284,548]],error:[[221,548],[284,548]],completed:[[130,529],[385,519]],waiting:[[225,548],[340,548]]};
 const shoes=(footAnchors[pose]||footAnchors.question).map(([x,y])=>`<path d="M ${x-24} ${y} Q ${x-3} ${y-13} ${x+17} ${y} L ${x+23} ${y+7} L ${x-27} ${y+7} Z" stroke-width="7"/>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="590" viewBox="0 0 500 590"><g fill="none" stroke="#111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M250 151 L250 170"/><path d="${z.left}"/><path d="${z.right}"/><path d="M250 168 L250 312" stroke-width="7"/><path d="M250 303 C231 285 208 291 204 305 C219 323 239 314 250 306 C263 314 283 323 297 305 C293 291 270 285 250 303" stroke-width="7"/>${z.legs}${shoes}</g><g transform="rotate(${headTilt} 250 91)"><circle cx="250" cy="91" r="69" fill="#fff" stroke="#111" stroke-width="9"/><path d="M185 99 Q174 81 185 62" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>${hair}<g fill="none" stroke="#111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${z.eyes}${z.brows}</g>${accessory}<g fill="none" stroke="#111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">${z.mouth}</g></g><g fill="#fff" stroke="#111" stroke-width="5"><ellipse cx="${z.lh[0]}" cy="${z.lh[1]}" rx="13" ry="11"/><ellipse cx="${z.rh[0]}" cy="${z.rh[1]}" rx="13" ry="11"/></g>${z.extra}</svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

async function loadStickPoses(profile=loadMascotProfile()){await Promise.all([...new Set([...DEFAULT_STICK_POSES,...AVATAR_STATE_POSES])].map(pose=>loadImage(svgPoseData(pose,profile))));if(typeof renderPreview==='function'&&activeProject())renderPreview();}

let state = {projects:[],activeId:null,batch:[],activity:[],quota:{},settings:{provider:'gemini',models:{}},preview:{time:0,playing:false},selectedScene:0,selectedFact:null};
let raf=0,lastFrame=0,recorder=null,recordChunks=[],recordingAudio=null,recordingStream=null;const voiceBufferCache=new Map();
const longVideoState={file:null,objectUrl:'',duration:0,width:0,height:0,remoteFile:null,segments:[],voiceBuffers:new Map(),busy:false,uploadXhr:null,previewSegmentId:null,exporting:new Set()};
function normalizeProject(p, resetVerified=true) {
 if(!p||typeof p!=='object') throw new Error('El archivo no contiene un proyecto JSON válido.');
 p=clone(p); p.schemaVersion=2;p.id=String(p.id||uid());p.topic=String(p.topic||'Short sin título').slice(0,80);p.fps=30;
 p.facts=Array.isArray(p.facts)?p.facts.filter(f=>f&&typeof f==='object').map((f,i)=>({id:String(f.id||'f'+(i+1)),claim:String(f.claim||''),value:f.value!==null&&f.value!==undefined&&f.value!==''&&Number.isFinite(Number(f.value))?Number(f.value):null,unit:String(f.unit||''),sourceName:String(f.sourceName||f.source?.name||''),sourceUrl:String(f.sourceUrl||f.source?.url||''),excerpt:String(f.excerpt||f.evidence?.excerpt||''),status:f.aiGrounded?'verified':(f.status==='verified'&&!resetVerified?'verified':f.status==='rejected'?'rejected':'pending'),aiGrounded:!!f.aiGrounded})):[];
 const rawScenes=Array.isArray(p.scenes)?p.scenes.filter(s=>s&&typeof s==='object'):[];const rawPoseSet=new Set(rawScenes.map(s=>DEFAULT_STICK_POSES.includes(s?.pose)?s.pose:DEFAULT_STICK_POSES.includes(s?.kind)?s.kind:null).filter(Boolean));const migrateFlatPoses=rawScenes.length>1&&rawPoseSet.size<=1;p.scenes=rawScenes.map((s,i)=>({id:String(s.id||'s'+(i+1)),start:Math.max(0,+s.start||0),duration:Math.max(1,+s.duration||6),kind:migrateFlatPoses?DEFAULT_STICK_POSES[i%DEFAULT_STICK_POSES.length]:(DEFAULT_STICK_POSES.includes(s.pose)?s.pose:(DEFAULT_STICK_POSES.includes(s.kind)?s.kind:DEFAULT_STICK_POSES[i%DEFAULT_STICK_POSES.length])),beat:String(s.beat||''),headline:String(s.headline||s.elements?.find(e=>e.type==='text')?.content||''),subtitle:String(s.subtitle||s.elements?.filter(e=>e.type==='text')?.[1]?.content||''),emotions:cleanEmos(s.emotions),factRefs:Array.isArray(s.factRefs)?s.factRefs.filter(Boolean):[],transitionOut:['cut','fade','wipe','zoom'].includes(s.transitionOut)?s.transitionOut:'cut',sfxCue:['auto','none','whoosh','zoom','funny_slide','impact','riser','ding','sword_swish'].includes(s.sfxCue)?s.sfxCue:'auto',sfxGain:Number.isFinite(+s.sfxGain)?Math.max(0,Math.min(1,+s.sfxGain)):.35,pose:migrateFlatPoses?DEFAULT_STICK_POSES[i%DEFAULT_STICK_POSES.length]:(DEFAULT_STICK_POSES.includes(s.pose)?s.pose:(DEFAULT_STICK_POSES.includes(s.kind)?s.kind:DEFAULT_STICK_POSES[i%DEFAULT_STICK_POSES.length])),narration:String(s.narration||''),vOff:+s.vOff||0,vDur:+s.vDur||0,wtKey:String(s.wtKey||''),wordTimes:Array.isArray(s.wordTimes)?s.wordTimes.filter(x=>Array.isArray(x)&&x.length===2&&x.every(Number.isFinite)):[],imageQuery:String(s.imageQuery||''),images:Array.isArray(s.images)?[s.images[0]&&typeof s.images[0]==='object'?s.images[0]:null,s.images[1]&&typeof s.images[1]==='object'?s.images[1]:null]:[null,null]}));
 p.description=p.description&&typeof p.description==='object'&&!Array.isArray(p.description)?p.description:{};p.description.title=String(p.description.title||p.topic).slice(0,90);p.description.text=String(p.description.text||'');p.description.hashtags=Array.isArray(p.description.hashtags)?p.description.hashtags:String(p.description.hashtags||'').split(/\s+/).filter(Boolean);p.description.sourcesText=String(p.description.sourcesText||'');p.style=p.style&&typeof p.style==='object'&&!Array.isArray(p.style)?p.style:{};p.style.palette=PALETTES[p.style.palette]?p.style.palette:'lavanda';p.style.layoutFamily=LAYOUTS.includes(p.style.layoutFamily)?p.style.layoutFamily:'question';p.hook=p.hook&&typeof p.hook==='object'&&!Array.isArray(p.hook)?p.hook:{text:'',visual:'',endSec:3};p.hook.text=String(p.hook.text||'');p.sourceName=String(p.sourceName||'');p.sourceUrl=String(p.sourceUrl||'');p.sourceExcerpt=String(p.sourceExcerpt||'');p.character=normalizeMascotProfile(p.character||loadMascotProfile());p.tone=EMO_BLOCK[p.tone]?p.tone:'neutral';p.allowedEmotions=cleanEmos(p.allowedEmotions);p.comparison=p.comparison&&typeof p.comparison==='object'&&!Array.isArray(p.comparison)?p.comparison:{leftLabel:'CONCEPTO A',rightLabel:'CONCEPTO B',leftQuery:'concepto A',rightQuery:'concepto B',leftImages:[],rightImages:[]};p.comparison.leftImages=Array.isArray(p.comparison.leftImages)?p.comparison.leftImages:[];p.comparison.rightImages=Array.isArray(p.comparison.rightImages)?p.comparison.rightImages:[];p.fullNarration=String(p.fullNarration||'');p.aiGrounded=!!p.aiGrounded;p.facts=p.facts.map(f=>({...f,aiGrounded:!!f.aiGrounded}));recalculate(p);return p;
}
function recalculate(p=activeProject()) {if(!p)return 0;let n=0;p.scenes.forEach(s=>{s.start=n;n+=Math.max(0,+s.duration||0)});p.durationSec=n;return n;}
function activeProject(){return state.projects.find(p=>p.id===state.activeId)||state.projects[0]||null;}
function touch(){const p=activeProject();if(p){p.updatedAt=new Date().toISOString();recalculate(p);}saveState();updateDashboard();}
function saveState(){try{localStorage.setItem(APP_KEY,JSON.stringify(state));}catch(e){toast('No se pudo guardar: el almacenamiento del navegador está lleno. Exporta una copia JSON.','error');}}
function loadState(){
 let raw=null;
 try{raw=localStorage.getItem(APP_KEY);}catch(e){state.projects=[defaultProject()];state.activeId=state.projects[0].id;return;}
 if(!raw)return;
 let v;
 try{v=JSON.parse(raw);}catch(e){
  // Keep a recoverable copy before the next normal save replaces corrupt state.
  try{const backupKey=APP_KEY+'_recovery_'+new Date().toISOString().slice(0,10);if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,raw);}catch{}
  state.projects=[defaultProject()];state.activeId=state.projects[0].id;
  state.activity=[{time:new Date().toISOString(),message:'El almacenamiento anterior no era JSON válido; se creó un proyecto nuevo y se intentó guardar una copia de recuperación.'}];
  return;
 }
 if(!v||typeof v!=='object'||!Array.isArray(v.projects))return;
 state={...state,...v};
 const rejected=[];
 state.projects=[];
 for(const [i,project] of v.projects.entries()){
  try{state.projects.push(normalizeProject(project,false));}
  catch(e){rejected.push(i+1);}
 }
 state.batch=Array.isArray(v.batch)?v.batch.filter(x=>x&&typeof x==='object'):[];
 state.activity=Array.isArray(v.activity)?v.activity.filter(x=>x&&typeof x==='object').slice(-250):[];
 state.settings=v.settings&&typeof v.settings==='object'?v.settings:{provider:'gemini',models:{}};
 state.settings.models=state.settings.models&&typeof state.settings.models==='object'?state.settings.models:{};
 state.quota=v.quota&&typeof v.quota==='object'?v.quota:{};
 if(!state.projects.length)state.projects=[defaultProject()];
 if(!state.activeId||!state.projects.some(p=>p.id===state.activeId))state.activeId=state.projects[0].id;
 if(rejected.length)state.activity.push({time:new Date().toISOString(),message:`Recuperación: se omitieron proyectos dañados (${rejected.join(', ')}); los demás se conservaron.`});
}
function log(message){state.activity.unshift({at:new Date().toISOString(),message});state.activity=state.activity.slice(0,80);saveState();renderActivity();}
function toast(message,type=''){const box=$('toasts');if(!box)return;const el=document.createElement('div');el.className='toast '+type;el.textContent=message;box.appendChild(el);setTimeout(()=>el.remove(),5000);}
function fmtDate(s){try{return new Intl.DateTimeFormat('es',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(s));}catch{return 'Ahora';}}
function dl(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function dlText(text,name,type='application/json;charset=utf-8'){dl(new Blob([text],{type}),name);}
function fileSlug(s){return String(s||'short').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'short';}
function wordsOK(text,max){return words(text).length<=max;}
function usedFacts(p=activeProject()){const ids=new Set(p.scenes.flatMap(s=>s.factRefs||[]));return p.facts.filter(f=>ids.has(f.id));}
function validateProject(p=activeProject(),forExport=false){
 const errors=[],warnings=[];
 if(!p)return {errors:['No hay proyecto activo.'],warnings:[]};
 const total=recalculate(p);
 if(p.scenes.length<5||p.scenes.length>8)errors.push('El proyecto necesita entre 5 y 8 escenas.');
 if(p.scenes.some(s=>s.duration<3||s.duration>60))errors.push('Cada escena debe durar entre 3 y 60 segundos.');
 if(total<25||total>180)errors.push('La duración total debe estar entre 25 y 180 segundos.');
 if(total>180)warnings.push('El Short supera los 180 segundos permitidos por este editor.');
 if(words(p.hook.text).length>8)errors.push('El gancho tiene más de 8 palabras.');
 if(!p.topic.trim())errors.push('Añade el tema del Short.');
 if(p.facts.length>6)errors.push('El proyecto supera el máximo de 6 datos.');
 for(const s of p.scenes){
  if(words(s.headline)>12||words(s.subtitle)>12)errors.push(`La escena ${s.id} tiene un texto visible de más de 12 palabras.`);
  if((s.headline||s.subtitle)===''&&!s.beat)warnings.push(`La escena ${s.id} aún no tiene textos.`);
  for(const id of s.factRefs||[])if(!p.facts.some(f=>f.id===id))errors.push(`La escena ${s.id} usa un dato inexistente (${id}).`);
  const narration=String(s.narration||'').trim(),n=words(narration).length,rate=n/Math.max(1,+s.duration||1);
  if(forExport&&!(s.images||[]).some(Boolean))warnings.push(`La escena ${s.id} no tiene fotografía o imagen añadida.`);
  if(forExport&&!narration)warnings.push(`La escena ${s.id} no tiene narración asignada.`);
  else if(forExport&&rate>3.4)warnings.push(`La narración de la escena ${s.id} puede ir demasiado rápida (${rate.toFixed(1)} palabras/s).`);
 }
 const used=usedFacts(p);
 if(!used.length)warnings.push('Ninguna escena tiene un dato asociado.');
 const pend=used.filter(f=>f.status!=='verified'&&!f.aiGrounded);
 if(pend.length)warnings.push(`${pend.length} dato(s) usado(s) todavía no están aprobados.`);
 if(forExport&&pend.length)warnings.push('Hay afirmaciones pendientes de revisión; comprueba las fuentes antes de publicar.');
 if(forExport&&!p.sourceUrl&&!p.facts.some(f=>f.sourceUrl))warnings.push('No hay una fuente enlazada en el proyecto; verifica los hechos y añade fuentes en la descripción.');
 if(forExport&&!p.fullNarration.trim())warnings.push('El proyecto no tiene una narración completa. El vídeo podría salir sin voz.');
 return {errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
function longVideoSetStatus(message,kind=''){
 const text=String(message||'');const el=$('longVideoStatus');if(el){el.textContent=text;el.className='long-video-status'+(kind?' '+kind:'');}
 const avatar=$('longVideoAvatar');if(avatar){const lower=text.toLowerCase();let pose='neutral';if(kind==='error'||/fall[oó]|error|no se pudo|cancelad|no se complet/.test(lower))pose='error';else if(kind==='success'||/completad|exportad|voz lista|correctamente|propuestas listas/.test(lower))pose='completed';else if(/analiz|subiendo|generando|preparando|procesando|exportando|cargando/.test(lower))pose='analyze';else if(/espera|selecciona|pendiente|todavía no/.test(lower))pose='waiting';else if(/revisa|propuestas|corte/.test(lower))pose='explain';avatar.src=svgPoseData(pose,loadMascotProfile());avatar.alt=`Avatar: ${pose}`;}
}
function longVideoSetProgress(title,detail='',percent=null){
 const wrap=$('longVideoProgress');if(!wrap)return;wrap.classList.remove('hidden');$('longVideoProgressTitle').textContent=title;$('longVideoProgressText').textContent=detail||'Mantén esta pestaña abierta mientras se procesa.';
 if(percent===null||!Number.isFinite(percent)){ $('longVideoProgressPct').textContent='';$('longVideoProgressBar').style.width='12%';$('longVideoProgressBar').classList.add('indeterminate'); }
 else {$('longVideoProgressPct').textContent=Math.round(Math.max(0,Math.min(1,percent))*100)+'%';$('longVideoProgressBar').style.width=Math.max(0,Math.min(1,percent))*100+'%';$('longVideoProgressBar').classList.remove('indeterminate');}
}
function longVideoClearProgress(){const w=$('longVideoProgress');if(w)w.classList.add('hidden');$('longVideoProgressBar')?.classList.remove('indeterminate');}
function formatLongBytes(n){if(!Number.isFinite(n)||n<0)return'—';const u=['B','KB','MB','GB'];let v=n,i=0;while(v>=1024&&i<u.length-1){v/=1024;i++;}return`${v.toFixed(i?1:0)} ${u[i]}`;}
function parseVideoTimestamp(value){
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value!=='string')return NaN;const s=value.trim();if(!s)return NaN;
 if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);
 const parts=s.split(':').map(Number);if(parts.some(n=>!Number.isFinite(n)||n<0))return NaN;
 if(parts.length===2)return parts[0]*60+parts[1];if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];return NaN;
}
function formatVideoTimestamp(seconds){const s=Math.max(0,Math.floor(Number(seconds)||0));return`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function resetLongVideo(keepFile=false){
 if(longVideoState.objectUrl&&!keepFile)URL.revokeObjectURL(longVideoState.objectUrl);
 if(!keepFile){longVideoState.file=null;longVideoState.objectUrl='';longVideoState.duration=0;longVideoState.width=0;longVideoState.height=0;longVideoState.remoteFile=null;}
 longVideoState.segments=[];longVideoState.voiceBuffers.clear();longVideoState.previewSegmentId=null;
 $('longSegmentSummary').textContent='Todavía no hay segmentos';$('longSegmentList').innerHTML='<div class="empty">Selecciona un video y pulsa “Analizar y proponer cortes”.</div>';
 $('longReanalyze').disabled=!longVideoState.file;$('longAnalyze').disabled=!longVideoState.file||longVideoState.busy;
}
function longVideoChoose(){if(longVideoState.busy){toast('Espera a que termine el procesamiento del video actual.','error');return;}$('longVideoFile').click();}
function loadLongVideoFile(file){
 if(!file)return;const ext=String(file.name||'').split('.').pop().toLowerCase();const knownVideoExt=['mp4','mov','webm','mkv','avi','mpeg','mpg','flv','wmv','3gp'];if(!String(file.type||'').toLowerCase().startsWith('video/')&&!knownVideoExt.includes(ext)){toast('El archivo seleccionado no parece ser un video compatible.','error');return;}
 const cap=800*1024*1024;if(file.size>cap){toast('Este archivo supera el límite móvil de 800 MB. Usa una versión más ligera para reducir fallos de memoria y carga.','error');return;}
 if(longVideoState.remoteFile){const oldRemote=longVideoState.remoteFile,oldKey=apiKeyFor('gemini');if(oldKey)deleteGeminiRemoteVideo(oldRemote,oldKey).catch(()=>{});}
 if(longVideoState.objectUrl)URL.revokeObjectURL(longVideoState.objectUrl);
 longVideoState.file=file;longVideoState.objectUrl=URL.createObjectURL(file);longVideoState.remoteFile=null;longVideoState.duration=0;longVideoState.width=0;longVideoState.height=0;longVideoState.segments=[];longVideoState.voiceBuffers.clear();renderLongSegments();
 const v=$('longVideoPlayer');v.src=longVideoState.objectUrl;v.classList.remove('hidden');$('longDropzone').classList.add('hidden');$('longVideoMeta').classList.remove('hidden');$('longMetaName').textContent=file.name;$('longMetaSize').textContent=formatLongBytes(file.size);$('longMetaDuration').textContent='Leyendo…';$('longMetaResolution').textContent='Leyendo…';$('longVideoBadge').textContent='CARGANDO';$('longVideoBadge').className='tag pending';$('longVideoSubline').textContent='El archivo se mantiene local para previsualización y exportación.';$('longAnalyze').disabled=true;$('longReanalyze').disabled=true;
 const loaded=()=>{v.removeEventListener('loadedmetadata',loaded);if(!Number.isFinite(v.duration)||v.duration<=0){longVideoSetStatus('El navegador no pudo leer la duración del archivo. Prueba a convertirlo a MP4 H.264/AAC.','error');return;}longVideoState.duration=v.duration;longVideoState.width=v.videoWidth;longVideoState.height=v.videoHeight;$('longMetaDuration').textContent=formatVideoTimestamp(v.duration);$('longMetaResolution').textContent=`${v.videoWidth} × ${v.videoHeight}`;$('longVideoBadge').textContent='VIDEO LISTO';$('longVideoBadge').className='tag ready';$('longAnalyze').disabled=false;$('longReanalyze').disabled=false;longVideoSetStatus('Video local listo. El análisis subirá una copia temporal a Gemini; el render se hará desde el archivo de este dispositivo.','success');};
 v.addEventListener('loadedmetadata',loaded,{once:true});v.addEventListener('error',()=>longVideoSetStatus('No se pudo abrir el video en el navegador. Prueba con MP4, H.264/AAC.','error'),{once:true});
}
async function uploadLongVideoToGemini(file,key){
 const ext=String(file.name||'').split('.').pop().toLowerCase();const supported={mp4:'video/mp4',mpeg:'video/mpeg',mpg:'video/mpg',mov:'video/mov',avi:'video/avi',flv:'video/x-flv',webm:'video/webm',wmv:'video/wmv','3gp':'video/3gpp'};const mime=supported[ext]||(file.type==='video/quicktime'?'video/mov':file.type||'video/mp4');if(!Object.values(supported).includes(mime))throw new Error(`Gemini no admite de forma documentada el formato ${ext.toUpperCase()||mime}. Convierte el archivo a MP4 con H.264/AAC y vuelve a seleccionarlo.`);longVideoSetProgress('Iniciando subida segura…','Preparando carga reanudable a Gemini.',0.01);
 const start=await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files',{method:'POST',headers:{'x-goog-api-key':key,'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(file.size),'X-Goog-Upload-Header-Content-Type':mime,'Content-Type':'application/json'},body:JSON.stringify({file:{display_name:file.name.slice(0,200)}})});
 const startText=await start.text();if(!start.ok)throw new Error(`Gemini no pudo iniciar la carga (HTTP ${start.status}). ${startText.slice(0,260)}`);
 const uploadUrl=start.headers.get('x-goog-upload-url');if(!uploadUrl)throw new Error('El navegador no expuso la URL de carga reanudable de Gemini. Prueba desde HTTPS (Netlify) y un Chrome actualizado.');
 longVideoSetProgress('Subiendo video a Gemini…','El progreso indica bytes enviados por el navegador.',0);
 const uploadData=await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();longVideoState.uploadXhr=xhr;xhr.open('POST',uploadUrl,true);const cancel=$('longCancelUpload');if(cancel){cancel.disabled=false;cancel.classList.remove('hidden');}xhr.setRequestHeader('X-Goog-Upload-Offset','0');xhr.setRequestHeader('X-Goog-Upload-Command','upload, finalize');xhr.upload.onprogress=e=>{if(e.lengthComputable)longVideoSetProgress('Subiendo video a Gemini…',`${formatLongBytes(e.loaded)} de ${formatLongBytes(e.total)} enviados.`,e.loaded/e.total);};xhr.onload=()=>{longVideoState.uploadXhr=null;const cancel=$('longCancelUpload');if(cancel){cancel.disabled=true;cancel.classList.add('hidden');}let data;try{data=JSON.parse(xhr.responseText||'{}')}catch{data={}}if(xhr.status>=200&&xhr.status<300)resolve(data.file||data);else reject(new Error(`Falló la subida de video (HTTP ${xhr.status}). ${xhr.responseText.slice(0,260)}`));};xhr.onerror=()=>{longVideoState.uploadXhr=null;const cancel=$('longCancelUpload');if(cancel){cancel.disabled=true;cancel.classList.add('hidden');}reject(new Error('La conexión se interrumpió durante la subida. Vuelve a intentarlo con una conexión estable.'));};xhr.onabort=()=>{longVideoState.uploadXhr=null;const cancel=$('longCancelUpload');if(cancel){cancel.disabled=true;cancel.classList.add('hidden');}reject(new Error('La subida se canceló.'));};xhr.send(file);});
 if(!uploadData?.name)throw new Error('Gemini recibió una respuesta sin identificador de archivo.');
 let info=uploadData;const id=String(info.name).split('/').pop();
 for(let attempt=0;attempt<180;attempt++){
  if(info.state==='ACTIVE'||info.state==='active')break;
  if(info.state==='FAILED'||info.state==='failed')throw new Error('Gemini no pudo procesar el archivo de video. Prueba con MP4 H.264/AAC.');
  longVideoSetProgress('Gemini está preparando el video…','La API está procesando el archivo; el porcentaje exacto no está disponible.',null);
  await new Promise(r=>setTimeout(r,2000));const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(id)}`,{headers:{'x-goog-api-key':key}});const txt=await res.text();if(!res.ok)throw new Error(`No se pudo consultar el archivo de Gemini (HTTP ${res.status}). ${txt.slice(0,180)}`);info=JSON.parse(txt);
 }
 if(info.state!=='ACTIVE'&&info.state!=='active')throw new Error('El procesamiento del archivo está tardando más de lo esperado. Pulsa analizar de nuevo; la app conserva el video local.');
 const result={name:info.name||uploadData.name,uri:info.uri||uploadData.uri,mimeType:info.mimeType||uploadData.mimeType||mime};if(!result.uri)throw new Error('Gemini no devolvió la URI del video. Intenta cargarlo otra vez.');return result;
}
function interactionText(data){
 if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
 const parts=[];for(const step of (data?.steps||[])){for(const item of (step?.content||[])){if(item?.type==='text'&&typeof item.text==='string')parts.push(item.text);else if(typeof item?.text==='string'&&!item.type)parts.push(item.text);}}
 return parts.join('\n').trim();
}
async function createLongVideoInteraction(remote,key,target,mode){
 const narrationLength=target<=30?'45–65':target<=45?'60–90':'80–110';const instruction=`Eres editor documental especializado en Shorts verticales. Analiza el video real que se te ha proporcionado. Propón entre 3 y 8 fragmentos independientes, cada uno con duración objetivo de ${target} segundos (acepta aprox. ${Math.max(15,target-8)}–${Math.min(75,target+8)} s). No dividas el video en intervalos uniformes: busca acciones completas, cambios de proceso, microhistorias, resultados, transformaciones, momentos sorprendentes y explicaciones que se entiendan sin demasiado contexto.\n\nIMPORTANTE SOBRE LOS TIEMPOS: los tiempos deben corresponder al video suministrado y quedar dentro de su duración. No inventes timestamps para rellenar. El comienzo debe quedar un poco antes de la acción importante y el final después de que se entienda su resultado. Evita cortar movimientos, palabras o acciones a la mitad. Los tiempos son propuestas de edición y el usuario los verificará después.\n\nPara cada segmento incluye: start_seconds, end_seconds (números de segundos desde el inicio), title (máximo 80 caracteres), topic, summary, hook (máximo 8 palabras), narration (narración original en español latino, ${narrationLength} palabras según el fragmento, sin afirmar detalles no visibles; texto limpio para leer en voz alta: sin acotaciones, sin marcas de tiempo, sin comillas ni «Narrador:», sin markdown ni listas), why_it_works (por qué funciona como historia), visual_moments (lista de marcas temporales absolutas observables, con purpose corto), and ending_question (pregunta breve o llamada a comentar).\n\nNo uses afirmaciones culturales o técnicas que no puedan verificarse observando el video. Distingue claramente lo que se ve de una inferencia. Devuelve SOLO JSON válido, sin Markdown, con esta estructura: {"segments":[{...}]}. Prioriza diversidad de momentos y no propongas segmentos casi duplicados. Objetivo de duración: ${target}s. Idioma de salida: español.`;
const vpart={file_data:{mime_type:remote.mimeType,file_uri:remote.uri}};if(mode!=='agentic')vpart.video_metadata={fps:0.5};
 const models=[...new Set([getGeminiModel(),'gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash'].filter(Boolean))];let data=null,lastErr='';
 for(const model of models){longVideoSetProgress('Analizando momentos narrativos…',`Modelo ${model}. La duración depende del archivo.`,null);
  const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[vpart,{text:instruction}]}],generationConfig:{responseMimeType:'application/json',temperature:0.4}})});
  const raw=await res.text();let j={};try{j=JSON.parse(raw)}catch{}
  if(res.ok&&j.candidates?.[0]){data=j;break;}
  lastErr=j.error?.message||raw.slice(0,240);if(![400,404,429,500,502,503,504].includes(res.status))throw new Error(`Gemini no pudo analizar el video (HTTP ${res.status}). ${lastErr}`);
  log(`Modelo ${model} no sirvió para video (${res.status}); pruebo otro.`);}
 if(!data)throw new Error('Ningún modelo Gemini pudo analizar el video. '+lastErr);
 const text=(data.candidates[0].content?.parts||[]).map(x=>x.text||'').join('\n').trim();if(!text)throw new Error('Gemini terminó sin devolver texto de segmentos (¿bloqueo de seguridad o video muy largo?). Prueba con un archivo más corto.');
 let obj;try{obj=JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{const first=text.indexOf('{'),last=text.lastIndexOf('}');if(first<0||last<=first)throw new Error('La respuesta de Gemini no contiene un JSON de segmentos válido.');obj=JSON.parse(text.slice(first,last+1));}
 return Array.isArray(obj)?obj:(obj.segments||obj.clips||obj.shorts||[]);
}
async function deleteGeminiRemoteVideo(remote,key){if(!remote?.name)return false;try{const id=String(remote.name).split('/').pop();const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(id)}`,{method:'DELETE',headers:{'x-goog-api-key':key}});return res.ok||res.status===404;}catch{return false;}}
function normalizeLongSegments(rawSegments,duration,target){
 const valid=[];for(const raw of (rawSegments||[]).slice(0,12)){if(!raw||typeof raw!=='object')continue;
  const start=parseVideoTimestamp(raw.start_seconds??raw.start_time??raw.start??raw.startTimestamp),end=parseVideoTimestamp(raw.end_seconds??raw.end_time??raw.end??raw.endTimestamp);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>duration)continue;
  const len=end-start;if(len<12||len>Math.max(78,target+18))continue;
  const title=String(raw.title||raw.topic||'Momento destacado').trim().slice(0,100);const narration=String(raw.narration||raw.voiceover||raw.script||'').trim();
  valid.push({id:uid(),title,startSeconds:Math.round(start*10)/10,endSeconds:Math.round(end*10)/10,topic:String(raw.topic||title).trim().slice(0,180),summary:String(raw.summary||raw.why_it_works||'').trim().slice(0,500),hook:String(raw.hook||title).trim().slice(0,120),narration:narration.slice(0,5000),whyItWorks:String(raw.why_it_works||'').trim().slice(0,500),endingQuestion:String(raw.ending_question||'¿Qué te parece?').trim().slice(0,240),visualMoments:Array.isArray(raw.visual_moments)?raw.visual_moments.slice(0,8).map(x=>({time:parseVideoTimestamp(x.time_seconds??x.timestamp??x.time),purpose:String(x.purpose||x.description||'Momento relevante').slice(0,200)})).filter(x=>Number.isFinite(x.time)&&x.time>=start&&x.time<=end):[],reviewed:false,status:'Pendiente de revisión',voiceStatus:'Sin voz IA',exported:false});
 }
 valid.sort((a,b)=>a.startSeconds-b.startSeconds);const deduped=[];for(const item of valid){const dup=deduped.some(x=>Math.abs(x.startSeconds-item.startSeconds)<5&&Math.abs(x.endSeconds-item.endSeconds)<5);if(!dup)deduped.push(item);}return deduped.slice(0,8);
}
async function analyzeLongVideo(){
 if(longVideoState.busy)return;const file=longVideoState.file;if(!file){toast('Primero selecciona un video.','error');return;}if(!longVideoState.duration){toast('Espera a que se lea la duración del video.','error');return;}
 const key=apiKeyFor('gemini');if(!key){longVideoSetStatus('Para analizar video se requiere tu clave Gemini ya guardada. Abre “IA, claves y cuotas” y conecta Gemini.','error');toast('Conecta Gemini en IA, claves y cuotas.','error');return;}
 if(longVideoState.duration>3*60*60){toast('El video supera el límite de duración de esta versión (3 horas).','error');return;}
 longVideoState.busy=true;$('longAnalyze').disabled=true;$('longReanalyze').disabled=true;$('longChooseVideo').disabled=true;$('longDropChoose').disabled=true;let remote=longVideoState.remoteFile;
 try{
  if(!remote){longVideoSetStatus('El video se enviará a Gemini para análisis visual; no se sube al publicar el Short.');remote=await uploadLongVideoToGemini(file,key);longVideoState.remoteFile=remote;}
  longVideoSetProgress('Creando el análisis…','Solicitando segmentos con tiempos reales del archivo.',null);const target=+$('longTargetDuration').value;const raw=await createLongVideoInteraction(remote,key,target,$('longAnalysisMode').value);const segments=normalizeLongSegments(raw,longVideoState.duration,target);
  if(!segments.length)throw new Error('Gemini no propuso segmentos con tiempos válidos dentro de la duración del video. Intenta de nuevo con análisis adaptativo o revisa el formato.');
  longVideoState.segments=segments;longVideoState.voiceBuffers.clear();renderLongSegments();const deleted=await deleteGeminiRemoteVideo(remote,key);if(deleted)longVideoState.remoteFile=null;
  longVideoSetStatus(`Análisis completado: ${segments.length} cortes propuestos. ${deleted?'Se eliminó la copia temporal de Gemini.':'La eliminación remota no pudo confirmarse; revisa la consola de Gemini si necesitas borrarla manualmente.'} Revisa cada corte antes de exportarlo.`,deleted?'success':'');longVideoSetProgress('Propuestas listas',`${segments.length} fragmentos. Los tiempos aún requieren revisión humana.`,1);log(`Video largo analizado: ${file.name} · ${segments.length} propuestas.`);
 }catch(e){if(remote&&key){const deleted=await deleteGeminiRemoteVideo(remote,key);if(deleted)longVideoState.remoteFile=null;}longVideoSetStatus('No se completó el análisis: '+String(e.message||e).slice(0,400),'error');toast(String(e.message||e).slice(0,180),'error');log('Fallo al analizar video largo: '+String(e.message||e).slice(0,180));}
 finally{longVideoState.busy=false;$('longAnalyze').disabled=!longVideoState.file;$('longReanalyze').disabled=!longVideoState.file;$('longChooseVideo').disabled=false;$('longDropChoose').disabled=false;longVideoClearProgress();}
}
function longSegmentsSentences(text){
 const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return[];
 const sentences=clean.match(/[^.!?…]+(?:[.!?…]+|$)/g)||[clean],out=[];
 for(const sentence of sentences){const tokens=sentence.trim().split(/\s+/).filter(Boolean);let part=[];
  for(let i=0;i<tokens.length;i++){part.push(tokens[i]);const count=part.length,word= tokens[i];
   const natural=/[,;:!?….]$/.test(word),hard=count>=8,soft=count>=5&&natural;
   if(hard||soft){out.push(part.join(' '));part=[];}
  }
  if(part.length){if(out.length&&part.length<=3&&out[out.length-1].split(/\s+/).length+part.length<=8)out[out.length-1]+=' '+part.join(' ');else out.push(part.join(' '));}
 }
 return out;
}
function renderLongSegments(){
 const box=$('longSegmentList');if(!box)return;const segs=longVideoState.segments;
 $('longSegmentSummary').textContent=segs.length?`${segs.length} propuestas · ${segs.filter(s=>s.reviewed&&validLongSegment(s)).length} revisadas · ${segs.filter(s=>s.exported).length} exportadas`:'Todavía no hay segmentos';
 if(!segs.length){box.innerHTML='<div class="empty">No hay cortes válidos. Vuelve a analizar el video.</div>';return;}
 box.innerHTML=segs.map((s,i)=>{
  const valid=validLongSegment(s),duration=Math.max(0,s.endSeconds-s.startSeconds);
  const momentsHtml=s.visualMoments.length?'<b>Momentos detectados:</b> '+s.visualMoments.map(m=>formatVideoTimestamp(m.time)+' '+esc(m.purpose)).join(' · '):'<small>Los momentos enumerados por la IA deben comprobarse mirando el fragmento.</small>';
  const tagClass=s.exported||s.reviewed&&valid?'ready':'pending';
  const tagText=s.exported?'EXPORTADO':s.reviewed&&valid?'REVISADO':'REVISAR';
  const voiceLabel=longVideoState.voiceBuffers.has(s.id)?'♬ Regenerar voz IA':'♬ Generar voz IA';
  const exportLabel=longVideoState.exporting.has(s.id)?'Exportando…':s.exported?'Exportar otra vez':'Exportar Short';
  return `<article class="long-segment-card" data-long-card="${esc(s.id)}">
   <div class="long-segment-head"><span class="long-segment-index">${String(i+1).padStart(2,'0')}</span><div class="long-segment-title"><b>${esc(s.title)}</b><small>${formatVideoTimestamp(s.startSeconds)} → ${formatVideoTimestamp(s.endSeconds)} · ${duration.toFixed(1)} s</small></div><span class="tag ${tagClass}">${tagText}</span></div>
   <div class="fields long-segment-fields"><label class="full">Título<input maxlength="100" data-long-field="title" data-segment-id="${esc(s.id)}" value="${esc(s.title)}"></label><label>Inicio (segundos)<input type="number" min="0" max="${Math.floor(longVideoState.duration)}" step="0.1" data-long-field="startSeconds" data-segment-id="${esc(s.id)}" value="${s.startSeconds.toFixed(1)}"></label><label>Final (segundos)<input type="number" min="0" max="${Math.floor(longVideoState.duration)}" step="0.1" data-long-field="endSeconds" data-segment-id="${esc(s.id)}" value="${s.endSeconds.toFixed(1)}"></label><label class="full">Gancho inicial<input maxlength="120" data-long-field="hook" data-segment-id="${esc(s.id)}" value="${esc(s.hook)}"></label><label class="full">Resumen<textarea rows="2" data-long-field="summary" data-segment-id="${esc(s.id)}">${esc(s.summary)}</textarea></label><label class="full">Narración en español<textarea rows="4" data-long-field="narration" data-segment-id="${esc(s.id)}">${esc(s.narration)}</textarea><small>Genera una pista de voz IA antes de exportar. Los subtítulos quemados se calculan a partir de la duración real de esa pista y se pueden ajustar después.</small></label></div>
   <div class="long-moments">${momentsHtml}</div>
   <label class="long-review"><input type="checkbox" data-long-review="${esc(s.id)}" ${s.reviewed?'checked':''}> He previsualizado y confirmado el inicio, el final y el contexto de este corte.</label>
   <div class="long-segment-actions"><button class="btn small" data-long-preview="${esc(s.id)}">▶ Revisar corte</button><button class="btn small" data-long-voice="${esc(s.id)}">${voiceLabel}</button><button class="btn small" data-long-srt="${esc(s.id)}">↓ Subtítulos SRT</button><button class="btn small primary" data-long-export="${esc(s.id)}" ${!s.reviewed||!valid||!longVideoState.voiceBuffers.has(s.id)||longVideoState.exporting.has(s.id)?'disabled':''}>${exportLabel}</button></div><div class="long-segment-status" id="long-status-${esc(s.id)}">${esc(s.status)} · ${esc(s.voiceStatus)}${!valid?' · Revisa los tiempos (inicio menor que final y dentro del video).':''}</div>
  </article>`;
 }).join('');
}
function validLongSegment(s){return !!s&&Number.isFinite(+s.startSeconds)&&Number.isFinite(+s.endSeconds)&&+s.startSeconds>=0&&+s.endSeconds>+s.startSeconds&&+s.endSeconds<=longVideoState.duration&&(+s.endSeconds-+s.startSeconds)>=12&&(+s.endSeconds-+s.startSeconds)<=90;}
function updateLongSegmentField(id,field,value){const s=longVideoState.segments.find(x=>x.id===id);if(!s)return;if(['startSeconds','endSeconds'].includes(field))s[field]=Number(value);else s[field]=String(value);s.reviewed=false;s.status='Cambios pendientes de revisión';s.exported=false;if(field==='narration'){longVideoState.voiceBuffers.delete(id);s.voiceStatus='Voz por regenerar';}const card=document.querySelector(`[data-long-card="${CSS.escape(id)}"]`);if(card){const badge=card.querySelector('.long-segment-head .tag');if(badge){badge.textContent='REVISAR';badge.className='tag pending';}card.querySelector(`[data-long-review="${CSS.escape(id)}"]`).checked=false;const status=card.querySelector('.long-segment-status');if(status)status.textContent=`${s.status} · ${s.voiceStatus}${validLongSegment(s)?'':' · Revisa los tiempos (inicio menor que final y dentro del video).'}`;const exportBtn=card.querySelector('[data-long-export]');if(exportBtn)exportBtn.disabled=true;const voiceBtn=card.querySelector('[data-long-voice]');if(voiceBtn)voiceBtn.textContent='♬ Generar voz IA';const subtitle=card.querySelector('.long-segment-title small');if(subtitle)subtitle.textContent=`${Number.isFinite(s.startSeconds)?formatVideoTimestamp(s.startSeconds):'??:??:??'} → ${Number.isFinite(s.endSeconds)?formatVideoTimestamp(s.endSeconds):'??:??:??'} · ${validLongSegment(s)?(s.endSeconds-s.startSeconds).toFixed(1)+' s':'tiempos no válidos'}`;}$('longSegmentSummary').textContent=`${longVideoState.segments.length} propuestas · ${longVideoState.segments.filter(x=>x.reviewed&&validLongSegment(x)).length} revisadas · ${longVideoState.segments.filter(x=>x.exported).length} exportadas`;}
async function previewLongSegment(id){const s=longVideoState.segments.find(x=>x.id===id),v=$('longVideoPlayer');if(!s||!v||!validLongSegment(s)){toast('Corrige los tiempos antes de revisar el corte.','error');return;}longVideoState.previewSegmentId=id;v.pause();v.currentTime=s.startSeconds;await new Promise(resolve=>{if(Math.abs(v.currentTime-s.startSeconds)<.05&&v.readyState>=2)return resolve();const done=()=>{v.removeEventListener('seeked',done);resolve();};v.addEventListener('seeked',done,{once:true});setTimeout(done,1200);});longVideoSetStatus(`Previsualizando “${s.title}”: ${formatVideoTimestamp(s.startSeconds)} a ${formatVideoTimestamp(s.endSeconds)}. El reproductor se pausará al llegar al final.`, 'success');v.play().catch(()=>toast('Pulsa reproducir en el reproductor para revisar el corte.'));}
async function generateLongSegmentVoice(id){const s=longVideoState.segments.find(x=>x.id===id);if(!s)return;if(!validLongSegment(s)){toast('Corrige los tiempos antes de preparar la voz.','error');return;}const key=apiKeyFor('gemini');if(!key){toast('Conecta Gemini en IA, claves y cuotas para generar narración.','error');return;}const text=String(s.narration||'').trim();if(words(text).length<12){toast('La narración es demasiado corta. Edita el texto y vuelve a intentarlo.','error');return;}const btn=document.querySelector(`[data-long-voice="${CSS.escape(id)}"]`),old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Generando voz…';}
 try{const {buffer}=await ttsToBuffer(text,key,{style:'Adult male Latin American Spanish voice, medium-low resonant register, unmistakably masculine, emotionally expressive documentary storyteller; suspense before reveals, genuine awe at discoveries, confident emphasis on key facts, subtle humor when suitable, varied pacing and meaningful pauses, clear diction, never monotone or feminine',models:TTS_MODELS,label:'Narración de segmento de video largo'});
  longVideoState.voiceBuffers.set(id,buffer);s.voiceStatus=`Voz lista · ${buffer.duration.toFixed(1)} s`;s.status='Voz preparada';renderLongSegments();toast(`Narración lista para “${s.title}”.`,'success');
 }catch(e){s.voiceStatus='Error de voz: '+String(e.message||e).slice(0,100);renderLongSegments();toast('No se pudo generar la voz: '+String(e.message||e).slice(0,220),'error');}finally{if(btn&&btn.isConnected){btn.disabled=false;btn.textContent=old||'♬ Generar voz IA';}}
}
function longCaptionAt(segment,elapsed,duration){const sentences=longSegmentsSentences(segment.narration);if(!sentences.length||!Number.isFinite(elapsed)||elapsed<0||elapsed>=duration)return'';const totalWords=sentences.reduce((n,x)=>n+words(x).length,0)||1;let cum=0;const target=Math.max(0,Math.min(.999,elapsed/Math.max(.1,duration)))*totalWords;for(const sent of sentences){cum+=words(sent).length;if(target<cum)return sent;}return sentences[sentences.length-1];}
function drawLongVideoFrame(ctx,video,segment,elapsed,totalDuration,voiceDuration,W=720,H=1280){
 ctx.fillStyle='#11131b';ctx.fillRect(0,0,W,H);if(video.videoWidth&&video.videoHeight)drawCover(ctx,video,0,0,W,H,0,1);
 const veil=ctx.createLinearGradient(0,0,0,H);veil.addColorStop(0,'rgba(12,14,25,.62)');veil.addColorStop(.22,'rgba(12,14,25,.03)');veil.addColorStop(.63,'rgba(12,14,25,.02)');veil.addColorStop(1,'rgba(12,14,25,.74)');ctx.fillStyle=veil;ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#365CFF';rounded(ctx,34,36,174,38,19);ctx.fill();ctx.fillStyle='#fff';ctx.font='800 15px Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('FOCOSHORTS STUDIO',121,55);
 ctx.fillStyle='#fff';ctx.textAlign='left';ctx.font='900 36px Arial,sans-serif';wrapCanvas(ctx,segment.title,36,118,650,44,3);
 if(elapsed<3.5){ctx.fillStyle='#FF4F70';rounded(ctx,36,250,648,Math.min(130,52+Math.ceil(String(segment.hook||'').length/32)*42),18);ctx.fill();ctx.fillStyle='#fff';ctx.font='900 31px Arial,sans-serif';wrapCanvas(ctx,segment.hook||segment.title,360,290,588,40,3);}
 const cap=longCaptionAt(segment,elapsed,voiceDuration>0?voiceDuration:totalDuration);
 if(cap){ctx.font='800 30px Arial,sans-serif';const wordsArr=String(cap).split(/\s+/);const lines=[];let line='';for(const word of wordsArr){const next=(line+' '+word).trim();if(ctx.measureText(next).width>610&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);const shown=lines.slice(0,3),boxH=shown.length*39+38,yy=H-170-boxH;ctx.fillStyle='rgba(8,10,18,.78)';rounded(ctx,30,yy,660,boxH,16);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='800 28px Arial,sans-serif';shown.forEach((line,i)=>ctx.fillText(line,W/2,yy+31+i*39));}
 ctx.fillStyle='rgba(255,255,255,.92)';ctx.textAlign='left';ctx.font='700 16px Arial,sans-serif';ctx.fillText(`${formatVideoTimestamp(segment.startSeconds+Math.max(0,elapsed))} / ${formatVideoTimestamp(segment.endSeconds)}`,34,H-35);
 ctx.fillStyle='#FF4F70';rounded(ctx,34,H-22,(W-68)*Math.min(1,Math.max(.01,elapsed/Math.max(1,totalDuration))),5,3);ctx.fill();
}
function exportLongSegmentSRT(id){const s=longVideoState.segments.find(x=>x.id===id);if(!s||!validLongSegment(s)){toast('El corte tiene tiempos inválidos.','error');return;}const buffer=longVideoState.voiceBuffers.get(id),segmentDuration=s.endSeconds-s.startSeconds,rate=buffer?Math.min(1.2,Math.max(.82,buffer.duration/Math.max(1,segmentDuration))):1,dur=buffer?buffer.duration/rate:segmentDuration,sentences=longSegmentsSentences(s.narration);const total=sentences.reduce((n,x)=>n+words(x).length,0)||1;let cursor=0;const lines=[];for(let i=0;i<sentences.length;i++){const part=sentences[i],len=words(part).length;const a=cursor/total*dur,b=(cursor+len)/total*dur;cursor+=len;lines.push(`${i+1}\n${srtTime(a)} --> ${srtTime(Math.max(a+.25,b))}\n${part}`);}dlText(lines.join('\n\n')+'\n',fileSlug(s.title)+'.srt','text/plain;charset=utf-8');toast('Subtítulos descargados. Sus tiempos son estimados y editables.','success');}
async function exportLongSegment(id){
 const s=longVideoState.segments.find(x=>x.id===id);if(!s||!longVideoState.file){toast('No hay video o segmento disponible.','error');return;}if(!validLongSegment(s)){toast('Corrige el inicio y el final de este corte.','error');return;}if(!s.reviewed){toast('Previsualiza y confirma el corte antes de exportar.','error');return;}if(!longVideoState.voiceBuffers.has(id)){toast('Genera primero la voz IA de este segmento. Así la narración y los subtítulos se incorporan al video descargado.','error');return;}if(longVideoState.exporting.has(id))return;
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('Este navegador no permite exportar mediante captura de Canvas. Prueba Chrome actualizado.','error');return;}
 const button=document.querySelector(`[data-long-export="${CSS.escape(id)}"]`);longVideoState.exporting.add(id);if(button){button.disabled=true;button.textContent='Preparando…';}s.status='Preparando exportación';longVideoSetStatus(`Preparando “${s.title}”. Mantén esta pestaña visible hasta que termine.`,'');
 let video=null,canvasStream=null,audioCtx=null,rec=null,rafId=0,done=false;
 const cleanup=()=>{if(rafId)cancelAnimationFrame(rafId);try{video?.pause();}catch{}if(video){video.removeAttribute('src');video.load();video.remove();}canvasStream?.getTracks().forEach(t=>t.stop());if(audioCtx)audioCtx.close().catch(()=>{});longVideoState.exporting.delete(id);longVideoClearProgress();renderLongSegments();};
 try{
  video=document.createElement('video');video.preload='auto';video.playsInline=true;video.crossOrigin='anonymous';video.src=longVideoState.objectUrl;video.style.cssText='position:fixed;left:-2000px;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none';document.body.appendChild(video);
  await new Promise((resolve,reject)=>{if(video.readyState>=1)return resolve();video.onloadedmetadata=resolve;video.onerror=()=>reject(new Error('No se pudo decodificar el video para exportación.'));setTimeout(()=>reject(new Error('El video tardó demasiado en abrirse.')),15000);});
  video.currentTime=s.startSeconds;await new Promise((resolve,reject)=>{if(Math.abs(video.currentTime-s.startSeconds)<.06&&video.readyState>=2)return resolve();const t=setTimeout(()=>reject(new Error('No se pudo posicionar el video en el segundo de inicio.')),10000);video.addEventListener('seeked',()=>{clearTimeout(t);resolve();},{once:true});});
  const W=1080,H=1920,fps=30,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});if(!ctx)throw new Error('No se pudo crear el canvas de exportación.');ctx.scale(1.5,1.5);canvasStream=canvas.captureStream(fps);
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('Este navegador no ofrece AudioContext; no es posible mezclar la narración con el video. Prueba Chrome actualizado.');{audioCtx=new AudioCtx();await audioCtx.resume().catch(()=>{});const dest=audioCtx.createMediaStreamDestination();const source=audioCtx.createMediaElementSource(video),originalGain=audioCtx.createGain(),originalFilter=audioCtx.createBiquadFilter();originalGain.gain.value=longVideoState.voiceBuffers.has(id) ? 0.16 : 0.82;originalFilter.type='lowpass';originalFilter.frequency.value=longVideoState.voiceBuffers.has(id)?4200:18000;source.connect(originalFilter);originalFilter.connect(originalGain);originalGain.connect(dest);const voice=longVideoState.voiceBuffers.get(id);let voiceDuration=0;if(voice){voiceDuration=voice.duration;const src=audioCtx.createBufferSource(),gain=audioCtx.createGain(),comp=audioCtx.createDynamicsCompressor();src.buffer=voice;src.playbackRate.value=Math.min(1.2,Math.max(.82,voice.duration/Math.max(1,s.endSeconds-s.startSeconds)));gain.gain.value=.9;comp.threshold.value=-18;comp.knee.value=16;comp.ratio.value=3;comp.attack.value=.008;comp.release.value=.2;src.connect(gain);gain.connect(comp);comp.connect(dest);src.start(audioCtx.currentTime+.12);await scheduleLongSegmentSfx(audioCtx,dest,audioCtx.currentTime+.12,s.endSeconds-s.startSeconds,s.narration);}const track=dest.stream.getAudioTracks()[0];if(!track)throw new Error('No se pudo crear la pista de audio exportable.');canvasStream.addTrack(track);}
  const preferred=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4'];const mime=preferred.find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error('Este navegador no admite un formato de grabación compatible.');let chunks=[];rec=new MediaRecorder(canvasStream,{mimeType:mime,videoBitsPerSecond:10000000,audioBitsPerSecond:192000});rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
  const total=s.endSeconds-s.startSeconds,voice=longVideoState.voiceBuffers.get(id),voiceRate=voice?Math.min(1.2,Math.max(.82,voice.duration/Math.max(1,total))):1,voiceDuration=voice?voice.duration/voiceRate:0;drawLongVideoFrame(ctx,video,s,0,total,voiceDuration,720,1280);rec.start(1000);await video.play();let lastProgressAt=0;const render=()=>{if(!rec||rec.state!=='recording'||done)return;const elapsed=Math.max(0,video.currentTime-s.startSeconds);drawLongVideoFrame(ctx,video,s,elapsed,total,voiceDuration,720,1280);const now=performance.now();if(now-lastProgressAt>450){longVideoSetProgress('Exportando Short…',`${formatVideoTimestamp(elapsed)} de ${formatVideoTimestamp(total)} · mantén la pestaña abierta.`,elapsed/total);lastProgressAt=now;}if(elapsed>=total-.06||video.ended){done=true;video.pause();drawLongVideoFrame(ctx,video,s,total,total,voiceDuration,720,1280);rec.stop();return;}rafId=requestAnimationFrame(render);};
  const onStop=async()=>{if(done===false)done=true;let blob=new Blob(chunks,{type:rec.mimeType||mime});if(!blob.size){cleanup();toast('La grabación terminó sin datos. Prueba de nuevo manteniendo la pestaña en primer plano.','error');return;}const ext=(rec.mimeType||mime).includes('mp4')?'mp4':'webm';if(ext==='webm'&&window.fixWebmDuration)blob=await window.fixWebmDuration(blob,total*1000);dl(blob,`${fileSlug(s.title)}.${ext}`);s.status=`Exportado ${ext.toUpperCase()}`;s.exported=true;longVideoSetStatus(`“${s.title}” se exportó como ${ext.toUpperCase()}. Reproduce el archivo descargado para verificar video, audio y subtítulos.`,'success');log(`Short exportado desde video largo: ${s.title} · ${ext.toUpperCase()}.`);cleanup();toast(`Segmento exportado como ${ext.toUpperCase()}.`, 'success');};
  rec.onstop=onStop;rec.onerror=()=>{done=true;try{if(rec.state==='recording')rec.stop();}catch{}cleanup();toast('Falló la grabación de este segmento. Puedes volver a intentarlo sin perder las demás propuestas.','error');};rafId=requestAnimationFrame(render);
 }catch(e){done=true;cleanup();s.status='Error de exportación';longVideoSetStatus('No se pudo exportar este segmento: '+String(e.message||e),'error');toast('No se pudo exportar: '+String(e.message||e).slice(0,220),'error');}
}
function attachLongVideoEvents(){
 const fileInput=$('longVideoFile');$('longChooseVideo').addEventListener('click',longVideoChoose);$('longDropChoose').addEventListener('click',longVideoChoose);$('longDropzone').addEventListener('click',e=>{if(e.target.closest('button'))return;longVideoChoose();});fileInput.addEventListener('change',e=>{loadLongVideoFile(e.target.files?.[0]);e.target.value='';});$('longAnalyze').addEventListener('click',analyzeLongVideo);$('longReanalyze').addEventListener('click',analyzeLongVideo);const cancelUpload=$('longCancelUpload');if(cancelUpload)cancelUpload.addEventListener('click',()=>{if(longVideoState.uploadXhr){longVideoSetStatus('Cancelando la subida…');longVideoState.uploadXhr.abort();}});
 longVideoSetStatus($('longVideoStatus').textContent);const video=$('longVideoPlayer');video.addEventListener('timeupdate',()=>{const id=longVideoState.previewSegmentId,s=longVideoState.segments.find(x=>x.id===id);if(s&& !video.paused&&video.currentTime>=s.endSeconds){video.pause();longVideoState.previewSegmentId=null;}});
 $('longSegmentList').addEventListener('input',e=>{const input=e.target.closest('[data-long-field]');if(input)updateLongSegmentField(input.dataset.segmentId,input.dataset.longField,input.value);});$('longSegmentList').addEventListener('change',e=>{const checkbox=e.target.closest('[data-long-review]');if(checkbox){const s=longVideoState.segments.find(x=>x.id===checkbox.dataset.longReview);if(!s)return;s.reviewed=checkbox.checked&&validLongSegment(s);s.status=s.reviewed?'Corte revisado':'Pendiente de revisión';renderLongSegments();return;}const input=e.target.closest('[data-long-field]');if(input){const s=longVideoState.segments.find(x=>x.id===input.dataset.segmentId);if(s){const card=input.closest('[data-long-card]');if(card){const review=card.querySelector('[data-long-review]');if(review)review.checked=false;const exp=card.querySelector('[data-long-export]');if(exp)exp.disabled=true;}}}});
 $('longSegmentList').addEventListener('click',e=>{const preview=e.target.closest('[data-long-preview]'),voice=e.target.closest('[data-long-voice]'),srt=e.target.closest('[data-long-srt]'),exp=e.target.closest('[data-long-export]');if(preview)previewLongSegment(preview.dataset.longPreview);else if(voice)generateLongSegmentVoice(voice.dataset.longVoice);else if(srt)exportLongSegmentSRT(srt.dataset.longSrt);else if(exp)exportLongSegment(exp.dataset.longExport);});
}

function setPage(name){if(name!=='evidence')state.editingBatchId=null;document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id==='page-'+name));document.querySelectorAll('.nav-btn[data-page]').forEach(e=>e.classList.toggle('active',e.dataset.page===name));const titles={dashboard:['TU ESPACIO CREATIVO','Panel principal'],editor:['CREACIÓN Y MONTAJE','Editor de Shorts'],longvideo:['ANÁLISIS Y RECORTE','Video largo → Shorts'],evidence:['CONTROL DE FUENTES','Fuentes y evidencia'],batch:['PRODUCCIÓN ASISTIDA','Producción por lotes'],settings:['INTEGRACIONES LOCALES','IA, claves y cuotas'],history:['TUS ARCHIVOS','Biblioteca e historial']};$('eyebrow').textContent=titles[name]?.[0]||'FOCOSHORTS';$('topTitle').textContent=titles[name]?.[1]||'FocoShorts';$('sidebar').classList.remove('open');$('scrim').classList.remove('visible');if(name==='editor')syncEditor();if(name==='evidence')renderFacts();if(name==='batch')renderBatch();if(name==='settings')syncSettings();if(name==='history')renderHistory();updateDashboard();}
function updateDashboard(){const p=activeProject();if(!p)return;const used=usedFacts(p),pending=p.facts.filter(f=>f.status!=='verified').length;const validation=validateProject(p);$('statProjects').textContent=state.projects.length;$('statPending').textContent=pending;$('statScenes').textContent=p.scenes.length;$('statCalls').textContent=Object.values(state.quota).reduce((a,b)=>a+(b.count||0),0);$('pendingNav').textContent=pending;$('batchNav').textContent=state.batch.filter(b=>b.status!=='done').length;const done=(!validation.errors.length?1:0)+(used.length&&used.every(f=>f.status==='verified')?1:0)+(p.scenes.length>=5&&p.scenes.length<=8?1:0)+(p.topic.trim()?1:0);const percent=Math.round(done/4*100);$('readyPercent').textContent=percent+'%';$('readyBar').style.width=percent+'%';$('readinessText').textContent=validation.errors.length?validation.errors[0]:pending?`${pending} dato(s) pendientes; abre Fuentes y evidencia para revisarlos.`:'Estructura lista. Comprueba la vista previa antes de exportar.';const rp=$('recentProjects');if(rp)rp.innerHTML=state.projects.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,4).map(x=>`<button class="recent-item" data-open-project="${esc(x.id)}"><span class="recent-icon">✦</span><span><b>${esc(x.topic)}</b><small>${esc(fmtDate(x.updatedAt||x.createdAt))} · ${x.scenes.length} escenas</small></span><span class="arrow">↗</span></button>`).join('')||'<div class="empty">Todavía no hay proyectos.</div>';}
function syncEditor(){const p=activeProject();if(!p)return;recalculate(p);$('topic').value=p.topic;$('hook').value=p.hook.text;$('targetDuration').value=String(p.durationSec);if(![30,36,40,45,48,54,60,90,120,150,180].includes(p.durationSec))$('targetDuration').value='45';$('fps').value=String(p.fps);$('language').value=p.language||'es';$('mood').value=p.style.palette||'lavanda';$('descTitle').value=p.description.title||'';$('descText').value=p.description.text||'';$('hashtags').value=(p.description.hashtags||[]).join(' ');document.querySelectorAll('[data-layout]').forEach(b=>b.classList.toggle('selected',b.dataset.layout===p.style.layoutFamily));$('draftTag').textContent=validateProject(p).errors.length?'REVISAR':usedFacts(p).every(f=>f.status==='verified')&&usedFacts(p).length?'LISTO PARA REVISIÓN':'BORRADOR';$('draftTag').className='tag '+(usedFacts(p).length&&usedFacts(p).every(f=>f.status==='verified')?'ready':'pending');$('hookCount').textContent=`${words(p.hook.text).length} de 8 palabras · primeros 3 segundos`;renderSceneList();populateSceneFacts();renderPreview();}
function renderSceneList(){const p=activeProject(),box=$('sceneList');if(!p||!box)return;box.innerHTML=p.scenes.map((s,i)=>`<button class="scene-item ${i===state.selectedScene?'selected':''}" data-scene-index="${i}"><span class="scene-index">${String(i+1).padStart(2,'0')}</span><span class="scene-copy"><b>${esc(s.beat||'Escena sin título')}</b><small>${s.duration}s · ${LAYOUT_LABELS[s.kind]||'Libre'}</small></span><span class="scene-status ${s.factRefs?.some(id=>p.facts.find(f=>f.id===id)?.status==='verified')?'verified':''}">${s.factRefs?.length?'●':'○'}</span></button>`).join('');let i=Math.min(state.selectedScene,p.scenes.length-1);state.selectedScene=i;const s=p.scenes[i];if(!s)return;$('sceneNum').textContent=String(i+1).padStart(2,'0');$('sceneBeat').value=s.beat;$('sceneHeadline').value=s.headline;$('sceneSubtitle').value=s.subtitle;$('sceneNarration').value=s.narration||'';$('sceneDuration').value=s.duration;$('sceneKind').value=s.kind;$('deleteScene').disabled=p.scenes.length<=5;if($('timelineTransition'))$('timelineTransition').value=s.transitionOut||'cut';if($('timelineSfx'))$('timelineSfx').value=s.sfxCue||'auto';if($('timelineSfxGain'))$('timelineSfxGain').value=Math.round((Number.isFinite(+s.sfxGain)?s.sfxGain:.35)*100);if($('timelineSfxValue'))$('timelineSfxValue').textContent=Math.round((Number.isFinite(+s.sfxGain)?s.sfxGain:.35)*100)+'%';renderTimeline();renderSceneImagesEditor();}
function populateSceneFacts(){const p=activeProject(),s=p?.scenes[state.selectedScene];if(!p)return;const select=$('sceneFact');select.innerHTML='<option value="">— Sin dato asociado —</option>'+p.facts.map(f=>`<option value="${esc(f.id)}">${esc(f.claim.slice(0,70))}${f.claim.length>70?'…':''} · ${f.aiGrounded?'Fuente enlazada':f.status==='verified'?'Revisado':'Pendiente'}</option>`).join('');select.value=s?.factRefs?.[0]||'';}
function currentScene(t=state.preview.time){const p=activeProject();if(!p)return {s:null,i:0,local:0};recalculate(p);let i=p.scenes.findIndex((s,j)=>t>=s.start&&(t<s.start+s.duration||j===p.scenes.length-1));if(i<0)i=0;const s=p.scenes[i];return {s,i,local:Math.min(s.duration,Math.max(0,t-s.start))};}
function renderTimeline(){const p=activeProject();if(!p||!$('videoTrack'))return;recalculate(p);const total=Math.max(1,p.durationSec);$('timelineTotal').textContent=timeFmt(total);const ruler=$('timelineRuler');ruler.innerHTML=[0,.25,.5,.75,1].map(n=>`<span>${timeFmt(Math.round(total*n))}</span>`).join('');const video=$('videoTrack'),audio=$('audioTrack');video.innerHTML='';audio.innerHTML='';p.scenes.forEach((sc,i)=>{const width=Math.max(8,sc.duration/total*100);const v=document.createElement('button');v.type='button';v.className='timeline-clip '+(i===state.selectedScene?'active':'');v.style.width=width+'%';v.title=`Escena ${i+1}: ${sc.duration} segundos`;v.innerHTML=`<b>${String(i+1).padStart(2,'0')}</b><span>${esc(sc.beat||sc.headline||'Escena')}</span><small>${sc.duration}s</small>`;v.addEventListener('click',()=>pickScene(i));video.appendChild(v);const a=document.createElement('button');a.type='button';a.className='timeline-clip audio-clip '+(i===state.selectedScene?'active':'');a.style.width=width+'%';a.title=`Audio escena ${i+1}`;const cue=sc.sfxCue||'auto';a.innerHTML=`<b>${cue==='none'?'—':cue==='auto'?'AUTO':cue.toUpperCase()}</b><small>${Math.round((sc.sfxGain??.35)*100)}%</small>`;a.addEventListener('click',()=>pickScene(i));audio.appendChild(a);});}
function updateTimelineScene(){const p=activeProject(),s=p?.scenes[state.selectedScene];if(!s)return;s.transitionOut=$('timelineTransition').value;s.sfxCue=$('timelineSfx').value;s.sfxGain=(+$('timelineSfxGain').value||0)/100;touch();renderTimeline();renderPreview();}
function renderPreview(){const p=activeProject();if(!p)return;const {s,i}=currentScene();if(s)drawFrame($('preview').getContext('2d'),s,state.preview.time-s.start,p,432,768);$('timeCode').textContent=`${timeFmt(state.preview.time)} / ${timeFmt(p.durationSec)}`;$('seek').max=p.durationSec;$('seek').value=Math.min(state.preview.time,p.durationSec);$('prevScene').disabled=i<=0;$('nextScene').disabled=i>=p.scenes.length-1;$('playPreview').textContent=state.preview.playing?'Ⅱ':'▶';$('sceneDots').innerHTML=p.scenes.map((_,n)=>`<button class="scene-dot ${n===i?'active':''}" data-dot-scene="${n}" aria-label="Ir a escena ${n+1}"></button>`).join('');const v=validateProject(p);const readyPhotos=(s?.images||[]).filter(item=>{const im=imageCache.get(item?.url);return !!(im&&im.__loadedImage&&im.naturalWidth>0)}).length;const photoStatus=`Fotos visibles de esta escena: ${readyPhotos}/2`;$('previewStatus').textContent=(v.errors.length?`${v.errors.length} problema(s) de estructura · `:p.aiGrounded?'Fuentes enlazadas · revisa antes de publicar · ':'')+photoStatus+(usedFacts(p).some(f=>f.status!=='verified')?' · Borrador: hay datos pendientes':'');}
function timeFmt(t){t=Math.max(0,Math.floor(+t||0));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
const SUB_Y=1566;
const CTA_LEN=3.9,CTA_LIKE_REMAIN=2.35,CTA_BELL_REMAIN=1.15;
function drawEndCTA(ctx,remain){
 const e=CTA_LEN-remain;if(e<0||remain<0)return;
 const cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),ACC='#ee624b',INK='#171513',FONT='Inter,Arial,sans-serif';
 const likeAt=CTA_LEN-CTA_LIKE_REMAIN,bellAt=CTA_LEN-CTA_BELL_REMAIN,liked=e>=likeAt,belled=e>=bellAt;
 const W=620,H=108,x0=230,y0=1632,cyc=y0+H/2,lx=x0+60,bx=x0+372;
 const pin=cl(e/.4),bk=1.70158,pop=1+(bk+1)*Math.pow(pin-1,3)+bk*Math.pow(pin-1,2);
 ctx.save();
 ctx.globalAlpha=cl(e/.2);ctx.translate(540,cyc+(1-pin)*46);const S=.72+.28*pop;ctx.scale(S,S);ctx.translate(-540,-cyc);
 ctx.shadowColor='rgba(15,15,15,.22)';ctx.shadowBlur=24;ctx.shadowOffsetY=9;ctx.fillStyle='#fff';rounded(ctx,x0,y0,W,H,54);ctx.fill();
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle='rgba(23,21,19,.14)';ctx.lineWidth=2;rounded(ctx,x0,y0,W,H,54);ctx.stroke();
 ctx.fillStyle='rgba(23,21,19,.14)';ctx.fillRect(x0+318,y0+24,2,H-48);
 // --- pulgar ---
 const la=cl((e-likeAt)/.5);
 let ls=e<likeAt?1-.14*cl((e-(likeAt-.25))/.25):.86+.14*easeOut(cl(la*3))+.28*Math.sin(la*Math.PI)*(1-la);
 const lrot=liked?-.3*Math.sin(la*Math.PI)*(1-la):0;
 ctx.save();ctx.translate(lx,cyc);ctx.rotate(lrot);ctx.scale(ls,ls);ctx.translate(-32,-30);
 ctx.strokeStyle=INK;ctx.fillStyle=liked?ACC:'#fff';ctx.lineWidth=5;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(0,28);ctx.lineTo(14,28);ctx.lineTo(25,5);ctx.quadraticCurveTo(30,-2,34,5);ctx.lineTo(32,20);ctx.lineTo(55,20);ctx.quadraticCurveTo(64,20,61,30);ctx.lineTo(55,53);ctx.quadraticCurveTo(53,59,45,59);ctx.lineTo(14,56);ctx.lineTo(0,56);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 if(liked&&la<1){ctx.save();ctx.strokeStyle=ACC;ctx.lineWidth=5;ctx.lineCap='round';ctx.globalAlpha*=1-la;for(let i=0;i<7;i++){const ang=i*Math.PI*2/7-Math.PI/2,r0=44+la*26,r1=r0+16*(1-la);ctx.beginPath();ctx.moveTo(lx+Math.cos(ang)*r0,cyc+Math.sin(ang)*r0);ctx.lineTo(lx+Math.cos(ang)*r1,cyc+Math.sin(ang)*r1);ctx.stroke();}ctx.restore();}
 ctx.fillStyle=liked?ACC:INK;ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='900 31px '+FONT;ctx.fillText(liked?'¡GRACIAS!':'DALE LIKE',x0+106,cyc+2);
 // --- campana ---
 const ba=e-bellAt;
 let bs=e<bellAt?1-.14*cl((e-(bellAt-.25))/.25):.86+.14*easeOut(cl(ba*3))+.18*Math.sin(cl(ba/.5)*Math.PI);
 let brot=belled?.5*Math.exp(-ba*2.4)*Math.sin(ba*21):(liked?.17*Math.sin(e*19)*cl((e-likeAt-.3)/.2):0);
 ctx.save();ctx.translate(bx,cyc);ctx.scale(bs,bs);ctx.translate(0,-24);ctx.rotate(brot);ctx.translate(-30,-3);
 ctx.strokeStyle=INK;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.fillStyle=belled?ACC:'#fff';
 ctx.beginPath();ctx.moveTo(7,39);ctx.quadraticCurveTo(14,31,14,19);ctx.arc(30,19,16,Math.PI,0);ctx.quadraticCurveTo(46,31,53,39);ctx.lineTo(7,39);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(23,46);ctx.quadraticCurveTo(30,54,37,46);ctx.stroke();
 ctx.beginPath();ctx.arc(30,19,3,0,Math.PI*2);ctx.fillStyle=belled?'#fff':ACC;ctx.fill();ctx.restore();
 if(belled&&ba<1){ctx.save();ctx.strokeStyle=ACC;ctx.lineWidth=5;ctx.lineCap='round';for(let k=0;k<2;k++){const q=cl((ba-k*.18)/.7);if(q<=0||q>=1)continue;ctx.globalAlpha=(1-q)*.7;[-1,1].forEach(d=>{ctx.beginPath();ctx.arc(bx,cyc,34+q*34,d>0?-.9:Math.PI-.9+.0,d>0?.9:Math.PI+.9);ctx.stroke();});}ctx.restore();}
 ctx.fillStyle=belled?ACC:INK;ctx.textAlign='left';ctx.font='900 31px '+FONT;ctx.fillText(belled?'¡ACTIVADA!':'CAMPANA',x0+414,cyc+2);
 ctx.restore();
 // --- ondas de clic y cursor (en coordenadas absolutas) ---
 [[likeAt,lx,cyc],[bellAt,bx,cyc]].forEach(([at,cx,cy])=>{const q=(e-at)/.42;if(q>=0&&q<1){ctx.save();ctx.globalAlpha=.65*(1-q);ctx.strokeStyle=ACC;ctx.lineWidth=5;ctx.beginPath();ctx.arc(cx,cy,14+q*70,0,Math.PI*2);ctx.stroke();ctx.restore();}});
 const tx1=lx+8,ty1=cyc+10,tx2=bx+6,ty2=cyc+10,kf=[[.25,x0+W+90,y0+250],[1.25,tx1,ty1],[1.85,tx1,ty1],[2.6,tx2,ty2],[2.95,tx2,ty2],[3.8,x0+W+10,y0+210]];
 if(e>=kf[0][0]){
  let px=kf[kf.length-1][1],py=kf[kf.length-1][2];
  for(let i=0;i<kf.length-1;i++){if(e<=kf[i+1][0]){const q=cl((e-kf[i][0])/(kf[i+1][0]-kf[i][0])),m=q*q*(3-2*q);px=kf[i][1]+(kf[i+1][1]-kf[i][1])*m;py=kf[i][2]+(kf[i+1][2]-kf[i][2])*m;break;}}
  const press=Math.max(0,1-Math.abs(e-likeAt)/.12,1-Math.abs(e-bellAt)/.12),ca=cl((e-.25)/.2)*cl((3.9-e)/.25);
  ctx.save();ctx.globalAlpha=ca;ctx.translate(px,py);ctx.scale(1-.14*press,1-.14*press);ctx.rotate(-.15);ctx.fillStyle='#fff';ctx.strokeStyle=INK;ctx.lineWidth=4;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,47);ctx.lineTo(12,36);ctx.lineTo(22,54);ctx.lineTo(31,49);ctx.lineTo(21,31);ctx.lineTo(38,30);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }
}
function drawFrame(ctx,s,t,p,W=1080,H=1920){
 if(!ctx||!s)return;
 ctx.save();ctx.setTransform(W/1080,0,0,H/1920,0,0);ctx.clearRect(0,0,1080,1920);
 const paper=imageCache.get(PAPER_TEXTURE_URL);
 if(paper&&paper.__loadedImage&&paper.naturalWidth>0)ctx.drawImage(paper,0,0,1080,1920);
 else{ctx.fillStyle='#f5f4f1';ctx.fillRect(0,0,1080,1920);}
 // A subtle white veil preserves the exact crumpled-paper texture while keeping black type crisp.
 ctx.fillStyle='rgba(255,255,255,.10)';ctx.fillRect(0,0,1080,1920);
 ctx.fillStyle='rgba(17,17,17,.78)';ctx.font='900 21px Inter,Arial,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText('EL RINCÓN DE LO DESCONOCIDO',62,68);
 const sceneNo=currentSceneIndex(p,s)+1;
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle='#171513';ctx.font='900 62px Georgia,serif';wrapCanvas(ctx,s.headline||p.topic,540,225,960,68,2);
 if(s.subtitle){ctx.fillStyle='#514c47';ctx.font='600 30px Inter,Arial,sans-serif';wrapCanvas(ctx,s.subtitle,540,322,940,39,2);}
 const legacy=p.comparison||{};
 let photos=(Array.isArray(s.images)?s.images:[]).filter(item=>item&&item.url).slice(0,2);
 if(!photos.length){const old=[...(legacy.leftImages||[]),...(legacy.rightImages||[])].filter(item=>item&&item.url);if(old.length){photos=[old[(sceneNo-1)%old.length],old[(sceneNo)%old.length]].filter(Boolean).slice(0,2);}}
 // One relevant image is better than a forced blank tile: use a wide frame when only one is ready.
 const cards=photos.length===1?[{x:132,y:390,w:816,h:520}]:[{x:54,y:390,w:466,h:520},{x:560,y:390,w:466,h:520}];
 const photoEnter=easeOut(Math.min(1,Math.max(0,t/.42)));
 const photoDrift=(1-photoEnter)*190;
 const photoKick=Math.min(1,Math.max(0,t/.48));
 if(t<.48){ctx.save();ctx.globalAlpha=(1-photoKick)*.20;const sx=540+(Math.sin(t*9)*55);const grad=ctx.createLinearGradient(sx-300,0,sx+300,0);grad.addColorStop(0,'rgba(238,98,75,0)');grad.addColorStop(.5,'rgba(238,98,75,.9)');grad.addColorStop(1,'rgba(238,98,75,0)');ctx.fillStyle=grad;ctx.fillRect(0,360,1080,8);ctx.restore();}
 cards.forEach((box,i)=>{
  const item=photos[i];ctx.save();ctx.shadowColor='rgba(30,24,18,.18)';ctx.shadowBlur=18;ctx.shadowOffsetY=8;ctx.fillStyle='#fff';rounded(ctx,box.x,box.y,box.w,box.h,18);ctx.fill();ctx.restore();
  const cached=item?.url?imageCache.get(item.url):null;const ready=!!(cached&&cached.__loadedImage&&cached.naturalWidth>0);
  if(ready){const sceneProgress=Math.min(1,Math.max(0,t/Math.max(1,s.duration)));const zoom=1.025+sceneProgress*.075+0.008*Math.sin(t*.8+i*.9);ctx.save();ctx.globalAlpha=photoEnter;const side=i===0?-1:1;const slide=side*photoDrift;ctx.translate(slide,0);ctx.rotate(side*(1-photoEnter)*-.025);drawCover(ctx,cached,box.x+5,box.y+5,box.w-10,box.h-10,14,zoom);ctx.restore();}
  else if(item?.url){if(!pendingImageSignals.has(item.url)){pendingImageSignals.add(item.url);loadImage(item.url).then(im=>{pendingImageSignals.delete(item.url);if(im&&activeProject()?.id===p.id)renderPreview();});}drawImagePlaceholder(ctx,box.x+5,box.y+5,box.w-10,box.h-10,i,'FOTO');}
  else drawImagePlaceholder(ctx,box.x+5,box.y+5,box.w-10,box.h-10,i,'FOTO');
  // Small numbered corner marker adds editorial consistency without shrinking the actual photo.
  ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='rgba(20,15,12,.2)';ctx.lineWidth=1;rounded(ctx,box.x+17,box.y+17,54,38,19);ctx.fill();ctx.stroke();ctx.fillStyle='#171513';ctx.font='900 17px Inter,Arial,sans-serif';ctx.textAlign='center';ctx.fillText('0'+(i+1),box.x+44,box.y+36);ctx.restore();
  ctx.save();ctx.strokeStyle='rgba(24,20,16,.16)';ctx.lineWidth=2;rounded(ctx,box.x,box.y,box.w,box.h,18);ctx.stroke();ctx.restore();
 });
 // A much clearer mascot lives below the two large scene-specific photos.
 const pose=DEFAULT_STICK_POSES.includes(s.pose)?s.pose:DEFAULT_STICK_POSES[(sceneNo-1)%DEFAULT_STICK_POSES.length];
 const enter=easeOut(Math.min(1,Math.max(0,t/.45)));const mascotUrl=svgPoseData(pose,p.character);let mascot=imageCache.get(mascotUrl);
 if(!mascot&&!pendingImageSignals.has(mascotUrl)){pendingImageSignals.add(mascotUrl);loadImage(mascotUrl).then(im=>{pendingImageSignals.delete(mascotUrl);if(im&&activeProject()?.id===p.id)renderPreview();});mascot=imageCache.get(mascotUrl);}
 const mi=mascot&&mascot.__loadedImage&&mascot.naturalWidth>0?mascot:null;
 const sch=emotionSchedule(s,p),em=sch.map(x=>x.id),starts=sch.map(x=>x.at),nE=em.length;let ix=0;for(let k=0;k<nE;k++)if(t>=starts[k])ix=k;const lt=t-starts[ix],kp=Math.min(1,lt/.32),c1=1.70158,bo=1+(c1+1)*Math.pow(kp-1,3)+c1*Math.pow(kp-1,2);
 const getE=id=>{const u=emoUrl(id);let im=imageCache.get(u);if(!im&&!pendingImageSignals.has(u)){pendingImageSignals.add(u);loadImage(u).then(()=>{pendingImageSignals.delete(u);renderPreview();});}return im&&im.__loadedImage&&im.naturalWidth>0?im:null;};
 const drawE=(im,alpha,scl,rot)=>{if(!im)return;const r=im.naturalWidth/im.naturalHeight,H=Math.min(545,760/r),W=H*r;ctx.save();ctx.globalAlpha=alpha*Math.min(1,enter*1.6);ctx.translate(540,1478+(1-enter)*120);ctx.rotate(rot);ctx.scale(scl,scl);ctx.drawImage(im,-W/2,-H,W,H);ctx.restore();};
 ctx.save();ctx.globalAlpha=Math.min(1,enter*1.5)*.9;ctx.fillStyle='rgba(30,24,18,.15)';ctx.beginPath();ctx.ellipse(540,1483,150,18,0,0,Math.PI*2);ctx.fill();ctx.restore();
 if(ix>0&&lt<.10)drawE(getE(em[ix-1]),1-lt/.10,1,0);
 drawE(getE(em[ix]),1,.94,0);
 {const sw=sceneWords(s);if(sw.ws.length){const chs=sceneChunks(s,sw);let ci=-1;for(let k=0;k<chs.length;k++)if(t>=sw.times[chs[k][0]][0]+SUB_DELAY)ci=k;
  if(ci>=0){const ids=chs[ci],t0=sw.times[ids[0]][0]+SUB_DELAY,lastEnd=sw.times[ids[ids.length-1]][1];
   if(ci<chs.length-1||t<lastEnd+.7){
    const age=t-t0,x0=Math.min(1,age/.14),sc=.86+.14*(1+2.70158*Math.pow(x0-1,3)+1.70158*Math.pow(x0-1,2)),alpha=Math.min(1,age/.07);let act=ids[0];ids.forEach(i=>{if(t>=sw.times[i][0]+SUB_DELAY)act=i;});
    const txt=ids.map(i=>sw.ws[i].toUpperCase().replace(/[,;:.…]+$/,'')),y=SUB_Y;let fs=78;ctx.save();ctx.textBaseline='middle';ctx.textAlign='left';ctx.lineJoin='round';
    const meas=()=>{ctx.font='900 '+fs+'px Inter,Arial,sans-serif';return txt.map(w=>ctx.measureText(w).width);};let ws2=meas();const spc=()=>ctx.measureText(' ').width;let tot=ws2.reduce((a,b)=>a+b,0)+spc()*(txt.length-1);if(tot>940){fs=Math.floor(fs*940/tot);ws2=meas();tot=ws2.reduce((a,b)=>a+b,0)+spc()*(txt.length-1);}
    ctx.globalAlpha=alpha;ctx.translate(540,y);ctx.scale(sc,sc);let x=-tot/2;const sp=spc();
    txt.forEach((w,wi)=>{const gi=ids[wi],on=gi===act,pulse=on?1+.1*Math.max(0,1-(t-sw.times[gi][0])/.16):1;ctx.save();ctx.translate(x+ws2[wi]/2,0);ctx.scale(pulse,pulse);ctx.textAlign='center';ctx.lineWidth=Math.max(10,fs*.2);ctx.strokeStyle='rgba(255,255,255,.97)';ctx.strokeText(w,0,0);ctx.fillStyle=on?'#ee624b':'#171513';ctx.fillText(w,0,0);ctx.restore();x+=ws2[wi]+sp;});
    ctx.restore();}}}}
  // Cierre: «Dale like» + «Campana» con cursor, clics sincronizados con el sonido, rebote del pulgar y campana que suena.
 const remain=(+s.duration||0)-t;
 if(sceneNo===p.scenes.length&&remain>=0&&remain<CTA_LEN)drawEndCTA(ctx,remain);
 // A short visual exit accent on selected cuts. It is brief and never covers the narration for long.
 const tr=String(s.transitionOut||'cut'),outStart=Math.max(0,(+s.duration||0)-.22),outP=Math.max(0,Math.min(1,(t-outStart)/.22));
 if(outP>0&&tr!=='cut'&&sceneNo<p.scenes.length){
  ctx.save();
  if(tr==='wipe'){
   const w=1080*easeOut(outP);ctx.fillStyle='#ee624b';ctx.globalAlpha=.88;ctx.fillRect(1080-w,0,w,1920);
  }else if(tr==='zoom'){
   ctx.globalAlpha=.12*(1-outP);ctx.fillStyle='#171513';ctx.fillRect(0,0,1080,1920);
   ctx.globalAlpha=.48*(1-outP);ctx.strokeStyle='#ee624b';ctx.lineWidth=20+outP*30;ctx.strokeRect(20+outP*45,20+outP*45,1040-outP*90,1880-outP*90);
  }else if(tr==='fade'){
   ctx.globalAlpha=.26*outP;ctx.fillStyle='#f5f4f1';ctx.fillRect(0,0,1080,1920);
  }
  ctx.restore();
 }
 ctx.restore();
}
function drawImagePlaceholder(ctx,x,y,w,h,i,tag){ctx.save();const cols=['#ded9d1','#ece5dd','#d9ddd7'];ctx.fillStyle=cols[i%cols.length];rounded(ctx,x,y,w,h,12);ctx.fill();ctx.strokeStyle='#c7c0b7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+24,y+h-25);ctx.lineTo(x+w*.38,y+h*.46);ctx.lineTo(x+w*.56,y+h*.65);ctx.lineTo(x+w*.76,y+h*.3);ctx.lineTo(x+w-20,y+h-25);ctx.stroke();ctx.fillStyle='#aaa196';ctx.beginPath();ctx.arc(x+w*.76,y+h*.24,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#777';ctx.font='600 14px Inter,Arial,sans-serif';ctx.textAlign='center';ctx.fillText(tag+' · FOTO FALTANTE: EDITA LA ESCENA',x+w/2,y+h-12);ctx.restore();}
function drawCover(ctx,img,x,y,w,h,r=0,zoom=1){if(!img)return;const sourceW=Number(img.videoWidth||img.naturalWidth||img.width||0),sourceH=Number(img.videoHeight||img.naturalHeight||img.height||0);if(!(sourceW>0&&sourceH>0))return;ctx.save();rounded(ctx,x,y,w,h,r);ctx.clip();const scale=Math.max(w/sourceW,h/sourceH)*Math.max(1,zoom),sw=w/scale,sh=h/scale,sx=(sourceW-sw)/2,sy=(sourceH-sh)/2;ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);ctx.restore();}
function drawStickFallback(ctx,pose){
 const poses={
  question:{arms:[[250,166],[173,219],[214,269],[250,166],[327,219],[286,269]],legs:[[[250,314],[250,421],[295,465],[247,548]],[[250,314],[250,421],[208,470],[207,548]]],mouth:'smile'},
  think:{arms:[[250,166],[180,218],[213,266],[250,166],[302,202],[284,132]],legs:[[[250,314],[250,426],[203,467],[210,548]],[[250,314],[250,421],[300,456],[339,548]]],mouth:'small'},
  explain:{arms:[[250,166],[176,219],[213,267],[250,166],[326,180],[405,160]],legs:[[[250,314],[250,425],[203,467],[210,548]],[[250,314],[250,421],[304,465],[350,548]]],mouth:'smile'},
  point:{arms:[[250,166],[174,220],[213,267],[250,166],[306,129],[395,73]],legs:[[[250,314],[250,421],[298,466],[247,548]],[[250,314],[250,421],[208,470],[207,548]]],mouth:'smile'},
  confident:{arms:[[250,166],[167,214],[213,267],[250,166],[333,214],[287,267]],legs:[[[250,314],[250,423],[208,471],[219,548]],[[250,314],[250,423],[298,470],[284,548]]],mouth:'smile'},
  celebrate:{arms:[[250,166],[206,103],[145,45],[250,166],[294,103],[355,45]],legs:[[[250,314],[213,410],[159,455],[130,529]],[[250,314],[295,409],[344,450],[385,519]]],mouth:'open'},
  curious:{arms:[[250,166],[169,192],[104,174],[250,166],[329,208],[393,229]],legs:[[[250,314],[250,421],[298,465],[248,548]],[[250,314],[250,421],[207,470],[207,548]]],mouth:'open'},
  worried:{arms:[[250,166],[187,221],[229,248],[250,166],[313,221],[271,248]],legs:[[[250,314],[250,421],[214,466],[221,548]],[[250,314],[250,421],[291,466],[284,548]]],mouth:'frown'}
 };
 const z=poses[pose]||poses.question;
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#111';ctx.fillStyle='#fff';ctx.lineWidth=8;
 // Clean, thin, hand-drawn stick body: no cape, coat, or filled torso.
 ctx.beginPath();ctx.moveTo(250,153);ctx.lineTo(250,314);ctx.stroke();
 const line=pts=>{if(!pts?.length)return;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(const pt of pts.slice(1))ctx.lineTo(pt[0],pt[1]);ctx.stroke();};
 line(z.arms.slice(0,3));line(z.arms.slice(3,6));z.legs.forEach(line);
 // Two small loose hand loops echo the supplied doodle.
 ctx.beginPath();ctx.ellipse(224,304,15,10,-.2,0,Math.PI*2);ctx.ellipse(276,304,15,10,.2,0,Math.PI*2);ctx.stroke();
 // Shoes align with each pose's actual foot positions.
 const shoeAnchors={question:[[200,548],[270,548]],think:[[200,548],[339,548]],explain:[[200,548],[350,548]],point:[[247,548],[207,548]],confident:[[219,548],[284,548]],celebrate:[[130,529],[385,519]],curious:[[250,548],[190,548]],worried:[[221,548],[284,548]]};
 ctx.beginPath();(shoeAnchors[pose]||shoeAnchors.question).forEach(([x,y])=>{ctx.moveTo(x-24,y);ctx.quadraticCurveTo(x-3,y-13,x+17,y);ctx.lineTo(x+23,y+7);ctx.lineTo(x-27,y+7);ctx.closePath();});ctx.stroke();
 // Round head and three small loose hair strokes, matching the reference doodle.
 ctx.beginPath();ctx.arc(250,91,69,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(187,97);ctx.quadraticCurveTo(174,81,187,61);ctx.moveTo(199,52);ctx.quadraticCurveTo(205,31,224,35);ctx.moveTo(233,30);ctx.quadraticCurveTo(247,13,262,30);ctx.moveTo(273,31);ctx.quadraticCurveTo(289,12,306,39);ctx.stroke();
 // Facial expressions vary with the pose.
 ctx.fillStyle='#111';ctx.beginPath();
 if(pose==='curious'){ctx.ellipse(220,99,7,12,0,0,Math.PI*2);ctx.ellipse(278,99,9,13,0,0,Math.PI*2);ctx.fill();}
 else {ctx.fillRect(216,82,7,20);if(pose==='think'){ctx.ellipse(279,99,5,8,0,0,Math.PI*2);ctx.fill();}else ctx.fillRect(273,82,7,20);}
 ctx.strokeStyle='#111';ctx.lineWidth=7;ctx.beginPath();
 if(z.mouth==='frown'){ctx.moveTo(224,139);ctx.quadraticCurveTo(250,118,276,139);}
 else if(z.mouth==='small'){ctx.moveTo(230,130);ctx.quadraticCurveTo(250,121,271,130);}
 else if(z.mouth==='open'){ctx.ellipse(250,130,12,16,0,0,Math.PI*2);}
 else {ctx.moveTo(207,124);ctx.quadraticCurveTo(250,160,293,124);}
 ctx.stroke();
 if(pose==='celebrate'||pose==='confident'){ctx.strokeStyle=normalizeMascotProfile(loadMascotProfile()).accentColor;ctx.lineWidth=5;for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(250+Math.cos(a)*90,91+Math.sin(a)*90);ctx.lineTo(250+Math.cos(a)*108,91+Math.sin(a)*108);ctx.stroke();}}
 ctx.restore();
}
function currentSceneIndex(p,s){return p.scenes.findIndex(x=>x.id===s.id);}
function easeOut(x){return 1-Math.pow(1-x,3);}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):(ctx.moveTo(x+r,y),ctx.arcTo(x+w,y,x+w,y+h,r),ctx.arcTo(x+w,y+h,x,y+h,r),ctx.arcTo(x,y+h,x,y,r),ctx.arcTo(x,y,x+w,y,r));ctx.closePath();}
function wrapCanvas(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){const ws=words(text);let lines=[],line='';for(const w of ws){const n=line?line+' '+w:w;if(ctx.measureText(n).width>maxWidth&&line){lines.push(line);line=w;}else line=n;}if(line)lines.push(line);if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(ctx.measureText(last+'…').width>maxWidth&&last.length>2)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}const start=y-(lines.length-1)*lineHeight/2;lines.forEach((l,i)=>ctx.fillText(l,x,start+i*lineHeight));}
function pickScene(i){const p=activeProject();if(!p||!p.scenes[i])return;state.selectedScene=i;state.preview.time=p.scenes[i].start;state.preview.playing=false;cancelAnimationFrame(raf);renderSceneList();populateSceneFacts();renderPreview();}
function saveSceneFields(event){const p=activeProject(),s=p?.scenes[state.selectedScene];if(!s)return;s.beat=$('sceneBeat').value;s.headline=$('sceneHeadline').value;s.subtitle=$('sceneSubtitle').value;const oldNar=s.narration;s.narration=$('sceneNarration').value.trim();if(oldNar!==s.narration&&s.vDur&&!p.voiceStale){p.voiceStale=true;toast('Cambiaste el texto hablado: pulsa «Regenerar voz IA» para que la voz y los subtítulos coincidan.','error');}const d=Math.round(+$('sceneDuration').value);if(!s.vDur&&d>=3&&d<=60)s.duration=d;s.kind=$('sceneKind').value;s.pose=$('sceneKind').value;const f=$('sceneFact').value;s.factRefs=f?[f]:[];p.fullNarration=p.scenes.map(sc=>sc.narration||sc.subtitle||sc.headline).join(' ');recalculate(p);touch();renderTimeline();const title=document.querySelector(`[data-scene-index="${state.selectedScene}"] .scene-copy b`);if(title)title.textContent=s.beat||'Escena sin título';const meta=document.querySelector(`[data-scene-index="${state.selectedScene}"] .scene-copy small`);if(meta)meta.textContent=`${s.duration}s · ${LAYOUT_LABELS[s.kind]||'Libre'}`;if(event?.type==='change'){renderSceneList();populateSceneFacts();}renderSceneImagesEditor();renderPreview();}
function applyDurationTarget(){const p=activeProject();if(!p)return;if(p.scenes.some(s=>s.vDur)){toast('La duración la fija la voz de cada escena. Edita la narración y pulsa «Regenerar voz IA» para cambiarla.','error');$('targetDuration').value=String(Math.round(p.durationSec));return;}const target=+$('targetDuration').value;const n=p.scenes.length;if(target<n*3||target>n*60){toast('Esta duración no se puede repartir entre las escenas actuales (3–60 s por escena). Añade o elimina escenas.','error');$('targetDuration').value=String(p.durationSec);return;}let remain=target;for(let i=0;i<n;i++){const d=Math.max(3,Math.min(60,Math.round(remain/(n-i))));p.scenes[i].duration=d;remain-=d;}if(remain!==0)p.scenes[n-1].duration+=remain;recalculate(p);touch();syncEditor();toast(`Duración ajustada a ${p.durationSec} segundos.`,'success');}
function syncSceneDurationsToVoice(p,voiceDuration){
 const scenes=p.scenes||[],n=scenes.length;if(!n||!Number.isFinite(voiceDuration)||voiceDuration<=0)return;
 // Ajusta la duración visual al audio real y distribuye segundos según el texto de cada escena.
 const targets=[36,40,45,48,54,60,90,120,150,180];const target=targets.find(value=>value>=voiceDuration+.8)||Math.min(180,Math.ceil((voiceDuration+.8)/10)*10);
 const weights=scenes.map(s=>Math.max(1,words(s.narration||s.subtitle||s.headline).length));
 const total=weights.reduce((a,b)=>a+b,0)||n,ideal=weights.map(w=>target*w/total);
 const durations=ideal.map(v=>Math.max(3,Math.min(60,Math.floor(v))));
 let sum=durations.reduce((a,b)=>a+b,0);
 while(sum<target){let best=-1,score=-Infinity;for(let i=0;i<n;i++)if(durations[i]<60&&ideal[i]-durations[i]>score){score=ideal[i]-durations[i];best=i;}if(best<0)break;durations[best]++;sum++;}
 while(sum>target){let best=-1,score=-Infinity;for(let i=0;i<n;i++)if(durations[i]>6&&durations[i]-ideal[i]>score){score=durations[i]-ideal[i];best=i;}if(best<0)break;durations[best]--;sum--;}
 scenes.forEach((s,i)=>s.duration=durations[i]);recalculate(p);
}
function browserVoiceAvailable(){return 'speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;}
function speakProjectInBrowser(p=activeProject()){
 if(!p||!browserVoiceAvailable()){toast('Este navegador no ofrece voces de sistema.','error');return false;}
 const transcript=String(p.scenes.map(s=>s.narration||s.subtitle||s.headline).join('. ')).trim();if(!transcript){toast('Este proyecto no tiene narración.','error');return false;}
 window.speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(transcript);utter.lang='es-ES';utter.rate=1.02;utter.pitch=1.0;const voices=window.speechSynthesis.getVoices();const spanish=voices.filter(v=>/^es(-|_)/i.test(v.lang));const preferred=spanish.find(v=>/male|mascul|jorge|diego|pablo|enrique|andres|andrés|microsoft raul|raul|google español/i.test(v.name))||spanish.find(v=>/microsoft|google|natural/i.test(v.name))||spanish[0];if(preferred)utter.voice=preferred;utter.pitch=.82;utter.onstart=()=>toast('Reproduciendo con la voz del navegador. Esta voz del sistema sirve para escuchar el guion; la exportación necesita audio capturable.','success');window.speechSynthesis.speak(utter);return true;
}
// <<VOICE-TIMELINE
// ---------- Una sola voz continua para todo el Short ----------
// El TTS lee en voz alta TODO lo que recibe: aquí solo se le manda la narración limpia.
function cleanNarrationForTTS(t){
 return String(t||'')
  .replace(/https?:\/\/\S+/g,' ')
  .replace(/\[[^\]]*\]/g,' ')
  .replace(/\((?:pausa|música|musica|risas?|sfx|efecto|voz|tono|susurr|énfasis|enfasis|suspiro|silencio|dramátic|dramatic|narrador)[^)]*\)/gi,' ')
  .replace(/^\s*(?:narrador|narradora|voz(?: en off)?|locutor|locutora|speaker|narration|narración)\s*[:\-–]\s*/gim,'')
  .replace(/^\s*(?:[-*•>#]+|\d+[.)])\s+/gm,'')
  .replace(/[*_`~#>|]+/g,'')
  .replace(/["“”«»„‟]/g,'')
  .replace(/\s+/g,' ').trim();
}
function spokenText(s){return cleanNarrationForTTS(s&&(s.narration||s.subtitle||s.headline));}
const TTS_MODELS=['gemini-2.5-flash-preview-tts','gemini-2.5-pro-preview-tts'];
const TTS_STYLE='Adult male voice, masculine Latin American Spanish narrator, medium-low register, warm resonant chest voice, unmistakably male, natural conversational storytelling, emotionally expressive performance, not robotic and not monotone. Deliver each sentence according to its meaning: genuine awe and wonder for discoveries, suspense and a slightly quieter pace before reveals, confident emphasis on surprising facts, warmth and subtle humor where appropriate, serious restraint for sensitive topics, meaningful pauses, varied rhythm and intonation. Clear diction, documentary-quality delivery. Never sound like a female narrator.';
const sleepMs=ms=>new Promise(r=>setTimeout(r,ms));
function getTTSContext(){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw new Error('Este navegador no ofrece AudioContext.');let c=window.__focoPreparedAudioContext;if(!c||c.state==='closed'){c=new A();window.__focoPreparedAudioContext=c;}return c;}
function pcm16ToWav(pcm,sampleRate=24000,channels=1){
 const header=new ArrayBuffer(44),v=new DataView(header),bytes=new Uint8Array(pcm.length);bytes.set(pcm);
 const put=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));};
 put(0,'RIFF');v.setUint32(4,36+bytes.length,true);put(8,'WAVE');put(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);put(36,'data');v.setUint32(40,bytes.length,true);
 const wav=new Uint8Array(44+bytes.length);wav.set(new Uint8Array(header));wav.set(bytes,44);return wav.buffer;
}
// Gemini TTS compatible API: style is normal prompt text, never unsupported speech_metadata annotations.
async function ttsToBuffer(text,key,{style=TTS_STYLE,models=TTS_MODELS,label='Narración TTS'}={}){
 text=cleanNarrationForTTS(text);if(!text)throw new Error('No hay texto para la voz.');
 const ctx=getTTSContext();await ctx.resume().catch(()=>{});let last='';
 for(const model of models){
  for(let attempt=0;attempt<3;attempt++){
   try{
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:`Follow these voice direction instructions while speaking the exact narration below in Spanish. Do not read the instructions aloud. Voice direction: ${style}\n\nNarration:\n${text}`}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Charon'}}}}})});
    captureRateHeaders(res,'gemini');const data=await res.json().catch(()=>({}));
    if(!res.ok){last=data.error?.message||`Gemini TTS HTTP ${res.status}`;if([408,429,500,502,503,504].includes(res.status)||/high demand|temporar|overload|unavailable/i.test(last)){if(attempt<2){await sleepMs(res.status===429?2500*(attempt+1):1200*(attempt+1));continue;}}break;}
    const parts=(data.candidates||[]).flatMap(c=>c.content?.parts||[]);
    const audio=parts.find(p=>p.inlineData?.data||p.inline_data?.data);
    if(!audio){last=data.promptFeedback?.blockReason?`Gemini bloqueó la solicitud: ${data.promptFeedback.blockReason}`:`La respuesta de ${model} no contiene audio. ${data.candidates?.[0]?.finishReason||''}`;break;}
    const inline=audio.inlineData||audio.inline_data,bin=atob(inline.data),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const mime=String(inline.mimeType||inline.mime_type||'audio/L16;rate=24000');let audioBytes=bytes.buffer;
    if(/audio\/l16|pcm/i.test(mime)&&!/wav/i.test(mime)){const rate=Number((mime.match(/rate\s*=\s*(\d+)/i)||[])[1]||24000);audioBytes=pcm16ToWav(bytes,rate,1);}
    const buffer=await ctx.decodeAudioData(audioBytes.slice(0));if(!buffer.length||!buffer.duration)throw new Error('La pista de voz generada está vacía.');
    noteCall('gemini',label+' con '+model);return {buffer,model};
   }catch(e){last=String(e.message||e);if(/failed to fetch|networkerror|load failed/i.test(last)&&attempt<2){await sleepMs(1200*(attempt+1));continue;}break;}
  }
 }
 throw new Error(last||'No fue posible generar una pista de voz con los modelos TTS disponibles.');
}
// Master de voz: reduce las bajadas locales de volumen sin subir las pausas ni aplastar la dinámica.
// Usa control automático suave por ventanas, normalización de pico y un limitador suave anticlipping.
function masterNarrationBuffer(buf){
 const sr=buf.sampleRate,ch=buf.numberOfChannels,len=buf.length,win=Math.max(1,Math.round(sr*.04));
 const input=Array.from({length:ch},(_,c)=>buf.getChannelData(c));
 let peak=0,total=0,count=0;
 for(let c=0;c<ch;c++){const d=input[c];for(let i=0;i<len;i++){const a=Math.abs(d[i]);if(a>peak)peak=a;total+=d[i]*d[i];count++;}}
 if(!peak)return buf;
 const frames=Math.ceil(len/win),rms=new Float32Array(frames);let activeRms=[];
 for(let f=0;f<frames;f++){
  const a=f*win,b=Math.min(len,a+win);let sum=0,n=0;
  for(let c=0;c<ch;c++){const d=input[c];for(let i=a;i<b;i++){sum+=d[i]*d[i];n++;}}
  rms[f]=Math.sqrt(sum/Math.max(1,n));
  if(rms[f]>Math.max(.0025,peak*.012))activeRms.push(rms[f]);
 }
 if(!activeRms.length)return buf;
 activeRms.sort((a,b)=>a-b);const median=activeRms[Math.floor(activeRms.length*.5)]||Math.sqrt(total/Math.max(1,count));
 const target=Math.max(.105,Math.min(.18,median*1.12)),threshold=Math.max(.0025,peak*.012);
 const gains=new Float32Array(frames);let current=1,processedPeak=0;
 for(let f=0;f<frames;f++){
  const r=rms[f];let desired=r>threshold?Math.max(.62,Math.min(2.0,target/Math.max(.012,r))):1;
  const alpha=desired<current?.42:(r<=threshold?.62:.17);
  current+= (desired-current)*alpha;gains[f]=current;
  const a=f*win,b=Math.min(len,a+win);
  for(let c=0;c<ch;c++){const d=input[c];for(let i=a;i<b;i++){const v=d[i]*current;if(Math.abs(v)>processedPeak)processedPeak=Math.abs(v);}}
 }
 if(processedPeak<1e-6)return buf;
 const finalGain=Math.min(3,.84/processedPeak),out=new AudioBuffer({length:len,numberOfChannels:ch,sampleRate:sr});
 for(let c=0;c<ch;c++){
  const src=input[c],dst=out.getChannelData(c);
  for(let i=0;i<len;i++){
   const v=src[i]*gains[Math.min(frames-1,Math.floor(i/win))]*finalGain,a=Math.abs(v);
   dst[i]=a<=.88?v:Math.sign(v)*(.88+.10*Math.tanh((a-.88)/.10));
  }
 }
 return out;
}
// Recorta silencios reales con un umbral conservador: no corta palabras pronunciadas más bajo.
function analyzeVoiceClip(buf){
 const sr=buf.sampleRate,ch=buf.numberOfChannels,win=Math.max(1,Math.round(sr*.01)),nw=Math.floor(buf.length/win);
 const chans=[];for(let c=0;c<ch;c++)chans.push(buf.getChannelData(c));
 const env=new Float32Array(nw);let peak=0;
 for(let w=0;w<nw;w++){let sum=0;for(let c=0;c<ch;c++){const d=chans[c];for(let i=w*win,e=i+win;i<e;i++)sum+=d[i]*d[i];}env[w]=Math.sqrt(sum/(win*ch));if(env[w]>peak)peak=env[w];}
 const thr=Math.max(.0028,peak*.018);let a=0;while(a<nw&&env[a]<thr)a++;let b=nw-1;while(b>a&&env[b]<thr)b--;
 if(a>=b)return {buffer:buf,start:0,end:buf.duration,spans:[[0,buf.duration]]};
 const spans=[];let s0=a,gap=0,last=a;
 for(let w=a;w<=b;w++){if(env[w]>=thr){if(gap>=11){spans.push([s0,last+1]);s0=w;}last=w;gap=0;}else gap++;}
 spans.push([s0,last+1]);
 const start=Math.max(0,a*.01-.05),end=Math.min(buf.duration,(b+1)*.01+.09);
 return {buffer:buf,start,end,spans:spans.map(([x,y])=>[Math.max(0,x*.01-start),y*.01-start])};
}
function wordWeight(w){const l=w.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/g,'');const syl=(l.toLowerCase().match(/[aeiouáéíóúü]+/g)||[]).length;return Math.max(1,l.length*.55+syl*1.1+(/^\d+$/.test(l)?l.length*1.2:0))+.6;}
const PHRASE_END=/[,;:.!?…]["”)\]]*$/,SENT_END=/[.!?…]["”)\]]*$/;
function groupWords(ws,re){const g=[];let cur=[];ws.forEach((w,i)=>{cur.push(i);if(re.test(w)){g.push(cur);cur=[];}});if(cur.length)g.push(cur);return g;}
function phrasesOf(ws){return groupWords(ws,PHRASE_END);}
// Tiempos [inicio,fin] de cada palabra dentro de la escena. Con pausas detectadas en el audio las frases se anclan a ellas.
function estimateWordTimes(text,off,dur,spans){
 const ws=words(text);if(!ws.length)return [];
 const W=ws.map(wordWeight),times=new Array(ws.length);
 const pauseOf=w=>/[.!?…]["”)\]]*$/.test(w)?.30:/[;:]["”)\]]*$/.test(w)?.20:/,["”)\]]*$/.test(w)?.13:0;
 const P=ws.reduce((x,w,i)=>x+(i<ws.length-1?pauseOf(w):0),0),speech=Math.max(dur*.56,dur-P),totalWeight=W.reduce((x,y)=>x+y,0),k=speech/Math.max(.001,totalWeight);
 let t=off;ws.forEach((w,i)=>{const d=W[i]*k;times[i]=[t,t+d];t+=d+(i<ws.length-1?pauseOf(w)*(dur-speech>=P?1:(P?Math.max(0,dur-speech)/P:0)):0);});
 // Ajusta límites de cláusulas a pausas que sí aparecen en la onda de voz. No exige que
 // el número de silencios coincida exactamente con las comas/puntos del guion.
 if(!Array.isArray(spans)||spans.length<2)return times;
 const active=spans.map(x=>[Math.max(0,Number(x?.[0])||0),Math.min(dur,Number(x?.[1])||0)])
  .filter(x=>x[1]-x[0]>.035).sort((a,b)=>a[0]-b[0]);
 if(active.length<2)return times;
 const gaps=[];
 for(let i=0;i<active.length-1;i++){
  const a=active[i][1],b=active[i+1][0],gap=b-a;
  if(gap>=.09&&gap<=4)gaps.push({a,b,mid:(a+b)/2});
 }
 if(!gaps.length)return times;
 const groups=phrasesOf(ws);if(groups.length<2)return times;
 const tol=Math.max(.42,Math.min(1.2,dur*.027));let cursor=0,correction=0;const anchors=new Map();
 for(let g=0;g<groups.length-1;g++){
  const left=groups[g][groups[g].length-1],right=groups[g+1][0];
  const base=(times[left][1]+times[right][0])/2,target=base+correction,relativeTarget=target-off;
  let best=-1,bestDiff=Infinity;
  for(let j=cursor;j<gaps.length;j++){
   const diff=Math.abs(gaps[j].mid-relativeTarget);
   if(gaps[j].mid<relativeTarget-tol)continue;
   if(gaps[j].mid>relativeTarget+tol)break;
   if(diff<bestDiff){best=j;bestDiff=diff;}
  }
  if(best>=0){
   const gap=gaps[best];anchors.set(g,{before:off+gap.a,after:off+gap.b});
   correction=(off+gap.mid)-base;cursor=best+1;
  }
 }
 // Dentro de cada cláusula, repartir la duración por sílabas/peso visual, delimitada por
 // la pausa detectada anterior y posterior. Así el resaltado no se adelanta durante silencios.
 groups.forEach((idx,g)=>{
  const prior=g>0?anchors.get(g-1):null,next=g<groups.length-1?anchors.get(g):null;
  let a=prior?prior.after:times[idx[0]][0],b=next?next.before:times[idx[idx.length-1]][1];
  const fallbackA=times[idx[0]][0],fallbackB=times[idx[idx.length-1]][1];
  if(!Number.isFinite(a)||!Number.isFinite(b)||b-a<Math.min(.055,(fallbackB-fallbackA)*.18)||a<off-.15||b>off+dur+.15){a=fallbackA;b=fallbackB;}
  const sum=idx.reduce((acc,i)=>acc+W[i],0),span=Math.max(.045,b-a);let at=a;
  idx.forEach(i=>{const d=span*W[i]/Math.max(.001,sum);times[i]=[at,at+d];at+=d;});
 });
 return times;
}
// Alineación acústica v26: las palabras se reparten sobre el tiempo REALMENTE hablado (se saltan todas las pausas
// detectadas) y las fronteras de frase se anclan, con programación dinámica, a las pausas reales de la voz.
function alignWordsToVoice(ws,off,dur,spans){
 if(!Array.isArray(spans)||!spans.length||!(dur>0))return null;
 const seg=[];
 spans.map(x=>[Math.max(0,Number(x?.[0])||0),Math.min(dur,Number(x?.[1])||0)]).filter(x=>x[1]-x[0]>.03).sort((a,b)=>a[0]-b[0]).forEach(x=>{const l=seg[seg.length-1];if(l&&x[0]<=l[1]+.001)l[1]=Math.max(l[1],x[1]);else seg.push([x[0],x[1]]);});
 if(!seg.length)return null;
 const cum=[];let Tv=0;seg.forEach(s=>{cum.push(Tv);Tv+=s[1]-s[0];});
 if(Tv<.3)return null;
 const toReal=(v,isEnd)=>{v=Math.max(0,Math.min(Tv,v));for(let i=0;i<seg.length;i++){const len=seg[i][1]-seg[i][0];if(isEnd?v<=cum[i]+len+1e-9:v<cum[i]+len-1e-9)return seg[i][0]+Math.max(0,Math.min(len,v-cum[i]));}return seg[seg.length-1][1];};
 const Wt=ws.map(wordWeight),CW=[0];Wt.forEach(w=>CW.push(CW[CW.length-1]+w));const TW=CW[ws.length],rate=Tv/TW;
 const gaps=[];for(let i=0;i<seg.length-1;i++){const d=seg[i+1][0]-seg[i][1];if(d>=.09)gaps.push({v:cum[i]+(seg[i][1]-seg[i][0]),d});}
 const groups=phrasesOf(ws),G=groups.length;let anchors=[];
 if(G>=2&&gaps.length){
  const J=gaps.length,B=G-1,bw=[],bpen=[];
  for(let g=0;g<B;g++){const last=groups[g][groups[g].length-1],tok=ws[last];bw.push(CW[last+1]);bpen.push(SENT_END.test(tok)?1:/[;:]["”)\]]*$/.test(tok)?.6:.25);}
  const BP=[0];bpen.forEach(x=>BP.push(BP[BP.length-1]+x));
  const GP=[0];gaps.forEach(x=>GP.push(GP[GP.length-1]+Math.min(1,x.d/.45)*.9));
  const sc=(pv,pw,nv,nw)=>{const act=nv-pv;if(act<.02)return Infinity;return Math.abs(Math.log((act+.12)/((nw-pw)*rate+.12)))*2.5;};
  const best=Array.from({length:B+1},()=>new Float64Array(J+1).fill(Infinity)),par=Array.from({length:B+1},()=>new Int32Array(J+1).fill(-1));best[0][0]=0;
  for(let g=0;g<B;g++)for(let j=0;j<J;j++){
   const nv=gaps[j].v,nw=bw[g],reward=-Math.min(1,gaps[j].d/.3)*.5;let bc=Infinity,bp=-1;
   for(let pg=-1;pg<g;pg++)for(let pj=-1;pj<j;pj++){
    const base=best[pg+1][pj+1];if(base===Infinity)continue;
    const c=base+sc(pj<0?0:gaps[pj].v,pg<0?0:bw[pg],nv,nw)+(BP[g]-BP[pg+1])+(GP[j]-GP[pj+1])+reward;
    if(c<bc){bc=c;bp=(pg+1)*(J+1)+(pj+1);}
   }
   best[g+1][j+1]=bc;par[g+1][j+1]=bp;
  }
  let endBest=Infinity,node=0;
  for(let a=0;a<=B;a++)for(let b=0;b<=J;b++){const base=best[a][b];if(base===Infinity)continue;const c=base+sc(b===0?0:gaps[b-1].v,a===0?0:bw[a-1],Tv,TW)+(BP[B]-BP[a])+(GP[J]-GP[b]);if(c<endBest){endBest=c;node=a*(J+1)+b;}}
  while(node>0){const a=Math.floor(node/(J+1)),b=node%(J+1);anchors.unshift({w:bw[a-1],v:gaps[b-1].v});node=par[a][b];if(node<0)break;}
 }
 const pts=[{w:0,v:0},...anchors,{w:TW,v:Tv}];
 const vAt=x=>{let k=0;while(k<pts.length-2&&x>pts[k+1].w+1e-9)k++;const A=pts[k],C=pts[k+1],span=C.w-A.w;return span>0?A.v+(x-A.w)/span*(C.v-A.v):A.v;};
 return ws.map((_,i)=>{const s=off+toReal(vAt(CW[i]),false);let e=off+toReal(vAt(CW[i+1]),true);if(e<s+.04)e=s+.04;return [s,e];});
}
function computeWordTimes(text,off,dur,spans){
 const ws=words(text);if(!ws.length)return [];
 try{const t=alignWordsToVoice(ws,off,dur,spans);if(t&&t.length===ws.length&&t.every(x=>Number.isFinite(x[0])&&Number.isFinite(x[1])))return t;}catch(e){}
 return estimateWordTimes(text,off,dur,spans);
}
// Crea una única pista TTS y sincroniza las escenas con los tiempos estimados de sus palabras.
// Así el modelo interpreta toda la narración en una sola generación y no cambia de voz entre escenas.
function terminalPunctuation(text){
 const value=String(text||'').trim().replace(/[,;:]+$/,'');
 if(!value)return '';
 return /[.!?…]["”')\]]*$/.test(value)?value:value+'.';
}
function assembleSingleVoiceTimeline(p,clip,ctx,sceneTexts){
 const scenes=p.scenes||[],n=scenes.length;
 if(!n)throw new Error('El proyecto no tiene escenas para sincronizar.');
 const emptyIndex=sceneTexts.findIndex(text=>!String(text||'').trim());
 if(emptyIndex>=0)throw new Error(`La escena ${emptyIndex+1} no tiene texto para narrar. Añade una narración, subtítulo o título y vuelve a generar la voz.`);
 const sr=clip.buffer.sampleRate||ctx.sampleRate,lead=.4,tail=2.0,dur=Math.max(.05,clip.end-clip.start),total=lead+dur+tail;
 const out=ctx.createBuffer(1,Math.ceil(total*sr)+1,sr),dst=out.getChannelData(0),src=clip.buffer.getChannelData(0);
 const from=Math.max(0,Math.round(clip.start*sr)),to=Math.round(lead*sr),len=Math.max(0,Math.min(Math.round(dur*sr),src.length-from));
 for(let k=0;k<len&&to+k<dst.length;k++)dst[to+k]=src[from+k];
 const fade=Math.min(len>>1,Math.max(1,Math.round(.008*sr)));
 for(let k=0;k<fade;k++){const gain=k/fade;dst[to+k]*=gain;dst[to+len-1-k]*=gain;}

 const transcript=sceneTexts.join(' '),globalTimes=computeWordTimes(transcript,lead,dur,clip.spans);
 const counts=sceneTexts.map(text=>words(text).length),expected=counts.reduce((a,b)=>a+b,0);
 if(globalTimes.length!==expected)throw new Error('No se pudieron sincronizar todas las palabras con la pista de voz. Regenera la voz.');
 const boundaries=[0];let offset=0;
 for(let i=1;i<n;i++){
  offset+=counts[i-1];
  const prev=globalTimes[offset-1],next=globalTimes[offset];
  const guessed=prev&&next?(prev[1]+next[0])/2:boundaries[i-1]+(total-boundaries[i-1])/(n-i+1);
  const min=boundaries[i-1]+.01,max=total-(n-i)*.01;
  boundaries.push(Math.max(min,Math.min(max,guessed)));
 }
 boundaries.push(total);
 offset=0;
 scenes.forEach((scene,i)=>{
  const start=boundaries[i],end=boundaries[i+1],count=counts[i];
  scene.duration=Math.max(.01,Math.round((end-start)*1000)/1000);
  scene.vOff=0;scene.vDur=scene.duration;scene.wtKey=spokenText(scene);
  scene.wordTimes=globalTimes.slice(offset,offset+count).map(([a,b])=>[Math.max(0,a-start),Math.max(0,b-start)]);
  offset+=count;
 });
 recalculate(p);voiceBufferCache.set(p.id,out);p.voiceStale=false;return out;
}
const wtEstCache=new Map();
// Palabras y tiempos de la escena: los reales si hay voz vigente; si no, una estimación sobre la duración de la escena.
function sceneWords(s){
 const text=spokenText(s),ws=words(text);
 if(Array.isArray(s.wordTimes)&&s.wtKey===text&&s.wordTimes.length===ws.length)return {ws,times:s.wordTimes,real:true};
 const k=text+'|'+s.duration;let c=wtEstCache.get(k);if(!c){c=computeWordTimes(text,.3,Math.max(1,(+s.duration||6)-.75),null);if(wtEstCache.size>300)wtEstCache.clear();wtEstCache.set(k,c);}
 return {ws,times:c,real:false};
}
// Grupos de 1–4 palabras (máx. ~17 letras) que respetan los signos de puntuación.
function subtitleChunks(ws){
 const out=[];let cur=[],len=0;
 ws.forEach((w,i)=>{const L=w.length;if(cur.length&&(cur.length>=4||(cur.length>=3&&len+L>13)||len+L>17)){out.push(cur);cur=[];len=0;}cur.push(i);len+=L+1;if(PHRASE_END.test(w)){out.push(cur);cur=[];len=0;}});
 if(cur.length)out.push(cur);return out;
}
const SUB_DELAY=0,subChunkCache=new Map();
// Une grupos que durarían menos de ~0,36 s (se leen como parpadeos) sin cruzar signos de puntuación.
function mergeFastChunks(chs,ws,times){
 const MIN=.36,out=[];
 for(let k=0;k<chs.length;k++){
  let cur=chs[k];
  while(k<chs.length-1){
   const nxt=chs[k+1],last=ws[cur[cur.length-1]],dur=times[nxt[0]][0]-times[cur[0]][0],n=cur.length+nxt.length,chars=cur.concat(nxt).reduce((a,i)=>a+ws[i].length+1,0);
   if(dur>=MIN||PHRASE_END.test(last)||n>4||chars>21)break;
   cur=cur.concat(nxt);k++;
  }
  out.push(cur);
 }
 return out;
}
function sceneChunks(s,sw){const k=sw.ws.join(' ')+'|'+sw.times.length+':'+sw.times.reduce((a,t)=>a+t[0]+t[1],0).toFixed(3);let c=subChunkCache.get(k);if(!c){c=mergeFastChunks(subtitleChunks(sw.ws),sw.ws,sw.times);if(subChunkCache.size>300)subChunkCache.clear();subChunkCache.set(k,c);}return c;}
// Cambios de emoción solo al inicio de una frase, según los tiempos reales de la narración.
const emoSchedCache=new Map();
function emotionSchedule(s,p){
 const em=emotionSeq(s,p),sw=sceneWords(s),key=em.join(',')+'|'+sw.ws.join(' ')+'|'+(sw.real?'r':'e')+(+s.duration||0);
 if(emoSchedCache.has(key))return emoSchedCache.get(key);
 let res=[{id:em[0],at:0}];
 if(em.length>1&&sw.ws.length){
  const starts=phrasesOf(sw.ws).map(g=>g[0]).filter(i=>i>0),sched=[res[0]];
  for(let k=1;k<em.length;k++){const target=sw.ws.length*k/em.length;let best=null;starts.forEach(i=>{if(best===null||Math.abs(i-target)<Math.abs(best-target))best=i;});sched.push({id:em[k],at:best!==null?sw.times[best][0]:Math.max(1.6,(+s.duration||6)*k/em.length)});}
  res=[sched[0]];for(let k=1;k<sched.length;k++){const prev=res[res.length-1];if(sched[k].at-prev.at>=1.6&&sched[k].id!==prev.id)res.push(sched[k]);}
 }
 if(emoSchedCache.size>300)emoSchedCache.clear();emoSchedCache.set(key,res);return res;
}
// VOICE-TIMELINE>>
async function generateGeminiNarration(p,onProgress){
 const key=apiKeyFor('gemini');if(!key)throw new Error('Conecta Gemini para crear una voz grabable. Puedes escuchar el borrador con la voz del navegador, pero esa voz no puede incorporarse directamente al MP4 desde Web Speech API.');
 const sceneTexts=p.scenes.map(s=>terminalPunctuation(spokenText(s)));
 if(sceneTexts.some(text=>!text))throw new Error('Cada escena necesita una narración, subtítulo o título para generar una voz continua.');
 const transcript=sceneTexts.join(' ');p.fullNarration=transcript;
 if(words(transcript).length<25)throw new Error('La narración quedó demasiado corta. Genera de nuevo el guion.');
 const ctx=getTTSContext();await ctx.resume().catch(()=>{});if(onProgress)onProgress(1,1);
 // Una sola petición con el guion completo: evita que el timbre, acento o interpretación cambien entre escenas.
 let generated;
 try{generated=await ttsToBuffer(transcript,key,{label:'Narración completa del Short (voz única)'});}
 catch(e){throw new Error(`No se pudo generar la voz continua del Short. La pista anterior se conserva. ${String(e.message||e)}`);}
 const mastered=masterNarrationBuffer(generated.buffer);
 const clip=analyzeVoiceClip(mastered);
 assembleSingleVoiceTimeline(p,clip,ctx,sceneTexts);p.voiceMode='gemini-single';
 if(p.durationSec>180)toast(`La narración dura ${Math.round(p.durationSec)} s y supera el máximo de 180 s para Shorts. Reduce el guion.`,'error');
 return true;
}
async function regenerateActiveVoice(){const p=activeProject();if(!p)return;const btn=$('regenerateVoice');const old=btn.textContent;btn.disabled=true;btn.textContent='Generando voz…';try{await generateGeminiNarration(p,()=>{btn.textContent='Generando voz única…';});touch();syncEditor();renderPreview();toast('Voz grabable actualizada. Ya puedes exportar.','success');log('Voz regenerada para '+p.topic);}catch(e){toast('Falló la generación de voz IA. No se cambió a voz del navegador. Detalle: '+String(e.message||e).slice(0,180),'error');log('TTS no disponible: '+String(e.message||e).slice(0,200));}finally{btn.disabled=false;btn.textContent=old;}}
async function generateRandomShort(autoExport=true){
 if(recorder&&recorder.state==='recording'){toast('Ya se está exportando un vídeo. Espera a que termine.','error');return;}
 if(!apiKeyFor('gemini')&&!apiKeyFor('groq')){toast('Conecta Gemini o Groq en IA, claves y cuotas. No se usará un catálogo fijo de temas.','error');setPage('settings');return;}
 const buttons=[$('topNew'),$('dashStart')].filter(Boolean);buttons.forEach(b=>{b.disabled=true;b.dataset.oldLabel=b.textContent;b.textContent='Investigando una idea original…';});
 let audioCtx=null;try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(autoExport&&AudioCtx){audioCtx=new AudioCtx();await audioCtx.resume().catch(()=>{});window.__focoPreparedAudioContext=audioCtx;}}catch(e){}
 try{
  let raw;try{raw=await requestGroundedShortIdea();}catch(firstError){if(!apiKeyFor('groq'))throw firstError;throw firstError;}
  const savedMascot=(()=>{try{return JSON.parse(localStorage.getItem(MASCOT_PROFILE_KEY)||'null')}catch{return null}})();
  raw.character=saveMascotProfile(savedMascot||raw.character);
  if(recentTopics().some(topic=>topicOverlap(raw.topic,topic)>.72)){raw=await requestGroundedShortIdea('La primera opción se parecía demasiado a un vídeo anterior. Elige una subárea distinta y un ángulo que no comparta los mismos conceptos.');if(recentTopics().some(topic=>topicOverlap(raw.topic,topic)>.72))throw new Error('La IA propuso un tema demasiado parecido a uno anterior. Pulsa de nuevo para generar otro; no se reutilizará la plantilla.');}
  // Si hubo un reintento, forzar la identidad ya guardada para no rediseñar accidentalmente la mascota.
  raw.character=loadMascotProfile();
  const usedGroq=!!apiKeyFor('groq');if(usedGroq&&raw._generatedBy!=='groq'){buttons.forEach(b=>b.textContent='Dando personalidad al guion…');raw=await polishWithGroq(raw);}
  const p=buildFreshProject(raw);state.projects.unshift(p);state.activeId=p.id;state.selectedScene=0;state.selectedFact=p.facts[0]?.id||null;state.preview.time=0;state.preview.playing=false;state.editingBatchId=null;saveState();syncEditor();renderFacts();renderHistory();setPage('editor');
  buttons.forEach(b=>b.textContent='Buscando imágenes de Internet…');const imageCount=await fetchComparisonImages(p);const hasSufficientPhotos=p.scenes.every(sc=>(sc.images||[]).filter(Boolean).length>=1);
  const hasSecondPhotoMissing=p.scenes.some(sc=>(sc.images||[]).filter(Boolean).length<2);
  await loadStickPoses(p.character);
  buttons.forEach(b=>b.textContent='Generando voz…');try{await generateGeminiNarration(p,()=>buttons.forEach(b=>b.textContent='Generando voz única para todo el Short…')); }catch(e){throw new Error('El guion y las imágenes quedaron listos, pero falló la generación de voz IA. No se activó la voz del navegador ni se borró la pista anterior. '+String(e.message||e).slice(0,200));}
  recalculate(p);p.description.text+=(p.description.text.includes('Fuentes consultadas')?'':'\n\nFuentes consultadas:\n')+(p.facts.map(f=>`${f.sourceName}: ${f.sourceUrl}`).filter(Boolean).join('\n'));p.description.sourcesText=p.facts.map(f=>`${f.sourceName}: ${f.sourceUrl}`).filter(Boolean).join('\n');touch();syncEditor();renderFacts();renderHistory();renderPreview();rememberTopic(p.topic);log(`Short creado con investigación en vivo: ${p.topic} · ${imageCount} imágenes encontradas${usedGroq?' · Groq pulió el guion':''}.`);
  if(hasSufficientPhotos)toast(`Guion, fotografías y voz listos${hasSecondPhotoMissing?' · algunas escenas usan una foto amplia':''}${usedGroq?' · Gemini + Groq':''}. Revisa la vista previa.`, 'success');else toast(`El Short se creó, pero hay escenas sin ninguna foto. Completa al menos una foto en cada escena antes de exportar.`, 'error');
  if(autoExport&&hasSufficientPhotos){$('videoProgress').classList.add('visible');updateVideoProgress(0,'Preparando renderizado…');await exportVideoRecording(true);}
 }catch(e){toast('No se pudo generar el Short: '+e.message,'error');log('Error de generación: '+String(e.message||e).slice(0,180));if(audioCtx&&!recorder){try{await audioCtx.close();}catch(_){}if(window.__focoPreparedAudioContext===audioCtx)window.__focoPreparedAudioContext=null;}}
 finally{buttons.forEach(b=>{b.disabled=false;if(b.dataset.oldLabel)b.textContent=b.dataset.oldLabel;delete b.dataset.oldLabel;});}
}
function makeNewProject(topic,layout){const p=blankProject(topic||'Mi nuevo Short',layout||'question');state.projects.unshift(p);state.activeId=p.id;state.selectedScene=0;state.preview.time=0;state.preview.playing=false;saveState();setPage('editor');syncEditor();renderHistory();log('Creado proyecto: '+p.topic);}
function switchProject(id){if(!state.projects.some(p=>p.id===id))return;state.activeId=id;state.selectedScene=0;state.preview.time=0;state.preview.playing=false;saveState();syncEditor();preloadProjectImages(activeProject()).then(()=>renderPreview());updateDashboard();renderFacts();renderHistory();toast('Proyecto abierto.');}
function importProjectFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);const incoming=Array.isArray(obj.projects)?obj.projects:[(obj._focoshorts||obj)];const existing=new Set(state.projects.map(p=>p.id));const projs=incoming.map(item=>{const p=normalizeProject(item,true);if(existing.has(p.id))p.id=uid();existing.add(p.id);return p;});if(!projs.length)throw new Error('No se encontraron proyectos.');state.projects.unshift(...projs);state.activeId=projs[0].id;state.selectedScene=0;state.preview.time=0;saveState();hydrateUploadedImages().catch(()=>{}).then(()=>preloadProjectImages(projs[0])).then(()=>{renderSceneImagesEditor();renderPreview();});syncEditor();updateDashboard();renderHistory();log(`Importado(s) ${projs.length} proyecto(s). Los datos verificados vuelven a pendientes para revisión local.`);toast('Importación correcta. Revisa otra vez las fuentes y los datos.','success');setPage('editor');}catch(e){toast('No se pudo importar: '+e.message,'error');}};reader.onerror=()=>toast('No se pudo leer el archivo.','error');reader.readAsText(file);}
function addScene(){const p=activeProject();if(!p||p.scenes.length>=8){toast('El proyecto admite un máximo de 8 escenas.','error');return;}const idx=p.scenes.length;const s={id:'s'+(idx+1),start:p.durationSec,duration:Math.min(60,Math.max(3,Math.round((180-p.durationSec)/(8-idx))||6)),kind:p.style.layoutFamily||'question',pose:p.style.layoutFamily||'question',imageQuery:'',images:[],beat:'Nueva idea',headline:'Añade el texto de esta escena',subtitle:'Una frase breve para acompañar',factRefs:[],transitionOut:'cut',sfxCue:'auto',sfxGain:.35};if(p.durationSec+s.duration>180)s.duration=180-p.durationSec;if(s.duration<3){toast('No hay espacio para otra escena dentro del máximo de 180 segundos. Reduce la duración de las escenas existentes.','error');return;}p.scenes.push(s);state.selectedScene=idx;recalculate(p);touch();syncEditor();toast('Escena añadida.');}
function deleteScene(){const p=activeProject();if(!p||p.scenes.length<=5){toast('Un Short necesita al menos 5 escenas.','error');return;}const removed=p.scenes.splice(state.selectedScene,1)[0];state.selectedScene=Math.max(0,state.selectedScene-1);recalculate(p);touch();syncEditor();log('Eliminada escena '+removed.id);}
function switchLayout(layout){if(!LAYOUTS.includes(layout))return;const p=activeProject();p.style.layoutFamily=layout;const s=p.scenes[state.selectedScene];if(s){s.kind=layout;s.pose=layout;}document.querySelectorAll('[data-layout]').forEach(b=>b.classList.toggle('selected',b.dataset.layout===layout));touch();renderPreview();renderSceneList();}
function sourceFormToFact(f){if(!f)return;f.sourceName=$('sourceName').value.trim();f.sourceUrl=$('sourceUrl').value.trim();f.excerpt=$('sourceExcerpt').value.trim();activeProject().sourceName=f.sourceName;activeProject().sourceUrl=f.sourceUrl;activeProject().sourceExcerpt=f.excerpt;}
function chooseFact(id){const p=activeProject(),f=p?.facts.find(x=>x.id===id);if(!f)return;state.selectedFact=id;$('sourceName').value=f.sourceName||p.sourceName||'';$('sourceUrl').value=f.sourceUrl||p.sourceUrl||'';$('sourceExcerpt').value=f.excerpt||p.sourceExcerpt||'';document.querySelectorAll('[data-fact-card]').forEach(c=>c.classList.toggle('selected',c.dataset.factCard===id));}
function renderFacts(){const p=activeProject();if(!p)return;const box=$('factList');const groundedCount=p.facts.filter(f=>f.aiGrounded).length;const humanCount=p.facts.filter(f=>f.status==='verified'&&!f.aiGrounded).length;$('factsSummary').textContent=`${p.facts.length} afirmaciones · ${groundedCount} con fuente web · ${humanCount} revisadas`; $('factsEmpty').classList.toggle('hidden',p.facts.length>0);const allGrounded=p.facts.length&&p.facts.every(f=>f.aiGrounded);const allHuman=p.facts.length&&p.facts.every(f=>f.status==='verified'&&!f.aiGrounded);$('evidenceStatus').textContent=allHuman?'REVISIÓN HUMANA COMPLETA':allGrounded?'FUENTES ENLAZADAS · REVISAR':'REVISIÓN PENDIENTE';$('evidenceStatus').className='tag '+(allHuman?'ready':'pending');box.innerHTML=p.facts.map((f,i)=>`<article class="fact-card ${state.selectedFact===f.id?'selected':''}" data-fact-card="${esc(f.id)}"><div class="fact-top"><span class="fact-num">${String(i+1).padStart(2,'0')}</span><div class="fact-title"><b>${esc(f.claim||'Afirmación sin redactar')}</b><small>${(f.aiGrounded?'↗ FUENTE ENLAZADA':f.status==='verified'?'✓ REVISADO':f.status==='rejected'?'✕ RECHAZADO':'◷ PENDIENTE')} · ${esc(f.sourceName||'Sin fuente')}</small></div><button class="btn small" data-edit-fact="${esc(f.id)}">Editar fuente</button></div><div class="fact-fields"><label class="wide">Afirmación<input data-fclaim="${esc(f.id)}" value="${esc(f.claim)}" maxlength="260"></label><label>Valor numérico<input data-fvalue="${esc(f.id)}" type="number" step="any" value="${f.value??''}" placeholder="Opcional"></label><label>Unidad<input data-funit="${esc(f.id)}" value="${esc(f.unit||'')}" placeholder="días, °C…"></label><label>Estado<select data-fstatus="${esc(f.id)}"><option value="pending" ${f.status==='pending'?'selected':''}>Pendiente</option><option value="rejected" ${f.status==='rejected'?'selected':''}>Rechazado</option></select></label><label class="wide">URL de la fuente<input data-furl="${esc(f.id)}" type="url" value="${esc(f.sourceUrl||'')}" placeholder="https://fuente-oficial.example"></label><label class="wide">Extracto literal consultado<textarea data-fexcerpt="${esc(f.id)}" rows="3" placeholder="Pega aquí el párrafo que respalda el dato">${esc(f.excerpt||'')}</textarea><span class="helper">${words(f.excerpt).length} palabras · La app solo comprueba coincidencias sencillas; tú debes leer la fuente.</span></label></div><div class="fact-approval"><label class="check-label"><input type="checkbox" data-human-review="${esc(f.id)}"> He abierto y leído la fuente original; el extracto respalda esta afirmación.</label><div class="actions"><button class="btn small danger" data-delete-fact="${esc(f.id)}">Eliminar</button><button class="btn small primary" data-approve-fact="${esc(f.id)}">Aprobar dato</button></div></div><div class="fineprint">${(s=>s.length>180?s.slice(0,180)+'…':s)(f.excerpt||'Aún no se ha guardado evidencia para este dato.')}</div></article>`).join('');if(!state.selectedFact&&p.facts.length)chooseFact(p.facts[0].id);else if(state.selectedFact&&p.facts.some(f=>f.id===state.selectedFact))chooseFact(state.selectedFact);else if(p.facts.length)chooseFact(p.facts[0].id);}
function validateEvidence(f,withHuman=false){const errors=[];if(!f.claim.trim())errors.push('Escribe una afirmación concreta.');if(!/^https:\/\//i.test(f.sourceUrl||''))errors.push('La URL debe empezar con https://.');if((f.excerpt||'').trim().length<25)errors.push('Pega al menos 25 caracteres del texto fuente.');if(f.value!==null&&f.value!==undefined&&String(f.value)!==''){const val=String(f.value);if(!f.excerpt.includes(val))errors.push(`El valor ${val} no aparece literalmente en el extracto pegado.`);}else{const keywords=words(f.claim.toLowerCase()).filter(w=>w.length>4&&!['sobre','mismo','unos','unas','desde','hasta','contrario','mayoría','superficie'].includes(w));const matched=keywords.filter(w=>(f.excerpt||'').toLowerCase().includes(w)).length;if(keywords.length&&matched<Math.min(2,keywords.length))errors.push('El extracto no parece compartir suficientes términos con la afirmación. Revísalo manualmente.');}if(withHuman&&!document.querySelector(`[data-human-review="${CSS.escape(f.id)}"]`)?.checked)errors.push('Marca la casilla de revisión humana tras leer la fuente.');return errors;}
function saveFactFields(target){const id=target.dataset.fclaim||target.dataset.fvalue||target.dataset.funit||target.dataset.furl||target.dataset.fexcerpt||target.dataset.fstatus;const p=activeProject(),f=p?.facts.find(x=>x.id===id);if(!f)return;if(target.dataset.fclaim!==undefined)f.claim=target.value;if(target.dataset.fvalue!==undefined)f.value=target.value.trim()===''?null:Number(target.value);if(target.dataset.funit!==undefined)f.unit=target.value;if(target.dataset.furl!==undefined)f.sourceUrl=target.value.trim();if(target.dataset.fexcerpt!==undefined)f.excerpt=target.value;if(target.dataset.fstatus!==undefined)f.status=target.value;else if(f.status==='verified')f.status='pending';const human=document.querySelector(`[data-human-review="${CSS.escape(id)}"]`);if(human)human.checked=false;touch();saveState();const title=document.querySelector(`[data-fact-card="${CSS.escape(id)}"] .fact-title small`);if(title)title.textContent=(f.aiGrounded?'↗ FUENTE ENLAZADA':f.status==='verified'?'✓ REVISADO':f.status==='rejected'?'✕ RECHAZADO':'◷ PENDIENTE')+' · '+(f.sourceName||'');}
function approveFact(id){const p=activeProject(),f=p?.facts.find(x=>x.id===id);if(!f)return;const errors=validateEvidence(f,true);if(errors.length){toast(errors[0],'error');return;}f.status='verified';f.sourceName=f.sourceName||$('sourceName').value.trim()||'Fuente revisada por usuario';touch();renderFacts();renderSceneList();renderPreview();log('Aprobado dato: '+f.claim);toast('Dato marcado como verificado por revisión humana.','success');}
function addFact(){const p=activeProject();if(!p)return;if(p.facts.length>=6){toast('El documento define un máximo de 6 datos por Short.','error');return;}const f={id:'f'+Date.now().toString(36),claim:'Nueva afirmación pendiente de verificar',value:null,unit:'',sourceName:'',sourceUrl:'',excerpt:'',status:'pending'};p.facts.push(f);state.selectedFact=f.id;touch();renderFacts();populateSceneFacts();log('Añadido dato a '+p.topic);}
function deleteFact(id){const p=activeProject(),i=p?.facts.findIndex(f=>f.id===id);if(i===undefined||i<0)return;const f=p.facts[i];p.facts.splice(i,1);p.scenes.forEach(s=>s.factRefs=(s.factRefs||[]).filter(x=>x!==id));state.selectedFact=p.facts[0]?.id||null;touch();renderFacts();populateSceneFacts();renderSceneList();renderPreview();log('Eliminado dato: '+f.claim);}
function bindFactEvents(){const box=$('factList');box.addEventListener('input',e=>{if(e.target.matches('[data-fclaim],[data-fvalue],[data-funit],[data-furl],[data-fexcerpt]'))saveFactFields(e.target);});box.addEventListener('change',e=>{if(e.target.matches('[data-fstatus]'))saveFactFields(e.target);});box.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-fact]'),del=e.target.closest('[data-delete-fact]'),approve=e.target.closest('[data-approve-fact]'),card=e.target.closest('[data-fact-card]');if(edit){chooseFact(edit.dataset.editFact);$('sourceName').focus();}if(del)deleteFact(del.dataset.deleteFact);if(approve)approveFact(approve.dataset.approveFact);if(card&&e.target===card)chooseFact(card.dataset.factCard);});}
function syncSettings(){const provider=state.settings.provider||'gemini',cfg=PROVIDERS[provider];$('provider').value=provider;setProviderLabels(provider);const input=$('model');input.value=state.settings.models?.[provider]||cfg.model;const saved=localStorage.getItem(KEY_PREFIX+provider)||'';$('apiKey').value=saved;$('providerState').textContent=saved?'Clave guardada en este navegador':'Sin configurar';$('providerHelp').textContent=`Endpoint: ${cfg.url}. ${cfg.desc}`;if($('pexelsImageKey'))$('pexelsImageKey').value=imageApiKey('pexels');if($('pixabayImageKey'))$('pixabayImageKey').value=imageApiKey('pixabay');renderQuotas();}
function setProviderLabels(id){const c=PROVIDERS[id]||PROVIDERS.gemini;$('providerLogo').textContent=c.logo;$('providerName').textContent=c.name;$('providerDesc').textContent=c.desc;$('providerLink').href=c.link;$('providerLink').textContent='Abrir documentación ↗';$('model').placeholder=c.model;}
function selectedProvider(){return state.settings.provider||'gemini';}
function apiKeyFor(id=selectedProvider()){return localStorage.getItem(KEY_PREFIX+id)||'';}
function persistProvider(){const id=$('provider').value;state.settings.provider=id;state.settings.models=state.settings.models||{};state.settings.models[id]=$('model').value.trim()||PROVIDERS[id].model;try{if($('apiKey').value.trim())localStorage.setItem(KEY_PREFIX+id,$('apiKey').value.trim());}catch(e){toast('No se pudo guardar la clave en el almacenamiento local.','error');return;}saveState();syncSettings();toast('Conexión guardada en este navegador.','success');}
function saveImageKeys(){try{[['pexelsImageKey','pexels'],['pixabayImageKey','pixabay']].forEach(([field,key])=>{const value=$(field)?.value.trim()||'';if(value)localStorage.setItem(IMAGE_KEY_PREFIX+key,value);else localStorage.removeItem(IMAGE_KEY_PREFIX+key);});toast('Claves de búsqueda de imágenes guardadas en este navegador.','success');log('Actualizada configuración de fuentes de imágenes.');}catch(e){toast('No se pudieron guardar las claves de imágenes.','error');}}
function deleteProviderKey(id=selectedProvider()){localStorage.removeItem(KEY_PREFIX+id);$('apiKey').value='';syncSettings();toast('Clave borrada del almacenamiento local.');}
function renderQuotas(){const box=$('quotaList');if(!box)return;const providers=Object.keys(PROVIDERS);box.innerHTML=providers.map(id=>{const q=state.quota[id]||{count:0,lastAt:null,lastStatus:'Sin probar'};const h=q.headers||{};const headerSummary=Object.keys(h).length?' · '+Object.entries(h).map(([k,v])=>k.replace('x-ratelimit-','').replace(/-/g,' ')+': '+v).join(' · '):'';return `<div class="quota-row"><span class="quota-dot"></span><div class="quota-meta"><b>${esc(PROVIDERS[id].name)}</b><small>${esc(q.lastStatus||'Sin probar')} ${q.lastAt?'· '+esc(fmtDate(q.lastAt)):''}</small>${headerSummary?`<small>${esc(headerSummary)}</small>`:''}</div><span class="quota-num">${q.count||0} llamadas</span></div>`;}).join('');}
function captureRateHeaders(res,id){const names=['retry-after','x-ratelimit-limit-requests','x-ratelimit-remaining-requests','x-ratelimit-reset-requests','x-ratelimit-limit-tokens','x-ratelimit-remaining-tokens','x-ratelimit-reset-tokens'];const headers={};for(const n of names){const v=res.headers.get(n);if(v!==null)headers[n]=v;}state.quota[id]=state.quota[id]||{count:0};state.quota[id].headers=headers;state.quota[id].httpStatus=res.status;saveState();renderQuotas();}
function noteCall(id,status){const today=new Date().toISOString().slice(0,10),q=state.quota[id]||{count:0,day:today};if(q.day!==today){q.count=0;q.day=today;}q.count=(q.count||0)+1;q.lastAt=new Date().toISOString();q.lastStatus=status;state.quota[id]=q;saveState();renderQuotas();updateDashboard();}
async function callProvider(prompt,{temperature=.5,system='',test=false}={}){const id=selectedProvider(),cfg=PROVIDERS[id],key=apiKeyFor(id);const model=(state.settings.models?.[id]||cfg.model).trim();if(!key)throw new Error('No hay clave guardada para '+cfg.name+'. Ve a “IA, claves y cuotas”.');let res,data;
 if(cfg.type==='gemini'){
   const url=cfg.url+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key);
   const body={contents:[{role:'user',parts:[{text:(system?system+'\n\n':'')+prompt}]}],generationConfig:{temperature,maxOutputTokens:test?1200:7200,responseMimeType:test?undefined:'application/json'}};
   if(test)delete body.generationConfig.responseMimeType;
   res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});captureRateHeaders(res,id);data=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(data.error?.message||`Gemini respondió HTTP ${res.status}. Comprueba clave, modelo y cuota.`);
   noteCall(id,'HTTP '+res.status);return (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('\n');
 }
 const body={model,messages:[...(system?[{role:'system',content:system}]:[]),{role:'user',content:prompt}],temperature,max_tokens:test?500:7000};
 if(!test)body.response_format={type:'json_object'};
 const headers={'Content-Type':'application/json','Authorization':'Bearer '+key};if(id==='openrouter'){headers['HTTP-Referer']=location.href;headers['X-Title']='FocoShorts Studio';}
 res=await fetch(cfg.url,{method:'POST',headers,body:JSON.stringify(body)});captureRateHeaders(res,id);data=await res.json().catch(()=>({}));
 if(!res.ok&&id==='openrouter'&&res.status===400&&body.response_format){delete body.response_format;res=await fetch(cfg.url,{method:'POST',headers,body:JSON.stringify(body)});captureRateHeaders(res,id);data=await res.json().catch(()=>({}));}
 if(!res.ok)throw new Error(data.error?.message||`La API respondió HTTP ${res.status}. Comprueba clave, modelo y cuota.`);
 noteCall(id,'HTTP '+res.status);return data.choices?.[0]?.message?.content||'';
}
function parseJSONResponse(text){let t=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(t);}catch{}const first=t.indexOf('{'),last=t.lastIndexOf('}');if(first>=0&&last>first){try{return JSON.parse(t.slice(first,last+1));}catch{}}throw new Error('La IA no devolvió un JSON válido. Intenta de nuevo o cambia de modelo.');}
async function testProvider(){const btn=$('testProvider'),old=btn.textContent;btn.disabled=true;btn.textContent='Probando…';try{const id=$('provider').value;state.settings.provider=id;state.settings.models=state.settings.models||{};state.settings.models[id]=$('model').value.trim()||PROVIDERS[id].model;if($('apiKey').value.trim())localStorage.setItem(KEY_PREFIX+id,$('apiKey').value.trim());const answer=await callProvider('Responde únicamente: CONEXION_OK',{test:true,temperature:0});if(!answer)throw new Error('La API respondió sin contenido.');toast('API conectada. Respuesta: '+answer.trim().slice(0,80),'success');log('Prueba correcta de API: '+PROVIDERS[id].name);}catch(e){toast(e.message,'error');noteCall($('provider').value,'Error: '+e.message.slice(0,70));}finally{btn.disabled=false;btn.textContent=old;syncSettings();}}
function makePrompt(p,sourceName,sourceUrl,excerpt){return `Crea un guion de YouTube Short educativo, en español, tema: ${p.topic}.\nUsa SOLO los datos, cifras y relaciones explícitos en el extracto de la fuente a continuación. No inventes datos, referencias, citas, fuentes ni detalles. Si el extracto no respalda una afirmación, no la uses. Esta IA no verifica hechos: todos los hechos deben quedar pendientes de aprobación humana.\nFUENTE: ${sourceName}\nURL: ${sourceUrl}\nEXTRACTO ORIGINAL: <<<${excerpt}>>>\n\nDevuelve únicamente un JSON de objeto con este formato: {"topic":"máximo 80 caracteres","tone":"serio|neutral|ligero","allowedEmotions":["id_exacto","id_exacto","id_exacto"],"hook":"gancho de máximo 8 palabras","facts":[{"id":"f1","claim":"afirmación basada en el extracto","value":null,"unit":"","sourceName":"${sourceName.replace(/"/g,'\\"')}","sourceUrl":"${sourceUrl}","excerpt":"fragmento literal del extracto que respalda esta afirmación"}],"scenes":[{"id":"s1","duration":6,"kind":"question","pose":"question","beat":"idea de la escena","headline":"texto corto","subtitle":"texto corto","narration":"frase para la voz","imageQuery":"consulta de foto real específica en inglés para esta escena","emotions":["id_exacto"],"factRefs":["f1"]}],"description":{"title":"título claro","text":"descripción breve con contexto","hashtags":["#ciencia"],"sourcesText":"${sourceName.replace(/"/g,'\\"')}: ${sourceUrl}"}}.\nReglas obligatorias: 5 a 8 escenas, duración por escena 6 a 10 segundos, suma de duración entre 30 y 60 segundos, máximo 6 facts, todos los factRefs deben existir, kind y pose deben ser question, think, explain, point, confident, celebrate, curious o worried, máximo 12 palabras por texto visible. Cada escena debe tener una consulta imageQuery distinta y específica para encontrar fotos reales; no propongas iconos ni diagramas. Cada hecho debe copiar un fragmento que aparece literalmente en el extracto. Si no hay suficientes datos, crea menos facts y deja las escenas restantes sin factRefs; no inventes. TONO Y AVATAR: decide tone según el tema; elige de 3 a 6 allowedEmotions de esta lista exacta: ${EMO_IDS.map(k=>k+" ("+EMO[k]+")").join("; ")}. Cada escena debe incluir de 1 a 3 emotions válidas de allowedEmotions, en orden narrativo, coherentes con su frase. Usa sorpresa solo para un giro/dato sorprendente; miedo solo ante peligro real; tristeza solo ante pérdida; enojo solo ante injusticia; alegría/celebración solo ante un logro real o tema ligero. En escenas informativas usa una expresión sobria, no fuerces emoción. Nunca repitas la misma expresión en escenas consecutivas salvo que el tono lo exija. No elijas siempre duda_pensando o curioso. Las expresiones se cambian al ritmo de las frases, no cada segundo. No incluyas JavaScript ni Markdown.`;}
async function generateFromSource(){state.editingBatchId=null;const p=activeProject();if(!p)return;const srcName=$('sourceName').value.trim(),url=$('sourceUrl').value.trim(),excerpt=$('sourceExcerpt').value.trim();if(!/^https:\/\//i.test(url)){toast('Pega una URL de fuente que empiece por https://.','error');return;}if(excerpt.length<40){toast('Pega un extracto suficientemente largo que hayas revisado.','error');return;}if(!apiKeyFor()) {toast('Configura primero una clave de IA en Ajustes. El editor y la vista previa no requieren clave.','error');setPage('settings');return;}sourceFormToFact(p.facts.find(f=>f.id===state.selectedFact));p.sourceName=srcName;p.sourceUrl=url;p.sourceExcerpt=excerpt;const btn=$('generateAI'),old=btn.textContent;btn.disabled=true;btn.textContent='Generando guion…';try{let output;for(let attempt=1;attempt<=3;attempt++){try{output=await callProvider(makePrompt(p,srcName,url,excerpt),{temperature:attempt===1?.45:.15});const parsed=parseJSONResponse(output);applyAIProject(parsed,p,srcName,url,excerpt);break;}catch(e){if(attempt===3)throw e;log(`Intento ${attempt} de generación falló: ${e.message}`);}}btn.textContent='Buscando fotografías por escena…';await fetchComparisonImages(p);touch();syncEditor();renderFacts();renderHistory();setPage('editor');log('Generado guion por IA: '+p.topic+' (datos pendientes)');const empty=p.scenes.map((sc,i)=>({scene:i+1,count:(sc.images||[]).filter(Boolean).length})).filter(x=>!x.count);toast(empty.length?'Guion generado, pero hay escenas sin fotos: '+empty.map(x=>x.scene).join(', ')+'. Inserta al menos una foto por escena antes de exportar.':'Guion e imágenes listos; alguna escena puede usar una sola foto. Revisa las fuentes antes de exportar.',empty.length?'error':'success');}catch(e){toast('No se pudo completar el guion visual: '+e.message,'error');}finally{btn.disabled=false;btn.textContent=old;}}
function applyAIProject(raw,p,sourceName,sourceUrl,excerpt){if(!raw||!Array.isArray(raw.scenes)||raw.scenes.length<5||raw.scenes.length>8)throw new Error('El guion debe contener entre 5 y 8 escenas.');if(!Array.isArray(raw.facts)||raw.facts.length>6)throw new Error('El guion debe incluir como máximo 6 datos.');const facts=raw.facts.map((f,i)=>({id:String(f.id||'f'+(i+1)),claim:String(f.claim||''),value:Number.isFinite(+f.value)&&f.value!==null&&f.value!==''?+f.value:null,unit:String(f.unit||''),sourceName,sourceUrl,excerpt:String(f.excerpt||excerpt),status:'pending'}));const projectTone=EMO_BLOCK[raw.tone]?raw.tone:'neutral',projectAllowed=cleanEmos(raw.allowedEmotions,projectTone);const scenes=raw.scenes.map((s,i)=>({id:'s'+(i+1),start:0,duration:Math.round(+s.duration||6),kind:LAYOUTS.includes(s.kind)?s.kind:'question',pose:LAYOUTS.includes(s.pose)?s.pose:(LAYOUTS.includes(s.kind)?s.kind:'question'),beat:String(s.beat||s.headline||''),headline:String(s.headline||s.beat||''),subtitle:String(s.subtitle||''),narration:String(s.narration||s.subtitle||s.headline||''),imageQuery:String(s.imageQuery||`${s.headline||s.beat||p.topic} real life photography`),images:[],emotions:cleanEmos(s.emotions,projectTone,projectAllowed),factRefs:Array.isArray(s.factRefs)?s.factRefs.map(String).filter(id=>facts.some(f=>f.id===id)):[],transitionOut:['cut','wipe','zoom','fade','cut','wipe','zoom','fade'][i%8]}));if(scenes.some(s=>s.duration<6||s.duration>10)||scenes.reduce((a,s)=>a+s.duration,0)<30||scenes.reduce((a,s)=>a+s.duration,0)>60)throw new Error('La IA devolvió duraciones inválidas. Regenera o edita las duraciones manualmente.');p.topic=String(raw.topic||p.topic).slice(0,80);p.tone=projectTone;p.allowedEmotions=projectAllowed;p.hook={text:String(raw.hook||p.hook.text),visual:'Composición vectorial animada',endSec:3};p.facts=facts;p.scenes=scenes;p.style.layoutFamily=scenes[0]?.kind||'question';p.description={title:String(raw.description?.title||p.topic).slice(0,90),text:String(raw.description?.text||''),hashtags:Array.isArray(raw.description?.hashtags)?raw.description.hashtags:String(raw.description?.hashtags||'').split(/\s+/).filter(Boolean),sourcesText:String(raw.description?.sourcesText||sourceName+': '+sourceUrl)};p.sourceName=sourceName;p.sourceUrl=sourceUrl;p.sourceExcerpt=excerpt;recalculate(p);state.selectedScene=0;state.preview.time=0;state.selectedFact=facts[0]?.id||null;}
async function fetchSourceText(){const url=$('sourceUrl').value.trim();if(!/^https:\/\//i.test(url)){toast('Introduce una URL https:// válida.','error');return;}const btn=$('fetchSource'),old=btn.textContent;btn.disabled=true;btn.textContent='Intentando…';try{const res=await fetch(url,{method:'GET',mode:'cors'});if(!res.ok)throw new Error('HTTP '+res.status);const html=await res.text();const doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('script,style,nav,header,footer,noscript,svg').forEach(n=>n.remove());const text=(doc.querySelector('main')||doc.querySelector('article')||doc.body).innerText.replace(/\s+/g,' ').trim();if(text.length<50)throw new Error('No se extrajo texto útil.');$('sourceExcerpt').value=text.slice(0,15000);if(state.editingBatchId){syncBatchTaskField('sourceName',$('sourceName').value.trim());syncBatchTaskField('sourceUrl',url);syncBatchTaskField('excerpt',$('sourceExcerpt').value);}else{const p=activeProject();p.sourceName=$('sourceName').value.trim();p.sourceUrl=url;p.sourceExcerpt=$('sourceExcerpt').value;saveState();}toast('Texto extraído. Léelo y comprueba la fuente antes de generar.','success');}catch(e){toast('Extracción automática bloqueada o fallida (frecuente por CORS). Abre la fuente y pega el párrafo manualmente.','error');}finally{btn.disabled=false;btn.textContent=old;}}
function parseCSV(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;}else if(ch==='"'){quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=ch;}if(cell.length||row.length){row.push(cell);if(row.some(x=>x.trim()))rows.push(row);}if(!rows.length)return[];const head=rows.shift().map(s=>s.trim().toLowerCase().replace(/\s+/g,'_'));return rows.map(r=>{const o={};head.forEach((h,i)=>o[h]=String(r[i]||'').trim());return o;});}
function parseBatchInput(text){text=text.trim();if(!text)return[];if(text.startsWith('[')||text.startsWith('{')){const data=JSON.parse(text),arr=Array.isArray(data)?data:Array.isArray(data.tasks)?data.tasks:[data];return arr.map(x=>({topic:String(x.topic||x.title||''),sourceUrl:String(x.source_url||x.sourceUrl||x.url||''),sourceName:String(x.source_name||x.sourceName||''),layoutFamily:LAYOUTS.includes(x.layoutFamily)?x.layoutFamily:'question',fps:[30,60].includes(+x.fps)?+x.fps:30,excerpt:String(x.source_excerpt||x.sourceExcerpt||x.excerpt||''),status:'queued',id:uid(),createdAt:new Date().toISOString(),error:''})).filter(x=>x.topic);}
 const arr=parseCSV(text);return arr.map(x=>({topic:x.topic||x.title||'',sourceUrl:x.source_url||x.sourceurl||x.url||'',sourceName:x.source_name||x.sourcename||'',layoutFamily:LAYOUTS.includes(x.layoutfamily)?x.layoutfamily:'question',fps:[30,60].includes(+x.fps)?+x.fps:30,excerpt:x.source_excerpt||x.sourceexcerpt||x.excerpt||'',status:'queued',id:uid(),createdAt:new Date().toISOString(),error:''})).filter(x=>x.topic);}
function addBatchTasks(text){try{const tasks=parseBatchInput(text);if(!tasks.length)throw new Error('No se encontraron filas con un campo topic.');state.batch.push(...tasks);saveState();renderBatch();updateDashboard();$('batchText').value='';toast(`${tasks.length} tarea(s) añadidas a la cola.`,'success');log('Añadidas '+tasks.length+' tareas a la cola.');}catch(e){toast('No se pudo leer la cola: '+e.message,'error');}}
function renderBatch(){const box=$('batchTable');if(!box)return;const labels={queued:'En cola',processing:'Procesando',needs_excerpt:'Necesita extracto',done:'Proyecto creado',error:'Error'};$('batchSummary').textContent=`${state.batch.filter(x=>x.status!=='done').length} tareas pendientes · ${state.batch.filter(x=>x.status==='done').length} creadas`;$('batchEmpty').classList.toggle('hidden',state.batch.length>0);box.innerHTML=state.batch.map(t=>`<tr><td><div class="queue-topic">${esc(t.topic)}</div><small class="queue-source">${esc(t.sourceUrl||'Sin URL de fuente')}</small>${t.error?`<small class="queue-source">${esc(t.error)}</small>`:''}</td><td><span class="tag ${t.status==='done'?'ready':'pending'}">${labels[t.status]||esc(t.status)}</span></td><td><div class="table-actions"><button class="btn small" data-batch-open="${esc(t.id)}">Ver</button><button class="btn small danger" data-batch-delete="${esc(t.id)}">×</button></div></td></tr>`).join('');const done=state.batch.filter(x=>['done','error','needs_excerpt'].includes(x.status)).length,total=state.batch.length;$('batchProgressText').textContent=`${done} / ${total}`;$('batchProgressBar').style.width=(total?done/total*100:0)+'%';$('batchProgressBar').parentElement.parentElement.classList.toggle('show',total>0);}
async function processBatchQueue(){state.editingBatchId=null;if(!state.batch.length){toast('Añade tareas antes de procesar.','error');return;}if(!apiKeyFor()){toast('Configura una API en Ajustes para generar los guiones del lote.','error');setPage('settings');return;}const btn=$('processBatch');btn.disabled=true;let completed=0;try{for(const task of state.batch){if(task.status==='done')continue;if(!task.sourceUrl||!/^https:\/\//i.test(task.sourceUrl)){task.status='needs_excerpt';task.error='Añade una URL https válida.';renderBatch();saveState();continue;}let excerpt=(task.excerpt||'').trim();if(excerpt.length<40){task.status='needs_excerpt';task.error='Pega el extracto y vuelve a procesar.';renderBatch();saveState();continue;}task.status='processing';task.error='';renderBatch();saveState();try{const p=blankProject(task.topic,task.layoutFamily);p.fps=task.fps;p.sourceName=task.sourceName||'Fuente añadida en lote';p.sourceUrl=task.sourceUrl;p.sourceExcerpt=excerpt;state.projects.unshift(p);state.activeId=p.id;const raw=parseJSONResponse(await callProvider(makePrompt(p,p.sourceName,p.sourceUrl,excerpt),{temperature:.4}));applyAIProject(raw,p,p.sourceName,p.sourceUrl,excerpt);task.projectId=p.id;task.status='done';task.error='Creado como borrador; los datos siguen pendientes.';completed++;log('Lote generó borrador: '+p.topic);}catch(e){task.status='error';task.error=e.message.slice(0,180);}saveState();renderBatch();updateDashboard();}toast(`Cola procesada. Proyectos generados: ${completed}. Revisa los errores y los datos pendientes.`,'success');}finally{btn.disabled=false;renderBatch();renderHistory();syncEditor();}}
function openBatchTask(id){const t=state.batch.find(x=>x.id===id);if(!t)return;if(t.projectId&&state.projects.some(p=>p.id===t.projectId)){switchProject(t.projectId);setPage('editor');return;}state.editingBatchId=t.id;setPage('evidence');$('sourceUrl').value=t.sourceUrl||'';$('sourceName').value=t.sourceName||'';$('sourceExcerpt').value=t.excerpt||'';toast('Editando la fuente de esta tarea. Pega y revisa el extracto; después vuelve a Producción por lotes.');}
function downloadCSVTemplate(){const csv='topic,source_url,source_name,layoutFamily,fps,source_excerpt\n"Por qué el cielo parece azul",https://example.org/fuente,"Nombre de fuente",compare,30,"Pega aquí un extracto revisado de la fuente original"\n';dlText(csv,'plantilla-focoshorts.csv','text/csv;charset=utf-8');}
function serializeSpec(p){const palette=PALETTES[p.style.palette]||PALETTES.lavanda;let t=0;const scenes=p.scenes.map((s,i)=>{const start=t;t+=s.duration;return {id:s.id,start,duration:s.duration,kind:s.kind,beat:s.beat,factRefs:s.factRefs||[],elements:[...(s.headline?[{id:'headline',type:'text',content:s.headline}]:[]),...(s.subtitle?[{id:'subtitle',type:'text',content:s.subtitle}]:[])],transitionOut:s.transitionOut||'cut'};});const today=new Date().toISOString().slice(0,10);const events=[];let at=0;for(const sc of p.scenes){events.push({t:at,type:'pop',gain:.45,pitch:1});if(at+.35<p.durationSec)events.push({t:at+.35,type:'whoosh',gain:.3,pitch:1});at+=sc.duration;}return {schemaVersion:1,id:p.id,topic:p.topic,language:p.language||'es',durationSec:t,fps:p.fps,size:[1080,1920],style:{palette:{bg:palette.bg,text:palette.text,accent1:palette.a,accent2:palette.b},fonts:{display:'Inter',body:'Inter'},mood:p.style.mood||p.style.palette,layoutFamily:p.style.layoutFamily},hook:{text:p.hook.text,visual:p.hook.visual||'Animación vectorial con Canvas 2D',endSec:Math.min(3,+p.hook.endSec||3)},facts:p.facts.map(f=>({id:f.id,claim:f.claim,...(f.value!==null?{value:f.value}:{}),...(f.unit?{unit:f.unit}:{}),source:{name:f.sourceName||p.sourceName||'',url:f.sourceUrl||p.sourceUrl||'',accessed:today},evidence:{excerpt:f.excerpt||'',fetchedBy:f.aiGrounded?'google-search-grounding':'manual'},status:f.status,aiGrounded:!!f.aiGrounded})),scenes,sound:{master:.65,events},description:{title:p.description.title||p.topic,text:p.description.text||'',hashtags:p.description.hashtags||[],sourcesText:p.description.sourcesText||p.sourceUrl||''},_focoshorts:clone(p)};}
function exportProject(){const p=activeProject();if(!p)return;const validation=validateProject(p);if(validation.errors.length)toast('JSON exportado, pero revisa: '+validation.errors[0],'error');dlText(JSON.stringify(serializeSpec(p),null,2),fileSlug(p.topic)+'.json');log('Exportado JSON compatible con el esquema del documento: '+p.topic);} 
function exportEvidence(){const p=activeProject();if(!p)return;const report={title:p.topic,createdAt:new Date().toISOString(),source:{name:p.sourceName,url:p.sourceUrl},rules:'Los enlaces marcados como fuente enlazada proceden de Google Search grounding; eso no equivale a una revisión humana ni garantiza que la fuente respalde cada frase. La revisión humana solo cuenta cuando se abre y se aprueba expresamente la fuente.',facts:p.facts.map(f=>({id:f.id,claim:f.claim,value:f.value,unit:f.unit,sourceName:f.sourceName,sourceUrl:f.sourceUrl,evidenceExcerpt:f.excerpt,status:f.status,usedInScenes:p.scenes.filter(s=>(s.factRefs||[]).includes(f.id)).map(s=>s.id)})),validation:validateProject(p)};dlText(JSON.stringify(report,null,2),fileSlug(p.topic)+'-informe-evidencia.json');log('Exportado informe de evidencia.');}
function exportSRT(){const p=activeProject();if(!p)return;recalculate(p);const out=[];for(const sc of p.scenes){const sw=sceneWords(sc),chs=sceneChunks(sc,sw);chs.forEach((ids,k)=>{const st=sc.start+sw.times[ids[0]][0]+SUB_DELAY,nx=chs[k+1]?sc.start+sw.times[chs[k+1][0]][0]+SUB_DELAY:sc.start+sw.times[ids[ids.length-1]][1]+.4,en=Math.max(st+.2,Math.min(nx-.02,sc.start+sc.duration));out.push(String(out.length+1),`${srtTime(st)} --> ${srtTime(en)}`,ids.map(i=>sw.ws[i]).join(' ').replace(/[,;:.…]+$/,''),'');});}dlText(out.join('\n'),fileSlug(p.topic)+'.srt','text/plain;charset=utf-8');log('Exportados subtítulos SRT con tiempos de la voz.');}
function srtTime(s){const ms=Math.round((s-Math.floor(s))*1000),v=Math.floor(s);return `${String(Math.floor(v/3600)).padStart(2,'0')}:${String(Math.floor(v%3600/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')},${String(ms).padStart(3,'0')}`;}
function exportPNG(){const p=activeProject(),{s,i}=currentScene();if(!s)return;const c=document.createElement('canvas');c.width=1080;c.height=1920;drawFrame(c.getContext('2d'),s,state.preview.time-s.start,p,1080,1920);c.toBlob(blob=>{if(!blob){toast('No se pudo generar el PNG.','error');return;}dl(blob,fileSlug(p.topic)+'-escena-'+(i+1)+'.png');log('Exportado PNG de escena '+(i+1)+'.');},'image/png');}
function exportBackup(){const backup={app:'FocoShorts Studio',version:1,exportedAt:new Date().toISOString(),projects:state.projects.map(clone),batch:state.batch.map(clone),activity:state.activity.slice(0,80),quota:clone(state.quota)};dlText(JSON.stringify(backup,null,2),'focoshorts-biblioteca.json');log('Exportada copia completa de biblioteca.');}
function renderHistory(){const box=$('historyList');if(!box)return;$('libraryCount').textContent=`${state.projects.length} proyecto(s) guardado(s)`;$('historyEmpty').classList.toggle('hidden',state.projects.length>0);box.innerHTML=state.projects.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).map(p=>`<div class="history-row"><span class="history-symbol">✦</span><span class="history-copy"><b>${esc(p.topic)}</b><small>${p.scenes.length} escenas · ${p.durationSec}s · ${usedFacts(p).filter(f=>f.aiGrounded||f.status==='verified').length}/${usedFacts(p).length} datos con fuente enlazada/revisados<br>Última edición: ${esc(fmtDate(p.updatedAt||p.createdAt))}</small></span><button class="btn small" data-history-open="${esc(p.id)}">Abrir</button><button class="btn small" data-history-export="${esc(p.id)}">JSON ↓</button><button class="btn small danger" data-history-delete="${esc(p.id)}">Eliminar</button></div>`).join('');renderActivity();}
function renderActivity(){const box=$('activityList');if(!box)return;$('activityEmpty').classList.toggle('hidden',state.activity.length>0);box.innerHTML=state.activity.slice(0,30).map(a=>`<div class="history-row"><span class="history-symbol">◷</span><span class="history-copy"><b>${esc(a.message)}</b><small>${esc(fmtDate(a.at))}</small></span></div>`).join('');}
function removeProject(id){if(state.projects.length<=1){toast('Mantén al menos un proyecto en la biblioteca.','error');return;}const p=state.projects.find(x=>x.id===id);state.projects=state.projects.filter(x=>x.id!==id);if(state.activeId===id){state.activeId=state.projects[0].id;state.selectedScene=0;state.preview.time=0;syncEditor();}saveState();renderHistory();updateDashboard();log('Eliminado proyecto: '+(p?.topic||id));}
function startPlayback(){const p=activeProject();if(!p)return;if(state.preview.playing){state.preview.playing=false;cancelAnimationFrame(raf);renderPreview();return;}if(state.preview.time>=p.durationSec)state.preview.time=0;state.preview.playing=true;const base=performance.now()-state.preview.time*1000;const tick=now=>{if(!state.preview.playing)return;const cur=(now-base)/1000;if(cur>=p.durationSec){state.preview.time=p.durationSec;state.preview.playing=false;renderPreview();return;}state.preview.time=cur;renderPreview();raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);renderPreview();}
function gotoScene(direction){const {i}=currentScene();const p=activeProject();pickScene(Math.max(0,Math.min(p.scenes.length-1,i+direction)));}
function updateVideoProgress(percent,label){const wrap=$('videoProgress');wrap.classList.add('visible');$('videoProgressPct').textContent=Math.round(percent*100)+'%';$('videoProgressBar').style.width=Math.max(0,Math.min(1,percent))*100+'%';$('videoProgressLabel').textContent=label;}
function normalizeSfxBuffer(buffer,target=.74){
 let peak=0;for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>peak)peak=a;}}
 if(peak<1e-5)return buffer;const g=Math.min(8,target/peak);
 for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++)d[i]*=g;}
 return buffer;
}
async function loadSfxBank(audioCtx){
 if(window.__focoSfxBank)return window.__focoSfxBank;
 const bank={manifest:[],buffers:new Map()};
 try{
  const response=await fetch('assets/sfx/sfx.json',{cache:'no-cache'});
  if(response.ok){const data=await response.json();bank.manifest=Array.isArray(data.effects)?data.effects:[];}
 }catch{}
 await Promise.all(bank.manifest.map(async item=>{
  if(!item||!item.id||!item.file)return;
  try{const response=await fetch('assets/sfx/'+String(item.file).replace(/^\/+/,''));if(!response.ok)return;const bytes=await response.arrayBuffer();const decoded=await audioCtx.decodeAudioData(bytes);normalizeSfxBuffer(decoded,.74);bank.buffers.set(item.id,{buffer:decoded,volume:Number.isFinite(+item.volume)?Math.max(0,Math.min(1,+item.volume)):.25,tags:Array.isArray(item.tags)?item.tags:[]});}catch{}
 }));
 window.__focoSfxBank=bank;return bank;
}
function ensureAudioParamCompatibility(audioCtx){
 // Algunos navegadores móviles exponen AudioParam sin los métodos de rampa estándar.
 const param=audioCtx.createGain().gain,proto=Object.getPrototypeOf(param);
 if(typeof param.linearRampToValueAtTime!=='function' && !proto.__focoLinearRampFallback){
  try{Object.defineProperty(proto,'linearRampToValueAtTime',{configurable:true,value:function(value,time){return this.setValueAtTime(value,time);}});proto.__focoLinearRampFallback=true;}catch{}
 }
 if(typeof param.exponentialRampToValueAtTime!=='function' && !proto.__focoExpRampFallback){
  try{Object.defineProperty(proto,'exponentialRampToValueAtTime',{configurable:true,value:function(value,time){return this.setValueAtTime(value,time);}});proto.__focoExpRampFallback=true;}catch{}
 }
}
async function buildSoundtrack(audioCtx,destination,p,startAt){
 ensureAudioParamCompatibility(audioCtx);
 const bank=await loadSfxBank(audioCtx);
 const finalMix=audioCtx.createGain(),finalComp=audioCtx.createDynamicsCompressor();
 finalMix.gain.value=.92;finalComp.threshold.value=-2.5;finalComp.knee.value=4;finalComp.ratio.value=8;finalComp.attack.value=.003;finalComp.release.value=.15;finalMix.connect(finalComp);finalComp.connect(destination);
 const master=audioCtx.createGain(),masterComp=audioCtx.createDynamicsCompressor();
 master.gain.setValueAtTime(.0001,startAt);master.gain.linearRampToValueAtTime(.62,startAt+.7);master.gain.setValueAtTime(.62,Math.max(startAt+.8,startAt+p.durationSec-.65));master.gain.linearRampToValueAtTime(.0001,startAt+p.durationSec+.15);
 masterComp.threshold.value=-12;masterComp.knee.value=16;masterComp.ratio.value=3;masterComp.attack.value=.008;masterComp.release.value=.22;master.connect(masterComp);masterComp.connect(finalMix);
 const projectVoice=voiceBufferCache.get(p.id);
 if(projectVoice){
  const voice=audioCtx.createBufferSource(),voiceGain=audioCtx.createGain(),compressor=audioCtx.createDynamicsCompressor();
  voice.buffer=projectVoice;voice.playbackRate.setValueAtTime(1,startAt);voiceGain.gain.setValueAtTime(.0001,startAt);voiceGain.gain.linearRampToValueAtTime(.94,startAt+.035);voiceGain.gain.setValueAtTime(.94,Math.max(startAt+.05,startAt+projectVoice.duration-.12));voiceGain.gain.linearRampToValueAtTime(.0001,startAt+projectVoice.duration+.12);
  compressor.threshold.value=-20;compressor.knee.value=14;compressor.ratio.value=4;compressor.attack.value=.004;compressor.release.value=.18;
  voice.connect(voiceGain);voiceGain.connect(compressor);compressor.connect(finalMix);voice.start(startAt);
 }
 // Music bed is deliberately restrained so narration remains intelligible.
 const music=audioCtx.createGain();music.gain.setValueAtTime(.0001,startAt);music.gain.linearRampToValueAtTime(projectVoice ? .022 : .028,startAt+1.1);music.gain.setValueAtTime(projectVoice ? .022 : .028,Math.max(startAt+1.2,startAt+p.durationSec-1));music.gain.linearRampToValueAtTime(.0001,startAt+p.durationSec+.2);music.connect(master);
 const padFilter=audioCtx.createBiquadFilter();padFilter.type='lowpass';padFilter.frequency.value=1050;padFilter.connect(music);
 [[130.81,.024,'sine'],[164.81,.017,'triangle'],[196,.012,'sine'],[261.63,.006,'triangle']].forEach(([hz,vol,type],i)=>{
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=hz;o.detune.value=i%2?3:-2;g.gain.setValueAtTime(.0001,startAt);g.gain.linearRampToValueAtTime(vol,startAt+1.1);g.gain.setValueAtTime(vol,Math.max(startAt+1.2,startAt+p.durationSec-1));g.gain.exponentialRampToValueAtTime(.0001,startAt+p.durationSec+.25);o.connect(g);g.connect(padFilter);o.start(startAt);o.stop(startAt+p.durationSec+.3);
 });
 // No repetitive synthetic melody: the quiet pad stays behind speech instead of sounding like a ringtone.
 const noise=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.65),audioCtx.sampleRate),data=noise.getChannelData(0);
 for(let i=0;i<data.length;i++){const fade=Math.pow(1-i/data.length,1.25);data[i]=(Math.random()*2-1)*fade;}
 const fxGain=audioCtx.createGain();fxGain.gain.value=.92;fxGain.connect(finalMix);
 function whoosh(when,duration=.34,intensity=.052){if(when<startAt-.01||when>startAt+p.durationSec)return;const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),g=audioCtx.createGain();src.buffer=noise;filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(220,when);filter.frequency.exponentialRampToValueAtTime(4200,when+duration*.68);filter.frequency.exponentialRampToValueAtTime(750,when+duration);g.gain.setValueAtTime(.0001,when);g.gain.linearRampToValueAtTime(intensity,when+duration*.28);g.gain.exponentialRampToValueAtTime(.0001,when+duration);src.connect(filter);filter.connect(g);g.connect(fxGain);src.start(when);src.stop(when+duration+.02);}
 function impact(when,intensity=.052){if(when<startAt-.01||when>startAt+p.durationSec)return;const osc=audioCtx.createOscillator(),g=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();osc.type='sine';osc.frequency.setValueAtTime(118,when);osc.frequency.exponentialRampToValueAtTime(42,when+.2);filter.type='lowpass';filter.frequency.value=360;g.gain.setValueAtTime(.0001,when);g.gain.linearRampToValueAtTime(intensity,when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+.23);osc.connect(filter);filter.connect(g);g.connect(fxGain);osc.start(when);osc.stop(when+.24);}
 function pop(when,frequency=650,intensity=.032){if(when<startAt-.01||when>startAt+p.durationSec)return;const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(frequency,when);osc.frequency.exponentialRampToValueAtTime(Math.max(220,frequency*.58),when+.09);g.gain.setValueAtTime(.0001,when);g.gain.linearRampToValueAtTime(intensity,when+.009);g.gain.exponentialRampToValueAtTime(.0001,when+.15);osc.connect(g);g.connect(fxGain);osc.start(when);osc.stop(when+.16);}
 function riser(when,d=.42){if(when<startAt||when>startAt+p.durationSec)return;const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();src.buffer=noise;f.type='highpass';f.frequency.setValueAtTime(360,when);f.frequency.exponentialRampToValueAtTime(4800,when+d);g.gain.setValueAtTime(.0001,when);g.gain.linearRampToValueAtTime(.032,when+d);g.gain.exponentialRampToValueAtTime(.0001,when+d+.04);src.connect(f);f.connect(g);g.connect(fxGain);src.start(when);src.stop(when+d+.08);}
 function ding(when,fr=1318.5,v=.026){if(when<startAt||when>startAt+p.durationSec)return;[1,2.01].forEach((m,k)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=fr*m;g.gain.setValueAtTime(.0001,when);g.gain.linearRampToValueAtTime(v/(k+1),when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+.36);o.connect(g);g.connect(fxGain);o.start(when);o.stop(when+.38);});}
 function playBank(id,when,gain=1){const item=bank.buffers.get(id);if(!item||when<startAt||when>startAt+p.durationSec)return false;const src=audioCtx.createBufferSource(),g=audioCtx.createGain();src.buffer=item.buffer;g.gain.value=Math.max(0,Math.min(.88,item.volume*gain*2.4));src.connect(g);g.connect(fxGain);src.start(when);return true;}
 // Curated sound design: one intentional accent at a time; never carpet-bomb every cut.
 const events=Array.isArray(p.sound?.events)?p.sound.events:[];
 const used=new Set(),scheduledTimes=[];
 function eventFx(type,when,gain=.8){
  if(Number.isFinite(when))scheduledTimes.push(when-startAt);
  const id=String(type||'').toLowerCase();
  const realMap={whoosh:['real_whoosh','real_swish','whoosh','swish'],swish:['real_swish','real_whoosh','whoosh'],zoom:['real_zoom_transition','real_whoosh','whoosh'],funny_slide:['funny_slide','pop'],mouse_click:['real_mouse_click','click'],sword_swish:['sword_swish','real_swish'],impact:['impact','hit','boom'],pop:['pop','click'],riser:['riser','suspense_riser'],ding:['ding','sparkle'],gasp:['gasp','surprise']};
  const candidates=realMap[id]||[id];for(const candidate of candidates){if(playBank(candidate,when,gain))return;}
  if(id==='whoosh'||id==='swish'||id==='zoom')whoosh(when,.28,.052*gain);
  else if(['impact','hit','boom','reveal'].includes(id))impact(when,.052*gain);
  else if(['riser','suspense_riser','tension'].includes(id))riser(when,.45);
  else if(['ding','sparkle','fact'].includes(id))ding(when,1318.5,.026*gain);
  else if(['gasp','surprise'].includes(id))pop(when,880,.027*gain);
  else if(id==='mouse_click')pop(when,720,.027*gain);
  else pop(when,640,.024*gain);
 }
 const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 // A single opening swish establishes the visual language; no stacked boom+pop over the first words.
 if(String(p.scenes[0]?.sfxCue||'auto')!=='none')eventFx('whoosh',startAt+.06,.46);
 let transitionSounds=0,lastAccent=-99;
 let cursor=0;
 p.scenes.forEach((scene,i)=>{
  const start=cursor,finish=cursor+(+scene.duration||0);cursor=finish;
  const text=norm([scene.beat,scene.headline,scene.subtitle,scene.narration].join(' '));
  if(i>0&&String(scene.sfxCue||'auto')!=='none'){
   const previous=p.scenes[i-1],transition=String(previous.transitionOut||'cut');
   const at=startAt+Math.max(0,start-.12);
   if(transitionSounds<4&&transition==='wipe'){eventFx('whoosh',at,.46);transitionSounds++;lastAccent=start;}
   else if(transitionSounds<4&&transition==='zoom'){eventFx('zoom',at,.42);transitionSounds++;lastAccent=start;}
   else if(transitionSounds<4&&transition==='cut'&&i%2===1){eventFx('whoosh',at,.24);transitionSounds++;lastAccent=start;}
   else if(transitionSounds<3&&transition==='fade'&&i===p.scenes.length-1){eventFx('whoosh',at,.3);transitionSounds++;lastAccent=start;}
  }
  // Manual cue wins. Auto mode adds at most one restrained accent when it supports meaning.
  const cue=String(scene.sfxCue||'auto'),cueGain=Math.max(0,Math.min(1,Number.isFinite(+scene.sfxGain)?+scene.sfxGain:.35));
  if(cue!=='none'&&cue!=='auto'&&cueGain>0){eventFx(cue,startAt+start+.12,cueGain);lastAccent=start+.35;}
  else if(cue==='auto'&&i>0&&start-lastAccent>1.25){
   if(/\b(miedo|peligro|amenaza|muerte|desaparec|fantasma|terror)\b/.test(text)){eventFx('riser',startAt+start+Math.min(1.0,(+scene.duration||6)*.18),.24*cueGain/.35);lastAccent=start+1.1;}
   else if(/\b(gracioso|chiste|broma|ridiculo|ridícula|vergonzoso|absurdo)\b/.test(text)&&p.tone==='ligero'){eventFx('funny_slide',startAt+start+.35,.28*cueGain/.35);lastAccent=start+.5;}
   else if(/\b(descubre|secreto|sorprend|increible|increíble|resulta que|nadie esperaba|inesperado|mente)\b/.test(text)){eventFx('impact',startAt+start+.16,.24*cueGain/.35);lastAccent=start+.5;}
   else if(/\b(dato|cifra|por ciento|\d+%|millones|kilometros|kilómetros|récord|record)\b/.test(text)){eventFx('ding',startAt+start+.2,.20*cueGain/.35);lastAccent=start+.5;}
   else if(/\b(espada|caballero|combate|corte con)\b/.test(text)){eventFx('sword_swish',startAt+start+.22,.20*cueGain/.35);lastAccent=start+.5;}
  }
 });
 // Only the two deliberate cursor clicks at the final CTA; these use the supplied mouse-click recording.
 if(p.durationSec>CTA_LEN+.5){eventFx('mouse_click',startAt+p.durationSec-CTA_LIKE_REMAIN,.60);eventFx('mouse_click',startAt+p.durationSec-CTA_BELL_REMAIN,.60);eventFx('ding',startAt+p.durationSec-CTA_BELL_REMAIN+.06,.30);}
 // Honor explicitly authored events only if they are not duplicates of a scheduled accent.
 events.slice(0,24).forEach(ev=>{const t=Number(ev.t);if(!Number.isFinite(t)||t<0||t>p.durationSec||scheduledTimes.some(at=>Math.abs(at-t)<.75))return;const key=`${ev.type}:${Math.round(t*10)}`;if(used.has(key))return;used.add(key);eventFx(ev.type,startAt+t,Number.isFinite(+ev.gain)?Math.min(.4,+ev.gain):.28);});
}
async function scheduleLongSegmentSfx(audioCtx,destination,startAt,total,narration){
 const bank=await loadSfxBank(audioCtx);startAt=Math.max(startAt,audioCtx.currentTime+.12);const bus=audioCtx.createGain();bus.gain.value=.42;bus.connect(destination);
 const play=(id,t,gain=.65)=>{
  if(t<0||t>total)return;
  const choices=({whoosh:['whoosh','swish'],impact:['impact','hit','boom'],pop:['pop','click'],ding:['ding','sparkle'],riser:['riser','suspense_riser']})[id]||[id];
  for(const key of choices){const item=bank.buffers.get(key);if(item){const src=audioCtx.createBufferSource(),g=audioCtx.createGain();src.buffer=item.buffer;g.gain.value=Math.max(0,Math.min(1,item.volume*gain));src.connect(g);g.connect(bus);src.start(startAt+t);return;}}
  const when=startAt+t,o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
  if(id==='whoosh'||id==='riser'){const b=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.4),audioCtx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const src=audioCtx.createBufferSource();src.buffer=b;f.type=id==='riser'?'highpass':'bandpass';f.frequency.setValueAtTime(350,when);f.frequency.exponentialRampToValueAtTime(id==='riser'?4300:2600,when+.3);g.gain.setValueAtTime(.0001,when);g.gain.linearRampToValueAtTime(.035*gain,when+.18);g.gain.exponentialRampToValueAtTime(.0001,when+.4);src.connect(f);f.connect(g);g.connect(bus);src.start(when);src.stop(when+.42);return;}
  o.type='sine';o.frequency.setValueAtTime(id==='impact'?105:id==='ding'?1046:680,when);o.frequency.exponentialRampToValueAtTime(id==='impact'?45:Math.max(240,(id==='ding'?1046:680)*.65),when+.12);g.gain.setValueAtTime(.0001,when);g.gain.linearRampToValueAtTime((id==='impact'?.045:.024)*gain,when+.01);g.gain.exponentialRampToValueAtTime(.0001,when+.18);o.connect(f);f.type='lowpass';f.frequency.value=id==='impact'?380:2600;f.connect(g);g.connect(bus);o.start(when);o.stop(when+.2);
 };
 play('whoosh',.08,.7);play('impact',.24,.55);
 const text=String(narration||'').toLowerCase();
 if(/\b(revela|descubre|secreto|sorprend|increíble|increible|nunca|pero)\b/.test(text))play('impact',Math.min(total*.42,Math.max(1.2,total*.28)),.6);
 else if(/\b(dato|cifra|por ciento|%|millones|kilómetros|km)\b/.test(text))play('ding',Math.min(total*.45,Math.max(1.4,total*.34)),.5);
 if(total>5)play('whoosh',total*.58,.45);
 play('ding',Math.max(.1,total-.28),.38);
}
/* ===== v19 · Exportación MP4 real (WebCodecs + muxer propio) =====
   Renderiza fotograma a fotograma con marcas de tiempo exactas (no depende de la velocidad del teléfono),
   mezcla el audio fuera de línea y empaqueta H.264 + AAC en un MP4 con duración correcta. */
function canExportMp4WebCodecs(){return !!(window.VideoEncoder&&window.AudioEncoder&&window.VideoFrame&&window.AudioData&&window.OfflineAudioContext&&window.Mp4Muxer);}
function yieldNow(){return new Promise(r=>{const ch=new MessageChannel();ch.port1.onmessage=()=>{r();ch.port1.close();};ch.port2.postMessage(0);});}
function descToBytes(d){if(!d)return null;if(d instanceof ArrayBuffer)return new Uint8Array(d.slice(0));return new Uint8Array(d.buffer.slice(d.byteOffset,d.byteOffset+d.byteLength));}
async function pickVideoEncoderConfig(fps){
 const sizes=[[1080,1920,6e6],[720,1280,3.5e6]];
 const codecs=['avc1.640029','avc1.4D0029','avc1.42E029','avc1.640028','avc1.4D0028','avc1.42E01F'];
 for(const [W,H,bitrate] of sizes){for(const codec of codecs){const cfg={codec,width:W,height:H,bitrate,framerate:fps,avc:{format:'avc'},latencyMode:'quality'};try{const r=await VideoEncoder.isConfigSupported(cfg);if(r&&r.supported)return cfg;}catch{}}}
 return null;
}
async function pickAudioEncoderConfig(sr){
 for(const c of [{codec:'mp4a.40.2',kind:'aac'},{codec:'opus',kind:'opus'}]){const cfg={codec:c.codec,sampleRate:sr,numberOfChannels:2,bitrate:128000};try{const r=await AudioEncoder.isConfigSupported(cfg);if(r&&r.supported)return {cfg,kind:c.kind};}catch{}}
 return null;
}
async function renderProjectAudioOffline(p,sr){
 const ctx=new OfflineAudioContext(2,Math.ceil((p.durationSec+.5)*sr),sr);
 await buildSoundtrack(ctx,ctx.destination,p,0);
 return await ctx.startRendering();
}
function verifyMp4Blob(blob,expected){
 return new Promise(resolve=>{
  const v=document.createElement('video'),url=URL.createObjectURL(blob);let settled=false;
  const end=r=>{if(settled)return;settled=true;clearTimeout(timer);v.removeAttribute('src');try{v.load();}catch{}URL.revokeObjectURL(url);resolve(r);};
  const timer=setTimeout(()=>end({ok:true,unknown:true}),6000);
  v.preload='metadata';v.muted=true;v.playsInline=true;
  v.onloadedmetadata=()=>end({ok:Number.isFinite(v.duration)&&Math.abs(v.duration-expected)<1.5,duration:v.duration});
  v.onerror=()=>end({ok:false,error:v.error&&v.error.message});
  v.src=url;
 });
}
async function exportMp4WebCodecs(p,automatic){
 if(!canExportMp4WebCodecs())return false;
 const btn=$('exportVideo'),old=btn.textContent,fps=30,sr=48000;let vEnc=null,aEnc=null;
 const restore=()=>{btn.disabled=false;btn.textContent=old;$('videoProgress').classList.remove('visible');};
 try{
  btn.disabled=true;btn.textContent='Preparando MP4…';state.preview.playing=false;cancelAnimationFrame(raf);
  updateVideoProgress(0,'Verificando y precargando fotografías…');await ensureProjectImagesReady(p,true);
  const vcfg=await pickVideoEncoderConfig(fps);if(!vcfg)throw new Error('Este dispositivo no ofrece codificador H.264.');
  const au=await pickAudioEncoderConfig(sr);if(!au)throw new Error('Este dispositivo no ofrece codificador de audio AAC/Opus.');
  const W=vcfg.width,H=vcfg.height;
  if(!automatic)toast(`Exportando MP4 ${W}×${H} a ${fps} FPS. Mantén esta pestaña visible hasta que termine.`,'success');
  updateVideoProgress(0,'Mezclando voz, música y efectos…');
  const audioBuf=await renderProjectAudioOffline(p,sr);
  const vChunks=[],aChunks=[];let vDesc=null,aDesc=null,encErr=null;
  vEnc=new VideoEncoder({output:(chunk,meta)=>{const d=new Uint8Array(chunk.byteLength);chunk.copyTo(d);vChunks.push({d,ts:chunk.timestamp,dur:chunk.duration,key:chunk.type==='key'});if(!vDesc&&meta&&meta.decoderConfig&&meta.decoderConfig.description)vDesc=descToBytes(meta.decoderConfig.description);},error:e=>{encErr=e;}});
  aEnc=new AudioEncoder({output:(chunk,meta)=>{const d=new Uint8Array(chunk.byteLength);chunk.copyTo(d);aChunks.push({d,ts:chunk.timestamp,dur:chunk.duration});if(!aDesc&&meta&&meta.decoderConfig&&meta.decoderConfig.description)aDesc=descToBytes(meta.decoderConfig.description);},error:e=>{encErr=e;}});
  vEnc.configure(vcfg);aEnc.configure(au.cfg);
  const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d',{alpha:false});if(!ctx)throw new Error('No se pudo crear el lienzo de exportación.');
  const total=Math.max(1,Math.round(p.durationSec*fps)),frameDur=Math.round(1e6/fps);
  for(let i=0;i<total;i++){
   if(encErr)throw encErr;
   const {s,local}=sceneAt(p,Math.min(i/fps,Math.max(0,p.durationSec-1e-6)));
   drawFrame(ctx,s,local,p,W,H);
   const frame=new VideoFrame(c,{timestamp:Math.round(i*1e6/fps),duration:frameDur});
   vEnc.encode(frame,{keyFrame:i%fps===0});frame.close();
   while(vEnc.encodeQueueSize>6){await yieldNow();if(encErr)throw encErr;}
   if(i%5===0){updateVideoProgress(.88*i/total,`Renderizando ${timeFmt(i/fps)} de ${timeFmt(p.durationSec)}…`);await yieldNow();}
  }
  updateVideoProgress(.9,'Codificando audio…');
  const n=Math.min(audioBuf.length,Math.round(p.durationSec*sr)),ch0=audioBuf.getChannelData(0),ch1=audioBuf.numberOfChannels>1?audioBuf.getChannelData(1):ch0,step=sr>>1;
  for(let off=0;off<n;off+=step){
   if(encErr)throw encErr;
   const len=Math.min(step,n-off),data=new Float32Array(len*2);data.set(ch0.subarray(off,off+len),0);data.set(ch1.subarray(off,off+len),len);
   const ad=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:len,numberOfChannels:2,timestamp:Math.round(off*1e6/sr),data});
   aEnc.encode(ad);ad.close();
   while(aEnc.encodeQueueSize>8){await yieldNow();if(encErr)throw encErr;}
  }
  updateVideoProgress(.95,'Finalizando archivo…');
  await vEnc.flush();await aEnc.flush();if(encErr)throw encErr;
  vEnc.close();aEnc.close();vEnc=aEnc=null;
  if(!vChunks.length)throw new Error('El codificador no produjo fotogramas.');
  if(!vDesc)throw new Error('El codificador H.264 no entregó su configuración (avcC).');
  for(let i=1;i<vChunks.length;i++)if(vChunks[i].ts<vChunks[i-1].ts)throw new Error('El codificador reordenó fotogramas (B-frames).');
  const audioOpts=au.kind==='aac'?{codec:'aac',sampleRate:sr,channels:2,description:aDesc||Uint8Array.from([0x11,0x90])}:{codec:'opus',sampleRate:sr,channels:2,preSkip:aDesc&&aDesc.length>=12?(aDesc[10]|(aDesc[11]<<8)):312};
  const mux=new Mp4Muxer({width:W,height:H,video:{description:vDesc},audio:aChunks.length?audioOpts:null});
  vChunks.forEach(f=>mux.addVideo(f.d,f.ts,f.dur,f.key));aChunks.forEach(f=>mux.addAudio(f.d,f.ts,f.dur));
  const blob=mux.finalize();
  const check=await verifyMp4Blob(blob,p.durationSec);
  if(!check.ok)throw new Error('El MP4 generado no se pudo leer correctamente en este navegador'+(check.duration!==undefined?` (duración detectada: ${check.duration})`:'')+'.');
  dl(blob,fileSlug(p.topic)+'.mp4');restore();state.preview.time=0;renderPreview();
  log(`Video MP4 exportado (${W}×${H}, ${fps} FPS, ${p.durationSec}s, H.264 + ${au.kind==='aac'?'AAC':'Opus'}, ${(blob.size/1048576).toFixed(1)} MB).`);
  toast(`MP4 descargado · ${W}×${H} · ${Math.round(p.durationSec)} s exactos con ${au.kind==='aac'?'AAC':'Opus'}. Ya debería abrirse en Galería, TikTok y YouTube.`,'success');
  return true;
 }catch(e){
  console.warn('Exportación MP4 directa no disponible:',e);
  try{if(vEnc&&vEnc.state!=='closed')vEnc.close();}catch{}try{if(aEnc&&aEnc.state!=='closed')aEnc.close();}catch{}
  restore();
  toast('No se pudo crear el MP4 directo ('+String(e&&e.message||e).slice(0,140)+'). Uso el método alternativo (WebM con duración corregida).','error');
  return false;
 }
}
async function exportVideoRecording(automatic=false){
 const p=activeProject();if(!p)return;const check=validateProject(p,true);if(check.errors.length){toast(check.errors[0],'error');setPage(check.errors.some(x=>x.includes('verificar'))?'evidence':'editor');return;}if(check.warnings.length&&!automatic&&typeof window.confirm==='function'&&!window.confirm('Revisión antes de exportar:\n\n'+check.warnings.slice(0,8).map(x=>'• '+x).join('\n')+(check.warnings.length>8?'\n• … y '+(check.warnings.length-8)+' aviso(s) más':'')+'\n\n¿Quieres exportar de todos modos?'))return;if(!usedFacts(p).length){toast('Asocia al menos un dato del banco a una escena antes de exportar.','error');return;}if(p.fullNarration&&!voiceBufferCache.has(p.id)){toast('Falta una pista de narración exportable. La voz del navegador solo se puede escuchar en la página; pulsa “Regenerar voz IA” para crear audio que pueda entrar al vídeo.','error');return;}const canWC=canExportMp4WebCodecs();if(!canWC&&(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)){toast('Este navegador no permite exportar vídeo. Prueba Chrome actualizado o Edge.','error');return;}if(recorder&&recorder.state==='recording'){toast('Ya hay una grabación en curso.','error');return;}
 if(canWC&&await exportMp4WebCodecs(p,automatic))return;
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('Este navegador no permite grabar el Canvas. Prueba Chrome actualizado o Edge.','error');return;}
 const btn=$('exportVideo'),old=btn.textContent;btn.disabled=true;btn.textContent='Preparando…';state.preview.playing=false;cancelAnimationFrame(raf);const W=1080,H=1920,fps=30;const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d',{alpha:false,desynchronized:true});if(!ctx){btn.disabled=false;btn.textContent=old;toast('No se pudo crear un contexto Canvas.','error');return;}const videoStream=c.captureStream(fps);let audioCtx=null,audioStream=null,hasAudio=false,audioStart=0;
 try{updateVideoProgress(0,'Verificando y precargando fotografías…');await ensureProjectImagesReady(p,true);const AudioCtx=window.AudioContext||window.webkitAudioContext;if(AudioCtx){audioCtx=window.__focoPreparedAudioContext||new AudioCtx();window.__focoPreparedAudioContext=null;await audioCtx.resume().catch(()=>{});await loadSfxBank(audioCtx);const dest=audioCtx.createMediaStreamDestination();audioStream=dest.stream;const track=audioStream.getAudioTracks()[0];if(track){videoStream.addTrack(track);hasAudio=true;audioStart=audioCtx.currentTime+.3;await buildSoundtrack(audioCtx,dest,p,audioStart);}}
 const preferred=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4'];const mime=preferred.find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error('Este navegador no ofrece un formato de grabación compatible.');recordChunks=[];recorder=new MediaRecorder(videoStream,{mimeType:mime,videoBitsPerSecond:5200000,audioBitsPerSecond:128000});const outputMime=recorder.mimeType||mime;let ended=false;
 const finish=async()=>{if(ended)return;ended=true;let blob=new Blob(recordChunks,{type:outputMime});const ext=outputMime.includes('mp4')?'mp4':'webm';if(ext==='webm'&&window.fixWebmDuration)blob=await window.fixWebmDuration(blob,p.durationSec*1000);dl(blob,fileSlug(p.topic)+'.'+ext);btn.disabled=false;btn.textContent=old;$('videoProgress').classList.remove('visible');videoStream.getTracks().forEach(t=>t.stop());if(audioCtx)audioCtx.close().catch(()=>{});state.preview.time=0;renderPreview();log(`Video exportado (${W}×${H}, 30 FPS, ${p.durationSec}s, ${ext.toUpperCase()}).`);toast(`Video descargado en ${ext.toUpperCase()} · 1080×1920, banda sonora y efectos. Reprodúcelo antes de publicarlo.`,'success');};
 recorder.ondataavailable=e=>{if(e.data&&e.data.size)recordChunks.push(e.data);};recorder.onerror=()=>{if(!ended){ended=true;try{recorder.stop();}catch{}btn.disabled=false;btn.textContent=old;$('videoProgress').classList.remove('visible');videoStream.getTracks().forEach(t=>t.stop());if(audioCtx)audioCtx.close().catch(()=>{});toast('La grabación falló. Prueba de nuevo con la pestaña en primer plano.','error');}};recorder.onstop=finish;
 const start=performance.now();let lastDraw=-1000,lastProgressUpdate=0;recorder.start(1000);updateVideoProgress(0,'Renderizando a 1080×1920 · mantén esta pestaña abierta');const frameMs=1000/fps;const draw=now=>{if(!recorder||recorder.state!=='recording')return;if(now-lastDraw<frameMs-1){requestAnimationFrame(draw);return;}lastDraw=now;const t=hasAudio&&audioCtx?Math.max(0,audioCtx.currentTime-audioStart):(now-start)/1000;if(t>=p.durationSec){const last=p.scenes[p.scenes.length-1];drawFrame(ctx,last,last.duration,p,W,H);updateVideoProgress(1,'Finalizando archivo…');recorder.stop();return;}const {s,local}=sceneAt(p,t);drawFrame(ctx,s,local,p,W,H);if(now-lastProgressUpdate>250){updateVideoProgress(t/p.durationSec,`Renderizando ${timeFmt(t)} de ${timeFmt(p.durationSec)}…`);lastProgressUpdate=now;}requestAnimationFrame(draw);};const {s,local}=sceneAt(p,0);drawFrame(ctx,s,local,p,W,H);requestAnimationFrame(draw);state.preview.time=0;if(!automatic)toast(`Exportación iniciada · 1080×1920 / 30 FPS. Mantén la pestaña visible hasta que termine.`,'success');
 }catch(e){btn.disabled=false;btn.textContent=old;$('videoProgress').classList.remove('visible');videoStream.getTracks().forEach(t=>t.stop());if(audioCtx)audioCtx.close().catch(()=>{});toast('No se pudo exportar: '+e.message,'error');}}
function sceneAt(p,t){let at=0;for(let i=0;i<p.scenes.length;i++){const s=p.scenes[i];if(t<at+s.duration||i===p.scenes.length-1)return {s,i,local:Math.max(0,Math.min(s.duration,t-at))};at+=s.duration;}return {s:p.scenes[0],i:0,local:0};}
function syncBatchTaskField(field,value){if(!state.editingBatchId)return false;const task=state.batch.find(x=>x.id===state.editingBatchId);if(!task)return false;task[field]=value;if(task.status!=='done')task.status='queued';task.error='';saveState();renderBatch();updateDashboard();return true;}
function syncSourcePanel(){if(state.editingBatchId){syncBatchTaskField('sourceName',$('sourceName').value.trim());syncBatchTaskField('sourceUrl',$('sourceUrl').value.trim());syncBatchTaskField('excerpt',$('sourceExcerpt').value);return;}const p=activeProject(),f=p?.facts.find(x=>x.id===state.selectedFact);if(!p)return;const name=$('sourceName').value.trim(),url=$('sourceUrl').value.trim(),excerpt=$('sourceExcerpt').value;p.sourceName=name;p.sourceUrl=url;p.sourceExcerpt=excerpt;if(f){f.sourceName=name;f.sourceUrl=url;f.excerpt=excerpt;if(f.status==='verified')f.status='pending';updateFactBadge(f);}saveState();updateDashboard();}
function updateFactBadge(f){const title=document.querySelector(`[data-fact-card="${CSS.escape(f.id)}"] .fact-title small`);if(title)title.textContent=(f.aiGrounded?'↗ FUENTE ENLAZADA':f.status==='verified'?'✓ REVISADO':f.status==='rejected'?'✕ RECHAZADO':'◷ PENDIENTE')+' · '+(f.sourceName||'Sin fuente');}
function attachSourceEvents(){
 $('sourceExcerpt').addEventListener('input',()=>{if(syncBatchTaskField('excerpt',$('sourceExcerpt').value))return;const f=activeProject()?.facts.find(x=>x.id===state.selectedFact);if(f){f.excerpt=$('sourceExcerpt').value;if(f.status==='verified')f.status='pending';updateFactBadge(f);}const p=activeProject();if(p){p.sourceExcerpt=$('sourceExcerpt').value;saveState();}});
 $('sourceName').addEventListener('input',()=>{if(syncBatchTaskField('sourceName',$('sourceName').value.trim()))return;const f=activeProject()?.facts.find(x=>x.id===state.selectedFact);if(f){f.sourceName=$('sourceName').value;if(f.status==='verified')f.status='pending';updateFactBadge(f);}const p=activeProject();if(p){p.sourceName=$('sourceName').value;saveState();}});
 $('sourceUrl').addEventListener('input',()=>{if(syncBatchTaskField('sourceUrl',$('sourceUrl').value.trim()))return;const f=activeProject()?.facts.find(x=>x.id===state.selectedFact);if(f){f.sourceUrl=$('sourceUrl').value;if(f.status==='verified')f.status='pending';updateFactBadge(f);}const p=activeProject();if(p){p.sourceUrl=$('sourceUrl').value;saveState();}});
}
function wireEvents(){
 document.querySelectorAll('.nav-btn[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
 document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.goto)));
 $('mobileMenu').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('scrim').classList.toggle('visible');});$('scrim').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('scrim').classList.remove('visible');});attachLongVideoEvents();
 const showNew=()=>{$('newTopic').value='';if($('newModal').showModal)$('newModal').showModal();else{const topic=prompt('Tema del nuevo Short:','Mi nuevo Short');if(topic)makeNewProject(topic,'question');}};
 document.querySelectorAll('[data-content-category]').forEach(btn=>btn.addEventListener('click',()=>{selectedContentCategory=btn.dataset.contentCategory in CONTENT_CATEGORIES?btn.dataset.contentCategory:'differences';document.querySelectorAll('[data-content-category]').forEach(b=>{const active=b.dataset.contentCategory===selectedContentCategory;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});const label=CONTENT_CATEGORIES[selectedContentCategory].label;$('contentFilterStatus').textContent='Seleccionado: '+label+'. El botón de generar usará este formato.';log('Formato de contenido seleccionado: '+label);}));
 $('topNew').addEventListener('click',()=>generateRandomShort(true));$('dashStart').addEventListener('click',()=>generateRandomShort(true));$('historyNew').addEventListener('click',showNew);
 $('newForm').addEventListener('submit',e=>{if(e.submitter?.id==='createProject'){e.preventDefault();const topic=$('newTopic').value.trim();if(!topic)return;const layout=$('newLayout').value;$('newModal').close();makeNewProject(topic,layout);}});
 ['heroEdit'].forEach(id=>$(id).addEventListener('click',()=>setPage('editor')));$('heroEvidence').addEventListener('click',()=>setPage('evidence'));
 $('topic').addEventListener('input',()=>{const p=activeProject(),oldTopic=p.topic;p.topic=$('topic').value.slice(0,80);if(!p.description.title||p.description.title===oldTopic){p.description.title=p.topic;$('descTitle').value=p.topic;}touch();renderPreview();});
 $('hook').addEventListener('input',()=>{const p=activeProject();p.hook.text=$('hook').value;$('hookCount').textContent=`${words(p.hook.text).length} de 8 palabras · primeros 3 segundos`;$('hookCount').style.color=words(p.hook.text)>8?'#b94b67':'';touch();});
 $('targetDuration').addEventListener('change',applyDurationTarget);$('fps').addEventListener('change',()=>{activeProject().fps=+$('fps').value;touch();});$('language').addEventListener('change',()=>{activeProject().language=$('language').value;touch();});$('mood').addEventListener('change',()=>{activeProject().style.palette=$('mood').value;touch();renderPreview();});
 $('layoutPills').addEventListener('click',e=>{const b=e.target.closest('[data-layout]');if(b)switchLayout(b.dataset.layout);});
 $('descTitle').addEventListener('input',()=>{activeProject().description.title=$('descTitle').value;touch();});$('descText').addEventListener('input',()=>{activeProject().description.text=$('descText').value;touch();});$('hashtags').addEventListener('input',()=>{activeProject().description.hashtags=$('hashtags').value.split(/\s+/).filter(Boolean);touch();});
 $('sceneList').addEventListener('click',e=>{const b=e.target.closest('[data-scene-index]');if(b)pickScene(+b.dataset.sceneIndex);});$('sceneImagesEditor').addEventListener('click',e=>{const search=e.target.closest('[data-image-search]'),upload=e.target.closest('[data-image-upload]'),remove=e.target.closest('[data-image-remove]'),both=e.target.closest('#searchRelatedBoth');if(search){openRelatedSearch(+search.dataset.imageSearch);return;}if(upload){pendingUploadSlot=+upload.dataset.imageUpload;$('sceneImageFile').click();return;}if(remove){const p=activeProject(),scene=p?.scenes[state.selectedScene],slot=+remove.dataset.imageRemove;if(scene){const arr=Array.isArray(scene.images)?scene.images.slice(0,2):[null,null];while(arr.length<2)arr.push(null);arr[slot]=null;scene.images=arr;updateImageAttributions(p);touch();renderSceneImagesEditor();renderPreview();}return;}if(both){refreshSelectedSceneImages();return;}});$('sceneImageFile').addEventListener('change',e=>{uploadPhotoToSlot(e.target.files?.[0],pendingUploadSlot);e.target.value='';});$('relatedSearchForm').addEventListener('submit',e=>{e.preventDefault();searchRelatedForSlot($('relatedQuery').value.trim());});$('uploadDownloadedFromSearch').addEventListener('click',()=>{pendingUploadSlot=imageSearchState.slot;$('imageSearchModal').close();$('sceneImageFile').click();});$('imageSearchResults').addEventListener('click',e=>{const use=e.target.closest('[data-use-related]');if(use)useRelatedResult(+use.dataset.useRelated);});$('closeImageSearch').addEventListener('click',()=> $('imageSearchModal').close());$('cancelImageSearch').addEventListener('click',()=> $('imageSearchModal').close());$('relatedQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchRelatedForSlot($('relatedQuery').value.trim());}});['sceneBeat','sceneHeadline','sceneSubtitle','sceneNarration','sceneDuration','sceneKind','sceneFact'].forEach(id=>$(id).addEventListener(id==='sceneKind'||id==='sceneFact'||id==='sceneDuration'?'change':'input',saveSceneFields));$('addScene').addEventListener('click',addScene);$('deleteScene').addEventListener('click',deleteScene);if($('timelineTransition'))$('timelineTransition').addEventListener('change',updateTimelineScene);if($('timelineSfx'))$('timelineSfx').addEventListener('change',updateTimelineScene);if($('timelineSfxGain'))$('timelineSfxGain').addEventListener('input',()=>{if($('timelineSfxValue'))$('timelineSfxValue').textContent=$('timelineSfxGain').value+'%';updateTimelineScene();});if($('timelinePreviewScene'))$('timelinePreviewScene').addEventListener('click',()=>{const p=activeProject(),s=p?.scenes[state.selectedScene];if(!p||!s)return;state.preview.time=s.start;startPlayback();});if($('timelineNormalize'))$('timelineNormalize').addEventListener('click',()=>{recalculate(activeProject());renderTimeline();renderPreview();toast('Tiempos de escenas recalculados.','success');});
 $('prevScene').addEventListener('click',()=>gotoScene(-1));$('nextScene').addEventListener('click',()=>gotoScene(1));$('playPreview').addEventListener('click',startPlayback);$('seek').addEventListener('input',()=>{state.preview.playing=false;cancelAnimationFrame(raf);state.preview.time=+$('seek').value;renderPreview();});$('sceneDots').addEventListener('click',e=>{const b=e.target.closest('[data-dot-scene]');if(b)pickScene(+b.dataset.dotScene);});
 $('exportJson').addEventListener('click',exportProject);if($('refreshSceneImages'))$('refreshSceneImages').addEventListener('click',refreshSelectedSceneImages);if($('refreshAllImages'))$('refreshAllImages').addEventListener('click',refreshAllSceneImages);$('regenerateVoice').addEventListener('click',regenerateActiveVoice);if($('browserVoice'))$('browserVoice').addEventListener('click',()=>speakProjectInBrowser(activeProject()));$('exportVideo').addEventListener('click',exportVideoRecording);$('exportPng').addEventListener('click',exportPNG);$('exportSrt').addEventListener('click',exportSRT);
 $('addFact').addEventListener('click',addFact);$('exportEvidence').addEventListener('click',exportEvidence);bindFactEvents();attachSourceEvents();$('openSource').addEventListener('click',()=>{const url=$('sourceUrl').value.trim();if(/^https:\/\//i.test(url))window.open(url,'_blank','noopener,noreferrer');else toast('Introduce una URL https válida.','error');});$('fetchSource').addEventListener('click',fetchSourceText);$('generateAI').addEventListener('click',generateFromSource);
 $('addBatch').addEventListener('click',()=>addBatchTasks($('batchText').value));$('csvTemplate').addEventListener('click',downloadCSVTemplate);$('processBatch').addEventListener('click',processBatchQueue);$('clearBatch').addEventListener('click',()=>{if(!state.batch.length)return;state.batch=[];saveState();renderBatch();updateDashboard();toast('Cola vaciada.');});$('importBatchFile').addEventListener('click',()=>$('batchFile').click());$('browseBatch').addEventListener('click',()=>$('batchFile').click());$('batchFile').addEventListener('change',e=>{readBatchFile(e.target.files?.[0]);e.target.value='';});$('dropzone').addEventListener('dragover',e=>{e.preventDefault();$('dropzone').classList.add('dragging');});$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('dragging'));$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('dragging');readBatchFile(e.dataTransfer.files?.[0]);});$('batchTable').addEventListener('click',e=>{const del=e.target.closest('[data-batch-delete]'),op=e.target.closest('[data-batch-open]');if(del){state.batch=state.batch.filter(t=>t.id!==del.dataset.batchDelete);saveState();renderBatch();updateDashboard();}if(op)openBatchTask(op.dataset.batchOpen);});
 $('provider').addEventListener('change',()=>{state.settings.provider=$('provider').value;const id=selectedProvider();$('model').value=state.settings.models?.[id]||PROVIDERS[id].model;$('apiKey').value=localStorage.getItem(KEY_PREFIX+id)||'';setProviderLabels(id);$('providerState').textContent=apiKeyFor(id)?'Clave guardada en este navegador':'Sin configurar';$('providerHelp').textContent=PROVIDERS[id].desc;saveState();});$('saveProvider').addEventListener('click',persistProvider);if($('saveImageKeys'))$('saveImageKeys').addEventListener('click',saveImageKeys);$('testProvider').addEventListener('click',testProvider);$('deleteKey').addEventListener('click',()=>deleteProviderKey());$('clearKeys').addEventListener('click',()=>{Object.keys(PROVIDERS).forEach(id=>localStorage.removeItem(KEY_PREFIX+id));['pexels','pixabay'].forEach(id=>localStorage.removeItem(IMAGE_KEY_PREFIX+id));$('apiKey').value='';syncSettings();toast('Todas las claves fueron borradas.');});$('showKey').addEventListener('click',()=>{$('apiKey').type=$('apiKey').type==='password'?'text':'password';});$('model').addEventListener('change',()=>{state.settings.models=state.settings.models||{};state.settings.models[selectedProvider()]=$('model').value.trim();saveState();});
 $('historyImport').addEventListener('click',()=>$('projectFile').click());$('dashImport').addEventListener('click',()=>$('projectFile').click());$('projectFile').addEventListener('change',e=>{importProjectFile(e.target.files?.[0]);e.target.value='';});$('backupAll').addEventListener('click',exportBackup);$('historyList').addEventListener('click',e=>{const op=e.target.closest('[data-history-open]'),ex=e.target.closest('[data-history-export]'),del=e.target.closest('[data-history-delete]');if(op)switchProject(op.dataset.historyOpen);if(ex){const p=state.projects.find(x=>x.id===ex.dataset.historyExport);if(p)dlText(JSON.stringify(serializeSpec(p),null,2),fileSlug(p.topic)+'.json');}if(del)removeProject(del.dataset.historyDelete);});$('historyNew').addEventListener('click',showNew);$('clearActivity').addEventListener('click',()=>{state.activity=[];saveState();renderActivity();});$('recentProjects').addEventListener('click',e=>{const b=e.target.closest('[data-open-project]');if(b)switchProject(b.dataset.openProject);});
}
function readBatchFile(file){if(!file)return;const r=new FileReader();r.onload=()=>{$('batchText').value=String(r.result||'');addBatchTasks($('batchText').value);};r.onerror=()=>toast('No se pudo leer el archivo.','error');r.readAsText(file);}
async function init(){loadState();await hydrateUploadedImages().catch(e=>log('Algunas fotos locales no pudieron recuperarse: '+String(e.message||e).slice(0,90)));loadImage(PAPER_TEXTURE_URL).then(()=>renderPreview());if(!state.projects.length){const p=defaultProject();state.projects=[p];state.activeId=p.id;saveState();}if(!state.activeId||!activeProject())state.activeId=state.projects[0].id;wireEvents();syncEditor();renderSceneImagesEditor();updateDashboard();renderFacts();renderBatch();renderHistory();syncSettings();renderPreview();preloadProjectImages(activeProject()).then(()=>{renderSceneImagesEditor();renderPreview();});EMO_IDS.forEach(id=>loadImage(emoUrl(id)));loadStickPoses();log('FocoShorts Studio iniciado localmente.');}
document.addEventListener('DOMContentLoaded',init);
})();
