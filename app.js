
// ---- Type chart (Gen6+): attack -> defend multiplier ----
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
const TYPES = Object.keys(TYPE_CHART);

// Random rolls: 16 values from 0.85 to 1.00
const ROLLS = Array.from({length:16}, (_,i)=>(85+i)/100);

// Utility
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = v => Number(v ?? 0) || 0;
const bool = v => !!v;

// Type effectiveness for moveType vs [def1, def2]
function typeMultiplier(moveType, defTypes){
  let m = 1.0;
  for(const dt of defTypes){
    const row = TYPE_CHART[moveType] || {};
    m *= (row?.[dt] ?? 1.0);
  }
  return m;
}

// STAB
function stabMultiplier(moveType, atkTypes, stabToggle){
  if (stabToggle === false) return 1.0;
  return atkTypes.includes(moveType) ? 1.5 : 1.0; // 기본 STAB
}

// Screens
function screenMultiplier(category, isDouble, reflect, lightscreen){
  if(category === "Physical" && reflect){
    return isDouble ? 2/3 : 0.5;
  }
  if(category === "Special" && lightscreen){
    return isDouble ? 2/3 : 0.5;
  }
  return 1.0;
}

// Burn
function burnMultiplier(category, isBurn, hasGuts){
  if(category === "Physical" && isBurn && !hasGuts) return 0.5;
  return 1.0;
}

// Critical (Gen 6+)
function critMultiplier(isCrit){ return isCrit ? 1.5 : 1.0; }

// Weather (대표 예시만)
function weatherMultiplier(moveType, weather){
  if(weather==="Sun"){
    if(moveType==="Fire") return 1.5;
    if(moveType==="Water") return 0.5;
  }
  if(weather==="Rain"){
    if(moveType==="Water") return 1.5;
    if(moveType==="Fire") return 0.5;
  }
  return 1.0;
}

// Damage core (Gen6+ style). Return array of 16 rolls
function computeDamage({level, power, attack, defense, category, moveType, atkTypes, defTypes, opts}){
  const { isCrit, stabOn, reflect, lightscreen, isDouble, isBurn, hasGuts, otherModAtk=1.0, otherModDef=1.0, otherModMove=1.0, weather="None" } = opts || {};
  const base = Math.floor(Math.floor(((2*level)/5 + 2) * power * (attack*otherModAtk) / Math.max(1, defense*otherModDef)) / 50) + 2;
  const stab = stabMultiplier(moveType, atkTypes, stabOn);
  const eff  = typeMultiplier(moveType, defTypes);
  const scr  = screenMultiplier(category, isDouble, reflect, lightscreen);
  const burn = burnMultiplier(category, isBurn, hasGuts);
  const crit = critMultiplier(isCrit);
  const wthr = weatherMultiplier(moveType, weather);
  const mod  = stab * eff * scr * burn * crit * wthr * otherModMove;
  const damages = ROLLS.map(r => Math.floor(Math.floor(base * mod) * r));
  return {damages, eff, crit:isCrit};
}

// KO chance helper
function koChances(damages, defenderHP, leftovers=0){
  // 단순 1타/2타 확률 추정 (잔식 회복률 옵션)
  damages = damages.slice().sort((a,b)=>a-b);
  const min = damages[0], max = damages[damages.length-1];
  const oneHit = damages.filter(d => d >= defenderHP).length/16;
  // 2타: 두 번의 합이 HP + 잔식(1틱) 이상인지 간단 판정(정확한 확률은 더 복잡함)
  let twoHit = 0;
  for(const d1 of damages){
    for(const d2 of damages){
      if(d1 + d2 - leftovers >= defenderHP) twoHit++;
    }
  }
  twoHit /= 16*16;
  return {range:[min,max], oneHit, twoHit};
}

// Korean flare text
function effectText(mult){
  if(mult===0) return "효과가 전혀 없었다…";
  if(mult>=2) return "효과가 굉대했다!";
  if(mult>1)  return "효과가 좋았다.";
  if(mult===1) return ""; // 보통
  return "효과가 별로였다…";
}

