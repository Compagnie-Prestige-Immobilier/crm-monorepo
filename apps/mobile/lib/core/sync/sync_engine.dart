import 'dart:convert';
import 'dart:math';

import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import '../utils/ids.dart';
import 'api_port.dart';
import 'backoff.dart';
import 'clock.dart';
import 'outbox_status.dart';
import 'phase2_directory_sync.dart'
    show CallOutcomes, EnrollmentMethods, callAttemptEntity;
import 'token_store.dart';

/// Moteur de synchronisation : **Dart pur**.
///
/// Contrainte d'architecture, pas préférence de style : le worker WorkManager
/// exécute ce code dans un isolat de fond qui n'a **ni arbre de widgets, ni
/// conteneur Riverpod, ni plugins de rendu**. Tout ce qui vit dans
/// `lib/core/sync/` respecte donc une règle unique, vérifiée par un test :
///
/// > aucun `import 'package:flutter/...'`, aucun `import
/// > 'package:flutter_riverpod/...'`.
///
/// Le moteur reçoit ses quatre collaborateurs : [AppDatabase], [ApiPort],
/// [TokenStore], [Clock] : et n'en construit aucun. C'est ce qui permet à
/// l'isolat UI (via Riverpod) et à l'isolat worker (via `buildSyncEngine`)
/// d'assembler exactement le même objet par deux chemins différents.
///
/// ## Ce que garantit la vidange
///
/// 1. **Vol unique.** Deux vidanges concurrentes émettraient le même lot deux
///    fois sous deux clés d'idempotence différentes : le serveur ne pourrait pas
///    les rapprocher.
/// 2. **Bail écrit AVANT la requête.** Si l'app meurt en vol, la ligne reste en
///    `syncing` avec un bail daté ; le cycle suivant le récupère. Écrire le bail
///    après l'envoi laisserait au contraire une opération éternellement
///    `pending` alors qu'elle est peut-être déjà appliquée côté serveur.
/// 3. **Ordre structurel, pas vérifié.** Un prospect partage la `dependencyKey`
///    de son représentant et porte un `seq` supérieur ; un lot n'emporte qu'un
///    **préfixe contigu** d'opérations `pending` par clé. Il n'existe donc aucun
///    chemin par lequel un prospect partirait sans le `create` de son parent :
///    ce n'est pas un contrôle qu'on peut oublier d'écrire, c'est une propriété
///    de la sélection.
/// 4. **Une clé empoisonnée ne bloque qu'elle-même.** Si la tête d'une clé est
///    en `conflict` ou `failed`, la clé entière est ignorée ; les quarante
///    autres représentants continuent de passer (ADR 0001 §2).
class SyncEngine {
  SyncEngine({
    required AppDatabase database,
    required ApiPort api,
    required TokenStore tokens,
    required Clock clock,
    this.maxBatchOps = 200,
    this.maxBatchBytes = 512 * 1024,
    this.maxBatchGroups = 25,
    this.maxAttempts = 8,
    this.maxBlockedAttempts = 12,
    this.blockedFloor = const Duration(seconds: 30),
    this.leaseDuration = const Duration(minutes: 2),
    Random? random,
  }) : _db = database,
       _api = api,
       _tokens = tokens,
       _clock = clock,
       _backoff = Backoff(random: random ?? Random());

  final AppDatabase _db;
  final ApiPort _api;
  final TokenStore _tokens;
  final Clock _clock;
  final Backoff _backoff;

  /// Version du format de payload actuellement produite.
  ///
  /// Elle voyage avec le lot et est stockée sur chaque ligne d'outbox. Une
  /// opération peut attendre trois semaines dans la file et traverser une mise à
  /// jour de l'app : sans ce numéro, on ne saurait pas dans quel format la
  /// relire.
  static const int payloadVersion = 1;

  /// Plafond d'opérations par lot. 200 est le maximum accepté par le serveur ;
  /// au-delà, la transaction de groupe dépasserait son délai.
  final int maxBatchOps;

  /// Plafond d'octets par lot. Sur un lien 2G, un lot de 512 ko met déjà plus
  /// d'une minute à monter ; au-delà, plus aucun envoi n'aboutit jamais.
  final int maxBatchBytes;

  /// Plafond de **clés de dépendance** par lot. 25, parce que c'est la valeur
  /// exacte que le serveur impose (`SYNC_MAX_DEPENDENCY_GROUPS`) : chaque groupe
  /// y est une transaction, et un lot qui en couvre davantage est refusé **en
  /// bloc, en 400** : donc classé terminal, donc toutes ses opérations partent
  /// en `failed`.
  ///
  /// Ce plafond ne se voyait pas en phase 1 : un commercial saisit rarement plus
  /// de vingt-cinq représentants entre deux synchronisations. La phase 2 le rend
  /// certain : chaque tentative d'appel porte sa propre clé (`prospect:<id>`), et
  /// une matinée hors ligne en produit soixante. Sans ce plafond, la première
  /// synchronisation au retour du réseau condamnerait toute la matinée d'un
  /// coup, définitivement.
  final int maxBatchGroups;

  /// Au-delà, l'opération passe en `failed` et attend une intervention humaine.
  /// Réessayer indéfiniment une opération invalide vide la batterie sans jamais
  /// aboutir.
  ///
  /// Ce compteur ne mesure QUE des refus serveur. Un lien mort
  /// ([FailureKind.unreachable]) ne l'incrémente pas : sinon quatre minutes sans
  /// antenne suffiraient à faire passer une saisie valide en
  /// `ATTEMPTS_EXHAUSTED`.
  final int maxAttempts;

  /// Plafond des rejeux BLOQUÉS : ceux où le serveur a répondu sans juger
  /// l'opération (dépendance non résolue, statut inconnu).
  ///
  /// Sans plafond, une opération dont le groupe échoue systématiquement
  /// (`GROUP_TRANSACTION_FAILED`) tourne indéfiniment : elle n'atteint jamais
  /// `failed`, donc ne remonte jamais dans « À corriger », donc personne ne peut
  /// rien en faire. Douze rejeux espacés d'au moins [blockedFloor] laissent tout
  /// le temps au parent d'être réparé ; au-delà, c'est un blocage permanent, et
  /// le rendre visible vaut mieux que le réessayer jusqu'à la fin des temps.
  final int maxBlockedAttempts;

  /// Plancher de délai d'un rejeu bloqué.
  ///
  /// C'est LE correctif : `nextDelay(0)` vaut zéro, si bien qu'un rejeu qui ne
  /// comptait pas de tentative repartait immédiatement. Cinquante tours de
  /// vidange, toutes les soixante secondes, pour une opération que rien ne
  /// pouvait débloquer.
  final Duration blockedFloor;

  /// Durée du bail. Assez long pour couvrir un envoi lent (60 s de
  /// `receiveTimeout` + montée), assez court pour qu'un plantage ne fige pas la
  /// file plus de quelques minutes.
  final Duration leaseDuration;

  AppDatabase get database => _db;
  ApiPort get api => _api;
  TokenStore get tokens => _tokens;
  Clock get clock => _clock;
  Backoff get backoff => _backoff;

  bool _draining = false;
  bool _pulling = false;

  /// Vrai tant qu'une vidange est en cours. Lu par l'UI pour griser le bouton
  /// « Synchroniser maintenant ».
  bool get isDraining => _draining;

  /// Vrai tant qu'un pull est en cours.
  ///
  /// [isDraining] retombait à `false` dès la fin du push, c'est-à-dire pendant
  /// toute la phase de tirage : le minuteur de 60 s, le retour au premier plan
  /// et le bouton « Synchroniser » pouvaient donc se superposer. Deux pulls
  /// lisent alors le MÊME curseur, et le second [writeCursor] le fait reculer :
  /// les pages déjà tirées repartent, sur un forfait mobile.
  bool get isPulling => _pulling;

  /// Vrai tant qu'un cycle (push ou pull) est en cours.
  bool get isBusy => _draining || _pulling;

  ApiException? _lastPushFailure;

  /// Dernier échec de LOT de la vidange en cours, ou `null` si tout est passé.
  ///
  /// `drain` rattrape ces échecs pour continuer sur les autres clés de
  /// dépendance ; il faut donc un autre chemin pour les faire remonter, sans
  /// quoi `runOnce` annonce un succès alors que rien n'est parti.
  ApiException? get lastPushFailure => _lastPushFailure;

  // ───────────────────────────────────────────────────────────────────────────
  // Compteurs
  // ───────────────────────────────────────────────────────────────────────────

  Future<int> pendingCount() => _db.countPendingOutbox().getSingle();

  Stream<int> watchPendingCount() => _db.countPendingOutbox().watchSingle();

  /// Ce qu'une exécution supplémentaire pourrait encore faire avancer.
  ///
  /// [pendingCount] compte aussi `conflict` et `failed` : c'est ce que
  /// l'utilisateur a « en attente », et c'est juste pour un badge. Ce n'est PAS
  /// ce sur quoi on décide de réveiller la machine : une opération
  /// définitivement en échec ne bougera pas parce qu'un worker s'est exécuté, et
  /// la programmer à chaque mise en veille brûle un quota JobScheduler à chaque
  /// fois, indéfiniment.
  Future<int> schedulableCount() => _db.countSchedulableOutbox().getSingle();

  // ───────────────────────────────────────────────────────────────────────────
  // Cycle complet
  // ───────────────────────────────────────────────────────────────────────────

