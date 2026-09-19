// ==========================================================
// OBSERVATOIRE DES VOTES PARLEMENTAIRES
// Cœur applicatif, gestion des données, filtres et vues UI
// ==========================================================

// Gestion du repli/dépli de l'ancienne bannière onboarding (si présente)
function initOnboardingBanner() {
  const content = document.getElementById('onboardingContent');
  if (!content) return;
  const isCollapsed = localStorage.getItem('obs_onboarding_collapsed') === 'true';
  const btn = document.getElementById('onboardingToggleBtn');
  const hint = document.getElementById('onboardingHeaderHint');
  const miniBar = document.getElementById('onboardingCollapsedBar');

  if (isCollapsed) {
    content.style.display = 'none';
    if (btn) btn.textContent = 'Déplier le guide ▼';
    if (hint) hint.style.display = 'inline';
    if (miniBar) miniBar.style.display = 'flex';
  } else {
    content.style.display = 'flex';
    if (btn) btn.textContent = 'Réduire le guide ▲';
    if (hint) hint.style.display = 'none';
    if (miniBar) miniBar.style.display = 'none';
  }
}

function toggleOnboarding() {
  const content = document.getElementById('onboardingContent');
  if (!content) return;
  const btn = document.getElementById('onboardingToggleBtn');
  const hint = document.getElementById('onboardingHeaderHint');
  const miniBar = document.getElementById('onboardingCollapsedBar');

  const willCollapse = (content.style.display !== 'none');
  content.style.display = willCollapse ? 'none' : 'flex';
  if (btn) btn.textContent = willCollapse ? 'Déplier le guide ▼' : 'Réduire le guide ▲';
  if (hint) hint.style.display = willCollapse ? 'inline' : 'none';
  if (miniBar) miniBar.style.display = willCollapse ? 'flex' : 'none';

  localStorage.setItem('obs_onboarding_collapsed', willCollapse ? 'true' : 'false');
}

// Détection des textes majeurs (instantané via le flag 'majeur', ou fallback textuel)
function isMajorScrutin(s) {
  if (s && s.majeur !== undefined) return s.majeur === 1;
  const t = (s?.titre || "").toLowerCase();
  return t.includes("ensemble du projet") ||
         t.includes("ensemble de la proposition") ||
         t.includes("motion de censure") ||
         t.includes("déclaration de politique générale") ||
         t.includes("declaration de politique generale") ||
         t.includes("lecture définitive") ||
         t.includes("lecture definitive") ||
         t.includes("vote solennel") ||
         t.includes("scrutin solennel");
}

