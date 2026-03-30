// ════════════════════════════════════════════════════════
//  CELEBRATION EFFECTS
// ════════════════════════════════════════════════════════

// ── Quote management (localStorage + server sync) ─────
let _onSave = null;
export function onQuoteSave(fn) { _onSave = fn; }
function _persist() { if (_onSave) _onSave(); }

// ── Debug hook ─────
let _onDebug = null;
export function onCelebrateDebug(fn) { _onDebug = fn; }
function _reportDebug(quote, mascot, font) { if (_onDebug) _onDebug({ quote, mascot, font, duration: 4.5 }); }

// ── Ban management (fonts & mascots) ───────
export function getBannedFonts() {
  try { return JSON.parse(localStorage.getItem('bannedFonts') || '[]'); } catch { return []; }
}
export function banFont(f) {
  const banned = getBannedFonts();
  if (!banned.includes(f)) { banned.push(f); localStorage.setItem('bannedFonts', JSON.stringify(banned)); _persist(); }
}
export function getBannedMascots() {
  try { return JSON.parse(localStorage.getItem('bannedMascots') || '[]'); } catch { return []; }
}
export function banMascot(m) {
  const banned = getBannedMascots();
  if (!banned.includes(m)) { banned.push(m); localStorage.setItem('bannedMascots', JSON.stringify(banned)); _persist(); }
}

