import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/sync/api_port.dart';
import '../../core/sync/phase2_directory_sync.dart';
import '../../core/utils/phone.dart';
import '../../data/local/database.dart';
import '../../data/repositories/write_repository.dart';

/// Les cinq états de l'écran de phase 2.
///
/// Une énumération et pas trois booléens : « pas trouvé » et « déjà traité »
/// sont deux écrans différents avec deux issues différentes, et les représenter
/// par des drapeaux indépendants rendrait représentable l'état « pas trouvé ET
/// déjà traité », qui n'existe pas.
enum Phase2Stage {
  /// Le champ attend un numéro.
  search,

  /// Numéro absent de l'annuaire répliqué.
  notFound,

  /// Dossier déjà clos côté serveur — lecture seule.
  alreadyClosed,

  /// Dossier ouvert : les trois cartes de méthode et l'issue négative.
  capture,

  /// Écriture locale confirmée. Le champ se vide et reprend le focus.
  confirmed,
}

@immutable
class Phase2State {
  const Phase2State({
    this.stage = Phase2Stage.search,
    this.entry,
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

  /// L'entrée d'annuaire trouvée. Six champs — pas de nom, pas de banque.
  final Phase2DirectoryData? entry;

  /// Le numéro normalisé qui a servi à chercher, tel qu'on veut le réafficher.
  final String? searchedPhone;

  /// Erreur de saisie, en français, destinée à être lue debout dans la rue.
  final String? errorMessage;

  /// Ce qui vient d'être enregistré, pour le libellé de confirmation.
  final String? confirmation;

  final bool saving;

  // ── Téléchargement de l'annuaire ─────────────────────────────────────────
  final bool downloading;
  final int downloaded;
  final bool downloadHasMore;
  final String? downloadError;

  Phase2State copyWith({
    Phase2Stage? stage,
    Phase2DirectoryData? entry,
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
      searchedPhone: searchedPhone ?? this.searchedPhone,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      confirmation: confirmation ?? this.confirmation,
      saving: saving ?? this.saving,
      downloading: downloading ?? this.downloading,
      downloaded: downloaded ?? this.downloaded,
      downloadHasMore: downloadHasMore ?? this.downloadHasMore,
      downloadError: clearDownloadError ? null : (downloadError ?? this.downloadError),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Phase2State &&
          other.stage == stage &&
          other.entry?.prospectId == entry?.prospectId &&
          other.entry?.phase2Status == entry?.phase2Status &&
          other.entry?.enrollmentMethod == entry?.enrollmentMethod &&
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
    entry?.prospectId,
    entry?.phase2Status,
    entry?.enrollmentMethod,
    searchedPhone,
    errorMessage,
    confirmation,
    saving,
    downloading,
    downloaded,
    Object.hash(downloadHasMore, downloadError),
  );
}

/// Ce que l'écran a besoin de savoir faire, sans rien savoir de son rendu.
///
/// Écrit à la main : `riverpod_generator` n'a aucun palier d'`analyzer` commun
/// avec `drift_dev` à cette version de Flutter (voir `pubspec.yaml`). Un
/// `Notifier` manuel a exactement la même sémantique.
class Phase2Controller extends Notifier<Phase2State> {
  @override
  Phase2State build() => const Phase2State();

  Phase2DirectorySync get _directory => ref.read(phase2DirectoryProvider);
  WriteRepository get _writes => ref.read(writeRepositoryProvider);

  /// Cherche un numéro dans l'annuaire répliqué.
  ///
  /// La normalisation passe par [Phone.toE164], celle-là même qui sert aux
  /// représentants et aux prospects, et qui reproduit le verdict de
  /// `libphonenumber-js` région `SN` employé par le serveur. C'est ce qui fait
  /// que `77 123 45 67`, `+221771234567` et `00221771234567` retrouvent la même
  /// ligne : sans elle, la clé de recherche dépendrait de la façon dont le
  /// commercial recopie le papier.
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

    final Phase2DirectoryData? found = await _directory.lookupByPhone(parsed.e164);
    if (found == null) {
      state = state.copyWith(
        stage: Phase2Stage.notFound,
        searchedPhone: parsed.e164,
        clearEntry: true,
        clearError: true,
      );
      return;
    }

    state = state.copyWith(
      // Tout ce qui n'est pas `PENDING` est terminal côté serveur : une
      // nouvelle tentative y serait refusée en `PHASE2_ALREADY_COMPLETED`,
      // quelle qu'en soit l'issue. On ne propose donc pas un formulaire dont on
      // sait qu'il ne peut pas aboutir.
      stage: found.phase2Status == Phase2Statuses.pending
          ? Phase2Stage.capture
          : Phase2Stage.alreadyClosed,
      entry: found,
      searchedPhone: parsed.e164,
      clearError: true,
    );
  }

  /// Enregistre une issue. Renvoie `true` si l'écriture locale a abouti.
  ///
  /// **Le retour porte la vibration.** L'appelant ne fait vibrer qu'après un
  /// `true` : une vibration de succès déclenchée à la pression, avant que la
  /// transaction soit commitée, affirmerait un enregistrement qui peut encore
  /// échouer. Un retour haptique qui ment est pire que pas de retour du tout.
  Future<bool> record({
    required String outcome,
    String? method,
    String? comment,
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
        outcome: outcome,
        method: method,
        comment: comment,
        createdById: me,
      );
    } on CallAttemptInvalid catch (e) {
      state = state.copyWith(saving: false, errorMessage: e.message);
      return false;
    }

    state = state.copyWith(
      stage: Phase2Stage.confirmed,
      saving: false,
      confirmation: labelForOutcome(outcome, method),
      clearError: true,
    );
    // Coup de pouce au moteur, sans pull : on vient d'écrire, tirer maintenant
    // ne rapporterait rien et coûterait un aller-retour. Hors ligne, l'échec est
    // silencieux et la ligne reste en file — c'est le comportement voulu.
    ref.read(syncCoordinatorProvider.notifier).nudge();
    return true;
  }

  /// Repart sur un champ vide, prêt pour le numéro suivant.
  void next() {
    state = const Phase2State();
  }

  /// Revient à la recherche depuis le formulaire, sans rien enregistrer.
  void cancel() => next();

  /// Télécharge ou met à jour l'annuaire.
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
    } on ApiException catch (e) {
      state = state.copyWith(
        downloading: false,
        downloadHasMore: false,
        downloadError: _downloadMessage(e),
      );
    }
  }

  static String _downloadMessage(ApiException e) => switch (e.code) {
    'NETWORK' || 'TIMEOUT' =>
      'Réseau indisponible. L\'annuaire déjà téléchargé reste utilisable.',
    'SESSION_EXPIRED' || 'UNAUTHORIZED' => 'Session expirée. Reconnectez-vous.',
    'FORBIDDEN' => 'Votre compte n\'a pas accès à l\'annuaire de phase 2.',
    _ => e.message ?? 'Téléchargement impossible pour le moment.',
  };

  /// Libellé humain d'une issue, pour la confirmation et pour la fiche en
  /// lecture seule.
  static String labelForOutcome(String outcome, [String? method]) =>
      switch (outcome) {
        CallOutcomes.methodObtained =>
          'Méthode obtenue — ${labelForMethod(method ?? '')}',
        CallOutcomes.unreachable => 'Injoignable',
        CallOutcomes.callback => 'À rappeler',
        CallOutcomes.refused => 'Refus',
        CallOutcomes.wrongNumber => 'Mauvais numéro',
        CallOutcomes.other => 'Autre',
        _ => outcome,
      };

  static String labelForMethod(String method) => switch (method) {
    EnrollmentMethods.platform => 'Plateforme',
    EnrollmentMethods.physical => 'Physique',
    EnrollmentMethods.voiceOrElectronicMessaging => 'Voix / messagerie',
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
