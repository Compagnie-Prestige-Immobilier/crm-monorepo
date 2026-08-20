import 'dart:async';
import 'dart:ui' show AppExitResponse;

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../data/repositories/draft_repository.dart';
import 'draft_debouncer.dart';

mixin DraftFormMixin<T extends StatefulWidget> on State<T> {
  DraftDebouncer? _debouncer;
  AppLifecycleListener? _lifecycle;

  String get draftId;

  String get draftFormKey;

  Map<String, Object?> collectDraftValues();

  int get draftStep => 0;

  String? get draftEntityId => null;
  String? get draftParentId => null;

  DraftRepository get draftRepository;

  bool get draftIsEmpty => false;

  String? draftRouteWithId() => null;

  @override
  void initState() {
    super.initState();
    _debouncer = DraftDebouncer(onFlush: _persist);
    WidgetsBinding.instance.addPostFrameCallback((Duration _) {
      republishDraftRoute();
    });
    _lifecycle = AppLifecycleListener(
      onInactive: () => _debouncer?.flush(),
      onPause: () => _debouncer?.flush(),
      onDetach: () => _debouncer?.flush(),
      onExitRequested: () async {
        await _debouncer?.flush();
        return AppExitResponse.exit;
      },
    );
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    _lifecycle = null;
    final DraftDebouncer? debouncer = _debouncer;
    _debouncer = null;
    // La dernière écriture part sans témoin : `dispose` ne peut pas l'attendre,
    // mais `DraftDebouncer` journalise son échec.
    if (debouncer != null) unawaited(debouncer.dispose());
    super.dispose();
  }

  void republishDraftRoute() {
    if (!mounted) return;
    final String? target = draftRouteWithId();
    if (target == null) return;
    final GoRouter? router = GoRouter.maybeOf(context);
    if (router == null) return;
    unawaited(router.replace<void>(target));
  }

  void markDraftDirty() => _debouncer?.touch();

  Future<void> flushDraft() async => _debouncer?.flush();

  void discardDraft() => _debouncer?.discard();

  Future<void> _persist() async {
    if (!mounted || draftIsEmpty) return;
    await draftRepository.save(
      draftId: draftId,
      formKey: draftFormKey,
      values: collectDraftValues(),
      step: draftStep,
      entityId: draftEntityId,
      parentId: draftParentId,
    );
  }
}