  /// Un cycle : pousser ce qui attend, puis tirer les nouveautés.
  ///
  /// L'ordre n'est pas arbitraire. Tirer d'abord écraserait une modification
  /// locale non encore poussée par la version serveur, qui est plus ancienne.
  Future<SyncOutcome> runOnce({bool pull = true}) async {
    if (await _tokens.readRefreshToken() == null) {
      return const SyncOutcome.skipped('no_session');
    }
    int pushed = 0;
    try {
      pushed = await drain();
    } on ApiException catch (e) {
      return SyncOutcome.failed(e.code, kind: e.kind, pushed: pushed);
    }
    // `drain` rattrape les échecs de lot pour continuer sur les autres clés :
    // sans cette relecture, un lot refusé ou un lien mort n'atteignait JAMAIS le
    // verdict du cycle. Le worker WorkManager rendait `ok` et ne se
    // reprogrammait pas, et l'interface ne pouvait rien dire du réseau.
    final ApiException? failure = lastPushFailure;
    if (failure != null) {
      return SyncOutcome.failed(failure.code, kind: failure.kind, pushed: pushed);
    }
    if (!pull) return SyncOutcome.ok(pushed: pushed, pulled: 0);
    try {
      final int pulled = await pullChanges();
      return SyncOutcome.ok(pushed: pushed, pulled: pulled);
    } on ApiException catch (e) {
      // Un pull raté n'annule pas un push réussi : ce sont deux directions
      // indépendantes, et effacer le compte poussé ferait croire à l'utilisateur
      // que rien n'est parti.
      return SyncOutcome.failed(e.code, kind: e.kind, pushed: pushed);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Vidange (push)
  // ───────────────────────────────────────────────────────────────────────────

  /// Vide la file jusqu'à épuisement des opérations éligibles.
  ///
  /// Renvoie le nombre d'opérations acquittées par le serveur (quel que soit le
  /// verdict : appliqué, doublon, conflit : elles ont toutes reçu une réponse).
  Future<int> drain() async {
    // Vol unique. Sans ce garde, un déclencheur de connectivité et le minuteur
    // de 60 s peuvent partir dans la même milliseconde et émettre deux fois le
    // même lot, sous deux clés d'idempotence différentes : que le serveur ne
    // peut pas rapprocher.
    if (_draining) return 0;
    _draining = true;
    _lastPushFailure = null;
    try {
      int acknowledged = 0;
      // Borne dure : une boucle `while(true)` qui n'avancerait pas (bug de
      // sélection, statut jamais mis à jour) tournerait indéfiniment dans un
      // isolat de fond, invisible, batterie comprise.
      for (int round = 0; round < 50; round++) {
        await repairClockDrift();
        await reclaimExpiredLeases();
        // `claimBatch` et non `selectBatch` : la prise du bail est dans la MÊME
        // transaction que la sélection. Le garde `_draining` est un champ
        // d'instance, donc il ne protège qu'un isolat ; le worker WorkManager
        // construit son propre moteur sur le même fichier de base.
        final List<OutboxData> batch = await claimBatch();
        if (batch.isEmpty) break;

        final _PreparedBatch prepared = await _prepare(batch);
        if (prepared.isEmpty) {
          // Tout le lot était indécodable : les lignes sont déjà passées en
          // `failed`, il n'y a rien à envoyer, mais il reste peut-être du
          // travail derrière.
          continue;
        }

        // Le compte vient du VERDICT reçu, pas de la taille du lot préparé.
        // L'ancienne écriture (`acknowledged += prepared.length`) s'exécutait
        // même quand `_sendBatch` avait avalé l'exception : `runOnce` annonçait
        // alors « n envoyés » sans que rien ne soit parti, et le worker
        // WorkManager, voyant un succès, ne se reprogrammait pas.
        final _SendReport report = await _sendBatch(prepared);
        acknowledged += report.acknowledged;
        if (!report.keepGoing) break;
      }
      return acknowledged;
    } finally {
      _draining = false;
    }
  }

  /// La condition « cette ligne, et seulement si je la possède encore ».
  ///
  /// ═══ LE `seq` SEUL NE DÉSIGNE PAS UNE POSSESSION ═══
  ///
  /// [claimBatch] rend la transition `pending -> syncing` atomique, donc deux
  /// isolats ne partent jamais avec la même ligne EN MÊME TEMPS. Il ne dit rien
  /// de la suite : toutes les écritures d'après-envoi désignaient la ligne par
  /// son seul `seq`, si bien qu'un isolat dont le bail avait expiré pendant
  /// qu'il attendait le réseau revenait écrire son verdict sur une ligne qu'un
  /// autre isolat avait déjà reprise, renvoyée, et qui attendait le sien. Le
  /// retardataire gagnait, parce qu'il écrivait en dernier.
  ///
  /// Toute mutation d'une ligne réservée passe donc par ce prédicat. Un écrivain
  /// qui n'est plus le propriétaire ne touche aucune ligne : c'est un
  /// non-événement, jamais un écrasement.
  static Expression<bool> _ownedBy(Outbox o, OutboxData row) {
    final String? token = row.claimToken;
    return o.seq.equals(row.seq) &
        (token == null ? o.claimToken.isNull() : o.claimToken.equals(token));
  }

  /// Récupère les baux des isolats morts en vol.
  ///
  /// Un bail expiré signifie « quelqu'un a pris cette ligne et n'est jamais
  /// revenu ». La remettre en `pending` est sûr : l'envoi porte une clé
  /// d'idempotence, donc un éventuel doublon côté serveur est reconnu et rendu
  /// tel quel.
  ///
  /// La reprise **efface le jeton de possession**, et c'est ce qui neutralise
  /// l'ancien porteur : s'il revient du réseau après l'expiration, ses écritures
  /// ne trouvent plus de ligne qui lui appartienne et ne font rien.
  Future<int> reclaimExpiredLeases() async {
    return _db.transaction(() async {
      final DateTime now = _clock.now();
      final List<OutboxData> stale = await (_db.select(
        _db.outbox,
      )..where((Outbox o) => o.status.equals(OutboxStatus.syncing))).get();
      final List<OutboxData> expired = stale
          .where((OutboxData o) => o.leaseUntil == null || !o.leaseUntil!.isAfter(now))
          .toList(growable: false);
      if (expired.isEmpty) return 0;

      int reclaimed = 0;
      for (final OutboxData row in expired) {
        // Ligne par ligne, et fenêtrée sur le jeton : une reprise concurrente a
        // pu, entre la lecture et l'écriture, rendre la ligne à la file ET la
        // faire reprendre par un troisième larron. La réécrire en `pending` la
        // lui volerait pendant que sa requête est en vol.
        reclaimed +=
            await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
              OutboxCompanion(
                status: const Value(OutboxStatus.pending),
                leaseUntil: const Value<DateTime?>(null),
                claimToken: const Value<String?>(null),
              ),
            );
      }
      return reclaimed;
    });
  }

  /// Répare les échéances qu'un recul d'horloge a projetées dans le futur.
  ///
  /// `nextAttemptAt` et `leaseUntil` sont écrits en heure APPAREIL. Un
  /// téléphone dont l'horloge avance de trois jours, puis que l'utilisateur
  /// remet à l'heure : c'est un incident banal sur un appareil d'entrée de
  /// gamme sans NTP fiable : laisse derrière lui des lignes dont l'échéance est
  /// à trois jours. Le sélecteur les considère « pas encore dues », et la file
  /// se fige jusqu'à ce que l'horloge rattrape la valeur absurde qu'on y a
  /// écrite. Rien dans l'interface ne peut expliquer ça.
  ///
  /// On ramène donc toute échéance **plus lointaine que ce que le moteur peut
  /// écrire** à maintenant : au-delà, la valeur ne peut pas avoir été produite
  /// ici, elle vient forcément d'une horloge qui a bougé. Même raisonnement
  /// pour un bail plus long que [leaseDuration].
  ///
  /// ═══ CE PLAFOND N'EST PAS CELUI DU BACK-OFF ═══
  ///
  /// Il l'était, et c'était faux. Le back-off plafonne à 15 minutes, mais ce
  /// n'est pas la seule échéance que le moteur inscrive : la branche
  /// `FailureKind.throttled` écrit `now + error.retryAfter`, c'est-à-dire ce que
  /// le SERVEUR impose, jusqu'à [kMaxRetryAfter]. Un `Retry-After: 1800` était
  /// donc systématiquement pris pour une horloge déréglée et effacé au tour
  /// suivant, moins de 60 secondes plus tard. Le client repartait pousser dans
  /// le limiteur de débit, qui le limitait de nouveau, indéfiniment : la
  /// réparation d'horloge annulait le seul mécanisme censé faire attendre.
  ///
  /// Les deux écritures partagent donc maintenant la même borne, et c'est la
  /// plus haute des deux qui décide de ce qui est plausible.
  Future<int> repairClockDrift() async {
    final DateTime now = _clock.now();
    final Duration writable = _backoff.cap > kMaxRetryAfter
        ? _backoff.cap
        : kMaxRetryAfter;
    final DateTime attemptCeiling = now.add(writable);
    final DateTime leaseCeiling = now.add(leaseDuration);

    final int repairedAttempts =
        await (_db.update(_db.outbox)..where(
              (Outbox o) =>
                  o.status.equals(OutboxStatus.pending) &
                  o.nextAttemptAt.isBiggerThanValue(attemptCeiling),
            ))
            .write(OutboxCompanion(nextAttemptAt: Value<DateTime>(now)));

    final int repairedLeases =
        await (_db.update(_db.outbox)..where(
              (Outbox o) =>
                  o.status.equals(OutboxStatus.syncing) &
                  o.leaseUntil.isBiggerThanValue(leaseCeiling),
            ))
            .write(OutboxCompanion(leaseUntil: Value<DateTime?>(now)));

    return repairedAttempts + repairedLeases;
  }

  /// Sélectionne **et réserve** le prochain lot, en une seule transaction.
  ///
  /// ## Pourquoi la réservation ne peut pas rester en dehors
  ///
  /// `_draining` est un champ d'instance : il garantit le vol unique **dans un
  /// isolat**. Or le worker WorkManager construit son propre [SyncEngine] sur le
  /// même fichier de base, et l'app peut être au premier plan pendant qu'il
  /// tourne. Sélectionner d'un côté, poser le bail de l'autre laissait une
  /// fenêtre où les deux isolats lisaient les mêmes lignes `pending` et les
  /// envoyaient sous deux `batchId` différents : deux clés d'idempotence que le
  /// serveur ne peut pas rapprocher, donc potentiellement deux écritures.
  ///
  /// La réservation est donc un `UPDATE … WHERE status = 'pending'` **dans la
  /// transaction de lecture** : le perdant de la course ne met à jour aucune
  /// ligne et repart les mains vides.
  ///
  /// On relit ensuite les lignes réellement prises en filtrant sur le **jeton de
  /// possession** qu'on vient d'écrire. Le bail seul ne pouvait pas jouer ce
  /// rôle : deux isolats qui calculent leur `now` à la même milliseconde
  /// écriraient la même date, et surtout une date se répète après une remise à
  /// l'heure. Le jeton, lui, est tiré une fois par réservation et n'appartient
  /// qu'à elle. C'est nécessaire parce qu'une réservation peut être PARTIELLE :
  /// rien n'oblige les deux isolats à voir exactement le même lot.
  ///
  /// Ce jeton ne sert pas qu'ici : il fenêtre **toutes** les écritures qui
  /// suivront sur ces lignes (voir [_ownedBy]).
  Future<List<OutboxData>> claimBatch() async {
    return _db.transaction(() async {
      final DateTime now = _clock.now();
      final List<OutboxData> candidates = await selectBatch(now: now);
      if (candidates.isEmpty) return const <OutboxData>[];

      final List<int> seqs = candidates
          .map((OutboxData r) => r.seq)
          .toList(growable: false);
      final DateTime lease = now.add(leaseDuration);
      final String token = Ids.newId();
      final int claimed =
          await (_db.update(_db.outbox)..where(
                (Outbox o) => o.seq.isIn(seqs) & o.status.equals(OutboxStatus.pending),
              ))
              .write(
                OutboxCompanion(
                  status: const Value(OutboxStatus.syncing),
                  leaseUntil: Value<DateTime?>(lease),
                  claimToken: Value<String?>(token),
                ),
              );
      if (claimed == 0) return const <OutboxData>[];

      return (_db.select(_db.outbox)
            ..where(
              (Outbox o) =>
                  o.seq.isIn(seqs) &
                  o.status.equals(OutboxStatus.syncing) &
                  o.claimToken.equals(token),
            )
            ..orderBy(<OrderClauseGenerator<Outbox>>[
              (Outbox o) => OrderingTerm.asc(o.seq),
            ]))
          .get();
    });
  }

  /// Sélectionne le prochain lot : préfixe contigu `pending` et dû, par clé.
  ///
  /// Les trois règles, dans l'ordre où elles s'appliquent :
  ///
  /// * la **tête** d'une clé : l'opération ouverte de plus petit `seq` : doit
  ///   être `pending` et due. Si elle est `conflict` ou `failed`, la clé est
  ///   empoisonnée et on l'ignore entièrement ; si elle est `syncing`, un autre
  ///   envoi la porte déjà ;
  /// * on prend ensuite le **préfixe contigu** d'opérations `pending` et dues.
  ///   Contigu : à la première opération non éligible, on s'arrête, même si les
  ///   suivantes le seraient. C'est ce qui rend l'ordre structurel ;
  /// * on s'arrête à [maxBatchOps] opérations, [maxBatchBytes] octets ou
  ///   [maxBatchGroups] clés de dépendance.
  ///
  /// ═══ L'HOMOGÉNÉITÉ DE TRANSPORT A DISPARU ═══
  ///
  /// Un lot ne pouvait contenir QUE des tentatives d'appel, ou AUCUNE : les
  /// deux familles empruntaient deux méthodes d'envoi, [ApiPort.push] typée et
  /// une variante brute, et un lot mixte n'avait aucun chemin. Le client généré
  /// connaît désormais `call_attempt` et porte `prospectId`, `outcome`,
  /// `method` et `comment` : il n'y a plus qu'un transport, donc plus rien à
  /// séparer. Un commercial qui saisit un prospect puis rappelle quelqu'un vide
  /// maintenant les deux en un aller-retour au lieu de deux.
  Future<List<OutboxData>> selectBatch({DateTime? now}) async {
    final DateTime at = now ?? _clock.now();

    // `claimableOutbox` écarte les chaînes empoisonnées **en SQL**. La lecture
    // précédente prenait « les 2000 premières lignes ouvertes » puis filtrait en
    // Dart : un échec de lot terminal marque 200 lignes d'un coup, si bien que
    // dix lots refusés suffisaient à saturer la fenêtre de lecture avec du
    // travail mort et à rendre invisible tout ce qui attendait derrière.
    //
    // Le tri est par `seq` et jamais par identifiant : la dérive d'horloge entre
    // appareils rend l'ordre d'un UUID v7 inter-appareils dénué de sens
    // (ADR 0001 §1).
    final List<OutboxData> open = await _db.claimableOutbox(maxRows: 2000).get();

    final Map<String, List<OutboxData>> byKey = <String, List<OutboxData>>{};
    for (final OutboxData row in open) {
      // Une opération sans clé est sa propre partition : elle ne dépend de rien
      // et rien ne dépend d'elle.
      byKey
          .putIfAbsent(row.dependencyKey ?? 'op:${row.id}', () => <OutboxData>[])
          .add(row);
    }

    final List<OutboxData> batch = <OutboxData>[];
    int bytes = 0;
    // Les groupes sont comptés **avec la règle du serveur**, pas avec la nôtre.
    final Set<String> serverGroups = <String>{};

    // Entités déjà représentées dans ce lot. Voir la règle « une écriture par
    // entité et par lot » ci-dessous.
    final Set<String> entitiesInBatch = <String>{};

    for (final List<OutboxData> chain in byKey.values) {
      final OutboxData head = chain.first;
      if (head.status != OutboxStatus.pending) continue;
      if (head.nextAttemptAt.isAfter(at)) continue;

      for (final OutboxData row in chain) {
        if (row.status != OutboxStatus.pending) break;
        if (row.nextAttemptAt.isAfter(at)) break;

        // ═══ UNE SEULE ÉCRITURE PAR ENTITÉ ET PAR LOT ═══
        //
        // `baseRev` est figé à la mise en file : deux modifications hors ligne
        // de la même fiche portent toutes deux la révision `R`. Dans un même
        // lot, la première fait passer le serveur à `R+1` et la seconde revient
        // en `REV_CONFLICT` sans qu'aucun autre appareil ne soit intervenu, ce
        // qui empoisonne la clé entière.
        //
        // On a d'abord retiré `baseRev` de la seconde. C'était FAUX, et le prix
        // était une perte silencieuse : le serveur POURSUIT son groupe après un
        // refus par révision (`runGroup`, `sync.service.ts`), si bien qu'une
        // seconde opération sans garde s'appliquait en écriture
        // inconditionnelle par-dessus le changement d'un autre appareil, celui
        // que le refus de la première venait pourtant de signaler.
        //
        // Lui faire opposer `R+1`, la révision que la première VA produire, ne
        // suffit pas non plus : si l'autre appareil a fait exactement une
        // modification, le serveur est lui aussi à `R+1` et la garde laisse
        // passer. Prédire une révision, c'est ne plus rien garder.
        //
        // On coupe donc la chaîne. La seconde écriture part au tour suivant de
        // la même vidange, avec le `baseRev` que le serveur vient RÉELLEMENT
        // d'attribuer ([_rebaseFollowers]) : une garde constatée, jamais
        // devinée. Et si la première est refusée, la clé est empoisonnée et la
        // seconde ne part pas du tout : la chaîne s'interrompt, ce qui est
        // exactement ce qu'on veut.
        //
        // Le coût est un aller-retour de plus dans le cas, rare, où la même
        // fiche est modifiée deux fois entre deux synchronisations. Les
        // prospects d'un représentant sont des entités DISTINCTES : ils
        // continuent de partir tous ensemble.
        final String entity = '${row.entityType}:${row.entityId}';
        if (entitiesInBatch.contains(entity)) break;

        final String group = serverGroupKey(row);
        if (batch.isNotEmpty &&
            !serverGroups.contains(group) &&
            serverGroups.length >= maxBatchGroups) {
          return batch;
        }

        final int size = row.payload.length + 256;
        if (batch.isNotEmpty &&
            (batch.length >= maxBatchOps || bytes + size > maxBatchBytes)) {
          return batch;
        }
        serverGroups.add(group);
        entitiesInBatch.add(entity);
        batch.add(row);
        bytes += size;
      }
    }
    return batch;
  }

  /// La clé de groupe **telle que le serveur la calcule**, pas telle que le
  /// client partitionne sa file.
  ///
  /// Les deux ne coïncident pas, et c'est un piège coûteux :
  /// `dependencyKeyOf` (apps/api, `modules/sync/dto.ts`) lit
  /// `operation.data?.representantId`, or un `delete` de prospect part **sans
  /// corps** : le serveur le classe donc en `prospect:<id>`, groupe à lui tout
  /// seul. Le client, lui, rangeait toutes les suppressions d'un même
  /// représentant sous une seule clé et n'en comptait qu'une.
  ///
  /// Conséquence observée : vingt-six prospects supprimés sous un même
  /// représentant passaient le plafond côté client, arrivaient au serveur en
  /// vingt-six groupes, étaient refusés **en bloc en 400**
  /// (`SYNC_MAX_DEPENDENCY_GROUPS`), donc classés terminaux, donc tout le lot
  /// partait en `failed`. Une purge de fin de journée condamnait la journée.
  ///
  /// On compte donc avec la règle du serveur. Envoyer `representantId` dans le
  /// corps d'un `delete` aurait été l'autre issue, mais le contrat de push
  /// n'admet pas de corps sur une suppression.
  static String serverGroupKey(OutboxData row) {
    if (row.entityType == 'representant') return 'representant:${row.entityId}';
    final Object? decoded = _tryDecode(row.payload);
    final Map<String, Object?>? data = decoded is Map
        ? decoded.cast<String, Object?>()
        : null;
    if (row.entityType == callAttemptEntity) {
      final Object? prospectId = data?['prospectId'];
      return 'prospect:${prospectId is String ? prospectId : row.entityId}';
    }
    final Object? parent = data?['representantId'];
    return parent is String && parent.isNotEmpty
        ? 'representant:$parent'
        : 'prospect:${row.entityId}';
  }

  static Object? _tryDecode(String payload) {
    try {
      return jsonDecode(payload);
    } on FormatException {
      return null;
    }
  }

  /// Réhydrate les payloads et pose le bail.
  ///
  /// Le payload est stocké en **JSON brut**, pas en objet typé sérialisé. Une
  /// opération peut rester en file à travers une mise à jour de l'app : un
  /// graphe d'objets typé deviendrait indécodable au premier champ renommé,
  /// alors qu'un JSON se relit toujours : quitte à échouer proprement.
  ///
  /// Si `fromJson` lève, l'opération part en `failed` avec
  /// [ClientErrorCodes.payloadSchemaMismatch] et remonte dans « À corriger ».
  /// **C'est le point du dispositif** : un échec visible et réparable, jamais une
  /// exception non rattrapée dans un isolat de fond, où personne ne la verrait.
  Future<_PreparedBatch> _prepare(List<OutboxData> rows) async {
    final List<SyncOperationDto> operations = <SyncOperationDto>[];
    final List<OutboxData> accepted = <OutboxData>[];
    final List<OutboxData> undecodable = <OutboxData>[];

    for (final OutboxData row in rows) {
      try {
        operations.add(_toOperation(row));
        accepted.add(row);
      } on Object catch (e) {
        undecodable.add(row);
        await _markFailed(
          row,
          ClientErrorCodes.payloadSchemaMismatch,
          'Cette saisie a été enregistrée par une version antérieure de '
          'l\'application et n\'est plus lisible. ($e)',
        );
      }
    }
    if (undecodable.isNotEmpty && accepted.isEmpty) {
      return _PreparedBatch(
        batchId: Ids.newId(),
        rows: const <OutboxData>[],
        operations: const <SyncOperationDto>[],
      );
    }

    final String batchId = _stableBatchId(accepted);

    // BAIL COMMITÉ AVANT LA REQUÊTE : il l'est déjà, [claimBatch] l'a posé dans
    // la transaction de sélection. Il ne reste ici que la clé d'idempotence, qui
    // dépend de la composition FINALE du lot : elle ne pouvait pas être connue
    // avant le décodage, puisque les lignes indécodables viennent d'en sortir.
    // Fenêtrée sur le jeton, comme toutes les écritures d'après-réservation :
    // une ligne dont le bail a expiré et qui a été reprise par un autre isolat
    // ne doit pas se voir coller NOTRE clé d'idempotence, sans quoi son
    // prochain envoi rejouerait une clé sous un contenu qui n'est pas le sien.
    //
    // Une transaction et non deux cents écritures nues : chaque `UPDATE` hors
    // transaction est une transaction implicite, donc une synchronisation de
    // journal, et un lot plein en aligne deux cents sur le stockage lent d'un
    // téléphone d'entrée de gamme.
    await _db.transaction(() async {
      for (final OutboxData row in accepted) {
        await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
          OutboxCompanion(batchId: Value<String?>(batchId)),
        );
      }
    });

    return _PreparedBatch(batchId: batchId, rows: accepted, operations: operations);
  }

