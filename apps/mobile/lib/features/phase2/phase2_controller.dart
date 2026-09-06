import 'package:drift/drift.dart' show BooleanExpressionOperators;
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/sync/api_port.dart';
import '../../core/sync/phase2_directory_sync.dart';
import '../../core/utils/phone.dart';
import '../../data/local/database.dart';
import '../../data/repositories/write_repository.dart';

enum Phase2Stage {
  search,
  notFound,

  /// Le numéro existe, mais aucune de mes campagnes ne me l'attribue : le
  /// serveur refuserait l'appel une fois remonté.
  horsPerimetre,
  alreadyClosed,
  capture,
  confirmed,
}

/// Ce que l'étape « Renseignements » a recueilli. Le dossier complet est exigé
/// avant une adhésion, mais pas avant un appel qui n'a pas abouti : tout y reste
/// donc facultatif, et c'est l'écran qui retient le passage.
@immutable
class Phase2Renseignements {
  const Phase2Renseignements({
    this.nom,
    this.prenom,
    this.email,
    this.profession,
    this.dureeEtablissementMois,
    this.fonctionnaire,
    this.syndicatId,
    this.banqueId,
    this.engagementEnCours,
    this.incomeBandId,
    this.dureeSystemeMois,
  });

  final String? nom;
  final String? prenom;
  final String? email;
  final String? profession;
  final int? dureeEtablissementMois;

  /// Tri-état : `null` vaut « non demandé », et ce n'est pas « non ».
  final bool? fonctionnaire;

  final String? syndicatId;
  final String? banqueId;
  final bool? engagementEnCours;

  /// Tranche de revenu du référentiel serveur.
  final String? incomeBandId;

  /// Durée du système de paiement, en mois. Distincte de
  /// [dureeEtablissementMois], qui est l'ancienneté au poste.
  final int? dureeSystemeMois;
}

@immutable
class Phase2State {
  const Phase2State({
    this.stage = Phase2Stage.search,
    this.entry,
    this.prospect,
    this.searchedPhone,
    this.errorMessage,
    this.confirmation,
    this.saving = false,
    this.downloading = false,
    this.downloaded = 0,
    this.downloadHasMore = false,
    this.downloadError,
  });

  final Phase2Stage stage;

  final Phase2DirectoryData? entry;

  /// La fiche locale du même prospect, quand elle est sur cet appareil.
  /// L'annuaire ne porte qu'un numéro : nom, prénom et profession ne se
  /// pré-remplissent que si le pull a déjà descendu la fiche elle-même.
  final Prospect? prospect;

  final String? searchedPhone;

  final String? errorMessage;

  final String? confirmation;

  final bool saving;

  final bool downloading;
  final int downloaded;
  final bool downloadHasMore;
  final String? downloadError;

