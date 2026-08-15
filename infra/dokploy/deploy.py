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
    python3 infra/dokploy/deploy.py status      # état courant
    python3 infra/dokploy/deploy.py all         # les trois premières d'affilée

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

DOKPLOY_URL = os.environ.get("DOKPLOY_URL", "https://dokploy.cpi-chues.com")
ENVIRONMENT_ID = os.environ.get("ENVIRONMENT_ID", "prUxKulJkxda_0vY9chIi")
PROJECT_ID = os.environ.get("PROJECT_ID", "cUvJ9T8TmuSc6HIKg8ydW")
GIT_URL = os.environ.get(
    "GIT_URL", "git@github.com:Compagnie-Prestige-Immobilier/crm-monorepo.git"
)
BRANCH = os.environ.get("BRANCH", "prod")
API_DOMAIN = os.environ.get("API_DOMAIN", "go.cpi-chues.com")
WEB_DOMAIN = os.environ.get("WEB_DOMAIN", "go-admin.cpi-chues.com")

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
    path.write_text("\n".join(lines) + "\n")
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
    try:
        project = project_contents()
    except DokployError as exc:
        warn(f"lecture du projet impossible : {exc}")
        return found

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
    sender = os.environ.get("BREVO_SENDER_EMAIL", "no-reply@cpi.sn").strip()
    name = os.environ.get("BREVO_SENDER_NAME", "CRM CPI").strip()
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
            # Instance de présentation. À repasser à false le jour où de vraies
            # fiches entrent dans cette base.
            "DEMO_MODE_ALLOWED=true",
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
    """
    names = {"postgres": PG_NAME, "api": API_NAME, "web": WEB_NAME}
    try:
        if ids.get("POSTGRES_ID"):
            db = call(
                "postgres.one", {"postgresId": ids["POSTGRES_ID"]}, method="GET"
            ) or {}
            names["postgres"] = db.get("appName") or PG_NAME
        for key, slot in (("API_ID", "api"), ("WEB_ID", "web")):
            if ids.get(key):
                app = call(
                    "application.one", {"applicationId": ids[key]}, method="GET"
                ) or {}
                names[slot] = app.get("appName") or names[slot]
    except DokployError as exc:
        warn(f"noms de service non résolus ({exc}), noms courts utilisés")
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

    for key, label, dockerfile in (
        ("API_ID", "API", "Dockerfile.api"),
        ("WEB_ID", "panel web", "Dockerfile.web"),
    ):
        step(f"Déploiement, {label}")
        if not ids.get(key):
            fail(f"{label} introuvable")
            continue
        call("application.deploy", {"applicationId": ids[key]})
        ok(f"demandé, construction depuis infra/docker/{dockerfile}")

    print(_epilogue(secrets_))


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

  pnpm --filter @crm/database db:deploy   # migrations
  pnpm --filter @crm/database db:seed     # référentiels + compte administrateur

  Sans le seed, aucune saisie n'est possible : banques, syndicats et
  départements sont des clés étrangères obligatoires.

  Les données de démonstration s'activent depuis le panel web
  (Paramètres → Mode démonstration), jamais en ligne de commande.

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
        for db in dbs:
            print(
                f"    postgres  {db.get('name'):24s} {db.get('applicationStatus', '?')}"
            )
        for app in apps:
            domains = ", ".join(d.get("host", "") for d in app.get("domains", []) or [])
            print(
                f"    app       {app.get('name'):24s} "
                f"{app.get('applicationStatus', '?'):10s} {domains}"
            )


# ─────────────────────────────────────────────────────────────────────────────

COMMANDS = {
    "provision": cmd_provision,
    "configure": cmd_configure,
    "deploy": cmd_deploy,
    "status": cmd_status,
}


def main() -> None:
    argument = sys.argv[1] if len(sys.argv) > 1 else ""
    if argument == "all":
        for name in ("provision", "configure", "deploy"):
            COMMANDS[name]()
        return
    if argument not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    try:
        COMMANDS[argument]()
    except DokployError as exc:
        fail(str(exc))
        sys.exit(1)


if __name__ == "__main__":
    main()