  /// La clé d'idempotence du lot, **stable d'une tentative à l'autre**.
  ///
  /// `Idempotency-Key` ne sert à rien s'il change à chaque envoi : le cache de
  /// rejeu de `sync_batches` est indexé dessus, et un identifiant neuf le rend
  /// systématiquement froid. C'est exactement le cas où il devait servir : la
  /// réponse s'est perdue au retour, le lot est déjà appliqué côté serveur, et
  /// le rejeu devrait rendre la réponse mémorisée au lieu de refaire le travail.
  ///
  /// On réutilise donc l'identifiant déjà posé sur les lignes **quand elles le
  /// partagent toutes**. Dès que la composition du lot change (une ligne de
  /// plus, une ligne partie en `failed`), la condition tombe et on en tire un
  /// neuf : rejouer une clé sous un contenu différent serait pire que de ne pas
  /// la rejouer.
  static String _stableBatchId(List<OutboxData> rows) {
    final String? first = rows.first.batchId;
    if (first == null || first.isEmpty) return Ids.newId();
    for (final OutboxData row in rows) {
      if (row.batchId != first) return Ids.newId();
    }
    return first;
  }

  /// Le vocabulaire d'entité du serveur, sans repli silencieux.
  ///
  /// ═══ POURQUOI CE `switch` LÈVE AU LIEU DE RETOMBER SUR `prospect` ═══
  ///
  /// Il s'écrivait `entityType == 'representant' ? representant : prospect`.
  /// Tant que seules deux familles passaient par ici, le repli était juste par
  /// accident. Il ne l'est plus : une tentative d'appel qui traverserait ce
  /// ternaire serait étiquetée `prospect` et le serveur appliquerait un appel
  /// téléphonique à la fiche d'un prospect. Un type inconnu doit donc lever, et
  /// la ligne partir en « À corriger », plutôt que d'être appliquée de travers.
  static SyncEntity _entityOf(String entityType) => switch (entityType) {
    'representant' => SyncEntity.representant,
    'prospect' => SyncEntity.prospect,
    callAttemptEntity => SyncEntity.callAttempt,
    _ => throw FormatException('entité inconnue', entityType),
  };

