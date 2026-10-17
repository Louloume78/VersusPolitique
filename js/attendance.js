/**
 * Observatoire des Votes Parlementaires — Module Assiduité & Mobilisation
 * ---------------------------------------------------------------------
 * Gère l'analyse de la présence parlementaire :
 * 1. Baromètre comparatif des groupes (Textes majeurs vs marathons d'amendements vs procurations).
 * 2. Députoscope individuel avec filtres instantanés et carte d'identité citoyenne de l'élu.
 * 3. Matrice Quadrant 2D (Piliers, Stratèges, Marathoniens, Fantômes).
 * 4. Scrutins au couteau (votes serrés décidés à <= 10 voix d'écart du fait des absences).
 */

let attendanceData = null;
let attendanceLoading = false;
let currentAttendanceSubView = 'deputes';
let activeGroupsBarometerMetric = 'all'; // 'all' | 'majeurs' | 'physique' | 'procuration'
let isBarometerAnimating = false;
const BAROMETER_ROW_STEP = 54; // Hauteur de rangée (46px) + marge (8px)
let quadrantChartInstance = null;
let selectedDeputy = null;
let currentCouteauSort = 'date'; // 'date' (plus récents d'abord) ou 'diff' (écart de voix)
let currentGroupsTableSort = 'majeurs'; // 'majeurs' | 'global' | 'strategique'

// État des filtres Députoscope
let deputoscopeFilters = {
  search: '',
  group: 'ALL',
  quadrant: 'ALL',
  sort: 'majeurs_desc'
};

const QUADRANT_CONFIG = {
  'Pilier': {
    label: '🏛️ Pilier de l\'Hémicycle',
    badgeClass: 'badge-pilier',
    desc: 'Assiduité remarquable : participation supérieure au 3ᵉ quartile (Top 25%) à la fois sur les textes majeurs et en présence globale.'
  },
  'Fantôme': {
    label: '👻 Décrochage',
    badgeClass: 'badge-fantome',
    desc: 'Participation en net retrait : assiduité inférieure au 1ᵉʳ quartile (Flop 25%) à la fois sur les textes majeurs et en présence globale.'
  },
  'Standard': {
    label: '👤 Activité Régulière',
    badgeClass: 'badge-standard',
    desc: 'Participation intermédiaire et régulière, située dans le cœur d\'activité de l\'Assemblée nationale.'
  }
};

/**
 * Calcule dynamiquement le profil d'un député selon les quartiles Q1 et Q3
 * - Piliers : > Q3 Textes Majeurs ET > Q3 Présence Globale
 * - Décrochage : < Q1 Textes Majeurs ET < Q1 Présence Globale
 * - Activité Régulière : tout le reste (zone centrale et profils intermédiaires)
 */
function getDeputyProfile(dep, medians) {
  if (!dep || !medians) return 'Standard';
  const maj = Number(dep.taux_majeurs) || 0;
  const glob = Number(dep.taux_global) || 0;
  if (maj > medians.q3_majeur && glob > medians.q3_global) {
    return 'Pilier';
  }
  if (maj < medians.q1_majeur && glob < medians.q1_global) {
    return 'Fantôme';
  }
  return 'Standard';
}

/**
 * Récupère les députés du scope de législature actif et actualise dynamiquement leur profil
 */
function getAttendanceDeputes() {
  if (!attendanceData) return [];
  let deps = [];
  if (attendanceData.deputes_by_leg && attendanceData.deputes_by_leg[currentAttendanceLeg]) {
    deps = attendanceData.deputes_by_leg[currentAttendanceLeg];
  } else {
    deps = attendanceData.deputes || [];
  }
  const medians = computeAttendanceMedians(deps);
  deps.forEach(d => {
    d.quadrant = getDeputyProfile(d, medians);
  });
  return deps;
}

/**
 * Récupère les groupes du scope de législature actif
 */
function getAttendanceGroupes() {
  if (!attendanceData) return [];
  if (attendanceData.groupes_by_leg && attendanceData.groupes_by_leg[currentAttendanceLeg]) {
    return attendanceData.groupes_by_leg[currentAttendanceLeg];
  }
  return attendanceData.groupes || [];
}

/**
 * Calcule dynamiquement les médianes pour un échantillon de députés
 */
function computeAttendanceMedians(deputes) {
  if (!deputes || deputes.length === 0) {
    return {
      q1_global: 16.0, median_global: 24.4, q3_global: 32.0,
      q1_majeur: 31.4, median_majeur: 39.0, q3_majeur: 46.7
    };
  }
  const sortedGlobal = deputes.map(d => d.taux_global).sort((a, b) => a - b);
  const sortedMajeur = deputes.map(d => d.taux_majeurs).sort((a, b) => a - b);

  const getPercentile = (arr, p) => {
    const idx = (arr.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return arr[lower] * (1 - weight) + arr[upper] * weight;
  };

  const q1Global = getPercentile(sortedGlobal, 0.25);
  const medGlobal = getPercentile(sortedGlobal, 0.50);
  const q3Global = getPercentile(sortedGlobal, 0.75);

  const q1Majeur = getPercentile(sortedMajeur, 0.25);
  const medMajeur = getPercentile(sortedMajeur, 0.50);
  const q3Majeur = getPercentile(sortedMajeur, 0.75);

  return {
    q1_global: Math.round(q1Global * 10) / 10,
    median_global: Math.round(medGlobal * 10) / 10,
    q3_global: Math.round(q3Global * 10) / 10,
    q1_majeur: Math.round(q1Majeur * 10) / 10,
    median_majeur: Math.round(medMajeur * 10) / 10,
    q3_majeur: Math.round(q3Majeur * 10) / 10
  };
}

/**
 * Bascule la législature active (ALL, 17, 16)
 */
function setAttendanceLegislature(leg) {
  currentAttendanceLeg = leg;

  // Mise à jour de l'état visuel des boutons de législature
  document.querySelectorAll('.attendance-leg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.leg === leg);
  });

  // Synchronisation avec le sélecteur global de législature
  const globalPeriodSelect = document.getElementById('globalPeriodFilter');
  if (globalPeriodSelect) {
    const targetPeriod = leg === '17' ? 'LEG_17' : (leg === '16' ? 'LEG_16' : 'ALL');
    if (globalPeriodSelect.value !== targetPeriod) {
      globalPeriodSelect.value = targetPeriod;
    }
  }

  // Réinitialiser la liste des groupes dans le sélecteur du Députoscope
  const groupSelect = document.getElementById('deputoscopeGroupSelect');
  if (groupSelect) {
    delete groupSelect.dataset.populated;
  }
  deputoscopeFilters.group = 'ALL';

  // Mise à jour du sous-titre de la matrice
  const subEl = document.getElementById('quadrantSubtitle');
  if (subEl) {
    const deps = getAttendanceDeputes();
    const legLabel = leg === 'ALL' ? 'des 16ᵉ & 17ᵉ législatures' : (leg === '17' ? 'de la 17ᵉ Législature (2024-)' : 'de la 16ᵉ Législature (2022-2024)');
    subEl.textContent = `Positionnement des ${deps.length} députés ${legLabel} par rapport aux médianes nationales. Cliquez sur un point pour ouvrir la fiche de l'élu.`;
  }

  // Vérifier si selectedDeputy est toujours valide dans le nouvel effectif
  const currentDeps = getAttendanceDeputes();
  if (selectedDeputy && !currentDeps.some(d => d.id === selectedDeputy.id)) {
    selectedDeputy = currentDeps.length > 0 ? currentDeps[0] : null;
  }

  // Re-rendre la sous-vue active
  renderAttendanceViews();
}

/**
 * Initialise ou bascule sur l'onglet Assiduité
 */
function initAttendanceTab() {
  const globalPeriod = document.getElementById('globalPeriodFilter')?.value;
  if (globalPeriod === 'LEG_17') currentAttendanceLeg = '17';
  else if (globalPeriod === 'LEG_16') currentAttendanceLeg = '16';
  else if (globalPeriod === 'ALL') currentAttendanceLeg = 'ALL';

  // Synchroniser l'état visuel des boutons de législature
  document.querySelectorAll('.attendance-leg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.leg === currentAttendanceLeg);
  });

  loadAttendanceData(() => {
    renderAttendanceViews();
  });
}

/**
 * File d'attente pour les callbacks de chargement asynchrone
 */
let attendanceLoadCallbacks = [];

/**
 * Charge le fichier deputes_assiduite.json de manière sécurisée et idempotente
 */
function loadAttendanceData(callback) {
  if (callback) attendanceLoadCallbacks.push(callback);

  if (attendanceData) {
    const cbs = [...attendanceLoadCallbacks];
    attendanceLoadCallbacks = [];
    cbs.forEach(cb => {
      try { cb(); } catch (e) { console.error("Erreur callback assiduité :", e); }
    });
    return;
  }

  if (attendanceLoading) return;

  attendanceLoading = true;
  const loader = document.getElementById('attendanceLoadingState');
  const content = document.getElementById('attendanceContent');

  if (loader && !attendanceData) {
    loader.style.display = 'block';
    if (content) content.style.display = 'none';
  }

  fetch('deputes_assiduite.json')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return res.json();
    })
    .then(data => {
      attendanceData = data;
      attendanceLoading = false;
      if (loader) loader.style.display = 'none';
      if (content) content.style.display = 'block';
      const cbs = [...attendanceLoadCallbacks];
      attendanceLoadCallbacks = [];
      cbs.forEach(cb => {
        try { cb(); } catch (e) { console.error("Erreur callback assiduité :", e); }
      });
    })
    .catch(err => {
      console.error("Erreur de chargement d'assiduité :", err);
      attendanceLoading = false;
      attendanceLoadCallbacks = [];
      if (loader) {
        loader.innerHTML = `
          <div class="error-banner" style="color: #ef4444; padding: 1.25rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
            ⚠️ Impossible de charger les données d'assiduité (<code>deputes_assiduite.json</code>).
          </div>
        `;
      }
    });
}

/**
 * Bascule entre les 3 sous-vues : groups | deputes | couteau
 */
function switchAttendanceSubView(viewKey) {
  currentAttendanceSubView = viewKey;
  
  // Mise à jour des boutons de sous-navigation
  document.querySelectorAll('.attendance-subnav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewKey);
  });

  // Affichage du bon conteneur
  document.querySelectorAll('.attendance-subview').forEach(view => {
    view.classList.toggle('active', view.id === `subview-${viewKey}`);
  });

  // Synchronisation avec le routeur URL uniquement si on est bien sur l'onglet Assiduité
  if (typeof DeepLinkRouter !== 'undefined' && !DeepLinkRouter.isRoutingInProgress && (typeof currentActiveTab !== 'undefined' && currentActiveTab === 'tab-attendance')) {
    DeepLinkRouter.setParams({ subview: viewKey === 'deputes' ? null : viewKey });
  }

  if (viewKey === 'groups') {
    renderGroupsBarometer();
  } else if (viewKey === 'deputes') {
    renderDeputoscope();
  } else if (viewKey === 'couteau') {
    renderCloseVotes();
  }
}