function showFullLoadingToast(msg) {
  let toast = document.getElementById('fullLoadingToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'fullLoadingToast';
    toast.className = 'full-loading-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = msg;
  toast.style.display = 'flex';
}

function hideFullLoadingToast() {
  const toast = document.getElementById('fullLoadingToast');
  if (toast) toast.style.display = 'none';
}

function loadFullDataset(onComplete) {
  if (fullDataset) {
    dataset = fullDataset;
    if (onComplete) onComplete();
    else refreshAllViews();
    return;
  }
  if (isFullDatasetLoading) {
    const checkInterval = setInterval(() => {
      if (fullDataset) {
        clearInterval(checkInterval);
        dataset = fullDataset;
        if (onComplete) onComplete();
        else refreshAllViews();
      }
    }, 100);
    return;
  }

  isFullDatasetLoading = true;
  showFullLoadingToast('⏳ Chargement de l\'ensemble des 12 539 scrutins...');

  fetch('votes_enriched_complete_final.json')
    .then(res => res.json())
    .then(data => {
      for (let i = 0; i < data.length; i++) {
        hydrateScrutin(data[i]);
        if (data[i].commission) allCommissions.add(data[i].commission);
      }
      fullDataset = data;
      dataset = fullDataset;
      isFullDatasetLoading = false;
      hideFullLoadingToast();
      updateCommissionSelectOptions();
      if (onComplete) onComplete();
      else refreshAllViews();
    })
    .catch(err => {
      console.error("Erreur de chargement du dataset complet :", err);
      isFullDatasetLoading = false;
      hideFullLoadingToast();
      alert("Impossible de charger la base complète des scrutins. Vérifiez que le fichier est accessible.");
    });
}

function prefetchFullDataset() {
  if (fullDataset || isFullDatasetLoading) return;
  loadFullDataset();
}

// Chargement initial unifié haute performance de la base consolidée (~6 Mo brut, ~600 Ko Gzip)
fetch('votes_enriched_complete_final.json')
  .then(res => res.json())
  .then(data => {
    // Hydratation ultra-rapide des décomptes et positions en mémoire (~15 ms)
    for (let i = 0; i < data.length; i++) {
      hydrateScrutin(data[i]);
      if (data[i].commission) allCommissions.add(data[i].commission);
    }
    fullDataset = data;
    dataset = fullDataset;
    isFullDatasetLoading = false;
    initOnboardingBanner();
    initSelectors();
    refreshAllViews();
  })
  .catch(err => {
    console.error("Échec critique du chargement de votes_enriched_complete_final.json :", err);
  });

// ==========================================================
// CHANTIER 5 : MOTEUR D'AGRÉGATION PAR SIÈGES & ENTITÉS
// ==========================================================

function findEntityById(id) {
  const entities = getActiveEntities();
  return entities.find(e => e.id === id || e.name === id) || null;
}

function getEntityPosition(scrutin, entityOrId) {
  if (!scrutin || !scrutin.positions) return null;
  const entity = (typeof entityOrId === 'string') ? findEntityById(entityOrId) : entityOrId;
  if (!entity) {
    return scrutin.positions[entityOrId] || null;
  }
  if (!entity.isCoalition) {
    const g = (entity.groups && entity.groups[0]) || entity.name;
    return scrutin.positions[g] || null;
  }

  // Coalition : Méthode 1 - Pondération par le nombre de sièges
  let pourSeats = 0, contreSeats = 0, abstentionSeats = 0;
  let hasVoted = false;

  (entity.groups || []).forEach(g => {
    const pos = scrutin.positions[g];
    if (pos) {
      hasVoted = true;
      const seats = GROUP_SEATS[g] || 10;
      if (pos === 'POUR') pourSeats += seats;
      else if (pos === 'CONTRE') contreSeats += seats;
      else if (pos === 'ABSTENTION') abstentionSeats += seats;
    }
  });

  if (!hasVoted) return null;
  if (pourSeats > contreSeats && pourSeats >= abstentionSeats) return 'POUR';
  if (contreSeats >= pourSeats && contreSeats >= abstentionSeats) return 'CONTRE';
  if (abstentionSeats > pourSeats && abstentionSeats > contreSeats) return 'ABSTENTION';
  return (pourSeats >= contreSeats) ? 'POUR' : 'CONTRE';
}

function getEntityCohesion(scrutin, entityOrId) {
  if (!scrutin) return null;
  const entity = (typeof entityOrId === 'string') ? findEntityById(entityOrId) : entityOrId;
  if (!entity) return null;
  if (!entity.isCoalition) {
    const g = (entity.groups && entity.groups[0]) || entity.name;
    return (scrutin.cohesions && scrutin.cohesions[g]) ? scrutin.cohesions[g] : 100;
  }

  let pourSeats = 0, contreSeats = 0, abstentionSeats = 0;
  let totalSeats = 0;

  (entity.groups || []).forEach(g => {
    const pos = scrutin.positions ? scrutin.positions[g] : null;
    if (pos) {
      const s = GROUP_SEATS[g] || 10;
      totalSeats += s;
      if (pos === 'POUR') pourSeats += s;
      else if (pos === 'CONTRE') contreSeats += s;
      else if (pos === 'ABSTENTION') abstentionSeats += s;
    }
  });

  if (totalSeats === 0) return null;
  const maxSeats = Math.max(pourSeats, contreSeats, abstentionSeats);
  return parseFloat(((maxSeats / totalSeats) * 100).toFixed(1));
}

function setScaleMode(mode) {
  activeScaleMode = mode;
  localStorage.setItem('obs_scale_mode', mode);
  updateScaleToggleButtons();
  updateAllEntitySelects();
  refreshAllViews();
}

function updateScaleToggleButtons() {
  const btnGroups = document.getElementById('btnScaleGroups');
  const btnCoalitions = document.getElementById('btnScaleCoalitions');
  const btnConfig = document.getElementById('btnOpenCoalitionsModal');

  if (btnGroups) btnGroups.classList.toggle('active', activeScaleMode === 'groups');
  if (btnCoalitions) btnCoalitions.classList.toggle('active', activeScaleMode === 'coalitions');
  if (btnConfig) {
    btnConfig.style.display = (activeScaleMode === 'coalitions') ? 'inline-flex' : 'none';
  }

  const ovTitleLabel = document.getElementById('ovInteractiveTitleLabel');
  if (ovTitleLabel) {
    ovTitleLabel.textContent = (activeScaleMode === 'coalitions') ? "Alliances de la coalition" : "Alliances de";
  }
}

function updateAllEntitySelects() {
  const entities = getActiveEntities();

  // 1. Alliances : ovRefGroup
  const ovSelect = document.getElementById('ovRefGroup');
  if (ovSelect) {
    const prevVal = ovSelect.value;
    ovSelect.innerHTML = '';
    entities.forEach(e => {
      ovSelect.appendChild(new Option(`${e.isCoalition ? '🏛️ ' : '👥 '}${e.name} (${e.seats} sièges)`, e.id));
    });
    if (entities.some(e => e.id === prevVal)) {
      ovSelect.value = prevVal;
    } else if (entities.length > 0) {
      ovSelect.value = entities[0].id;
    }
    updateGroupColorDot('ovGroupColorDot', ovSelect.value);
  }

  // 2. Face-à-face : compGroupA et compGroupB
  const compA = document.getElementById('compGroupA');
  const compB = document.getElementById('compGroupB');
  if (compA && compB) {
    const prevA = compA.value;
    const prevB = compB.value;
    compA.innerHTML = '';
    compB.innerHTML = '';
    entities.forEach(e => {
      compA.appendChild(new Option(`${e.isCoalition ? '🏛️ ' : '👥 '}${e.name} (${e.seats} s.)`, e.id));
      compB.appendChild(new Option(`${e.isCoalition ? '🏛️ ' : '👥 '}${e.name} (${e.seats} s.)`, e.id));
    });

    if (entities.some(e => e.id === prevA)) compA.value = prevA;
    else if (entities.length > 0) compA.value = entities[0].id;

    if (entities.some(e => e.id === prevB) && prevB !== compA.value) compB.value = prevB;
    else if (entities.length > 1) compB.value = entities[1].id;
    else if (entities.length > 0) compB.value = entities[0].id;

    updateGroupColorDot('duelGroupColorDotA', compA.value);
    updateGroupColorDot('duelGroupColorDotB', compB.value);
  }

  // 3. Explorateur : dtTargetGroup
  const dtSelect = document.getElementById('dtTargetGroup');
  if (dtSelect) {
    const prevTarget = dtSelect.value;
    dtSelect.innerHTML = `<option value="ALL">Toutes les entités (${activeScaleMode === 'coalitions' ? 'Coalitions & Partis' : '11 groupes'})</option>`;
    entities.forEach(e => {
      dtSelect.appendChild(new Option(`${e.isCoalition ? '🏛️ ' : '👥 '}${e.name} (${e.seats} sièges)`, e.id));
    });
    if (entities.some(e => e.id === prevTarget) || prevTarget === 'ALL') {
      dtSelect.value = prevTarget;
    } else {
      dtSelect.value = 'ALL';
    }
  }
}

// ==========================================================
// CHANTIER 5 : MODALE CONSTRUCTEUR DE COALITIONS EN DRAG & DROP
// ==========================================================
let editingCoalitions = [];
let draggedGroupName = null;
const COALITION_COLORS_PALETTE = ['#dc2626', '#ca8a04', '#0f172a', '#2563eb', '#16a34a', '#db2777', '#7c3aed', '#0d9488'];

function openCoalitionsModal() {
  editingCoalitions = JSON.parse(JSON.stringify(activeCoalitionsConfig));
  renderCoalitionBuilder();
  const modal = document.getElementById('coalitionsModal');
  if (modal) modal.style.display = 'flex';
}

function closeCoalitionsModal() {
  const modal = document.getElementById('coalitionsModal');
  if (modal) modal.style.display = 'none';
  draggedGroupName = null;
}

function closeCoalitionsModalOnBackdrop(event) {
  if (event.target && event.target.id === 'coalitionsModal') {
    closeCoalitionsModal();
  }
}

function renderGroupChip(g, currentCoalitionId) {
  const seats = GROUP_SEATS[g] || 0;
  const color = GROUP_COLORS[g] || '#94a3b8';
  const shortName = GROUP_SHORT_NAMES[g] || g;
  return `
    <div class="group-drag-chip" draggable="true" ondragstart="onGroupDragStart(event, '${g}')" ondragend="onGroupDragEnd(event)" title="${g} (${seats} sièges) - Glisser pour déplacer">
      <span class="drag-handle" title="Glisser-déposer">⠿</span>
      <span class="group-chip-dot" style="background:${color};"></span>
      <span class="group-chip-name">${shortName}</span>
      <span class="group-chip-seats">${seats}</span>
      <button type="button" class="group-chip-move-btn" onclick="openMoveGroupMenu(event, '${g}')" title="Déplacer vers un autre bloc">⇄</button>
    </div>
  `;
}

function renderCoalitionBuilder() {
  const container = document.getElementById('coalitionsContainer');
  const unassignedDropzone = document.getElementById('unassignedDropzone');
  const unassignedBadge = document.getElementById('unassignedSeatsBadge');
  if (!container || !unassignedDropzone) return;

  const assigned = new Set();
  editingCoalitions.forEach(c => (c.groups || []).forEach(g => assigned.add(g)));
  const unassigned = POLITICAL_SPECTRUM.filter(g => !assigned.has(g));
  const unassignedSeats = unassigned.reduce((acc, g) => acc + (GROUP_SEATS[g] || 0), 0);

  if (unassignedBadge) unassignedBadge.textContent = `${unassignedSeats} sièges (${unassigned.length} partis)`;

  let coalitionsHtml = '';
  editingCoalitions.forEach(c => {
    const seats = (c.groups || []).reduce((acc, g) => acc + (GROUP_SEATS[g] || 0), 0);
    const progressPct = Math.min(100, (seats / 577) * 100).toFixed(1);
    const majorityReached = seats >= MAJORITY_ABS_SEATS;
    const statusText = majorityReached
      ? `⭐ Majorité absolue atteinte (${seats} sièges)`
      : `${seats} sièges (manque ${MAJORITY_ABS_SEATS - seats} pour majorité)`;

    coalitionsHtml += `
      <div class="coalition-card" id="card_${c.id}" style="--coalition-color: ${c.color};">
        <div class="coalition-card-header">
          <div class="coalition-title-input-wrap">
            <input type="color" class="coalition-color-picker" value="${c.color}" onchange="updateCoalitionColor('${c.id}', this.value)" title="Changer la couleur" />
            <input type="text" class="coalition-name-input" value="${c.name}" placeholder="Nom de la coalition..." onchange="updateCoalitionName('${c.id}', this.value)" />
          </div>
          <button type="button" class="btn-del-coalition" onclick="removeCoalition('${c.id}')" title="Dissoudre cette coalition">🗑️</button>
        </div>
        <div class="coalition-seat-gauge">
          <div class="gauge-bar-track">
            <div class="gauge-bar-fill" style="width: ${progressPct}%; background-color: ${c.color};"></div>
            <div class="gauge-majority-marker" style="left: 50.08%;" title="Seuil majorité absolue : 289 sièges"></div>
          </div>
          <div class="gauge-status-row">
            <span class="gauge-seats-count ${majorityReached ? 'majority-reached' : ''}">${statusText}</span>
            <span class="gauge-pct-share">${((seats / 577) * 100).toFixed(1)}% de l'AN</span>
          </div>
        </div>
        <div class="coalition-dropzone" id="dropzone_${c.id}" ondragover="onCoalitionDragOver(event)" ondragleave="onCoalitionDragLeave(event)" ondrop="onCoalitionDrop(event, '${c.id}')">
          ${(c.groups && c.groups.length > 0)
            ? c.groups.map(g => renderGroupChip(g, c.id)).join('')
            : '<div class="dropzone-empty-placeholder">Glissez des partis ici 📥</div>'
          }
        </div>
      </div>
    `;
  });

  container.innerHTML = coalitionsHtml;

  unassignedDropzone.innerHTML = (unassigned.length > 0)
    ? unassigned.map(g => renderGroupChip(g, 'unassigned')).join('')
    : '<div class="dropzone-empty-placeholder">Tous les partis sont assignés à une coalition 👍</div>';
}

function onGroupDragStart(event, groupName) {
  draggedGroupName = groupName;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', groupName);
  if (event.target) event.target.classList.add('is-dragging');
}

function onGroupDragEnd(event) {
  draggedGroupName = null;
  document.querySelectorAll('.group-drag-chip').forEach(el => el.classList.remove('is-dragging'));
  document.querySelectorAll('.coalition-dropzone').forEach(el => el.classList.remove('drag-active'));
}

function onCoalitionDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-active');
}

