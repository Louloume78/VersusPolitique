// ==========================================
// OBSERVATOIRE DES VOTES PARLEMENTAIRES
// Module Hémicycle SVG Vectoriel (Chantier 6)
// Projection spatiale à 220°, secteurs proportionnels
// et matérialisation de la discipline de vote
// ==========================================

const HEMICYCLE_CONFIG = {
  width: 560,
  height: 310,
  cx: 280,
  cy: 225,
  rIn: 96,
  rOut: 185,
  coverageDeg: 220, // Arc enveloppant de 220° (de 200° à -20°)
  startDeg: 200,    // 90° + 220° / 2 = 200° (extrême gauche)
  gapDeg: 0.9,      // Espace fin entre deux travées de groupe
  majoritySeats: 289
};

// Liste des groupes ordonnés de gauche à droite sur l'hémicycle
const HEMICYCLE_GROUPS_ORDER = [
  "Gauche Démocrate et Républicaine",
  "La France Insoumise",
  "Les Écologistes",
  "Socialistes",
  "LIOT",
  "Renaissance / EPR",
  "Les Démocrates (MoDem)",
  "Horizons",
  "Droite Républicaine / LR",
  "Union des Droites pour la République (UDR)",
  "Rassemblement National",
  "Non Inscrits"
];

// Sièges de référence pour le tracé de l'hémicycle (Total = 577)
const HEMICYCLE_SEATS_MAP = {
  "Gauche Démocrate et Républicaine": 17,
  "La France Insoumise": 71,
  "Les Écologistes": 38,
  "Socialistes": 66,
  "LIOT": 23,
  "Renaissance / EPR": 94,
  "Les Démocrates (MoDem)": 36,
  "Horizons": 34,
  "Droite Républicaine / LR": 47,
  "Union des Droites pour la République (UDR)": 16,
  "Rassemblement National": 125,
  "Non Inscrits": 10
};

/**
 * Convertit un angle en degrés en radians.
 */
function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calcule les coordonnées cartésiennes d'un point polaire (angle trigonométrique).
 * Dans le repère SVG, l'axe Y est inversé (vers le bas).
 */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = degToRad(angleDeg);
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad)
  };
}

/**
 * Génère le chemin SVG d'un secteur annulaire (donut slice).
 * Comme l'angle décroît de gauche à droite (200° -> -20°),
 * l'arc extérieur se trace dans le sens horaire (sweepFlag = 1).
 */
function describeArcWedge(cx, cy, rIn, rOut, startAngle, endAngle) {
  const p1 = polarToCartesian(cx, cy, rOut, startAngle);
  const p2 = polarToCartesian(cx, cy, rOut, endAngle);
  const p3 = polarToCartesian(cx, cy, rIn, endAngle);
  const p4 = polarToCartesian(cx, cy, rIn, startAngle);

  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOut.toFixed(2)} ${rOut.toFixed(2)} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rIn.toFixed(2)} ${rIn.toFixed(2)} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z'
  ].join(' ');
}

/**
 * Mode d'affichage courant de l'hémicycle ('vote' ou 'partis')
 */
let currentHemiDisplayMode = 'vote';
let HEMICIRCLE_SECTOR_DATA = [];

/**
 * Change le mode d'affichage et rafraîchit l'hémicycle.
 */
