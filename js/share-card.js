// ==========================================================
// OBSERVATOIRE DES VOTES PARLEMENTAIRES
// Moteur de rendu Canvas 2D (Fiches citoyennes Spotify-style)
// & Actions d'export / partage d'image
// ==========================================================

// --- OUTILS DE DESSIN CANVAS 2D ---
function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
  }
  ctx.closePath();
}

function fitAndDrawText(ctx, text, x, y, maxW, initialSize, minSize, color) {
  let size = initialSize;
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  while (ctx.measureText(text).width > maxW && size > minSize) {
    size -= 2;
    ctx.font = `700 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }
  ctx.fillText(text, x, y);
}

function drawSplitProgressBar(ctx, x, y, w, h, r, pourPct, contrePct, diffPct) {
  // Piste de fond
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();

  const total = (pourPct + contrePct + diffPct) || 100;
  const wPour = Math.round((pourPct / total) * w);
  const wContre = Math.round((contrePct / total) * w);
  const wDiff = Math.max(0, w - wPour - wContre);

  ctx.save();
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.clip();

  if (wPour > 0) {
    ctx.fillStyle = '#10b981';
    ctx.fillRect(x, y, wPour, h);
  }
  if (wContre > 0) {
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(x + wPour, y, wContre, h);
  }
  if (wDiff > 0) {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + wPour + wContre, y, wDiff, h);
  }
  ctx.restore();
}

function drawLegendItem(ctx, x, y, color, label) {
  ctx.beginPath();
  ctx.arc(x, y - 6, 7, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = '600 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(label, x + 16, y);
}

function drawCanvasArcWedge(ctx, cx, cy, rIn, rOut, startDeg, endDeg) {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;

  ctx.beginPath();
  ctx.arc(cx, cy, rOut, -startRad, -endRad, false);
  ctx.arc(cx, cy, rIn, -endRad, -startRad, true);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text || "").split(' ');
  let line = '';
  let currentY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
}

function wrapTextWithLimit(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = (text || "").split(' ');
  let line = '';
  let currentY = y;
  let lineCount = 1;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      if (lineCount >= maxLines) {
        let truncated = line.trim();
        while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '...', x, currentY);
        return currentY;
      }
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
}

// ==========================================================
// 1. RENDU CANVAS 2D : CARTE FACE-À-FACE (Style Spotify Wrapped)
// ==========================================================
function renderShareCardToCanvas(d, periodLabel, modeText) {
  const canvas = document.getElementById('shareCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const H = 1350;

  ctx.clearRect(0, 0, W, H);

  // 1. Fond sombre élégant avec dégradé subtil
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(0.5, '#070b16');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Halos lumineux d'ambiance (Style Spotify)
  const aura1 = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 420);
  aura1.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
  aura1.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = aura1;
  ctx.fillRect(0, 0, W, H);

  const aura2 = ctx.createRadialGradient(W * 0.15, H * 0.52, 10, W * 0.15, H * 0.52, 450);
  aura2.addColorStop(0, 'rgba(14, 165, 233, 0.18)');
  aura2.addColorStop(1, 'rgba(14, 165, 233, 0)');
  ctx.fillStyle = aura2;
  ctx.fillRect(0, 0, W, H);

  const aura3 = ctx.createRadialGradient(W * 0.6, H * 0.9, 10, W * 0.6, H * 0.9, 400);
  aura3.addColorStop(0, 'rgba(245, 158, 11, 0.12)');
  aura3.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = aura3;
  ctx.fillRect(0, 0, W, H);

  // 3. Cadre conteneur de la carte avec bordure fine vitrée
  drawRoundRect(ctx, 40, 40, W - 80, H - 80, 36);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.stroke();

  // 4. En-tête : Titre citoyen + Badge période
  ctx.beginPath();
  ctx.arc(84, 100, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('OBSERVATOIRE DES VOTES PARLEMENTAIRES', 104, 107);

  const pillText = `${periodLabel}${modeText}`;
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const pillMetrics = ctx.measureText(pillText);
  const pillW = pillMetrics.width + 34;
  const pillH = 38;
  const pillX = W - 80 - pillW;
  const pillY = 82;

  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 19);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(pillText, pillX + 17, pillY + 25);

  // 5. Bloc Face-à-face des 2 Groupes
  ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('FACE-À-FACE PARLEMENTAIRE', 84, 172);

  // Carte Groupe A
  drawRoundRect(ctx, 80, 190, 420, 86, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
  ctx.stroke();
  if (d.entityA && d.entityA.color) {
    ctx.fillStyle = d.entityA.color;
    ctx.beginPath();
    ctx.arc(98, 233, 6, 0, Math.PI * 2);
    ctx.fill();
    fitAndDrawText(ctx, d.gA, 114, 244, 360, 28, 18, '#ffffff');
  } else {
    fitAndDrawText(ctx, d.gA, 102, 244, 380, 30, 20, '#ffffff');
  }

  // Pastille "VS"
  drawRoundRect(ctx, 514, 208, 52, 50, 25);
  ctx.fillStyle = '#0284c7';
  ctx.fill();
  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('VS', 540, 240);
  ctx.textAlign = 'left';

  // Carte Groupe B
  drawRoundRect(ctx, 580, 190, 420, 86, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
  ctx.stroke();
  if (d.entityB && d.entityB.color) {
    ctx.fillStyle = d.entityB.color;
    ctx.beginPath();
    ctx.arc(598, 233, 6, 0, Math.PI * 2);
    ctx.fill();
    fitAndDrawText(ctx, d.gB, 614, 244, 360, 28, 18, '#ffffff');
  } else {
    fitAndDrawText(ctx, d.gB, 602, 244, 380, 30, 20, '#ffffff');
  }

  // 6. Bloc Héroïque : Taux d'accord global (Format Spotify Wrapped)
  drawRoundRect(ctx, 80, 305, 920, 335, 26);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.stroke();

  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText("TAUX D'ACCORD GLOBAL DE VOTE", 120, 355);

  // Score géant
  ctx.font = '900 110px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${d.totalAccordPct}%`, 116, 465);

  const scoreWidth = ctx.measureText(`${d.totalAccordPct}%`).width;
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`des scrutins votés de concert`, 140 + scoreWidth, 424);

  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`sur ${d.totalSharedVotes.toLocaleString('fr-FR')} scrutins communs analysés`, 140 + scoreWidth, 458);

  // Barre segmentée de répartition
  const barX = 120, barY = 510, barW = 840, barH = 34, barR = 17;
  drawSplitProgressBar(ctx, barX, barY, barW, barH, barR, parseFloat(d.pourPct), parseFloat(d.contrePct), parseFloat(d.diffPct));

  // Légende sous la barre
  drawLegendItem(ctx, 120, 582, '#10b981', `Votes Pour (${d.pourPct}%)`);
  drawLegendItem(ctx, 420, 582, '#0ea5e9', `Rejets communs (${d.contrePct}%)`);
  drawLegendItem(ctx, 720, 582, '#f59e0b', `Divergences (${d.diffPct}%)`);

  // 7. Trois cartes statistiques détaillées
  const tileY = 665;
  const tileH = 225;
  const tileW = 290;
  const tileGap = 25;

  // Tuile 1 : Votes Pour
  const t1X = 80;
  drawRoundRect(ctx, t1X, tileY, tileW, tileH, 20);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
  ctx.stroke();

  ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#34d399';
  ctx.fillText('VOTES « POUR »', t1X + 24, tileY + 42);

  ctx.font = '800 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#10b981';
  ctx.fillText(`${d.pourPct}%`, t1X + 24, tileY + 112);

  ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`${d.pourPourCount.toLocaleString('fr-FR')} textes`, t1X + 24, tileY + 155);

  ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('Adoptions conjointes', t1X + 24, tileY + 186);

  // Tuile 2 : Rejets communs (Opposition conjointe)
  const t2X = t1X + tileW + tileGap;
  drawRoundRect(ctx, t2X, tileY, tileW, tileH, 20);
  ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
  ctx.stroke();

  ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('REJETS CONJOINTS', t2X + 24, tileY + 42);

  ctx.font = '800 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`${d.contrePct}%`, t2X + 24, tileY + 112);

  ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`${d.contreContreCount.toLocaleString('fr-FR')} textes`, t2X + 24, tileY + 155);

  ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#bae6fd';
  ctx.fillText('Oppositions conjointes', t2X + 24, tileY + 186);

  // Tuile 3 : Divergences
  const t3X = t2X + tileW + tileGap;
  drawRoundRect(ctx, t3X, tileY, tileW, tileH, 20);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.stroke();

  ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('DIVERGENCES', t3X + 24, tileY + 42);

  ctx.font = '800 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`${d.diffPct}%`, t3X + 24, tileY + 112);

  ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`${d.diffCount.toLocaleString('fr-FR')} textes`, t3X + 24, tileY + 155);

  ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#fde68a';
  ctx.fillText('Positions opposées', t3X + 24, tileY + 186);

  // 8. Synthèse explicative citoyenne
  const narrY = 918;
  const narrH = 220;
  drawRoundRect(ctx, 80, narrY, 920, narrH, 22);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText("💡 DÉCRYPTAGE DU VOTE EN HÉMICYCLE", 116, narrY + 44);

  ctx.font = '400 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  const narrativeText = `Sur les textes où les deux formations ont pris part au vote (${periodLabel}${modeText}), ${d.gA} et ${d.gB} ont voté de manière identique dans ${d.totalAccordPct}% des cas (dont ${d.pourPct}% d'adoptions conjointes et ${d.contrePct}% de rejets conjoints). Dans ${d.diffPct}% des scrutins, leurs votes ont divergé directement.`;
  wrapText(ctx, narrativeText, 116, narrY + 86, 848, 32);

  // 9. Pied de page & Sceau de confiance
  const footY = 1205;
  ctx.beginPath();
  ctx.moveTo(80, footY);
  ctx.lineTo(W - 80, footY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '500 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText("🏛️ Données vérifiées • Open Data officiel de l'Assemblée nationale", 84, footY + 48);

  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText("VersusPolitique / Observatoire citoyen", W - 84, footY + 48);
  ctx.textAlign = 'left';
}

// ==========================================
// 2. RENDU CANVAS 2D : CARTE PAR SCRUTIN
// ==========================================
function renderScrutinShareCardToCanvas(s) {
  const canvas = document.getElementById('shareCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const H = 1350;

  ctx.clearRect(0, 0, W, H);

  const isAdopte = (s.sort || '').toLowerCase().includes('adopt');

  // 1. Fond sombre élégant avec dégradé subtil
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(0.5, '#070b16');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Halos lumineux d'ambiance
  if (isAdopte) {
    const aura1 = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 420);
    aura1.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    aura1.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = aura1;
    ctx.fillRect(0, 0, W, H);
  } else {
    const aura1 = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 420);
    aura1.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
    aura1.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = aura1;
    ctx.fillRect(0, 0, W, H);
  }

  const aura2 = ctx.createRadialGradient(W * 0.15, H * 0.55, 10, W * 0.15, H * 0.55, 450);
  aura2.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
  aura2.addColorStop(1, 'rgba(14, 165, 233, 0)');
  ctx.fillStyle = aura2;
  ctx.fillRect(0, 0, W, H);

  const aura3 = ctx.createRadialGradient(W * 0.5, H * 0.92, 10, W * 0.5, H * 0.92, 400);
  aura3.addColorStop(0, 'rgba(99, 102, 241, 0.14)');
  aura3.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = aura3;
  ctx.fillRect(0, 0, W, H);

  // 3. Cadre conteneur de la carte avec bordure vitrée
  drawRoundRect(ctx, 40, 40, W - 80, H - 80, 36);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.stroke();

  // 4. En-tête : Logo citoyen + Badge numéro de scrutin
  ctx.beginPath();
  ctx.arc(84, 100, 7, 0, Math.PI * 2);
  ctx.fillStyle = isAdopte ? '#10b981' : '#ef4444';
  ctx.fill();

  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('OBSERVATOIRE DES VOTES PARLEMENTAIRES', 104, 107);

  const pillText = `Scrutin n°${s.id} • ${s.legislature || '17'}e Législature`;
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const pillMetrics = ctx.measureText(pillText);
  const pillW = pillMetrics.width + 34;
  const pillH = 38;
  const pillX = W - 84 - pillW;
  const pillY = 81;

  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 19);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.stroke();

  ctx.fillStyle = '#f1f5f9';
  ctx.fillText(pillText, pillX + 17, pillY + 25);

  // 5. Métadonnées du scrutin
  let metaY = 168;
  ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  const dateStr = s.date || 'Date non précisée';
  const commStr = s.commission ? ` • ${s.commission}` : ' • Séance publique';
  ctx.fillText(`📅 ${dateStr}${commStr}`, 84, metaY);

  // 6. Titre de la loi ou motion
  const titleY = metaY + 26;
  ctx.font = '800 27px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#ffffff';

  const maxTitleW = W - 168;
  const lines = wrapCanvasText(ctx, s.titre, maxTitleW, 2);
  lines.forEach((line, i) => {
    ctx.fillText(line, 84, titleY + i * 36);
  });

  // 7. Bannière du résultat officiel (Adopté / Rejeté)
  const bannerY = titleY + (lines.length * 36) + 16;
  const bannerH = 74;
  const bannerW = 912;
  drawRoundRect(ctx, 84, bannerY, bannerW, bannerH, 16);

  if (isAdopte) {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.textAlign = 'center';
    ctx.fillText('✓  TEXTE ADOPTÉ PAR L\'ASSEMBLÉE NATIONALE', W / 2, bannerY + 46);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    ctx.font = '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'center';
    ctx.fillText('✕  TEXTE REJETÉ PAR L\'ASSEMBLÉE NATIONALE', W / 2, bannerY + 46);
    ctx.textAlign = 'left';
  }

  // 8. Grille des 11 Groupes Politiques (Disposition élégante en 2 colonnes)
  const sectionHeadingY = bannerY + bannerH + 34;
  ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('POSITIONS OFFICIELLES PAR GROUPE PARLEMENTAIRE', 84, sectionHeadingY);

  const gridTopY = sectionHeadingY + 16;
  const cardW = 444;
  const cardH = 88;
  const rowGap = 12;
  const colGap = 24;

  let pourGroupsCount = 0;
  let contreGroupsCount = 0;
  let abstGroupsCount = 0;

  POLITICAL_SPECTRUM.forEach((g, idx) => {
    const col = (idx < 6) ? 0 : 1;
    const row = (idx < 6) ? idx : (idx - 6);
    const cardX = (col === 0) ? 84 : (84 + cardW + colGap);
    const cardY = gridTopY + row * (cardH + rowGap);

    const pos = s.positions ? s.positions[g] : null;
    const shortName = GROUP_SHORT_NAMES[g] || g;
    const seats = GROUP_SEATS[g];

    if (pos === 'POUR') pourGroupsCount++;
    else if (pos === 'CONTRE') contreGroupsCount++;
    else if (pos === 'ABSTENTION') abstGroupsCount++;

    // Carte groupe
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // Nom du groupe
    ctx.font = '700 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f1f5f9';
    let displayGroupName = g;
    if (displayGroupName.length > 22) {
      displayGroupName = shortName + ' - ' + g.slice(0, 18) + '...';
    }
    ctx.fillText(displayGroupName, cardX + 16, cardY + 36);

    // Députés / Sièges
    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(seats ? `${seats} députés` : '', cardX + 16, cardY + 62);

    // Badge de consigne de vote
    const badgeW = 120;
    const badgeH = 34;
    const badgeX = cardX + cardW - badgeW - 16;
    const badgeY = cardY + 16;

    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);

    if (pos === 'POUR') {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#10b981';
      ctx.stroke();

      ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#34d399';
      ctx.textAlign = 'center';
      ctx.fillText('POUR', badgeX + badgeW / 2, badgeY + 23);
      ctx.textAlign = 'left';
    } else if (pos === 'CONTRE') {
      ctx.fillStyle = 'rgba(14, 116, 144, 0.18)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#0891b2';
      ctx.stroke();

      ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.fillText('CONTRE', badgeX + badgeW / 2, badgeY + 23);
      ctx.textAlign = 'left';
    } else if (pos === 'ABSTENTION') {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();

      ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText('ABST.', badgeX + badgeW / 2, badgeY + 23);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.stroke();

      ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('ABSENT', badgeX + badgeW / 2, badgeY + 23);
      ctx.textAlign = 'left';
    }

    // Présence des députés du groupe
    const dg = s.decompte_groupes && s.decompte_groupes[g];
    if (dg) {
      const presents = dg.pour + dg.contre + dg.abstentions;
      const totMembres = seats || dg.total_membres;
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.fillText(`${presents}/${totMembres} présents`, cardX + cardW - 18, cardY + 70);
      ctx.textAlign = 'left';
    }
  });

  // 9. Synthèse rapide des groupes (Pill recap)
  const recapY = gridTopY + 6 * (cardH + rowGap) + 8;
  drawRoundRect(ctx, 84, recapY, 912, 48, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'center';
  ctx.fillText(
    `🟢 ${pourGroupsCount} groupe(s) Pour   •   🔵 ${contreGroupsCount} groupe(s) Contre   •   🟠 ${abstGroupsCount} Abstention`,
    W / 2,
    recapY + 30
  );
  ctx.textAlign = 'left';

  // 10. Pied de page
  const footY = 1225;
  ctx.beginPath();
  ctx.moveTo(84, footY);
  ctx.lineTo(W - 84, footY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText("🏛️ Données officielles Open Data de l'Assemblée nationale", 84, footY + 44);

  ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText("Observatoire des Votes Parlementaires", W - 84, footY + 44);
  ctx.textAlign = 'left';
}

// ==========================================
// 2b. RENDU CANVAS 2D : CARTE HÉMICYCLE (Style Spotify Wrapped)
// ==========================================
let currentScrutinShareFormat = 'hemicycle';

function setScrutinShareFormat(format) {
  currentScrutinShareFormat = format;
  updateScrutinShareFormatButtons();
  const s = activeModalScrutin || window.activeScrutinForShare;
  if (s) {
    if (format === 'hemicycle') {
      renderScrutinHemicycleShareCardToCanvas(s);
    } else {
      renderScrutinShareCardToCanvas(s);
    }
  }
}

function updateScrutinShareFormatButtons() {
  const btnHemi = document.getElementById('btnShareFormatHemi');
  const btnList = document.getElementById('btnShareFormatList');
  if (btnHemi && btnList) {
    if (currentScrutinShareFormat === 'hemicycle') {
      btnHemi.classList.add('active');
      btnList.classList.remove('active');
    } else {
      btnList.classList.add('active');
      btnHemi.classList.remove('active');
    }
  }
}

function renderScrutinHemicycleShareCardToCanvas(s) {
  const canvas = document.getElementById('shareCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const H = 1350;

  ctx.clearRect(0, 0, W, H);

  const isAdopte = (s.sort || '').toLowerCase().includes('adopt');
  const outcomeLabel = isAdopte ? 'ADOPTÉ' : 'REJETÉ';
  const outcomeColor = isAdopte ? '#10b981' : '#ef4444';

  // 1. Fond sombre élégant avec dégradé subtil
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(0.5, '#070b16');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Halos d'ambiance
  if (isAdopte) {
    const aura1 = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 420);
    aura1.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    aura1.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = aura1;
    ctx.fillRect(0, 0, W, H);
  } else {
    const aura1 = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 420);
    aura1.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
    aura1.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = aura1;
    ctx.fillRect(0, 0, W, H);
  }

  const aura2 = ctx.createRadialGradient(W * 0.15, H * 0.55, 10, W * 0.15, H * 0.55, 450);
  aura2.addColorStop(0, 'rgba(14, 165, 233, 0.16)');
  aura2.addColorStop(1, 'rgba(14, 165, 233, 0)');
  ctx.fillStyle = aura2;
  ctx.fillRect(0, 0, W, H);

  const aura3 = ctx.createRadialGradient(W * 0.5, H * 0.92, 10, W * 0.5, H * 0.92, 400);
  aura3.addColorStop(0, 'rgba(99, 102, 241, 0.14)');
  aura3.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = aura3;
  ctx.fillRect(0, 0, W, H);

  // 3. Cadre conteneur avec bordure vitrée
  drawRoundRect(ctx, 40, 40, W - 80, H - 80, 36);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.stroke();

  // 4. En-tête : Logo citoyen + Badge numéro
  ctx.beginPath();
  ctx.arc(84, 98, 7, 0, Math.PI * 2);
  ctx.fillStyle = isAdopte ? '#10b981' : '#ef4444';
  ctx.fill();

  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('OBSERVATOIRE DES VOTES PARLEMENTAIRES', 104, 105);

  const pillText = `Scrutin n°${s.id} • ${s.legislature || '17'}e Législature`;
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const pillMetrics = ctx.measureText(pillText);
  const pillW = pillMetrics.width + 34;
  const pillH = 38;
  const pillX = W - 80 - pillW;
  const pillY = 80;

  drawRoundRect(ctx, pillX, pillY, pillW, pillH, 19);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(pillText, pillX + 17, pillY + 25);

  // 5. Titre du scrutin
  ctx.font = '700 25px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f8fafc';
  const endTitleY = wrapTextWithLimit(ctx, s.titre, 84, 168, 912, 34, 3);

  // 6. Métadonnées (Date + Commission)
  const metaY = Math.max(endTitleY + 28, 268);
  ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  const dateStr = s.date ? `📅 ${s.date}` : '📅 Date non renseignée';
  const commStr = s.commission ? `🏛️ ${s.commission}` : '🏛️ Séance publique';
  ctx.fillText(`${dateStr}   •   ${commStr}`, 84, metaY);

  // 7. Bannière officielle avec décompte global intégré
  const bannerY = metaY + 16;
  const bannerH = 76;
  const bannerW = 912;
  drawRoundRect(ctx, 84, bannerY, bannerW, bannerH, 18);

  const syn = s.synthese || {};
  let totalP = 0, totalC = 0, totalA = 0;
  POLITICAL_SPECTRUM.forEach(g => {
    const dg = s.decompte_groupes && s.decompte_groupes[g];
    if (dg) { totalP += dg.pour; totalC += dg.contre; totalA += dg.abstentions; }
  });
  const pourCount = syn.pour != null ? syn.pour : totalP;
  const contreCount = syn.contre != null ? syn.contre : totalC;
  const abstCount = syn.abstentions != null ? syn.abstentions : totalA;
  const votantsCount = syn.votants != null ? syn.votants : (pourCount + contreCount + abstCount);
  const isMotionCensure = (s.titre || '').toLowerCase().includes('censure') || (s.sort || '').toLowerCase().includes('censure');
  const majRequise = isMotionCensure ? 289 : (votantsCount > 0 ? (Math.floor(votantsCount / 2) + 1) : 0);

  if (isAdopte) {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    ctx.font = '800 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.textAlign = 'center';
    ctx.fillText('✓  TEXTE ADOPTÉ PAR L\'ASSEMBLÉE NATIONALE', W / 2, bannerY + 34);
  } else {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    ctx.font = '800 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'center';
    ctx.fillText('✕  TEXTE REJETÉ PAR L\'ASSEMBLÉE NATIONALE', W / 2, bannerY + 34);
  }

  // Sous-ligne chiffrée dans la bannière
  ctx.font = '600 15.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText(
    `🟢 ${pourCount} Pour   •   🔵 ${contreCount} Contre   •   🟠 ${abstCount} Abstention   •   👥 ${votantsCount} Votants / 577`,
    W / 2,
    bannerY + 61
  );
  ctx.textAlign = 'left';

  // 8. Hémicycle Parlementaire Vectoriel 2D
  const hemiHeadingY = bannerY + bannerH + 30;
  ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText("PROJECTION SPATIALE & DÉPUTÉS PRÉSENTS (577 SIÈGES)", 84, hemiHeadingY);

  const cx = 540;
  const cy = 690;
  const rIn = 145;
  const rOut = 280;
  const deltaR = rOut - rIn;
  const coverageDeg = 220;
  const startDeg = 200;
  const gapDeg = 1.0;
  const totalSeats = 577;

  // Rail arrière-plan
  ctx.save();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  drawCanvasArcWedge(ctx, cx, cy, rIn - 1.5, rOut + 1.5, startDeg, startDeg - coverageDeg);
  ctx.stroke();
  ctx.restore();

  let currentAngle = startDeg;

  const hemiGroupSectors = (typeof HEMICYCLE_GROUPS_ORDER !== 'undefined' ? HEMICYCLE_GROUPS_ORDER : POLITICAL_SPECTRUM).map(groupName => {
    const dg = (s.decompte_groupes && s.decompte_groupes[groupName]) ? s.decompte_groupes[groupName] : null;
    const baseSeats = ((typeof HEMICYCLE_SEATS_MAP !== 'undefined' && HEMICYCLE_SEATS_MAP[groupName]) 
      || (typeof GROUP_SEATS !== 'undefined' && GROUP_SEATS[groupName]) 
      || 15);
    const seats = (dg && dg.total_membres > 1) ? dg.total_membres : baseSeats;
    const fraction = seats / totalSeats;
    const angleSpan = coverageDeg * fraction;

    const startA = currentAngle;
    const endA = currentAngle - angleSpan;
    const midA = (startA + endA) / 2;
    currentAngle = endA;

    const pos = s.positions ? s.positions[groupName] : null;
    const p = dg ? (dg.pour || 0) : 0;
    const c = dg ? (dg.contre || 0) : 0;
    const a = dg ? (dg.abstentions || 0) : 0;
    const nv = dg ? (dg.non_votants || 0) : Math.max(0, seats - (p + c + a));
    const presents = p + c + a;
    const presenceRatio = seats > 0 ? (presents / seats) : 0;
    const presencePct = Math.round(presenceRatio * 1000) / 10;

    return {
      groupName,
      shortName: (typeof GROUP_SHORT_NAMES !== 'undefined' && GROUP_SHORT_NAMES[groupName])
        ? GROUP_SHORT_NAMES[groupName]
        : (groupName === 'Non Inscrits' ? 'NI' : groupName.substring(0, 4)),
      seats,
      pos,
      dg,
      p, c, a, nv,
      presents,
      presenceRatio,
      presencePct,
      startAngle: startA - (gapDeg / 2),
      endAngle: endA + (gapDeg / 2),
      midAngle: midA
    };
  });

  // Dessin des secteurs
  hemiGroupSectors.forEach(sec => {
    const { shortName, pos, nv, presents, presenceRatio, startAngle, endAngle, midAngle } = sec;

    let mainColor = '#475569';
    let strokeColor = '#334155';
    const isVoted = Boolean(pos && presents > 0);

    if (pos === 'POUR') {
      mainColor = '#10b981'; strokeColor = '#059669';
    } else if (pos === 'CONTRE') {
      mainColor = '#0e7490'; strokeColor = '#155e75';
    } else if (pos === 'ABSTENTION') {
      mainColor = '#f59e0b'; strokeColor = '#d97706';
    }

    // 1. Fond de travée (gabarit 100%)
    drawCanvasArcWedge(ctx, cx, cy, rIn, rOut, startAngle, endAngle);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    const isFullyAbsent = (presents === 0);

    if (isFullyAbsent) {
      // Groupe 100% absent : travée entière vide / hachurée
      drawCanvasArcWedge(ctx, cx, cy, rIn, rOut, startAngle, endAngle);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.stroke();
    } else {
      // 2. Hauteur de présence
      const effRatio = Math.max(0.18, Math.min(1.0, presenceRatio));
      const rEff = rIn + deltaR * effRatio;
      const hasAbsents = (nv > 0 && effRatio < 0.98);

      // 3. Frange des absents
      if (hasAbsents) {
        drawCanvasArcWedge(ctx, cx, cy, rEff, rOut, startAngle, endAngle);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.13)';
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.stroke();
      }

      // 4. Corps principal du vote (députés présents)
      drawCanvasArcWedge(ctx, cx, cy, rIn, rEff, startAngle, endAngle);
      ctx.fillStyle = mainColor;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }

    // 5. Sigle du parti au-dessus du secteur
    const rad = (midAngle * Math.PI) / 180;
    const labelR = rOut + 20;
    const lx = cx + labelR * Math.cos(rad);
    const ly = cy - labelR * Math.sin(rad);

    ctx.font = '800 13.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText(shortName, lx, ly + 5);
  });

  // 9. Perchoir central sur l'hémicycle
  drawRoundRect(ctx, cx - 75, cy - 78, 150, 36, 18);
  ctx.fillStyle = isAdopte ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = outcomeColor;
  ctx.stroke();

  ctx.font = '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isAdopte ? '#34d399' : '#f87171';
  ctx.textAlign = 'center';
  ctx.fillText(outcomeLabel, cx, cy - 54);

  drawRoundRect(ctx, cx - 110, cy - 30, 220, 26, 6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.stroke();

  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#10b981';
  ctx.fillText(`● ${pourCount}`, cx - 60, cy - 13);
  ctx.fillStyle = '#0e7490';
  ctx.fillText(`● ${contreCount}`, cx, cy - 13);
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(`● ${abstCount}`, cx + 60, cy - 13);

  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${votantsCount} présents • Maj. requise : ${majRequise}`, cx, cy + 16);
  ctx.textAlign = 'left';

  // 10. Légende sous l'hémicycle
  const legendBoxY = 808;
  drawRoundRect(ctx, 84, legendBoxY, 912, 42, 10);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.stroke();

  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'center';
  ctx.fillText(
    `🟢 Pour   •   🔵 Contre   •   🟠 Abstention   •   ⚪ Frange supérieure : Députés absents (hauteur = présence)`,
    W / 2,
    legendBoxY + 26
  );
  ctx.textAlign = 'left';

  // 11. Grille compacte des groupes (2 colonnes de 6 groupes)
  const compactGridY = 862;
  const colW = 444;
  const itemH = 32;
  const colGap = 24;

  hemiGroupSectors.slice(0, 12).forEach((sec, idx) => {
    const col = idx < 6 ? 0 : 1;
    const row = idx < 6 ? idx : (idx - 6);
    const itemX = (col === 0) ? 84 : (84 + colW + colGap);
    const itemY = compactGridY + row * (itemH + 6);

    drawRoundRect(ctx, itemX, itemY, colW, itemH, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.stroke();

    // Pastille vote
    let dotColor = '#94a3b8';
    let voteBadgeText = 'ABS.';
    let voteTextColor = '#94a3b8';
    if (sec.pos === 'POUR') {
      dotColor = '#10b981'; voteBadgeText = 'POUR'; voteTextColor = '#34d399';
    } else if (sec.pos === 'CONTRE') {
      dotColor = '#0891b2'; voteBadgeText = 'CONTRE'; voteTextColor = '#38bdf8';
    } else if (sec.pos === 'ABSTENTION') {
      dotColor = '#f59e0b'; voteBadgeText = 'ABST.'; voteTextColor = '#fbbf24';
    }

    ctx.beginPath();
    ctx.arc(itemX + 16, itemY + itemH / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();

    // Nom court
    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f1f5f9';
    let labelGroup = sec.shortName;
    if (sec.groupName.length <= 26) labelGroup += ` (${sec.groupName})`;
    ctx.fillText(labelGroup, itemX + 28, itemY + itemH / 2 + 4.5);

    // Vote + Présence sur la droite
    ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = voteTextColor;
    ctx.textAlign = 'right';
    ctx.fillText(voteBadgeText, itemX + colW - 110, itemY + itemH / 2 + 4.5);

    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${sec.presents}/${sec.seats} prés.`, itemX + colW - 12, itemY + itemH / 2 + 4.5);
    ctx.textAlign = 'left';
  });

  // 12. Pied de page
  const footY = 1225;
  ctx.beginPath();
  ctx.moveTo(84, footY);
  ctx.lineTo(W - 84, footY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText("🏛️ Données officielles Open Data de l'Assemblée nationale", 84, footY + 44);

  ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText("Observatoire des Votes Parlementaires", W - 84, footY + 44);
  ctx.textAlign = 'left';
}

// ==========================================================
// 3. GESTION DES MODALES DE PARTAGE ET EXPORT
// ==========================================================

// Gestion de la modale de partage pour un scrutin
function openScrutinShareModal() {
  if (!activeModalScrutin) return;
  currentShareMode = 'scrutin';

  const s = activeModalScrutin;
  window.activeScrutinForShare = s;
  const subtitleEl = document.getElementById('shareModalSubtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `Scrutin public n°${s.id} (${s.legislature || '17'}e Législature)`;
  }
  document.getElementById('shareModalTitle').textContent = `Fiche : Scrutin n°${s.id}`;

  const selector = document.getElementById('scrutinShareFormatSelector');
  if (selector) {
    selector.style.setProperty('display', 'flex', 'important');
  }
  updateScrutinShareFormatButtons();

  if (currentScrutinShareFormat === 'hemicycle') {
    renderScrutinHemicycleShareCardToCanvas(s);
  } else {
    renderScrutinShareCardToCanvas(s);
  }

  const nativeBtn = document.getElementById('btnNativeShare');
  if (nativeBtn) {
    try {
      const testFile = new File([''], 'test.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
        nativeBtn.style.display = 'inline-flex';
      } else {
        nativeBtn.style.display = 'none';
      }
    } catch (_) {
      nativeBtn.style.display = 'none';
    }
  }

  document.getElementById('shareModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Gestion de la modale de carte de synthèse partageable (Face-à-face)
function openShareModal() {
  currentShareMode = 'comparison';
  const selector = document.getElementById('scrutinShareFormatSelector');
  if (selector) selector.style.setProperty('display', 'none', 'important');

  if (!currentComparisonData) {
    renderCharts();
  }
  if (!currentComparisonData) return;

  const d = currentComparisonData;
  const periodVal = document.getElementById('globalPeriodFilter').value;
  const periodLabel = (periodVal === 'LEG_17') ? '17e Législature' : (periodVal === 'LEG_16' ? '16e Législature' : '16e & 17e Lég.');
  const modeText = globalMajorFilterOnly ? ' (Textes majeurs)' : '';

  const subtitleEl = document.getElementById('shareModalSubtitle');
  if (subtitleEl) subtitleEl.textContent = "Fiche citoyenne prête à partager";
  document.getElementById('shareModalTitle').textContent = `Fiche : ${d.gA} & ${d.gB}`;

  // Rendu immédiat sur le Canvas 2D
  renderShareCardToCanvas(d, periodLabel, modeText);

  // Détection de la compatibilité Web Share API (mobile/tablette)
  const nativeBtn = document.getElementById('btnNativeShare');
  if (nativeBtn) {
    try {
      const testFile = new File([''], 'test.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
        nativeBtn.style.display = 'inline-flex';
      } else {
        nativeBtn.style.display = 'none';
      }
    } catch (_) {
      nativeBtn.style.display = 'none';
    }
  }

  document.getElementById('shareModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('active');
  const scrutinModal = document.getElementById('scrutinModal');
  if (!scrutinModal || !scrutinModal.classList.contains('active')) {
    document.body.style.overflow = '';
  }
  const selector = document.getElementById('scrutinShareFormatSelector');
  if (selector) selector.style.setProperty('display', 'none', 'important');
  const toast = document.getElementById('shareStatusToast');
  if (toast) toast.style.display = 'none';
  const copyBtn = document.getElementById('copyCardTextBtn');
  if (copyBtn) copyBtn.innerHTML = '<span>📋</span> Copier le texte';
}

function closeShareModalOnBackdrop(event) {
  if (event.target.id === 'shareModal') {
    closeShareModal();
  }
}

function showShareToast(msg) {
  const toast = document.getElementById('shareStatusToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(window._shareToastTimer);
  window._shareToastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 3200);
}

function downloadShareImage() {
  const canvas = document.getElementById('shareCanvas');
  if (!canvas) return;

  let filename = 'fiche-citoyenne.png';
  if (currentShareMode === 'scrutin' && activeModalScrutin) {
    const fmt = (typeof currentScrutinShareFormat !== 'undefined') ? currentScrutinShareFormat : 'hemicycle';
    filename = `scrutin-${activeModalScrutin.id}-${fmt}.png`;
  } else if (currentShareMode === 'deputy' && activeDeputyShare) {
    const safeNom = (activeDeputyShare.nom || 'depute').replace(/[^a-zA-Z0-9]/g, '_');
    filename = `assiduite-${safeNom}.png`;
  } else if (currentComparisonData) {
    const d = currentComparisonData;
    const safeA = (GROUP_SHORT_NAMES[d.gA] || d.gA).replace(/[^a-zA-Z0-9]/g, '_');
    const safeB = (GROUP_SHORT_NAMES[d.gB] || d.gB).replace(/[^a-zA-Z0-9]/g, '_');
    filename = `fiche-citoyenne-${safeA}-vs-${safeB}.png`;
  }

  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showShareToast("✅ Image PNG téléchargée !");
    }, 'image/png');
  } else {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showShareToast("✅ Image PNG téléchargée !");
  }
}

function copyShareImage() {
  const canvas = document.getElementById('shareCanvas');
  if (!canvas) return;

  if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        const copyImgBtn = document.getElementById('btnCopyImage');
        if (copyImgBtn) {
          copyImgBtn.innerHTML = '<span>✅</span> Image copiée !';
          setTimeout(() => {
            copyImgBtn.innerHTML = '<span>🖼️</span> Copier l\'image';
          }, 2500);
        }
        showShareToast("✅ Image copiée dans le presse-papier ! Prête à coller (Ctrl+V)");
      } catch (err) {
        console.warn("Clipboard write image fallback", err);
        downloadShareImage();
        showShareToast("Image téléchargée sur votre appareil !");
      }
    }, 'image/png');
  } else {
    downloadShareImage();
    showShareToast("Image téléchargée sur votre appareil !");
  }
}

function shareImageNative() {
  const canvas = document.getElementById('shareCanvas');
  if (!canvas) return;

  if (currentShareMode === 'scrutin' && activeModalScrutin) {
    const s = activeModalScrutin;
    const isAdopte = (s.sort || '').toLowerCase().includes('adopt');
    const sortLabel = isAdopte ? 'Adopté' : 'Rejeté';
    if (canvas.toBlob) {
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `scrutin-${s.id}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Scrutin n°${s.id} (${sortLabel})`,
              text: `Observatoire des votes : scrutin n°${s.id} (${sortLabel}) - ${s.titre.slice(0, 100)}...`
            });
          } catch (e) {
            if (e.name !== 'AbortError') console.error(e);
          }
        } else {
          downloadShareImage();
        }
      }, 'image/png');
    }
  } else if (currentComparisonData) {
    const d = currentComparisonData;
    const safeA = GROUP_SHORT_NAMES[d.gA] || d.gA;
    const safeB = GROUP_SHORT_NAMES[d.gB] || d.gB;

    if (canvas.toBlob) {
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `accord-${safeA}-vs-${safeB}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Accord de vote : ${d.gA} & ${d.gB}`,
              text: `Observatoire des Votes : ${d.totalAccordPct}% d'accord entre ${d.gA} et ${d.gB}.`
            });
          } catch (e) {
            if (e.name !== 'AbortError') console.error(e);
          }
        } else {
          downloadShareImage();
        }
      }, 'image/png');
    }
  }
}

