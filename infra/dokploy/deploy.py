#!/usr/bin/env python3
"""
CPI GO, approvisionnement et déploiement Dokploy.

Un seul fichier, en Python plutôt qu'en bash : la construction du JSON et
l'appel HTTP vivent dans le même langage, donc plus aucune imbrication de
guillemets entre shell et interpréteur, c'est exactement ce qui avait cassé la
version précédente.

USAGE
    export DOKPLOY_KEY='votre-clé'
    python3 infra/dokploy/deploy.py provision   # Postgres + les 2 applications
    python3 infra/dokploy/deploy.py configure   # dépôt, build, variables, domaines
    python3 infra/dokploy/deploy.py deploy      # démarrage
    python3 infra/dokploy/deploy.py redeploy    # applications seules, voie automatisée
    python3 infra/dokploy/deploy.py backup      # sauvegarde nocturne hors du VPS
    python3 infra/dokploy/deploy.py status      # état courant
    python3 infra/dokploy/deploy.py all         # les trois premières d'affilée

`backup` reste HORS de `all` : il réclame les coordonnées d'un stockage S3 que
l'opérateur seul détient, et un `all` qui échoue faute de bucket ferait échouer
un déploiement par ailleurs correct. Il n'est pas facultatif pour autant, et
`status` affiche en rouge tant qu'il n'a pas été lancé.

Chaque étape est IDEMPOTENTE : elle cherche l'existant avant de créer.

Toute erreur est signalée et INTERROMPT l'étape. La version précédente affichait
« ✓ » quoi qu'il arrive ; un script qui ment sur son résultat est pire qu'un
script qui plante.

POURQUOI PAS docker-compose.prod.yml
    Il lance Caddy sur les ports 80 et 443, qui appartiennent déjà à Traefik sur
    un hôte Dokploy. La forme native, un service Postgres, deux applications
    construites depuis leurs Dockerfile, rend à Traefik le domaine et le TLS.
"""

from __future__ import annotations

import json
import os
import secrets
import string
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Réglages
# ─────────────────────────────────────────────────────────────────────────────

def setting(name: str, default: str) -> str:
    """Réglage lu dans l'environnement, avec repli sur la valeur du dépôt.

    `os.environ.get(nom, defaut)` NE SUFFIT PAS, et la nuance a des dents : il
    rend le défaut quand la variable est ABSENTE, mais la chaîne VIDE quand elle
    est présente et vide. Or c'est exactement ce que produit GitHub Actions pour
    `${{ vars.X }}` lorsque la variable de dépôt n'a jamais été créée — la ligne
    `env:` existe, sa valeur est vide. `DOKPLOY_URL` serait alors la chaîne
    vide, chaque appel partirait sur une URL relative, et le message d'erreur
    parlerait de requête invalide sans jamais nommer le réglage manquant.

    `or` traite l'absence et le vide de la même façon, qui est la seule lecture
    utile ici : personne ne veut régler l'une de ces valeurs à « rien ».

    Le `.strip()` étend la même clémence à une valeur qui n'est QUE des espaces,
    ce que produit couramment un copier-coller depuis une interface web. Aucun
    des réglages passés par cette fonction — une URL, des identifiants, un nom
    de branche, des domaines, une expression cron — n'admet d'espace de tête ou
    de queue : les retirer ne peut rien casser de légitime.
    """
    return os.environ.get(name, "").strip() or default


DOKPLOY_URL = setting("DOKPLOY_URL", "https://dokploy.cpi-chues.com")
ENVIRONMENT_ID = setting("ENVIRONMENT_ID", "prUxKulJkxda_0vY9chIi")
PROJECT_ID = setting("PROJECT_ID", "cUvJ9T8TmuSc6HIKg8ydW")
GIT_URL = setting("GIT_URL", "git@github.com:Compagnie-Prestige-Immobilier/crm-monorepo.git")
BRANCH = setting("BRANCH", "prod")
API_DOMAIN = setting("API_DOMAIN", "go.cpi-chues.com")
WEB_DOMAIN = setting("WEB_DOMAIN", "go-admin.cpi-chues.com")

PG_NAME = "cpi-go-postgres"
API_NAME = "cpi-go-api"
WEB_NAME = "cpi-go-web"
SSH_KEY_NAME = "cpi-go-deploy"
APK_RELEASE_MOUNT = "/repo/storage/releases"
APK_RELEASE_VOLUME = "cpi-go-apk-releases"
# Exports intégraux de la base, demandés depuis Paramètres. Même motif que les
# APK, et il n'est pas facultatif : l'état du travail vit en base et nomme un
# fichier. Sans volume, un redéploiement emporte le fichier et laisse l'écran
# proposer le téléchargement d'un export qui n'existe plus.
#
# Le contenu, lui, ne dure PAS : il est détruit dès son téléchargement, et de
# toute façon à son échéance. Ce volume est fait pour survivre à une image, pas
# pour accumuler des copies de la clientèle.
DB_DUMP_MOUNT = "/repo/storage/db-dumps"
DB_DUMP_VOLUME = "cpi-go-db-dumps"

# ─────────────────────────────────────────────────────────────────────────────
# Sauvegarde nocturne de la base
#
# CE QUI NE MARCHAIT PAS
#     infra/docker/backup.sh fait exactement le bon travail, mais il n'est câblé
#     que dans docker-compose.prod.yml, et ce compose ne peut PAS tourner ici :
#     son Caddy réclame les ports 80 et 443, déjà tenus par le Traefik de
#     Dokploy. Le seul fichier qui définissait une sauvegarde était donc le seul
#     qui ne s'exécutait jamais sur l'hôte de production. Il reste valable pour
#     un VPS nu, sans Dokploy, et pour rien d'autre.
#
# CE QUI A ÉTÉ ÉCARTÉ, ET POURQUOI
#     Une troisième application lançant backup.sh, avec un volume monté sur le
#     modèle des APK. Le volume vivrait dans /var/lib/docker/volumes, sur le
#     MÊME disque et le MÊME hôte que celui de Postgres. C'est un volume
#     distinct, donc il survit à un `docker volume rm pgdata` malheureux, mais
#     pas à la perte du VPS, qui est précisément le sinistre à couvrir. Il
#     faudrait en outre réécrire à la main l'alerte, la rotation et la
#     restauration.
#
#     Une programmation côté Postgres (pg_cron, ou un cron glissé dans l'image).
#     Même défaut, en pire : le dump se retrouve dans le conteneur qui porte les
#     données qu'il protège, et l'image gérée par Dokploy serait à maintenir.
#
# CE QUI EST RETENU
#     Le routeur `backup` de Dokploy, natif et déjà présent sur l'hôte. Il lance
#     pg_dump dans le conteneur de la base et pousse la sortie gzippée par
#     `rclone rcat` vers un stockage S3, donc HORS DU VPS : plus fort que « hors
#     du volume de données », et c'est la seule forme qui survive à la perte de
#     la machine. La rétention est bornée par keepLatestCount. L'échec COMME la
#     réussite déclenchent une notification, ce qui donne au passage une veille
#     par absence de signal, voir require_alerting().
#
#     Le prix à payer est réel et assumé : sans coordonnées S3, `backup` refuse
#     de s'exécuter. Un stockage objet est une dépendance externe, pas un
#     détail de configuration.
# ─────────────────────────────────────────────────────────────────────────────

