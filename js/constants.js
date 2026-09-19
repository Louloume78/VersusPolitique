// ==========================================
// OBSERVATOIRE DES VOTES PARLEMENTAIRES
// Référentiels, constantes politiques et état global
// ==========================================

const POLITICAL_SPECTRUM = [
  "Gauche Démocrate et Républicaine", "La France Insoumise", "Les Écologistes",
  "Socialistes", "LIOT", "Renaissance / EPR", "Les Démocrates (MoDem)",
  "Horizons", "Droite Républicaine / LR", "Union des Droites pour la République (UDR)",
  "Rassemblement National"
];

// Ordre canonique des 12 entités pour les décomptes numériques compacts
const CANONICAL_GROUPS = [
  ...POLITICAL_SPECTRUM,
  "Non Inscrits"
];

/**
 * Hydrate instantanément un scrutin compact en mémoire (<0.002 ms par scrutin).
 * Reconstitue s.positions, s.cohesions et s.decompte_groupes à partir de s.pour, s.contre, s.abst, s.tot.
 */
function hydrateScrutin(s) {
  if (!s || (s.positions && s.decompte_groupes)) return s;
  s.positions = {};
  s.cohesions = {};
  s.decompte_groupes = {};

  const pArr = s.pour || [];
  const cArr = s.contre || [];
  const aArr = s.abst || [];
  const totArr = s.tot || [];

  if (!s.synthese) {
    let totP = 0, totC = 0, totA = 0;
    for (let i = 0; i < pArr.length; i++) {
      totP += (pArr[i] || 0);
      totC += (cArr[i] || 0);
      totA += (aArr[i] || 0);
    }
    s.synthese = {
      pour: totP,
      contre: totC,
      abstentions: totA,
      exprimes: totP + totC,
      votants: totP + totC + totA
    };
  }

  for (let i = 0; i < CANONICAL_GROUPS.length; i++) {
    const g = CANONICAL_GROUPS[i];
    const p = pArr[i] || 0;
    const c = cArr[i] || 0;
    const a = aArr[i] || 0;
    const tot = totArr[i] || (p + c + a);
    const nv = Math.max(0, tot - (p + c + a));

    s.decompte_groupes[g] = {
      pour: p,
      contre: c,
      abstentions: a,
      non_votants: nv,
      total_membres: tot
    };

    const vot = p + c + a;
    if (vot >= 3) {
      if (p >= c && p >= a) {
        s.positions[g] = "POUR";
        s.cohesions[g] = Math.round((p / vot) * 1000) / 10;
      } else if (c >= p && c >= a) {
        s.positions[g] = "CONTRE";
        s.cohesions[g] = Math.round((c / vot) * 1000) / 10;
      } else {
        s.positions[g] = "ABSTENTION";
        s.cohesions[g] = Math.round((a / vot) * 1000) / 10;
      }
    }
  }
  return s;
}

const GROUP_SEATS = {
  "Rassemblement National": 125,
  "Renaissance / EPR": 94,
  "La France Insoumise": 71,
  "Socialistes": 66,
  "Droite Républicaine / LR": 47,
  "Les Écologistes": 38,
  "Les Démocrates (MoDem)": 36,
  "Horizons": 34,
  "LIOT": 23,
  "Gauche Démocrate et Républicaine": 17,
  "Union des Droites pour la République (UDR)": 16
};

const GROUP_COLORS = {
  "Gauche Démocrate et Républicaine": "#b91c1c",
  "La France Insoumise": "#dc2626",
  "Les Écologistes": "#16a34a",
  "Socialistes": "#db2777",
  "LIOT": "#d97706",
  "Renaissance / EPR": "#ca8a04",
  "Les Démocrates (MoDem)": "#ea580c",
  "Horizons": "#0284c7",
  "Droite Républicaine / LR": "#2563eb",
  "Union des Droites pour la République (UDR)": "#1e3a8a",
  "Rassemblement National": "#0f172a",
  "Non Inscrits": "#64748b"
};

const POLITICAL_PALETTE = GROUP_COLORS;

/**
 * Renvoie de manière robuste la couleur officielle d'un parti
 */
