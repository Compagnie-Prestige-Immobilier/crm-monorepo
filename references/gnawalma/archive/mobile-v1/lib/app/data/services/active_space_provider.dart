import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../init/app_bootstrapper.dart';
import 'app_space.dart';
import 'storage_service.dart';

/// The space the app is currently in.
///
/// This exists so the accent can be applied **above** the router rather than
/// inside each shell. Wrapping the shells alone looked right until you pushed
/// anything: search, atelier detail, preferences and every form are sibling
/// routes, not descendants of a shell, so they never inherited the shell's
/// `Theme` and rendered in the fallback hue — a client tapping a category
/// landed on a blue screen from an orange one.
///
/// A person is in one space at a time, so the space belongs at the top of the
/// tree, not in a branch of it.
///
/// **Synchronous on purpose.** The value is resolved during bootstrap
/// ([AppBootstrapper.initialSpace]) and held here. An async read would leave
/// the accent undefined for the first frames — and, worse, any later refresh
/// of that read would drop back to a default and repaint the whole app in the
/// other space's colour mid-session.
///
/// Writing goes through [select] rather than `StorageService.setActiveSpace`
/// directly, so persistence and the in-memory value can never disagree.
class ActiveSpaceController extends Notifier<AppSpace?> {
  @override
  AppSpace? build() => AppBootstrapper.initialSpace;

  /// Persists the space and repaints the app in its accent.
  Future<void> select(AppSpace space) async {
    await ref.read(storageProvider).setActiveSpace(space);
    AppBootstrapper.initialSpace = space;
    state = space;
  }
}

final activeSpaceProvider = NotifierProvider<ActiveSpaceController, AppSpace?>(
  ActiveSpaceController.new,
);