/**
 * Sélectionne un député par son identifiant officiel (ex: PA795778 ou ID numérique)
 */
function selectDeputyById(depId) {
  if (!depId) return;
  const doSelect = () => {
    const deps = getAttendanceDeputes();
    const cleanId = String(depId).trim().toLowerCase();
    const found = deps.find(d => 
      String(d.id).toLowerCase() === cleanId || 
      String(d.id).replace(/^pa/i, '').toLowerCase() === cleanId ||
      (d.nom && d.nom.toLowerCase().includes(cleanId))
    );
    if (found) {
      selectDeputy(found, true);
      const detailContainer = document.getElementById('deputyDetailContainer');
      if (detailContainer) {
        detailContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  if (attendanceData) {
    doSelect();
  } else {
    loadAttendanceData(() => {
      renderAttendanceViews();
      doSelect();
    });
  }
}

/**
 * Affiche la vue active
 */
function renderAttendanceViews() {
  switchAttendanceSubView(currentAttendanceSubView);
}

/* =========================================================================
   VUE 1 : RADIOGRAPHIE & CULTURE PARLEMENTAIRE DES GROUPES (MACRO)
   ========================================================================= */

/**
 * Redirige instantanément vers le Députoscope avec le groupe ciblé pré-sélectionné
 */
function jumpToDeputoscopeGroup(groupName) {
  switchAttendanceSubView('deputes');
  const groupSelect = document.getElementById('deputoscopeGroupSelect');
  if (groupSelect) groupSelect.value = groupName;
  if (typeof deputoscopeFilters !== 'undefined') {
    deputoscopeFilters.group = groupName;
    deputoscopeFilters.quadrant = 'ALL';
  }
  updateQuadrantLegendActivePill();
  renderQuadrantChart();
  applyDeputoscopeFilters();

  const depSec = document.getElementById('subview-deputes');
  if (depSec) {
    depSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Calcule et renvoie les groupes enrichis avec leurs métriques sociologiques et démocratiques
 */
function getEnrichedAttendanceGroups() {
  const rawGroups = [...getAttendanceGroupes()];
  if (!rawGroups || rawGroups.length === 0) return [];

  const currentDeps = getAttendanceDeputes();

  const groups = rawGroups.map(g => {
    const gDeps = currentDeps.filter(d => d.groupe === g.groupe);
    const totalDeps = gDeps.length || g.effectif || 1;

    // Décompte de la structure interne selon les quartiles (Piliers / Réguliers / Décrochage)
    const nbPiliers = gDeps.filter(d => d.quadrant === 'Pilier').length;
    const nbFantomes = gDeps.filter(d => d.quadrant === 'Fantôme' || d.quadrant === 'Fantome').length;
    const nbStandard = Math.max(0, totalDeps - nbPiliers - nbFantomes);

    const pctPiliers = Math.round((nbPiliers / totalDeps) * 1000) / 10;
    const pctFantomes = Math.round((nbFantomes / totalDeps) * 1000) / 10;
    const pctStandard = Math.round((nbStandard / totalDeps) * 1000) / 10;

    // Ventilation démocratique : Présence physique en personne vs Procurations
    const delegRatio = Math.min(100, Math.max(0, g.taux_delegation || 0)) / 100;
    const tauxPhysique = Math.round(g.taux_global * (1 - delegRatio) * 10) / 10;
    const tauxProcuration = Math.round(g.taux_global * delegRatio * 10) / 10;

    // Ciblage stratégique (effet loupe des textes majeurs vs quotidien)
    const ecartMajeurs = Math.round((g.taux_majeurs - g.taux_global) * 10) / 10;
    const ratioMajeurs = g.taux_global > 0 ? (g.taux_majeurs / g.taux_global) : 1;

    const color = (typeof getGroupColor === 'function') ? getGroupColor(g.groupe) : '#64748b';
    const shortName = (typeof GROUP_SHORT_NAMES !== 'undefined' && GROUP_SHORT_NAMES[g.groupe]) || g.groupe;

    return {
      ...g,
      totalDeps,
      shortName,
      color,
      nbPiliers,
      nbFantomes,
      nbStandard,
      pctPiliers,
      pctFantomes,
      pctStandard,
      tauxPhysique,
      tauxProcuration,
      ecartMajeurs,
      ratioMajeurs
    };
  });

  return groups;
}

/**
 * Change le tri actif pour le tableau comparatif des groupes
 * (NE régénère PAS le baromètre comparatif pour préserver la fluidité)
 */
function setGroupsTableSort(sortKey) {
  if (['majeurs', 'global', 'strategique'].includes(sortKey)) {
    currentGroupsTableSort = sortKey;
    renderGroupsBarometerTable();
  }
}

/**
 * Rendu exclusif du tableau comparatif des groupes
 */
function renderGroupsBarometerTable(providedGroups) {
  const groups = providedGroups || getEnrichedAttendanceGroups();
  if (!groups || groups.length === 0) return;

  const tableGroups = [...groups];
  if (currentGroupsTableSort === 'global') {
    tableGroups.sort((a, b) => b.taux_global - a.taux_global);
  } else if (currentGroupsTableSort === 'strategique') {
    tableGroups.sort((a, b) => (b.ratioMajeurs - a.ratioMajeurs) || (b.ecartMajeurs - a.ecartMajeurs));
  } else {
    // Par défaut : tri par textes majeurs
    tableGroups.sort((a, b) => b.taux_majeurs - a.taux_majeurs);
  }

  // Synchronisation des indicateurs de tri sur les en-têtes de colonnes
  const indMajeurs = document.getElementById('indSortMajeurs');
  const indGlobal = document.getElementById('indSortGlobal');
  const indStrat = document.getElementById('indSortStrategique');
  if (indMajeurs) indMajeurs.textContent = (currentGroupsTableSort === 'majeurs' ? '▼' : '');
  if (indGlobal) indGlobal.textContent = (currentGroupsTableSort === 'global' ? '▼' : '');
  if (indStrat) indStrat.textContent = (currentGroupsTableSort === 'strategique' ? '▼' : '');

  const thMajeurs = document.getElementById('thSortMajeurs');
  const thGlobal = document.getElementById('thSortGlobal');
  const thStrat = document.getElementById('thSortStrategique');
  if (thMajeurs) thMajeurs.classList.toggle('sort-active', currentGroupsTableSort === 'majeurs');
  if (thGlobal) thGlobal.classList.toggle('sort-active', currentGroupsTableSort === 'global');
  if (thStrat) thStrat.classList.toggle('sort-active', currentGroupsTableSort === 'strategique');

  const tbody = document.getElementById('groupsAttendanceTableBody');
  if (tbody) {
    tbody.innerHTML = tableGroups.map(g => {
      const safeGroupName = (g.groupe || '').replace(/'/g, "\\'");
      const isHighFocus = g.ratioMajeurs >= 1.6;

      return `
        <tr>
          <td>
            <div class="group-cell">
              <span class="color-dot" style="background-color: ${g.color};"></span>
              <div class="group-names">
                <span class="group-badge-short">${g.shortName}</span>
                <span class="group-name-full">${g.groupe}</span>
              </div>
            </div>
          </td>
          <td class="num-cell"><strong>${g.totalDeps}</strong></td>
          <td class="num-cell highlight-cell ${currentGroupsTableSort === 'majeurs' ? 'cell-sort-active' : ''}">
            <span class="pct-badge high">${g.taux_majeurs}%</span>
          </td>
          <td class="num-cell ${currentGroupsTableSort === 'global' ? 'cell-sort-active' : ''}">
            <div class="global-presence-wrap">
              <strong>${g.taux_global}%</strong>
              <div class="presence-sub-stats">
                <span class="sub-proc" title="Sur l'ensemble des votes émis par ce groupe, ${g.taux_delegation}% ont été effectués par procuration (délégation)">dont ${g.taux_delegation}% par procuration</span>
              </div>
            </div>
          </td>
          <td style="text-align: center;" class="${currentGroupsTableSort === 'strategique' ? 'cell-sort-active' : ''}">
            <div class="strategy-badge ${isHighFocus ? 'badge-focus-high' : 'badge-focus-norm'}" title="Écart entre textes majeurs et présence globale : +${g.ecartMajeurs} pts (ratio ×${g.ratioMajeurs.toFixed(2)})">
              <span class="badge-ratio">×${g.ratioMajeurs.toFixed(2)}</span>
              <span class="badge-diff">+${g.ecartMajeurs} pts</span>
            </div>
          </td>
          <td>
            <div class="group-structure-wrap">
              <div class="group-structure-bar" title="${g.groupe} : ${g.nbPiliers} Piliers (${g.pctPiliers}%), ${g.nbStandard} Réguliers (${g.pctStandard}%), ${g.nbFantomes} Décrochage (${g.pctFantomes}%)">
                <div class="seg-pilier" style="width: ${g.pctPiliers}%;"></div>
                <div class="seg-standard" style="width: ${g.pctStandard}%;"></div>
                <div class="seg-fantome" style="width: ${g.pctFantomes}%;"></div>
              </div>
              <div class="group-structure-labels">
                <span class="lbl-pilier" title="${g.nbPiliers} députés piliers">${g.pctPiliers}% pil.</span>
                <span class="lbl-standard" title="${g.nbStandard} députés réguliers">${g.pctStandard}% rég.</span>
                <span class="lbl-fantome" title="${g.nbFantomes} députés en décrochage">${g.pctFantomes}% décr.</span>
              </div>
            </div>
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn-jump-deputoscope" onclick="jumpToDeputoscopeGroup('${safeGroupName}')" title="Explorer les ${g.totalDeps} députés de ${g.groupe} dans le Députoscope">
              🔍 Voir élus ➔
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * Calcule l'échelle dynamique et les graduations adaptées (Textes Clés vs Présence Globale)
 */
function getBarometerAxisConfig(metric, groups) {
  const maxVal = (groups && groups.length > 0) ? Math.max(...groups.map(g => Math.max(g.taux_majeurs || 0, g.taux_global || 0)), 50) : 55;
  const max = Math.ceil(maxVal / 10) * 10;
  const ticks = [];
  for (let i = 0; i <= max; i += 10) ticks.push(i);
  return { max, ticks };
}

/**
 * Rendu des boutons de légende / contrôles interactifs
 */
function renderGroupsBarometerControls() {
  const container = document.getElementById('barometerControls');
  if (!container) return;

  const current = activeGroupsBarometerMetric;
  const isAll = (current === 'all');

  container.innerHTML = `
    <div class="barometer-controls-bar">
      <div class="barometer-controls-label">
        <span class="controls-label-title">Métrique affichée :</span>
        <span class="controls-label-hint">Cliquez sur une métrique pour trier et isoler les forces politiques</span>
      </div>
      <div class="barometer-controls-pills">
        <button type="button" class="barometer-pill ${isAll ? 'active' : 'dimmed'}" id="btnBarometer-all" onclick="setGroupsBarometerMetric('all')" title="Afficher les 2 métriques comparatives côte à côte">
          <span class="pill-dot dot-all"></span>
          <span class="pill-name">Vue comparative (2 métriques)</span>
        </button>
        <button type="button" class="barometer-pill ${current === 'majeurs' ? 'active' : (isAll ? '' : 'dimmed')}" id="btnBarometer-majeurs" onclick="setGroupsBarometerMetric('majeurs')" title="Isoler les Textes Clés et trier les groupes">
          <span class="pill-dot dot-majeurs"></span>
          <span class="pill-name">⭐ Textes Clés</span>
        </button>
        <button type="button" class="barometer-pill ${current === 'global' ? 'active' : (isAll ? '' : 'dimmed')}" id="btnBarometer-global" onclick="setGroupsBarometerMetric('global')" title="Isoler la Présence Globale et trier les groupes">
          <span class="pill-dot dot-global"></span>
          <span class="pill-name">🌐 Présence Globale</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Rendu dynamique de l'axe gradué horizontal (graduations & lignes verticales)
 */
function renderGroupsBarometerAxis(config) {
  const gridContainer = document.getElementById('barometerAxisGrid');
  if (!gridContainer) return;

  const { max, ticks } = config;
  gridContainer.innerHTML = `
    <div class="axis-header-row">
      <div class="axis-ticks-container">
        ${ticks.map(t => {
          const leftPct = (t / max) * 100;
          return `
            <div class="axis-tick-wrap" style="left: ${leftPct}%;">
              <span class="axis-tick-lbl">${t}%</span>
              <div class="axis-tick-line"></div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Met à jour l'apparence des boutons de contrôle (actif / estompé sans barrer)
 */
function updateBarometerControlsUI(newMetric) {
  const isAll = (newMetric === 'all');
  const metrics = ['all', 'majeurs', 'global'];
  metrics.forEach(m => {
    const btn = document.getElementById(`btnBarometer-${m}`);
    if (!btn) return;
    btn.classList.remove('active', 'dimmed');
    if (m === newMetric) {
      btn.classList.add('active');
    } else if (!isAll) {
      btn.classList.add('dimmed');
    }
  });
}

/**
 * Tracé initial ou complet du baromètre comparatif des groupes (DOM interactif avec accélération matérielle)
 */
function renderGroupsBarometerChart(groups) {
  const container = document.getElementById('groupsBarometerContainer');
  const rowsWrap = document.getElementById('barometerRowsWrap');
  if (!container || !rowsWrap) return;

  if (!groups || groups.length === 0) {
    groups = getEnrichedAttendanceGroups();
    if (!groups || groups.length === 0) return;
  }

  // 1. Initialiser les boutons de contrôle
  renderGroupsBarometerControls();

  // 2. Initialiser l'axe horizontal gradué
  const axisConfig = getBarometerAxisConfig(activeGroupsBarometerMetric, groups);
  renderGroupsBarometerAxis(axisConfig);

  // 3. Déterminer l'ordre des rangées selon la métrique active
  const sorted = [...groups];
  if (activeGroupsBarometerMetric === 'global') {
    sorted.sort((a, b) => b.taux_global - a.taux_global);
  } else {
    sorted.sort((a, b) => b.taux_majeurs - a.taux_majeurs);
  }

  const isSingle = (activeGroupsBarometerMetric !== 'all');

  // Calibrer la hauteur totale du conteneur parent (positions absolues)
  rowsWrap.style.height = `${sorted.length * BAROMETER_ROW_STEP}px`;

  // 4. Génération des lignes de groupes
  rowsWrap.innerHTML = sorted.map((g, rank) => {
    const safeId = g.groupe.replace(/[^a-zA-Z0-9]/g, '_');
    const partyColor = g.color || '#64748b';

    const singleVal = (activeGroupsBarometerMetric === 'global') ? g.taux_global : g.taux_majeurs;
    const singleWidth = Math.min(100, Math.max(1, (singleVal / axisConfig.max) * 100));
    const isBadgeOutside = singleWidth < 14;

    const majWidth = Math.min(100, Math.max(1, (g.taux_majeurs / axisConfig.max) * 100));
    const globWidth = Math.min(100, Math.max(1, (g.taux_global / axisConfig.max) * 100));
    const majOutside = majWidth < 14;
    const globOutside = globWidth < 14;

    return `
      <div class="barometer-row ${isSingle ? 'is-single' : ''}" id="barometer-row-${safeId}" data-groupe="${g.groupe}" style="transform: translateY(${rank * BAROMETER_ROW_STEP}px);">
        <div class="row-info" title="${g.groupe} (${g.totalDeps} députés)">
          <span class="row-party-rank" id="barometer-rank-${safeId}">#${rank + 1}</span>
          <span class="row-party-dot" style="background-color: ${partyColor};"></span>
          <div class="row-party-text">
            <strong class="row-party-abbr">${g.shortName}</strong>
            <span class="row-party-full">${g.groupe}</span>
          </div>
        </div>
        <div class="row-track">
          <!-- 2 Barres comparatives côte à côte pour la vue d'ensemble (Bleu & Vert) -->
          <div class="row-bars-dual" id="bars-dual-${safeId}">
            <div class="dual-bar-item item-majeurs" onclick="setGroupsBarometerMetric('majeurs')" title="⭐ Textes Clés : ${g.taux_majeurs}% (Cliquer pour isoler)">
              <span class="dual-bar-tag tag-blue">⭐ Clés</span>
              <div class="dual-bar-track">
                <div class="dual-bar-fill fill-blue ${majOutside ? 'val-outside' : ''}" style="width: ${majWidth}%;">
                  <span class="dual-val">${g.taux_majeurs}%</span>
                </div>
              </div>
            </div>
            <div class="dual-bar-item item-global" onclick="setGroupsBarometerMetric('global')" title="🌐 Présence Globale : ${g.taux_global}% (Cliquer pour isoler)">
              <span class="dual-bar-tag tag-green">🌐 Global</span>
              <div class="dual-bar-track">
                <div class="dual-bar-fill fill-green ${globOutside ? 'val-outside' : ''}" style="width: ${globWidth}%;">
                  <span class="dual-val">${g.taux_global}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Barre unique dédiée au morphing d'une métrique isolée (Couleur officielle du parti) -->
          <div class="row-bar-single ${isBadgeOutside ? 'badge-outside' : ''}" id="bar-single-${safeId}" style="background-color: ${partyColor}; width: ${singleWidth}%;">
            <span class="bar-val-badge" id="bar-badge-${safeId}">${singleVal}%</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Transition séquencée et ultra-fluide de l'histogramme des groupes
 * - De 2 métriques vers 1 métrique : Éclosion de la couleur du parti (0ms) ➔ Glissement vertical (300ms)
 * - De 1 métrique vers 2 métriques : Glissement vers Textes Clés (0ms) ➔ Éclosion des 2 barres bleu & vert (320ms)
 * - Entre Textes Clés et Présence Globale : Morphing continu de largeur (100ms) ➔ Glissement vertical (400ms)
 */
function setGroupsBarometerMetric(newMetric) {
  if (isBarometerAnimating) return;

  // Toggle si on reclique sur la métrique isolée déjà active -> retour à 'all'
  if (activeGroupsBarometerMetric === newMetric && newMetric !== 'all') {
    newMetric = 'all';
  }

  const prevMetric = activeGroupsBarometerMetric;
  activeGroupsBarometerMetric = newMetric;
  isBarometerAnimating = true;

  // 1. Immédiat (0ms) : Mise en valeur du bouton cliqué et estompage des autres (sans barrer)
  updateBarometerControlsUI(newMetric);

  const groups = getEnrichedAttendanceGroups();
  if (!groups || groups.length === 0) {
    isBarometerAnimating = false;
    return;
  }

  const axisConfig = getBarometerAxisConfig(newMetric, groups);

  // =========================================================================
  // CAS A : RETOUR À LA VUE COMPARATIVE ("2 métriques" : Bleu & Vert)
  // =========================================================================
  if (newMetric === 'all') {
    // 1. Morph préalable de la barre unique vers Textes Clés pour aligner les repères
    groups.forEach(g => {
      const safeId = g.groupe.replace(/[^a-zA-Z0-9]/g, '_');
      const barSingle = document.getElementById(`bar-single-${safeId}`);
      const badge = document.getElementById(`bar-badge-${safeId}`);
      if (barSingle && badge) {
        const widthPct = Math.min(100, Math.max(1, (g.taux_majeurs / axisConfig.max) * 100));
        barSingle.style.width = `${widthPct}%`;
        badge.textContent = `${g.taux_majeurs}%`;
      }
    });

    // 2. Glissement immédiat des rangées vers l'ordre Textes Clés
    const sorted = [...groups].sort((a, b) => b.taux_majeurs - a.taux_majeurs);
    sorted.forEach((g, rank) => {
      const safeId = g.groupe.replace(/[^a-zA-Z0-9]/g, '_');
      const rowEl = document.getElementById(`barometer-row-${safeId}`);
      const rankEl = document.getElementById(`barometer-rank-${safeId}`);
      if (rowEl) rowEl.style.transform = `translateY(${rank * BAROMETER_ROW_STEP}px)`;
      if (rankEl) rankEl.textContent = `#${rank + 1}`;
    });

    // 3. À 320ms (à mi-glissade) : fondu croisé fluide, la barre unique s'efface et les 2 barres bleu & vert fleurissent
    setTimeout(() => {
      groups.forEach(g => {
        const safeId = g.groupe.replace(/[^a-zA-Z0-9]/g, '_');
        const rowEl = document.getElementById(`barometer-row-${safeId}`);
        if (rowEl) rowEl.classList.remove('is-single');
      });

      setTimeout(() => {
        isBarometerAnimating = false;
      }, 450);
    }, 320);

    return;
  }

  // =========================================================================
  // CAS B : DE "2 MÉTRIQUES" VERS UNE MÉTRIQUE UNIQUE (majeurs ou global)
  // =========================================================================
  if (prevMetric === 'all') {
    const targetKey = (newMetric === 'global') ? 'taux_global' : 'taux_majeurs';

    // 1. Préréglage de la barre unique à la largeur exacte de la métrique ciblée et affichage fondu
    groups.forEach(g => {
      const safeId = g.groupe.replace(/[^a-zA-Z0-9]/g, '_');
      const rowEl = document.getElementById(`barometer-row-${safeId}`);
      const barSingle = document.getElementById(`bar-single-${safeId}`);
      const badge = document.getElementById(`bar-badge-${safeId}`);

      if (barSingle && badge) {
        const val = g[targetKey];
        const widthPct = Math.min(100, Math.max(1, (val / axisConfig.max) * 100));
        barSingle.style.width = `${widthPct}%`;
        barSingle.style.backgroundColor = g.color || '#64748b';
        badge.textContent = `${val}%`;

        if (widthPct < 14) {
          barSingle.classList.add('badge-outside');
        } else {
          barSingle.classList.remove('badge-outside');
        }
      }

      // Fondu croisé CSS doux : la barre unique s'épanouit tandis que les 2 barres s'effacent
      if (rowEl) rowEl.classList.add('is-single');
    });

    // 2. À 300ms : glissement vertical physique des rangées complètes vers leur ordre décroissant
    setTimeout(() => {
      const sorted = [...groups];
      if (newMetric === 'global') {
        sorted.sort((a, b) => b.taux_global - a.taux_global);
      } else {
        sorted.sort((a, b) => b.taux_majeurs - a.taux_majeurs);
      }

      sorted.forEach((g, rank) => {
        const safeId = g.groupe.replace(/[^a-zA-Z0-9]/g, '_');
        const rowEl = document.getElementById(`barometer-row-${safeId}`);
        const rankEl = document.getElementById(`barometer-rank-${safeId}`);
        if (rowEl) rowEl.style.transform = `translateY(${rank * BAROMETER_ROW_STEP}px)`;
        if (rankEl) rankEl.textContent = `#${rank + 1}`;
      });

      setTimeout(() => {
        isBarometerAnimating = false;
      }, 700);
    }, 300);

    return;
  }

  // =========================================================================
  // CAS C : BASCULEMENT ENTRE LES DEUX MÉTRIQUES UNIQUES (de majeurs à global ou inverse)
  // =========================================================================
  // Étape 1 (100ms) : Morphing de largeur de la MÊME barre
  setTimeout(() => {
    groups.forEach(g => {
      const safeId = g.groupe.replace(/[^a-zA-Z0-9]/g, '_');
      const barSingle = document.getElementById(`bar-single-${safeId}`);
      const badge = document.getElementById(`bar-badge-${safeId}`);

      if (barSingle && badge) {
        const val = (newMetric === 'global') ? g.taux_global : g.taux_majeurs;
        const widthPct = Math.min(100, Math.max(1, (val / axisConfig.max) * 100));
        barSingle.style.width = `${widthPct}%`;
        badge.textContent = `${val}%`;

        if (widthPct < 14) {
          barSingle.classList.add('badge-outside');
        } else {
          barSingle.classList.remove('badge-outside');
        }
      }
    });

    // Étape 2 (400ms) : Glissement vertical physique de TOUTE la rangée (étiquette + barre)
    setTimeout(() => {
      const sorted = [...groups];
      if (newMetric === 'global') {
        sorted.sort((a, b) => b.taux_global - a.taux_global);
      } else {
        sorted.sort((a, b) => b.taux_majeurs - a.taux_majeurs);
      }

      sorted.forEach((g, rank) => {
        const safeId = g.groupe.replace(/[^a-zA-Z0-9]/g, '_');
        const rowEl = document.getElementById(`barometer-row-${safeId}`);
        const rankEl = document.getElementById(`barometer-rank-${safeId}`);
        if (rowEl) rowEl.style.transform = `translateY(${rank * BAROMETER_ROW_STEP}px)`;
        if (rankEl) rankEl.textContent = `#${rank + 1}`;
      });

      setTimeout(() => {
        isBarometerAnimating = false;
      }, 700);

    }, 300);

  }, 100);
}

// Exposition globale pour les écouteurs onclick inline
window.setGroupsBarometerMetric = setGroupsBarometerMetric;

function renderGroupsBarometer() {
  const groups = getEnrichedAttendanceGroups();
  if (!groups || groups.length === 0) return;

  // 1. Remplissage des 4 cartes de synthèse collective (KPIs)
  const topMajeurs = groups.reduce((prev, curr) => (curr.taux_majeurs > prev.taux_majeurs ? curr : prev), groups[0]);
  const topGlobal = groups.reduce((prev, curr) => (curr.taux_global > prev.taux_global ? curr : prev), groups[0]);
  const topDelegation = groups.reduce((prev, curr) => (curr.taux_delegation > prev.taux_delegation ? curr : prev), groups[0]);
  const topCiblage = groups.reduce((prev, curr) => (curr.ratioMajeurs > prev.ratioMajeurs ? curr : prev), groups[0]);

  const kpisContainer = document.getElementById('groupsKpisRow');
  if (kpisContainer) {
    kpisContainer.innerHTML = `
      <div class="kpi-card highlight-blue">
        <div class="kpi-icon">⭐</div>
        <div class="kpi-label">Top Mobilisation (Textes Majeurs)</div>
        <div class="kpi-value">${topMajeurs.taux_majeurs}%</div>
        <div class="kpi-sub">${topMajeurs.groupe} (${topMajeurs.totalDeps} élus)</div>
      </div>
      <div class="kpi-card highlight-green">
        <div class="kpi-icon">🌐</div>
        <div class="kpi-label">Plus forte présence globale</div>
        <div class="kpi-value">${topGlobal.taux_global}%</div>
        <div class="kpi-sub">
          ${topGlobal.groupe}
          <span class="kpi-sub-delegation">(dont ${topGlobal.taux_delegation}% par procuration)</span>
        </div>
      </div>
      <div class="kpi-card highlight-amber">
        <div class="kpi-icon">📋</div>
        <div class="kpi-label">Plus fort recours à la procuration</div>
        <div class="kpi-value">${topDelegation.taux_delegation}%</div>
        <div class="kpi-sub">${topDelegation.groupe} (part des votes par délégation)</div>
      </div>
      <div class="kpi-card highlight-purple">
        <div class="kpi-icon">🎯</div>
        <div class="kpi-label">Plus fort ciblage stratégique</div>
        <div class="kpi-value">×${topCiblage.ratioMajeurs.toFixed(2)}</div>
        <div class="kpi-sub">${topCiblage.groupe} (+${topCiblage.ecartMajeurs} pts sur textes clés)</div>
      </div>
    `;
  }

  // 2. Tracé du baromètre comparatif interactif (DOM FLIP)
  renderGroupsBarometerChart(groups);

  // 3. Tableau comparatif des groupes
  renderGroupsBarometerTable(groups);
}

/* =========================================================================
   VUE 2 : LE DÉPUTOSCOPE (MICRO) & MATRICE QUADRANT
   ========================================================================= */

function renderDeputoscope() {
  const currentDeps = getAttendanceDeputes();
  if (!currentDeps || currentDeps.length === 0) return;

  // Initialiser les options de filtre groupe si non fait
  populateDeputoscopeGroupSelect();

  // Tracé du nuage de points Quadrant Chart.js
  renderQuadrantChart();

  // Filtrage et affichage de la liste des députés
  applyDeputoscopeFilters();
}

function populateDeputoscopeGroupSelect() {
  const select = document.getElementById('deputoscopeGroupSelect');
  if (!select || select.dataset.populated) return;

  const currentVal = select.value || 'ALL';
  select.innerHTML = `<option value="ALL">Tous les groupes politiques</option>`;

  const deps = getAttendanceDeputes();
  const groups = [...new Set(deps.map(d => d.groupe))].filter(Boolean).sort();
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    select.appendChild(opt);
  });

  select.value = groups.includes(currentVal) ? currentVal : 'ALL';
  select.dataset.populated = 'true';
}

function renderQuadrantChart() {
  const ctx = document.getElementById('quadrantChart')?.getContext('2d');
  if (!ctx || !attendanceData) return;

  if (quadrantChartInstance) quadrantChartInstance.destroy();

  const currentDeps = getAttendanceDeputes();
  const medians = computeAttendanceMedians(currentDeps);

  // Filtrer les données selon le groupe et le profil (quadrant) sélectionnés
  let filteredDeputes = currentDeps;
  if (deputoscopeFilters.group !== 'ALL') {
    filteredDeputes = filteredDeputes.filter(d => d.groupe === deputoscopeFilters.group);
  }
  if (deputoscopeFilters.quadrant !== 'ALL') {
    const targetQ = (deputoscopeFilters.quadrant === 'Fantôme' || deputoscopeFilters.quadrant === 'Fantome' || deputoscopeFilters.quadrant === 'Décrochage')
      ? ['Fantôme', 'Fantome', 'Décrochage']
      : [deputoscopeFilters.quadrant];
    filteredDeputes = filteredDeputes.filter(d => targetQ.includes(d.quadrant));
  }

  // Calcul des bornes réelles (% mini - 3% à % max + 3%)
  const allMajeurs = currentDeps.map(d => d.taux_majeurs);
  const allGlobal = currentDeps.map(d => d.taux_global);
  const minMajeurs = allMajeurs.length ? Math.min(...allMajeurs) : 0;
  const maxMajeurs = allMajeurs.length ? Math.max(...allMajeurs) : 100;
  const minGlobal = allGlobal.length ? Math.min(...allGlobal) : 0;
  const maxGlobal = allGlobal.length ? Math.max(...allGlobal) : 100;

  // Échelle centrée sur la médiane à 50% de l'axe, bornée de (min - 3%) à (max + 3%)
  function createMedianCenteredScale(minVal, medVal, maxVal) {
    const minAxis = Math.round((minVal - 3) * 10) / 10;
    const maxAxis = Math.round((maxVal + 3) * 10) / 10;
    const med = medVal;

    function forward(v) {
      if (v <= minAxis) return 0;
      if (v >= maxAxis) return 1;
      if (v <= med) {
        return 0.50 * ((v - minAxis) / (med - minAxis));
      } else {
        return 0.50 + 0.50 * ((v - med) / (maxAxis - med));
      }
    }

    function inverse(u) {
      if (u <= 0) return minAxis;
      if (u >= 1) return maxAxis;
      if (u <= 0.50) {
        return minAxis + (u / 0.50) * (med - minAxis);
      } else {
        return med + ((u - 0.50) / 0.50) * (maxAxis - med);
      }
    }

    return { minVal, maxVal, minAxis, maxAxis, med, forward, inverse };
  }

  const scaleX = createMedianCenteredScale(minMajeurs, medians.median_majeur, maxMajeurs);
  const scaleY = createMedianCenteredScale(minGlobal, medians.median_global, maxGlobal);

  // Préparer les points pour le scatter plot projetés sur l'axe centré sur la médiane
  const points = filteredDeputes.map(d => {
    const color = (typeof getGroupColor === 'function') ? getGroupColor(d.groupe) : '#94a3b8';
    return {
      x: scaleX.forward(d.taux_majeurs),
      y: scaleY.forward(d.taux_global),
      realX: d.taux_majeurs,
      realY: d.taux_global,
      deputy: d,
      backgroundColor: color
    };
  });

  // Graduations des axes : min -3%, 25%, Médiane (50%), 75%, max +3%
  const ticksX = [
    { pos: 0.0, label: `${Math.round(scaleX.minAxis)}%` },
    { pos: 0.25, label: `${Math.round(scaleX.inverse(0.25))}%` },
    { pos: 0.50, label: `Médiane : ${scaleX.med}%` },
    { pos: 0.75, label: `${Math.round(scaleX.inverse(0.75))}%` },
    { pos: 1.0, label: `${Math.round(scaleX.maxAxis)}%` }
  ];

  const ticksY = [
    { pos: 0.0, label: `${Math.round(scaleY.minAxis)}%` },
    { pos: 0.25, label: `${Math.round(scaleY.inverse(0.25))}%` },
    { pos: 0.50, label: `Médiane : ${scaleY.med}%` },
    { pos: 0.75, label: `${Math.round(scaleY.inverse(0.75))}%` },
    { pos: 1.0, label: `${Math.round(scaleY.maxAxis)}%` }
  ];

  // Mise à jour dynamique des repères statistiques dans la légende
  const bmMed = document.getElementById('benchmarkMedianeText');
  if (bmMed) {
    bmMed.innerHTML = `Majeurs <strong>${medians.median_majeur}%</strong> • Global <strong>${medians.median_global}%</strong>`;
  }
  const bmQuart = document.getElementById('benchmarkQuartilesText');
  if (bmQuart) {
    bmQuart.innerHTML = `Q1 : <strong>${medians.q1_majeur}%</strong> / <strong>${medians.q1_global}%</strong> • Q3 : <strong>${medians.q3_majeur}%</strong> / <strong>${medians.q3_global}%</strong>`;
  }

  // Mise à jour des compteurs sur les boutons de profils
  const qCounts = {
    ALL: currentDeps.length,
    Pilier: currentDeps.filter(d => d.quadrant === 'Pilier').length,
    Fantome: currentDeps.filter(d => d.quadrant === 'Fantôme' || d.quadrant === 'Fantome').length,
    Standard: currentDeps.filter(d => d.quadrant === 'Standard').length
  };
  const countALL = document.getElementById('qCountALL');
  if (countALL) countALL.textContent = qCounts.ALL;
  const countPilier = document.getElementById('qCountPilier');
  if (countPilier) countPilier.textContent = qCounts.Pilier;
  const countFantome = document.getElementById('qCountFantome');
  if (countFantome) countFantome.textContent = qCounts.Fantome;
  const countStandard = document.getElementById('qCountStandard');
  if (countStandard) countStandard.textContent = qCounts.Standard;

  updateQuadrantLegendActivePill();

  if (typeof Chart === 'undefined') {
    console.warn("Chart.js n'est pas disponible.");
    return;
  }

  // Plugin de traçage des médianes (bleu continu à 50%), quartiles Q1 & Q3 (violet en tiret) et zones
  const quadrantLinesPlugin = {
    id: 'quadrantLinesPlugin',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales: { x, y } } = chart;
      if (!chartArea || !x || !y) return;
      const { top, bottom, left, right } = chartArea;

      // Médiane ancrée exactement à 50% des axes
      const xMed = x.getPixelForValue(0.50);
      const yMed = y.getPixelForValue(0.50);

      // Quartiles proportionnels (non figés sur 1/4)
      const xQ1 = x.getPixelForValue(scaleX.forward(medians.q1_majeur));
      const yQ1 = y.getPixelForValue(scaleY.forward(medians.q1_global));
      const xQ3 = x.getPixelForValue(scaleX.forward(medians.q3_majeur));
      const yQ3 = y.getPixelForValue(scaleY.forward(medians.q3_global));

      ctx.save();

      // 1. Coloration uniquement des deux zones de profils extrêmes (délimitées par les quartiles)
      // Zone Piliers : supérieur droit au-delà de Q3 sur les deux axes (> Q3 Majeurs & > Q3 Global)
      if (xQ3 <= right && yQ3 >= top) {
        ctx.fillStyle = 'rgba(240, 253, 244, 0.65)';
        ctx.fillRect(xQ3, top, right - xQ3, yQ3 - top);
      }

      // Zone Décrochage : inférieur gauche en deçà de Q1 sur les deux axes (< Q1 Majeurs & < Q1 Global)
      if (xQ1 >= left && yQ1 <= bottom) {
        ctx.fillStyle = 'rgba(254, 242, 242, 0.65)';
        ctx.fillRect(left, yQ1, xQ1 - left, bottom - yQ1);
      }

      // 2. Filigranes discrets dans les deux zones de profils
      ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textBaseline = 'middle';

      // Piliers (Haut-Droit)
      ctx.fillStyle = 'rgba(22, 101, 52, 0.65)';
      ctx.textAlign = 'right';
      ctx.fillText('🏛️ PILIERS', right - 12, top + 18);

      // Décrochage (Bas-Gauche)
      ctx.fillStyle = 'rgba(153, 27, 27, 0.65)';
      ctx.textAlign = 'left';
      ctx.fillText('👻 DÉCROCHAGE', left + 12, bottom - 18);

      // 3. Quartiles Q1 et Q3 : violet en tiret
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);

      // Quartiles verticaux (X - Textes Majeurs)
      [xQ1, xQ3].forEach(xv => {
        if (xv >= left && xv <= right) {
          ctx.beginPath();
          ctx.moveTo(xv, top);
          ctx.lineTo(xv, bottom);
          ctx.stroke();
        }
      });

      // Quartiles horizontaux (Y - Présence Globale)
      [yQ1, yQ3].forEach(yv => {
        if (yv >= top && yv <= bottom) {
          ctx.beginPath();
          ctx.moveTo(left, yv);
          ctx.lineTo(right, yv);
          ctx.stroke();
        }
      });

      // 4. Médiane : bleu continu à 50%
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.95)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([]); // continu

      // Médiane verticale (X)
      if (xMed >= left && xMed <= right) {
        ctx.beginPath();
        ctx.moveTo(xMed, top);
        ctx.lineTo(xMed, bottom);
        ctx.stroke();
      }

      // Médiane horizontale (Y)
      if (yMed >= top && yMed <= bottom) {
        ctx.beginPath();
        ctx.moveTo(left, yMed);
        ctx.lineTo(right, yMed);
        ctx.stroke();
      }

      // 5. Badges statistiques clairs le long des axes
      function drawTag(text, px, py, bg, fg, alignX, alignY) {
        ctx.save();
        ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const w = ctx.measureText(text).width + 12;
        const h = 18;
        let bx = px;
        let by = py;

        if (alignX === 'center') bx = px - w / 2;
        else if (alignX === 'right') bx = px - w;
        else if (alignX === 'left') bx = px;

        if (alignY === 'bottom') by = py - h;
        else if (alignY === 'top') by = py;
        else if (alignY === 'middle') by = py - h / 2;

        bx = Math.max(left + 2, Math.min(right - w - 2, bx));
        by = Math.max(top + 2, Math.min(bottom - h - 2, by));

        ctx.fillStyle = bg;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 4);
        else ctx.rect(bx, by, w, h);
        ctx.fill();

        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + w / 2, by + h / 2);
        ctx.restore();
      }

      // Badges Médiane (bleu continu)
      drawTag(`Médiane ${medians.median_majeur}%`, xMed, bottom - 6, '#2563eb', '#ffffff', 'center', 'bottom');
      drawTag(`Médiane ${medians.median_global}%`, left + 6, yMed, '#2563eb', '#ffffff', 'left', 'middle');

      // Badges Quartiles (violet tiret)
      drawTag(`Q1 ${medians.q1_majeur}%`, xQ1, top + 6, '#7c3aed', '#ffffff', 'center', 'top');
      drawTag(`Q3 ${medians.q3_majeur}%`, xQ3, top + 6, '#7c3aed', '#ffffff', 'center', 'top');
      drawTag(`Q1 ${medians.q1_global}%`, right - 6, yQ1, '#7c3aed', '#ffffff', 'right', 'middle');
      drawTag(`Q3 ${medians.q3_global}%`, right - 6, yQ3, '#7c3aed', '#ffffff', 'right', 'middle');

      ctx.restore();
    }
  };

  quadrantChartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Députés',
        data: points,
        pointBackgroundColor: points.map(p => p.backgroundColor),
        pointBorderColor: 'rgba(255, 255, 255, 0.4)',
        pointBorderWidth: 1,
        pointRadius: 4.5,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: true
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const dep = points[index].deputy;
          selectDeputy(dep, true);
        }
      },
      scales: {
        x: {
          min: 0,
          max: 1,
          afterBuildTicks: axis => {
            axis.ticks = ticksX.map(t => ({ value: t.pos, label: t.label }));
          },
          title: {
            display: true,
            text: `Présence Textes Majeurs (%) — Médiane : ${scaleX.med}%`,
            color: '#475569',
            font: { size: 12, weight: '700' }
          },
          ticks: {
            color: '#64748b',
            font: { size: 11, weight: '500' },
            callback: val => {
              const match = ticksX.find(t => Math.abs(t.pos - val) < 0.02);
              return match ? match.label : Math.round(scaleX.inverse(val)) + '%';
            }
          },
          grid: {
            color: context => {
              const val = context.tick ? context.tick.value : null;
              if (val !== null && Math.abs(val - 0.50) < 0.01) return 'rgba(37, 99, 235, 0.4)';
              return 'rgba(226, 232, 240, 0.6)';
            },
            lineWidth: 1
          }
        },
        y: {
          min: 0,
          max: 1,
          afterBuildTicks: axis => {
            axis.ticks = ticksY.map(t => ({ value: t.pos, label: t.label }));
          },
          title: {
            display: true,
            text: `Présence Globale (%) — Médiane : ${scaleY.med}%`,
            color: '#475569',
            font: { size: 12, weight: '700' }
          },
          ticks: {
            color: '#64748b',
            font: { size: 11, weight: '500' },
            callback: val => {
              const match = ticksY.find(t => Math.abs(t.pos - val) < 0.02);
              return match ? match.label : Math.round(scaleY.inverse(val)) + '%';
            }
          },
          grid: {
            color: context => {
              const val = context.tick ? context.tick.value : null;
              if (val !== null && Math.abs(val - 0.50) < 0.01) return 'rgba(37, 99, 235, 0.4)';
              return 'rgba(226, 232, 240, 0.6)';
            },
            lineWidth: 1
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: items => {
              if (!items || items.length === 0) return '';
              const targetPoint = points[items[0].dataIndex];
              const dep = targetPoint.deputy;
              return `${dep.civ} ${dep.nom} (${dep.groupe})`;
            },
            label: item => {
              const targetPoint = points[item.dataIndex];
              const dep = targetPoint.deputy;

              // Compter uniquement les députés ayant EXACTEMENT les mêmes scores (arrondis à 0.1%)
              const strictlyIdentical = points.filter(p =>
                p !== targetPoint &&
                Math.abs(p.realX - targetPoint.realX) < 0.1 &&
                Math.abs(p.realY - targetPoint.realY) < 0.1
              );

              const lines = [
                `Circonscription : ${dep.circo || dep.departement || 'Non renseignée'}`,
                `⭐ Textes Majeurs : ${dep.taux_majeurs}% (${dep.majeurs_votes ?? dep.majeurs ?? 0} / ${dep.majeurs_possibles})`,
                `🌐 Présence Globale : ${dep.taux_global}% (${dep.votes} / ${dep.scrutins_possibles})`,
                `📋 Procuration : ${dep.taux_delegation}% des votes`,
                `Catégorie : ${QUADRANT_CONFIG[dep.quadrant]?.label || dep.quadrant}`
              ];

              if (strictlyIdentical.length > 0) {
                lines.push('');
                lines.push(`ℹ️ Même score partagé avec ${strictlyIdentical.length} autre(s) député(s) :`);
                strictlyIdentical.slice(0, 3).forEach(p => {
                  lines.push(`  • ${p.deputy.nom} (${p.deputy.groupe})`);
                });
                if (strictlyIdentical.length > 3) {
                  lines.push(`  ... et ${strictlyIdentical.length - 3} autres`);
                }
              }

              lines.push('');
              lines.push('👉 Cliquez pour ouvrir sa fiche détaillée');
              return lines;
            }
          }
        }
      }
    },
    plugins: [quadrantLinesPlugin]
  });

  // Mise à jour de la mini-grille responsive de décompte par parti (Option 3)
  renderQuadrantPartyBreakdown();
}

