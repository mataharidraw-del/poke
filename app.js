
// ---- type maps ----
const TYPE_KO_TO_EN = {
  "노말":"Normal","불꽃":"Fire","물":"Water","전기":"Electric","풀":"Grass","얼음":"Ice",
  "격투":"Fighting","독":"Poison","땅":"Ground","비행":"Flying","에스퍼":"Psychic",
  "벌레":"Bug","바위":"Rock","고스트":"Ghost","드래곤":"Dragon","악":"Dark","강철":"Steel","페어리":"Fairy",
  "Normal":"Normal","Fire":"Fire","Water":"Water","Electric":"Electric","Grass":"Grass","Ice":"Ice",
  "Fighting":"Fighting","Poison":"Poison","Ground":"Ground","Flying":"Flying","Psychic":"Psychic",
  "Bug":"Bug","Rock":"Rock","Ghost":"Ghost","Dragon":"Dragon","Dark":"Dark","Steel":"Steel","Fairy":"Fairy"
};
const TYPE_EN_TO_KO = Object.fromEntries(Object.entries(TYPE_KO_TO_EN).map(([k,v])=>[v,k]).filter(([k,_],i,self)=>self.findIndex(([x,_y])=>x===k)===i));

// ---- type chart ----
const TYPE_CHART = {
  Normal:{Rock:.5,Ghost:0,Steel:.5},
  Fire:{Fire:.5,Water:.5,Rock:.5,Dragon:.5,Grass:2,Ice:2,Bug:2,Steel:2},
  Water:{Water:.5,Grass:.5,Dragon:.5,Fire:2,Ground:2,Rock:2},
  Electric:{Electric:.5,Grass:.5,Dragon:.5,Ground:0,Water:2,Flying:2},
  Grass:{Fire:.5,Grass:.5,Poison:.5,Flying:.5,Bug:.5,Dragon:.5,Steel:.5,Water:2,Ground:2,Rock:2},
  Ice:{Fire:.5,Water:.5,Ice:.5,Steel:.5,Grass:2,Ground:2,Flying:2,Dragon:2},
  Fighting:{Poison:.5,Flying:.5,Psychic:.5,Bug:.5,Fairy:.5,Ghost:0,Normal:2,Ice:2,Rock:2,Dark:2,Steel:2},
  Poison:{Poison:.5,Ground:.5,Rock:.5,Ghost:.5,Steel:0,Grass:2,Fairy:2},
  Ground:{Grass:.5,Bug:.5,Flying:0,Fire:2,Electric:2,Poison:2,Rock:2,Steel:2},
  Flying:{Electric:.5,Rock:.5,Steel:.5,Grass:2,Fighting:2,Bug:2,Ground:1},
  Psychic:{Psychic:.5,Steel:.5,Dark:0,Fighting:2,Poison:2},
  Bug:{Fire:.5,Fighting:.5,Poison:.5,Flying:.5,Ghost:.5,Steel:.5,Fairy:.5,Grass:2,Psychic:2,Dark:2},
  Rock:{Fighting:.5,Ground:.5,Steel:.5,Fire:2,Ice:2,Flying:2,Bug:2},
  Ghost:{Dark:.5,Normal:0,Psychic:2,Ghost:2},
  Dragon:{Steel:.5,Fairy:0,Dragon:2},
  Dark:{Fighting:.5,Dark:.5,Fairy:.5,Psychic:2,Ghost:2},
  Steel:{Fire:.5,Water:.5,Electric:.5,Steel:.5,Ice:2,Rock:2,Fairy:2},
  Fairy:{Fire:.5,Poison:.5,Steel:.5,Fighting:2,Dragon:2,Dark:2}
};

const ROLLS = Array.from({length:16}, (_,i)=>(85+i)/100);
const num = v => Number(v ?? 0) || 0;
const API_BASE = "https://pokeapi.co/api/v2";

// ---- caches ----
const cache = {
  list: null,
  moveList: null,
  ko2enPoke: {}, en2koPoke: {},
  ko2enMove: {}, en2koMove: {},
  koPokeList: [], koMoveList: []
};