export function getBannedQuotes() {
  try { return JSON.parse(localStorage.getItem('bannedQuotes') || '[]'); } catch { return []; }
}
export function banQuote(q) {
  const banned = getBannedQuotes();
  if (!banned.includes(q)) { banned.push(q); localStorage.setItem('bannedQuotes', JSON.stringify(banned)); _persist(); }
}
export function unbanQuote(q) {
  const arr = getBannedQuotes().filter(b => b !== q);
  localStorage.setItem('bannedQuotes', JSON.stringify(arr)); _persist();
}
export function getCustomQuotes(lang) {
  const key = lang === 'fr' ? 'customQuotesFR' : 'customQuotesEN';
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
export function addCustomQuote(lang, text) {
  const key = lang === 'fr' ? 'customQuotesFR' : 'customQuotesEN';
  const arr = getCustomQuotes(lang);
  if (text && !arr.includes(text)) { arr.push(text); localStorage.setItem(key, JSON.stringify(arr)); _persist(); }
}
export function updateCustomQuote(lang, i, text) {
  const key = lang === 'fr' ? 'customQuotesFR' : 'customQuotesEN';
  const arr = getCustomQuotes(lang);
  if (arr[i] !== undefined) { arr[i] = text; localStorage.setItem(key, JSON.stringify(arr)); _persist(); }
}
export function removeCustomQuote(lang, text) {
  const key = lang === 'fr' ? 'customQuotesFR' : 'customQuotesEN';
  const arr = getCustomQuotes(lang).filter(q => q !== text);
  localStorage.setItem(key, JSON.stringify(arr)); _persist();
}

export const DEFAULT_QUOTES_EN = [
  // classics
  "LET'S GOOO! 🔥", "ABSOLUTELY CRUSHING IT!", "UNSTOPPABLE! ⚡",
  "BOOM. DONE. 💥", "YOU'RE ON FIRE! 🔥", "TASK DESTROYED! 💀",
  "ELITE ENERGY<br>ELITE RESULTS",
  "LEGENDARY! 🏆", "TOO EASY! 😎", "THAT'S THE WAY! ✨",
  "CHAMPION BEHAVIOUR! 👑", "ONE STEP CLOSER! 🚀", "GOAT STATUS! 🐐",
  "ANOTHER ONE BITES THE DUST!", "EFFICIENCY UNLOCKED! 🔓",
  "THE TASK NEVER SAW IT COMING!", "PRODUCTIVITY ACTIVATED! 💡",
  "CEO OF GETTING THINGS DONE!", "BUILT DIFFERENT! 💪",
  "TASK? WHAT TASK? 😤", "THE GRIND NEVER STOPS! ⚙️",
  // sarcastic
  "WOW. A WHOLE TASK. SLOW CLAP. 👏",
  "INCREDIBLE. LITERALLY ONE TASK. 🫡",
  "MARK YOUR CALENDAR. YOU DID THE THING. 📅",
  "GOLD STAR. FOR BEING AVERAGE... ABOVE AVERAGE TODAY. 🌟",
  "TASK DONE. THE BAR WAS LOW BUT YOU CLEARED IT. 🏅",
  "CONGRATULATIONS ON DOING WHAT YOU WERE SUPPOSED TO DO. 🎉",
  "THE TASK IS GONE. NOT YOUR PROBLEMS, BUT THE TASK. ✅",
  "YOU FINISHED SOMETHING. IN THIS ECONOMY. RESPECT. 💸",
  "WILD. IT'S DONE. NOBODY SAW THAT COMING. 😐",
  "MINIMUM VIABLE PRODUCTIVITY? UNLOCKED. 🔓",
  // current events
  "ELON WOULD'VE CUT THIS TASK AND CALLED IT DONE. YOU ACTUALLY DID IT. 🤌",
  "UNLIKE CONGRESS, YOU GOT SOMETHING DONE TODAY. HISTORIC. 🏛️",
  "DOGE EFFICIENCY? ADORABLE. THIS IS THE REAL THING. 🐕",
  "AI COULDN'T AUTOMATE THIS ONE. SKILL ISSUE FOR THE ROBOTS. 🤖",
  "CHATGPT COULDN'T HAVE DONE THIS. WELL. MAYBE. BUT YOU'RE HERE. 🧠",
  "BITCOIN DOESN'T PUMP THIS FAST. 📈",
  "COMPLETED FASTER THAN A GOVERNMENT WEBSITE LOADS. 🐌",
  "WHILE THE WORLD DOOMSCROLLS, YOU EXECUTE. DIFFERENT BREED. 📱",
  "NO LAYOFF NOTICE HERE. JUST RESULTS. 💼",
  "SOLVED MORE IN ONE CLICK THAN A UN CLIMATE SUMMIT. ♻️",
  "TESLA AUTOPILOT WOULD'VE CRASHED. YOU DELIVERED. 🚗",
  "AI TOOK YOUR JOB? JOKES ON THEM. YOU'RE STILL FASTER. 🤖",
  "EVEN CHATGPT IS IMPRESSED. AND IT HALLUCINATED THIS COMPLIMENT. 🧠",
  "TASK COMPLETED. UNLIKE MOST GOVERNMENT REFORMS. ✅",
  "YOU SHIPPED. UNLIKE HALF THE TECH INDUSTRY THIS QUARTER. 🚀",
  "NO MEETING REQUIRED. NO CONSULTANT HIRED. JUST DONE. 📊",
  "PRODUCTIVITY THAT WOULD MAKE A LINKEDIN BRO CRY. 😢",
  "REMOTE, HYBRID, OR OFFICE — DOESN'T MATTER. YOU'RE UNMATCHED. 🏢",
  "TASK ANNIHILATED. THE ALGORITHM DIDN'T PREDICT THIS. 📡",
  "YOU DID MORE THAN MOST APPS DO IN A FULL RELEASE CYCLE. 🛸",
  // Chuck Norris
  "CHUCK NORRIS WRITES HIS TODO LIST AFTER IT'S ALREADY DONE.",
  "CHUCK NORRIS DOESN'T MARK TASKS COMPLETE. TASKS SURRENDER.",
  "CHUCK NORRIS ONCE PROCRASTINATED. THE UNIVERSE REBOOTED.",
  "THIS TASK FEARED YOU BEFORE THE APP EVEN OPENED. 😤",
  "TASKS DON'T GET COMPLETED HERE. THEY GET DEFEATED. 🥊",
  "CHUCK NORRIS STARED AT A BLANK TODO LIST. IT FILLED ITSELF.",
  "CHUCK NORRIS DOESN'T USE REMINDERS. DEADLINES REMIND HIM.",
  "THE TASK DIDN'T WANT TO DIE. IT HAD NO CHOICE.",
  // absurd / thoughtful
  "THE TASK IS DONE. THE TASK WAS ALWAYS DONE. TIME IS AN ILLUSION.",
  "SISYPHUS WOULD HAVE KILLED FOR A CHECKBOX LIKE THAT.",
  "THE VOID STARED BACK. YOU CROSSED IT OFF ANYWAY.",
  "IF A TASK IS CHECKED AND NO ONE SEES IT — YOU STILL FEEL IT. 🧘",
  "SOMEWHERE A PHILOSOPHER IS WRITING A THESIS ON THIS MOMENT.",
  "SUN TZU WROTE 'THE ART OF WAR'. YOU WROTE 'THE ART OF DONE'.",
  "COGITO ERGO COMPLETO. I THINK, THEREFORE I SHIP.",
  "DOPAMINE IS TEMPORARY. THE CHECKMARK IS FOREVER.",
  "OTHER TASKS WATCH. AND TREMBLE.",
  "THE UNIVERSE DIDN'T ASK FOR YOUR EFFICIENCY. IT GOT IT ANYWAY.",
  "SOMEWHERE, A TASK IS CRYING. YOU DID THAT.",
  "NIETZSCHE SAID: BECOME WHO YOU ARE. THIS IS IT.",
  "EXISTENCE IS A LOOP. YOU JUST BROKE IT.",
  "A TASK COMPLETED IS A SMALL ACT OF REBELLION AGAINST ENTROPY.",
  "THE GREEKS HAD A WORD FOR THIS. IT WAS PROBABLY NICE.",
  "THIS IS NOT PRODUCTIVITY. THIS IS ART.",
];
export const DEFAULT_QUOTES_FR = [
  // classics
  "TROP FORT(E)! 🔥", "C'EST DANS LA BOÎTE! 💥", "INARRÊTABLE! ⚡",
  "BOOM. FAIT. 💀", "TU DÉCHIRES! 🔥", "TÂCHE ATOMISÉE! 💥",
  "ÉNERGIE D'ÉLITE<br>RÉSULTATS D'ÉLITE",
  "LÉGENDAIRE! 🏆", "TROP FACILE! 😎", "C'EST TOI LE BOSS! 👑",
  "EN PLEINE FORME! 🚀", "CHAMPION(NE)! 🐐", "RIEN NE T'ARRÊTE! ✨",
  "LA TÂCHE N'A RIEN VU VENIR!", "MODE BÊTE DE TRAVAIL ACTIVÉ! 🦁",
  "PDG DE LA PRODUCTIVITÉ! 💼", "T'ES CAPABLE, ON LÂCHE PAS! 💪",
  "CONSTRUIT(E) DIFFÉREMMENT! 💪", "LA ROUTINE? MAÎTRISÉE!",
  "TÂCHE? QUELLE TÂCHE? 😤", "L'EFFICACITÉ INCARNÉE! ⚙️",
  // sarcastiques
  "WAHOU. UNE TÂCHE ENTIÈRE. APPLAUDISSEMENTS POLIS. 👏",
  "INCROYABLE. LITTÉRALEMENT UNE TÂCHE. 🫡",
  "MARQUE LA DATE. T'AS FAIT LE TRUC. 📅",
  "LA BARRE ÉTAIT BASSE MAIS T'AS SAUTÉ HAUT. 🏅",
  "FÉLICITATIONS POUR AVOIR FAIT CE QUE T'ÉTAIS CENSÉ(E) FAIRE. 🎉",
  "LA TÂCHE EST PARTIE. PAS TES PROBLÈMES, MAIS LA TÂCHE. ✅",
  "T'AS FINI QUELQUE CHOSE. EN 2026. CHAPEAU. 💸",
  "DINGUE. C'EST FAIT. PERSONNE AVAIT VU ÇA VENIR. 😐",
  "PRODUCTIVITÉ MINIMALE VIABLE? DÉBLOQUÉE. 🔓",
  "UNE ÉTOILE. POUR AVOIR ÉTÉ... EN DESSUS DE LA MOYENNE AUJOURD'HUI. 🌟",
  // actu
  "L'IA PENSAIT TE REMPLACER. T'AS JUSTE PROUVÉ QUE NON. 🤖",
  "CONTRAIREMENT AU GOUVERNEMENT, T'AS RESPECTÉ LE DÉLAI. 🏛️",
  "ELON MUSK EN AURAIT SUPPRIMÉ 80% ET APPELÉ ÇA FAIT. TOI T'AS TOUT FINI. 🤌",
  "BITCOIN VARIE MOINS VITE QUE TOI T'AVANCES. 📈",
  "PENDANT QUE TOUT LE MONDE SCROLLE, TOI T'EXÉCUTES. DIFFÉRENT(E). 📱",
  "LA RÉFORME? PAS RÉGLÉE. TA TÂCHE? RÉGLÉE. ✅",
  "MÊME CHAT GPT T'AURAIT PAS RÉPONDU AUSSI VITE. 🧠",
  "CONTRAIREMENT À LA 5G, T'AS TENU TES PROMESSES. 📡",
  "LE CHANGEMENT CLIMATIQUE: NON RÉSOLU. TA TÂCHE: RÉSOLUE. ♻️",
  "PLUS FIABLE QUE LE SITE DES IMPÔTS EN PÉRIODE DE DÉCLARATION. 💻",
  "L'ÉTAT AURAIT MIS 3 ANS À FAIRE ÇA. TOI? UNE SECONDE. ⏱️",
  "PENDANT LA RÉUNION QUI AURAIT PU ÊTRE UN MAIL, TOI T'AVANÇAIS. 📧",
  "T'AS PAS PROCRASTINÉ. PHÉNOMÈNE RARE EN 2026. 🦄",
  "MÊME PAS BESOIN DE CONSULTANT EXTERNE! 💸",
  "LE MONDE BRÛLE MAIS TES TÂCHES SONT FAITES. PRIORITÉS. 🔥",
  "PLUS PRODUCTIF(VE) QUE 95% DES RÉUNIONS HEBDO. 📊",
  "GRÈVE OU PAS, TOI T'ARRÊTES PAS. 💪",
  "LA PROCRASTINATION T'A RATÉ. DOMMAGE POUR ELLE. 😤",
  "EN AVANCE SUR L'IA. POUR L'INSTANT. 🤖",
  "AUCUNE SLIDE POWERPOINT NÉCESSAIRE POUR VALIDER ÇA. 🖥️",
  // Chuck Norris
  "CHUCK NORRIS RÉDIGE SA LISTE APRÈS L'AVOIR FINIE.",
  "CHUCK NORRIS NE COCHE PAS. LES TÂCHES SE RENDENT.",
  "CHUCK NORRIS A PROCRASTINÉ UNE FOIS. L'UNIVERS S'EN REMET ENCORE.",
  "CETTE TÂCHE TE CRAIGNAIT AVANT MÊME QUE TU OUVRES L'APP. 😤",
  "LES TÂCHES NE SONT PAS COMPLÉTÉES ICI. ELLES SONT VAINCUES. 🥊",
  "CHUCK NORRIS FIXE UNE LISTE VIDE. ELLE SE REMPLIT D'ELLE-MÊME.",
  "CHUCK NORRIS N'A PAS DE RAPPELS. LES DEADLINES SE RAPPELLENT À LUI.",
  "LA TÂCHE NE VOULAIT PAS MOURIR. ELLE N'AVAIT PAS LE CHOIX.",
  // absurde / réfléchi
  "LA TÂCHE EST FAITE. ELLE L'A TOUJOURS ÉTÉ. LE TEMPS EST UNE ILLUSION.",
  "SISYPHE AURAIT TOUT DONNÉ POUR UNE CASE À COCHER COMME ÇA.",
  "LE NÉANT T'A REGARDÉ. T'AS COCHÉ QUAND MÊME.",
  "LA DOPAMINE EST TEMPORAIRE. LA COCHE EST ÉTERNELLE.",
  "D'AUTRES TÂCHES REGARDENT. ET TREMBLENT.",
  "SUN TZU A ÉCRIT L'ART DE LA GUERRE. TOI TU MAÎTRISES L'ART DU FAIT.",
  "COGITO ERGO COMPLETO. JE PENSE, DONC JE LIVRE.",
  "QUELQUE PART UN PHILOSOPHE ÉCRIT UNE THÈSE SUR CE MOMENT.",
  "L'UNIVERS N'AVAIT PAS DEMANDÉ TON EFFICACITÉ. IL L'A EU QUAND MÊME.",
  "NIETZSCHE DISAIT: DEVIENS CE QUE TU ES. C'EST FAIT.",
  "L'EXISTENCE EST UNE BOUCLE. TU VIENS DE LA BRISER.",
  "QUELQUE PART, UNE TÂCHE PLEURE. T'AS FAIT ÇA.",
  "UNE TÂCHE COCHÉE EST UN PETIT ACTE DE RÉBELLION CONTRE L'ENTROPIE.",
  "LES GRECS AVAIENT UN MOT POUR ÇA. IL ÉTAIT SÛREMENT BEAU.",
  "CE N'EST PAS DE LA PRODUCTIVITÉ. C'EST DE L'ART.",
];

const FONTS = [
  "'Playfair Display', serif",
  "'Space Grotesk', sans-serif",
  "'Poppins', sans-serif",
  "'Inter', sans-serif",
  "'Raleway', sans-serif",
  "'Montserrat', sans-serif",
  "'Crimson Text', serif",
  "'Bebas Neue', sans-serif",
  "'Oswald', sans-serif",
  "'Fredoka', sans-serif",
];

const MASCOTS = [
  '🦄','🐉','🦁','🦋','🧜','🧚','🦩','🐸','🦖','🦕',
  '🐙','🦜','🦚','🦝','🦦','🐻‍❄️','🦈','🐳','🦊','🧙',
  '👾','🤖','👻','🚀','🎸','🤩','🥳','💀','👑','🎉',
  '🌊','🔥','🐬','🦸','🌟','🧞','🧝','🦅','🎺','🎯',
  '🦣','🦤','🐲','🧨','💎','🏆','🎆','🎪','⚡','🌈',
];

let _lastQuote = null;

const PARTICLES = [
  '⭐','✨','💫','🌟','🎉','🎊','💥','💎','🔥','💜','💛','💚','🏆','⚡',
  '🌈','🎵','🪄','🧨','🎆','🎇','🌸','🦋','🍀','🎯','🥇','🌺','🪅',
  '💝','🎀','🍾','🥂','☄️','🌀','🎭','🎪','🦚','🦜','🐉','🦄',
  '🌻','🌙','☀️','🌠','🏅','🎸','🔮','🪩','🎲','🃏','🌊','🦩',
];
const RAINBOW   = ['#ff0055','#ff6600','#ffcc00','#00cc44','#0099ff','#cc00ff'];

// ── Completion tracking for stats ──────────────────────
const completionLog = []; // timestamps

function recordCompletion() {
  completionLog.push(Date.now());
  // Prune entries older than 1 hour
  const cutoff = Date.now() - 60 * 60 * 1000;
  while (completionLog.length && completionLog[0] < cutoff) completionLog.shift();
}

function buildStats(lang) {
  const now = Date.now();
  const fr = lang === 'fr';
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayCount = completionLog.filter(t => t >= todayStart.getTime()).length;

  const window15 = 15 * 60 * 1000;
  const recent = completionLog.filter(t => now - t <= window15);
  const candidates = [];

  // ── Rate-based projections ─────────────────────────────
  if (recent.length >= 2) {
    const elapsedMs   = Math.max(1000, now - recent[0]);
    const perHour     = Math.round((recent.length / elapsedMs) * 3600000);
    const perDay      = perHour * 8; // 8-hour workday
    const elapsedSec  = Math.round(elapsedMs / 1000);
    const elapsedMin  = Math.round(elapsedMs / 60000);
    const secEach     = Math.round(elapsedMs / recent.length / 1000);
    const elapsedStr  = elapsedSec < 60
      ? (fr ? `${elapsedSec}s` : `${elapsedSec}s`)
      : (fr ? `${elapsedMin} min` : `${elapsedMin} min`);

    if (recent.length >= 3 && perDay >= 20) {
      candidates.push(
        fr ? `${recent.length} en ${elapsedStr} → à ce rythme: ${perDay} tâches aujourd'hui 🤯`
           : `${recent.length} in ${elapsedStr} → at this pace: ${perDay} tasks today 🤯`
      );
    }
    if (perHour >= 10) {
      candidates.push(
        fr ? `Cadence: ${perHour}/heure. Les robots sont jaloux. 🤖`
           : `Pace: ${perHour}/hour. Robots are taking notes. 🤖`
      );
    }
    if (secEach <= 90 && recent.length >= 3) {
      candidates.push(
        fr ? `1 tâche toutes les ${secEach}s. Tu bats des records. ⚡`
           : `1 task every ${secEach}s. Record-breaking speed. ⚡`
      );
    }
    if (perDay >= 50) {
      candidates.push(
        fr ? `Projection: ${perDay} tâches/jour. NASA t'attend. 🚀`
           : `Projected: ${perDay} tasks/day. NASA wants you. 🚀`
      );
    }
    if (perDay >= 100) {
      candidates.push(
        fr ? `À ce rythme tu termines la liste de tes 10 prochaines vies. 😂`
           : `At this rate you'd finish your next 10 lifetimes of todos. 😂`
      );
    }
  }

  // ── Streak / today count ───────────────────────────────
  if (todayCount >= 10) {
    candidates.push(
      fr ? `${todayCount} tâches aujourd'hui. Tu es le/la patron(ne). 👑`
         : `${todayCount} tasks today. Absolutely elite. 👑`
    );
  }
  if (todayCount === 5) {
    candidates.push(
      fr ? `5 aujourd'hui — le chiffre de la perfection! ✋`
         : `5 today — the number of perfection! ✋`
    );
  }
  if (todayCount >= 3 && todayCount < 10) {
    const hoursLeft = 24 - new Date().getHours();
    const projected = todayCount + Math.round((todayCount / (24 - hoursLeft)) * hoursLeft);
    if (projected > todayCount && projected < 200) {
      candidates.push(
        fr ? `${todayCount} faites, ~${projected} projetées d'ici minuit 📈`
           : `${todayCount} done, ~${projected} projected by midnight 📈`
      );
    }
  }
  if (recent.length === 2) {
    candidates.push(
      fr ? `2 d'affilée. Le momentum s'installe. 💨`
         : `2 in a row. Momentum is building. 💨`
    );
  }

  // ── Fun absurd comparisons ─────────────────────────────
  const absurd_en = [
    `Faster than your wifi reconnects. 📶`,
    `Shakespeare wrote Hamlet slower than this.`,
    `At this rate, you'd have built Rome in a day.`,
    `Your to-do list is scared of you.`,
    `HR wants to study you as a productivity specimen.`,
  ];
  const absurd_fr = [
    `Man, y'en font plus de comme toi.`,
    `Plus rapide que ta connexion wifi. 📶`,
    `Molière écrivait moins vite que ça.`,
    `Ta liste de tâches te fait peur.`,
    `Les RH veulent t'étudier comme phénomène.`,
  ];

  if (todayCount >= 2 && candidates.length === 0) {
    const pool = fr ? absurd_fr : absurd_en;
    candidates.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ── Global quotes (set by superadmin, shared across all users) ─
let _globalQuotes = { customFR: [], customEN: [], banned: [] };

// ── Persistent backdrop for slideshow mode ─────────────
let _slideshowBg = null;
export function setGlobalQuotes(g) {
  _globalQuotes = { customFR: [], customEN: [], banned: [], ...g };
}
export function getGlobalQuotes() { return _globalQuotes; }

// ── Preview a specific quote (no recordCompletion) ─────
export function celebrateWithQuote(quote, lang = 'fr') {
  const mascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
  buildScene(quote, null, mascot);
}

// ── Slideshow mode: browse all quotes with nav ──────────
export function celebrateSlideshow(quotes, lang = 'fr', startIdx = 0) {
  if (!quotes.length) return;
  buildSlideshowScene(quotes, lang, startIdx);
}

// ── Public entry point ─────────────────────────────────
export function celebrate(lang = 'en', debug = false) {
  recordCompletion();
  const personalBanned = getBannedQuotes();
  const globalBanned   = _globalQuotes.banned;
  const banned         = [...new Set([...personalBanned, ...globalBanned])];
  const base           = lang === 'fr' ? DEFAULT_QUOTES_FR : DEFAULT_QUOTES_EN;
  const globalCustom   = lang === 'fr' ? (_globalQuotes.customFR || []) : (_globalQuotes.customEN || []);
  const custom         = getCustomQuotes(lang);
  const all            = [...base, ...globalCustom, ...custom];
  const available      = all.filter(q => !banned.includes(q));
  const pool           = available.length > 0 ? available : all; // fallback if all banned

  // Avoid showing same quote twice in a row
  let quote;
  const filtered = _lastQuote ? pool.filter(q => q !== _lastQuote) : pool;
  quote = filtered.length > 0
    ? filtered[Math.floor(Math.random() * filtered.length)]
    : pool[Math.floor(Math.random() * pool.length)];
  _lastQuote = quote;

  const stats     = buildStats(lang);

  // Filter out banned fonts & mascots
  const bannedFonts = getBannedFonts();
  const bannedMascots = getBannedMascots();
  const availableFonts = FONTS.filter(f => !bannedFonts.includes(f));
  const availableMascots = MASCOTS.filter(m => !bannedMascots.includes(m));
  const fontPool = availableFonts.length > 0 ? availableFonts : FONTS;
  const mascotPool = availableMascots.length > 0 ? availableMascots : MASCOTS;

  const mascot = mascotPool[Math.floor(Math.random() * mascotPool.length)];
  const font = fontPool[Math.floor(Math.random() * fontPool.length)];
  if (debug) _reportDebug(quote, mascot, font);
  buildScene(quote, stats, mascot, {}, font);
}

// ── Scene builder ──────────────────────────────────────
// opts: { onNext, onPrev, onClose, counter } — when set, enables slideshow nav mode
function buildScene(quote, stats, mascot, opts = {}, presetFont = null) {
  const isSlideshow = !!(opts.onNext || opts.onPrev);
  const ov = el('div', `
    position:fixed;inset:0;z-index:9990;overflow:hidden;cursor:pointer;
    background:rgba(8,4,18,0);
  `);
  document.body.appendChild(ov);

  // Select font (preset or random)
  const randomFont = presetFont || FONTS[Math.floor(Math.random() * FONTS.length)];

  // Shockwave ring
  const ring = el('div', `
    position:absolute;top:38%;left:50%;
    width:60px;height:60px;border-radius:50%;
    border:6px solid rgba(255,210,60,0.95);
    box-shadow:0 0 30px rgba(255,210,60,0.6);
    transform:translate(-50%,-50%);opacity:0;z-index:9992;
  `);
  ov.appendChild(ring);

  // Rainbow motion streaks (from right)
  const streaks = RAINBOW.map((color, i) => {
    const s = el('div', `
      position:absolute;height:8px;width:0;right:0;
      top:calc(38% + ${(i - 2.5) * 16}px);
      background:${color};border-radius:4px;opacity:0;z-index:9991;
    `);
    ov.appendChild(s);
    return s;
  });

  // Left streaks removed - not needed
  const leftStreaks = [];

  // Unicorn (upper area)
  const unicornWrap = el('div', `
    position:absolute;top:38%;left:50%;z-index:9995;
    filter:drop-shadow(0 0 80px rgba(255,100,220,0.95));
  `);
  ov.appendChild(unicornWrap);
  unicornWrap.appendChild(Object.assign(el('div', `font-size:240px;line-height:1;display:block;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;image-rendering:smooth;`), { textContent: mascot }));

  gsap.set(unicornWrap, {
    xPercent: -50, yPercent: -50,
    x: window.innerWidth * 0.75,
    rotation: 18, scale: 0.8,
  });

  // Text block — quote + stats stacked in flex column to prevent overlap
  const textBlock = el('div', `
    position:absolute;top:66%;left:50%;
    display:flex;flex-direction:column;align-items:center;gap:14px;
    width:90vw;max-width:90vw;z-index:9997;
  `);
  ov.appendChild(textBlock);
  gsap.set(textBlock, { xPercent: -50, yPercent: -50 });

  // Quote (words stagger in from small scale)
  const quoteEl = el('div', `
    font-size:clamp(32px,5.8vw,72px);font-weight:900;
    color:#fff;text-align:center;
    line-height:1.25;letter-spacing:-0.01em;
    text-shadow:0 0 100px rgba(255,180,255,0.98),0 4px 40px rgba(0,0,0,0.95);
    font-family:${randomFont};
  `);

  // Convert periods and commas to line breaks
  const processedQuote = quote.replace(/\. /g, '<br>').replace(/, /g, '<br>');
  let lines = processedQuote.split('<br>').map(s => s.trim());

  // Enforce max 5 words per line for all lines
  lines = lines.map((line) => {
    const words = line.split(/\s+/);
    if (words.length <= 5) return line;

    // Split long line into chunks of max 5 words
    const chunks = [];
    for (let i = 0; i < words.length; i += 5) {
      chunks.push(words.slice(i, i + 5).join(' '));
    }
    return chunks.join('<br>');
  });

  // Flatten after splitting first line
  const allLines = [];
  lines.forEach(line => {
    line.split('<br>').forEach(l => allLines.push(l.trim()));
  });
  const finalLines = allLines;
  let wordSpans = [];

  finalLines.forEach((line, lineIdx) => {
    const lineSpans = line.split(' ').map((word, i, arr) => {
      const s = document.createElement('span');
      s.textContent = i < arr.length - 1 ? word + '\u00a0' : word;
      s.style.cssText = 'display:inline-block;white-space:nowrap;';
      quoteEl.appendChild(s);
      return s;
    });
    wordSpans.push(...lineSpans);

    if (lineIdx < finalLines.length - 1) {
      // Add line break element
      const br = document.createElement('div');
      br.style.cssText = 'width:100%;height:0;line-height:0.6;';
      quoteEl.appendChild(br);
    }
  });

  textBlock.appendChild(quoteEl);
  gsap.set(wordSpans, { opacity: 0, scale: 0.55, y: 10 });

  // Stats (below quote, in same flex container)
  const statsEl = stats ? el('div', `
    font-size:clamp(18px,3.0vw,32px);font-weight:700;
    color:rgba(255,220,100,0.92);text-align:center;
    letter-spacing:0.03em;opacity:0;
    text-shadow:0 2px 16px rgba(0,0,0,0.8);
    font-family:${randomFont};
  `) : null;
  if (statsEl) { statsEl.textContent = stats; textBlock.appendChild(statsEl); }

  // ── Timeline ──────────────────────────────────────────
  const tl = gsap.timeline();

  // Dim overlay
  tl.to(ov, { background: 'rgba(8,4,18,0.92)', duration: 0.18, ease: 'power2.out' });

  // Streaks flash (motion blur effect from right)
  tl.to(streaks, { width: '70vw', opacity: 0.8, duration: 0.22, stagger: 0.018, ease: 'power4.out' }, 0.05);


  // Unicorn shoots in from right
  tl.to(unicornWrap, { x: 0, rotation: -8, scale: 1.2, duration: 0.45, ease: 'power4.out' }, 0.05);

  // Elastic settle
  tl.to(unicornWrap, { scale: 1.0, rotation: 0, y: 0, duration: 0.65, ease: 'elastic.out(1.3,0.45)' });

  // Keep streaks visible until dismiss (fade out in dismiss animation)

  // Shockwave
  tl.to(ring, { width: '90vmax', height: '90vmax', opacity: 0, borderWidth: 1, duration: 0.8, ease: 'power2.out' }, '-=0.55');

  // Particle burst — starts early, particles from all over
  let particles = [];
  tl.call(() => { particles = burstParticles(ov); }, [], 0.05);

  // ── Quote: words stagger in from small scale ──────────
  tl.to(wordSpans,
    { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: 'back.out(2.2)', stagger: 0.06 },
    '0.2'
  );

  // Stats fade up after quote settles — appears sooner
  if (statsEl) {
    tl.fromTo(statsEl,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
      '+=0.2'
    );
  }

  // Unicorn happy dance — longer, more bounces
  tl.to(unicornWrap, { y: -28, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 9 }, '-=0.6');

  // ── Slideshow nav buttons ─────────────────────────────
  const navBtnBase = `
    position:fixed;bottom:32px;
    background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
    border-radius:999px;padding:10px 24px;font-size:20px;font-weight:700;
    cursor:pointer;color:#fff;z-index:9999;opacity:0;
    backdrop-filter:blur(6px);transition:background 0.15s,transform 0.1s;
  `;
  const prevBtn = isSlideshow ? el('button', navBtnBase + 'left:36px;') : null;
  const nextBtn = isSlideshow ? el('button', navBtnBase + 'left:110px;') : null;
  const counterEl = isSlideshow && opts.counter ? el('div', `
    position:fixed;bottom:42px;left:50%;transform:translateX(-50%);
    color:rgba(255,255,255,0.4);font-size:13px;font-weight:600;letter-spacing:.06em;z-index:9999;opacity:0;
  `) : null;
  if (prevBtn) { prevBtn.textContent = '←'; prevBtn.title = 'Précédent (←)'; ov.appendChild(prevBtn); }
  if (nextBtn) { nextBtn.textContent = '→'; nextBtn.title = 'Suivant (→)'; ov.appendChild(nextBtn); }
  if (counterEl) { counterEl.textContent = opts.counter; ov.appendChild(counterEl); }
  [prevBtn, nextBtn].forEach(b => b && (
    b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,0.22)'; b.style.transform = 'scale(1.08)'; }),
    b.addEventListener('mouseleave', () => { b.style.background = 'rgba(255,255,255,0.1)';  b.style.transform = 'scale(1)'; })
  ));

  // Slideshow nav fades in
  if (prevBtn)   tl.to(prevBtn,   { opacity: 1, duration: 0.3 }, '<');
  if (nextBtn)   tl.to(nextBtn,   { opacity: 1, duration: 0.3 }, '<');
  if (counterEl) tl.to(counterEl, { opacity: 1, duration: 0.3 }, '<');

  // Auto-dismiss only in non-slideshow mode
  if (!isSlideshow) tl.call(() => dismiss(), [], '+=4.5');

  // ── Dismiss ───────────────────────────────────────────
  let dismissed = false;
  const dismiss = (callback) => {
    if (dismissed) return;
    dismissed = true;
    tl.kill();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('keydown',   onKeyDown);

    if (callback) {
      // Fast exit for slideshow nav — no black flash
      gsap.to(particles, { opacity: 0, duration: 0.18, ease: 'power2.in' });
      gsap.to(ov, { opacity: 0, duration: 0.18, ease: 'power2.in', onComplete: () => { ov.remove(); callback(); } });
    } else {
      // Mega zoom + fade out effect — diving into rainbow
      gsap.to([quoteEl, statsEl, unicornWrap, particles], { opacity: 0, duration: 0.1, ease: 'none' });
      gsap.to([quoteEl, statsEl, unicornWrap, streaks], { scale: 3, duration: 0.25, ease: 'power2.in' });
      gsap.to(ov, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => ov.remove() });
    }
  };

  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); dismiss(opts.onPrev); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); dismiss(opts.onNext); });

  // Dismiss on mousemove (with distance threshold) or keydown
  let acceptInput = false;
  let moveOrigin = null;
  const MOVE_THRESHOLD = 80;
  setTimeout(() => { acceptInput = true; }, 3500);
  const onMouseMove = (e) => {
    if (!acceptInput || isSlideshow) return;
    if (!moveOrigin) { moveOrigin = { x: e.clientX, y: e.clientY }; return; }
    const dx = e.clientX - moveOrigin.x;
    const dy = e.clientY - moveOrigin.y;
    if (Math.sqrt(dx * dx + dy * dy) >= MOVE_THRESHOLD) dismiss();
  };
  const onKeyDown = (e) => {
    if (isSlideshow) {
      if (e.key === 'ArrowRight') { e.preventDefault(); dismiss(opts.onNext); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); dismiss(opts.onPrev); return; }
      if (e.key === 'Escape') { dismiss(opts.onClose); return; }
      return;
    }
    if (acceptInput) dismiss();
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown',   onKeyDown);
  // In slideshow: click = next
  ov.addEventListener('click', isSlideshow ? () => dismiss(opts.onNext) : dismiss);
}

