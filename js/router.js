// ==========================================================
// OBSERVATOIRE DES VOTES PARLEMENTAIRES
// Module de Deep Linking & Routage URL dynamique (Chantier 3)
// ==========================================================

const DeepLinkRouter = {
  isRoutingInProgress: false,

  // Récupère les paramètres actuels de l'URL
  getParams() {
    return new URLSearchParams(window.location.search);
  },

  // Met à jour les paramètres de l'URL sans recharger la page
  setParams(newParams, push = false) {
    if (this.isRoutingInProgress) return;
    try {
      const current = this.getParams();
      Object.keys(newParams).forEach(k => {
        const val = newParams[k];
        if (val === null || val === undefined || val === '') {
          current.delete(k);
        } else {
          current.set(k, String(val));
        }
      });

      const qs = current.toString();
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;

      if (newUrl !== `${window.location.pathname}${window.location.search}`) {
        if (push) {
          window.history.pushState({ path: newUrl }, '', newUrl);
        } else {
          window.history.replaceState({ path: newUrl }, '', newUrl);
        }
      }
    } catch (e) {
      console.warn("Impossible de synchroniser l'URL :", e);
    }
  },

  // Réinitialise l'URL pour un nouvel onglet en conservant uniquement les réglages globaux (législature, portée, échelle)
  switchTabClean(tabCode, push = true) {
    if (this.isRoutingInProgress) return;
    try {
      const current = this.getParams();
      const clean = new URLSearchParams();

      // Conserver les réglages globaux pertinents pour tous les onglets
      ['leg', 'scope', 'scale'].forEach(k => {
        if (current.has(k)) {
          clean.set(k, current.get(k));
        }
      });

      if (tabCode && tabCode !== 'home') {
        clean.set('tab', tabCode);
      }

      const qs = clean.toString();
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;

      if (push) {
        window.history.pushState({ path: newUrl }, '', newUrl);
      } else {
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }

      this.syncMetaTags({ tab: tabCode });
    } catch (e) {
      console.warn("Erreur lors du nettoyage d'onglet :", e);
    }
  },

  // Supprime un paramètre de l'URL
  removeParam(key, push = false) {
    this.setParams({ [key]: null }, push);
  },

  // Construit une URL absolue propre pour le partage
  buildShareUrl(customParams = {}) {
    const url = new URL(window.location.origin + window.location.pathname);
    const params = new URLSearchParams();

    // Conserver ou remplacer
    Object.keys(customParams).forEach(k => {
      if (customParams[k] !== null && customParams[k] !== undefined && customParams[k] !== '') {
        params.set(k, String(customParams[k]));
      }
    });

    url.search = params.toString();
    return url.toString();
  },

  // Copie un lien dans le presse-papier avec notification Toast
  async copyShareLink(customParams = {}, successMsg = "Lien direct copié dans le presse-papier !") {
    const shareUrl = this.buildShareUrl(customParams);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback input
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      this.showToast(`🔗 ${successMsg}`);
    } catch (err) {
      console.warn("Échec de la copie automatique :", err);
      prompt("Voici votre lien direct à copier :", shareUrl);
    }
  },

  // Synchronise dynamiquement le titre de la page et les métadonnées Open Graph / Twitter Cards
  syncMetaTags(context = {}) {
    try {
      const baseTitle = "Observatoire des Votes - Assemblée Nationale";
      let pageTitle = baseTitle;
      let pageDesc = "Ce que votent véritablement vos députés : explorez les scrutins officiels de l'Assemblée nationale, les coalitions réelles, proximités politiques et l'assiduité parlementaire.";

      if (context.scrutin) {
        pageTitle = `Scrutin n°${context.scrutin.id} • ${context.scrutin.titre ? context.scrutin.titre.slice(0, 70) + '...' : 'Observatoire des Votes'}`;
        pageDesc = `Consultez le résultat officiel et le détail des votes par groupe pour le scrutin n°${context.scrutin.id} à l'Assemblée nationale.`;
      } else if (context.deputy) {
        pageTitle = `${context.deputy.nom} • Fiche Député - Observatoire des Votes`;
        pageDesc = `Statistiques officielles d'assiduité et de présence en séance publique pour ${context.deputy.nom} (${context.deputy.groupe}).`;
      } else if (context.tab) {
        const tabTitles = {
          'home': "Accueil citoyen",
          'overview': "Alliances & Proximités",
          'heatmap': "Matrice globale des accords",
          'radar-time': "Face-à-face comparatif",
          'detailed': "Explorateur de scrutins",
          'attendance': "Assiduité & Députoscope"
        };
        const sub = tabTitles[context.tab];
        if (sub && context.tab !== 'home') {
          pageTitle = `${sub} • Observatoire des Votes`;
        }
      }

      document.title = pageTitle;

      // Mise à jour des balises meta dynamiques
      const setMeta = (selector, attr, val) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute(attr, val);
      };

      setMeta('meta[name="description"]', 'content', pageDesc);
      setMeta('meta[property="og:title"]', 'content', pageTitle);
      setMeta('meta[property="og:description"]', 'content', pageDesc);
      setMeta('meta[name="twitter:title"]', 'content', pageTitle);
      setMeta('meta[name="twitter:description"]', 'content', pageDesc);

      // Si l'environnement fournit une URL absolue canonique
      if (window.location && window.location.href) {
        setMeta('meta[property="og:url"]', 'content', window.location.href);
      }
    } catch (e) {
      console.warn("Impossible de synchroniser les métadonnées :", e);
    }
  },

  // Affiche un toast d'alerte ou confirmation
  showToast(message) {
    let toast = document.getElementById('deepLinkToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'deepLinkToast';
      toast.className = 'deep-link-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  },

  // Applique l'état contenu dans l'URL actuelle à l'interface
  applyInitialRouting() {
    this.isRoutingInProgress = true;
    const params = this.getParams();

    // 1. Échelle (groups vs coalitions)
    const scale = params.get('scale');
    if (scale === 'coalitions' || scale === 'groups') {
      if (typeof setScaleMode === 'function') {
        setScaleMode(scale);
      }
    }

    // 2. Législature globale
    const leg = params.get('leg');
    if (leg && (leg === 'ALL' || leg === 'LEG_17' || leg === 'LEG_16')) {
      const legSelect = document.getElementById('globalPeriodFilter');
      if (legSelect) {
        legSelect.value = leg;
        if (typeof onGlobalPeriodChange === 'function') {
          onGlobalPeriodChange();
        }
      }
    }

    // 3. Portée globale (MAJOR, PIVOT, ALL)
    const scope = params.get('scope');
    if (scope && (scope === 'MAJOR' || scope === 'PIVOT' || scope === 'ALL')) {
      if (typeof setGlobalMajorFilter === 'function') {
        setGlobalMajorFilter(scope);
      }
    }

    // 4. Onglet principal
    const tabParam = params.get('tab');
    let targetTab = 'tab-home';
    if (tabParam) {
      const tabMap = {
        'home': 'tab-home',
        'overview': 'tab-overview',
        'heatmap': 'tab-heatmap',
        'radar-time': 'tab-radar-time',
        'detailed': 'tab-detailed',
        'attendance': 'tab-attendance'
      };
      if (tabMap[tabParam]) {
        targetTab = tabMap[tabParam];
      } else if (tabParam.startsWith('tab-')) {
        targetTab = tabParam;
      }
    }

    // Si un scrutin est spécifié dans l'URL mais pas d'onglet, on bascule vers l'explorateur ou on ouvre la modale
    const scrutinId = params.get('scrutin');
    const scrutinLeg = params.get('scrutin_leg') || params.get('leg') || '';

    if (scrutinId) {
      if (!tabParam) targetTab = 'tab-detailed';
    }

    // Basculer vers l'onglet cible
    if (typeof switchTab === 'function') {
      switchTab(targetTab);
    }

    // 5. Paramètres spécifiques aux onglets
    // A. Alliances : ovRefGroup
    const refGroup = params.get('ref');
    if (refGroup) {
      const ovSelect = document.getElementById('ovRefGroup');
      if (ovSelect) {
        ovSelect.value = refGroup;
        if (typeof renderOverview === 'function') renderOverview();
      }
    }

    // B. Matrice : metric
    const metric = params.get('metric');
    if (metric && ['POUR_POUR', 'CONTRE_CONTRE', 'TOTAL_ACCORD'].includes(metric)) {
      if (typeof setHeatmapMetric === 'function') {
        setHeatmapMetric(metric);
      }
    }

    // C. Face-à-face : gA & gB
    const gA = params.get('gA');
    const gB = params.get('gB');
    if (gA || gB) {
      const selectA = document.getElementById('compGroupA');
      const selectB = document.getElementById('compGroupB');
      if (selectA && gA) selectA.value = gA;
      if (selectB && gB) selectB.value = gB;
      if (typeof renderCharts === 'function') renderCharts();
    }

    // D. Explorateur : recherche, groupe, position, issue
    const searchQ = params.get('q');
    if (searchQ) {
      const input = document.getElementById('dtSearch');
      if (input) input.value = searchQ;
    }
    const dtGroup = params.get('group');
    if (dtGroup) {
      const dtGroupEl = document.getElementById('dtTargetGroup');
      if (dtGroupEl) dtGroupEl.value = dtGroup;
    }
    const dtPos = params.get('pos');
    if (dtPos) {
      const dtPosEl = document.getElementById('dtTargetPosition');
      if (dtPosEl) dtPosEl.value = dtPos;
    }
    const dtOutcome = params.get('outcome');
    if (dtOutcome) {
      const dtOutcomeEl = document.getElementById('dtOutcome');
      if (dtOutcomeEl) dtOutcomeEl.value = dtOutcome;
    }

    if (targetTab === 'tab-detailed' && typeof renderDetailed === 'function') {
      renderDetailed();
    }

    // E. Assiduité : sous-vue, législature et député sélectionné
    const subview = params.get('subview');
    const deputeId = params.get('depute');
    const deputeSearch = params.get('q_dep');
    const quadrant = params.get('quadrant');

    if (targetTab === 'tab-attendance') {
      if (subview && typeof switchAttendanceSubView === 'function') {
        switchAttendanceSubView(subview);
      }
      if (deputeSearch) {
        const dSearch = document.getElementById('deputoscopeSearch');
        if (dSearch) dSearch.value = deputeSearch;
        if (typeof deputoscopeFilters !== 'undefined') deputoscopeFilters.search = deputeSearch;
      }
      if (quadrant) {
        const qSelect = document.getElementById('deputoscopeQuadrant');
        if (qSelect) qSelect.value = quadrant;
        if (typeof deputoscopeFilters !== 'undefined') deputoscopeFilters.quadrant = quadrant;
      }
      if (deputeId && typeof selectDeputyById === 'function') {
        selectDeputyById(deputeId);
      }
    }

    // 6. Ouverture automatique du scrutin demandé par lien direct
    if (scrutinId) {
      this.openScrutinFromUrl(scrutinId, scrutinLeg);
    } else {
      const activeTabCode = targetTab ? targetTab.replace(/^tab-/, '') : 'home';
      this.syncMetaTags({ tab: activeTabCode });
    }

    this.isRoutingInProgress = false;
  },

  // Ouvre un scrutin avec gestion asynchrone si le dataset complet doit être chargé
  openScrutinFromUrl(scrutinId, scrutinLeg) {
    const tryOpen = () => {
      let targetScrutin = null;
      if (typeof dataset !== 'undefined' && dataset.length > 0) {
        targetScrutin = dataset.find(s => String(s.id) === String(scrutinId) && (!scrutinLeg || String(s.legislature) === String(scrutinLeg)));
      }
      if (targetScrutin) {
        if (typeof openScrutinModal === 'function') {
          openScrutinModal(targetScrutin.id, targetScrutin.legislature);
        }
      } else {
        // Scrutin introuvable dans le pool actuel -> charger la base complète si pas encore fait
        if (typeof loadFullDataset === 'function' && (!fullDataset || isFullDatasetLoading)) {
          loadFullDataset(() => {
            const found = fullDataset.find(s => String(s.id) === String(scrutinId) && (!scrutinLeg || String(s.legislature) === String(scrutinLeg)));
            if (found && typeof openScrutinModal === 'function') {
              openScrutinModal(found.id, found.legislature);
            }
          });
        }
      }
    };

    setTimeout(tryOpen, 150);
  },

  // Gestion du retour en arrière / avance dans le navigateur (boutons popstate)
  onPopState() {
    this.applyInitialRouting();
  },

  // Initialisation des écouteurs
  init() {
    window.addEventListener('popstate', () => this.onPopState());
  }
};

// Initialisation globale
DeepLinkRouter.init();

