# KENKA

Application personnelle de suivi de transformation — deux axes qui tournent en
parallèle, sans jamais être fusionnés en un seul score :

- **Axe I — Toji** : physique. Recomposition vers 8-10 % de masse grasse, carrure
  en V, priorité épaules / dos / avant-bras / abdos / cou. Pas de volume pour le volume.
- **Axe II — Ippo** : combat. Fondamentaux muay thai suivis par checkpoints
  auto-évalués (clinch, low kicks en combinaison, garde & défense, cardio rounds).

PWA mono-utilisateur, hors ligne, sans compte et sans serveur.

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production + service worker
npm run preview  # sert le build (nécessaire pour tester le mode hors ligne)
```

## Installer sur iPhone

Déployer `dist/` sur n'importe quel hébergement statique en **HTTPS** (le service
worker ne s'enregistre pas en HTTP). Puis, dans Safari : Partager →
« Sur l'écran d'accueil ». L'app se lance ensuite en plein écran et fonctionne
sans réseau.

Les données sont liées au contexte d'ouverture : une fois l'app installée, tout
passer par l'icône plutôt que par l'onglet Safari.

## Données

Tout est stocké en local via IndexedDB (Dexie) — aucune donnée ne quitte
l'appareil. Il n'y a pas de synchronisation : **la sauvegarde est manuelle**.

Réglages → Sauvegarde propose deux exports JSON :

- **Export données** : tout sauf les photos, léger.
- **Export + photos** : inclut les images encodées en base64, à faire avant un
  changement de téléphone.

L'import remplace le contenu existant.

## Architecture

```
src/
  db/           schéma Dexie (v2 + migration), types, données pré-remplies
  lib/          logique métier — niveaux, volume, plateaux, fatigue, nutrition, sauvegarde
  components/   primitives UI, layout, graphiques
  routes/       Onboarding · Dashboard · Physique · Combat · Photos · GlowUp · Settings
e2e/            tests navigateur (smoke, migration v1→v2, logique d'analyse)
```

Points de conception à connaître avant de modifier :

- **Le niveau physique n'est jamais déduit d'une image.** Il vient uniquement des
  mesures saisies (`lib/progression.ts`) : masse grasse pondérée à 0,6, ratio
  épaules/taille à 0,4. Aucune retouche ni superposition n'est appliquée aux photos.
- **Tout ce qui dépend du %BF est lissé sur 3 mesures.** Un centimètre d'écart au
  mètre ruban déplace l'estimation Navy d'environ 1,5 point ; sans lissage, le
  niveau — et les badges — se décerneraient sur du bruit.
- **La séance se pré-remplit depuis la dernière séance du même type**
  (`lib/performance.ts`). `splitDays` ne dit que quels exercices sont *éligibles* :
  tout pré-remplir donnerait une séance de seize exercices.
- **La séance en cours est écrite sur disque en continu** (`lib/sessionDraft.ts`,
  table `sessionDraft`). Safari tue un onglet en arrière-plan sans prévenir :
  poser son téléphone entre deux séries ne doit jamais coûter une séance.
  L'écriture différée doit être annulée avant toute suppression du brouillon,
  sinon elle ressuscite une séance fantôme après coup — c'est testé.
- **Le plafond à 10 kg est une contrainte de conception, pas un détail.** Chaque
  exercice porte ses leviers de progression restants, et l'app signale les
  plafonds au lieu de suggérer d'ajouter de la charge qui n'existe pas.
- **Les streaks se comptent en semaines, pas en jours consécutifs**
  (`lib/streaks.ts`) : le split inclut volontairement des jours de repos, et la
  semaine en cours ne casse jamais un streak.
- **Aucune notification, aucun rappel.** L'app reste passive jusqu'à ouverture
  volontaire — c'est un choix, pas un oubli.
- **Aucune image n'est fournie par l'app.** Les références visuelles
  (coiffure/posture/style) et les vidéos de démo sont soit déposées par
  l'utilisateur (stockage local, jamais distribué), soit un lien de recherche
  YouTube généré à la volée — jamais une URL ou un fichier fourni en dur, pour
  ne jamais distribuer de contenu protégé par le droit d'auteur.

## Tests

```bash
npm run dev          # dans un terminal
npm run e2e          # dans un autre
```

Deux suites protègent des données irremplaçables :

- `e2e/migration.mjs` crée une base au schéma v1, lance l'app, et vérifie que
  l'historique de charges reste lisible après migration. Une régression
  silencieuse à cet endroit rendrait invisible tout le passé d'entraînement.
- `e2e/session.mjs` simule la mort de l'onglet en pleine séance et vérifie que
  la reprise restitue les séries validées — puis qu'une fin de séance rapide ne
  laisse pas de brouillon fantôme.

## Icônes

Les icônes PWA sont générées depuis `scripts/icon-source.svg` :

```bash
npm run icons
```