/**
 * Rendu de la mini-grille responsive de décompte par parti politique (Option 3)
 * Présente le baromètre des effectifs de chaque groupe au sein du profil sélectionné.
 * Trié par % décroissant pour refléter fidèlement le poids relatif (ex: 3/10 > 6/50).
 */
function renderQuadrantPartyBreakdown() {
  const container = document.getElementById('quadrantPartyBreakdown');
  if (!container) return;

  const activeQ = deputoscopeFilters.quadrant;
  // Ne pas afficher si "Tous les députés" est sélectionné
  if (!activeQ || activeQ === 'ALL') {
    container.style.display = 'none';
    return;
  }

  const currentDeps = getAttendanceDeputes();
  if (!currentDeps || currentDeps.length === 0) {
    container.style.display = 'none';
    return;
  }

  // 1. Calcul des effectifs totaux par parti sur la cohorte analysée
  const groupTotals = {};
  currentDeps.forEach(d => {
    if (d.groupe) {
      groupTotals[d.groupe] = (groupTotals[d.groupe] || 0) + 1;
    }
  });

  // 2. Définition du filtre selon le profil actif
  const isTargetProfile = (d) => {
    if (activeQ === 'Pilier') {
      return d.quadrant === 'Pilier';
    }
    if (activeQ === 'Fantôme' || activeQ === 'Fantome' || activeQ === 'Décrochage') {
      return d.quadrant === 'Fantôme' || d.quadrant === 'Fantome' || d.quadrant === 'Décrochage';
    }
    if (activeQ === 'Standard') {
      return d.quadrant === 'Standard';
    }
    return false;
  };

  const profileDeps = currentDeps.filter(isTargetProfile);

  // 3. Décompte des députés du profil par parti
  const groupProfileCounts = {};
  profileDeps.forEach(d => {
    if (d.groupe) {
      groupProfileCounts[d.groupe] = (groupProfileCounts[d.groupe] || 0) + 1;
    }
  });

  // 4. Configuration des titres et badges du profil
  const titleEl = document.getElementById('breakdownTitle');
  const badgeEl = document.getElementById('breakdownTotalBadge');
  const subtitleEl = document.getElementById('breakdownSubtitle');

  let profileLabel = 'Profil';
  let profileIcon = '📊';
  if (activeQ === 'Pilier') {
    profileLabel = 'Piliers';
    profileIcon = '🏛️';
  } else if (activeQ === 'Fantôme' || activeQ === 'Fantome' || activeQ === 'Décrochage') {
    profileLabel = 'Décrochage';
    profileIcon = '👻';
  } else if (activeQ === 'Standard') {
    profileLabel = 'Activité Régulière';
    profileIcon = '👤';
  }

  if (titleEl) {
    titleEl.textContent = `${profileIcon} Répartition par groupe politique (${profileLabel})`;
  }
  if (badgeEl) {
    const globalPct = Math.round((profileDeps.length / currentDeps.length) * 100);
    badgeEl.textContent = `${profileDeps.length} députés (${globalPct}% de l'Assemblée)`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = `Part des effectifs de chaque groupe au sein du profil "${profileLabel}" (triée par proportion relative décroissante) :`;
  }

  // 5. Tableau statistique par groupe avec tri par % décroissant
  const stats = Object.keys(groupTotals).map(g => {
    const count = groupProfileCounts[g] || 0;
    const total = groupTotals[g] || 0;
    const pct = total > 0 ? (count / total) * 100 : 0;
    const shortName = (typeof GROUP_SHORT_NAMES !== 'undefined' && GROUP_SHORT_NAMES[g]) || g;
    const color = (typeof getGroupColor === 'function') ? getGroupColor(g) : '#64748b';
    return {
      group: g,
      shortName,
      color,
      count,
      total,
      pct
    };
  });

  // Tri impératif : % décroissant (ex: 30% > 12%), puis nombre absolu, puis alphabétique
  stats.sort((a, b) => {
    if (Math.abs(b.pct - a.pct) > 0.001) {
      return b.pct - a.pct;
    }
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.shortName.localeCompare(b.shortName);
  });

  // 6. Rendu des cartes de la grille
  const gridEl = document.getElementById('breakdownGrid');
  if (!gridEl) return;

  const currentActiveGroup = deputoscopeFilters.group || 'ALL';

  gridEl.innerHTML = stats.map(s => {
    const isSelected = (currentActiveGroup === s.group);
    // Format du pourcentage : 1 décimale si non entier, sinon entier
    const pctDisplay = (s.pct % 1 === 0) ? s.pct.toFixed(0) : s.pct.toFixed(1);
    const safeGroupName = (s.group || '').replace(/'/g, "\\'");

    return `
      <div class="breakdown-card ${isSelected ? 'selected' : ''} ${s.count === 0 ? 'card-zero' : ''}"
           onclick="toggleQuadrantBreakdownGroup('${safeGroupName}')"
           role="button"
           tabindex="0"
           title="${s.group} : ${s.count} sur ${s.total} députés (${pctDisplay}%). Cliquez pour filtrer la liste des députés.">
        <div class="card-top">
          <div class="card-group-identity">
            <span class="group-dot" style="background-color: ${s.color};"></span>
            <span class="group-short-name">${s.shortName}</span>
          </div>
          <span class="card-pct" style="color: ${s.color};">${pctDisplay}%</span>
        </div>
        <div class="card-bar-track">
          <div class="card-bar-fill" style="width: ${Math.min(100, Math.max(0, s.pct))}%; background-color: ${s.color};"></div>
        </div>
        <div class="card-bottom">
          <span class="card-ratio"><strong>${s.count}</strong> sur ${s.total} élus</span>
        </div>
      </div>
    `;
  }).join('');

  container.style.display = 'flex';
}

/**
 * Filtre interactif au clic sur une carte de parti dans le baromètre
 */
function toggleQuadrantBreakdownGroup(groupName) {
  const groupSelect = document.getElementById('deputoscopeGroupSelect');
  if (deputoscopeFilters.group === groupName) {
    // Si déjà actif, on désélectionne (revient à Tous les groupes)
    deputoscopeFilters.group = 'ALL';
    if (groupSelect) groupSelect.value = 'ALL';
  } else {
    // Sélectionner ce groupe
    deputoscopeFilters.group = groupName;
    if (groupSelect) groupSelect.value = groupName;
  }

  // Mettre à jour le scatter plot, les repères et la liste des députés
  updateQuadrantLegendActivePill();
  renderQuadrantChart();
  applyDeputoscopeFilters();
}

/**
 * Filtrage interactif par quadrant depuis les boutons de la légende
 */
function setQuadrantFilter(quadrant) {
  const quadrantSelect = document.getElementById('deputoscopeQuadrantSelect');
  if (quadrantSelect) {
    quadrantSelect.value = quadrant;
  }
  deputoscopeFilters.quadrant = quadrant;
  updateQuadrantLegendActivePill();
  renderQuadrantChart();
  applyDeputoscopeFilters();
}

/**
 * Synchronise l'état actif des boutons de la légende
 */
function updateQuadrantLegendActivePill() {
  const activeQ = deputoscopeFilters.quadrant || 'ALL';
  document.querySelectorAll('.q-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.quadrant === activeQ);
  });
}

