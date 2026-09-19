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
let currentAttendanceSubView = 'groups';
let currentAttendanceLeg = 'ALL';
let groupsChartInstance = null;
let quadrantChartInstance = null;
let selectedDeputy = null;

// État des filtres Députoscope
let deputoscopeFilters = {
  search: '',
  group: 'ALL',
  quadrant: 'ALL',
  sort: 'majeurs_desc'
};

const QUADRANT_CONFIG = {
  'Pilier': {
    label: '🏛️ Pilier de l\'Hémicycle (Top 30)',
    badgeClass: 'badge-pilier',
    desc: 'Forte présence globale et sur les textes majeurs. Élu assidu au cœur des débats et des votes clés.'
  },
  'Stratège': {
    label: '🎯 Stratège / Spécialiste (Top 30)',
    badgeClass: 'badge-stratege',
    desc: 'Présence ciblée : mobilisé au-dessus de la médiane sur les grands textes politiques, tout en déléguant les marathons d\'amendements.'
  },
  'Marathonien': {
    label: '🌙 Marathonien de l\'Ombre (Top 30)',
    badgeClass: 'badge-marathonien',
    desc: 'Présent en séance lors des longues nuits d\'amendements techniques, avec une participation globale supérieure à la médiane.'
  },
  'Fantôme': {
    label: '👻 Décrochage / Absentéisme (Flop 30)',
    badgeClass: 'badge-fantome',
    desc: 'Participation globale et sur les textes majeurs en fort retrait par rapport à la médiane de l\'Assemblée nationale.'
  },
  'Standard': {
    label: '👤 Activité Régulière',
    badgeClass: 'badge-standard',
    desc: 'Participation intermédiaire et régulière, sans décrochage marqué ni sur-mobilisation atypique.'
  }
};

/**
 * Récupère les députés du scope de législature actif
 */