BACKUP_DESTINATION_NAME = "cpi-go-sauvegardes"
# Préfixe de chemin DANS le bucket. Le bucket peut être partagé avec un autre
# projet CPI ; sans préfixe, deux séries de dumps se mélangeraient et la
# rotation de l'une compterait les fichiers de l'autre.
BACKUP_PREFIX = "cpi-go/postgres/"
# Cron évalué par Dokploy, à l'heure du serveur. Africa/Dakar est sur UTC toute
# l'année, sans heure d'été : 2 h ici est 2 h à Dakar, il n'y a pas de décalage
# à corriger, contrairement à ce qu'exigerait un fuseau européen.
BACKUP_SCHEDULE = setting("BACKUP_SCHEDULE", "0 2 * * *")
# Rétention EN NOMBRE DE FICHIERS, pas en jours. Une sauvegarde par nuit, donc
# environ un mois d'historique. Une borne en nombre est ce qu'il faut ici : si
# le cron se met à tourner plus souvent, une borne en jours laisserait le bucket
# grossir sans limite, une borne en fichiers non.
BACKUP_KEEP_DEFAULT = 30

HERE = Path(__file__).resolve().parent
SECRETS_FILE = HERE / ".secrets.generated"
IDS_FILE = HERE / ".ids.generated"

BOLD, GREEN, RED, YELLOW, DIM, RESET = (
    "\033[1m",
    "\033[32m",
    "\033[31m",
    "\033[33m",
    "\033[2m",
    "\033[0m",
)


def step(msg: str) -> None:
    print(f"\n{BOLD}▸ {msg}{RESET}")


def ok(msg: str) -> None:
    print(f"  {GREEN}✓{RESET} {msg}")


def warn(msg: str) -> None:
    print(f"  {YELLOW}!{RESET} {msg}")


def fail(msg: str) -> None:
    print(f"  {RED}✗{RESET} {msg}")


def info(msg: str) -> None:
    print(f"  {DIM}{msg}{RESET}")


class DokployError(RuntimeError):
    """Erreur renvoyée par l'API, déjà mise en forme pour l'affichage."""


# ─────────────────────────────────────────────────────────────────────────────
# Client tRPC
# ─────────────────────────────────────────────────────────────────────────────


def _key() -> str:
    key = os.environ.get("DOKPLOY_KEY", "").strip()
    if not key:
        print(f"{RED}✗ DOKPLOY_KEY n'est pas défini.{RESET}", file=sys.stderr)
        print("  export DOKPLOY_KEY='votre-clé'   puis relancez.", file=sys.stderr)
        sys.exit(1)
    return key


def _explain(payload: dict) -> str:
    """Rend lisible l'erreur tRPC, y compris les listes d'issues zod."""
    err = payload.get("error", {}).get("json", {})
    message = err.get("message", "")
    if message.startswith("["):
        try:
            issues = json.loads(message)
            return " · ".join(
                f"{'.'.join(str(p) for p in i.get('path', []))}: {i.get('message', '')}"
                for i in issues
            )
        except json.JSONDecodeError:
            pass
    return message or json.dumps(err)[:300]


def call(procedure: str, payload: dict | None = None, *, method: str = "POST"):
    """Appelle une procédure tRPC. Lève DokployError si le serveur refuse."""
    url = f"{DOKPLOY_URL}/api/trpc/{procedure}"
    data = None
    if method == "POST":
        data = json.dumps({"json": payload or {}}).encode()
    elif payload:
        # `safe=""` force l'encodage de { } " : sans cela Cloudflare voit des
        # accolades brutes dans la chaîne de requête, y lit une tentative
        # d'injection et répond 403 avant que Dokploy ne soit atteint.
        url += "?input=" + urllib.parse.quote(
            json.dumps({"json": payload}, separators=(",", ":")), safe=""
        )

    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "x-api-key": _key(),
            "Content-Type": "application/json",
            # Cloudflare bloque l'agent utilisateur par défaut d'urllib
            # (« error code: 1010 ») avant même que Dokploy ne soit atteint.
            # Un agent ordinaire suffit à passer.
            "User-Agent": "cpi-go-deploy/1.0",
            "Accept": "application/json",
        },
    )
    try:
        # DOKPLOY_URL is an operator-controlled deployment endpoint, not user
        # input; urllib is used here to keep the provisioning tool dependency-free.
        with urllib.request.urlopen(request, timeout=180) as response:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
            body = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read().decode())
        except Exception:
            raise DokployError(f"HTTP {exc.code}") from exc
        raise DokployError(_explain(body)) from exc
    except urllib.error.URLError as exc:
        raise DokployError(f"injoignable : {exc.reason}") from exc

    if "error" in body:
        raise DokployError(_explain(body))
    return body.get("result", {}).get("data", {}).get("json")


# ─────────────────────────────────────────────────────────────────────────────
# Secrets et identifiants, engendrés une fois, relus ensuite
# ─────────────────────────────────────────────────────────────────────────────


def _read_kv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    out: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip().strip("'\"")
    return out


def _write_kv(path: Path, values: dict[str, str], header: str) -> None:
    lines = [f"# {header}", "# NE PAS COMMITER."]
    lines += [f"{k}='{v}'" for k, v in values.items()]
    # Le fichier est CRÉÉ en 0600, il n'est pas restreint après coup. La
    # séquence précédente, `write_text` puis `chmod`, laissait le mot de
    # passe Postgres, les deux secrets JWT et le mot de passe administrateur
    # lisibles par tout le monde selon l'umask, le temps de deux appels
    # système. Court, mais sur une machine partagée c'est tout ce qu'il faut.
    # `O_TRUNC` conserve le comportement d'écrasement de `write_text`.
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    with os.fdopen(os.open(path, flags, 0o600), "w") as handle:
        handle.write("\n".join(lines) + "\n")
    path.chmod(0o600)