// ---- PokéAPI helpers ----
async function fetchPokemonList(){
  if(cache.list) return cache.list;
  const key = "papi-list-2000";
  try{ const cached = localStorage.getItem(key); if(cached){ cache.list = JSON.parse(cached); return cache.list; } }catch{}
  const res = await fetch(`${API_BASE}/pokemon?limit=2000`, {cache:"force-cache"});
  const data = await res.json();
  localStorage.setItem(key, JSON.stringify(data.results));
  cache.list = data.results;
  return cache.list;
}
async function fetchTypesFor(enName){
  const key = `papi-types-${enName.toLowerCase()}`;
  try{ const cached = localStorage.getItem(key); if(cached) return JSON.parse(cached); }catch{}
  const res = await fetch(`${API_BASE}/pokemon/${enName.toLowerCase()}`);
  if(!res.ok) throw new Error("pokemon not found");
  const data = await res.json();
  const typesEN = data.types.map(t=>capitalize(t.type.name));
  localStorage.setItem(key, JSON.stringify(typesEN));
  return typesEN;
}
async function fetchSpecies(enName){
  const key = `papi-species-${enName.toLowerCase()}`;
  try{ const cached = localStorage.getItem(key); if(cached) return JSON.parse(cached); }catch{}
  const poke = await (await fetch(`${API_BASE}/pokemon/${enName.toLowerCase()}`)).json();
  const res = await fetch(poke.species.url);
  const data = await res.json();
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}
async function resolvePokemonName(input){
  let en = input.trim().toLowerCase();
  let ko = input.trim();
  if(/[가-힣]/.test(input)){
    if(cache.ko2enPoke[ko]) return {en: cache.ko2enPoke[ko], ko};
    if(cache.koPokeList.length===0) await buildKoPokeListBatched(400); // seed some
    // fallback: full scan if not found in cache yet
    const list = await fetchPokemonList();
    for(const item of list){
      if(cache.en2koPoke[item.name]){
        if(strip(cache.en2koPoke[item.name])===strip(ko)) return {en:item.name, ko:cache.en2koPoke[item.name]};
        continue;
      }
      try{
        const sp = await fetchSpecies(item.name);
        const koName = (sp.names||[]).find(n=>n.language?.name==="ko")?.name;
        if(koName){
          cache.en2koPoke[item.name] = koName;
          cache.ko2enPoke[koName] = item.name;
          if(strip(koName)===strip(ko)) return {en:item.name, ko:koName};
        }
      }catch{}
    }
    throw new Error("not found");
  }else{
    try{
      const sp = await fetchSpecies(en);
      const koName = (sp.names||[]).find(n=>n.language?.name==="ko")?.name || ko;
      cache.en2koPoke[en] = koName;
      cache.ko2enPoke[koName] = en;
      persistMaps();
      return {en, ko: koName};
    }catch{
      return {en, ko};
    }
  }
}

async function fetchMoveList(){
  if(cache.moveList) return cache.moveList;
  const key = "papi-move-list-2000";
  try{ const cached = localStorage.getItem(key); if(cached){ cache.moveList = JSON.parse(cached); return cache.moveList; } }catch{}
  const res = await fetch(`${API_BASE}/move?limit=2000`, {cache:"force-cache"});
  const data = await res.json();
  localStorage.setItem(key, JSON.stringify(data.results));
  cache.moveList = data.results;
  return cache.moveList;
}
async function fetchMoveDetail(enMove){
  const key = `papi-move-${enMove.toLowerCase()}`;
  try{ const cached = localStorage.getItem(key); if(cached) return JSON.parse(cached); }catch{}
  const res = await fetch(`${API_BASE}/move/${enMove.toLowerCase()}`);
  if(!res.ok) throw new Error("move not found");
  const data = await res.json();
  const move = {
    name: data.name,
    names: data.names || [],
    typeEN: capitalize(data.type.name),
    categoryKO: data.damage_class.name==="physical"?"물리":(data.damage_class.name==="special"?"특수":"상태"),
    power: data.power || 0
  };
  localStorage.setItem(key, JSON.stringify(move));
  return move;
}
async function resolveMoveName(input){
  let raw = input.trim();
  if(/[가-힣]/.test(raw)){
    if(cache.ko2enMove[raw]){
      const det = await fetchMoveDetail(cache.ko2enMove[raw]);
      const koName = (det.names||[]).find(n=>n.language?.name==="ko")?.name || raw;
      cache.en2koMove[det.name] = koName;
      persistMaps();
      return {en: det.name, ko: koName};
    }
    if(cache.koMoveList.length===0) await buildKoMoveListBatched(400);
    const list = await fetchMoveList();
    for(const item of list){
      if(cache.en2koMove[item.name]){
        if(strip(cache.en2koMove[item.name])===strip(raw)) return {en:item.name, ko:cache.en2koMove[item.name]};
        continue;
      }
      try{
        const det = await fetchMoveDetail(item.name);
        const koName = (det.names||[]).find(n=>n.language?.name==="ko")?.name;
        if(koName){
          cache.en2koMove[item.name] = koName;
          cache.ko2enMove[koName] = item.name;
          if(strip(koName)===strip(raw)) return {en:item.name, ko:koName};
        }
      }catch{}
    }
    throw new Error("move not found");
  }else{
    const en = raw.toLowerCase().replace(/\s+/g,'-');
    try{
      const det = await fetchMoveDetail(en);
      const koName = (det.names||[]).find(n=>n.language?.name==="ko")?.name || raw;
      cache.en2koMove[det.name] = koName;
      cache.ko2enMove[koName] = det.name;
      persistMaps();
      return {en: det.name, ko: koName};
    }catch{
      return {en, ko: raw};
    }
  }
}