function getAttendanceDeputes() {
  if (!attendanceData) return [];
  if (attendanceData.deputes_by_leg && attendanceData.deputes_by_leg[currentAttendanceLeg]) {
    return attendanceData.deputes_by_leg[currentAttendanceLeg];
  }
  return attendanceData.deputes || [];
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
  if (!deputes || deputes.length === 0) return { median_global: 22.7, median_majeur: 32.0 };
  const sortedGlobal = deputes.map(d => d.taux_global).sort((a, b) => a - b);
  const sortedMajeur = deputes.map(d => d.taux_majeurs).sort((a, b) => a - b);
  const mid = Math.floor(deputes.length / 2);
  const medGlobal = deputes.length % 2 !== 0 ? sortedGlobal[mid] : (sortedGlobal[mid - 1] + sortedGlobal[mid]) / 2;
  const medMajeur = deputes.length % 2 !== 0 ? sortedMajeur[mid] : (sortedMajeur[mid - 1] + sortedMajeur[mid]) / 2;
  return {
    median_global: Math.round(medGlobal * 10) / 10,
    median_majeur: Math.round(medMajeur * 10) / 10
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

  if (!attendanceData && !attendanceLoading) {
    loadAttendanceData(() => {
      renderAttendanceViews();
    });
  } else if (attendanceData) {
    renderAttendanceViews();
  }
}

/**
 * Charge le fichier deputes_assiduite.json
 */
function loadAttendanceData(callback) {
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
      if (callback) callback();
    })
    .catch(err => {
      console.error("Erreur de chargement d'assiduité :", err);
      attendanceLoading = false;
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

  if (viewKey === 'groups') {
    renderGroupsBarometer();
  } else if (viewKey === 'deputes') {
    renderDeputoscope();
  } else if (viewKey === 'couteau') {
    renderCloseVotes();
  }
}

/**
 * Affiche la vue active
 */
function renderAttendanceViews() {
  switchAttendanceSubView(currentAttendanceSubView);
}

/* =========================================================================
   VUE 1 : BAROMÈTRE DES GROUPES (MACRO)
   ========================================================================= */

function renderGroupsBarometer() {
  const groups = [...getAttendanceGroupes()];
  if (!groups || groups.length === 0) return;
  
  // Remplir les cartes de synthèse (KPIs)
  const topMajeurs = groups.reduce((prev, curr) => (curr.taux_majeurs > prev.taux_majeurs ? curr : prev), groups[0]);
  const lowMajeurs = groups.reduce((prev, curr) => (curr.taux_majeurs < prev.taux_majeurs ? curr : prev), groups[0]);
  const topDelegation = groups.reduce((prev, curr) => (curr.taux_delegation > prev.taux_delegation ? curr : prev), groups[0]);

  const kpisContainer = document.getElementById('groupsKpisRow');
  if (kpisContainer) {
    kpisContainer.innerHTML = `
      <div class="kpi-card highlight-green">
        <div class="kpi-icon">🏆</div>
        <div class="kpi-label">Plus forte mobilisation (Majeurs)</div>
        <div class="kpi-value">${topMajeurs.taux_majeurs}%</div>
        <div class="kpi-sub">${topMajeurs.groupe} (${topMajeurs.effectif} députés)</div>
      </div>
      <div class="kpi-card highlight-amber">
        <div class="kpi-icon">📉</div>
        <div class="kpi-label">Plus faible mobilisation (Majeurs)</div>
        <div class="kpi-value">${lowMajeurs.taux_majeurs}%</div>
        <div class="kpi-sub">${lowMajeurs.groupe} (${lowMajeurs.effectif} députés)</div>
      </div>
      <div class="kpi-card highlight-blue">
        <div class="kpi-icon">📋</div>
        <div class="kpi-label">Plus fort recours à la procuration</div>
        <div class="kpi-value">${topDelegation.taux_delegation}%</div>
        <div class="kpi-sub">${topDelegation.groupe} (votes par délégation)</div>
      </div>
    `;
  }

  // Tracé du graphique Chart.js comparatif
  const ctx = document.getElementById('groupsAttendanceChart')?.getContext('2d');
  if (ctx) {
    if (groupsChartInstance) groupsChartInstance.destroy();

    const labels = groups.map(g => g.groupe);
    const dataMajeurs = groups.map(g => g.taux_majeurs);
    const dataGlobal = groups.map(g => g.taux_global);
    const dataDelegation = groups.map(g => g.taux_delegation);

    groupsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '⭐ Textes Majeurs (%)',
            data: dataMajeurs,
            backgroundColor: 'rgba(59, 130, 246, 0.85)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: '🌐 Présence Globale (%)',
            data: dataGlobal,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: '📋 Recours Procuration (%)',
            data: dataDelegation,
            backgroundColor: 'rgba(245, 158, 11, 0.85)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            ticks: {
              color: '#94a3b8',
              font: { size: 11, weight: '500' },
              maxRotation: 35,
              minRotation: 20
            },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            beginAtZero: true,
            max: 60,
            ticks: {
              color: '#94a3b8',
              callback: val => val + '%'
            },
            grid: { color: 'rgba(255, 255, 255, 0.07)' }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#1e293b',
              font: { size: 12, weight: '600' },
              boxWidth: 14,
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: context => ` ${context.dataset.label} : ${context.raw}%`
            }
          }
        }
      }
    });
  }

  // Tableau détaillé par groupe
  const tbody = document.getElementById('groupsAttendanceTableBody');
  if (tbody) {
    tbody.innerHTML = groups.map(g => {
      const color = (typeof getGroupColor === 'function') ? getGroupColor(g.groupe) : '#94a3b8';
      return `
        <tr>
          <td>
            <div class="group-cell">
              <span class="color-dot" style="background-color: ${color};"></span>
              <strong>${g.groupe}</strong>
            </div>
          </td>
          <td class="num-cell">${g.effectif}</td>
          <td class="num-cell highlight-cell">
            <span class="pct-badge high">${g.taux_majeurs}%</span>
          </td>
          <td class="num-cell">${g.taux_global}%</td>
          <td class="num-cell">${g.taux_delegation}%</td>
          <td>
            <div class="table-progress-bar">
              <div class="progress-fill fill-majeurs" style="width: ${Math.min(100, g.taux_majeurs * 1.8)}%;"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
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
  const { median_global: medianX, median_majeur: medianY } = computeAttendanceMedians(currentDeps);

  // Filtrer les données selon le groupe sélectionné
  let filteredDeputes = currentDeps;
  if (deputoscopeFilters.group !== 'ALL') {
    filteredDeputes = filteredDeputes.filter(d => d.groupe === deputoscopeFilters.group);
  }

  // Préparer les points pour le scatter plot (Axe X = Textes Majeurs, Axe Y = Présence Globale)
  const points = filteredDeputes.map(d => {
    const color = (typeof getGroupColor === 'function') ? getGroupColor(d.groupe) : '#94a3b8';
    return {
      x: d.taux_majeurs,
      y: d.taux_global,
      deputy: d,
      backgroundColor: color
    };
  });

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
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const dep = points[index].deputy;
          selectDeputy(dep);
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: `Présence sur Textes Majeurs (%) — Médiane : ${medianY}%`,
            color: '#94a3b8',
            font: { size: 12, weight: '600' }
          },
          ticks: { color: '#64748b', callback: val => val + '%' },
          grid: {
            color: context => Math.abs(context.tick.value - Math.round(medianY)) < 1 ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.05)',
            lineWidth: context => Math.abs(context.tick.value - Math.round(medianY)) < 1 ? 2 : 1
          }
        },
        y: {
          title: {
            display: true,
            text: `Présence Globale (%) — Médiane : ${medianX}%`,
            color: '#94a3b8',
            font: { size: 12, weight: '600' }
          },
          ticks: { color: '#64748b', callback: val => val + '%' },
          grid: {
            color: context => Math.abs(context.tick.value - Math.round(medianX)) < 1 ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.05)',
            lineWidth: context => Math.abs(context.tick.value - Math.round(medianX)) < 1 ? 2 : 1
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: items => {
              if (!items || items.length === 0) return '';
              const targetPoint = points[items[0].dataIndex];
              const samePoints = points.filter(p => Math.abs(p.x - targetPoint.x) < 0.05 && Math.abs(p.y - targetPoint.y) < 0.05);
              if (samePoints.length > 1) {
                return `👥 ${samePoints.length} députés (${targetPoint.x}% majeurs, ${targetPoint.y}% global) :`;
              }
              const dep = targetPoint.deputy;
              return `${dep.civ} ${dep.nom} (${dep.groupe})`;
            },
            label: item => {
              const targetPoint = points[item.dataIndex];
              const samePoints = points.filter(p => Math.abs(p.x - targetPoint.x) < 0.05 && Math.abs(p.y - targetPoint.y) < 0.05);
              
              if (samePoints.length > 1) {
                // Éviter de répéter le bloc si Chart.js déclenche label pour plusieurs items hover
                if (item.dataIndex !== points.indexOf(samePoints[0])) {
                  return null;
                }
                const lines = samePoints.slice(0, 12).map(p => {
                  const qLabel = QUADRANT_CONFIG[p.deputy.quadrant]?.label || p.deputy.quadrant;
                  return `• ${p.deputy.nom} (${p.deputy.groupe}) — ${qLabel}`;
                });
                if (samePoints.length > 12) {
                  lines.push(`... et ${samePoints.length - 12} autres députés`);
                }
                lines.push(`(Cliquez pour sélectionner ${samePoints[0].deputy.nom})`);
                return lines;
              }

              const dep = targetPoint.deputy;
              return [
                `Circonscription : ${dep.circo || dep.departement || 'Non renseignée'}`,
                `⭐ Textes Majeurs : ${dep.taux_majeurs}% (${dep.majeurs_votes} / ${dep.majeurs_possibles})`,
                `🌐 Présence Globale : ${dep.taux_global}% (${dep.votes} / ${dep.scrutins_possibles})`,
                `📋 Procuration : ${dep.taux_delegation}% des votes`,
                `Catégorie : ${QUADRANT_CONFIG[dep.quadrant]?.label || dep.quadrant}`
              ];
            }
          }
        }
      }
    }
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
    list = list.filter(d => d.quadrant === deputoscopeFilters.quadrant);
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
      <div class="deputy-summary-card ${isSelected ? 'selected' : ''}" onclick="onDeputyCardClick('${dep.id}')" style="--group-color: ${color};">
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
  if (dep) selectDeputy(dep);
}

function selectDeputy(dep) {
  selectedDeputy = dep;

  // Mise à jour de la classe active sur les cartes
  document.querySelectorAll('.deputy-summary-card').forEach(card => {
    card.classList.toggle('selected', card.innerHTML.includes(dep.nom));
  });

  // Affichage de la grande fiche profil
  renderDeputyDetailCard(dep);
}

function renderDeputyDetailCard(dep) {
  const container = document.getElementById('deputyDetailContainer');
  if (!container) return;

  const color = (typeof getGroupColor === 'function') ? getGroupColor(dep.groupe) : '#94a3b8';
  const qInfo = QUADRANT_CONFIG[dep.quadrant] || { label: dep.quadrant, badgeClass: '', desc: '' };
  
  // Extraire le numéro ID sans "PA" pour la photo officielle AN si disponible
  const idNum = dep.id.replace(/^PA/, '');
  const photoUrl = `https://www.assemblee-nationale.fr/dyn/assets/images/deputes/${idNum}.jpg`;

  container.innerHTML = `
    <div class="deputy-profile-card">
      <div class="profile-header" style="border-top: 4px solid ${color};">
        <div class="profile-avatar-wrap">
          <img src="${photoUrl}" alt="${dep.nom}" class="profile-photo" onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='<div class=\\'profile-fallback-avatar\\'>👤</div>';">
        </div>
        <div class="profile-identity">
          <span class="profile-group-tag" style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}44;">
            ${dep.groupe}
          </span>
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
          <div class="stat-detail">${dep.majeurs_votes} votés sur ${dep.majeurs_possibles} scrutins clés</div>
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

      <!-- Bouton d'export Fiche Citoyenne HD -->
      <div class="profile-actions">
        <button type="button" class="btn-share-deputy" onclick="shareDeputyAttendance('${dep.id}')">
          📸 Exporter la Fiche Citoyenne HD
        </button>
      </div>
    </div>
  `;
}

/* =========================================================================
   VUE 3 : LES SCRUTINS AU COUTEAU (L'ABSENCE QUI FAIT BASCULER LA LOI)
   ========================================================================= */

function renderCloseVotes() {
  if (!attendanceData || !attendanceData.scrutins_couteau) return;

  const container = document.getElementById('closeVotesList');
  if (!container) return;

  let list = attendanceData.scrutins_couteau;
  if (currentAttendanceLeg !== 'ALL') {
    list = list.filter(s => String(s.legislature) === String(currentAttendanceLeg));
  }

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
            ${canFlipAlone ? `
              <div class="callout-conclusion conclusion-sufficient">
                ✅ <strong>Mobilisation décisive :</strong> Les absences cumulées dans ce camp (${totalCampAbsents} élu${totalCampAbsents > 1 ? 's' : ''}) dépassent l'écart du scrutin (${diffText}). Une présence complète de ces rangs aurait suffi à elle seule à inverser l'issue du vote.
              </div>
            ` : `
              <div class="callout-conclusion conclusion-insufficient">
                ⚠️ <strong>Écart supérieur aux réserves :</strong> La somme des députés absents dans ces rangs (${totalCampAbsents} au total) reste inférieure aux ${diffText} requis. Même avec une présence à 100%, l'inversion du scrutin n'aurait pas pu se produire sans qu'un autre parti politique ne change d'avis.
              </div>
            `}
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
 * Génère la carte de partage HD pour un député
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