def _token(length: int) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def load_secrets() -> dict[str, str]:
    """Les secrets ne sont engendrés qu'une fois.

    Une relance les relit : les regénérer rendrait invérifiables les mots de
    passe déjà en base et invaliderait toutes les sessions émises.
    """
    existing = _read_kv(SECRETS_FILE)
    if existing.get("PG_PASSWORD"):
        info(f"secrets relus depuis {SECRETS_FILE.name}")
        return existing

    values = {
        "PG_PASSWORD": _token(32),
        "JWT_ACCESS": _token(48),
        "JWT_REFRESH": _token(48),
        "ADMIN_PASSWORD": _token(18),
    }
    _write_kv(SECRETS_FILE, values, f"Engendré le {time.strftime('%Y-%m-%dT%H:%M:%SZ')}")
    ok(f"secrets engendrés dans {SECRETS_FILE.name} (chmod 600)")
    return values


def load_ids() -> dict[str, str]:
    return _read_kv(IDS_FILE)


def save_ids(ids: dict[str, str]) -> None:
    _write_kv(IDS_FILE, ids, "Identifiants Dokploy")


# ─────────────────────────────────────────────────────────────────────────────
# Découverte de l'existant, c'est ce qui rend les étapes idempotentes
# ─────────────────────────────────────────────────────────────────────────────


def project_contents() -> dict:
    return call("project.one", {"projectId": PROJECT_ID}, method="GET") or {}


def organization_id() -> str:
    return project_contents().get("organizationId", "")


def ensure_ssh_key(ids: dict[str, str]) -> str:
    """Clé de déploiement en lecture seule, engendrée par Dokploy.

    Le dépôt est privé : sans clé, `git clone` échoue et le build s'arrête à la
    première étape. Dokploy engendre la paire ; la partie publique doit être
    déposée dans GitHub (Settings → Deploy keys), ce que fait `gh` si vous
    l'avez sous la main :

        gh repo deploy-key add cle.pub --title 'Dokploy CPI GO' -R <org>/<repo>

    Les clés de déploiement doivent en outre être autorisées au niveau de
    l'ORGANISATION, sinon GitHub répond « Deploy keys are disabled for this
    repository » :

        gh api -X PATCH orgs/<org> -f deploy_keys_enabled_for_repositories=true
    """
    if ids.get("SSH_KEY_ID"):
        return ids["SSH_KEY_ID"]

    existing = call("sshKey.all", method="GET") or []
    for row in existing:
        if row.get("name") == SSH_KEY_NAME:
            ok(f"clé SSH « {SSH_KEY_NAME} » déjà enregistrée")
            return row.get("sshKeyId", "")

    pair = call("sshKey.generate", {"type": "ed25519"}) or {}
    created = call(
        "sshKey.create",
        {
            "name": SSH_KEY_NAME,
            "description": "Clé de déploiement lecture seule du dépôt CPI GO",
            "publicKey": pair.get("publicKey", ""),
            "privateKey": pair.get("privateKey", ""),
            "organizationId": organization_id(),
        },
    )
    key_id = ""
    if isinstance(created, dict):
        key_id = created.get("sshKeyId", "")
    if not key_id:
        for row in call("sshKey.all", method="GET") or []:
            if row.get("name") == SSH_KEY_NAME:
                key_id = row.get("sshKeyId", "")

    pub_path = HERE / "deploy-key.pub"
    pub_path.write_text(pair.get("publicKey", "") + "\n")
    ok(f"clé SSH engendrée, publique dans {pub_path.name}")
    warn("déposez cette clé publique dans GitHub → Settings → Deploy keys")
    return key_id


def find_existing() -> dict[str, str]:
    """Retrouve les services déjà créés, par leur nom."""
    found: dict[str, str] = {}
    # PAS de `warn` suivi d'un dictionnaire vide ici, et c'est la correction la
    # plus importante de ce fichier. Un dictionnaire vide se lit exactement
    # comme « rien n'existe encore » : sur un simple 5xx ou un délai dépassé,
    # `cmd_provision` enchaînait sur `postgres.create` et deux
    # `application.create`, imprimait « ✓ créée » trois fois, et laissait sur
    # l'hôte une SECONDE base de données de production à côté de la vraie. Le
    # fichier promet en tête que chaque étape est idempotente ; l'idempotence
    # repose entièrement sur cette lecture, donc son échec doit interrompre.
    project = project_contents()

    for environment in project.get("environments", []) or []:
        for app in environment.get("applications", []) or []:
            if app.get("name") == API_NAME:
                found["API_ID"] = app.get("applicationId", "")
            elif app.get("name") == WEB_NAME:
                found["WEB_ID"] = app.get("applicationId", "")
        for db in environment.get("postgres", []) or []:
            if db.get("name") == PG_NAME:
                found["POSTGRES_ID"] = db.get("postgresId", "")
    return found


# ─────────────────────────────────────────────────────────────────────────────
# Étape 1, approvisionnement
# ─────────────────────────────────────────────────────────────────────────────


def cmd_provision() -> None:
    secrets_ = load_secrets()
    ids = load_ids()
    ids.update({k: v for k, v in find_existing().items() if v})

    step("Base de données Postgres")
    if ids.get("POSTGRES_ID"):
        ok(f"existe déjà, {ids['POSTGRES_ID']}")
    else:
        result = call(
            "postgres.create",
            {
                "environmentId": ENVIRONMENT_ID,
                "name": PG_NAME,
                "appName": PG_NAME,
                "databaseName": "crm",
                "databaseUser": "crm",
                "databasePassword": secrets_["PG_PASSWORD"],
                "dockerImage": "postgres:18.4",
                "description": "Base consolidée CPI GO",
            },
        )
        ids["POSTGRES_ID"] = (result or {}).get("postgresId", "")
        ok(f"créée, {ids['POSTGRES_ID']}")

    for key, name, description in (
        ("API_ID", API_NAME, "API NestJS, source du contrat OpenAPI"),
        ("WEB_ID", WEB_NAME, "Panel admin Next.js"),
    ):
        step(f"Application {name}")
        if ids.get(key):
            ok(f"existe déjà, {ids[key]}")
            continue
        result = call(
            "application.create",
            {
                "environmentId": ENVIRONMENT_ID,
                "name": name,
                "appName": name,
                "description": description,
            },
        )
        ids[key] = (result or {}).get("applicationId", "")
        ok(f"créée, {ids[key]}")

    save_ids(ids)
    print(f"\n{DIM}Identifiants écrits dans {IDS_FILE.name}{RESET}")


# ─────────────────────────────────────────────────────────────────────────────
# Étape 2, configuration
# ─────────────────────────────────────────────────────────────────────────────


