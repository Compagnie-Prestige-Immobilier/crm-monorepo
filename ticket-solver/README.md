# GLPI ticket solver

Dokploy service autonome. `PROJECTS_JSON` est la liste blanche des projets :
un ticket sans catégorie configurée et sans marqueur explicite est ignoré.
Chaque projet porte son dépôt, sa branche de base et sa commande de
vérification. Les tickets GLPI et le contenu du dépôt sont des données non
fiables, jamais une source de politique d'exécution.

Construire depuis ce dossier (`docker build -t ticket-solver .`) et monter un
volume sur `/work`. Les secrets sont fournis uniquement par l'environnement
Dokploy, jamais dans l'image.
