// ════════════════════════════════════════════════════════
//  CELEBRATION EFFECTS
// ════════════════════════════════════════════════════════

const QUOTES_EN = [
  // classics
  "LET'S GOOO! 🔥", "ABSOLUTELY CRUSHING IT!", "UNSTOPPABLE! ⚡",
  "BOOM. DONE. 💥", "YOU'RE ON FIRE! 🔥", "TASK DESTROYED! 💀",
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
];
const QUOTES_FR = [
  // classics
  "TROP FORT(E)! 🔥", "C'EST DANS LA BOÎTE! 💥", "INARRÊTABLE! ⚡",
  "BOOM. FAIT. 💀", "TU DÉCHIRES! 🔥", "TÂCHE ATOMISÉE! 💥",
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
];

const MASCOTS = [
  '🦄','🐉','🦁','🦋','🧜','🧚','🦩','🐸','🦖','🦕',
  '🐙','🦜','🦚','🦝','🦦','🐻‍❄️','🦈','🐳','🦊','🧙',
  '👾','🤖','👻','🚀','🎸','🤩','🥳','💀','👑','🎉',
  '🌊','🔥','🐬','🦸','🌟','🧞','🧝','🦅','🎺','🎯',
  '🦣','🦤','🐲','🧨','💎','🏆','🎆','🎪','⚡','🌈',
];

const PARTICLES = ['⭐','✨','💫','🌟','🎉','🎊','💥','💎','🔥','💜','💛','💚','🏆','⚡'];
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

// ── Public entry point ─────────────────────────────────
export function celebrate(lang = 'en') {
  recordCompletion();
  const quotes  = lang === 'fr' ? QUOTES_FR : QUOTES_EN;
  const quote   = quotes[Math.floor(Math.random() * quotes.length)];
  const stats   = buildStats(lang);
  const mascot  = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
  buildScene(quote, stats, mascot);
}