  /// Les champs qu'une tentative d'appel doit porter pour que le serveur
  /// l'accepte.
  ///
  /// ═══ CETTE GARDE VIENT DU CHEMIN BRUT, ET ELLE RESTE ═══
  ///
  /// `SyncEntityDataDto` déclare tous ses champs facultatifs : `fromJson` ne
  /// lève sur AUCUN manque. Une tentative amputée de son `outcome` produirait
  /// donc un `data` accepté ici et refusé là-bas en `CALL_ATTEMPT_INCOMPLETE`,
  /// trois semaines après l'appel, quand plus personne ne se souvient de ce qui
  /// a été dit. On vérifie ici, et l'absence fait partir la ligne en `failed`
  /// avec [ClientErrorCodes.payloadSchemaMismatch] : visible dans « À
  /// corriger », corrigeable.
  ///
  /// Les deux énumérations sont vérifiées pour la même raison, plus grave
  /// encore : le client est généré avec `enumUnknownDefaultCase: true`, donc une
  /// valeur qu'il ne connaît pas devient `unknownDefaultOpenApi` et repart sur
  /// le fil en `unknown_default_open_api`. Le chemin brut recopiait la chaîne
  /// telle quelle ; sans cette garde, la bascule vers le chemin typé
  /// transformerait un `outcome` inconnu en issue bidon **silencieusement**, et
  /// la tentative serait comptée pour ce qu'elle n'est pas.
  static void _assertCallAttemptComplete(Map<String, dynamic> decoded, String payload) {
    for (final String field in const <String>[
      'prospectId',
      'outcome',
      'clientCreatedAt',
    ]) {
      if (decoded[field] is! String) {
        throw FormatException('tentative d\'appel sans $field', payload);
      }
    }
    if (!CallOutcomes.all.contains(decoded['outcome'])) {
      throw FormatException('issue d\'appel inconnue', payload);
    }
    final Object? method = decoded['method'];
    if (method != null && !EnrollmentMethods.all.contains(method)) {
      throw FormatException('méthode d\'adhésion inconnue', payload);
    }
  }

  /// Les trois champs de [SyncEntityDataDto] qui sont des énumérations, avec le
  /// vocabulaire que CE build connaît.
  ///
  /// Les vocabulaires sont **dérivés des énumérations générées**, jamais
  /// recopiés : recopiés, ils se figeraient à la première régénération du client
  /// et refuseraient une valeur que l'application sait pourtant envoyer. Le
  /// membre `unknownDefaultOpenApi` en est exclu, puisque c'est précisément
  /// celui qu'on refuse d'émettre.
  static final Map<String, List<String>> _enumVocabulary = <String, List<String>>{
    'statut': ProspectStatut.values
        .where((ProspectStatut s) => s != ProspectStatut.unknownDefaultOpenApi)
        .map((ProspectStatut s) => s.value)
        .toList(growable: false),
    'outcome': CallOutcomes.all,
    'method': EnrollmentMethods.all,
  };

  /// Refuse localement un payload portant une valeur d'énumération que ce build
  /// ne comprend pas, **au lieu de la transformer en valeur bidon sur le fil**.
  ///
  /// ═══ L'ALLER-RETOUR QUI CORROMPAIT UNE SAISIE VALIDE ═══
  ///
  /// Le client est généré avec `enumUnknownDefaultCase: true` : une valeur
  /// inconnue devient `unknownDefaultOpenApi`, dont la chaîne du contrat est
  /// `unknown_default_open_api`. C'est ce qu'il faut EN LECTURE, et c'est
  /// exactement ce qu'il ne faut pas en écriture.
  ///
  /// Le chemin complet existe et il est court : le serveur ajoute un
  /// `ProspectStatut`, un pull le ramène, `p.statut.value` écrit
  /// `unknown_default_open_api` dans `prospects.statut`, l'utilisateur modifie
  /// la fiche, `updateProspect` recopie ce statut dans le payload, et
  /// `SyncEntityDataDto.fromJson` le relit en `unknownDefaultOpenApi`. Le lot
  /// partait alors avec un statut que le serveur refuse en 400, donc classé
  /// terminal, donc **toutes** les opérations du lot en `failed` : une fiche
  /// parfaitement valide condamnée, et ses voisines avec elle.
  ///
  /// Une ligne refusée ici part en `failed` avec
  /// [ClientErrorCodes.payloadSchemaMismatch], seule, et devient visible dans
  /// « À corriger ». Le remède réel est la mise à jour de l'application, et le
  /// message le dit.
  static void _assertNoUnknownEnum(Map<String, dynamic> decoded, String payload) {
    for (final MapEntry<String, List<String>> field in _enumVocabulary.entries) {
      final Object? value = decoded[field.key];
      if (value == null) continue;
      if (value is! String || !field.value.contains(value)) {
        throw FormatException(
          'valeur « $value » inconnue pour le champ ${field.key} : '
          'cette version de l\'application ne sait pas l\'envoyer',
          payload,
        );
      }
    }
  }

  /// Traduit une ligne d'outbox en opération de contrat.
  ///
  /// ═══ `baseRev` PART TEL QUEL, TOUJOURS ═══
  ///
  /// Il n'y a plus de cas où l'on retire ou l'on devine la garde de révision.
  /// C'est [selectBatch] qui garantit qu'une entité n'apparaît qu'une fois par
  /// lot, donc que le `baseRev` figé à la mise en file est encore celui que le
  /// serveur porte au moment où l'opération arrive. La seconde écriture d'une
  /// même fiche attend le tour suivant et se fait recaler par
  /// [_rebaseFollowers] sur la révision réellement attribuée.
  ///
  /// Un `baseRev` nul veut dire « écriture aveugle assumée » : l'entité n'a
  /// jamais vu le serveur. `apps/api` traite son absence comme une écriture
  /// inconditionnelle (`assertRev`).
  SyncOperationDto _toOperation(OutboxData row) {
    final Object? decoded = jsonDecode(row.payload);
    if (decoded is! Map<String, dynamic>) {
      throw FormatException('payload non objet', row.payload);
    }
    if (row.entityType == callAttemptEntity) {
      _assertCallAttemptComplete(decoded, row.payload);
    }
    _assertNoUnknownEnum(decoded, row.payload);
    return SyncOperationDto(
      opId: row.id,
      seq: row.seq,
      entity: _entityOf(row.entityType),
      op: switch (row.op) {
        'create' => SyncOp.create,
        'update' => SyncOp.update,
        'delete' => SyncOp.delete,
        _ => throw FormatException('opération inconnue', row.op),
      },
      entityId: row.entityId,
      clientUpdatedAt: row.createdAt,
      baseRev: row.baseRev,
      // `delete` n'a pas de corps : le serveur n'a besoin que de l'identifiant,
      // et lui envoyer un `data` vide ferait échouer la validation de champs
      // requis sur certaines routes.
      data: row.op == 'delete' ? null : SyncEntityDataDto.fromJson(decoded),
    );
  }

  /// Envoie le lot et applique les verdicts.
  ///
  /// Renvoie le nombre d'opérations **réellement acquittées** et un drapeau de
  /// poursuite : `false` s'il faut arrêter la vidange (session morte, lien mort,
  /// throttling, lot en cours côté serveur).
  Future<_SendReport> _sendBatch(_PreparedBatch prepared) async {
    final PushResult result;
    try {
      result = await _api.push(
        batchId: prepared.batchId,
        payloadVersion: payloadVersion,
        operations: prepared.operations,
      );
    } on ApiException catch (e) {
      await _handleBatchFailure(prepared.rows, e);
      // Seul un échec vraiment transitoire justifie d'enchaîner : sur une
      // session morte ou un throttling, insister aggrave la situation. Et rien
      // n'a été acquitté : aucune opération n'a reçu de verdict.
      return const _SendReport(acknowledged: 0, keepGoing: false);
    }

    final Map<String, SyncOperationResultDto> byOpId = <String, SyncOperationResultDto>{
      for (final SyncOperationResultDto r in result.results) r.opId: r,
    };

    int acknowledged = 0;
    for (final OutboxData row in prepared.rows) {
      final SyncOperationResultDto? verdict = byOpId[row.id];
      if (verdict == null) {
        // Le serveur n'a rien dit de cette opération : elle n'est pas
        // acquittée, et elle ne se compte pas.
        await _requeue(row, incrementAttempt: true, code: ClientErrorCodes.noResult);
        continue;
      }
      acknowledged++;
      await _applyVerdict(row, verdict);
    }
    return _SendReport(acknowledged: acknowledged, keepGoing: true);
  }