  Phase2State copyWith({
    Phase2Stage? stage,
    Phase2DirectoryData? entry,
    Prospect? prospect,
    bool clearEntry = false,
    String? searchedPhone,
    String? errorMessage,
    bool clearError = false,
    String? confirmation,
    bool? saving,
    bool? downloading,
    int? downloaded,
    bool? downloadHasMore,
    String? downloadError,
    bool clearDownloadError = false,
  }) {
    return Phase2State(
      stage: stage ?? this.stage,
      entry: clearEntry ? null : (entry ?? this.entry),
      prospect: clearEntry ? null : (prospect ?? this.prospect),
      searchedPhone: searchedPhone ?? this.searchedPhone,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      confirmation: confirmation ?? this.confirmation,
      saving: saving ?? this.saving,
      downloading: downloading ?? this.downloading,
      downloaded: downloaded ?? this.downloaded,
      downloadHasMore: downloadHasMore ?? this.downloadHasMore,
      downloadError: clearDownloadError
          ? null
          : (downloadError ?? this.downloadError),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Phase2State &&
          other.stage == stage &&
          other.entry == entry &&
          other.prospect == prospect &&
          other.searchedPhone == searchedPhone &&
          other.errorMessage == errorMessage &&
          other.confirmation == confirmation &&
          other.saving == saving &&
          other.downloading == downloading &&
          other.downloaded == downloaded &&
          other.downloadHasMore == downloadHasMore &&
          other.downloadError == downloadError;

  @override
  int get hashCode => Object.hash(
    stage,
    entry,
    prospect,
    searchedPhone,
    errorMessage,
    confirmation,
    saving,
    downloading,
    downloaded,
    Object.hash(downloadHasMore, downloadError),
  );
}

class Phase2Controller extends Notifier<Phase2State> {
  @override
  Phase2State build() => const Phase2State();

  Phase2DirectorySync get _directory => ref.read(phase2DirectoryProvider);
  WriteRepository get _writes => ref.read(writeRepositoryProvider);

  Future<void> search(String raw) async {
    final PhoneResult parsed = Phone.parse(raw);
    if (parsed is! PhoneValid) {
      state = state.copyWith(
        stage: Phase2Stage.search,
        errorMessage: (parsed as PhoneInvalid).message,
        clearEntry: true,
      );
      return;
    }

    final Phase2DirectoryData? found;
    try {
      found = await _directory.lookupByPhone(parsed.e164);
    } on Object catch (e) {
      state = state.copyWith(
        stage: Phase2Stage.search,
        errorMessage: 'Lecture de l\'annuaire impossible. $e',
        clearEntry: true,
      );
      return;
    }

    if (found == null) {
      state = state.copyWith(
        stage: Phase2Stage.notFound,
        searchedPhone: parsed.e164,
        clearEntry: true,
        clearError: true,
      );
      return;
    }

    if (!await _dansMonPerimetre(found.prospectId)) {
      state = state.copyWith(
        stage: Phase2Stage.horsPerimetre,
        searchedPhone: parsed.e164,
        clearEntry: true,
        clearError: true,
      );
      return;
    }

    state = state.copyWith(
      stage: found.phase2Status == Phase2Statuses.pending
          ? Phase2Stage.capture
          : Phase2Stage.alreadyClosed,
      entry: found,
      prospect: await _localProspect(found.prospectId),
      searchedPhone: parsed.e164,
      clearError: true,
    );
  }

  /// Le serveur refuse `CALL_ATTEMPT` hors périmètre (`PHASE2_NOT_ASSIGNED`) :
  /// mieux vaut le dire avant l'appel qu'après la remontée. Tant que le
  /// marqueur `borne` n'est pas posé, rien n'est filtré.
  Future<bool> _dansMonPerimetre(String prospectId) async {
    final AppDatabase db = ref.read(appDatabaseProvider);
    final List<Attribution> lignes =
        await (db.select(db.attributions)..where(
              (Attributions t) =>
                  t.kind.equals(attributionBorne) |
                  (t.kind.equals('prospect') & t.id.equals(prospectId)),
            ))
            .get();
    if (!lignes.any((Attribution a) => a.kind == attributionBorne)) return true;
    if (lignes.any((Attribution a) => a.kind == 'prospect')) return true;
    final Prospect? fiche = await _localProspect(prospectId);
    return fiche?.createdById == ref.read(authControllerProvider).userId;
  }

  /// La fiche du prospect si le pull l'a descendue sur cet appareil. Une lecture
  /// qui casse ne fait pas échouer la recherche : elle ne prive que du
  /// pré-remplissage.
  Future<Prospect?> _localProspect(String prospectId) async {
    final AppDatabase db = ref.read(appDatabaseProvider);
    try {
      final Prospect? row = await (db.select(
        db.prospects,
      )..where((Prospects t) => t.id.equals(prospectId))).getSingleOrNull();
      return row?.deletedAt == null ? row : null;
    } on Object {
      return null;
    }
  }

  Future<bool> record({
    required CallReason reason,
    String? method,
    String? comment,
    DateTime? callbackAt,
    String? recordingPath,
    Phase2Renseignements? renseignements,
    DateTime? rendezVousAt,
    String? ouvertureId,
  }) async {
    final Phase2DirectoryData? entry = state.entry;
    if (entry == null) return false;
    final String? me = ref.read(authControllerProvider).userId;
    if (me == null) {
      state = state.copyWith(
        errorMessage: 'Session incomplète : reconnectez-vous pour enregistrer.',
      );
      return false;
    }

    state = state.copyWith(saving: true, clearError: true);
    try {
      await _writes.recordCallAttempt(
        prospectId: entry.prospectId,
        ouvertureId: ouvertureId,
        outcome: reason.outcome,
        reasonCode: reason.code,
        method: method,
        comment: comment,
        callbackAt: callbackAt,
        recordingPath: recordingPath,
        createdById: me,
        nom: renseignements?.nom,
        prenom: renseignements?.prenom,
        profession: renseignements?.profession,
        banqueId: renseignements?.banqueId,
        syndicatId: renseignements?.syndicatId,
        incomeBandId: renseignements?.incomeBandId,
        dureeSystemeMois: renseignements?.dureeSystemeMois,
        email: renseignements?.email,
        fonctionnaire: renseignements?.fonctionnaire,
        engagementEnCours: renseignements?.engagementEnCours,
        dureeEtablissementMois: renseignements?.dureeEtablissementMois,
        rendezVousAt: rendezVousAt,
      );
    } on CallAttemptInvalid catch (e) {
      state = state.copyWith(saving: false, errorMessage: e.message);
      return false;
    }

    state = state.copyWith(
      stage: Phase2Stage.confirmed,
      saving: false,
      confirmation: labelForReason(reason, method),
      clearError: true,
    );
    ref.read(syncCoordinatorProvider.notifier).nudge();
    return true;
  }

  void next() {
    state = const Phase2State();
  }

  void cancel() => next();

  Future<void> download() async {
    if (state.downloading) return;
    state = state.copyWith(
      downloading: true,
      downloaded: 0,
      downloadHasMore: true,
      clearDownloadError: true,
    );
    try {
      await _directory.pull(
        onProgress: (int applied, bool hasMore) {
          state = state.copyWith(downloaded: applied, downloadHasMore: hasMore);
        },
      );
      state = state.copyWith(downloading: false, downloadHasMore: false);
    } on Object catch (e) {
      // Toutes les erreurs, pas seulement celles du réseau : une écriture drift
      // qui casse laissait `downloading` à vrai, donc le bouton désactivé et
      // l'annuaire intéléchargeable jusqu'au redémarrage.
      state = state.copyWith(
        downloading: false,
        downloadHasMore: false,
        downloadError: e is ApiException
            ? _downloadMessage(e)
            : 'Téléchargement interrompu. $e',
      );
    }
  }

  static String _downloadMessage(ApiException e) => switch (e.code) {
    'NETWORK' || 'TIMEOUT' =>
      'Réseau indisponible. L\'annuaire déjà téléchargé reste utilisable.',
    'SESSION_EXPIRED' || 'UNAUTHORIZED' => 'Session expirée. Reconnectez-vous.',
    'FORBIDDEN' =>
      'Votre compte n\'a pas accès à l\'annuaire des prospects à convertir.',
    _ => e.message ?? 'Téléchargement impossible pour le moment.',
  };

  /// Le libellé vient du motif, jamais d'une table de correspondance : c'est
  /// l'équipe du client qui le rédige depuis le web.
  static String labelForReason(CallReason reason, [String? method]) =>
      reason.effect == CallEffects.closeMethod
      ? '${reason.label} : ${labelForMethod(method ?? '')}'
      : reason.label;

  static String labelForMethod(String method) => switch (method) {
    EnrollmentMethods.platform => 'Plateforme',
    EnrollmentMethods.physical => 'Physique',
    EnrollmentMethods.voiceOrElectronicMessaging => 'Voix / messagerie',
    EnrollmentMethods.appointment => 'Prise de rendez-vous',
    _ => method,
  };

  static String labelForStatus(String status) => switch (status) {
    Phase2Statuses.pending => 'À traiter',
    Phase2Statuses.methodObtained => 'Méthode obtenue',
    Phase2Statuses.refused => 'Refus',
    Phase2Statuses.wrongNumber => 'Mauvais numéro',
    _ => status,
  };
}

final NotifierProvider<Phase2Controller, Phase2State> phase2ControllerProvider =
    NotifierProvider<Phase2Controller, Phase2State>(Phase2Controller.new);
