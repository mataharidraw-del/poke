
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
  resolveKoToEn: {}, // {koName: enName}
  moveKoToEn: {},    // {koMove: enMove}
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
async function fetchTypesFor(name){
  const key = `papi-types-${name.toLowerCase()}`;
  try{ const cached = localStorage.getItem(key); if(cached) return JSON.parse(cached); }catch{}
  const res = await fetch(`${API_BASE}/pokemon/${name.toLowerCase()}`);
  if(!res.ok) throw new Error("pokemon not found");
  const data = await res.json();
  const typesEN = data.types.map(t=>capitalize(t.type.name));
  localStorage.setItem(key, JSON.stringify(typesEN));
  return typesEN;
}
async function fetchSpecies(nameEn){
  const key = `papi-species-${nameEn.toLowerCase()}`;
  try{ const cached = localStorage.getItem(key); if(cached) return JSON.parse(cached); }catch{}
  const poke = await (await fetch(`${API_BASE}/pokemon/${nameEn.toLowerCase()}`)).json();
  const res = await fetch(poke.species.url);
  const data = await res.json();
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}
async function resolvePokemonKoToEn(ko){
  if(cache.resolveKoToEn[ko]) return cache.resolveKoToEn[ko];
  const list = await fetchPokemonList();
  // heuristic: check common bases first by length
  for(const item of list){
    try{
      const sp = await fetchSpecies(item.name);
      const koName = (sp.names||[]).find(n=>n.language?.name==="ko")?.name;
      if(koName && (koName===ko || koName.replace(/\s+/g,"")===(ko||"").replace(/\s+/g,""))){
        cache.resolveKoToEn[ko] = item.name;
        localStorage.setItem("ko2en-poke", JSON.stringify(cache.resolveKoToEn));
        return item.name;
      }
    }catch{}
  }
  throw new Error("not found");
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
async function fetchMoveDetail(name){
  const key = `papi-move-${name.toLowerCase()}`;
  try{ const cached = localStorage.getItem(key); if(cached) return JSON.parse(cached); }catch{}
  const res = await fetch(`${API_BASE}/move/${name.toLowerCase()}`);
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
async function resolveMoveKoToEn(koMove){
  if(cache.moveKoToEn[koMove]) return cache.moveKoToEn[koMove];
  const list = await fetchMoveList();
  for(const item of list){
    try{
      const det = await fetchMoveDetail(item.name);
      const koName = (det.names||[]).find(n=>n.language?.name==="ko")?.name;
      if(koName && (koName===koMove || koName.replace(/\s+/g,"")===(koMove||"").replace(/\s+/g,""))){
        cache.moveKoToEn[koMove] = det.name;
        localStorage.setItem("ko2en-move", JSON.stringify(cache.moveKoToEn));
        return det.name;
      }
    }catch{}
  }
  throw new Error("move not found");
}

function capitalize(s){ return (s||"").charAt(0).toUpperCase() + (s||"").slice(1); }

// ---- multipliers ----
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
function screenMultiplier(categoryKO, isDouble, reflect, lightscreen){
  const cat = (categoryKO==="물리")?"Physical":"Special";
  if(cat==="Physical" && reflect) return isDouble ? 2/3 : 0.5;
  if(cat==="Special" && lightscreen) return isDouble ? 2/3 : 0.5;
  return 1.0;
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
  const { isCrit, stabModeKO, reflect, lightscreen, isDouble, isBurn, hasGuts, otherModAtk=1.0, otherModDef=1.0, otherModMove=1.0, weatherKO="없음" } = opts || {};
  const base = Math.floor(Math.floor(((2*level)/5 + 2) * power * (attack*otherModAtk) / Math.max(1, defense*otherModDef)) / 50) + 2;
  const stab = stabMultiplier(moveTypeEN, atkTypesEN, stabModeKO);
  const eff  = typeMultiplier(moveTypeEN, defTypesEN);
  const scr  = screenMultiplier(categoryKO, isDouble, reflect, lightscreen);
  const burn = burnMultiplier(categoryKO, isBurn, hasGuts);
  const crit = critMultiplier(isCrit);
  const wthr = weatherMultiplier(moveTypeEN, weatherKO);
  const mod  = stab * eff * scr * burn * crit * wthr * otherModMove;
  const damages = ROLLS.map(r => Math.floor(Math.floor(base * mod) * r));
  return {damages, eff, crit:isCrit};
}

function koChances(damages, defenderHP, leftovers=0){
  damages = damages.slice().sort((a,b)=>a-b);
  const min = damages[0], max = damages[damages.length-1];
  const oneHit = damages.filter(d => d >= defenderHP).length/16;
  let twoHit = 0;
  for(const d1 of damages){
    for(const d2 of damages){
      if(d1 + d2 - leftovers >= defenderHP) twoHit++;
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
function logLineKR(atkName, moveName, defName, range, eff, isCrit){
  const lines = [];
  lines.push(`${atkName}의 ${moveName}!`);
  const e = effectText(eff); if(e) lines.push(e);
  const c = critText(isCrit); if(c) lines.push(c);
  lines.push(`${defName}에게 ${range[0]} ~ ${range[1]}의 데미지!`);
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
  const name = el(prefix+"Name").value || (prefix==="atk" ? "공격측" : "수비측");
  const level = num(el(prefix+"Level").value||50);
  const typesEN = [toENType(el(prefix+"Type1").value), toENType(el(prefix+"Type2").value)].filter(Boolean);
  const hp = num(el(prefix+"HP").value||1);
  const A = num(el(prefix+"A").value||1);
  const B = num(el(prefix+"B").value||1);
  const otherMod = num(el(prefix+"Mod").value||1);
  return {name, level, typesEN, stats:{hp, A, B}, otherMod};
}
function renderResult({range, oneHit, twoHit}, atk, def, moveName, eff, crit){
  el("outRange").textContent = `${range[0]} ~ ${range[1]} (${(range[0]/def.stats.hp*100).toFixed(1)}% ~ ${(range[1]/def.stats.hp*100).toFixed(1)}%)`;
  el("outOHKO").textContent = pct(oneHit);
  el("out2HKO").textContent = pct(twoHit);
  const msg = logLineKR(atk.name, moveName, def.name, range, eff, crit);
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
async function fillDataLists(){
  const [p, m] = await Promise.all([fetchPokemonList(), fetchMoveList()]);
  el("pokeList").innerHTML = p.map(x=>`<option value="${x.name}">`).join("");
  el("moveList").innerHTML = m.map(x=>`<option value="${x.name}">`).join("");
}

// ---- KR/EN resolving search ----
function attachSearch(inputEl, onPick){
  inputEl.addEventListener('change', ()=>onTry(inputEl.value));
  inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') onTry(inputEl.value) });
  async function onTry(qRaw){
    const q = (qRaw||"").trim();
    if(!q) return;
    let en = q.toLowerCase();
    // if Korean, resolve to EN via species names
    if(/[가-힣]/.test(q)){
      try{ en = await resolvePokemonKoToEn(q); }catch{}
    }
    try{
      const typesEN = await fetchTypesFor(en);
      onPick(en, typesEN);
      autoCalcIfReady();
    }catch{}
  }
}

// ---- Move auto with KR ----
function attachMoveAuto(){
  const elName = el("moveName");
  elName.addEventListener('change', onMove);
  elName.addEventListener('keydown', (e)=>{ if(e.key==='Enter') onMove(); });
  async function onMove(){
    let mvRaw = elName.value.trim();
    if(!mvRaw) return;
    let mvEn = mvRaw.toLowerCase().replace(/\s+/g,'-');
    if(/[가-힣]/.test(mvRaw)){
      try{ mvEn = await resolveMoveKoToEn(mvRaw); }catch{}
    }
    try{
      const info = await fetchMoveDetail(mvEn);
      const koName = (info.names||[]).find(n=>n.language?.name==="ko")?.name;
      el("moveName").value = koName || mvRaw; // show KO if available
      el("moveType").value = TYPE_EN_TO_KO[info.typeEN] || info.typeEN;
      el("moveCat").value = info.categoryKO==="상태" ? "물리" : info.categoryKO;
      el("movePower").value = info.power || 0;
      setEffectBadge(info.typeEN);
      autoCalcIfReady();
    }catch{}
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
  // restore caches (ko mapping)
  try{ Object.assign(cache.resolveKoToEn, JSON.parse(localStorage.getItem("ko2en-poke")||"{}")); }catch{}
  try{ Object.assign(cache.moveKoToEn, JSON.parse(localStorage.getItem("ko2en-move")||"{}")); }catch{}

  attachSearch(el("atkSearch"), (nameEn, typesEN)=>{
    el("atkName").value = capitalize(nameEn);
    el("atkType1").value = TYPE_EN_TO_KO[typesEN[0]] || typesEN[0] || "";
    el("atkType2").value = TYPE_EN_TO_KO[typesEN[1]] || "";
  });
  attachSearch(el("defSearch"), (nameEn, typesEN)=>{
    el("defName").value = capitalize(nameEn);
    el("defType1").value = TYPE_EN_TO_KO[typesEN[0]] || typesEN[0] || "";
    el("defType2").value = TYPE_EN_TO_KO[typesEN[1]] || "";
  });
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
    const moveName = el("moveName").value || "기술";
    const moveTypeEN = toENType(el("moveType").value || "Normal");
    const power = num(el("movePower").value||1);
    const categoryKO = el("moveCat").value || "물리";
    const isCrit = el("isCrit").value === "예";
    const stabModeKO = el("atkStab").value || "자동";
    const reflect = el("reflect").value === "예";
    const lightscreen = el("lightscreen").value === "예";
    const isDouble = el("isDouble").value === "예";
    const isBurn = el("atkBurn").value === "예";
    const hasGuts = el("atkGuts").value === "예";
    const weatherKO = el("weather").value || "없음";
    const attack = atk.stats.A; const defense = def.stats.B;
    const {damages, eff, crit} = computeDamage({
      level: atk.level, power, attack, defense, categoryKO, moveTypeEN,
      atkTypesEN: atk.typesEN, defTypesEN: def.typesEN,
      opts:{ isCrit, stabModeKO, reflect, lightscreen, isDouble, isBurn, hasGuts, weatherKO,
        otherModAtk: atk.otherMod, otherModDef: def.otherMod, otherModMove: num(el("moveMod").value||1) }
    });
    const {range, oneHit, twoHit} = koChances(damages, def.stats.hp, num(el("leftovers").value||0));
    renderResult({range, oneHit, twoHit}, atk, def, moveName, eff, crit);
    setEffectBadge(moveTypeEN);
  });

  el("btnClear").addEventListener('click', ()=>{ el("hist").textContent = ""; });

  fillDataLists().catch(()=>{});
}

window.addEventListener('DOMContentLoaded', setup);
