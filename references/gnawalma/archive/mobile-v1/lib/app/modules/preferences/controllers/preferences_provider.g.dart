// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'preferences_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(Preferences)
final preferencesProvider = PreferencesProvider._();

final class PreferencesProvider
    extends $AsyncNotifierProvider<Preferences, PreferencesState> {
  PreferencesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'preferencesProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$preferencesHash();

  @$internal
  @override
  Preferences create() => Preferences();
}

String _$preferencesHash() => r'2ec74ad363f221830ca59caa8d6d4a1fb5b5236f';

abstract class _$Preferences extends $AsyncNotifier<PreferencesState> {
  FutureOr<PreferencesState> build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref =
        this.ref as $Ref<AsyncValue<PreferencesState>, PreferencesState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<PreferencesState>, PreferencesState>,
              AsyncValue<PreferencesState>,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