function strip(s){ return (s||"").replace(/\s+/g,"").toLowerCase(); }
function capitalize(s){ return (s||"").charAt(0).toUpperCase() + (s||"").slice(1); }
function persistMaps(){
  try{
    localStorage.setItem("ko2enPoke", JSON.stringify(cache.ko2enPoke));
    localStorage.setItem("en2koPoke", JSON.stringify(cache.en2koPoke));
    localStorage.setItem("ko2enMove", JSON.stringify(cache.ko2enMove));
    localStorage.setItem("en2koMove", JSON.stringify(cache.en2koMove));
    localStorage.setItem("koPokeList", JSON.stringify(cache.koPokeList));
    localStorage.setItem("koMoveList", JSON.stringify(cache.koMoveList));
  }catch{}
}

// ---- datalist (KO-first; batched build) ----
async function buildKoPokeListBatched(batch=200){
  // restore if exists
  try{
    const saved = JSON.parse(localStorage.getItem("koPokeList")||"[]");
    const m1 = JSON.parse(localStorage.getItem("ko2enPoke")||"{}");
    const m2 = JSON.parse(localStorage.getItem("en2koPoke")||"{}");
    if(saved.length>0){ cache.koPokeList = saved; Object.assign(cache.ko2enPoke,m1); Object.assign(cache.en2koPoke,m2); fillPokeOptions(); return; }
  }catch{}
  const list = await fetchPokemonList();
  cache.koPokeList = [];
  const total = list.length;
  for(let i=0;i<total;i++){
    const item = list[i];
    try{
      const sp = await fetchSpecies(item.name);
      const koName = (sp.names||[]).find(n=>n.language?.name==="ko")?.name;
      if(koName){
        cache.koPokeList.push(koName);
        cache.en2koPoke[item.name] = koName;
        cache.ko2enPoke[koName] = item.name;
        if(cache.koPokeList.length % 50 === 0) { fillPokeOptions(); persistMaps(); }
      }
    }catch{}
    if(i % batch === 0){ await new Promise(r=>setTimeout(r,0)); updateFillStatus("포켓몬", i+1, total); }
  }
  fillPokeOptions(); persistMaps(); updateFillStatus("포켓몬", total, total);
}
function fillPokeOptions(){
  const dl = el("pokeList");
  const existing = new Set(Array.from(dl.options).map(o=>o.value));
  const toAdd = cache.koPokeList.filter(x=>!existing.has(x));
  if(toAdd.length){
    dl.insertAdjacentHTML('beforeend', toAdd.map(x=>`<option value="${x}">`).join(""));
  }
}