// ── Scene builder ──────────────────────────────────────
function buildScene(quote, stats, mascot) {
  const ov = el('div', `
    position:fixed;inset:0;z-index:9990;overflow:hidden;cursor:pointer;
    background:rgba(8,4,18,0);
  `);
  document.body.appendChild(ov);

  // Shockwave ring
  const ring = el('div', `
    position:absolute;top:38%;left:50%;
    width:60px;height:60px;border-radius:50%;
    border:6px solid rgba(255,210,60,0.95);
    box-shadow:0 0 30px rgba(255,210,60,0.6);
    transform:translate(-50%,-50%);opacity:0;z-index:9992;
  `);
  ov.appendChild(ring);

  // Rainbow motion streaks
  const streaks = RAINBOW.map((color, i) => {
    const s = el('div', `
      position:absolute;height:8px;width:0;right:0;
      top:calc(38% + ${(i - 2.5) * 16}px);
      background:${color};border-radius:4px;opacity:0;z-index:9991;
    `);
    ov.appendChild(s);
    return s;
  });

  // Unicorn (upper area)
  const unicornWrap = el('div', `
    position:absolute;top:38%;left:50%;z-index:9995;
    filter:drop-shadow(0 0 80px rgba(255,100,220,0.95));
  `);
  ov.appendChild(unicornWrap);
  unicornWrap.appendChild(Object.assign(el('div', `font-size:200px;line-height:1;display:block;`), { textContent: mascot }));

  gsap.set(unicornWrap, {
    xPercent: -50, yPercent: -50,
    x: window.innerWidth * 0.75,
    rotation: 18, scale: 0.4,
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
    font-size:clamp(28px,5.5vw,62px);font-weight:900;
    color:#fff;text-align:center;
    line-height:1.15;letter-spacing:0.04em;
    text-shadow:0 0 80px rgba(255,180,255,0.95),0 3px 28px rgba(0,0,0,0.9);
    font-family:system-ui,sans-serif;
  `);
  const wordSpans = quote.split(' ').map((word, i, arr) => {
    const s = document.createElement('span');
    s.textContent = i < arr.length - 1 ? word + '\u00a0' : word;
    s.style.cssText = 'display:inline-block;white-space:nowrap;';
    quoteEl.appendChild(s);
    return s;
  });
  textBlock.appendChild(quoteEl);
  gsap.set(wordSpans, { opacity: 0, scale: 0.55, y: 10 });

  // Stats (below quote, in same flex container)
  const statsEl = stats ? el('div', `
    font-size:clamp(14px,2.2vw,24px);font-weight:700;
    color:rgba(255,220,100,0.92);text-align:center;
    letter-spacing:0.03em;opacity:0;
    text-shadow:0 2px 16px rgba(0,0,0,0.8);
    font-family:system-ui,sans-serif;
  `) : null;
  if (statsEl) { statsEl.textContent = stats; textBlock.appendChild(statsEl); }

  // ── Timeline ──────────────────────────────────────────
  const tl = gsap.timeline();

  // Dim overlay
  tl.to(ov, { background: 'rgba(8,4,18,0.92)', duration: 0.18, ease: 'power2.out' });

  // Streaks flash (motion blur effect)
  tl.to(streaks, { width: '70vw', opacity: 0.8, duration: 0.22, stagger: 0.018, ease: 'power4.out' }, 0.05);

  // Unicorn shoots in from right
  tl.to(unicornWrap, { x: 0, rotation: -8, scale: 1.12, duration: 0.45, ease: 'power4.out' }, 0.05);

  // Elastic settle + streaks fade
  tl.to(unicornWrap, { scale: 1, rotation: 0, y: 0, duration: 0.65, ease: 'elastic.out(1.3,0.45)' });
  tl.to(streaks, { opacity: 0, duration: 0.25, stagger: 0.02 }, '-=0.55');

  // Shockwave
  tl.to(ring, { width: '90vmax', height: '90vmax', opacity: 0, borderWidth: 1, duration: 0.8, ease: 'power2.out' }, '-=0.55');

  // Particle burst
  tl.call(() => burstParticles(ov, '38%'), [], '-=0.4');

  // ── Quote: words stagger in from small scale ──────────
  tl.to(wordSpans,
    { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: 'back.out(2.2)', stagger: 0.06 },
    '-=0.2'
  );

  // Stats fade up after quote settles
  if (statsEl) {
    tl.fromTo(statsEl,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
      '-=0.15'
    );
  }

  // Unicorn happy dance — longer, more bounces
  tl.to(unicornWrap, { y: -28, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 9 }, '-=0.6');

  // Auto-dismiss after quote has been readable
  tl.call(() => dismiss(), [], '+=1.2');

  // ── Dismiss ───────────────────────────────────────────
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    tl.kill();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('keydown',   onKeyDown);

    gsap.to(quoteEl, { opacity: 0, scale: 1.15, duration: 0.35, ease: 'power2.in' });
    if (statsEl) gsap.to(statsEl, { opacity: 0, duration: 0.25, ease: 'power2.in' });
    gsap.to(unicornWrap, { opacity: 0, duration: 0.3, ease: 'power2.in' });
    // Fill to solid black first, then fade the overlay out — avoids page content bleeding through
    gsap.to(ov, { background: 'rgba(8,4,18,1)', duration: 0.28, ease: 'power1.in' });
    gsap.to(ov, { opacity: 0, duration: 0.55, delay: 0.38, ease: 'power2.inOut', onComplete: () => ov.remove() });
  };

  // Dismiss on mousemove or keydown — but only after minimum 2s
  // so the animation is fully visible before it can be closed
  let acceptInput = false;
  setTimeout(() => { acceptInput = true; }, 2000);
  const onMouseMove = () => { if (acceptInput) dismiss(); };
  const onKeyDown  = () => { if (acceptInput) dismiss(); };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown',   onKeyDown);
  ov.addEventListener('click', dismiss);
}

// ── Particle burst ─────────────────────────────────────
function burstParticles(parent, topPct) {
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist  = 150 + Math.random() * 230;
    const p = el('div', `
      position:absolute;top:${topPct};left:50%;
      font-size:${18 + Math.random() * 28}px;
      z-index:9994;pointer-events:none;opacity:0;
    `);
    p.textContent = PARTICLES[Math.floor(Math.random() * PARTICLES.length)];
    parent.appendChild(p);

    gsap.fromTo(p,
      { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0, opacity: 0, rotation: -40 },
      {
        x: Math.cos(angle) * dist, y: Math.sin(angle) * dist,
        scale: 1, opacity: 1, rotation: 20 + Math.random() * 80,
        duration: 0.55 + Math.random() * 0.25, ease: 'power2.out',
        onComplete: () => gsap.to(p, {
          opacity: 0, y: '+=35', duration: 0.35,
          delay: 0.25 + Math.random() * 0.3,
          onComplete: () => p.remove(),
        }),
      }
    );
  }
}

function el(tag, css) {
  const d = document.createElement(tag);
  if (css) d.style.cssText = css;
  return d;
}
