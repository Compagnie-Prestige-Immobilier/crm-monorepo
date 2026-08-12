#!/usr/bin/env bash
# Sauvegarde quotidienne de Postgres.
#
# Boucle simple plutôt que cron : le conteneur n'a alors qu'un seul processus,
# ses journaux partent sur stdout comme ceux des autres services, et
# `docker compose logs backup` suffit à savoir si la dernière sauvegarde a
# réussi. Un cron dans un conteneur écrit dans un fichier que personne ne lit.
#
# Écrit dans /backups, qui est un bind mount de l'hôte — délibérément hors du
# volume de données : une sauvegarde qui disparaît avec le volume qu'elle
# protège n'est pas une sauvegarde.

set -euo pipefail

BACKUP_DIR=/backups
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_HOUR="${BACKUP_HOUR:-2}"

log() { printf '%s [backup] %s\n' "$(date -Iseconds)" "$*"; }

dump() {
	local stamp file
	stamp="$(date +%Y%m%d-%H%M%S)"
	file="${BACKUP_DIR}/crm-${stamp}.sql.gz"

	log "démarrage → ${file}"

	# Écriture dans un fichier temporaire puis renommage atomique : une
	# sauvegarde interrompue (VPS redémarré en plein dump) ne doit pas laisser
	# un .sql.gz tronqué que la rotation finirait par considérer comme la
	# dernière sauvegarde valide.
	if pg_dump --format=plain --no-owner --no-privileges | gzip -9 >"${file}.partial"; then
		mv "${file}.partial" "${file}"
		log "terminé → $(du -h "${file}" | cut -f1)"
	else
		rm -f "${file}.partial"
		log "ÉCHEC — aucune sauvegarde produite ce cycle"
		return 1
	fi
}

rotate() {
	# -mtime +N supprime ce qui est plus vieux que N jours. Ne touche jamais
	# aux .partial, qui sont nettoyés par dump() lui-même.
	local removed
	removed="$(find "${BACKUP_DIR}" -maxdepth 1 -name 'crm-*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)"
	[ "${removed}" -gt 0 ] && log "rotation : ${removed} sauvegarde(s) de plus de ${RETENTION_DAYS} jours supprimée(s)"
	return 0
}

seconds_until_next_run() {
	local now target
	now="$(date +%s)"
	target="$(date -d "today ${BACKUP_HOUR}:00" +%s)"
	[ "${target}" -le "${now}" ] && target="$(date -d "tomorrow ${BACKUP_HOUR}:00" +%s)"
	echo "$((target - now))"
}

mkdir -p "${BACKUP_DIR}"
log "démarré — rétention ${RETENTION_DAYS} j, exécution quotidienne à ${BACKUP_HOUR}h00 (${TZ:-UTC})"

# Une sauvegarde immédiate au démarrage : après un redéploiement, on veut un
# point de restauration récent sans attendre la prochaine fenêtre nocturne.
dump || true
rotate

while true; do
	wait_for="$(seconds_until_next_run)"
	log "prochaine sauvegarde dans $((wait_for / 3600))h$(((wait_for % 3600) / 60))m"
	sleep "${wait_for}"
	dump || log "on continue : la prochaine tentative aura lieu demain"
	rotate
done
