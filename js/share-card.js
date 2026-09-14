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
  fitAndDrawText(ctx, d.gA, 102, 244, 380, 30, 20, '#ffffff');

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
  fitAndDrawText(ctx, d.gB, 602, 244, 380, 30, 20, '#ffffff');

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

  // 5. Titre du scrutin (enveloppé proprement sur 3 lignes max avec troncature)
  ctx.font = '700 25px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f8fafc';
  const endTitleY = wrapTextWithLimit(ctx, s.titre, 84, 175, 912, 34, 3);

  // 6. Métadonnées (Date + Commission/Thématique)
  const metaY = Math.max(endTitleY + 34, 280);
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#94a3b8';
  const dateStr = s.date ? `📅 ${s.date}` : '📅 Date non renseignée';
  const commStr = s.commission ? `🏛️ ${s.commission}` : '🏛️ Séance publique';
  ctx.fillText(`${dateStr}   •   ${commStr}`, 84, metaY);

  // 7. Bannière centrale de Résultat Officiel (ADOPTÉ / REJETÉ)
  const bannerY = metaY + 20;
  const bannerH = 74;
  const bannerW = 912;
  drawRoundRect(ctx, 84, bannerY, bannerW, bannerH, 18);

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
    const coh = (s.cohesions && s.cohesions[g]) ? s.cohesions[g] : null;
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
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();

      ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#f87171';
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

    // Discipline interne du groupe
    if (coh !== null && pos) {
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.fillText(`Discipline ${coh}%`, cardX + cardW - 18, cardY + 70);
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
    `🟢 ${pourGroupsCount} groupe(s) Pour   •   🔴 ${contreGroupsCount} groupe(s) Contre   •   🟠 ${abstGroupsCount} Abstention`,
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

// ==========================================================
// 3. GESTION DES MODALES DE PARTAGE ET EXPORT
// ==========================================================

// Gestion de la modale de partage pour un scrutin
function openScrutinShareModal() {
  if (!activeModalScrutin) return;
  currentShareMode = 'scrutin';

  const s = activeModalScrutin;
  const subtitleEl = document.getElementById('shareModalSubtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `Scrutin public n°${s.id} (${s.legislature || '17'}e Législature)`;
  }
  document.getElementById('shareModalTitle').textContent = `Fiche : Scrutin n°${s.id}`;

  renderScrutinShareCardToCanvas(s);

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
    filename = `scrutin-${activeModalScrutin.id}-vote-assemblee.png`;
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

    text = `🗳️ Observatoire des Votes Parlementaires\n` +
           `Scrutin public n°${s.id} (${s.legislature || '17'}e Législature) — ${sortLabel}\n\n` +
           `📜 ${s.titre}\n` +
           `📅 Date : ${s.date || 'Non renseignée'} | 🏛️ Thématique : ${s.commission || 'Séance publique'}\n\n` +
           `Positions des groupes politiques :\n`;

    POLITICAL_SPECTRUM.forEach(g => {
      const pos = s.positions ? s.positions[g] : null;
      const coh = (s.cohesions && s.cohesions[g]) ? ` (Discipline : ${s.cohesions[g]}%)` : '';
      let posText = '⚪ Non participant / <3 votants';
      if (pos === 'POUR') posText = '🟢 POUR';
      else if (pos === 'CONTRE') posText = '🔴 CONTRE';
      else if (pos === 'ABSTENTION') posText = '🟠 ABSTENTION';
      text += `• ${g} : ${posText}${coh}\n`;
    });

    const leg = s.legislature || '17';
    text += `\nFiche officielle : https://www.assemblee-nationale.fr/dyn/${leg}/scrutins/${s.id}\n` +
            `Source : Open Data officiel de l'Assemblée nationale`;
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