function onCoalitionDragLeave(event) {
  event.currentTarget.classList.remove('drag-active');
}

function onCoalitionDrop(event, targetCoalitionId) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-active');
  const groupName = event.dataTransfer.getData('text/plain') || draggedGroupName;
  if (!groupName) return;
  moveGroupToCoalition(groupName, targetCoalitionId);
}

function moveGroupToCoalition(groupName, targetCoalitionId) {
  editingCoalitions.forEach(c => {
    c.groups = (c.groups || []).filter(g => g !== groupName);
  });

  if (targetCoalitionId !== 'unassigned') {
    const target = editingCoalitions.find(c => c.id === targetCoalitionId);
    if (target) {
      if (!target.groups) target.groups = [];
      target.groups.push(groupName);
    }
  }

  renderCoalitionBuilder();
}

function openMoveGroupMenu(event, groupName) {
  event.stopPropagation();
  const options = [
    { id: 'unassigned', label: '📌 Hors coalition (Indépendant)' },
    ...editingCoalitions.map(c => ({ id: c.id, label: `🏛️ ${c.name}` }))
  ];

  const promptText = `Déplacer "${groupName}" vers :\n` +
    options.map((o, idx) => `${idx + 1}. ${o.label}`).join('\n') +
    `\n\nEntrez le numéro choisi (1 à ${options.length}) :`;

  const choice = prompt(promptText);
  if (!choice) return;
  const idx = parseInt(choice.trim(), 10) - 1;
  if (idx >= 0 && idx < options.length) {
    moveGroupToCoalition(groupName, options[idx].id);
  }
}

function addNewCoalition() {
  const newId = 'c_' + Date.now();
  const color = COALITION_COLORS_PALETTE[editingCoalitions.length % COALITION_COLORS_PALETTE.length];
  editingCoalitions.push({
    id: newId,
    name: `Nouvelle Coalition ${editingCoalitions.length + 1}`,
    color: color,
    groups: []
  });
  renderCoalitionBuilder();
}

function removeCoalition(coalitionId) {
  editingCoalitions = editingCoalitions.filter(c => c.id !== coalitionId);
  renderCoalitionBuilder();
}

function updateCoalitionName(coalitionId, newName) {
  const c = editingCoalitions.find(item => item.id === coalitionId);
  if (c) c.name = newName.trim() || "Sans titre";
}

function updateCoalitionColor(coalitionId, newColor) {
  const c = editingCoalitions.find(item => item.id === coalitionId);
  if (c) {
    c.color = newColor;
    renderCoalitionBuilder();
  }
}

function applyCoalitionPreset(presetKey) {
  const preset = COALITION_PRESETS[presetKey];
  if (!preset) return;
  editingCoalitions = JSON.parse(JSON.stringify(preset.coalitions));
  renderCoalitionBuilder();
}

function applyAndSaveCoalitions() {
  const validCoalitions = editingCoalitions.filter(c => c.groups && c.groups.length > 0);
  saveCoalitionsConfig(validCoalitions);

  activeScaleMode = 'coalitions';
  localStorage.setItem('obs_scale_mode', 'coalitions');

  updateScaleToggleButtons();
  updateAllEntitySelects();
  closeCoalitionsModal();
  refreshAllViews();

  showFullLoadingToast('🏛️ Analyse par coalitions appliquée !');
  setTimeout(hideFullLoadingToast, 2200);
}

