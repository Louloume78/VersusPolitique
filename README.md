# 🏛️ Observatoire Citoyen des Votes Parlementaires

Application web citoyenne et interactive d'analyse et de visualisation des scrutins publics de l'Assemblée nationale (16ᵉ et 17ᵉ législatures), basée sur les données officielles en **Open Data**.

---

## 🌟 Fonctionnalités Clés

1. **Alliances d'un groupe** : Radar et barres de proximité politique avec seuils méthodologiques (seuil structurel des 70%).
2. **Matrice globale (Heatmap)** : Vue d'ensemble triangulaire instantanée, optimisée pour tous les écrans (zéro défilement horizontal).
3. **Face-à-face & Partage** : Duel analytique approfondi entre deux groupes (votes conjoints, rejets communs, divergences) avec génération de **fiches citoyennes HD téléchargeables et copiables**.
4. **Explorateur de scrutins** : Moteur de recherche instantané parmi les 12 539 scrutins avec filtres par commission, mot-clé, date et position.
5. **Démarrage instantané (< 100 ms)** : Architecture hybride exploitant `votes_majeurs.json` (499 textes majeurs, budgets, motions de censure) et pré-chargement transparent de la base complète.

---

## 📁 Structure du Projet

```text
├── index.html                           # Interface monopage (SPA)
├── style.css                            # Feuilles de style responsives & épurées
├── assets/                              # Ressources visuelles (og-preview.png, etc.)
├── js/
│   ├── constants.js                     # Couleurs officielles, mapping des commissions & état
│   ├── charts.js                        # Graphiques Chart.js (radar, barres)
│   ├── hemicycle.js                     # Visualisation interactive de l'hémicycle
│   ├── attendance.js                    # Module d'assiduité parlementaire & Députoscope
│   ├── share-card.js                    # Moteur Canvas 2D pour cartes HD citoyennes
│   ├── router.js                        # Gestion de l'historique et routage d'onglets
│   └── app.js                           # Contrôleur applicatif central & navigation
├── deputes_assiduite.json               # Métriques d'assiduité et palmarès des députés
└── votes_enriched_complete_final.json   # Base complète consolidée (12 539 scrutins)
```

---

## 🚀 Utilisation Locale

Pour tester ou faire tourner le site en local :
```bash
python -m http.server 8000
```
Puis ouvrez `http://localhost:8000` dans votre navigateur.

---

## 📊 Source des Données
Données ouvertes issues de l'Assemblée nationale :
- Scrutins publics et dossiers législatifs : [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr/)