async function buildKoMoveListBatched(batch=200){
  try{
    const saved = JSON.parse(localStorage.getItem("koMoveList")||"[]");
    const m1 = JSON.parse(localStorage.getItem("ko2enMove")||"{}");
    const m2 = JSON.parse(localStorage.getItem("en2koMove")||"{}");
    if(saved.length>0){ cache.koMoveList = saved; Object.assign(cache.ko2enMove,m1); Object.assign(cache.en2koMove,m2); fillMoveOptions(); return; }
  }catch{}
  const list = await fetchMoveList();
  cache.koMoveList = [];
  const total = list.length;
  for(let i=0;i<total;i++){
    const item = list[i];
    try{
      const det = await fetchMoveDetail(item.name);
      const koName = (det.names||[]).find(n=>n.language?.name==="ko")?.name;
      if(koName){
        cache.koMoveList.push(koName);
        cache.en2koMove[item.name] = koName;
        cache.ko2enMove[koName] = item.name;
        if(cache.koMoveList.length % 50 === 0) { fillMoveOptions(); persistMaps(); }
      }
    }catch{}
    if(i % batch === 0){ await new Promise(r=>setTimeout(r,0)); updateFillStatus("기술", i+1, total); }
  }
  fillMoveOptions(); persistMaps(); updateFillStatus("기술", total, total);
}
function fillMoveOptions(){
  const dl = el("moveList");
  const existing = new Set(Array.from(dl.options).map(o=>o.value));
  const toAdd = cache.koMoveList.filter(x=>!existing.has(x));
  if(toAdd.length){
    dl.insertAdjacentHTML('beforeend', toAdd.map(x=>`<option value="${x}">`).join(""));
  }
}
function updateFillStatus(kind, cur, tot){
  const elx = document.getElementById("koFillStatus");
  if(elx) elx.textContent = `${kind} 목록 한글화 ${cur}/${tot}`;
}

// ---- multipliers & calc ----
function typeMultiplier(moveTypeEN, defTypesEN){
  let m = 1.0;
  for(const dt of defTypesEN){
    const row = TYPE_CHART[moveTypeEN] || {};
    m *= (row?.[dt] ?? 1.0);
  }
  return m;
}
function stabMultiplier(moveTypeEN, atkTypesEN, modeKO){
  if(modeKO==="끄기") return 1.0;
  return atkTypesEN.includes(moveTypeEN) ? 1.5 : 1.0;
}
function burnMultiplier(categoryKO, isBurn, hasGuts){
  const cat = (categoryKO==="물리")?"Physical":"Special";
  if(cat==="Physical" && isBurn && !hasGuts) return 0.5;
  return 1.0;
}
function critMultiplier(isCrit){ return isCrit ? 1.5 : 1.0; }
function weatherMultiplier(moveTypeEN, weatherKO){
  if(weatherKO==="쾌청"){ if(moveTypeEN==="Fire") return 1.5; if(moveTypeEN==="Water") return 0.5; }
  if(weatherKO==="비"){ if(moveTypeEN==="Water") return 1.5; if(moveTypeEN==="Fire") return 0.5; }
  return 1.0;
}
function computeDamage({level, power, attack, defense, categoryKO, moveTypeEN, atkTypesEN, defTypesEN, opts}){
  const { isCrit, stabModeKO, isBurn, hasGuts, otherModAtk=1.0, otherModDef=1.0, otherModMove=1.0, weatherKO="없음" } = opts || {};
  const base = Math.floor(Math.floor(((2*level)/5 + 2) * power * (attack*otherModAtk) / Math.max(1, defense*otherModDef)) / 50) + 2;
  const stab = stabMultiplier(moveTypeEN, atkTypesEN, stabModeKO);
  const eff  = typeMultiplier(moveTypeEN, defTypesEN);
  const burn = burnMultiplier(categoryKO, isBurn, hasGuts);
  const crit = critMultiplier(isCrit);
  const wthr = weatherMultiplier(moveTypeEN, weatherKO);
  const mod  = stab * eff * burn * crit * wthr * otherModMove;
  const damages = ROLLS.map(r => Math.floor(Math.floor(base * mod) * r));
  return {damages, eff, crit:isCrit};
}
function koChances(damages, defenderHP){
  damages = damages.slice().sort((a,b)=>a-b);
  const min = damages[0], max = damages[damages.length-1];
  const oneHit = damages.filter(d => d >= defenderHP).length/16;
  let twoHit = 0;
  for(const d1 of damages){
    for(const d2 of damages){
      if(d1 + d2 >= defenderHP) twoHit++;
    }
  }
  twoHit /= 16*16;
  return {range:[min,max], oneHit, twoHit};
}

