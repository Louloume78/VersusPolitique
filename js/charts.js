// ==========================================
// OBSERVATOIRE DES VOTES PARLEMENTAIRES
// Graphiques Chart.js (Radar thématique & Timeline)
// ==========================================

let radarInstance = null;
let timelineInstance = null;

function renderCharts() {
  const gA = document.getElementById('compGroupA').value;
  const gB = document.getElementById('compGroupB').value;
  const period = document.getElementById('globalPeriodFilter').value;
  const filtered = filterDataset(period);

  const entityA = (typeof findEntityById === 'function') ? findEntityById(gA) : { id: gA, name: gA, shortName: gA, color: '#2563eb', seats: 0 };
  const entityB = (typeof findEntityById === 'function') ? findEntityById(gB) : { id: gB, name: gB, shortName: gB, color: '#0f172a', seats: 0 };

  // Mise à jour dynamique des pastilles de couleur
  if (typeof updateGroupColorDot === 'function') {
    updateGroupColorDot('duelGroupColorDotA', (entityA && entityA.color) ? entityA.color : gA);
    updateGroupColorDot('duelGroupColorDotB', (entityB && entityB.color) ? entityB.color : gB);
  }

  const commStats = {};
  const timeStats = {};
  let totalSharedVotes = 0;
  let pourPourCount = 0;
  let contreContreCount = 0;

  filtered.forEach(s => {
    const pA = (typeof getEntityPosition === 'function') ? getEntityPosition(s, entityA) : (s.positions ? s.positions[gA] : null);
    const pB = (typeof getEntityPosition === 'function') ? getEntityPosition(s, entityB) : (s.positions ? s.positions[gB] : null);
    if (!pA || !pB) return;

    totalSharedVotes++;
    if (pA === 'POUR' && pB === 'POUR') pourPourCount++;
    if (pA === 'CONTRE' && pB === 'CONTRE') contreContreCount++;

    const comm = s.commission || "Autre";
    if (!commStats[comm]) commStats[comm] = { pour: 0, total: 0 };
    commStats[comm].total++;
    if (pA === 'POUR' && pB === 'POUR') commStats[comm].pour++;

    const mois = s.mois || "Inconnu";
    if (mois !== "Inconnu") {
      if (!timeStats[mois]) timeStats[mois] = { matches: 0, total: 0 };
      timeStats[mois].total++;
      if (pA === pB) timeStats[mois].matches++;
    }
  });

  // Synthèse textuelle dynamique en langage naturel (Onglet 3)
  const summaryBox = document.getElementById('chartsDynamicSummary');
  if (totalSharedVotes > 0) {
    const totalAccordCount = pourPourCount + contreContreCount;
    const totalAccordPct = ((totalAccordCount / totalSharedVotes) * 100).toFixed(1);
    const pourPct = ((pourPourCount / totalSharedVotes) * 100).toFixed(1);
    const contrePct = ((contreContreCount / totalSharedVotes) * 100).toFixed(1);
    const diffCount = totalSharedVotes - totalAccordCount;
    const diffPct = ((diffCount / totalSharedVotes) * 100).toFixed(1);

    // Mémorisation pour la carte partageable
    currentComparisonData = {
      gA: entityA ? entityA.name : gA,
      gB: entityB ? entityB.name : gB,
      entityA,
      entityB,
      totalSharedVotes,
      totalAccordPct,
      pourPct,
      contrePct,
      diffPct,
      pourPourCount,
      contreContreCount,
      diffCount
    };

    summaryBox.innerHTML = `
      📊 <strong>Face-à-face :</strong> <strong>${entityA ? entityA.name : gA}</strong> (${entityA ? entityA.seats : 0} sièges) et <strong>${entityB ? entityB.name : gB}</strong> (${entityB ? entityB.seats : 0} sièges) votent de manière identique dans <strong>${totalAccordPct}%</strong> des cas sur ${totalSharedVotes.toLocaleString('fr-FR')} scrutins communs, avec <strong>${pourPct}%</strong> de votes « Pour » communs et <strong>${contrePct}%</strong> de votes « Contre » communs (opposition conjointe).
    `;

    // Mise à jour du bloc simplifié Grand Public
    const sTitle = document.getElementById('simpleCardTitle');
    if (sTitle) sTitle.textContent = `${entityA ? entityA.shortName : gA} & ${entityB ? entityB.shortName : gB}`;
    const sBadge = document.getElementById('simpleTotalAccordBadge');
    if (sBadge) sBadge.textContent = `Accord global : ${totalAccordPct}%`;
    const sPourVal = document.getElementById('simplePourVal');
    if (sPourVal) sPourVal.textContent = `${pourPct}%`;
    const sPourDesc = document.getElementById('simplePourDesc');
    if (sPourDesc) sPourDesc.textContent = `${pourPourCount.toLocaleString('fr-FR')} votes Pour ensemble`;
    const sContreVal = document.getElementById('simpleContreVal');
    if (sContreVal) sContreVal.textContent = `${contrePct}%`;
    const sContreDesc = document.getElementById('simpleContreDesc');
    if (sContreDesc) sContreDesc.textContent = `${contreContreCount.toLocaleString('fr-FR')} rejets communs`;
    const sDiffVal = document.getElementById('simpleDiffVal');
    if (sDiffVal) sDiffVal.textContent = `${diffPct}%`;
    const sDiffDesc = document.getElementById('simpleDiffDesc');
    if (sDiffDesc) sDiffDesc.textContent = `${diffCount.toLocaleString('fr-FR')} votes opposés`;
  } else {
    currentComparisonData = null;
    summaryBox.innerHTML = `Aucun scrutin commun trouvé entre <strong>${entityA ? entityA.name : gA}</strong> et <strong>${entityB ? entityB.name : gB}</strong> sur le périmètre actif.`;
    const sTitle = document.getElementById('simpleCardTitle');
    if (sTitle) sTitle.textContent = `${entityA ? entityA.shortName : gA} & ${entityB ? entityB.shortName : gB}`;
    const sBadge = document.getElementById('simpleTotalAccordBadge');
    if (sBadge) sBadge.textContent = `Accord global : 0%`;
    const sPourVal = document.getElementById('simplePourVal');
    if (sPourVal) sPourVal.textContent = `0%`;
    const sPourDesc = document.getElementById('simplePourDesc');
    if (sPourDesc) sPourDesc.textContent = `0 vote commun`;
    const sContreVal = document.getElementById('simpleContreVal');
    if (sContreVal) sContreVal.textContent = `0%`;
    const sContreDesc = document.getElementById('simpleContreDesc');
    if (sContreDesc) sContreDesc.textContent = `0 vote commun`;
    const sDiffVal = document.getElementById('simpleDiffVal');
    if (sDiffVal) sDiffVal.textContent = `0%`;
    const sDiffDesc = document.getElementById('simpleDiffDesc');
    if (sDiffDesc) sDiffDesc.textContent = `0 vote commun`;
  }

  const radarLabels = Object.keys(commStats).filter(c => c !== "Autre");
  const radarData = radarLabels.map(c => ((commStats[c].pour / commStats[c].total) * 100).toFixed(1));

  if (radarInstance) radarInstance.destroy();
  const ctxRadar = document.getElementById('radarChart').getContext('2d');
  radarInstance = new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels: radarLabels,
      datasets: [{
        label: `% Votes « Pour » communs`,
        data: radarData,
        backgroundColor: 'rgba(5, 150, 105, 0.2)',
        borderColor: '#059669',
        pointBackgroundColor: '#059669'
      }]
    },
    options: {
      scales: { r: { min: 0, max: 100 } },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` Accord Pour/Pour : ${ctx.raw}% (${commStats[ctx.label].total} scrutins)`
          }
        }
      }
    }
  });

  const sortedMonths = Object.keys(timeStats).sort();
  const timeData = sortedMonths.map(m => ((timeStats[m].matches / timeStats[m].total) * 100).toFixed(1));

  if (timelineInstance) timelineInstance.destroy();
  const ctxTime = document.getElementById('timelineChart').getContext('2d');
  timelineInstance = new Chart(ctxTime, {
    type: 'line',
    data: {
      labels: sortedMonths,
      datasets: [{
        label: `% Accord Global (Mois par mois)`,
        data: timeData,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: { scales: { y: { min: 0, max: 100 } } }
  });
}

