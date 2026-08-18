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

  alreadyClosed,

  capture,

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

  final Phase2DirectoryData? entry;

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
          other.entry == entry &&
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
      stage: found.phase2Status == Phase2Statuses.pending
          ? Phase2Stage.capture
          : Phase2Stage.alreadyClosed,
      entry: found,
      searchedPhone: parsed.e164,
      clearError: true,
    );
  }

  Future<bool> record({
    required CallReason reason,
    String? method,
    String? comment,
    DateTime? callbackAt,
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
        outcome: reason.outcome,
        reasonCode: reason.code,
        method: method,
        comment: comment,
        callbackAt: callbackAt,
        createdById: me,
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
    } on ApiException catch (e) {
      state = state.copyWith(
        downloading: false,
        downloadHasMore: false,
        downloadError: _downloadMessage(e),
      );
    }
  }

  static String _downloadMessage(ApiException e) => switch (e.code) {
    'NETWORK' ||
    'TIMEOUT' => 'Réseau indisponible. L\'annuaire déjà téléchargé reste utilisable.',
    'SESSION_EXPIRED' || 'UNAUTHORIZED' => 'Session expirée. Reconnectez-vous.',
    'FORBIDDEN' => 'Votre compte n\'a pas accès à l\'annuaire de phase 2.',
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