function initSelectors() {
  updateScaleToggleButtons();
  updateAllEntitySelects();
  updateCommissionSelectOptions();
}

function updateGroupColorDot(dotId, groupNameOrColor) {
  const dot = document.getElementById(dotId);
  if (!dot) return;
  if (groupNameOrColor && groupNameOrColor.startsWith('#')) {
    dot.style.backgroundColor = groupNameOrColor;
    return;
  }
  const entity = (typeof findEntityById === 'function') ? findEntityById(groupNameOrColor) : null;
  if (entity && entity.color) {
    dot.style.backgroundColor = entity.color;
    return;
  }
  const palette = (typeof GROUP_COLORS !== 'undefined') ? GROUP_COLORS : {};
  dot.style.backgroundColor = palette[groupNameOrColor] || '#94a3b8';
}

function swapDuelGroups() {
  const gA = document.getElementById('compGroupA');
  const gB = document.getElementById('compGroupB');
  if (gA && gB) {
    const tmp = gA.value;
    gA.value = gB.value;
    gB.value = tmp;
    renderCharts();
  }
}

function populateSelect(id, list) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  list.forEach(item => el.appendChild(new Option(item, item)));
}

// Met à jour les options du sélecteur de commission avec décompte dynamique
function updateCommissionSelectOptions() {
  const commSelect = document.getElementById('ovCommission');
  const currentSelected = commSelect ? commSelect.value : 'ALL';
  const period = document.getElementById('globalPeriodFilter').value;

  // Dataset filtré sur période et filtre majeur via filterDataset
  const pool = filterDataset(period);

  const counts = { ALL: pool.length };
  pool.forEach(s => {
    const c = s.commission || "Autre";
    counts[c] = (counts[c] || 0) + 1;
  });

  const commissions = Array.from(allCommissions).sort();
  let html = `<option value="ALL">Toutes les thématiques (${counts.ALL.toLocaleString('fr-FR')})</option>`;
  commissions.forEach(c => {
    const count = counts[c] || 0;
    html += `<option value="${c}">${c} (${count.toLocaleString('fr-FR')})</option>`;
  });

  commSelect.innerHTML = html;
  if ([...commSelect.options].some(o => o.value === currentSelected)) {
    commSelect.value = currentSelected;
  } else {
    commSelect.value = 'ALL';
  }
}

function setGlobalMajorFilter(isMajor) {
  if (!isMajor && !fullDataset) {
    loadFullDataset(() => {
      setGlobalMajorFilter(false);
    });
    return;
  }
  globalMajorFilterOnly = isMajor;
  document.getElementById('btnFilterAll').classList.toggle('active', !isMajor);
  document.getElementById('btnFilterMajor').classList.toggle('active', isMajor);
  const dtMajorBtn = document.getElementById('dtFilterMajor');
  const dtAllBtn = document.getElementById('dtFilterAll');
  if (dtMajorBtn && dtAllBtn) {
    dtMajorBtn.classList.toggle('active', isMajor);
    dtAllBtn.classList.toggle('active', !isMajor);
    currentPresetFilter = isMajor ? 'MAJOR' : 'ALL';
  }
  updateCommissionSelectOptions();
  refreshAllViews();
}

function onGlobalPeriodChange() {
  updateCommissionSelectOptions();
  refreshAllViews();
  const period = document.getElementById('globalPeriodFilter')?.value;
  const leg = period === 'LEG_17' ? '17' : (period === 'LEG_16' ? '16' : 'ALL');
  if (typeof setAttendanceLegislature === 'function' && attendanceData) {
    setAttendanceLegislature(leg);
  }
}

function refreshAllViews() {
  const period = document.getElementById('globalPeriodFilter').value;
  const baseFiltered = filterDataset(period);
  
  const countText = `${baseFiltered.length.toLocaleString('fr-FR')} scrutin${baseFiltered.length > 1 ? 's' : ''} actif${baseFiltered.length > 1 ? 's' : ''}`;
  const modeText = globalMajorFilterOnly ? ' (⭐ Textes majeurs)' : ' (Totalité)';
  const filteredCountEl = document.getElementById('globalFilteredCount');
  if (filteredCountEl) filteredCountEl.textContent = countText + modeText;

  // Actualisation des compteurs d'accueil si présents
  const homeStatTotal = document.getElementById('homeStatTotal');
  if (homeStatTotal) homeStatTotal.textContent = (fullDataset ? fullDataset.length : (dataset.length > 500 ? dataset.length : 12539)).toLocaleString('fr-FR');
  const homeStatMajors = document.getElementById('homeStatMajors');
  if (homeStatMajors) homeStatMajors.textContent = "499";

  const kpiEl = document.getElementById('global-kpi');
  if (kpiEl) {
    if (dataset.length <= 500 && globalMajorFilterOnly) {
      kpiEl.textContent = `Mode Textes majeurs actif : ${baseFiltered.length.toLocaleString('fr-FR')} scrutins clés analysés (chargement rapide) — Cliquez sur « Tous les scrutins » pour analyser les 12 539 votes.`;
    } else {
      kpiEl.textContent = `Base consolidée : ${dataset.length.toLocaleString('fr-FR')} scrutins répertoriés — ${countText} analysé${baseFiltered.length > 1 ? 's' : ''}.`;
    }
  }

  if (currentActiveTab === 'tab-overview') renderOverview();
  else if (currentActiveTab === 'tab-heatmap') renderHeatmap();
  else if (currentActiveTab === 'tab-radar-time') renderCharts();
  else if (currentActiveTab === 'tab-detailed') renderDetailed();
}

const TABS_ORDER = ['tab-home', 'tab-overview', 'tab-heatmap', 'tab-radar-time', 'tab-detailed', 'tab-attendance'];

function switchTab(tabId) {
  if (tabId === currentActiveTab && document.getElementById(tabId)?.classList.contains('active')) return;
  
  const oldIndex = TABS_ORDER.indexOf(currentActiveTab);
  const newIndex = TABS_ORDER.indexOf(tabId);
  const directionClass = (newIndex >= oldIndex) ? 'slide-from-right' : 'slide-from-left';
  
  currentActiveTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const onClickAttr = btn.getAttribute('onclick') || '';
    btn.classList.toggle('active', onClickAttr.includes(`'${tabId}'`));
  });

  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.remove('active', 'slide-from-right', 'slide-from-left');
  });

  const targetContent = document.getElementById(tabId);
  if (targetContent) {
    targetContent.classList.add('active', directionClass);
    setTimeout(() => {
      targetContent.classList.remove('slide-from-right', 'slide-from-left');
    }, 300);
  }

  // Masquer la barre de filtres globale sur l'accueil et sur l'assiduité (qui a ses contrôles propres)
  const controlsBar = document.getElementById('globalControlsBar');
  if (controlsBar) {
    controlsBar.style.display = (tabId === 'tab-home' || tabId === 'tab-attendance') ? 'none' : 'flex';
  }

  // Scroll automatique instantané en haut pour éviter les à-coups
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (tabId === 'tab-overview') renderOverview();
  if (tabId === 'tab-heatmap') renderHeatmap();
  if (tabId === 'tab-radar-time') renderCharts();
  if (tabId === 'tab-detailed') renderDetailed();
  if (tabId === 'tab-attendance') initAttendanceTab();
}