function onDeputoscopeFilterChange() {
  const searchInput = document.getElementById('deputoscopeSearch');
  const groupSelect = document.getElementById('deputoscopeGroupSelect');
  const quadrantSelect = document.getElementById('deputoscopeQuadrantSelect');
  const sortSelect = document.getElementById('deputoscopeSortSelect');

  deputoscopeFilters.search = (searchInput?.value || '').trim().toLowerCase();
  deputoscopeFilters.group = groupSelect?.value || 'ALL';
  deputoscopeFilters.quadrant = quadrantSelect?.value || 'ALL';
  deputoscopeFilters.sort = sortSelect?.value || 'majeurs_desc';

  updateQuadrantLegendActivePill();

  // Réactualiser le scatter plot
  renderQuadrantChart();

  // Réactualiser la liste des députés
  applyDeputoscopeFilters();
}

function applyDeputoscopeFilters() {
  const currentDeps = getAttendanceDeputes();
  if (!currentDeps || currentDeps.length === 0) return;

  let list = [...currentDeps];

  // Filtre recherche texte
  if (deputoscopeFilters.search) {
    const q = deputoscopeFilters.search;
    list = list.filter(d => 
      d.nom.toLowerCase().includes(q) ||
      (d.circo && d.circo.toLowerCase().includes(q)) ||
      (d.departement && d.departement.toLowerCase().includes(q)) ||
      d.groupe.toLowerCase().includes(q)
    );
  }

  // Filtre groupe
  if (deputoscopeFilters.group !== 'ALL') {
    list = list.filter(d => d.groupe === deputoscopeFilters.group);
  }

  // Filtre quadrant
  if (deputoscopeFilters.quadrant !== 'ALL') {
    const targetQ = (deputoscopeFilters.quadrant === 'Fantôme' || deputoscopeFilters.quadrant === 'Fantome' || deputoscopeFilters.quadrant === 'Décrochage')
      ? ['Fantôme', 'Fantome', 'Décrochage']
      : [deputoscopeFilters.quadrant];
    list = list.filter(d => targetQ.includes(d.quadrant));
  }

  // Tri
  if (deputoscopeFilters.sort === 'majeurs_desc') {
    list.sort((a, b) => b.taux_majeurs - a.taux_majeurs);
  } else if (deputoscopeFilters.sort === 'global_desc') {
    list.sort((a, b) => b.taux_global - a.taux_global);
  } else if (deputoscopeFilters.sort === 'delegation_desc') {
    list.sort((a, b) => b.taux_delegation - a.taux_delegation);
  } else if (deputoscopeFilters.sort === 'nom_asc') {
    list.sort((a, b) => a.nom.localeCompare(b.nom));
  }

  // Affichage du compteur
  const countBadge = document.getElementById('deputoscopeResultsCount');
  if (countBadge) {
    countBadge.textContent = `${list.length} député${list.length > 1 ? 's' : ''}`;
  }

  // Sélection automatique du premier si aucun sélectionné ou plus dans la liste
  if ((!selectedDeputy || !list.some(d => d.id === selectedDeputy.id)) && list.length > 0) {
    selectDeputy(list[0]);
  } else if (selectedDeputy) {
    renderDeputyDetailCard(selectedDeputy);
  }

  // Rendu de la grille des cartes
  renderDeputyCards(list);
}