def _brevo_env() -> list[str]:
    """Courrier transactionnel Brevo, repris de l'environnement de l'opérateur.

    La clé n'est jamais écrite dans le dépôt, exactement comme DOKPLOY_KEY :
    elle ne vit que dans la variable d'environnement, le temps de la session.

    Absente, les trois lignes disparaissent au lieu de partir vides. L'API
    traite Brevo comme un transport facultatif : sans clé elle démarre et
    marque les envois NOT_CONFIGURED. Écrire BREVO_API_KEY= ne changerait rien
    au comportement, mais laisserait croire, en lisant le panneau Dokploy, que
    la variable a été posée puis perdue.
    """
    key = os.environ.get("BREVO_API_KEY", "").strip()
    if not key:
        return []
    sender = setting("BREVO_SENDER_EMAIL", "no-reply@cpi.sn")
    name = setting("BREVO_SENDER_NAME", "CRM CPI")
    return [
        f"BREVO_API_KEY={key}",
        f"BREVO_SENDER_EMAIL={sender}",
        f"BREVO_SENDER_NAME={name}",
    ]


def _api_env(s: dict[str, str], names: dict[str, str]) -> str:
    return "\n".join(
        [
            "NODE_ENV=production",
            "PORT=3001",
            "LOG_LEVEL=info",
            f"DATABASE_URL=postgresql://crm:{s['PG_PASSWORD']}@{names['postgres']}:5432/crm?schema=public",
            f"JWT_ACCESS_SECRET={s['JWT_ACCESS']}",
            f"JWT_REFRESH_SECRET={s['JWT_REFRESH']}",
            "JWT_ACCESS_TTL=15m",
            "JWT_REFRESH_TTL_DAYS=30",
            "AUTH_LOGIN_RATE_LIMIT=10",
            f"PUBLIC_WEB_URL=https://{WEB_DOMAIN}",
            f"API_CORS_ORIGINS=https://{WEB_DOMAIN}",
            # Traefik est en amont et réécrit X-Forwarded-For : l'en-tête est
            # fiable ici, et il le faut, sinon toutes les requêtes semblent
            # venir de Traefik et la limitation de débit devient globale.
            "API_TRUST_PROXY_HEADERS=true",
            # Swagger fermé : le contrat est publié par la CI, pas par le serveur.
            "API_DOCS_ENABLED=false",
            f"APK_RELEASE_DIR={APK_RELEASE_MOUNT}",
            f"DB_DUMP_DIR={DB_DUMP_MOUNT}",
            "BUSINESS_TIME_ZONE=Africa/Dakar",
            "PHONE_DEFAULT_REGION=SN",
            "SYNC_MAX_BATCH_SIZE=200",
            "IDEMPOTENCY_TTL_DAYS=7",
            "SEED_ADMIN_EMAIL=admin@cpi.sn",
            "SEED_ADMIN_USERNAME=admin",
            f"SEED_ADMIN_PASSWORD={s['ADMIN_PASSWORD']}",
            "SEED_ADMIN_FULL_NAME=Administrateur CPI",
            *_brevo_env(),
        ]
    )


def ensure_volume_mount(
    application_id: str, volume_name: str, mount_path: str, label: str
) -> None:
    """Ensure a directory is stored outside the replaceable application image.

    Idempotente : un montage déjà conforme est laissé tel quel, et un montage
    présent mais DIFFÉRENT lève au lieu d'être écrasé. Écraser en silence
    déplacerait le répertoire sous les pieds de l'application, qui continuerait
    d'annoncer des fichiers désormais introuvables.
    """
    mounts = call(
        "mounts.listByServiceId",
        {"serviceType": "application", "serviceId": application_id},
        method="GET",
    ) or []
    for mount in mounts:
        if mount.get("mountPath") != mount_path:
            continue
        if mount.get("type") != "volume" or mount.get("volumeName") != volume_name:
            raise DokployError(
                f"un montage existe déjà sur {mount_path} avec une autre configuration"
            )
        ok(f"volume {label} « {volume_name} » déjà monté")
        return

    call(
        "mounts.create",
        {
            "type": "volume",
            "volumeName": volume_name,
            "mountPath": mount_path,
            "serviceType": "application",
            "serviceId": application_id,
        },
    )
    ok(f"volume {label} « {volume_name} » monté sur {mount_path}")


def ensure_apk_mount(application_id: str) -> None:
    """Ensure releases are stored outside the replaceable application image."""
    ensure_volume_mount(application_id, APK_RELEASE_VOLUME, APK_RELEASE_MOUNT, "APK")


def ensure_db_dump_mount(application_id: str) -> None:
    """Ensure database exports are stored outside the replaceable image."""
    ensure_volume_mount(application_id, DB_DUMP_VOLUME, DB_DUMP_MOUNT, "exports base")


def _web_env(names: dict[str, str]) -> str:
    return "\n".join(
        [
            "NODE_ENV=production",
            "PORT=3000",
            # De serveur à serveur, dans le réseau Docker : ni TLS ni passage
            # par l'internet public.
            f"API_URL=http://{names['api']}:3001",
            f"API_INTERNAL_URL=http://{names['api']}:3001",
            f"NEXT_PUBLIC_API_URL=https://{API_DOMAIN}",
        ]
    )


def service_app_names(ids: dict[str, str]) -> dict[str, str]:
    """Noms de service RÉELS, tels que Docker les résout.

    Dokploy suffixe chaque `appName` d'un identifiant court, `cpi-go-postgres`
    devient `cpi-go-postgres-cmsq36`. C'est ce nom suffixé, et lui seul, qui
    résout dans le réseau Docker. Écrire le nom court dans DATABASE_URL fait
    échouer la résolution DNS : `migrate deploy` ne trouve pas la base, le point
    d'entrée refuse de démarrer, et le conteneur redémarre en boucle avec un
    build pourtant vert.

    Le repli sur le nom court est donc DÉLIBÉRÉMENT absent. Il existait, sous
    la forme d'un `except DokployError` qui posait un avertissement et rendait
    les noms courts : `cmd_configure` écrivait alors la `DATABASE_URL` que le
    paragraphe ci-dessus décrit comme cassée, puis affichait « ✓ API, N
    variables ». Le script signalait une réussite en ayant configuré à coup sûr
    une panne. Une résolution impossible doit interrompre.
    """
    names = {"postgres": PG_NAME, "api": API_NAME, "web": WEB_NAME}
    if ids.get("POSTGRES_ID"):
        db = call("postgres.one", {"postgresId": ids["POSTGRES_ID"]}, method="GET") or {}
        appname = db.get("appName")
        if not appname:
            raise DokployError(
                "nom de service Docker de Postgres illisible : DATABASE_URL serait fausse."
            )
        names["postgres"] = appname
    for key, slot in (("API_ID", "api"), ("WEB_ID", "web")):
        if ids.get(key):
            app = call("application.one", {"applicationId": ids[key]}, method="GET") or {}
            names[slot] = app.get("appName") or names[slot]
    return names