// ── Particle burst — cannon-style from corners & sides ──
function burstParticles(parent) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const COUNT = 50;
  const particles = [];

  for (let i = 0; i < COUNT; i++) {
    const size = 16 + Math.random() * 28;
    const p = el('div', `
      position:absolute;top:0;left:0;
      font-size:${size}px;z-index:9994;pointer-events:none;
    `);
    p.textContent = PARTICLES[Math.floor(Math.random() * PARTICLES.length)];
    parent.appendChild(p);
    particles.push(p);

    // Launch zone: corners, sides, bottom — like party poppers
    const zone = Math.random();
    let sx, sy;
    if      (zone < 0.22) { sx = W * (Math.random() * 0.18);        sy = H * (0.82 + Math.random() * 0.2); }  // bottom-left
    else if (zone < 0.44) { sx = W * (0.82 + Math.random() * 0.18); sy = H * (0.82 + Math.random() * 0.2); }  // bottom-right
    else if (zone < 0.58) { sx = W * (-0.06);                        sy = H * (0.15 + Math.random() * 0.7); }  // left side
    else if (zone < 0.72) { sx = W * 1.06;                           sy = H * (0.15 + Math.random() * 0.7); }  // right side
    else if (zone < 0.86) { sx = W * (0.25 + Math.random() * 0.5);  sy = H * 1.05; }                          // bottom center
    else                  { sx = W * (0.1 + Math.random() * 0.8);   sy = H * (-0.06); }                        // top (falling down)

    // Arc peak: upper portion of screen
    const px = W * (0.08 + Math.random() * 0.84);
    const py = H * (0.04 + Math.random() * 0.42);

    // Landing zone: spread across mid-lower screen
    const lx = W * (0.05 + Math.random() * 0.9);
    const ly = H * (0.42 + Math.random() * 0.52);

    const spin1 = (280 + Math.random() * 420) * (Math.random() < 0.5 ? 1 : -1);
    const spin2 = (160 + Math.random() * 240) * (Math.random() < 0.5 ? 1 : -1);
    const delay = Math.random() * 1.5;

    gsap.set(p, { x: sx, y: sy, opacity: 0, scale: 0.15, rotation: Math.random() * 360 });

    const tl = gsap.timeline({ delay });

    // Phase 1 — cannon launch (fast, energetic) — SLOWED DOWN
    tl.to(p, {
      x: px, y: py,
      opacity: 1, scale: 1,
      rotation: `+=${spin1}`,
      duration: (0.25 + Math.random() * 0.18) * 1.8,
      ease: 'power2.out',
    });

    // Phase 2 — gravity arc / fall (slower, organic) — SLOWED DOWN
    tl.to(p, {
      x: lx, y: ly,
      rotation: `+=${spin2}`,
      duration: (0.5 + Math.random() * 0.4) * 2.0,
      ease: 'power1.in',
    });

    // Phase 3 — hang in place (stays suspended) — no removal
    tl.to(p, {
      scale: 1 + Math.random() * 0.8,
      opacity: 0.6 + Math.random() * 0.3,
      duration: 1.5 + Math.random() * 1.0,
      delay: 0.5 + Math.random() * 1.0,
      ease: 'power3.inOut',
    });
  }

  return particles;
}