  /// Les codes qui décrivent un ARBITRAGE, pas un refus définitif.
  ///
  /// Ils servent à relire un verdict `duplicate` rejoué : le serveur mémorise le
  /// verdict de la première tentative, et s'il porte l'un de ces codes, la
  /// première tentative avait été refusée pour conflit.
  static const Set<String> _conflictCodes = <String>{
    ServerErrorCodes.revConflict,
    ServerErrorCodes.representantPhoneConflict,
    ServerErrorCodes.prospectPhoneConflict,
    ServerErrorCodes.entityIdOwnedByAnotherUser,
    ServerErrorCodes.representantOwnedByAnotherUser,
    // `PHASE2_ALREADY_COMPLETED` manquait. C'est un arbitrage : deux commerciaux
    // ont appelé le même numéro, ou notre miroir optimiste a devancé une
    // décision serveur contraire. Rejoué en `duplicate`, il tombait dans la
    // branche `failed` et envoyait le commercial « corriger » une tentative
    // d'appel parfaitement valide, qu'aucune correction ne pouvait sauver.
    ServerErrorCodes.phase2AlreadyCompleted,
  };

  /// Codes qui décrivent une DÉPENDANCE non résolue, jamais un refus.
  ///
  /// Ils accompagnent `skipped_dependency_failed`. Rendus sous un statut
  /// `duplicate` (verdict mémorisé rejoué), ils tombaient dans la branche
  /// `failed` : l'opération devenait « à corriger » alors qu'elle n'a rien à se
  /// reprocher et que sa réparation consiste à réparer le PARENT. Ils repartent
  /// donc par le chemin bloqué, avec son plancher et son plafond.
  static const Set<String> _blockedCodes = <String>{
    ServerErrorCodes.parentRepresentantFailed,
    ServerErrorCodes.representantNotFound,
    ServerErrorCodes.groupTransactionFailed,
  };

  Future<void> _applyVerdict(OutboxData row, SyncOperationResultDto verdict) async {
    switch (verdict.status) {
      case SyncOpStatus.applied:
        await _markDone(row, verdict);
      case SyncOpStatus.duplicate:
        // ═══ UN `duplicate` EST UN REJEU, PAS UN SUCCÈS ═══
        //
        // Le serveur ne dit pas « c'est écrit », il dit « j'ai déjà vu cet
        // `opId` et voici ce que j'avais répondu ». Si ce verdict mémorisé était
        // un REFUS, le traiter comme un succès efface l'écriture en silence :
        // le commercial ouvre « À corriger », tape « Réessayer », et sa fiche
        // disparaît de l'écran sans être jamais partie.
        //
        // On relit donc l'erreur portée par le verdict, et c'est elle qui
        // décide. Un `duplicate` nu (ni code, ni message) est le seul cas où la
        // première tentative avait bel et bien abouti.
        await _applyReplayed(row, verdict);
      case SyncOpStatus.conflict:
        await _handleConflict(row, verdict);
      case SyncOpStatus.invalid:
        await _markFailed(
          row,
          verdict.errorCode ?? 'INVALID',
          verdict.error ?? 'Le serveur a refusé cette saisie.',
        );
      case SyncOpStatus.skippedDependencyFailed:
      case SyncOpStatus.unknownDefaultOpenApi:
        // Le parent n'est pas passé. Réessayer *cette* opération ne sert à rien
        // tant que le parent n'est pas résolu : et la sélection l'empêchera
        // toute seule, puisque la tête de la clé est maintenant en conflit. On
        // la remet donc en file **sans compter de tentative serveur** : la faute
        // n'est pas la sienne, et lui brûler ses huit essais la tuerait pour un
        // problème qui n'est pas le sien.
        //
        // Mais on compte un rejeu BLOQUÉ, avec plancher et plafond : sans ça,
        // `attempts` restait à zéro, `nextDelay(0)` rendait zéro, et l'opération
        // repartait cinquante fois par vidange sans jamais devenir visible.
        await _requeueBlocked(
          row,
          code: verdict.errorCode ?? ServerErrorCodes.parentRepresentantFailed,
          message: verdict.error,
        );
    }
  }

  /// Applique un verdict mémorisé rendu sous le statut `duplicate`.
  Future<void> _applyReplayed(OutboxData row, SyncOperationResultDto verdict) async {
    final String? code = verdict.errorCode;
    if (code == null && verdict.error == null) {
      await _markDone(row, verdict);
      return;
    }
    if (code != null && _conflictCodes.contains(code)) {
      await _handleConflict(row, verdict);
      return;
    }
    if (code != null && _blockedCodes.contains(code)) {
      await _requeueBlocked(row, code: code, message: verdict.error);
      return;
    }
    await _markFailed(
      row,
      code ?? 'INVALID',
      verdict.error ?? 'Le serveur avait déjà refusé cette saisie.',
    );
  }