function setHemicycleMode(mode) {
  currentHemiDisplayMode = mode;
  document.querySelectorAll('.hemi-toggle-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById(mode === 'partis' ? 'hemiModePartis' : 'hemiModeVote');
  if (btn) btn.classList.add('active');

  if (activeModalScrutin) {
    renderScrutinHemicycle(activeModalScrutin, mode);
  }
}

/**
 * Rendu principal de l'hémicycle parlementaire SVG pour un scrutin donné.
 */
function renderScrutinHemicycle(scrutin, mode = currentHemiDisplayMode) {
  const container = document.getElementById('modalScrutinHemicycleContainer');
  if (!container || !scrutin) return;

  const cfg = HEMICYCLE_CONFIG;
  const totalSeats = 577;
  const deltaR = cfg.rOut - cfg.rIn;

  // Calcul cumulé des voix par position pour le cockpit central
  let totalPourSeats = 0;
  let totalContreSeats = 0;
  let totalAbstSeats = 0;

  HEMICIRCLE_SECTOR_DATA = [];

  let currentAngle = cfg.startDeg;
  let majorityAngle = null;
  let cumulativeSeats = 0;

  // Calcul géométrique de chaque groupe
  HEMICIRCLE_SECTOR_DATA = HEMICYCLE_GROUPS_ORDER.map(groupName => {
    const dg = (scrutin.decompte_groupes && scrutin.decompte_groupes[groupName]) ? scrutin.decompte_groupes[groupName] : null;
    const baseSeats = ((typeof HEMICYCLE_SEATS_MAP !== 'undefined' && HEMICYCLE_SEATS_MAP[groupName]) 
      || (typeof GROUP_SEATS !== 'undefined' && GROUP_SEATS[groupName]) 
      || 15);
    const seats = (dg && dg.total_membres > 1) ? dg.total_membres : baseSeats;
    const fraction = seats / totalSeats;
    const angleSpan = cfg.coverageDeg * fraction;

    const startA = currentAngle;
    const endA = currentAngle - angleSpan;
    const midA = (startA + endA) / 2;

    // Détection du passage du seuil de 289 sièges
    const prevCumulative = cumulativeSeats;
    cumulativeSeats += seats;
    if (prevCumulative < cfg.majoritySeats && cumulativeSeats >= cfg.majoritySeats) {
      const seatsIntoGroup = cfg.majoritySeats - prevCumulative;
      const fracIntoGroup = seatsIntoGroup / seats;
      majorityAngle = startA - angleSpan * fracIntoGroup;
    }

    currentAngle = endA;

    // Données de vote et ventilation des présences
    const pos = scrutin.positions ? scrutin.positions[groupName] : null;
    const coh = (scrutin.cohesions && scrutin.cohesions[groupName] != null) 
      ? Number(scrutin.cohesions[groupName]) 
      : (pos ? 100 : null);

    const p = dg ? (dg.pour || 0) : 0;
    const c = dg ? (dg.contre || 0) : 0;
    const a = dg ? (dg.abstentions || 0) : 0;
    const nv = dg ? (dg.non_votants || 0) : Math.max(0, seats - (p + c + a));
    const presents = p + c + a;
    const presenceRatio = seats > 0 ? (presents / seats) : 0;
    const presencePct = Math.round(presenceRatio * 1000) / 10;

    if (pos === 'POUR') totalPourSeats += seats;
    else if (pos === 'CONTRE') totalContreSeats += seats;
    else if (pos === 'ABSTENTION') totalAbstSeats += seats;

    return {
      groupName,
      seats,
      shortName: (typeof GROUP_SHORT_NAMES !== 'undefined' && GROUP_SHORT_NAMES[groupName]) 
        ? GROUP_SHORT_NAMES[groupName] 
        : (groupName === 'Non Inscrits' ? 'NI' : groupName.substring(0, 4)),
      pos,
      coh,
      dg,
      p, c, a, nv,
      presents,
      presenceRatio,
      presencePct,
      startAngle: startA - (cfg.gapDeg / 2),
      endAngle: endA + (cfg.gapDeg / 2),
      midAngle: midA
    };
  });

  // Construction des éléments SVG
  const isAdopte = (scrutin.sort || '').toLowerCase().includes('adopt');
  const outcomeLabel = isAdopte ? 'ADOPTÉ' : 'REJETÉ';
  const outcomeColor = isAdopte ? 'var(--pour-color, #10b981)' : '#ef4444';

  const syn = scrutin.synthese || {};
  const pourCount = syn.pour != null ? syn.pour : totalPourSeats;
  const contreCount = syn.contre != null ? syn.contre : totalContreSeats;
  const abstCount = syn.abstentions != null ? syn.abstentions : totalAbstSeats;
  const votantsCount = syn.votants != null ? syn.votants : (pourCount + contreCount + abstCount);
  const isMotionCensure = (scrutin.titre || '').toLowerCase().includes('censure') || (scrutin.sort || '').toLowerCase().includes('censure');
  const majRequise = isMotionCensure ? 289 : (votantsCount > 0 ? (Math.floor(votantsCount / 2) + 1) : 0);

  let svgContent = `
    <svg viewBox="0 0 ${cfg.width} ${cfg.height}" class="hemicycle-svg" role="img" aria-label="Hémicycle parlementaire du scrutin ${scrutin.id}">
      <defs>
        <!-- Motif discret pour les députés absents (hachures douces) -->
        <pattern id="hemiAbsentHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" stroke-width="1.2" stroke-opacity="0.35" />
        </pattern>
        <!-- Ombre portée douce pour les jauges et repères -->
        <filter id="hemiGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.15" />
        </filter>
      </defs>

      <!-- Rail d'arrière-plan externe marquant le gabarit de l'hémicycle -->
      <path d="${describeArcWedge(cfg.cx, cfg.cy, cfg.rOut - 1.5, cfg.rOut + 1.5, cfg.startDeg, cfg.startDeg - cfg.coverageDeg)}"
            fill="#e2e8f0" opacity="0.6" />
      <path d="${describeArcWedge(cfg.cx, cfg.cy, cfg.rIn - 1.5, cfg.rIn + 1.5, cfg.startDeg, cfg.startDeg - cfg.coverageDeg)}"
            fill="#e2e8f0" opacity="0.6" />
  `;

  // Rendu des secteurs de groupes
  HEMICIRCLE_SECTOR_DATA.forEach(sec => {
    const { groupName, shortName, seats, pos, dg, p, c, a, nv, presents, presenceRatio, presencePct, startAngle, endAngle, midAngle } = sec;

    // Détermination de la couleur principale
    let mainColor = '#cbd5e1'; // Défaut (non participant)
    let strokeColor = '#94a3b8';
    let isVoted = false;

    if (mode === 'partis') {
      mainColor = (typeof GROUP_COLORS !== 'undefined' && GROUP_COLORS[groupName]) 
        ? GROUP_COLORS[groupName] 
        : '#64748b';
      strokeColor = mainColor;
      isVoted = Boolean(pos && presents > 0);
    } else {
      // Mode 'vote' : Pour = Vert, Contre = Bleu pétrole, Abstention = Ambre
      if (pos === 'POUR') {
        mainColor = '#10b981';
        strokeColor = '#059669';
        isVoted = true;
      } else if (pos === 'CONTRE') {
        mainColor = '#0e7490';
        strokeColor = '#155e75';
        isVoted = true;
      } else if (pos === 'ABSTENTION') {
        mainColor = '#f59e0b';
        strokeColor = '#d97706';
        isVoted = true;
      }
    }

    const isFullyAbsent = (presents === 0);

    svgContent += `
      <g class="hemi-group-sector" 
         data-group="${groupName}" 
         tabindex="0"
         onmouseenter="onHemicycleHover('${groupName}')" 
         onmouseleave="onHemicycleLeave()"
         onclick="highlightGroupRowInTable('${groupName}')">

        <!-- Fond de travée grisé (gabarit 100%) -->
        <path d="${describeArcWedge(cfg.cx, cfg.cy, cfg.rIn, cfg.rOut, startAngle, endAngle)}"
              fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.8" class="hemi-wedge-bg" />
    `;

    if (isFullyAbsent) {
      // Groupe 100% absent : la travée entière conserve sa taille de base normale mais est entièrement hachurée / vide
      const fullAbsentPathD = describeArcWedge(cfg.cx, cfg.cy, cfg.rIn, cfg.rOut, startAngle, endAngle);
      svgContent += `
        <!-- Groupe 100% absent (${seats} député(s)) -->
        <path d="${fullAbsentPathD}" 
              fill="url(#hemiAbsentHatch)" 
              stroke="#cbd5e1" 
              stroke-width="0.8" 
              stroke-dasharray="2 2"
              class="hemi-absent-notch" />
      `;
    } else {
      // Calcul de la hauteur de présence (députés présents vs effectif du groupe)
      const effRatio = Math.max(0.18, Math.min(1.0, presenceRatio));
      const rEff = cfg.rIn + deltaR * effRatio;
      const hasAbsents = (nv > 0 && effRatio < 0.98);

      if (hasAbsents) {
        const absentsPathD = describeArcWedge(cfg.cx, cfg.cy, rEff, cfg.rOut, startAngle, endAngle);
        svgContent += `
          <!-- Frange des absents (${nv} député(s) non votant(s)) -->
          <path d="${absentsPathD}" 
                fill="url(#hemiAbsentHatch)" 
                stroke="#cbd5e1" 
                stroke-width="0.8" 
                stroke-dasharray="2 2"
                class="hemi-absent-notch" />
        `;
      }

      // Corps principal du vote (députés présents)
      const mainPathD = describeArcWedge(cfg.cx, cfg.cy, cfg.rIn, rEff, startAngle, endAngle);
      svgContent += `
        <path d="${mainPathD}" 
              fill="${mainColor}" 
              stroke="${strokeColor}" 
              stroke-width="1.2" 
              class="hemi-main-wedge" />
      `;
    }

    // Étiquette du sigle du groupe au-dessus du secteur
    const labelPos = polarToCartesian(cfg.cx, cfg.cy, cfg.rOut + 14, midAngle);
    svgContent += `
        <text x="${labelPos.x.toFixed(1)}" y="${labelPos.y.toFixed(1)}" 
              class="hemi-group-label" 
              text-anchor="middle" 
              dominant-baseline="central">
          ${shortName}
        </text>
      </g>
    `;
  });

  // Cockpit central interactif (Le Perchoir / Tribune)
  svgContent += `
      <!-- Cockpit d'informations central (Perchoir) -->
      <g id="hemiCenterHud" transform="translate(${cfg.cx}, ${cfg.cy - 10})">
        <!-- État par défaut : Résultat du scrutin et décompte officiel global intégré -->
        <g id="hemiHudDefault">
          <!-- Badge officiel de l'issue finale -->
          <rect x="-54" y="-45" width="108" height="22" rx="11" fill="${isAdopte ? '#ecfdf5' : '#fef2f2'}" 
                stroke="${outcomeColor}" stroke-width="1.6" />
          <text x="0" y="-30" fill="${outcomeColor}" font-size="11.5" font-weight="800" text-anchor="middle">
            ${outcomeLabel}
          </text>

          <!-- Score global chiffré implanté au cœur de l'hémicycle -->
          <g transform="translate(0, -9)">
            <rect x="-88" y="-3" width="176" height="19" rx="5" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
            <text x="-56" y="10.5" fill="#10b981" font-size="11" font-weight="700" text-anchor="middle">
              ● ${pourCount}
            </text>
            <text x="0" y="10.5" fill="#0e7490" font-size="11" font-weight="700" text-anchor="middle">
              ● ${contreCount}
            </text>
            <text x="56" y="10.5" fill="#f59e0b" font-size="11" font-weight="700" text-anchor="middle">
              ● ${abstCount}
            </text>
          </g>

          <!-- Données de participation & quorum -->
          <text x="0" y="27" fill="#334155" font-size="9.5" font-weight="600" text-anchor="middle">
            ${votantsCount} votants / 577 • Maj. requise : ${majRequise}
          </text>
        </g>

        <!-- État dynamique au survol d'un groupe -->
        <g id="hemiHudHover" style="display: none;">
          <text id="hemiHoverGroupName" x="0" y="-44" fill="#0f172a" font-size="12" font-weight="800" text-anchor="middle">-</text>
          <text id="hemiHoverVote" x="0" y="-28" fill="#10b981" font-size="11" font-weight="700" text-anchor="middle">-</text>
          <text id="hemiHoverPresence" x="0" y="-12" fill="#334155" font-size="10" font-weight="600" text-anchor="middle">-</text>
          
          <!-- Décompte précis des voix du groupe -->
          <rect x="-92" y="1" width="184" height="20" rx="5" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text id="hemiHoverCounts" x="0" y="14.5" fill="#475569" font-size="9" font-weight="600" text-anchor="middle">-</text>

          <text id="hemiHoverSeats" x="0" y="36" fill="#64748b" font-size="8.5" text-anchor="middle">-</text>
        </g>
      </g>
    </svg>
  `;

  // Légende explicative sous l'hémicycle
  const legendHtml = `
    <div class="hemi-legend-bar">
      <div class="hemi-legend-item">
        <span class="hemi-legend-dot" style="background:#10b981;"></span>
        <span>Pour</span>
      </div>
      <div class="hemi-legend-item">
        <span class="hemi-legend-dot" style="background:#0e7490;"></span>
        <span>Contre</span>
      </div>
      <div class="hemi-legend-item">
        <span class="hemi-legend-dot" style="background:#f59e0b;"></span>
        <span>Abstention</span>
      </div>
      <div class="hemi-legend-item">
        <span class="hemi-legend-hatch"></span>
        <span>
          Députés absents (hauteur = présence)
        </span>
      </div>
    </div>
  `;

  container.innerHTML = svgContent + legendHtml;
}

/**
 * Gestionnaire de survol d'un groupe dans l'hémicycle.
 */
function onHemicycleHover(groupName) {
  if (!activeModalScrutin || !HEMICIRCLE_SECTOR_DATA) return;
  const sec = HEMICIRCLE_SECTOR_DATA.find(s => s.groupName === groupName);
  if (!sec) return;

  // Mise à jour du cockpit central
  const defHud = document.getElementById('hemiHudDefault');
  const hovHud = document.getElementById('hemiHudHover');
  if (defHud && hovHud) {
    defHud.style.display = 'none';
    hovHud.style.display = 'block';

    const nameEl = document.getElementById('hemiHoverGroupName');
    const voteEl = document.getElementById('hemiHoverVote');
    const presEl = document.getElementById('hemiHoverPresence');
    const countsEl = document.getElementById('hemiHoverCounts');
    const seatsEl = document.getElementById('hemiHoverSeats');

    if (nameEl) nameEl.textContent = `${sec.shortName} (${sec.seats} sièges)`;
    
    if (voteEl) {
      if (sec.presents === 0) {
        voteEl.textContent = 'Non-participant (100% absents)';
        voteEl.setAttribute('fill', '#94a3b8');
      } else if (sec.pos === 'POUR') {
        voteEl.textContent = 'Position majoritaire : POUR';
        voteEl.setAttribute('fill', '#10b981');
      } else if (sec.pos === 'CONTRE') {
        voteEl.textContent = 'Position majoritaire : CONTRE';
        voteEl.setAttribute('fill', '#0e7490');
      } else if (sec.pos === 'ABSTENTION') {
        voteEl.textContent = 'Position majoritaire : ABSTENTION';
        voteEl.setAttribute('fill', '#f59e0b');
      } else {
        voteEl.textContent = 'Non-participant (<3 votants)';
        voteEl.setAttribute('fill', '#94a3b8');
      }
    }

    if (presEl) {
      if (sec.seats > 0) {
        presEl.textContent = `${sec.presents} / ${sec.seats} présents (${sec.presencePct}%) • ${sec.nv} absent(s)`;
      } else {
        presEl.textContent = 'Présence : -';
      }
    }

    if (countsEl) {
      countsEl.innerHTML = `
        <tspan fill="#10b981" font-weight="800">● ${sec.p}</tspan>
        <tspan dx="10" fill="#0e7490" font-weight="800">● ${sec.c}</tspan>
        <tspan dx="10" fill="#f59e0b" font-weight="800">● ${sec.a}</tspan>
        <tspan dx="10" fill="#64748b" font-size="8.5" font-weight="700">● ${sec.nv} abs.</tspan>
      `;
    }

    if (seatsEl) {
      seatsEl.textContent = `${sec.groupName}`;
    }
  }

  // Surbrillance de la ligne correspondante dans le tableau de la modale
  highlightTableRow(groupName);
}

/**
 * Sortie de survol de l'hémicycle : restaure le HUD central par défaut.
 */
function onHemicycleLeave() {
  const defHud = document.getElementById('hemiHudDefault');
  const hovHud = document.getElementById('hemiHudHover');
  if (defHud && hovHud) {
    defHud.style.display = 'block';
    hovHud.style.display = 'none';
  }
  clearTableHighlights();
}

/**
 * Met en surbrillance la ligne du groupe dans la table de la modale.
 */
function highlightTableRow(groupName) {
  const tbody = document.getElementById('modalScrutinTableBody');
  if (!tbody) return;
  Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
    if (tr.dataset && tr.dataset.group === groupName) {
      tr.classList.add('table-row-highlighted');
    } else {
      tr.classList.remove('table-row-highlighted');
    }
  });
}

/**
 * Supprime la surbrillance des lignes de la table.
 */
function clearTableHighlights() {
  const tbody = document.getElementById('modalScrutinTableBody');
  if (!tbody) return;
  Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
    tr.classList.remove('table-row-highlighted');
  });
}

/**
 * Clic sur un groupe : scroll doux et flash sur sa ligne dans la table.
 */
function highlightGroupRowInTable(groupName) {
  const tbody = document.getElementById('modalScrutinTableBody');
  if (!tbody) return;
  const targetTr = Array.from(tbody.querySelectorAll('tr')).find(tr => tr.dataset && tr.dataset.group === groupName);
  if (targetTr) {
    targetTr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    targetTr.classList.add('table-row-highlighted');
  }
}