// ── Slideshow scene — persistent backdrop, full effect per slide ─
function buildSlideshowScene(quotes, lang, startIdx) {
  let idx = ((startIdx % quotes.length) + quotes.length) % quotes.length;

  // Persistent near-opaque backdrop stays between slides (no black flash)
  if (!_slideshowBg || !document.body.contains(_slideshowBg)) {
    _slideshowBg = el('div', `
      position:fixed;inset:0;z-index:9988;
      background:rgba(8,4,18,0.95);pointer-events:none;
    `);
    document.body.appendChild(_slideshowBg);
    gsap.fromTo(_slideshowBg, { opacity: 0 }, { opacity: 1, duration: 0.35 });
  }

  const show = () => {
    const mascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
    buildScene(quotes[idx], null, mascot, {
      onNext: () => { idx = (idx + 1) % quotes.length; show(); },
      onPrev: () => { idx = ((idx - 1) + quotes.length) % quotes.length; show(); },
      onClose: () => {
        if (_slideshowBg) {
          gsap.to(_slideshowBg, { opacity: 0, duration: 0.35, onComplete: () => {
            _slideshowBg.remove(); _slideshowBg = null;
          }});
        }
      },
      counter: `${idx + 1} / ${quotes.length}`,
    });
  };
  show();
}

function el(tag, css) {
  const d = document.createElement(tag);
  if (css) d.style.cssText = css;
  return d;
}