// ---- KR battle text ----
function effectText(mult){
  if(mult===0) return "효과가 없다!";
  if(mult>=2) return "효과가 굉장했다!";
  if(mult>1)  return "효과가 좋다!";
  if(mult===1) return "";
  return "효과가 별로인 듯하다…";
}
function critText(isCrit){ return isCrit ? "급소에 맞았다!" : ""; }
function logLineKR(atkNameKO, moveNameKO, defNameKO, range, eff, isCrit){
  const lines = [];
  lines.push(`${atkNameKO}의 ${moveNameKO}!`);
  const e = effectText(eff); if(e) lines.push(e);
  const c = critText(isCrit); if(c) lines.push(c);
  lines.push(`${defNameKO}에게 ${range[0]} ~ ${range[1]}의 데미지!`);
  return lines.join("\n");
}

// ---- UI helpers ----
function el(id){ return document.getElementById(id); }
function pct(x){ return (x*100).toFixed(1)+"%"; }
function toENType(input){
  const t = (input||"").trim();
  return TYPE_KO_TO_EN[t] || capitalize(t.toLowerCase());
}
function collectSide(prefix){
  const nameKO = el(prefix+"Name").value || (prefix==="atk" ? "공격측" : "수비측");
  const level = num(el(prefix+"Level").value||50);
  const typesEN = [toENType(el(prefix+"Type1").value), toENType(el(prefix+"Type2").value)].filter(Boolean);
  const hp = num(el(prefix+"HP").value||1);
  const A = num(el(prefix+"A").value||1);
  const B = num(el(prefix+"B").value||1);
  const otherMod = num(el(prefix+"Mod")?el(prefix+"Mod").value:1) || 1;
  return {nameKO, level, typesEN, stats:{hp, A, B}, otherMod};
}
function renderResult({range, oneHit, twoHit}, atk, def, moveNameKO, eff, crit){
  el("outRange").textContent = `${range[0]} ~ ${range[1]} (${(range[0]/def.stats.hp*100).toFixed(1)}% ~ ${(range[1]/def.stats.hp*100).toFixed(1)}%)`;
  el("outOHKO").textContent = pct(oneHit);
  el("out2HKO").textContent = pct(twoHit);
  const msg = logLineKR(atk.nameKO, moveNameKO, def.nameKO, range, eff, crit);
  el("outLog").textContent = msg;
  const hist = el("hist"); hist.textContent = (hist.textContent? (hist.textContent+"\n"):"") + msg;
}
function setEffectBadge(moveTypeEN){
  const atk = collectSide("atk"); const def = collectSide("def");
  if(!moveTypeEN || def.typesEN.length===0) return el("effNow").textContent = "-";
  const eff = typeMultiplier(moveTypeEN, def.typesEN);
  const txt = eff===0?"무효 ×0" : (eff>=2?`상성 유리 ×${eff}` : (eff<1?`상성 불리 ×${eff}`:`보통 ×1`));
  el("effNow").textContent = txt;
}

// ---- datalist ----
async function initDataListsKO(){
  // 즉시 이전 캐시를 반영해 한글 목록 표시
  try{
    Object.assign(cache.ko2enPoke, JSON.parse(localStorage.getItem("ko2enPoke")||"{}"));
    Object.assign(cache.en2koPoke, JSON.parse(localStorage.getItem("en2koPoke")||"{}"));
    Object.assign(cache.ko2enMove, JSON.parse(localStorage.getItem("ko2enMove")||"{}"));
    Object.assign(cache.en2koMove, JSON.parse(localStorage.getItem("en2koMove")||"{}"));
    cache.koPokeList = JSON.parse(localStorage.getItem("koPokeList")||"[]");
    cache.koMoveList = JSON.parse(localStorage.getItem("koMoveList")||"[]");
  }catch{}
  fillPokeOptions();
  fillMoveOptions();
  // 백그라운드 증분 채우기
  buildKoPokeListBatched(150).catch(()=>{});
  buildKoMoveListBatched(150).catch(()=>{});
}