function toggleContextGuide(guideId) {
  const drawer = document.getElementById(guideId);
  if (!drawer) return;
  const isOpen = drawer.classList.toggle('open');
  const btn = document.querySelector(`[data-guide-target="${guideId}"]`);
  if (btn) btn.classList.toggle('active', isOpen);
}

function setHeatmapMetric(metric) {
  const hiddenInput = document.getElementById('hmMetric');
  if (hiddenInput) hiddenInput.value = metric;
  document.querySelectorAll('.segmented-control .seg-btn').forEach(btn => {
    const clickAttr = btn.getAttribute('onclick') || '';
    btn.classList.toggle('active', clickAttr.includes(metric));
  });
  renderHeatmap();
}

function quickSearchScrutin(keyword) {
  const searchInput = document.getElementById('dtSearch');
  if (searchInput) {
    searchInput.value = (searchInput.value.trim().toLowerCase() === keyword.toLowerCase()) ? '' : keyword;
    renderDetailed();
  }
}

function toggleAdvancedFilters() {
  const container = document.getElementById('dtAdvancedFilters');
  const toggleBtn = document.getElementById('btnToggleAdvFilters');
  if (container) {
    const isNowOpen = container.classList.toggle('open');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', isNowOpen);
      toggleBtn.innerHTML = isNowOpen ? '<span>⚙️</span> Masquer les filtres ▲' : '<span>⚙️</span> Filtres avancés (Groupe, Issue...) ▼';
    }
  }
}

function filterDataset(selectedPeriod, commission = 'ALL') {
  return dataset.filter(s => {
    if (globalMajorFilterOnly && !isMajorScrutin(s)) return false;
    if (commission !== 'ALL' && s.commission !== commission) return false;
    if (selectedPeriod === 'LEG_16') return s.legislature === "16" || (s.date && s.date < "2024-06-10");
    if (selectedPeriod === 'LEG_17') return s.legislature === "17" || (s.date && s.date >= "2024-07-01");
    return true;
  });
}

function setSortOverview(type) {
  currentOvSort = (currentOvSort === type) ? (type + '_desc') : type;
  renderOverview();
}