  Future<void> _markDone(OutboxData row, SyncOperationResultDto verdict) async {
    final String? serverId = verdict.entityId;
    // Remappage d'identifiant : le serveur a réuni deux fiches sur le téléphone.
    // C'est le SEUL remappage du système (ADR 0001 §1).
    if (serverId != null &&
        serverId != row.entityId &&
        row.entityType == 'representant') {
      await remapEntityId(row.entityId, serverId);
    }
    await _db.transaction(() async {
      final int closed =
          await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
            OutboxCompanion(
              status: const Value(OutboxStatus.done),
              leaseUntil: const Value<DateTime?>(null),
              claimToken: const Value<String?>(null),
              lastErrorCode: const Value<String?>(null),
              lastErrorMsg: const Value<String?>(null),
            ),
          );
      // La ligne ne nous appartient plus : un autre isolat l'a reprise et l'a
      // peut-être déjà renvoyée. Estampiller la fiche métier maintenant
      // écrirait une révision périmée par-dessus la sienne.
      if (closed == 0) return;
      await _stampServerState(
        op: row.op,
        entityType: row.entityType,
        entityId: serverId ?? row.entityId,
        rev: verdict.rev?.toInt(),
        serverUpdatedAt: verdict.serverUpdatedAt,
      );
      await _rebaseFollowers(
        entityType: row.entityType,
        entityId: serverId ?? row.entityId,
        afterSeq: row.seq,
        rev: verdict.rev?.toInt(),
      );
      await _unblockFollowers(row.seq);
    });
  }

  /// Rend leur budget aux opérations qui attendaient derrière celle-ci.
  ///
  /// ═══ `blockedAttempts` MESURAIT UNE VIE ENTIÈRE, PAS UN BLOCAGE ═══
  ///
  /// Le compteur n'était jamais remis à zéro par un envoi réussi : seuls
  /// `WriteRepository.retryOperation` et `_amendInPlace`, c'est-à-dire deux
  /// gestes de l'UTILISATEUR, le rouvraient. Or il compte des rejeux dont
  /// l'opération n'est pas responsable, et il a un plafond de
  /// [maxBlockedAttempts] au terme duquel la ligne part en `failed`.
  ///
  /// Deux épisodes de blocage sans rapport, séparés de plusieurs jours,
  /// partageaient donc le même budget : un parent réparé depuis longtemps
  /// laissait derrière lui des enfants à moitié condamnés, et quelques
  /// `GROUP_TRANSACTION_FAILED` intermittents : un code transitoire, mais classé
  /// bloquant : suffisaient à les achever. L'utilisateur lisait alors dans
  /// « À corriger » qu'il devait réparer une fiche parente qui, elle, allait
  /// parfaitement bien.
  ///
  /// **L'acquittement de la tête est précisément l'événement qui clôt
  /// l'épisode.** Ce sont ses échecs à elle qui ont fait monter le compteur de
  /// ses suiveurs ; son succès dit que la cause a disparu. On repart donc de
  /// zéro, pour eux seulement, et sans toucher à `attempts`, qui compte, lui,
  /// des fautes que l'opération porte vraiment.
  ///
  /// La clé est **relue** au lieu d'être prise sur [afterSeq] : un remappage
  /// d'identifiant vient peut-être de la réécrire, et viser l'ancienne ne
  /// toucherait plus personne.
  Future<void> _unblockFollowers(int afterSeq) async {
    final OutboxData? head = await (_db.select(
      _db.outbox,
    )..where((Outbox o) => o.seq.equals(afterSeq))).getSingleOrNull();
    final String? key = head?.dependencyKey;
    if (key == null) return;
    await (_db.update(_db.outbox)..where(
          (Outbox o) =>
              o.dependencyKey.equals(key) &
              o.seq.isBiggerThanValue(afterSeq) &
              o.status.isIn(OutboxStatus.open) &
              o.blockedAttempts.isBiggerThanValue(0),
        ))
        .write(const OutboxCompanion(blockedAttempts: Value<int>(0)));
  }

  /// Recale le `baseRev` des opérations qui suivent, sur la même entité.
  ///
  /// ## Le conflit qu'on s'infligeait à soi-même
  ///
  /// `baseRev` est figé à la mise en file. Deux modifications hors ligne de la
  /// même fiche déjà synchronisée portent donc TOUTES DEUX la révision `R` :
  /// la première passe (le serveur écrit `R+1`), la seconde arrive avec `R`, et
  /// le serveur répond `REV_CONFLICT`. Personne n'a modifié quoi que ce soit
  /// ailleurs : c'est l'appareil qui se contredit lui-même.
  ///
  /// Le coût ne s'arrête pas à l'opération : le `conflict` devient la tête de sa
  /// `dependencyKey`, donc la clé entière est empoisonnée et **tous les
  /// prospects de ce représentant cessent de partir**, jusqu'à ce que
  /// l'utilisateur trouve l'écran « À corriger » et comprenne quoi faire d'un
  /// message qui parle d'une modification concurrente qui n'a jamais eu lieu.
  ///
  /// On réécrit donc `baseRev` avec la révision que le serveur vient
  /// d'attribuer. Uniquement là où il était **déjà renseigné** : un `baseRev`
  /// nul veut dire « écriture aveugle assumée » (l'entité n'avait jamais vu le
  /// serveur), et le renseigner après coup transformerait une écriture qui
  /// devait passer en écriture conditionnelle qui peut échouer.
  Future<void> _rebaseFollowers({
    required String entityType,
    required String entityId,
    required int afterSeq,
    required int? rev,
  }) async {
    if (rev == null) return;
    if (entityType == callAttemptEntity) return;
    await (_db.update(_db.outbox)..where(
          (Outbox o) =>
              o.entityType.equals(entityType) &
              o.entityId.equals(entityId) &
              o.seq.isBiggerThanValue(afterSeq) &
              o.status.isIn(OutboxStatus.open) &
              o.baseRev.isNotNull(),
        ))
        .write(OutboxCompanion(baseRev: Value<int?>(rev)));
  }

  /// Reporte sur la fiche métier ce que le serveur vient de trancher.
  ///
  /// ═══ UNE ÉCRITURE ACQUITTÉE ANNULE UNE SUPPRESSION REÇUE ENTRE-TEMPS ═══
  ///
  /// [op] n'est pas décoratif. Le pull peut tamponner `deleted_at` sur un
  /// prospect pendant qu'une écriture locale le concernant est encore en vol :
  /// la suppression serveur est arrivée d'abord, l'acquittement ensuite. La
  /// fiche disparaissait alors de l'écran alors que la modification de
  /// l'utilisateur venait, elle, d'être acceptée par le serveur : le commercial
  /// voyait sa saisie partir et sa fiche s'évaporer, sans rien pour la
  /// retrouver.
  ///
  /// Le serveur vient de dire que cette entité existe et porte la révision
  /// qu'il rend : on efface donc la marque de suppression. Sauf, évidemment,
  /// quand l'opération acquittée EST la suppression : là, la marque est le
  /// résultat attendu.
  Future<void> _stampServerState({
    required String op,
    required String entityType,
    required String entityId,
    int? rev,
    DateTime? serverUpdatedAt,
  }) async {
    final bool clearDeletion = op != 'delete';
    if (rev == null && serverUpdatedAt == null && !clearDeletion) return;
    // Une tentative d'appel n'a rien à estampiller : la ligne locale est un
    // journal immuable, et la `rev` que le serveur renvoie est celle du
    // PROSPECT, pas de la tentative. L'écrire sur `phase2_directory` serait
    // tentant et faux : elle y arriverait sans le statut correspondant, et le
    // pull suivant, voyant une `rev` déjà à jour, ne corrigerait plus rien.
    if (entityType == callAttemptEntity) return;
    if (entityType == 'representant') {
      await (_db.update(
        _db.representants,
      )..where((Representants t) => t.id.equals(entityId))).write(
        RepresentantsCompanion(
          rev: rev == null ? const Value.absent() : Value<int>(rev),
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: clearDeletion ? const Value<DateTime?>(null) : const Value.absent(),
        ),
      );
    } else {
      await (_db.update(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(entityId))).write(
        ProspectsCompanion(
          rev: rev == null ? const Value.absent() : Value<int>(rev),
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: clearDeletion ? const Value<DateTime?>(null) : const Value.absent(),
        ),
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Conflits
  // ───────────────────────────────────────────────────────────────────────────

  /// Un 409 sur le téléphone d'un représentant.
  ///
  /// **Si la fiche existante est la mienne, on fusionne sans rien demander.** Le
  /// commercial a ressaisi un représentant qu'il avait déjà enregistré depuis un
  /// autre appareil, ou avant une réinstallation : lui poser la question serait
  /// lui demander d'arbitrer un problème qu'il n'a pas et dont il ne peut rien
  /// savoir. On remappe l'identifiant local vers celui du serveur et ses
  /// prospects suivent.
  ///
  /// **Si elle appartient à un autre commercial, on ne fusionne JAMAIS
  /// automatiquement.** L'attribution d'un représentant détermine la commission.
  /// Rattacher en silence les prospects d'Awa à Moussa, ou l'inverse, se
  /// traduirait par une paie fausse à la fin du mois : et personne ne remonterait
  /// jusqu'à une fusion automatique faite six semaines plus tôt. L'opération
  /// passe en `conflict` et l'écran « À corriger » nomme le propriétaire.
  Future<void> _handleConflict(OutboxData row, SyncOperationResultDto verdict) async {
    final bool mergeable =
        verdict.errorCode == ServerErrorCodes.representantPhoneConflict &&
        row.entityType == 'representant' &&
        row.op == 'create';

    if (mergeable) {
      final String? resolved = await _autoMergeRepresentant(row);
      if (resolved != null) {
        await remapEntityId(row.entityId, resolved);
        await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
          OutboxCompanion(
            status: const Value(OutboxStatus.done),
            leaseUntil: const Value<DateTime?>(null),
            claimToken: const Value<String?>(null),
            lastErrorCode: const Value<String?>(null),
            lastErrorMsg: const Value<String?>(null),
          ),
        );
        return;
      }
    }

    await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.conflict),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(verdict.errorCode),
        lastErrorMsg: Value<String?>(verdict.error),
      ),
    );
  }

  /// Renvoie l'identifiant serveur si la fusion automatique est légitime.
  Future<String?> _autoMergeRepresentant(OutboxData row) async {
    final String? me = await _tokens.readUserId();
    if (me == null) return null;

    final String? phone = _phoneOf(row.payload);
    if (phone == null) return null;

    final RepresentantLookup lookup;
    try {
      lookup = await _api.lookupRepresentantByPhone(phone);
    } on ApiException {
      // Le lookup a échoué (réseau, serveur). On ne fusionne pas à l'aveugle :
      // sans savoir à qui appartient la fiche, la fusion automatique est
      // exactement l'opération qu'il ne faut pas tenter.
      return null;
    }
    if (!lookup.found || lookup.representant == null) return null;
    if (lookup.ownedByCommercialId != me) return null;
    return lookup.representant!.id;
  }

  static String? _phoneOf(String payload) {
    try {
      final Object? decoded = jsonDecode(payload);
      if (decoded is Map && decoded['phone'] is String) {
        return decoded['phone'] as String;
      }
    } on FormatException {
      return null;
    }
    return null;
  }

  /// Réécrit un identifiant local en identifiant serveur, **en une transaction**.
  ///
  /// Cinq écritures qui doivent être atomiques ; interrompues au milieu, elles
  /// laisseraient des prospects orphelins ou des opérations pointant vers un
  /// identifiant qui n'existe plus :
  ///
  /// 1. l'identifiant du représentant : `ON UPDATE CASCADE` fait suivre tous les
  ///    prospects rattachés en une seule instruction, au lieu d'une boucle de
  ///    rattrapage manuelle ;
  /// 2. `outbox.entityId` des opérations visant ce représentant ;
  /// 3. `outbox.dependencyKey`, sans quoi les prospects se retrouveraient dans
  ///    une partition orpheline et ne partiraient jamais ;
  /// 4. le `representantId` **à l'intérieur de chaque payload en attente** : le
  ///    payload est du JSON figé, aucune cascade SQL ne l'atteint ;
  /// 5. les brouillons de formulaire en cours qui pointent vers l'ancien parent.
  ///
  /// Cas particulier traité explicitement : la fiche serveur peut **déjà** être
  /// présente localement (un pull l'a ramenée entre-temps). Renommer
  /// l'identifiant violerait alors la clé primaire ; on repointe les prospects
  /// puis on supprime le doublon local. `ON DELETE RESTRICT` impose cet ordre.
  Future<void> remapEntityId(String localId, String serverId) async {
    if (localId == serverId) return;
    await _db.transaction(() async {
      final Representant? existing = await (_db.select(
        _db.representants,
      )..where((Representants t) => t.id.equals(serverId))).getSingleOrNull();

      if (existing == null) {
        await _db.customStatement(
          'UPDATE representants SET id = ? WHERE id = ?',
          <Object?>[serverId, localId],
        );
      } else {
        await (_db.update(_db.prospects)
              ..where((Prospects t) => t.representantId.equals(localId)))
            .write(ProspectsCompanion(representantId: Value<String>(serverId)));
        await (_db.delete(
          _db.representants,
        )..where((Representants t) => t.id.equals(localId))).go();
      }

      await (_db.update(_db.outbox)..where(
            (Outbox o) =>
                o.entityType.equals('representant') & o.entityId.equals(localId),
          ))
          .write(OutboxCompanion(entityId: Value<String>(serverId)));

      await (_db.update(_db.outbox)..where((Outbox o) => o.dependencyKey.equals(localId)))
          .write(OutboxCompanion(dependencyKey: Value<String?>(serverId)));

      final List<OutboxData> open = await (_db.select(
        _db.outbox,
      )..where((Outbox o) => o.status.isIn(OutboxStatus.open))).get();
      for (final OutboxData row in open) {
        final String? rewritten = _rewriteRepresentantId(row.payload, localId, serverId);
        if (rewritten == null) continue;
        await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(row.seq))).write(
          OutboxCompanion(payload: Value<String>(rewritten)),
        );
      }

      final List<FormDraft> drafts = await _db.select(_db.formDrafts).get();
      for (final FormDraft draft in drafts) {
        final String? rewritten = _rewriteRepresentantId(
          draft.payload,
          localId,
          serverId,
        );
        final bool parentMoved = draft.parentId == localId;
        if (rewritten == null && !parentMoved) continue;
        await (_db.update(
          _db.formDrafts,
        )..where((FormDrafts t) => t.draftId.equals(draft.draftId))).write(
          FormDraftsCompanion(
            payload: rewritten == null ? const Value.absent() : Value<String>(rewritten),
            parentId: parentMoved ? Value<String?>(serverId) : const Value.absent(),
          ),
        );
      }
    });
  }

  /// Renvoie le JSON réécrit, ou `null` s'il n'y avait rien à changer.
  static String? _rewriteRepresentantId(String payload, String from, String to) {
    final Object? decoded;
    try {
      decoded = jsonDecode(payload);
    } on FormatException {
      return null;
    }
    if (decoded is! Map) return null;
    if (decoded['representantId'] != from) return null;
    return jsonEncode(<String, Object?>{
      ...decoded.cast<String, Object?>(),
      'representantId': to,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Échecs de lot
  // ───────────────────────────────────────────────────────────────────────────

  Future<void> _handleBatchFailure(List<OutboxData> rows, ApiException error) async {
    _lastPushFailure = error;
    switch (error.kind) {
      case FailureKind.idempotencyInProgress:
        // Un autre appel traite déjà exactement ce lot ; il va aboutir. On
        // repasse dans 2 s **sans compter la tentative** : ce n'est pas un
        // échec, c'est une file d'attente. Le compter ferait mourir en `failed`
        // une opération parfaitement saine au bout de huit collisions.
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: const Duration(seconds: 2),
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.sessionExpired:
        // La session est morte : aucune tentative n'aurait pu réussir, donc
        // aucune ne se compte. Les lignes repartiront telles quelles après
        // reconnexion.
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: Duration.zero,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.unreachable:
        // Le lien est mort : pas de route, plus de crédit, portail captif.
        // MÊME TRAITEMENT QUE LA SESSION EXPIRÉE, et pour la même raison :
        // aucune tentative n'aurait pu réussir, donc aucune ne se compte.
        //
        // Les huit essais de l'outbox mesurent des refus serveur. Les faire
        // consommer par du temps qui passe rendait la panne de réseau
        // indiscernable d'une saisie invalide : quatre à huit minutes sans
        // antenne, et une matinée de prospection partait en
        // `ATTEMPTS_EXHAUSTED`.
        //
        // Délai nul : c'est le déclencheur de connectivité qui ramènera la
        // vidange au retour du réseau, et la vidange s'arrête de toute façon
        // ici (`keepGoing == false`), donc aucune boucle serrée n'est possible.
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: Duration.zero,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.throttled:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: true,
            delay: error.retryAfter ?? _backoff.nextDelay(row.attempts + 1),
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.retryable:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: true,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.terminal:
        for (final OutboxData row in rows) {
          await _markFailed(row, error.code, error.message);
        }
    }
  }

  /// Remet une ligne en file. [delay] par défaut : back-off à gigue complète.
  Future<void> _requeue(
    OutboxData row, {
    required bool incrementAttempt,
    Duration? delay,
    String? code,
    String? message,
  }) async {
    final int attempts = incrementAttempt ? row.attempts + 1 : row.attempts;
    if (incrementAttempt && attempts >= maxAttempts) {
      await _markFailed(
        row,
        code ?? ClientErrorCodes.attemptsExhausted,
        message ??
            'Envoi impossible après $maxAttempts tentatives. '
                'Vérifiez la saisie ou réessayez plus tard.',
        attempts: attempts,
      );
      return;
    }
    final Duration wait = delay ?? _backoff.nextDelay(attempts);
    await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.pending),
        attempts: Value<int>(attempts),
        nextAttemptAt: Value<DateTime>(_clock.now().add(wait)),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
  }

  /// Remet en file une opération **bloquée par une autre**.
  ///
  /// Trois différences avec [_requeue], et chacune répare un symptôme observé :
  ///
  /// 1. le compteur incrémenté est `blockedAttempts` et non `attempts` : la
  ///    faute n'est pas la sienne, et lui brûler ses huit essais serveur la
  ///    tuerait pour le problème d'un voisin ;
  /// 2. le délai a un **plancher** de [blockedFloor] : `nextDelay(0)` vaut zéro,
  ///    et c'est ce zéro qui produisait cinquante réémissions par vidange ;
  /// 3. il a un **plafond** : au terme de [maxBlockedAttempts] rejeux, la ligne
  ///    passe en `failed`. Un blocage permanent doit finir par se voir dans
  ///    « À corriger », sans quoi il tourne en silence jusqu'à la
  ///    désinstallation.
  Future<void> _requeueBlocked(OutboxData row, {String? code, String? message}) async {
    final int blocked = row.blockedAttempts + 1;
    if (blocked >= maxBlockedAttempts) {
      await _markFailed(
        row,
        code ?? ServerErrorCodes.parentRepresentantFailed,
        message ?? _blockedFailureMessage(code),
        blockedAttempts: blocked,
      );
      return;
    }
    final Duration jittered = _backoff.nextDelay(blocked);
    final Duration wait = jittered < blockedFloor ? blockedFloor : jittered;
    await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.pending),
        blockedAttempts: Value<int>(blocked),
        nextAttemptAt: Value<DateTime>(_clock.now().add(wait)),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
  }

  /// Le message d'un abandon pour blocage doit nommer le VRAI blocage.
  ///
  /// Le message par défaut envoyait toujours l'utilisateur « corriger la fiche
  /// parente ». C'est juste pour `PARENT_REPRESENTANT_FAILED` et
  /// `REPRESENTANT_NOT_FOUND` ; ça ne l'est pas pour
  /// `GROUP_TRANSACTION_FAILED`, qui dit que le lot n'a pas pu être écrit côté
  /// serveur et n'accuse aucun parent. L'utilisateur partait alors chercher un
  /// défaut sur une fiche qui n'en a pas, et n'avait aucun moyen de découvrir
  /// qu'il n'y avait rien à y trouver.
  static String _blockedFailureMessage(String? code) =>
      code == ServerErrorCodes.groupTransactionFailed
      ? 'Le serveur n\'a pas pu enregistrer ce groupe de saisies. '
            'Réessayez ; si le refus persiste, signalez-le.'
      : 'Cette saisie dépend d\'une autre qui ne passe pas. '
            'Corrigez d\'abord la fiche parente.';

  Future<void> _markFailed(
    OutboxData row,
    String code,
    String? message, {
    int? attempts,
    int? blockedAttempts,
  }) async {
    await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.failed),
        attempts: attempts == null ? const Value.absent() : Value<int>(attempts),
        blockedAttempts: blockedAttempts == null
            ? const Value.absent()
            : Value<int>(blockedAttempts),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Pull
  // ───────────────────────────────────────────────────────────────────────────

  /// Curseur unique, stocké sous cette clé dans `sync_state`.
  static const String cursorKey = 'all';

  /// Tire les changements depuis le curseur et les applique en LWW par `rev`.
  ///
  /// L'écriture est un `INSERT … ON CONFLICT DO UPDATE … WHERE excluded.rev >
  /// rev`. Le `WHERE` porte tout : sans lui, une page rejouée (curseur non
  /// avancé après une coupure) réécrirait une ligne plus récente avec une
  /// version plus ancienne, et la modification de l'utilisateur disparaîtrait
  /// sans trace.
  /// **Vol unique, comme la vidange.** Deux pulls concurrents lisent le même
  /// curseur au départ ; celui qui finit en dernier réécrit un curseur PLUS
  /// ANCIEN que celui de l'autre, et le prochain cycle retélécharge des pages
  /// déjà appliquées. Sur un forfait mobile sénégalais, chaque page rejouée est
  /// payée deux fois.
  ///
  /// Le garde était absent alors que quatre déclencheurs peuvent se superposer :
  /// le minuteur de 60 s, le retour au premier plan, le bouton
  /// « Synchroniser maintenant » et le changement de connectivité. `isDraining`
  /// ne protégeait rien ici : il retombe à `false` dès la fin du push.
  Future<int> pullChanges({int maxPages = 20}) async {
    if (_pulling) return 0;
    _pulling = true;
    try {
      int applied = 0;
      String? cursor = await readCursor();

      for (int page = 0; page < maxPages; page++) {
        final PullPage result = await _api.pull(cursor: cursor, limit: 200);
        applied += await _applyPage(result);
        // On n'avance le curseur QUE s'il vaut encore ce qui a produit cette
        // page. Voir [advanceCursor] : l'isolat WorkManager et l'isolat UI
        // partent du même curseur, et le plus lent le faisait reculer.
        final bool advanced = await advanceCursor(from: cursor, to: result.nextCursor);
        cursor = result.nextCursor;
        if (!advanced || !result.hasMore) break;
      }
      return applied;
    } finally {
      _pulling = false;
    }
  }

  /// Entités dont une écriture locale attend encore son tour.
  ///
  /// Le LWW par `rev` du pull est correct entre deux serveurs, et FAUX face à
  /// une saisie locale : les modifications locales n'incrémentent pas `rev`
  /// (c'est le serveur qui l'attribue), donc une ligne tirée porte forcément une
  /// révision supérieure ou égale, et l'`ON CONFLICT DO UPDATE` l'écrase. Le
  /// commercial voyait sa correction disparaître de l'écran alors qu'elle
  /// survivait dans le payload de l'outbox : elle repartait ensuite au serveur,
  /// mais entre-temps l'app lui affichait l'ancienne valeur et il la resaisissait.
  ///
  /// Tant qu'une opération est ouverte, la vérité locale est le payload en file :
  /// on n'écrase pas, on laisse le push trancher. C'est lui qui rapportera la
  /// `rev` définitive, ou un `conflict` que l'utilisateur pourra arbitrer.
  ///
  /// ═══ POURQUOI SEULEMENT `pending` ET `syncing` ═══
  ///
  /// La garde tenait sur [OutboxStatus.open], donc aussi sur `conflict` et
  /// `failed`. Or ces deux états sont précisément ceux où **plus aucun push ne
  /// tranchera** : ils attendent une décision humaine. Le curseur, lui,
  /// avançait quand même. Une fiche en conflit voyait donc la version serveur
  /// passer dans le flux, être ignorée, et disparaître pour toujours : chaque
  /// pull ultérieur reconduisait la copie locale, et il ne restait plus rien
  /// contre quoi arbitrer le conflit. L'écran « À corriger » demandait à
  /// l'utilisateur de choisir entre sa version et une version qu'on venait de
  /// jeter.
  ///
  /// On ne garde donc que les états qu'un envoi peut encore faire avancer. Pour
  /// les deux autres, la version serveur reprend sa place dans la table métier
  /// : c'est la vérité distante, et l'utilisateur doit pouvoir la voir. **Sa
  /// version à lui n'est pas perdue pour autant** : elle vit dans le payload de
  /// l'opération, que l'écran « À corriger » décode et affiche. Les deux côtés
  /// restent visibles, ce qui est la seule façon de pouvoir choisir.
  Future<Set<String>> _entitiesWithOpenWrites(String entityType) async {
    final List<OutboxData> open =
        await (_db.select(_db.outbox)..where(
              (Outbox o) =>
                  o.entityType.equals(entityType) &
                  o.status.isIn(<String>[OutboxStatus.pending, OutboxStatus.syncing]),
            ))
            .get();
    return open.map((OutboxData o) => o.entityId).toSet();
  }

  Future<int> _applyPage(PullPage page) async {
    int count = 0;
    final Set<String> guardedRepresentants = await _entitiesWithOpenWrites(
      'representant',
    );
    final Set<String> guardedProspects = await _entitiesWithOpenWrites('prospect');
    await _db.transaction(() async {
      for (final DepartementDto d in page.changes.departements) {
        await _db
            .into(_db.departements)
            .insert(
              DepartementsCompanion.insert(
                id: d.id,
                code: d.code,
                name: d.name,
                regionId: d.regionId,
                isActive: Value<bool>(d.isActive),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(d.updatedAt),
              ),
              onConflict: DoUpdate<Departements, Departement>(
                (Departements old) => DepartementsCompanion.custom(
                  code: const CustomExpression<String>('excluded.code'),
                  name: const CustomExpression<String>('excluded.name'),
                  regionId: const CustomExpression<String>('excluded.region_id'),
                  isActive: const CustomExpression<bool>('excluded.is_active'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
              ),
            );
        count++;
      }
      // Les IEF APRÈS les départements, dans la même transaction : `iefs`
      // référence `departements`, et `PRAGMA foreign_keys = ON` refuserait une
      // IEF dont le département n'est pas encore arrivé. L'ordre des boucles
      // EST la garantie, il n'y en a pas d'autre.
      for (final IefDto i in page.changes.iefs) {
        await _db
            .into(_db.iefs)
            .insert(
              IefsCompanion.insert(
                id: i.id,
                code: i.code,
                name: i.name,
                departementId: i.departementId,
                departementName: i.departementName,
                isActive: Value<bool>(i.isActive),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(i.updatedAt),
              ),
              onConflict: DoUpdate<Iefs, Ief>(
                (Iefs old) => IefsCompanion.custom(
                  code: const CustomExpression<String>('excluded.code'),
                  name: const CustomExpression<String>('excluded.name'),
                  departementId: const CustomExpression<String>(
                    'excluded.departement_id',
                  ),
                  departementName: const CustomExpression<String>(
                    'excluded.departement_name',
                  ),
                  isActive: const CustomExpression<bool>('excluded.is_active'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
              ),
            );
        count++;
      }
      for (final BanqueDto b in page.changes.banques) {
        await _db
            .into(_db.banques)
            .insert(
              BanquesCompanion.insert(
                id: b.id,
                name: b.name,
                shortName: b.shortName,
                isActive: Value<bool>(b.isActive),
                sortOrder: Value<int>(b.sortOrder.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(b.updatedAt),
              ),
              onConflict: DoUpdate<Banques, Banque>(
                (Banques old) => BanquesCompanion.custom(
                  name: const CustomExpression<String>('excluded.name'),
                  shortName: const CustomExpression<String>('excluded.short_name'),
                  isActive: const CustomExpression<bool>('excluded.is_active'),
                  sortOrder: const CustomExpression<int>('excluded.sort_order'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
              ),
            );
        count++;
      }
      for (final SyndicatDto s in page.changes.syndicats) {
        await _db
            .into(_db.syndicats)
            .insert(
              SyndicatsCompanion.insert(
                id: s.id,
                name: s.name,
                sigle: s.sigle,
                secteur: Value<String?>(s.secteur),
                isActive: Value<bool>(s.isActive),
                sortOrder: Value<int>(s.sortOrder.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(s.updatedAt),
              ),
              onConflict: DoUpdate<Syndicats, Syndicat>(
                (Syndicats old) => SyndicatsCompanion.custom(
                  name: const CustomExpression<String>('excluded.name'),
                  sigle: const CustomExpression<String>('excluded.sigle'),
                  secteur: const CustomExpression<String>('excluded.secteur'),
                  isActive: const CustomExpression<bool>('excluded.is_active'),
                  sortOrder: const CustomExpression<int>('excluded.sort_order'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
              ),
            );
        count++;
      }
      for (final RepresentantDto r in page.changes.representants) {
        if (guardedRepresentants.contains(r.id)) continue;
        await _db
            .into(_db.representants)
            .insert(
              RepresentantsCompanion.insert(
                id: r.id,
                fullName: r.fullName,
                phoneE164: r.phoneE164,
                notes: Value<String?>(r.notes),
                departementId: r.departementId,
                iefId: Value<String?>(r.iefId),
                createdById: r.createdById,
                clientCreatedAt: r.clientCreatedAt,
                rev: Value<int>(r.rev.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(r.updatedAt),
              ),
              onConflict: DoUpdate<Representants, Representant>(
                (Representants old) => RepresentantsCompanion.custom(
                  fullName: const CustomExpression<String>('excluded.full_name'),
                  phoneE164: const CustomExpression<String>('excluded.phone_e164'),
                  notes: const CustomExpression<String>('excluded.notes'),
                  departementId: const CustomExpression<String>(
                    'excluded.departement_id',
                  ),
                  iefId: const CustomExpression<String>('excluded.ief_id'),
                  rev: const CustomExpression<int>('excluded.rev'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
                // LWW par révision serveur. Une page rejouée n'écrase rien.
                where: (Representants old) =>
                    const CustomExpression<int>('excluded.rev').isBiggerThan(old.rev),
              ),
            );
        count++;
      }
      for (final ProspectDto p in page.changes.prospects) {
        if (guardedProspects.contains(p.id)) continue;
        await _db
            .into(_db.prospects)
            .insert(
              ProspectsCompanion.insert(
                id: p.id,
                nom: p.nom,
                prenom: p.prenom,
                phoneE164: p.phoneE164,
                banqueId: p.banqueId,
                syndicatId: p.syndicatId,
                representantId: p.representantId,
                createdById: p.ownedByCommercialId,
                statut: Value<String>(p.statut.value),
                clientCreatedAt: p.clientCreatedAt,
                rev: Value<int>(p.rev.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(p.updatedAt),
                deletedAt: Value<DateTime?>(p.deletedAt),
              ),
              onConflict: DoUpdate<Prospects, Prospect>(
                (Prospects old) => ProspectsCompanion.custom(
                  nom: const CustomExpression<String>('excluded.nom'),
                  prenom: const CustomExpression<String>('excluded.prenom'),
                  phoneE164: const CustomExpression<String>('excluded.phone_e164'),
                  banqueId: const CustomExpression<String>('excluded.banque_id'),
                  syndicatId: const CustomExpression<String>('excluded.syndicat_id'),
                  representantId: const CustomExpression<String>(
                    'excluded.representant_id',
                  ),
                  statut: const CustomExpression<String>('excluded.statut'),
                  rev: const CustomExpression<int>('excluded.rev'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                  deletedAt: const CustomExpression<DateTime>('excluded.deleted_at'),
                ),
                where: (Prospects old) =>
                    const CustomExpression<int>('excluded.rev').isBiggerThan(old.rev),
              ),
            );
        count++;
      }

      // Suppressions : logiques, jamais physiques. Une ligne effacée pour de bon
      // reviendrait au prochain pull complet, puisque le serveur ne la renvoie
      // plus mais que rien ne dit localement qu'elle a existé.
      //
      // ═══ LA GARDE VAUT AUSSI ICI ═══
      //
      // Cette boucle ignorait les ensembles gardés, alors qu'une suppression est
      // l'écrasement le plus radical qui soit. Une suppression serveur arrivant
      // pendant qu'une écriture locale sur la même fiche attend son tour la
      // faisait disparaître de l'écran ; l'écriture partait ensuite, le serveur
      // l'acceptait, et la fiche restait invisible sur le téléphone alors
      // qu'elle existait des deux côtés. Le commercial la ressaisissait.
      //
      // Comme pour les upserts : tant qu'un envoi peut encore trancher, on le
      // laisse trancher. [_stampServerState] efface la marque de suppression
      // quand l'écriture est acquittée, et le pull suivant réappliquera la
      // suppression si le serveur la maintient.
      for (final SyncDeletionDto d in page.deletions) {
        if (d.entity == SyncEntity.representant) {
          if (guardedRepresentants.contains(d.id)) continue;
          await (_db.update(_db.representants)
                ..where((Representants t) => t.id.equals(d.id)))
              .write(RepresentantsCompanion(deletedAt: Value<DateTime?>(d.deletedAt)));
        } else {
          if (guardedProspects.contains(d.id)) continue;
          await (_db.update(_db.prospects)..where((Prospects t) => t.id.equals(d.id)))
              .write(ProspectsCompanion(deletedAt: Value<DateTime?>(d.deletedAt)));
        }
        count++;
      }
    });
    return count;
  }

  Future<String?> readCursor() async {
    final SyncStateData? row = await (_db.select(
      _db.syncState,
    )..where((SyncState t) => t.collection.equals(cursorKey))).getSingleOrNull();
    return row?.cursor;
  }

  /// Écriture inconditionnelle du curseur. Réservée à l'amorçage et aux tests :
  /// la boucle de pull passe par [advanceCursor].
  Future<void> writeCursor(String? cursor) async {
    await _db
        .into(_db.syncState)
        .insertOnConflictUpdate(
          SyncStateCompanion.insert(
            collection: cursorKey,
            cursor: Value<String?>(cursor),
            lastPulledAt: Value<DateTime?>(_clock.now()),
          ),
        );
  }

  /// Avance le curseur **si et seulement si** il vaut encore [from].
  ///
  /// ═══ UN CURSEUR NE DOIT JAMAIS RECULER ═══
  ///
  /// [isPulling] est un champ d'instance : il empêche deux pulls concurrents
  /// dans le MÊME isolat, et rien de plus. Le worker WorkManager construit son
  /// propre moteur sur le même fichier de base pendant que l'app est ouverte, et
  /// la course est banale :
  ///
  /// 1. les deux lisent le curseur `C` ;
  /// 2. le premier plan tire deux pages et écrit `C2` ;
  /// 3. le worker finit sa page, plus ancienne, et écrit `C1`.
  ///
  /// Aucune ligne n'est perdue, le LWW par `rev` du pull y veille. Mais toutes
  /// les pages comprises entre `C1` et `C2` sont retéléchargées, sur un forfait
  /// mobile prépayé, à chaque fois que la course se rejoue.
  ///
  /// Le curseur reste **opaque** : on ne le décode pas, on ne le compare pas
  /// dans son contenu (sa structure appartient au serveur, `sync/cursor.ts`).
  /// On vérifie seulement que la position qu'on remplace est bien celle qu'on
  /// avait lue : le retardataire, qui n'a pas cette position sous les yeux,
  /// n'écrit rien. Renvoie `false` dans ce cas, et la boucle de pull s'arrête :
  /// continuer à paginer depuis un curseur que la base a désavoué ne ferait que
  /// retélécharger ce que l'autre isolat vient déjà d'appliquer.
  ///
  /// `IS` et non `=` : SQLite compare `NULL = NULL` à `NULL`, donc faux, et le
  /// tout premier pull d'une installation neuve part précisément d'un curseur
  /// nul.
  Future<bool> advanceCursor({required String? from, required String? to}) async {
    final int changed = await _db.customUpdate(
      'INSERT INTO sync_state (collection, cursor, last_pulled_at) '
      'VALUES (?1, ?2, ?3) '
      'ON CONFLICT(collection) DO UPDATE SET '
      '  cursor = excluded.cursor, last_pulled_at = excluded.last_pulled_at '
      'WHERE sync_state.cursor IS ?4',
      variables: <Variable<Object>>[
        Variable<String>(cursorKey),
        Variable<String>(to),
        Variable<DateTime>(_clock.now()),
        Variable<String>(from),
      ],
      updates: <TableInfo<Table, Object?>>{_db.syncState},
    );
    return changed > 0;
  }

  Future<void> dispose() => _db.close();
}

/// Ce qu'un envoi de lot rapporte à la vidange.
///
/// Un enregistrement et non un simple `bool` : compter les acquittements sur la
/// taille du lot PRÉPARÉ faisait annoncer un succès à `runOnce` alors que
/// l'envoi avait échoué et que l'exception avait été avalée. Le worker
/// WorkManager en concluait qu'il n'avait plus rien à faire.
class _SendReport {
  const _SendReport({required this.acknowledged, required this.keepGoing});

  /// Opérations pour lesquelles un verdict a réellement été reçu.
  final int acknowledged;

  /// Faux quand il faut arrêter la vidange.
  final bool keepGoing;
}

class _PreparedBatch {
  const _PreparedBatch({
    required this.batchId,
    required this.rows,
    required this.operations,
  });

  final String batchId;
  final List<OutboxData> rows;

  /// Toutes les opérations du lot, toutes familles confondues : un seul
  /// transport, donc une seule liste.
  final List<SyncOperationDto> operations;

  int get length => operations.length;

  bool get isEmpty => operations.isEmpty;
}

/// Résultat d'un cycle, volontairement sans exception qui remonte : le worker
/// doit pouvoir décider d'un `Result.retry()` sans attraper d'erreur.
class SyncOutcome {
  const SyncOutcome.ok({required this.pushed, required this.pulled})
    : status = SyncRunStatus.ok,
      reason = null,
      kind = null;

  const SyncOutcome.skipped(this.reason)
    : status = SyncRunStatus.skipped,
      pushed = 0,
      pulled = 0,
      kind = null;

  const SyncOutcome.failed(this.reason, {required this.kind, this.pushed = 0})
    : status = SyncRunStatus.failed,
      pulled = 0;

  final SyncRunStatus status;
  final int pushed;
  final int pulled;
  final String? reason;
  final FailureKind? kind;

  bool get isOk => status == SyncRunStatus.ok;

  /// Le worker doit-il redemander à être rappelé ?
  bool get shouldRetry =>
      status == SyncRunStatus.failed &&
      kind != FailureKind.terminal &&
      kind != FailureKind.sessionExpired;
}

enum SyncRunStatus { ok, skipped, failed }