function renderDeputyCards(list) {
  const container = document.getElementById('deputoscopeCardsGrid');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>🔍 Aucun député ne correspond à ces critères de recherche.</p>
      </div>
    `;
    return;
  }

  // Limite d'affichage pour performance (48 premiers)
  const displayLimit = 48;
  const displayedList = list.slice(0, displayLimit);

  container.innerHTML = displayedList.map(dep => {
    const color = (typeof getGroupColor === 'function') ? getGroupColor(dep.groupe) : '#94a3b8';
    const qInfo = QUADRANT_CONFIG[dep.quadrant] || { label: dep.quadrant, badgeClass: '' };
    const isSelected = selectedDeputy && selectedDeputy.id === dep.id;

    return `
      <div class="deputy-summary-card ${isSelected ? 'selected' : ''}" data-dep-id="${dep.id}" onclick="onDeputyCardClick('${dep.id}')" style="--group-color: ${color};">
        <div class="deputy-card-top">
          <div class="deputy-avatar-mini" style="background-color: ${color}20; border-color: ${color};">
            <span>👤</span>
          </div>
          <div class="deputy-info-text">
            <div class="deputy-name">${dep.civ} ${dep.nom}</div>
            <div class="deputy-circo">${dep.circo || dep.departement || dep.groupe}</div>
          </div>
        </div>
        <div class="deputy-metrics-row">
          <div class="metric-pill">
            <span class="metric-label">⭐ Majeurs</span>
            <span class="metric-val ${dep.taux_majeurs >= 40 ? 'val-high' : ''}">${dep.taux_majeurs}%</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">🌐 Global</span>
            <span class="metric-val">${dep.taux_global}%</span>
          </div>
          <div class="metric-pill">
            <span class="metric-label">📋 Délég.</span>
            <span class="metric-val">${dep.taux_delegation}%</span>
          </div>
        </div>
        <div class="deputy-card-badge">
          <span class="quadrant-badge ${qInfo.badgeClass}">${qInfo.label}</span>
        </div>
      </div>
    `;
  }).join('');
}

function onDeputyCardClick(depId) {
  const currentDeps = getAttendanceDeputes();
  const dep = currentDeps.find(d => d.id === depId) || (attendanceData.deputes && attendanceData.deputes.find(d => d.id === depId));
  if (dep) selectDeputy(dep, true);
}

function selectDeputy(dep, isExplicitUserAction = false) {
  selectedDeputy = dep;

  // Mise à jour de la classe active sur les cartes
  document.querySelectorAll('.deputy-summary-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.depId === dep.id);
  });

  // Synchronisation avec l'URL uniquement lors d'un clic explicite ou lien direct
  if (isExplicitUserAction && typeof DeepLinkRouter !== 'undefined' && !DeepLinkRouter.isRoutingInProgress && (typeof currentActiveTab !== 'undefined' && currentActiveTab === 'tab-attendance')) {
    DeepLinkRouter.setParams({ depute: dep.id });
    DeepLinkRouter.syncMetaTags({ deputy: dep });
  }

  // Affichage de la grande fiche profil
  renderDeputyDetailCard(dep);
}

/**
 * Gestion du repli d'image pour la photo officielle du député
 */
function handleDeputyPhotoError(img, fallbackUrl) {
  if (fallbackUrl && fallbackUrl !== img.src && !img.dataset.triedFallback) {
    img.dataset.triedFallback = 'true';
    img.src = fallbackUrl;
  } else {
    img.onerror = null;
    if (img.parentElement) {
      img.parentElement.innerHTML = '<div class="profile-fallback-avatar">👤</div>';
    }
  }
}

function renderDeputyDetailCard(dep) {
  const container = document.getElementById('deputyDetailContainer');
  if (!container) return;

  const color = (typeof getGroupColor === 'function') ? getGroupColor(dep.groupe) : '#94a3b8';
  const qInfo = QUADRANT_CONFIG[dep.quadrant] || { label: dep.quadrant, badgeClass: '', desc: '' };
  
  // Extraire le numéro ID sans "PA" pour la photo officielle AN (17e ou 16e législature)
  const idNum = (dep.id || '').replace(/^PA/, '');
  const legs = Array.isArray(dep.legislatures) ? dep.legislatures : [];
  const prefer16 = legs.includes('16') && !legs.includes('17');
  const primaryLeg = prefer16 ? '16' : '17';
  const fallbackLeg = prefer16 ? '17' : '16';
  const photoUrl = `https://www.assemblee-nationale.fr/dyn/static/tribun/${primaryLeg}/photos/carre/${idNum}.jpg`;
  const fallbackPhotoUrl = `https://www.assemblee-nationale.fr/dyn/static/tribun/${fallbackLeg}/photos/carre/${idNum}.jpg`;
  const safeNom = (dep.nom || '').replace(/'/g, "\\'");
  const safeNomAttr = (dep.nom || '').replace(/"/g, '&quot;');

  container.innerHTML = `
    <div class="deputy-profile-card">
      <div class="profile-header" style="border-top: 4px solid ${color};">
        <div class="profile-avatar-wrap">
          <img src="${photoUrl}" alt="${safeNomAttr}" class="profile-photo" onerror="handleDeputyPhotoError(this, '${fallbackPhotoUrl}')">
        </div>
        <div class="profile-identity">
          <span class="profile-group-tag" style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}44;">${dep.groupe}</span>
          <h2 class="profile-name">${dep.civ} ${dep.nom}</h2>
          <p class="profile-mandat">
            📍 ${dep.circo || dep.departement || 'Circonscription nationale'} • Législature(s) ${(dep.legislatures || []).join(', ')}
          </p>
        </div>
      </div>

      <!-- Badge & Explication Quadrant -->
      <div class="profile-quadrant-box ${qInfo.badgeClass}">
        <div class="quadrant-title">${qInfo.label}</div>
        <p class="quadrant-explanation">${qInfo.desc}</p>
      </div>

      <!-- Gauges & Statistiques Chiffrées -->
      <div class="profile-stats-grid">
        <div class="profile-stat-box">
          <div class="stat-header">
            <span class="stat-icon">⭐</span>
            <span class="stat-title">Textes Majeurs</span>
          </div>
          <div class="stat-number">${dep.taux_majeurs}%</div>
          <div class="stat-detail">${dep.majeurs_votes ?? dep.majeurs ?? 0} votés sur ${dep.majeurs_possibles} scrutins clés</div>
          <div class="stat-progress">
            <div class="stat-fill" style="width: ${dep.taux_majeurs}%; background-color: #3b82f6;"></div>
          </div>
        </div>

        <div class="profile-stat-box">
          <div class="stat-header">
            <span class="stat-icon">🌐</span>
            <span class="stat-title">Présence Globale</span>
          </div>
          <div class="stat-number">${dep.taux_global}%</div>
          <div class="stat-detail">${dep.votes} votés sur ${dep.scrutins_possibles} au total</div>
          <div class="stat-progress">
            <div class="stat-fill" style="width: ${dep.taux_global}%; background-color: #10b981;"></div>
          </div>
        </div>

        <div class="profile-stat-box">
          <div class="stat-header">
            <span class="stat-icon">📋</span>
            <span class="stat-title">Recours Procuration</span>
          </div>
          <div class="stat-number">${dep.taux_delegation}%</div>
          <div class="stat-detail">${dep.delegation} votes délégués (${dep.personne} en personne)</div>
          <div class="stat-progress">
            <div class="stat-fill" style="width: ${dep.taux_delegation}%; background-color: #f59e0b;"></div>
          </div>
        </div>
      </div>

      <!-- Boutons d'actions Fiche Citoyenne & Lien AN -->
      <div class="profile-actions">
        <button type="button" class="btn-share-deputy" onclick="shareDeputyAttendance('${dep.id}')">
          <span>📸</span> Partager l'infographie
        </button>
        <button type="button" class="btn-share-link" onclick="DeepLinkRouter.copyShareLink({ tab: 'attendance', subview: 'deputes', depute: '${dep.id}' }, 'Lien direct vers la fiche de ${safeNom} copié !')" title="Copier le lien direct vers cette fiche député">
          🔗 Copier le lien
        </button>
        <a href="https://www.assemblee-nationale.fr/dyn/deputes/${dep.id}" target="_blank" rel="noopener noreferrer" class="btn-an-link" title="Consulter la fiche officielle de ${dep.nom} sur assemblee-nationale.fr">
          🏛️ Fiche officielle Assemblée nationale ↗
        </a>
      </div>
    </div>
  `;
}

/* =========================================================================
   VUE 3 : LES SCRUTINS AU COUTEAU (L'ABSENCE QUI FAIT BASCULER LA LOI)
   ========================================================================= */

/**
 * Change le tri actif pour les scrutins au couteau ('date' ou 'diff')
 */
function setCouteauSort(sortKey) {
  if (sortKey !== 'date' && sortKey !== 'diff') return;
  currentCouteauSort = sortKey;

  // Mise à jour de l'état visuel des boutons de la toggle pill
  document.querySelectorAll('.couteau-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === sortKey);
  });

  // Synchronisation avec le routeur URL
  if (typeof DeepLinkRouter !== 'undefined' && !DeepLinkRouter.isRoutingInProgress && (typeof currentActiveTab !== 'undefined' && currentActiveTab === 'tab-attendance')) {
    DeepLinkRouter.setParams({ couteau_sort: sortKey === 'date' ? null : sortKey });
  }

  // Re-rendre la liste des scrutins au couteau
  renderCloseVotes();
}
window.setCouteauSort = setCouteauSort;

function renderCloseVotes() {
  if (!attendanceData || !attendanceData.scrutins_couteau) return;

  const container = document.getElementById('closeVotesList');
  if (!container) return;

  let list = [...attendanceData.scrutins_couteau];
  if (currentAttendanceLeg !== 'ALL') {
    list = list.filter(s => String(s.legislature) === String(currentAttendanceLeg));
  }

  // Tri des scrutins selon l'option choisie
  if (currentCouteauSort === 'diff') {
    list.sort((a, b) => {
      // 1. Écart de voix croissant (les plus serrés d'abord : 1 voix, 2 voix...)
      const diffA = Number(a.diff) || 0;
      const diffB = Number(b.diff) || 0;
      if (diffA !== diffB) {
        return diffA - diffB;
      }
      // 2. Si même nombre d'écart de voix, trier pour nombre de voix totale (+votant en premier)
      const votantsA = (a.votants != null) ? Number(a.votants) : ((Number(a.pour) || 0) + (Number(a.contre) || 0) + (Number(a.abstentions) || 0));
      const votantsB = (b.votants != null) ? Number(b.votants) : ((Number(b.pour) || 0) + (Number(b.contre) || 0) + (Number(b.abstentions) || 0));
      if (votantsA !== votantsB) {
        return votantsB - votantsA;
      }
      // 3. Départage par date (plus récent d'abord)
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  } else {
    // Par date (plus récent d'abord)
    list.sort((a, b) => {
      // 1. Date décroissante (plus récent d'abord)
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      // 2. Si même date : plus petit écart en premier
      const diffA = Number(a.diff) || 0;
      const diffB = Number(b.diff) || 0;
      if (diffA !== diffB) {
        return diffA - diffB;
      }
      // 3. Si même écart : plus de votants en premier
      const votantsA = (a.votants != null) ? Number(a.votants) : ((Number(a.pour) || 0) + (Number(a.contre) || 0) + (Number(a.abstentions) || 0));
      const votantsB = (b.votants != null) ? Number(b.votants) : ((Number(b.pour) || 0) + (Number(b.contre) || 0) + (Number(b.abstentions) || 0));
      if (votantsA !== votantsB) {
        return votantsB - votantsA;
      }
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }

  // Mise à jour du badge de comptage des scrutins
  const countBadge = document.getElementById('couteauCountBadge');
  if (countBadge) {
    countBadge.textContent = `${list.length} scrutin${list.length > 1 ? 's' : ''}`;
  }

  // Mise à jour de l'état visuel des boutons de la toggle pill
  document.querySelectorAll('.couteau-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === currentCouteauSort);
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2.5rem; text-align: center; color: #64748b;">
        <p>🔍 Aucun scrutin au couteau répertorié pour cette législature avec les critères actuels.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((s, idx) => {
    const isAdopted = s.sort === 'adopte';
    const sortBadge = isAdopted ? 'badge-adopte' : 'badge-rejete';
    const sortText = isAdopted ? 'ADOPTÉ' : 'REJETÉ';
    const diffText = s.diff === 1 ? '1 voix près' : `${s.diff} voix près`;
    const losingCamp = s.camp_perdant || (isAdopted ? 'CONTRE' : 'POUR');
    const isCensure = Boolean(s.is_censure);

    const totalExprimes = (s.pour + s.contre) || 1;
    const pourPct = Math.round((s.pour / totalExprimes) * 100);
    const contrePct = 100 - pourPct;
    const votantsCount = (s.votants != null) ? s.votants : ((s.pour || 0) + (s.contre || 0) + (s.abstentions || 0));

    // Barres de répartition avec distinction gris pour motion de censure
    const contreClass = isCensure ? 'breakdown-bar-contre censure-bar' : 'breakdown-bar-contre';
    const contreLabel = isCensure ? `Non-votants / Contre : ${s.contre}` : `Contre : ${s.contre}`;

    const pourBarHtml = `
      <div class="breakdown-bar-pour" style="width: ${pourPct}%;" title="Pour : ${s.pour} (${pourPct}%)">
        Pour : ${s.pour}
      </div>
    `;

    const contreBarHtml = `
      <div class="${contreClass}" style="width: ${contrePct}%;" title="${contreLabel} (${contrePct}%)">
        ${contreLabel}
      </div>
    `;

    // Ordre ergonomique : le camp gagnant est toujours affiché en premier (à gauche)
    // Si ADOPTÉ -> Pour (vert) à gauche, Contre à droite
    // Si REJETÉ -> Contre (rouge ou gris) à gauche, Pour à droite
    const barsHtml = isAdopted 
      ? `${pourBarHtml}${contreBarHtml}` 
      : `${contreBarHtml}${pourBarHtml}`;

    // N'afficher strictement que les 3 premiers partis avec le plus d'absents
    const impactList = (s.groupes_impactants || []).slice(0, 3).map(g => {
      const color = (typeof getGroupColor === 'function') ? getGroupColor(g.groupe) : '#94a3b8';
      const majVote = g.vote_majoritaire ? g.vote_majoritaire.toUpperCase() : losingCamp;
      return `
        <span class="impact-group-pill" style="border-left: 3px solid ${color};">
          <strong>${g.groupe}</strong> (a voté ${majVote}) : <strong>${g.absents} députés absents</strong>
        </span>
      `;
    }).join('');

    // Calcul de la suffisance des absents : les absents auraient-ils suffi seuls à inverser le scrutin ?
    const totalCampAbsents = (s.total_absents_camp != null) ? s.total_absents_camp : (s.groupes_impactants || []).reduce((acc, g) => acc + g.absents, 0);
    const canFlipAlone = totalCampAbsents >= s.diff;

    return `
      <div class="razor-vote-card">
        <div class="razor-vote-header">
          <div class="razor-vote-meta">
            <span class="badge ${sortBadge}">${sortText}</span>
            <span class="razor-diff-badge">⚡ ${diffText}</span>
            <span class="razor-votants-badge" title="Nombre total de votants">👥 ${votantsCount} votants</span>
            <span class="razor-date">📅 ${s.date} • ${s.legislature}ᵉ Législature</span>
            ${s.majeur ? '<span class="scope-pill-btn active" style="font-size: 11px; padding: 2px 6px;">⭐ Texte Majeur</span>' : ''}
            ${isCensure ? '<span class="scope-pill-btn active" style="font-size: 11px; padding: 2px 6px; background: #64748b; color: #fff;">⚖️ 49.3 Censure</span>' : ''}
          </div>
          <button class="btn-inspect-razor" onclick="openScrutinDetail('${s.id}', '${s.legislature}')" title="Examiner l'hémicycle de ce scrutin">
            🏛️ Voir le scrutin n°${s.id} ➔
          </button>
        </div>

        <h4 class="razor-vote-title">${s.titre}</h4>

        <div class="razor-vote-breakdown">
          <div class="breakdown-bar-wrap">
            ${barsHtml}
          </div>
          ${isCensure ? `
            <div class="censure-note">
              ⚖️ <em>Motion de censure (Art. 49 de la Constitution) : seuls les votes POUR sont enregistrés en séance. Pour être adoptée, la motion devait réunir la majorité absolue de <strong>${s.majorite_requise || 289} voix</strong> sur 577 sièges. Les <strong>${s.contre} non-votants</strong> équivalent à des votes Contre.</em>
            </div>
          ` : ''}
        </div>

        ${impactList ? `
          <div class="razor-impact-callout ${isAdopted ? 'callout-adopte' : 'callout-rejete'}">
            <div class="callout-header">
              <span>💡</span> <strong>L'absence qui fait basculer la loi :</strong>
            </div>
            <p class="callout-text">
              Ce scrutin s'est joué à seulement <strong>${diffText}</strong> (majorité absolue). Le camp <strong>${losingCamp}</strong> a échoué à remporter le vote en raison des absences directes dans ses propres rangs :
            </p>
            <div class="callout-groups-row">
              ${impactList}
            </div>
            ${!canFlipAlone ? `
              <div class="callout-conclusion conclusion-insufficient">
                ⚠️ <strong>Écart supérieur aux réserves :</strong> La somme des députés absents dans ces rangs (${totalCampAbsents} au total) reste inférieure aux ${diffText} requis. Même avec une présence à 100%, l'inversion du scrutin n'aurait pas pu se produire sans qu'un autre parti politique ne change d'avis.
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Ouvre le détail d'un scrutin depuis les votes au couteau
 */
function openScrutinDetail(scrutinId, leg) {
  if (typeof openScrutinModal === 'function') {
    const found = (typeof dataset !== 'undefined' && dataset) ? dataset.some(s => String(s.id) === String(scrutinId)) : false;
    if (found) {
      openScrutinModal(scrutinId, leg);
    } else if (typeof loadFullDataset === 'function') {
      loadFullDataset(() => {
        openScrutinModal(scrutinId, leg);
      });
    } else {
      openScrutinModal(scrutinId, leg);
    }
  } else {
    switchTab('tab-detailed');
  }
}

/**
 * Génère la carte de partage pour un député
 */
function shareDeputyAttendance(depId) {
  if (!attendanceData) return;
  const currentDeps = getAttendanceDeputes();
  const dep = currentDeps.find(d => d.id === depId) || (attendanceData.deputes && attendanceData.deputes.find(d => d.id === depId));
  if (!dep) return;

  if (typeof generateDeputyCardCanvas === 'function') {
    generateDeputyCardCanvas(dep);
  } else {
    alert(`Fiche d'assiduité de ${dep.nom} :\nTextes Majeurs : ${dep.taux_majeurs}%\nPrésence Globale : ${dep.taux_global}%\nProfil : ${dep.quadrant}`);
  }
}

// Exposition globale pour les interactions HTML
if (typeof window !== 'undefined') {
  window.setQuadrantFilter = setQuadrantFilter;
  window.updateQuadrantLegendActivePill = updateQuadrantLegendActivePill;
  window.renderQuadrantPartyBreakdown = renderQuadrantPartyBreakdown;
  window.toggleQuadrantBreakdownGroup = toggleQuadrantBreakdownGroup;
  window.jumpToDeputoscopeGroup = jumpToDeputoscopeGroup;
  window.setGroupsTableSort = setGroupsTableSort;
}



