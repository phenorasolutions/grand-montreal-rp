# Grand Montréal RP CMS — Sprint 1

Ce sprint ajoute une vraie authentification Cloudflare Pages Functions + D1.

## Inclus

- Bouton Compte avec icône dans le site public et le Marketplace.
- Création sécurisée du premier compte Fondateur.
- Connexion par identifiant et mot de passe.
- Mots de passe hachés avec PBKDF2-SHA-256.
- Sessions stockées dans D1 avec cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
- Limitation simple des tentatives de connexion.
- Journal local des connexions dans D1.
- Dashboard protégé.
- Déconnexion.
- Tables Marketplace déjà préparées pour le Sprint 2.
- `_routes.json` pour que seules les routes `/api/*` invoquent Pages Functions.

## Configuration Cloudflare obligatoire

Le binding D1 doit s'appeler exactement :

`DB`

Ajoute également un secret de production :

`CMS_SETUP_KEY`

Ne place jamais sa valeur dans GitHub.

Chemin habituel :

Workers & Pages → grand-montreal-rp → Settings → Variables and Secrets → Add

Choisis **Secret**, nomme-le `CMS_SETUP_KEY`, puis colle la valeur transmise séparément.

Après l'ajout du secret, redéploie le projet.

## Premier démarrage

1. Déploie tous les fichiers à la racine du dépôt GitHub.
2. Attends le déploiement Cloudflare.
3. Ouvre `/login.html`.
4. La Function crée automatiquement les tables manquantes.
5. Entre la clé d'installation.
6. Crée ton compte Fondateur.
7. Tu seras connecté automatiquement au dashboard.

## Important

La page `admin.html` n'est pas une barrière de sécurité à elle seule. La sécurité réelle est appliquée sur toutes les API côté serveur.

Le webhook Discord sera ajouté dans un sprint distinct, après la gestion du Marketplace.