function getGroupColor(groupName) {
  if (!groupName) return '#94a3b8';
  if (GROUP_COLORS[groupName]) return GROUP_COLORS[groupName];
  const norm = groupName.toLowerCase().trim();
  for (const [k, v] of Object.entries(GROUP_COLORS)) {
    const kNorm = k.toLowerCase().trim();
    if (kNorm === norm || kNorm.includes(norm) || norm.includes(kNorm)) return v;
  }
  if (norm.includes('rn') || norm.includes('rassemblement')) return GROUP_COLORS["Rassemblement National"];
  if (norm.includes('lfi') || norm.includes('insoumise')) return GROUP_COLORS["La France Insoumise"];
  if (norm.includes('epr') || norm.includes('renaissance') || norm.includes('ensemble')) return GROUP_COLORS["Renaissance / EPR"];
  if (norm.includes('soc') || norm.includes('socialiste')) return GROUP_COLORS["Socialistes"];
  if (norm.includes('lr') || norm.includes('droite')) return GROUP_COLORS["Droite Républicaine / LR"];
  if (norm.includes('eco') || norm.includes('cologiste')) return GROUP_COLORS["Les Écologistes"];
  if (norm.includes('dem') || norm.includes('modem')) return GROUP_COLORS["Les Démocrates (MoDem)"];
  if (norm.includes('hor') || norm.includes('horizons')) return GROUP_COLORS["Horizons"];
  if (norm.includes('liot')) return GROUP_COLORS["LIOT"];
  if (norm.includes('gdr') || norm.includes('communiste')) return GROUP_COLORS["Gauche Démocrate et Républicaine"];
  if (norm.includes('udr') || norm.includes('ciotti')) return GROUP_COLORS["Union des Droites pour la République (UDR)"];
  return '#64748b';
}

const GROUP_AN_SLUGS = {
  "Rassemblement National": "Rassemblement-National",
  "Renaissance / EPR": "Ensemble-pour-la-Republique",
  "La France Insoumise": "La-France-insoumise-Nouveau-Front-Populaire",
  "Socialistes": "Socialistes-et-apparentes",
  "Droite Républicaine / LR": "Droite-Republicaine",
  "Les Écologistes": "ecologiste-et-Social",
  "Les Démocrates (MoDem)": "Les-Democrates",
  "Horizons": "Horizons-Independants",
  "LIOT": "Libertes-Independants-Outre-mer-et-Territoires",
  "Gauche Démocrate et Républicaine": "Gauche-Democrate-et-Republicaine",
  "Union des Droites pour la République (UDR)": "Union-des-droites-pour-la-Republique"
};

const GROUP_SHORT_NAMES = {
  "Gauche Démocrate et Républicaine": "GDR",
  "La France Insoumise": "LFI",
  "Les Écologistes": "ÉCO",
  "Socialistes": "SOC",
  "LIOT": "LIOT",
  "Renaissance / EPR": "EPR",
  "Les Démocrates (MoDem)": "DEM",
  "Horizons": "HOR",
  "Droite Républicaine / LR": "DR",
  "Union des Droites pour la République (UDR)": "UDR",
  "Rassemblement National": "RN"
};