function renderOverview() {
  const ref = document.getElementById('ovRefGroup').value;
  const dateRange = document.getElementById('globalPeriodFilter').value;
  const commission = document.getElementById('ovCommission').value;
  const filtered = filterDataset(dateRange, commission);

  const refEntity = findEntityById(ref) || { id: ref, name: ref, shortName: ref, color: '#2563eb', seats: 0, isCoalition: false, groups: [ref] };
  updateGroupColorDot('ovGroupColorDot', refEntity.color || ref);

  const entities = getActiveEntities();
  const otherEntities = entities.filter(e => e.id !== ref);

  const stats = {};
  let refCohTotal = 0, refCohCount = 0;

  otherEntities.forEach(e => {
    stats[e.id] = { entity: e, pour: 0, contre: 0, diff: 0, total: 0, cohTotal: 0, cohCount: 0 };
  });

  filtered.forEach(s => {
    const refPos = getEntityPosition(s, refEntity);
    const refCoh = getEntityCohesion(s, refEntity);
    if (refCoh !== null) {
      refCohTotal += refCoh;
      refCohCount++;
    }
    if (!refPos) return;

    otherEntities.forEach(e => {
      const otherPos = getEntityPosition(s, e);
      if (!otherPos) return;

      stats[e.id].total++;
      if (refPos === 'POUR' && otherPos === 'POUR') stats[e.id].pour++;
      else if (refPos === 'CONTRE' && otherPos === 'CONTRE') stats[e.id].contre++;
      else stats[e.id].diff++;

      const otherCoh = getEntityCohesion(s, e);
      if (otherCoh !== null) {
        stats[e.id].cohTotal += otherCoh;
        stats[e.id].cohCount++;
      }
    });
  });

  document.getElementById('refGroupCohesion').textContent = 
    refCohCount ? `${(refCohTotal / refCohCount).toFixed(1)}%` : '-';

  const seatsEl = document.getElementById('refGroupSeatsInfo');
  if (seatsEl) {
    seatsEl.textContent = refEntity.seats ? `${refEntity.seats} sièges` : '- sièges';
  }

  let rows = Object.values(stats)
    .filter(d => d.total > 0)
    .map(d => {
      const pourPct = parseFloat(((d.pour / d.total) * 100).toFixed(1));
      const contrePct = parseFloat(((d.contre / d.total) * 100).toFixed(1));
      const diffPct = parseFloat(((d.diff / d.total) * 100).toFixed(1));
      const accordTotalPct = parseFloat((((d.pour + d.contre) / d.total) * 100).toFixed(1));
      return {
        group: d.entity.name,
        entity: d.entity,
        pourPct,
        contrePct,
        diffPct,
        accordTotalPct,
        cohesion: d.cohCount ? (d.cohTotal / d.cohCount).toFixed(1) : '-',
        ...d
      };
    });

  // Micro-synthèse épurée et vivante (Cockpit)
  const summaryBox = document.getElementById('ovDynamicSummary');
  if (rows.length > 0) {
    const sortedByAccord = [...rows].sort((a, b) => b.accordTotalPct - a.accordTotalPct);
    const bestPartner = sortedByAccord[0];
    const sortedByDiff = [...rows].sort((a, b) => b.diffPct - a.diffPct);
    const mostDistant = sortedByDiff[0];

    summaryBox.innerHTML = `
      🤝 <strong>Allié n°1 :</strong> ${bestPartner.entity.name} (<strong>${bestPartner.accordTotalPct}%</strong> d'accord global) • 
      ⚔️ <strong>Contraste max :</strong> ${mostDistant.entity.name} (<strong>${mostDistant.diffPct}%</strong> de votes opposés)
    `;
  } else {
    summaryBox.innerHTML = `Aucun scrutin disponible pour les critères sélectionnés.`;
  }

  if (currentOvSort === 'spectrum') {
    if (activeScaleMode === 'groups') {
      rows.sort((a, b) => POLITICAL_SPECTRUM.indexOf(a.group) - POLITICAL_SPECTRUM.indexOf(b.group));
    } else {
      rows.sort((a, b) => (b.entity.seats || 0) - (a.entity.seats || 0));
    }
  }
  else if (currentOvSort === 'pour') rows.sort((a, b) => b.pourPct - a.pourPct);
  else if (currentOvSort === 'pour_desc') rows.sort((a, b) => a.pourPct - b.pourPct);
  else if (currentOvSort === 'diff') rows.sort((a, b) => b.diffPct - a.diffPct);
  else if (currentOvSort === 'diff_desc') rows.sort((a, b) => a.diffPct - b.diffPct);

  const tbody = document.getElementById('ovTableBody');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    const labelHtml = r.entity.isCoalition 
      ? `<span class="coalition-table-label" style="border-left: 3px solid ${r.entity.color}; padding-left: 6px; font-weight:700;">🏛️ ${r.entity.name} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(${r.entity.seats} sièges)</span></span>`
      : `<strong>${getGroupLinkHtml(r.group, true)}</strong>`;

    tr.innerHTML = `
      <td>${labelHtml}</td>
      <td>
        <div class="stacked-bar-container" title="Pour communs: ${r.pourPct}%, Contre communs: ${r.contrePct}%, Opposés: ${r.diffPct}%">
          <div class="bar-segment segment-pour" style="width: ${r.pourPct}%;">${r.pourPct > 7 ? r.pourPct + '%' : ''}</div>
          <div class="bar-segment segment-contre" style="width: ${r.contrePct}%;">${r.contrePct > 7 ? r.contrePct + '%' : ''}</div>
          <div class="bar-segment segment-diff" style="width: ${r.diffPct}%;">${r.diffPct > 7 ? r.diffPct + '%' : ''}</div>
        </div>
      </td>
      <td style="font-size: 0.85rem;">
        <span style="color: var(--pour-color); font-weight:700;" title="Votes Pour communs">${r.pourPct}%</span> / 
        <span style="color: var(--contre-color); font-weight:700;" title="Votes Contre communs">${r.contrePct}%</span> / 
        <span style="color: var(--diff-text); font-weight:700;" title="Positions opposées">${r.diffPct}%</span>
      </td>
      <td><span class="cohesion-badge" title="Discipline de vote">${r.cohesion}%</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function sortHeatmapByCol(entityId) {
  currentHmSortCol = (currentHmSortCol === entityId) ? null : entityId;
  renderHeatmap();
}

function renderHeatmap() {
  const dateRange = document.getElementById('globalPeriodFilter').value;
  const metric = document.getElementById('hmMetric').value;
  const filtered = filterDataset(dateRange);
  const entities = getActiveEntities();
  const activeEntities = entities.filter(e => filtered.some(s => getEntityPosition(s, e)));

  const matrix = {};
  activeEntities.forEach(e1 => {
    matrix[e1.id] = {};
    activeEntities.forEach(e2 => { matrix[e1.id][e2.id] = { pour: 0, contre: 0, total: 0 }; });
  });

  filtered.forEach(s => {
    const presentPositions = {};
    activeEntities.forEach(e => {
      const pos = getEntityPosition(s, e);
      if (pos) presentPositions[e.id] = pos;
    });

    const presentIds = Object.keys(presentPositions);
    for (let i = 0; i < presentIds.length; i++) {
      for (let j = 0; j < presentIds.length; j++) {
        const id1 = presentIds[i], id2 = presentIds[j];
        matrix[id1][id2].total++;
        if (presentPositions[id1] === 'POUR' && presentPositions[id2] === 'POUR') matrix[id1][id2].pour++;
        if (presentPositions[id1] === 'CONTRE' && presentPositions[id2] === 'CONTRE') matrix[id1][id2].contre++;
      }
    }
  });

  let rowEntities = [...activeEntities];
  if (currentHmSortCol && matrix[currentHmSortCol]) {
    rowEntities.sort((a, b) => getCellVal(matrix[b.id][currentHmSortCol], metric) - getCellVal(matrix[a.id][currentHmSortCol], metric));
  }

  // Calcul dynamique du minimum et maximum réels (hors diagonale) pour étalonner la couleur
  let minVal = Infinity;
  let maxVal = -Infinity;
  activeEntities.forEach(e1 => {
    activeEntities.forEach(e2 => {
      if (e1.id !== e2.id) {
        const d = matrix[e1.id][e2.id];
        if (d && d.total > 0) {
          const v = getCellVal(d, metric);
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
        }
      }
    });
  });
  if (minVal === Infinity) { minVal = 0; maxVal = 100; }
  if (minVal === maxVal) { maxVal = minVal + 1; }

  let html = '<table class="heatmap-table"><thead><tr><th class="hm-corner-th"></th>';
  activeEntities.forEach(e => {
    const shortName = e.shortName;
    const isSorted = (currentHmSortCol === e.id) ? ' <span class="hm-sort-indicator">▼</span>' : '';
    const tooltip = e.isCoalition ? `${e.name} (${e.seats} sièges)` : `${e.name} (${e.seats} sièges)`;
    const styleAttr = e.isCoalition ? `color:${e.color}; font-weight:800;` : '';
    html += `<th class="sortable-hm" onclick="sortHeatmapByCol('${e.id}')" title="${tooltip} (Cliquer pour trier)"><span class="hm-th-short" style="${styleAttr}">${shortName}</span>${isSorted}</th>`;
  });
  html += '</tr></thead><tbody>';

  rowEntities.forEach(e1 => {
    const shortName1 = e1.shortName;
    const labelFull = e1.isCoalition 
      ? `<span class="coalition-row-label" style="border-left: 3px solid ${e1.color}; padding-left: 5px; font-weight:700;">${e1.name} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(${e1.seats} s.)</span></span>`
      : getGroupLinkHtml(e1.name, true);
    const styleAttr1 = e1.isCoalition ? `color:${e1.color}; font-weight:800;` : '';

    html += `<tr><th class="hm-row-th" title="${e1.name}"><span class="hm-row-full">${labelFull}</span><span class="hm-row-short" style="${styleAttr1}">${shortName1}</span></th>`;
    activeEntities.forEach(e2 => {
      if (e1.id === e2.id) { 
        html += `<td class="heatmap-cell hm-diag" style="background:#f1f5f9; color:#94a3b8;">-</td>`; 
        return; 
      }
      const d = matrix[e1.id][e2.id];
      if (!d || d.total === 0) { 
        html += `<td class="heatmap-cell" style="background:#f8fafc; color:#cbd5e1;">0<span class="hm-pct-sign">%</span></td>`; 
        return; 
      }
      const rawVal = getCellVal(d, metric);
      const pct = Math.round(rawVal);
      html += `<td class="heatmap-cell" style="${getHeatmapColor(rawVal, metric, minVal, maxVal)}" title="${e1.name} & ${e2.name} : ${pct}% (${d.pour} pour communs, ${d.contre} contre communs sur ${d.total} scrutins)">${pct}<span class="hm-pct-sign">%</span></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  let hue = 158;
  let metricLabel = "Adoption conjointe (Pour communs)";
  if (metric === 'CONTRE_CONTRE') {
    hue = 198;
    metricLabel = "Opposition conjointe (Contre communs)";
  } else if (metric === 'TOTAL_ACCORD') {
    hue = 222;
    metricLabel = "Accord global (Pour + Contre)";
  }

  html += `
    <div class="heatmap-range-legend">
      <div class="range-legend-left">
        <span class="range-bound-pill">Min observé : <strong>${Math.round(minVal)}%</strong></span>
        <div class="range-gradient-bar" style="background: linear-gradient(to right, hsl(${hue}, 20%, 96%), hsl(${hue}, 85%, 48%));"></div>
        <span class="range-bound-pill">Max observé : <strong>${Math.round(maxVal)}%</strong></span>
      </div>
      <div class="range-legend-right">
        <span>Échelle relative dynamique • <strong>${metricLabel}</strong></span>
      </div>
    </div>
  `;

  document.getElementById('heatmapContainer').innerHTML = html;
}