def cmd_configure() -> None:
    secrets_ = load_secrets()
    ids = load_ids()
    ids.update({k: v for k, v in find_existing().items() if v})
    if not ids.get("API_ID") or not ids.get("WEB_ID"):
        fail("applications introuvables, lancez d'abord `provision`.")
        sys.exit(1)
    save_ids(ids)

    step("Clé de déploiement SSH")
    ids["SSH_KEY_ID"] = ensure_ssh_key(ids)
    save_ids(ids)
    ok(f"clé {ids['SSH_KEY_ID']}")

    step(f"Source Git, {GIT_URL} @ {BRANCH}")
    for key in ("API_ID", "WEB_ID"):
        call(
            "application.saveGitProvider",
            {
                "applicationId": ids[key],
                "customGitUrl": GIT_URL,
                "customGitBranch": BRANCH,
                "customGitBuildPath": "/",
                "customGitSSHKeyId": ids["SSH_KEY_ID"],
                "watchPaths": [],
            },
        )
    ok("les deux applications pointent sur le dépôt")

    # Le Dockerfile vit dans infra/docker/ mais son CONTEXTE est la racine du
    # dépôt : le build a besoin du pnpm-workspace, du lockfile et des paquets
    # partagés. D'où dockerContextPath = '/'.
    step("Type de build")
    call(
        "application.saveBuildType",
        {
            "applicationId": ids["API_ID"],
            "buildType": "dockerfile",
            "dockerfile": "infra/docker/Dockerfile.api",
            "dockerContextPath": "/",
            "dockerBuildStage": "runner",
            "herokuVersion": "",
            "railpackVersion": "",
        },
    )
    ok("API, infra/docker/Dockerfile.api (étape runner)")

    step("Stockage persistant des releases Android")
    ensure_apk_mount(ids["API_ID"])

    step("Stockage persistant des exports de la base")
    ensure_db_dump_mount(ids["API_ID"])

    call(
        "application.saveBuildType",
        {
            "applicationId": ids["WEB_ID"],
            "buildType": "dockerfile",
            "dockerfile": "infra/docker/Dockerfile.web",
            "dockerContextPath": "/",
            "dockerBuildStage": "",
            "herokuVersion": "",
            "railpackVersion": "",
        },
    )
    ok("Web, infra/docker/Dockerfile.web")

    step("Variables d'environnement")
    names = service_app_names(ids)
    info(f"service base : {names['postgres']}")
    api_env = _api_env(secrets_, names)
    call(
        "application.saveEnvironment",
        {
            "applicationId": ids["API_ID"],
            "env": api_env,
            "buildArgs": "",
            "buildSecrets": "",
            "createEnvFile": True,
        },
    )
    ok(f"API, {len(api_env.splitlines())} variables")

    web_env = _web_env(names)
    call(
        "application.saveEnvironment",
        {
            "applicationId": ids["WEB_ID"],
            "env": web_env,
            "buildArgs": "",
            "buildSecrets": "",
            "createEnvFile": True,
        },
    )
    ok(f"Web, {len(web_env.splitlines())} variables")

    # `https: true` SANS certificateType 'letsencrypt' : le certificat est celui
    # d'origine Cloudflare, posé sur le serveur. Demander Let's Encrypt ici
    # échouerait, Cloudflare proxifie, donc le challenge HTTP n'atteint jamais
    # Traefik.
    step("Domaines")
    for app_key, host, port in (
        ("API_ID", API_DOMAIN, 3001),
        ("WEB_ID", WEB_DOMAIN, 3000),
    ):
        try:
            call(
                "domain.create",
                {
                    "applicationId": ids[app_key],
                    "host": host,
                    "path": "/",
                    "port": port,
                    "https": True,
                    "domainType": "application",
                    "certificateType": "none",
                },
            )
            ok(f"{host} → :{port}")
        except DokployError as exc:
            if "already" in str(exc).lower() or "unique" in str(exc).lower():
                ok(f"{host}, déjà configuré")
            else:
                raise


# ─────────────────────────────────────────────────────────────────────────────
# Étape 3, déploiement
# ─────────────────────────────────────────────────────────────────────────────


def cmd_deploy() -> None:
    secrets_ = load_secrets()
    ids = load_ids()
    ids.update({k: v for k, v in find_existing().items() if v})
    if not ids.get("POSTGRES_ID"):
        fail("Postgres introuvable, lancez d'abord `provision`.")
        sys.exit(1)

    step("Démarrage de Postgres")
    call("postgres.deploy", {"postgresId": ids["POSTGRES_ID"]})
    ok("demandé")
    # Le déploiement est asynchrone : on laisse la base se lever avant
    # d'enchaîner, sinon la première migration tombe sur un port fermé.
    info("attente de 45 s avant de déployer l'API…")
    time.sleep(45)

    # Le compteur d'absents existe pour une raison précise : la boucle
    # imprimait un « ✗ … introuvable » rouge, passait au suivant, puis
    # `_epilogue` annonçait « Déploiements lancés » et le script sortait en 0.
    # Un enveloppeur ou un pipeline qui regarde `$?`, la seule chose qu'une
    # automatisation regarde, voyait une réussite alors que la moitié de la
    # pile n'avait pas été déployée.
    manquants = []
    for key, label, dockerfile in (
        ("API_ID", "API", "Dockerfile.api"),
        ("WEB_ID", "panel web", "Dockerfile.web"),
    ):
        step(f"Déploiement, {label}")
        if not ids.get(key):
            fail(f"{label} introuvable")
            manquants.append(label)
            continue
        call("application.deploy", {"applicationId": ids[key]})
        ok(f"demandé, construction depuis infra/docker/{dockerfile}")

    if manquants:
        fail(f"non déployé : {', '.join(manquants)}. Lancez d'abord `provision`.")
        sys.exit(1)

    print(_epilogue(secrets_))


