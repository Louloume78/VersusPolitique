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
let currentActiveTab = "tab-home";
let currentComparisonData = null;
let currentShareMode = 'comparison'; // 'comparison' ou 'scrutin'
let activeModalScrutin = null;