function getGroupLinkHtml(groupName, showSeats = false) {
  const slug = GROUP_AN_SLUGS[groupName];
  const seats = GROUP_SEATS[groupName];
  const seatsBadge = (showSeats && seats) ? ` <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(${seats} sièges)</span>` : '';
  const tooltip = seats ? `${groupName} (${seats} députés) - Fiche officielle AN` : groupName;
  if (!slug) return `<span>${groupName}${seatsBadge}</span>`;
  const url = `https://www.assemblee-nationale.fr/dyn/les-groupes-politiques/${slug}`;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="group-external-link" title="${tooltip}">${groupName} <span class="group-external-icon">↗</span></a>${seatsBadge}`;
}

// Variables d'état partagées dans l'application
let dataset = [];
let fullDataset = null;
let isFullDatasetLoading = false;
let allCommissions = new Set();
let currentOvSort = "spectrum";
let currentHmSortCol = null;
let currentPresetFilter = "MAJOR";
let globalMajorFilterOnly = true;
let lastNonExplorerScope = "MAJOR";
let currentActiveTab = "tab-home";
let currentComparisonData = null;
let currentShareMode = 'comparison'; // 'comparison' ou 'scrutin'
let activeModalScrutin = null;

// ==========================================
// CHANTIER 5 : CONFIGURATION DES GRANDES COALITIONS
// ==========================================
const MAJORITY_ABS_SEATS = 289; // Seuil de majorité absolue à l'AN (sur 577)

const COALITION_PRESETS = {
  leg17_default: {
    id: "leg17_default",
    label: "⭐ 17ᵉ Législature (NFP, Socle Commun Barnier, RN/UDR)",
    coalitions: [
      {
        id: "c_nfp",
        name: "Nouveau Front Populaire (NFP)",
        color: "#dc2626",
        groups: [
          "La France Insoumise",
          "Socialistes",
          "Les Écologistes",
          "Gauche Démocrate et Républicaine"
        ]
      },
      {
        id: "c_socle",
        name: "Socle Commun (Gouvernement)",
        color: "#ca8a04",
        groups: [
          "Renaissance / EPR",
          "Les Démocrates (MoDem)",
          "Horizons",
          "Droite Républicaine / LR"
        ]
      },
      {
        id: "c_national",
        name: "Droites Nationales",
        color: "#0f172a",
        groups: [
          "Rassemblement National",
          "Union des Droites pour la République (UDR)"
        ]
      }
    ]
  },
  leg17_no_lr: {
    id: "leg17_no_lr",
    label: "🏛️ Socle Commun sans LR (Bloc Central autonome)",
    coalitions: [
      {
        id: "c_nfp",
        name: "Nouveau Front Populaire (NFP)",
        color: "#dc2626",
        groups: [
          "La France Insoumise",
          "Socialistes",
          "Les Écologistes",
          "Gauche Démocrate et Républicaine"
        ]
      },
      {
        id: "c_central",
        name: "Bloc Central (EPR + MoDem + Horizons)",
        color: "#0284c7",
        groups: [
          "Renaissance / EPR",
          "Les Démocrates (MoDem)",
          "Horizons"
        ]
      },
      {
        id: "c_national",
        name: "Droites Nationales",
        color: "#0f172a",
        groups: [
          "Rassemblement National",
          "Union des Droites pour la République (UDR)"
        ]
      }
    ]
  },
  bipolar: {
    id: "bipolar",
    label: "⚖️ Bipolarisation (Gauche Unie vs Droite & Centre)",
    coalitions: [
      {
        id: "c_gauche",
        name: "Gauche Réunie",
        color: "#dc2626",
        groups: [
          "La France Insoumise",
          "Socialistes",
          "Les Écologistes",
          "Gauche Démocrate et Républicaine"
        ]
      },
      {
        id: "c_centre_droite",
        name: "Centre & Droites Réunis",
        color: "#2563eb",
        groups: [
          "Renaissance / EPR",
          "Les Démocrates (MoDem)",
          "Horizons",
          "Droite Républicaine / LR",
          "Union des Droites pour la République (UDR)",
          "Rassemblement National"
        ]
      }
    ]
  },
  reset: {
    id: "reset",
    label: "🔄 Réinitialiser (Tous les partis indépendants)",
    coalitions: []
  }
};

let activeScaleMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('obs_scale_mode') : null) || 'groups'; // 'groups' | 'coalitions'
let activeCoalitionsConfig = loadCoalitionsConfig();

function getDefaultCoalitionsConfig() {
  return JSON.parse(JSON.stringify(COALITION_PRESETS.leg17_default.coalitions));
}

function loadCoalitionsConfig() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('obs_custom_coalitions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {
    console.warn("Erreur chargement coalitions sauvegardées :", e);
  }
  return getDefaultCoalitionsConfig();
}

function saveCoalitionsConfig(config) {
  try {
    activeCoalitionsConfig = config;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('obs_custom_coalitions', JSON.stringify(config));
    }
  } catch (e) {
    console.error("Erreur sauvegarde coalitions :", e);
  }
}

function getCoalitionSeats(coalition) {
  if (!coalition || !Array.isArray(coalition.groups)) return 0;
  return coalition.groups.reduce((acc, g) => acc + (GROUP_SEATS[g] || 0), 0);
}

function getActiveEntities() {
  if (activeScaleMode === 'groups') {
    return POLITICAL_SPECTRUM.map(g => ({
      id: g,
      name: g,
      shortName: GROUP_SHORT_NAMES[g] || g,
      color: GROUP_COLORS[g] || '#64748b',
      seats: GROUP_SEATS[g] || 0,
      isCoalition: false,
      groups: [g]
    }));
  }

  // En mode Coalitions : on prend les coalitions configurées + les partis restés hors coalition
  const assigned = new Set();
  const list = [];

  activeCoalitionsConfig.forEach(c => {
    if (c.groups && c.groups.length > 0) {
      c.groups.forEach(g => assigned.add(g));
      list.push({
        id: c.id,
        name: c.name,
        shortName: c.name.length > 18 ? (c.name.split('(')[1]?.replace(')', '') || c.name.substring(0, 12) + '...') : c.name,
        color: c.color || '#64748b',
        seats: getCoalitionSeats(c),
        isCoalition: true,
        groups: [...c.groups]
      });
    }
  });

  // Ajouter les partis indépendants (non assignés à une coalition)
  POLITICAL_SPECTRUM.forEach(g => {
    if (!assigned.has(g)) {
      list.push({
        id: g,
        name: g,
        shortName: GROUP_SHORT_NAMES[g] || g,
        color: GROUP_COLORS[g] || '#64748b',
        seats: GROUP_SEATS[g] || 0,
        isCoalition: false,
        groups: [g]
      });
    }
  });

  return list;
}

