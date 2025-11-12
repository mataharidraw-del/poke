
const TYPE_KO_TO_EN = {
  "노말":"Normal","불꽃":"Fire","물":"Water","전기":"Electric","풀":"Grass","얼음":"Ice",
  "격투":"Fighting","독":"Poison","땅":"Ground","비행":"Flying","에스퍼":"Psychic",
  "벌레":"Bug","바위":"Rock","고스트":"Ghost","드래곤":"Dragon","악":"Dark","강철":"Steel","페어리":"Fairy",
  "Normal":"Normal","Fire":"Fire","Water":"Water","Electric":"Electric","Grass":"Grass","Ice":"Ice",
  "Fighting":"Fighting","Poison":"Poison","Ground":"Ground","Flying":"Flying","Psychic":"Psychic",
  "Bug":"Bug","Rock":"Rock","Ghost":"Ghost","Dragon":"Dragon","Dark":"Dark","Steel":"Steel","Fairy":"Fairy"
};
const TYPE_EN_TO_KO = Object.fromEntries(Object.entries(TYPE_KO_TO_EN).map(([k,v])=>[v,k]).filter(([k,_],i,self)=>self.findIndex(([x,_y])=>x===k)===i));

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

async function fetchPokemonList(){
  const key = "papi-list-2000";
  try{ const cached = localStorage.getItem(key); if(cached) return JSON.parse(cached); }catch{}
  const res = await fetch(`${API_BASE}/pokemon?limit=2000`, {cache:"force-cache"});
  const data = await res.json();
  localStorage.setItem(key, JSON.stringify(data.results));
  return data.results;
}
async function fetchTypesFor(name){
  const key = `papi-types-${name.toLowerCase()}`;
  try{ const cached = localStorage.getItem(key); if(cached) return JSON.parse(cached); }catch{}
  const res = await fetch(`${API_BASE}/pokemon/${name.toLowerCase()}`);
  if(!res.ok) throw new Error("Not found");
  const data = await res.json();
  const types = data.types.map(t=>capitalize(t.type.name));
  localStorage.setItem(key, JSON.stringify(types));
  return types;
}
function capitalize(s){ return (s||"").charAt(0).toUpperCase() + (s||"").slice(1); }

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

// ---- 한국어 대사 ----
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
  return lines.join("\n"); // actual newline
}

// ---- UI ----
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

function attachSearch(inputEl, onPick){
  let list = []; let timer;
  inputEl.addEventListener('input', ()=>{
    clearTimeout(timer);
    const q = inputEl.value.trim().toLowerCase();
    if(!q) return;
    timer = setTimeout(async ()=>{
      if(list.length===0) list = await fetchPokemonList();
      const found = list.find(p=>p.name===q);
      if(found){
        try{
          const typesEN = await fetchTypesFor(found.name);
          onPick(found.name, typesEN);
        }catch{}
      }
    }, 180);
  });
}

function setup(){
  attachSearch(el("atkSearch"), (name, typesEN)=>{
    el("atkName").value = capitalize(name);
    el("atkType1").value = TYPE_EN_TO_KO[typesEN[0]] || typesEN[0] || "";
    el("atkType2").value = TYPE_EN_TO_KO[typesEN[1]] || "";
  });
  attachSearch(el("defSearch"), (name, typesEN)=>{
    el("defName").value = capitalize(name);
    el("defType1").value = TYPE_EN_TO_KO[typesEN[0]] || typesEN[0] || "";
    el("defType2").value = TYPE_EN_TO_KO[typesEN[1]] || "";
  });

  el("btnSwap").addEventListener('click', ()=>{
    const ids = ["Name","Level","Type1","Type2","HP","A","B","Mod"];
    for(const id of ids){
      const a = el("atk"+id), d = el("def"+id);
      const tmp = a.value; a.value = d.value; d.value = tmp;
    }
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
  });

  el("btnClear").addEventListener('click', ()=>{ el("hist").textContent = ""; });

  fetchPokemonList().catch(()=>{});
}
window.addEventListener('DOMContentLoaded', setup);