def cmd_redeploy() -> None:
    """Redéploie les DEUX APPLICATIONS, et rien d'autre. Voie automatisée.

    ═══════════════════════════════════════════════════════════════════════════
    POURQUOI CETTE COMMANDE EXISTE, PLUTÔT QUE D'APPELER `deploy`
    ═══════════════════════════════════════════════════════════════════════════

    `deploy` est écrit pour une PREMIÈRE mise en route conduite par un humain.
    Trois de ses gestes sont inacceptables sur une fusion vers `prod` :

      1. Il appelle `load_secrets()`, qui ENGENDRE des secrets quand le fichier
         `.secrets.generated` est absent. Un exécutant d'intégration continue
         part d'une copie neuve à chaque fois : le fichier n'y est JAMAIS là.
         Chaque déploiement fabriquerait donc un mot de passe Postgres et deux
         secrets JWT tout neufs, que `_epilogue` imprime ensuite dans le journal
         public de l'exécution. Ces valeurs ne sont pas celles de la production
         — elles ne sont poussées nulle part —, mais un journal qui affiche des
         chaînes présentées comme les secrets de production est une fuite de
         plus à instruire, pour rien.

      2. Il redéploie POSTGRES. Sur une première mise en route c'est le geste
         attendu ; sur chaque fusion, cela redémarre la base de production alors
         qu'aucune de ses données ni de sa configuration n'a bougé, et coupe le
         service le temps du redémarrage.

      3. Il dort 45 secondes pour laisser la base se lever. Sans redéploiement
         de Postgres, cette attente n'a plus d'objet.

    Ce que fait celle-ci : elle relit les identifiants auprès de Dokploy, refuse
    net si l'une des applications manque, et demande le déploiement des deux.
    Les migrations, elles, restent jouées par `api-entrypoint.sh` au démarrage
    de l'API, exactement comme aujourd'hui.
    """
    ids = load_ids()
    ids.update({k: v for k, v in find_existing().items() if v})

    # Même raisonnement que dans `find_existing` : un identifiant manquant se
    # lit comme « rien à déployer », et un déploiement qui ne déploie rien doit
    # s'arrêter en rouge, jamais s'annoncer réussi.
    manquants = [label for key, label in (("API_ID", "API"), ("WEB_ID", "panel web")) if not ids.get(key)]
    if manquants:
        fail(f"introuvable sur Dokploy : {', '.join(manquants)}. Lancez d'abord `provision`.")
        sys.exit(1)

    for key, label in (("API_ID", "API"), ("WEB_ID", "panel web")):
        step(f"Déploiement, {label}")
        call("application.deploy", {"applicationId": ids[key]})
        ok("demandé")

    info("Dokploy construit et bascule de façon asynchrone ; suivez ses journaux.")


def _epilogue(s: dict[str, str]) -> str:
    return f"""
{'─' * 76}
Déploiements lancés. Suivez les journaux dans l'interface Dokploy : la première
construction prend plusieurs minutes (installation pnpm, puis build Next).

VÉRIFICATION, une fois les trois services verts

  curl -s -o /dev/null -w '%{{http_code}}\\n' https://{API_DOMAIN}/api/v1/referentiels/banques

  401 est le résultat ATTENDU : le service répond et le garde d'authentification
  fait son travail. Un 200 signifierait que les routes sont ouvertes, à
  corriger d'urgence. Un 502 ou 526 signale que le certificat d'origine n'est
  pas en place.

AMORÇAGE, une seule fois, depuis un terminal du conteneur API

  pnpm --filter @crm/database db:seed     # référentiels + compte administrateur
  pnpm --filter @crm/database db:seed:demo # espace démo, via la factory

  Sans le seed, aucune saisie n'est possible : banques, syndicats et
  départements sont des clés étrangères obligatoires.

  L'espace démo peut ensuite être réinitialisé depuis le panel web.

IDENTIFIANTS
  {API_DOMAIN}        API
  {WEB_DOMAIN}  panel admin
  admin@cpi.sn / {s['ADMIN_PASSWORD']}

À FAIRE ENSUITE
  • Poser le certificat d'origine Cloudflare, PUIS passer le mode SSL en
    Full (strict), dans l'autre ordre, le site répond 526 entre les deux.
  • Régénérer la clé d'API Dokploy : elle a circulé en clair.
  • Changer le mot de passe administrateur à la première connexion.
{'─' * 76}
"""


# ─────────────────────────────────────────────────────────────────────────────
# Étape 4, sauvegarde nocturne
# ─────────────────────────────────────────────────────────────────────────────


S3_HELP = """
  Il faut un stockage objet compatible S3, chez un tiers, et surtout PAS sur ce
  VPS : un bucket MinIO installé à côté de Postgres retomberait avec lui. Un
  bucket Scaleway (fr-par), Backblaze B2 ou Wasabi coûte quelques centimes par
  mois pour ce volume. Créez le bucket, puis une clé d'accès qui n'a le droit
  d'écrire QUE dans ce bucket, et exportez :

    export BACKUP_S3_ENDPOINT='https://s3.fr-par.scw.cloud'
    export BACKUP_S3_BUCKET='cpi-go-sauvegardes'
    export BACKUP_S3_REGION='fr-par'
    export BACKUP_S3_ACCESS_KEY='…'
    export BACKUP_S3_SECRET_KEY='…'
    export BACKUP_S3_PROVIDER='Scaleway'   # facultatif, « Other » par défaut

  Ces valeurs ne sont pas écrites dans le dépôt : elles transitent une fois vers
  Dokploy, qui les conserve, puis disparaissent avec la session.
"""

ALERT_HELP = """
  Créez un canal dans Dokploy → Settings → Notifications, et cochez « Database
  Backup » dessus. Telegram ou Slack demandent une minute et n'ont pas de
  serveur SMTP à configurer. Le canal doit aboutir sur une boîte RELEVÉE : une
  alerte envoyée à une adresse que personne n'ouvre reproduit exactement la
  situation qu'on corrige ici.
"""


def _s3_settings() -> dict:
    """Coordonnées du stockage, reprises de l'environnement de l'opérateur.

    Même règle que DOKPLOY_KEY et BREVO_API_KEY : jamais dans le dépôt, elles ne
    vivent que le temps de la session. Une valeur manquante INTERROMPT, elle
    n'est pas devinée : une destination à moitié renseignée serait acceptée par
    Dokploy et n'échouerait qu'à la première sauvegarde, la nuit, sans témoin.
    """
    required = {
        "BACKUP_S3_ENDPOINT": "endpoint",
        "BACKUP_S3_BUCKET": "bucket",
        "BACKUP_S3_REGION": "region",
        "BACKUP_S3_ACCESS_KEY": "accessKey",
        "BACKUP_S3_SECRET_KEY": "secretAccessKey",
    }
    values: dict = {}
    missing: list[str] = []
    for variable, field in required.items():
        value = os.environ.get(variable, "").strip()
        if not value:
            missing.append(variable)
        values[field] = value
    if missing:
        fail(f"stockage de sauvegarde non renseigné : {', '.join(missing)}")
        print(S3_HELP, file=sys.stderr)
        sys.exit(1)
    values["provider"] = os.environ.get("BACKUP_S3_PROVIDER", "").strip() or "Other"
    values["additionalFlags"] = []
    return values