function getCellVal(d, metric) {
  if (!d || d.total === 0) return 0;
  if (metric === 'POUR_POUR') return (d.pour / d.total) * 100;
  if (metric === 'CONTRE_CONTRE') return (d.contre / d.total) * 100;
  return ((d.pour + d.contre) / d.total) * 100;
}

function getHeatmapColor(val, metric, minVal, maxVal) {
  let hue = 158; // Vert émeraude (POUR_POUR)

  if (metric === 'CONTRE_CONTRE') {
    hue = 198;   // Bleu pétrole / Cyan profond (rejet conjoint)
  } else if (metric === 'TOTAL_ACCORD') {
    hue = 222;   // Bleu roi / Indigo (accord global)
  }

  // Normalisation proportionnelle entre le minimum et le maximum observés
  const range = (maxVal - minVal) > 0 ? (maxVal - minVal) : 1;
  const ratio = Math.max(0, Math.min(1, (val - minVal) / range));

  // Du fond très pâle/neutre (96% de luminosité) à une couleur saturée et dense (48% de luminosité)
  const lightness = Math.round(96 - (ratio * 46));
  // Saturation de 20% à 85%
  const saturation = Math.round(20 + (ratio * 65));

  // Conserver le noir tout le temps pour une lisibilité optimale sur toutes les intensités
  const textColor = '#0f172a';

  return `background: hsl(${hue}, ${saturation}%, ${lightness}%); color: ${textColor}; font-weight: ${ratio > 0.5 ? '700' : '600'};`;
}

function applyPresetFilter(filterText, element) {
  if (filterText === 'ALL' && !fullDataset) {
    loadFullDataset(() => {
      applyPresetFilter('ALL', element);
    });
    return;
  }
  currentPresetFilter = filterText;
  document.querySelectorAll('.filter-chips-container .filter-chip-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
  renderDetailed();
}

function renderDetailed() {
  const targetGroup = document.getElementById('dtTargetGroup').value;
  const targetPos = document.getElementById('dtTargetPosition').value;
  const outcome = document.getElementById('dtOutcome').value;
  const search = document.getElementById('dtSearch').value.toLowerCase().trim();
  const period = document.getElementById('globalPeriodFilter').value;

  const baseFiltered = filterDataset(period);
  const matched = [];

  baseFiltered.forEach(s => {
    // Filtre ciblé sur une entité (groupe ou coalition) et sa position
    if (targetGroup !== 'ALL') {
      const entity = findEntityById(targetGroup);
      const pos = getEntityPosition(s, entity);
      if (targetPos === 'ALL') {
        if (!pos) return;
      } else {
        if (pos !== targetPos) return;
      }
    } else if (targetPos !== 'ALL') {
      // Si aucune entité ciblée mais une position demandée, au moins un groupe doit avoir voté ainsi
      const hasPos = Object.values(s.positions || {}).some(p => p === targetPos);
      if (!hasPos) return;
    }

    // Filtre par issue du vote (adopté / rejeté)
    if (outcome !== 'ALL') {
      const sortScrutin = (s.sort || s.resultat || '').toLowerCase();
      if (!sortScrutin.includes(outcome)) return;
    }

    const titreLower = (s.titre || "").toLowerCase();
    const idStr = String(s.id || "");

    // Filtre rapide contextuel
    if (currentPresetFilter === 'MAJOR') {
      if (!isMajorScrutin(s)) return;
    } else if (currentPresetFilter !== 'ALL') {
      if (!titreLower.includes(currentPresetFilter.toLowerCase())) return;
    }

    // Filtre recherche textuelle (titre ou numéro de scrutin)
    if (search) {
      const matchTitle = titreLower.includes(search);
      const matchId = idStr.includes(search);
      if (!matchTitle && !matchId) return;
    }

    matched.push(s);
  });

  // Tri anté-chronologique strict (du plus récent au plus ancien)
  matched.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    if (dateB !== dateA) return dateB - dateA;
    return Number(b.id || 0) - Number(a.id || 0);
  });

  document.getElementById('dtCountLabel').textContent = `${matched.length.toLocaleString('fr-FR')} scrutin${matched.length > 1 ? 's' : ''} trouvé${matched.length > 1 ? 's' : ''}`;

  const container = document.getElementById('dtScrutinsContainer');
  const visibleItems = matched.slice(0, 80);

  container.innerHTML = visibleItems.map(s => {
    const isAdopte = (s.sort || '').toLowerCase().includes('adopt');
    const outcomeLabel = isAdopte ? 'ADOPTÉ' : 'REJETÉ';
    const outcomeClass = isAdopte ? 'adopte' : 'rejete';
    const cardBorderClass = isAdopte ? 'adopte-card' : 'rejete-card';

    // Génération de la frise panoramique épurée des 11 groupes
    const stripHtml = POLITICAL_SPECTRUM.map(g => {
      const shortName = GROUP_SHORT_NAMES[g] || g.substring(0, 3).toUpperCase();
      const pos = s.positions ? s.positions[g] : null;
      let chipClass = "absent";
      let char = "-";
      let labelText = "Non participant / <3 votants";

      if (pos === 'POUR') {
        chipClass = "pour"; char = "P"; labelText = "Vote : POUR";
      } else if (pos === 'CONTRE') {
        chipClass = "contre"; char = "C"; labelText = "Vote : CONTRE";
      } else if (pos === 'ABSTENTION') {
        chipClass = "abstention"; char = "A"; labelText = "Vote : ABSTENTION";
      }

      const dg = (s.decompte_groupes && s.decompte_groupes[g]) ? s.decompte_groupes[g] : null;
      const presInfo = dg ? ` (${dg.pour + dg.contre + dg.abstentions}/${dg.total_membres} présents)` : '';
      const tooltip = `${g} : ${labelText}${presInfo}`;

      return `<span class="panoramic-chip ${chipClass}" title="${tooltip}"><strong>${shortName}</strong></span>`;
    }).join('');

    return `
    <div class="vote-item-card ${cardBorderClass}" onclick="openScrutinModal('${s.id}', '${s.legislature || ''}')" title="Cliquer pour afficher la fiche détaillée et la ventilation des voix">
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:#64748b;">
        <span><strong>Scrutin n°${s.id}</strong> — ${s.date || 'Date inconnue'} — ${s.commission || 'Séance'}</span>
        <span style="display:flex; align-items:center; gap:0.5rem;">
          <span>Législature ${s.legislature || '-'}</span>
          <span class="outcome-badge ${outcomeClass}">${outcomeLabel}</span>
        </span>
      </div>

      <div style="font-weight:700; font-size:0.95rem; color:#0f172a; line-height:1.4;">
        ${s.titre}
      </div>

      <div class="panoramic-strip">
        ${stripHtml}
      </div>
    </div>
  `;
  }).join('');
}