// ---- attach with KO-first display ----
function attachSearch(inputEl, nameEl, type1El, type2El){
  inputEl.addEventListener('change', ()=>onTry(inputEl.value));
  inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') onTry(inputEl.value) });
  async function onTry(val){
    const q = (val||"").trim(); if(!q) return;
    try{
      const {en, ko} = await resolvePokemonName(q);
      const typesEN = await fetchTypesFor(en);
      nameEl.value = ko; // always KO display
      type1El.value = TYPE_EN_TO_KO[typesEN[0]] || typesEN[0] || "";
      type2El.value = TYPE_EN_TO_KO[typesEN[1]] || "";
      const dl = el("pokeList");
      if(!Array.from(dl.options).some(o=>o.value===ko)) dl.insertAdjacentHTML('beforeend', `<option value="${ko}">`);
      autoCalcIfReady();
    }catch{ /* ignore */}
  }
}

function attachMoveAuto(){
  const nameEl = el("moveName");
  nameEl.addEventListener('change', onMove);
  nameEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') onMove(); });
  async function onMove(){
    const raw = nameEl.value.trim(); if(!raw) return;
    try{
      const {en, ko} = await resolveMoveName(raw);
      const info = await fetchMoveDetail(en);
      nameEl.value = ko;
      el("moveType").value = TYPE_EN_TO_KO[info.typeEN] || info.typeEN;
      el("moveCat").value = info.categoryKO==="상태" ? "물리" : info.categoryKO;
      el("movePower").value = info.power || 0;
      const dl = el("moveList");
      if(!Array.from(dl.options).some(o=>o.value===ko)) dl.insertAdjacentHTML('beforeend', `<option value="${ko}">`);
      setEffectBadge(info.typeEN);
      autoCalcIfReady();
    }catch{ /* ignore */}
  }
}

function inputsReady(){
  const atkName = el("atkName").value || el("atkSearch").value;
  const defName = el("defName").value || el("defSearch").value;
  const mv = el("moveName").value;
  return atkName && defName && mv;
}
function autoCalcIfReady(){
  if(!inputsReady()) return;
  const moveTypeEN = toENType(el("moveType").value || "");
  if(moveTypeEN) setEffectBadge(moveTypeEN);
  el("btnCalc").click();
}

function setup(){
  initDataListsKO().catch(()=>{});

  attachSearch(el("atkSearch"), el("atkName"), el("atkType1"), el("atkType2"));
  attachSearch(el("defSearch"), el("defName"), el("defType1"), el("defType2"));
  attachMoveAuto();

  el("btnSwap").addEventListener('click', ()=>{
    const ids = ["Name","Level","Type1","Type2","HP","A","B","Mod"];
    for(const id of ids){
      const a = el("atk"+id), d = el("def"+id);
      const tmp = a.value; a.value = d.value; d.value = tmp;
    }
    setEffectBadge(toENType(el("moveType").value||""));
  });

  el("btnCalc").addEventListener('click', ()=>{
    const atk = collectSide("atk"); const def = collectSide("def");
    const moveNameKO = el("moveName").value || "기술";
    const moveTypeEN = toENType(el("moveType").value || "Normal");
    const power = num(el("movePower").value||1);
    const categoryKO = el("moveCat").value || "물리";
    const isCrit = el("isCrit").value === "예";
    const stabModeKO = el("atkStab").value || "자동";
    const isBurn = el("atkBurn").value === "예";
    const hasGuts = el("atkGuts").value === "예";
    const weatherKO = el("weather").value || "없음";
    const attack = atk.stats.A; const defense = def.stats.B;
    const {damages, eff, crit} = computeDamage({
      level: atk.level, power, attack, defense, categoryKO, moveTypeEN,
      atkTypesEN: atk.typesEN, defTypesEN: def.typesEN,
      opts:{ isCrit, stabModeKO, isBurn, hasGuts, weatherKO,
        otherModAtk: atk.otherMod, otherModDef: def.otherMod, otherModMove: num(el("moveMod")?el("moveMod").value:1) }
    });
    const {range, oneHit, twoHit} = koChances(damages, def.stats.hp);
    renderResult({range, oneHit, twoHit}, atk, def, moveNameKO, eff, crit);
    setEffectBadge(moveTypeEN);
  });

  el("btnClear").addEventListener('click', ()=>{ el("hist").textContent = ""; });
}

window.addEventListener('DOMContentLoaded', setup);