def _keep_latest_count() -> int:
    raw = os.environ.get("BACKUP_KEEP", "").strip()
    if not raw:
        return BACKUP_KEEP_DEFAULT
    try:
        value = int(raw)
    except ValueError:
        fail(f"BACKUP_KEEP n'est pas un entier : {raw!r}")
        sys.exit(1)
    if value < 1:
        # Zéro voudrait dire « ne garder aucun fichier », ce qui est une manière
        # coûteuse de n'avoir aucune sauvegarde.
        fail("BACKUP_KEEP doit valoir au moins 1")
        sys.exit(1)
    return value


def require_alerting() -> list:
    """Exige au moins un canal relayant l'événement « sauvegarde de base ».

    C'est un PRÉALABLE, vérifié avant de créer quoi que ce soit, et non un
    avertissement en fin de course. Une sauvegarde muette est la panne qu'on
    vient de corriger : elle a l'air de marcher jusqu'au jour où on en a besoin.

    Dokploy émet sur ce même drapeau la réussite ET l'échec. C'est voulu et
    c'est le seul garde-fou contre la panne la plus vicieuse, celle où rien
    n'échoue parce que rien ne se lance : un message arrive chaque nuit, donc
    l'ABSENCE de message est elle-même le signal. Une notification d'échec seule
    ne dirait jamais rien d'un ordonnanceur arrêté.
    """
    channels = [
        row for row in (call("notification.all", method="GET") or []) if row.get("databaseBackup")
    ]
    if not channels:
        fail("aucun canal de notification n'écoute l'événement « Database Backup »")
        print(ALERT_HELP, file=sys.stderr)
        sys.exit(1)
    for channel in channels:
        ok(f"alerte via {channel.get('notificationType', '?')} « {channel.get('name', '?')} »")
    return channels


def ensure_destination() -> str:
    """Destination S3, créée une fois puis relue.

    Une destination portant déjà ce nom est REPRISE telle quelle, ses
    identifiants ne sont jamais réécrits. Dokploy exclut `accessKey` et
    `secretAccessKey` de ses réponses en lecture : impossible de comparer, donc
    impossible d'écraser à bon escient. Réécrire à l'aveugle échangerait une
    destination qui fonctionne contre des variables d'environnement peut-être
    périmées, et les sauvegardes suivantes partiraient dans le vide.
    """
    for row in call("destination.all", method="GET") or []:
        if row.get("name") == BACKUP_DESTINATION_NAME:
            ok(f"destination « {BACKUP_DESTINATION_NAME} » déjà enregistrée")
            # Dit à voix haute, parce que c'est une réserve sur ce qui vient
            # d'être affiché comme une réussite : sur cette voie le test d'accès
            # plus bas n'a PAS lieu, et les BACKUP_S3_* de la session ne sont
            # même pas lues. Une destination existante qui pointe sur un bucket
            # supprimé ou dont la clé a été révoquée est reprise telle quelle.
            warn("accès au bucket NON réévalué : destination existante reprise en l'état")
            info("pour en changer, passez par Dokploy → Settings → S3 Destinations")
            return row.get("destinationId", "")

    settings = _s3_settings()
    # Éprouvée AVANT d'être enregistrée. Sans ce test, des identifiants faux ne
    # se manifestent qu'à la première fenêtre nocturne, et sous la forme d'une
    # notification d'échec qu'il faut avoir pensé à lire.
    call("destination.testConnection", settings)
    ok(f"accès au bucket {settings['bucket']} vérifié")

    call("destination.create", {"name": BACKUP_DESTINATION_NAME, **settings})
    for row in call("destination.all", method="GET") or []:
        if row.get("name") == BACKUP_DESTINATION_NAME:
            ok(f"destination créée, {row.get('destinationId', '')}")
            return row.get("destinationId", "")
    raise DokployError("destination créée mais introuvable à la relecture")


def postgres_backups(postgres_id: str) -> list:
    """Sauvegardes déclarées sur le service Postgres, avec leurs exécutions."""
    database = call("postgres.one", {"postgresId": postgres_id}, method="GET") or {}
    return database.get("backups", []) or []


def ensure_backup(postgres_id: str, destination_id: str) -> str:
    """Entrée de sauvegarde sur le service Postgres, idempotente.

    Reconnue par son préfixe. Une entrée existante qui pointe sur une AUTRE
    destination lève au lieu d'être réécrite, même raison que pour les montages
    dans ensure_volume_mount : rebasculer la destination en silence laisserait
    croire que tout l'historique est dans le nouveau bucket, alors qu'il serait
    coupé en deux, et on ne s'en apercevrait qu'en cherchant un dump ancien.
    """
    for backup in postgres_backups(postgres_id):
        if backup.get("prefix") != BACKUP_PREFIX:
            continue
        backup_id = backup.get("backupId", "")
        if backup.get("destinationId") != destination_id:
            raise DokployError(
                f"la sauvegarde {backup_id} vise déjà une autre destination "
                f"({backup.get('destinationId')}), à trancher à la main"
            )
        if backup.get("enabled"):
            ok(f"sauvegarde déjà déclarée, {backup_id}, {backup.get('schedule')}")
            return backup_id

        warn("la sauvegarde existe mais elle est DÉSACTIVÉE, réactivation")
        try:
            call(
                "backup.update",
                {
                    "backupId": backup_id,
                    "enabled": True,
                    "schedule": backup.get("schedule") or BACKUP_SCHEDULE,
                    "prefix": BACKUP_PREFIX,
                    "destinationId": destination_id,
                    "database": backup.get("database") or "crm",
                    "keepLatestCount": backup.get("keepLatestCount") or _keep_latest_count(),
                    "serviceName": backup.get("serviceName"),
                    "metadata": backup.get("metadata"),
                    "databaseType": "postgres",
                },
            )
            ok("réactivée")
        except DokployError as exc:
            fail(f"réactivation refusée ({exc})")
            info("réactivez-la depuis Dokploy → la base → onglet Backups → interrupteur")
            sys.exit(1)
        return backup_id

    keep = _keep_latest_count()
    call(
        "backup.create",
        {
            "postgresId": postgres_id,
            "databaseType": "postgres",
            "backupType": "database",
            "database": "crm",
            "destinationId": destination_id,
            "prefix": BACKUP_PREFIX,
            "schedule": BACKUP_SCHEDULE,
            "keepLatestCount": keep,
            "enabled": True,
        },
    )
    for backup in postgres_backups(postgres_id):
        if backup.get("prefix") == BACKUP_PREFIX:
            ok(f"sauvegarde créée, {backup.get('backupId')}, {BACKUP_SCHEDULE}, {keep} fichiers")
            return backup.get("backupId", "")
    raise DokployError("sauvegarde créée mais introuvable à la relecture")