// ---- Showdown Log Translator ----
const SHOWDOWN_KR_MAP = [
  // order matters (more specific first)
  [/\bA critical hit!\b/gi, "급소에 맞았다!"],
  [/\bThe opposing ([^\n]+) used ([^!]+)!/gi, "상대 $1의 $2!"],
  [/\b([^\n]+) used ([^!]+)!/gi, "$1의 $2!"],
  [/\bIt's super effective!?\b/gi, "효과가 굉대했다!"],
  [/\bIt's not very effective\.\.\.?/gi, "효과가 별로였다…"],
  [/\bThe attack missed!\b/gi, "공격이 빗나갔다!"],
  [/\b([^\n]+) fainted!\b/gi, "$1는 쓰러졌다!"],
  [/\b([^\n]+) was hurt by poison\b/gi, "$1는 독의 데미지를 입었다!"],
  [/\b([^\n]+) is hurt by its burn\b/gi, "$1는 화상 데미지를 입었다!"],
  [/\b([^\n]+) restored a little HP using its Leftovers!\b/gi, "$1는 먹다남은음식으로 HP를 조금 회복했다!"],
  [/\b([^\n]+)'s ([^\n]+) was raised\b/gi, "$1의 $2이(가) 올라갔다!"],
  [/\b([^\n]+)'s ([^\n]+) was lowered\b/gi, "$1의 $2이(가) 떨어졌다!"],
];

function translateShowdownLog(src){
  let out = src;
  for(const [re,rep] of SHOWDOWN_KR_MAP){
    out = out.replace(re, rep);
  }
  return out;
}

// ---- Simple manual runner ----
function runManualCommand(state, line){
  // Commands:
  // ATTACK <name> <move> <type> <cat> <power>
  const toks = line.trim().split(/\s+/);
  if(toks[0]?.toUpperCase()==="ATTACK"){
    const [,name, moveName, type="Normal", cat="Physical", power="50"] = toks;
    return `${name}의 ${moveName}! (${type}/${cat}/${power})`;
  }
  return "알 수 없는 명령입니다. 예) ATTACK 리자몽 플레어드라이브 Fire Physical 120";
}

// ---- UI binding ----
function el(id){ return document.getElementById(id); }
function fmtPct(x){ return (x*100).toFixed(1)+"%"; }

function collectSide(prefix){
  const name = el(prefix+"Name").value || (prefix==="atk" ? "공격측" : "수비측");
  const level = Number(el(prefix+"Level").value||50);
  const types = [el(prefix+"Type1").value, el(prefix+"Type2").value].filter(Boolean);
  const hp = Number(el(prefix+"HP").value||1);
  const atk = Number(el(prefix+"ATK").value||1);
  const def = Number(el(prefix+"DEF").value||1);
  const spa = Number(el(prefix+"SPA").value||1);
  const spd = Number(el(prefix+"SPD").value||1);
  const spe = Number(el(prefix+"SPE").value||1);
  const otherMod = Number(el(prefix+"Mod").value||1);
  return { name, level, types, stats:{hp,atk,def,spa,spd,spe}, otherMod };
}

function computeAndRender(){
  const atk = collectSide("atk");
  const def = collectSide("def");

  const moveName = el("moveName").value || "기술";
  const moveType = el("moveType").value || "Normal";
  const power = Number(el("movePower").value||1);
  const cat = el("moveCat").value || "Physical";
  const isCrit = el("isCrit").checked;
  const stabOn = el("stabOn").checked;
  const reflect = el("reflect").checked;
  const lightscreen = el("lightscreen").checked;
  const isDouble = el("isDouble").checked;
  const isBurn = el("isBurn").checked;
  const hasGuts = el("hasGuts").checked;
  const weather = el("weather").value;

  const attack = cat==="Physical" ? atk.stats.atk : atk.stats.spa;
  const defense = cat==="Physical" ? def.stats.def : def.stats.spd;

  const {damages, eff, crit} = computeDamage({
    level: atk.level,
    power,
    attack,
    defense,
    category: cat,
    moveType,
    atkTypes: atk.types,
    defTypes: def.types,
    opts:{
      isCrit, stabOn, reflect, lightscreen, isDouble, isBurn, hasGuts, weather,
      otherModAtk: atk.otherMod, otherModDef: def.otherMod, otherModMove: Number(el("moveMod").value||1)
    }
  });

  const {range, oneHit, twoHit} = koChances(damages, def.stats.hp, Number(el("leftovers").value||0));
  el("outRange").textContent = `${range[0]} ~ ${range[1]} (${(range[0]/def.stats.hp*100).toFixed(1)}% ~ ${(range[1]/def.stats.hp*100).toFixed(1)}%)`;
  el("outOHKO").innerHTML = `OHKO: <span class="${oneHit>0.5?'ohko':oneHit>0?'low':'bad'}">${fmtPct(oneHit)}</span>  /  2HKO: ${fmtPct(twoHit)}`;

  const effLine = effectText(eff);
  const critLine = crit ? "급소에 맞았다!" : "";
  const msg = `${atk.name}의 ${moveName}! ${effLine}${effLine && critLine ? " " : ""}${critLine}\n→ ${def.name}에게 ${range[0]}~${range[1]} 대미지.`;
  el("outLog").textContent = msg;
}

function setup(){
  // Populate type selects
  for(const s of document.querySelectorAll('.type-select')){
    s.innerHTML = `<option value=\"\">—</option>` + Object.keys(TYPE_CHART).map(t=>`<option>${t}</option>`).join("");
  }
  // Bind compute
  for(const id of ['moveName','moveType','movePower','moveCat','isCrit','stabOn','reflect','lightscreen','isDouble','isBurn','hasGuts','weather','atkName','atkLevel','atkType1','atkType2','atkHP','atkATK','atkDEF','atkSPA','atkSPD','atkSPE','atkMod','defName','defLevel','defType1','defType2','defHP','defATK','defDEF','defSPA','defSPD','defSPE','defMod','moveMod','leftovers']){
    const n = el(id); if(n) n.addEventListener('input', computeAndRender);
  }
  // Translator
  el("btnTranslate").addEventListener('click', ()=>{
    el("krLog").value = translateShowdownLog(el("enLog").value || "");
  });
  // Manual runner
  el("btnRun").addEventListener('click', ()=>{
    const line = el("cmd").value || "";
    const res = runManualCommand({}, line);
    el("runLog").textContent += (res+"\n");
  });

  // Initial compute
  computeAndRender();
}
window.addEventListener('DOMContentLoaded', setup);