function copyShareCardText() {
  let text = '';
  if (currentShareMode === 'scrutin' && activeModalScrutin) {
    const s = activeModalScrutin;
    const isAdopte = (s.sort || '').toLowerCase().includes('adopt');
    const sortLabel = isAdopte ? '✅ TEXTE ADOPTÉ' : '❌ TEXTE REJETÉ';

    const syn = s.synthese || {};
    const scoreText = syn.votants ? `Décompte officiel : ${syn.pour} Pour · ${syn.contre} Contre · ${syn.abstentions} Abst. (${syn.votants} votants / 577)\n\n` : '';

    text = `🗳️ Observatoire des Votes Parlementaires\n` +
           `Scrutin public n°${s.id} (${s.legislature || '17'}e Législature) — ${sortLabel}\n\n` +
           `📜 ${s.titre}\n` +
           `📅 Date : ${s.date || 'Non renseignée'} | 🏛️ Thématique : ${s.commission || 'Séance publique'}\n` +
           scoreText +
           `Positions et présence des groupes politiques :\n`;

    POLITICAL_SPECTRUM.forEach(g => {
      const pos = s.positions ? s.positions[g] : null;
      const dg = s.decompte_groupes && s.decompte_groupes[g];
      const presText = dg ? ` (${dg.pour + dg.contre + dg.abstentions}/${dg.total_membres} présents)` : '';
      let posText = '⚪ Non participant / <3 votants';
      if (pos === 'POUR') posText = '🟢 POUR';
      else if (pos === 'CONTRE') posText = '🔵 CONTRE';
      else if (pos === 'ABSTENTION') posText = '🟠 ABSTENTION';
      text += `• ${g} : ${posText}${presText}\n`;
    });

    const leg = s.legislature || '17';
    text += `\nFiche officielle : https://www.assemblee-nationale.fr/dyn/${leg}/scrutins/${s.id}\n` +
            `Source : Open Data officiel de l'Assemblée nationale`;
  } else if (currentShareMode === 'deputy' && activeDeputyShare) {
    const dep = activeDeputyShare;
    text = `⏱️ Fiche d'Assiduité Citoyenne : ${dep.civ} ${dep.nom} (${dep.groupe})\n` +
           `📍 Circonscription : ${dep.circo || dep.departement || 'France'} • Législature(s) ${dep.legislatures.join(', ')}\n\n` +
           `• ⭐ Textes Majeurs : ${dep.taux_majeurs}% (${dep.majeurs_votes} / ${dep.majeurs_possibles} votés)\n` +
           `• 🌐 Présence Globale : ${dep.taux_global}% (${dep.votes} / ${dep.scrutins_possibles} votés)\n` +
           `• 📋 Recours Procuration : ${dep.taux_delegation}% des votes (${dep.delegation} par délégation)\n` +
           `• Profil parlementaire : ${dep.quadrant}\n\n` +
           `Médianes Assemblée nationale : Textes majeurs = 32.0% | Présence globale = 22.7%\n` +
           `Source : Observatoire des Votes Parlementaires • Open Data officiel de l'Assemblée nationale`;
  } else if (currentComparisonData) {
    const d = currentComparisonData;
    const periodVal = document.getElementById('globalPeriodFilter').value;
    const periodLabel = (periodVal === 'LEG_17') ? '17e Législature' : (periodVal === 'LEG_16' ? '16e Législature' : 'Toutes législatures');
    const majorText = globalMajorFilterOnly ? ' (Textes majeurs uniquement)' : '';

    text = `📊 Observatoire des Votes Parlementaires\n` +
           `Accord politique entre ${d.gA} et ${d.gB} : ${d.totalAccordPct}%\n\n` +
           `• Votes « Pour » communs (soutien conjoint) : ${d.pourPct}% (${d.pourPourCount.toLocaleString('fr-FR')} scrutins)\n` +
           `• Votes « Contre » communs (opposition conjointe) : ${d.contrePct}% (${d.contreContreCount.toLocaleString('fr-FR')} scrutins)\n` +
           `• Positions opposées : ${d.diffPct}% (${d.diffCount.toLocaleString('fr-FR')} scrutins)\n\n` +
           `Périmètre : ${periodLabel}${majorText} — Total : ${d.totalSharedVotes.toLocaleString('fr-FR')} votes communs.\n` +
           `Source : Open Data officiel de l'Assemblée nationale`;
  } else {
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const copyBtn = document.getElementById('copyCardTextBtn');
    if (copyBtn) {
      copyBtn.innerHTML = '<span>✅</span> Texte copié !';
      setTimeout(() => { copyBtn.innerHTML = '<span>📋</span> Copier le texte'; }, 2500);
    }
    showShareToast("✅ Texte copié dans le presse-papier !");
  }).catch(() => {
    alert("Texte prêt à copier :\n\n" + text);
  });
}

