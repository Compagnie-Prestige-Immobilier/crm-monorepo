// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'setup_wizard_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(SetupWizard)
final setupWizardProvider = SetupWizardProvider._();

final class SetupWizardProvider
    extends $NotifierProvider<SetupWizard, SetupWizardState> {
  SetupWizardProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'setupWizardProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$setupWizardHash();

  @$internal
  @override
  SetupWizard create() => SetupWizard();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SetupWizardState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SetupWizardState>(value),
    );
  }
}

String _$setupWizardHash() => r'081485452d62165bc4bbdebdc76e1aa408f54133';

abstract class _$SetupWizard extends $Notifier<SetupWizardState> {
  SetupWizardState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<SetupWizardState, SetupWizardState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<SetupWizardState, SetupWizardState>,
              SetupWizardState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
