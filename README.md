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
├── js/
│   ├── constants.js                     # Couleurs officielles, mapping des commissions & état
│   ├── charts.js                        # Graphiques Chart.js (radar, barres)
│   ├── share-card.js                    # Moteur Canvas 2D pour cartes HD citoyennes
│   └── app.js                           # Contrôleur applicatif & navigation
├── votes_majeurs.json                   # Base allégée (chargement instantané ~428 Ko)
├── votes_enriched_complete_final.json   # Base complète consolidée (12 539 scrutins)
├── generate_majors_dataset.py           # Extraction des textes majeurs
├── process_votes_final.py               # Consolidation des données brutes AN
├── classify_votes_nlp.py                # Moteur de classification sémantique IA (mDeBERTa-v3)
└── PROJECT_STATUS.md                    # Spécifications détaillées & suivi du projet
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

