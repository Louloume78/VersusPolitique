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

// Détection des textes majeurs
function isMajorScrutin(s) {
  const t = (s.titre || "").toLowerCase();
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
    }, 150);
    return;
  }

  isFullDatasetLoading = true;
  showFullLoadingToast('⏳ Chargement de l\'ensemble des 12 539 scrutins...');

  fetch('votes_enriched_complete_final.json')
    .then(res => res.json())
    .then(data => {
      fullDataset = data;
      dataset = fullDataset;
      isFullDatasetLoading = false;
      hideFullLoadingToast();
      data.forEach(s => { if (s.commission) allCommissions.add(s.commission); });
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
  isFullDatasetLoading = true;
  fetch('votes_enriched_complete_final.json')
    .then(res => res.json())
    .then(data => {
      fullDataset = data;
      data.forEach(s => { if (s.commission) allCommissions.add(s.commission); });
      updateCommissionSelectOptions();
      // Met à jour dataset silencieusement en mémoire
      dataset = fullDataset;
      isFullDatasetLoading = false;
      refreshAllViews();
    })
    .catch(err => {
      isFullDatasetLoading = false;
      console.warn("Préchargement silencieux en arrière-plan non disponible :", err);
    });
}

// Chargement initial ultra-rapide des 499 Textes majeurs (~428 Ko)
fetch('votes_majeurs.json')
  .then(res => res.json())
  .then(data => {
    dataset = data;
    dataset.forEach(s => { if (s.commission) allCommissions.add(s.commission); });
    initOnboardingBanner();
    initSelectors();
    refreshAllViews();

    // Déclencher le préchargement silencieux des 12 539 scrutins après 2,5 secondes d'inactivité
    setTimeout(() => {
      prefetchFullDataset();
    }, 2500);
  })
  .catch(err => {
    console.warn("votes_majeurs.json non disponible, chargement direct de la base complète :", err);
    loadFullDataset();
  });

function initSelectors() {
  populateSelect('ovRefGroup', POLITICAL_SPECTRUM);
  document.getElementById('ovRefGroup').value = "Renaissance / EPR";

  updateCommissionSelectOptions();

  populateSelect('compGroupA', POLITICAL_SPECTRUM);
  populateSelect('compGroupB', POLITICAL_SPECTRUM);
  document.getElementById('compGroupA').value = "Renaissance / EPR";
  document.getElementById('compGroupB').value = "Les Démocrates (MoDem)";

  // Sélecteur pour l'explorateur panoramique
  const dtTargetGroupSelect = document.getElementById('dtTargetGroup');
  if (dtTargetGroupSelect) {
    dtTargetGroupSelect.innerHTML = '<option value="ALL">Tous les groupes (Vue panoramique)</option>';
    POLITICAL_SPECTRUM.forEach(g => dtTargetGroupSelect.appendChild(new Option(g, g)));
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

const TABS_ORDER = ['tab-home', 'tab-overview', 'tab-heatmap', 'tab-radar-time', 'tab-detailed'];

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

  // Masquer la barre de filtres globale sur l'accueil, l'afficher sur les outils d'analyse
  const controlsBar = document.getElementById('globalControlsBar');
  if (controlsBar) {
    controlsBar.style.display = (tabId === 'tab-home') ? 'none' : 'flex';
  }

  // Scroll automatique instantané en haut pour éviter les à-coups
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (tabId === 'tab-overview') renderOverview();
  if (tabId === 'tab-heatmap') renderHeatmap();
  if (tabId === 'tab-radar-time') renderCharts();
  if (tabId === 'tab-detailed') renderDetailed();
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

  const stats = {};
  let refCohTotal = 0, refCohCount = 0;

  POLITICAL_SPECTRUM.forEach(g => {
    if (g !== ref) stats[g] = { pour: 0, contre: 0, diff: 0, total: 0, cohTotal: 0, cohCount: 0 };
  });

  filtered.forEach(s => {
    const refPos = s.positions[ref];
    if (s.cohesions && s.cohesions[ref]) {
      refCohTotal += s.cohesions[ref];
      refCohCount++;
    }
    if (!refPos) return;

    Object.entries(s.positions).forEach(([other, pos]) => {
      if (other === ref || !stats[other]) return;
      stats[other].total++;
      if (refPos === 'POUR' && pos === 'POUR') stats[other].pour++;
      else if (refPos === 'CONTRE' && pos === 'CONTRE') stats[other].contre++;
      else stats[other].diff++;

      if (s.cohesions && s.cohesions[other]) {
        stats[other].cohTotal += s.cohesions[other];
        stats[other].cohCount++;
      }
    });
  });

  document.getElementById('refGroupCohesion').textContent = 
    refCohCount ? `${(refCohTotal / refCohCount).toFixed(1)}%` : '-';

  const refSeats = GROUP_SEATS[ref];
  const seatsEl = document.getElementById('refGroupSeatsInfo');
  if (seatsEl) {
    seatsEl.innerHTML = refSeats ? `Effectif officiel : <strong>${refSeats} députés</strong>` : '';
  }

  let rows = Object.entries(stats)
    .filter(([_, d]) => d.total > 0)
    .map(([group, d]) => {
      const pourPct = parseFloat(((d.pour / d.total) * 100).toFixed(1));
      const contrePct = parseFloat(((d.contre / d.total) * 100).toFixed(1));
      const diffPct = parseFloat(((d.diff / d.total) * 100).toFixed(1));
      const accordTotalPct = parseFloat((((d.pour + d.contre) / d.total) * 100).toFixed(1));
      return {
        group,
        pourPct,
        contrePct,
        diffPct,
        accordTotalPct,
        cohesion: d.cohCount ? (d.cohTotal / d.cohCount).toFixed(1) : '-',
        ...d
      };
    });

  // Synthèse textuelle dynamique en langage naturel (Onglet 1)
  const summaryBox = document.getElementById('ovDynamicSummary');
  if (rows.length > 0) {
    const sortedByAccord = [...rows].sort((a, b) => b.accordTotalPct - a.accordTotalPct);
    const bestPartner = sortedByAccord[0];
    const sortedByDiff = [...rows].sort((a, b) => b.diffPct - a.diffPct);
    const mostDistant = sortedByDiff[0];

    summaryBox.innerHTML = `
      📌 <strong>Synthèse pour ${ref} :</strong> Son allié le plus fréquent est <strong>${bestPartner.group}</strong> avec <strong>${bestPartner.accordTotalPct}%</strong> de votes identiques (dont ${bestPartner.pourPct}% de votes « Pour » communs et ${bestPartner.contrePct}% de votes « Contre » communs). À l'inverse, la divergence la plus forte s'observe avec <strong>${mostDistant.group}</strong> (<strong>${mostDistant.diffPct}%</strong> de positions opposées).
    `;
  } else {
    summaryBox.innerHTML = `Aucun scrutin ne correspond aux critères sélectionnés pour <strong>${ref}</strong>.`;
  }

  if (currentOvSort === 'spectrum') rows.sort((a, b) => POLITICAL_SPECTRUM.indexOf(a.group) - POLITICAL_SPECTRUM.indexOf(b.group));
  else if (currentOvSort === 'pour') rows.sort((a, b) => b.pourPct - a.pourPct);
  else if (currentOvSort === 'pour_desc') rows.sort((a, b) => a.pourPct - b.pourPct);
  else if (currentOvSort === 'diff') rows.sort((a, b) => b.diffPct - a.diffPct);
  else if (currentOvSort === 'diff_desc') rows.sort((a, b) => a.diffPct - b.diffPct);

  const tbody = document.getElementById('ovTableBody');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${getGroupLinkHtml(r.group, true)}</strong></td>
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

function sortHeatmapByCol(groupName) {
  currentHmSortCol = (currentHmSortCol === groupName) ? null : groupName;
  renderHeatmap();
}

function renderHeatmap() {
  const dateRange = document.getElementById('globalPeriodFilter').value;
  const metric = document.getElementById('hmMetric').value;
  const filtered = filterDataset(dateRange);
  const activeGroups = POLITICAL_SPECTRUM.filter(g => filtered.some(s => s.positions && s.positions[g]));

  const matrix = {};
  activeGroups.forEach(g1 => {
    matrix[g1] = {};
    activeGroups.forEach(g2 => { matrix[g1][g2] = { pour: 0, contre: 0, total: 0 }; });
  });

  filtered.forEach(s => {
    const p = s.positions;
    const present = Object.keys(p).filter(k => activeGroups.includes(k));
    for (let i = 0; i < present.length; i++) {
      for (let j = 0; j < present.length; j++) {
        const g1 = present[i], g2 = present[j];
        matrix[g1][g2].total++;
        if (p[g1] === 'POUR' && p[g2] === 'POUR') matrix[g1][g2].pour++;
        if (p[g1] === 'CONTRE' && p[g2] === 'CONTRE') matrix[g1][g2].contre++;
      }
    }
  });

  let rowGroups = [...activeGroups];
  if (currentHmSortCol && matrix[currentHmSortCol]) {
    rowGroups.sort((a, b) => getCellVal(matrix[b][currentHmSortCol], metric) - getCellVal(matrix[a][currentHmSortCol], metric));
  }

  // Calcul dynamique du minimum et maximum réels (hors diagonale) pour étalonner la couleur
  let minVal = Infinity;
  let maxVal = -Infinity;
  activeGroups.forEach(g1 => {
    activeGroups.forEach(g2 => {
      if (g1 !== g2) {
        const d = matrix[g1][g2];
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
  activeGroups.forEach(g => {
    const shortName = GROUP_SHORT_NAMES[g] || g;
    const isSorted = (currentHmSortCol === g) ? ' <span class="hm-sort-indicator">▼</span>' : '';
    html += `<th class="sortable-hm" onclick="sortHeatmapByCol('${g}')" title="${g} (Cliquer pour trier)"><span class="hm-th-short">${shortName}</span>${isSorted}</th>`;
  });
  html += '</tr></thead><tbody>';

  rowGroups.forEach(g1 => {
    const shortName1 = GROUP_SHORT_NAMES[g1] || g1;
    html += `<tr><th class="hm-row-th" title="${g1}"><span class="hm-row-full">${getGroupLinkHtml(g1)}</span><span class="hm-row-short">${shortName1}</span></th>`;
    activeGroups.forEach(g2 => {
      if (g1 === g2) { 
        html += `<td class="heatmap-cell hm-diag" style="background:#f1f5f9; color:#94a3b8;">-</td>`; 
        return; 
      }
      const d = matrix[g1][g2];
      if (!d || d.total === 0) { 
        html += `<td class="heatmap-cell" style="background:#f8fafc; color:#cbd5e1;">0<span class="hm-pct-sign">%</span></td>`; 
        return; 
      }
      const rawVal = getCellVal(d, metric);
      const pct = Math.round(rawVal);
      html += `<td class="heatmap-cell" style="${getHeatmapColor(rawVal, metric, minVal, maxVal)}" title="${g1} & ${g2} : ${pct}% (Échelle relative : min ${Math.round(minVal)}% — max ${Math.round(maxVal)}%)">${pct}<span class="hm-pct-sign">%</span></td>`;
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
    // Filtre ciblé sur un groupe et sa position
    if (targetGroup !== 'ALL') {
      const pos = s.positions ? s.positions[targetGroup] : null;
      if (targetPos === 'ALL') {
        if (!pos) return;
      } else {
        if (pos !== targetPos) return;
      }
    } else if (targetPos !== 'ALL') {
      // Si aucun groupe ciblé mais une position demandée, au moins un groupe doit avoir voté ainsi
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

      const coh = (s.cohesions && s.cohesions[g]) ? ` (Discipline : ${s.cohesions[g]}%)` : '';
      const tooltip = `${g} : ${labelText}${coh}`;

      return `<span class="panoramic-chip ${chipClass}" title="${tooltip}"><strong>${shortName}</strong></span>`;
    }).join('');

    return `
    <div class="vote-item-card ${cardBorderClass}" onclick="openScrutinModal('${s.id}')" title="Cliquer pour afficher la fiche détaillée et la ventilation des voix">
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
function openScrutinModal(scrutinId) {
  const scrutin = dataset.find(s => String(s.id) === String(scrutinId));
  if (!scrutin) return;
  activeModalScrutin = scrutin;

  const isAdopte = (scrutin.sort || '').toLowerCase().includes('adopt');
  const outcomeLabel = isAdopte ? 'ADOPTÉ' : 'REJETÉ';
  const outcomeColor = isAdopte ? 'var(--pour-color)' : '#991b1b';

  document.getElementById('modalScrutinMeta').textContent = `Scrutin public n°${scrutin.id} (${scrutin.legislature}e Législature)`;
  document.getElementById('modalScrutinTitle').textContent = scrutin.titre;
  document.getElementById('modalScrutinDate').textContent = scrutin.date || 'Non renseignée';
  document.getElementById('modalScrutinLeg').textContent = `${scrutin.legislature || '-'}e Législature`;
  document.getElementById('modalScrutinComm').textContent = scrutin.commission || 'Séance publique';
  
  const outcomeEl = document.getElementById('modalScrutinOutcome');
  outcomeEl.textContent = outcomeLabel;
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
    const coh = (scrutin.cohesions && scrutin.cohesions[g]) ? `${scrutin.cohesions[g]}%` : '-';
    
    let posBadge = `<span style="color:#94a3b8; font-style:italic;">Non participant / &lt;3 votants</span>`;
    if (pos === 'POUR') {
      posBadge = `<span class="vote-tag-badge pour">POUR</span>`;
    } else if (pos === 'CONTRE') {
      posBadge = `<span class="vote-tag-badge contre">CONTRE</span>`;
    } else if (pos === 'ABSTENTION') {
      posBadge = `<span class="vote-tag-badge abstention">ABSTENTION</span>`;
    }

    return `
      <tr>
        <td><strong>${getGroupLinkHtml(g, true)}</strong></td>
        <td style="text-align:center;">${posBadge}</td>
        <td style="text-align:center;"><span class="cohesion-badge">${coh}</span></td>
      </tr>
    `;
  }).join('');

  document.getElementById('scrutinModal').classList.add('active');
  document.body.style.overflow = 'hidden';
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