def cmd_backup() -> None:
    ids = load_ids()
    ids.update({k: v for k, v in find_existing().items() if v})
    if not ids.get("POSTGRES_ID"):
        fail("Postgres introuvable, lancez d'abord `provision`.")
        sys.exit(1)
    save_ids(ids)

    # L'ordre compte. On refuse d'abord faute d'alerte, ENSUITE seulement on
    # crée. Une sauvegarde posée sans destinataire d'alerte serait un progrès
    # apparent et un piège réel.
    step("Destinataire des alertes")
    require_alerting()

    step("Stockage des sauvegardes, hors du VPS")
    destination_id = ensure_destination()

    step("Sauvegarde nocturne de la base")
    backup_id = ensure_backup(ids["POSTGRES_ID"], destination_id)

    # Une sauvegarde immédiate, tout de suite, sous les yeux de l'opérateur.
    # Attendre la première fenêtre nocturne pour découvrir qu'une permission
    # manque sur le bucket, c'est perdre une nuit et, pire, prendre l'habitude
    # de croire le travail terminé.
    step("Sauvegarde de vérification, immédiate")
    call("backup.manualBackupPostgres", {"backupId": backup_id})
    ok("demandée, le fichier doit apparaître dans le bucket sous une minute")
    info("une notification de RÉUSSITE doit suivre sur le canal ci-dessus")

    print(_backup_epilogue())


def _backup_epilogue() -> str:
    return f"""
{'─' * 76}
SAUVEGARDE EN PLACE

  Chaque nuit ({BACKUP_SCHEDULE}, heure serveur, identique à Dakar), Dokploy
  lance pg_dump dans le conteneur de la base et pousse la sortie gzippée vers
  le bucket. Le fichier n'est jamais posé sur le VPS.

  Chemin dans le bucket :
    <appName de la base>/{BACKUP_PREFIX}<horodatage>.sql.gz

CE QUI VOUS PRÉVIENT

  Un message arrive CHAQUE NUIT, en réussite comme en échec. Trois lectures :

    message « success »   rien à faire
    message « error »     lisez la cause, relancez à la main depuis Dokploy
    AUCUN message         c'est le cas le plus grave : ni succès ni échec
                          signifie que rien ne s'est lancé. Vérifiez que
                          l'entrée est toujours active, puis relancez.

  Contrôle mensuel, deux minutes : `deploy.py status` doit annoncer la
  sauvegarde active, et le bucket doit contenir un fichier daté de cette nuit.

RESTAURER, la procédure est dans infra/README.md, section Sauvegardes.
{'─' * 76}
"""


# ─────────────────────────────────────────────────────────────────────────────
# État
# ─────────────────────────────────────────────────────────────────────────────


def cmd_status() -> None:
    step("Projet CPI GO")
    project = project_contents()
    print(f"  nom : {project.get('name', '?')}")
    for environment in project.get("environments", []) or []:
        apps = environment.get("applications", []) or []
        dbs = environment.get("postgres", []) or []
        print(f"\n  environnement {environment.get('name', '?')}")
        if not apps and not dbs:
            info("  (vide)")
        # Le défaut '?' n'est pas de la coquetterie : `.get('name')` sans
        # défaut rend None, et `format(None, '24s')` lève une TypeError que
        # `main()` n'attrape pas : il ne guette que DokployError. Une seule
        # ligne de service sans `name` faisait donc tomber `status` sur une
        # trace brute, alors que `status` est précisément l'outil qu'on lance
        # quand quelque chose va déjà mal.
        for db in dbs:
            print(
                f"    postgres  {db.get('name') or '?':24s} "
                f"{db.get('applicationStatus', '?')}"
            )
        for app in apps:
            domains = ", ".join(d.get("host", "") for d in app.get("domains", []) or [])
            print(
                f"    app       {app.get('name') or '?':24s} "
                f"{app.get('applicationStatus') or '?':10s} {domains}"
            )

    step("Sauvegardes")
    _print_backup_status(project)


def _print_backup_status(project: dict) -> None:
    """Dit la vérité sur les sauvegardes, à chaque `status`.

    C'est délibérément bruyant. L'absence de sauvegarde s'est installée parce
    que rien, nulle part, ne la signalait : le fichier qui la définissait ne
    tournait pas et aucune commande ne s'en plaignait. Une ligne rouge à chaque
    consultation de l'état est le prix à payer pour que cela ne recommence pas.
    """
    total = 0
    for environment in project.get("environments", []) or []:
        for db in environment.get("postgres", []) or []:
            try:
                backups = postgres_backups(db.get("postgresId", ""))
            except DokployError as exc:
                warn(f"{db.get('name')} : lecture impossible ({exc})")
                continue
            for backup in backups:
                total += 1
                # L'ordre renvoyé n'est pas garanti : on trie explicitement,
                # sinon « dernière exécution » pourrait afficher un succès
                # vieux de trois semaines et masquer l'échec d'hier.
                runs = sorted(
                    backup.get("deployments", []) or [],
                    key=lambda run: str(run.get("createdAt") or ""),
                    reverse=True,
                )
                last = runs[0] if runs else {}
                state = "active" if backup.get("enabled") else "DÉSACTIVÉE"
                colour = GREEN if backup.get("enabled") else RED
                print(
                    f"  {colour}{state}{RESET}  {db.get('name')}  {backup.get('schedule')}  "
                    f"{backup.get('keepLatestCount')} fichiers  "
                    f"→ {(backup.get('destination') or {}).get('name', '?')}"
                )
                if last:
                    print(
                        f"           dernière exécution : {last.get('status', '?')} "
                        f"{last.get('createdAt', '')}"
                    )
                else:
                    warn("aucune exécution enregistrée pour l'instant")

    if total == 0:
        fail("AUCUNE SAUVEGARDE CONFIGURÉE. La perte du VPS serait définitive.")
        info("corrigez avec : python3 infra/dokploy/deploy.py backup")


# ─────────────────────────────────────────────────────────────────────────────

COMMANDS = {
    "provision": cmd_provision,
    "configure": cmd_configure,
    "deploy": cmd_deploy,
    "redeploy": cmd_redeploy,
    "backup": cmd_backup,
    "status": cmd_status,
}


def main() -> None:
    argument = sys.argv[1] if len(sys.argv) > 1 else ""
    if argument != "all" and argument not in COMMANDS:
        print(__doc__)
        sys.exit(1)

    # `all` passait AVANT le `try` et sortait par son propre `return` : une
    # DokployError pendant la voie recommandée par le README produisait une
    # trace Python brute au lieu du « ✗ » formaté, ce que l'en-tête de ce
    # fichier promet explicitement de ne pas faire. Les deux voies partagent
    # désormais le même traitement d'erreur, et donc le même code de sortie.
    sequence = ("provision", "configure", "deploy") if argument == "all" else (argument,)
    try:
        for name in sequence:
            COMMANDS[name]()
    except DokployError as exc:
        fail(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