// ==========================================================
// 3. RENDU CANVAS 2D : FICHE CITOYENNE D'ASSIDUITÉ DÉPUTÉ
// ==========================================================
let activeDeputyShare = null;

function generateDeputyCardCanvas(dep) {
  currentShareMode = 'deputy';
  activeDeputyShare = dep;

  const selector = document.getElementById('scrutinShareFormatSelector');
  if (selector) selector.style.setProperty('display', 'none', 'important');

  const subtitleEl = document.getElementById('shareModalSubtitle');
  if (subtitleEl) subtitleEl.textContent = "Fiche citoyenne d'assiduité parlementaire";
  document.getElementById('shareModalTitle').textContent = `Assiduité : ${dep.civ} ${dep.nom}`;

  renderDeputyShareCardToCanvas(dep);

  const nativeBtn = document.getElementById('btnNativeShare');
  if (nativeBtn) {
    try {
      const testFile = new File([''], 'test.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
        nativeBtn.style.display = 'inline-flex';
      } else {
        nativeBtn.style.display = 'none';
      }
    } catch (_) {
      nativeBtn.style.display = 'none';
    }
  }

  document.getElementById('shareModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function renderDeputyShareCardToCanvas(dep) {
  const canvas = document.getElementById('shareCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const H = 1100;
  canvas.width = W;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  // 1. Fond sombre élégant
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(0.5, '#070b16');
  bgGrad.addColorStop(1, '#030712');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Auras lumineuses aux couleurs du groupe
  const groupColor = (typeof getGroupColor === 'function') ? getGroupColor(dep.groupe) : '#3b82f6';
  
  const aura1 = ctx.createRadialGradient(W * 0.8, 160, 10, W * 0.8, 160, 420);
  aura1.addColorStop(0, groupColor + '33');
  aura1.addColorStop(1, 'transparent');
  ctx.fillStyle = aura1;
  ctx.fillRect(0, 0, W, H);

  const aura2 = ctx.createRadialGradient(W * 0.2, H * 0.65, 10, W * 0.2, H * 0.65, 380);
  aura2.addColorStop(0, '#10b98122');
  aura2.addColorStop(1, 'transparent');
  ctx.fillStyle = aura2;
  ctx.fillRect(0, 0, W, H);

  // 3. Cadre conteneur vitré
  drawRoundRect(ctx, 36, 32, W - 72, H - 64, 30);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  // 4. En-tête officiel
  ctx.fillStyle = '#60a5fa';
  ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('🏛️ OBSERVATOIRE DES VOTES • FICHE CITOYENNE D\'ASSIDUITÉ', 75, 78);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`ASSEMBLÉE NATIONALE • LÉGISLATURE(S) ${(dep.legislatures || []).join(' & ')}`, 75, 102);

  // 5. Identité de l'élu
  const nameY = 168;
  fitAndDrawText(ctx, `${dep.civ} ${dep.nom}`, 75, nameY, W - 150, 44, 30, '#f8fafc');

  // Badge du groupe
  const groupY = nameY + 18;
  ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const groupW = ctx.measureText(dep.groupe).width + 34;
  drawRoundRect(ctx, 75, groupY, groupW, 36, 9);
  ctx.fillStyle = groupColor + '28';
  ctx.fill();
  ctx.strokeStyle = groupColor + '88';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Puce de couleur
  ctx.beginPath();
  ctx.arc(92, groupY + 18, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = groupColor;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(dep.groupe, 107, groupY + 24);

  // Circonscription
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`📍 ${dep.circo || dep.departement || 'France'}`, 75 + groupW + 18, groupY + 24);

  // 6. Encadré Quadrant / Catégorie de mandat
  const quadY = 242;
  const qDesc = {
    'Pilier': { title: '🏛️ PILIER DE L\'HÉMICYCLE (TOP 30)', color: '#10b981', text: 'Assiduité exemplaire : forte présence globale et au cœur des grands votes politiques.' },
    'Stratège': { title: '🎯 STRATÈGE / SPÉCIALISTE (TOP 30)', color: '#3b82f6', text: 'Mobilisation ciblée : présent sur les textes majeurs, délégation sur les amendements ordinaires.' },
    'Marathonien': { title: '🌙 MARATHONIEN DE L\'OMBRE (TOP 30)', color: '#f59e0b', text: 'Présence en séance de nuit sur les longs marathons d\'amendements techniques.' },
    'Fantôme': { title: '👻 DÉCROCHAGE / ABSENTÉISME (FLOP 30)', color: '#ef4444', text: 'Participation globale et sur les textes majeurs très en retrait par rapport à l\'Assemblée.' },
    'Standard': { title: '👤 ACTIVITÉ RÉGULIÈRE', color: '#94a3b8', text: 'Participation intermédiaire régulière, sans décrochage marqué ni sur-mobilisation atypique.' }
  }[dep.quadrant] || { title: dep.quadrant, color: '#94a3b8', text: 'Profil calculé selon les médianes nationales de participation.' };

  drawRoundRect(ctx, 75, quadY, W - 150, 78, 14);
  ctx.fillStyle = qDesc.color + '15';
  ctx.fill();
  ctx.strokeStyle = qDesc.color + '66';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = qDesc.color;
  ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(qDesc.title, 98, quadY + 32);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(qDesc.text, 98, quadY + 58);

  // 7. Trois Grands Blocs Statistiques
  const boxW = W - 150;
  const startBoxY = 338;
  const boxH = 124;
  const boxGap = 14;

  // Box 1 : Textes Majeurs
  drawStatBox(ctx, 75, startBoxY, boxW, boxH, {
    icon: '⭐',
    title: 'PARTICIPATION SUR TEXTES MAJEURS',
    subtitle: 'Budgets, motions de censure, réformes institutionnelles et lois emblématiques',
    pct: dep.taux_majeurs,
    countText: `${dep.majeurs_votes} votés sur ${dep.majeurs_possibles} scrutins clés`,
    barColor: '#3b82f6'
  });

  // Box 2 : Présence Globale
  drawStatBox(ctx, 75, startBoxY + boxH + boxGap, boxW, boxH, {
    icon: '🌐',
    title: 'PARTICIPATION GLOBALE EN SÉANCE',
    subtitle: 'Ensemble des scrutins publics (textes et milliers d\'amendements de routine)',
    pct: dep.taux_global,
    countText: `${dep.votes} votés sur ${dep.scrutins_possibles} scrutins totaux`,
    barColor: '#10b981'
  });

  // Box 3 : Procuration / Délégation
  drawStatBox(ctx, 75, startBoxY + (boxH + boxGap) * 2, boxW, boxH, {
    icon: '📋',
    title: 'RECOURS AU VOTE PAR PROCURATION',
    subtitle: 'Proportion des votes effectués par délégation au lieu d\'un vote physique',
    pct: dep.taux_delegation,
    countText: `${dep.delegation} votes par procuration · ${dep.personne} votes physiques`,
    barColor: '#f59e0b'
  });

  // 8. Encadré Médianes de Référence
  const benchY = startBoxY + (boxH + boxGap) * 3 + 8;
  drawRoundRect(ctx, 75, benchY, boxW, 58, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('📊 Médianes de référence Assemblée nationale :', 98, benchY + 25);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Textes majeurs = 32.0%  ·  Présence globale = 22.7%', 98, benchY + 45);

  // 9. Encadré Déontologie & Travail hors Hémicycle (collé près du footer)
  const disclY = benchY + 70;
  const disclH = 76;
  drawRoundRect(ctx, 75, disclY, boxW, disclH, 12);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.07)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#60a5fa';
  ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚖️ TRAVAIL HORS HÉMICYCLE & DÉONTOLOGIE', 98, disclY + 24);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText("L'assiduité en séance publique ne reflète qu'une partie du mandat : les travaux en commissions permanentes,", 98, disclY + 44);
  ctx.fillText("délégations parlementaires, missions d'information et circonscriptions justifient des absences légitimes.", 98, disclY + 62);

  // 10. Pied de page
  const footerY = H - 42;
  ctx.fillStyle = '#475569';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Source : Open Data officiel de l\'Assemblée nationale • Données publiques certifiées', 75, footerY);
  ctx.fillText('Observatoire citoyen indépendant • Réalisé à partir des décomptes nominatifs officiels', 75, footerY + 18);
}

function drawStatBox(ctx, x, y, w, h, data) {
  drawRoundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Titre et icône
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${data.icon}  ${data.title}`, x + 24, y + 36);

  // Sous-titre
  ctx.fillStyle = '#64748b';
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(data.subtitle, x + 24, y + 58);

  // Gros chiffre %
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const pctStr = `${data.pct}%`;
  const pctW = ctx.measureText(pctStr).width;
  ctx.fillText(pctStr, x + w - pctW - 24, y + 56);

  // Décompte
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(data.countText, x + 24, y + 100);

  // Barre de progression
  const barY = y + 115;
  const barW = w - 48;
  const barH = 10;
  drawRoundRect(ctx, x + 24, barY, barW, barH, 5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();

  const fillW = Math.max(6, Math.round((Math.min(100, data.pct) / 100) * barW));
  drawRoundRect(ctx, x + 24, barY, fillW, barH, 5);
  ctx.fillStyle = data.barColor;
  ctx.fill();
}


