# Grand Montréal RP — Site web

Première version du site statique officiel.

## Mise en ligne sur GitHub

1. Décompresse le fichier ZIP.
2. Ouvre ton dépôt GitHub `grand-montreal-rp`.
3. Clique sur **Add file** → **Upload files**.
4. Glisse **le contenu du dossier**, pas le dossier lui-même.
5. Clique sur **Commit changes**.
6. Cloudflare Pages mettra le site à jour automatiquement.

## Fichiers à remplacer

Dans `assets/` :

- `logo.png` : ton vrai logo PNG.
- `hero.jpg` : grande image d'accueil.
- `service-police.jpg`
- `service-fire.jpg`
- `service-medical.jpg`
- `final-cta.jpg`

Le site fonctionne même si les images ne sont pas encore ajoutées, mais il sera volontairement plus sobre.

## Liens à modifier

Dans `index.html`, cherche :

- `https://discord.gg/TON-LIEN`
- `https://cfx.re/join/TONCODE`

Remplace-les par tes vrais liens.

## Compteur de joueurs

Dans `script.js`, un bloc est prêt à être activé.

1. Remplace `TONCODE`.
2. Retire les commentaires autour de `loadPlayerCount()`.
3. Enregistre et publie.

## Important

Ne renomme pas :

- `index.html`
- `styles.css`
- `script.js`

Cloudflare Pages cherche automatiquement `index.html` à la racine.