// Gestion de la modale de détail de scrutin
function openScrutinModal(scrutinId, legislature) {
  const scrutin = dataset.find(s => String(s.id) === String(scrutinId) && (!legislature || String(s.legislature) === String(legislature)));
  if (!scrutin) return;
  hydrateScrutin(scrutin);
  activeModalScrutin = scrutin;

  const isAdopte = (scrutin.sort || '').toLowerCase().includes('adopt');
  const outcomeLabel = isAdopte ? 'ADOPTÉ' : 'REJETÉ';
  const outcomeColor = isAdopte ? 'var(--pour-color)' : '#991b1b';

  const syn = scrutin.synthese || {};
  const synDetails = syn.votants ? ` <span style="font-size:0.8rem; font-weight:normal; color:#64748b;">(${syn.pour} Pour, ${syn.contre} Contre, ${syn.abstentions} Abst.)</span>` : '';

  document.getElementById('modalScrutinMeta').textContent = `Scrutin public n°${scrutin.id} (${scrutin.legislature}e Législature)`;
  document.getElementById('modalScrutinTitle').textContent = scrutin.titre;
  document.getElementById('modalScrutinDate').textContent = scrutin.date || 'Non renseignée';
  document.getElementById('modalScrutinLeg').textContent = `${scrutin.legislature || '-'}e Législature`;
  document.getElementById('modalScrutinComm').textContent = scrutin.commission || 'Séance publique';
  
  const outcomeEl = document.getElementById('modalScrutinOutcome');
  outcomeEl.innerHTML = `<span class="outcome-badge ${isAdopte ? 'adopte' : 'rejete'}">${outcomeLabel}</span>`;
  outcomeEl.style.color = outcomeColor;

  // Lien officiel dynamique
  const leg = scrutin.legislature || '17';
  const anUrl = `https://www.assemblee-nationale.fr/dyn/${leg}/scrutins/${scrutin.id}`;
  const linkBtn = document.getElementById('modalOfficialLink');
  linkBtn.href = anUrl;

  // Ventilation groupe par groupe dans le tableau
  const tbody = document.getElementById('modalScrutinTableBody');
  tbody.innerHTML = POLITICAL_SPECTRUM.map(g => {
    const pos = scrutin.positions ? scrutin.positions[g] : null;
    const dg = (scrutin.decompte_groupes && scrutin.decompte_groupes[g]) ? scrutin.decompte_groupes[g] : null;
    const tot = dg ? dg.total_membres : (GROUP_SEATS[g] || 10);
    const p = dg ? (dg.pour || 0) : 0;
    const c = dg ? (dg.contre || 0) : 0;
    const a = dg ? (dg.abstentions || 0) : 0;
    const nv = dg ? (dg.non_votants || 0) : Math.max(0, tot - (p + c + a));
    const presents = p + c + a;
    const presencePct = tot > 0 ? Math.round((presents / tot) * 1000) / 10 : 0;
    
    let posBadge = `<span style="color:#94a3b8; font-style:italic;">Non participant / &lt;3 votants</span>`;
    if (pos === 'POUR') {
      posBadge = `<span class="vote-tag-badge pour">POUR</span>`;
    } else if (pos === 'CONTRE') {
      posBadge = `<span class="vote-tag-badge contre">CONTRE</span>`;
    } else if (pos === 'ABSTENTION') {
      posBadge = `<span class="vote-tag-badge abstention">ABSTENTION</span>`;
    }

    const presenceBadge = dg ? `
      <span class="presence-badge" title="${nv} député(s) absent(s) sur ${tot}">
        <strong>${presents}</strong> / ${tot} <span class="presence-pct">(${presencePct}%)</span>
      </span>
    ` : `<span style="color:#94a3b8;">-</span>`;

    return `
      <tr data-group="${g}" onmouseenter="onTableGroupHover('${g}')" onmouseleave="onTableGroupLeave()">
        <td>
          <strong>${getGroupLinkHtml(g, true)}</strong>
        </td>
        <td style="text-align:center;">${posBadge}</td>
        <td style="text-align:center;">${presenceBadge}</td>
      </tr>
    `;
  }).join('');

  // Rendu du Mini-Hémicycle Parlementaire SVG (Chantier 6)
  if (typeof renderScrutinHemicycle === 'function') {
    renderScrutinHemicycle(scrutin, (typeof currentHemiDisplayMode !== 'undefined') ? currentHemiDisplayMode : 'vote');
  }

  document.getElementById('scrutinModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function onTableGroupHover(groupName) {
  if (typeof onHemicycleHover === 'function') {
    onHemicycleHover(groupName);
  }
  const svg = document.querySelector('.hemicycle-svg');
  if (svg) {
    const sec = svg.querySelector(`[data-group="${groupName}"]`);
    if (sec) sec.classList.add('hemi-sector-highlighted');
  }
}

function onTableGroupLeave() {
  if (typeof onHemicycleLeave === 'function') {
    onHemicycleLeave();
  }
  const svg = document.querySelector('.hemicycle-svg');
  if (svg) {
    svg.querySelectorAll('.hemi-sector-highlighted').forEach(el => el.classList.remove('hemi-sector-highlighted'));
  }
}



function closeModal() {
  document.getElementById('scrutinModal').classList.remove('active');
  document.body.style.overflow = '';
  activeModalScrutin = null;
}

function closeModalOnBackdrop(event) {
  if (event.target.id === 'scrutinModal') {
    closeModal();
  }
}

// Gestion de la modale Méthodologie & Définitions
function openMethodologyModal() {
  const m = document.getElementById('methodologyModal');
  if (m) {
    m.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeMethodologyModal() {
  const m = document.getElementById('methodologyModal');
  if (m) {
    m.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeMethodologyModalOnBackdrop(event) {
  if (event.target.id === 'methodologyModal') {
    closeMethodologyModal();
  }
}

// Fermeture avec la touche Échap
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('scrutinModal');
    if (modal && modal.classList.contains('active')) {
      closeModal();
    }
    const shareModal = document.getElementById('shareModal');
    if (shareModal && shareModal.classList.contains('active')) {
      closeShareModal();
    }
    const methModal = document.getElementById('methodologyModal');
    if (methModal && methModal.classList.contains('active')) {
      closeMethodologyModal();
    }
  }
});


