// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pin_code_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(PinCode)
final pinCodeProvider = PinCodeFamily._();

final class PinCodeProvider extends $NotifierProvider<PinCode, PinCodeState> {
  PinCodeProvider._({
    required PinCodeFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'pinCodeProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$pinCodeHash();

  @override
  String toString() {
    return r'pinCodeProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  PinCode create() => PinCode();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PinCodeState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PinCodeState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is PinCodeProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$pinCodeHash() => r'921a453371270147eb1cd915e54b474004180c92';

final class PinCodeFamily extends $Family
    with
        $ClassFamilyOverride<
          PinCode,
          PinCodeState,
          PinCodeState,
          PinCodeState,
          String
        > {
  PinCodeFamily._()
    : super(
        retry: null,
        name: r'pinCodeProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  PinCodeProvider call({String mode = 'auth'}) =>
      PinCodeProvider._(argument: mode, from: this);

  @override
  String toString() => r'pinCodeProvider';
}

abstract class _$PinCode extends $Notifier<PinCodeState> {
  late final _$args = ref.$arg as String;
  String get mode => _$args;

  PinCodeState build({String mode = 'auth'});
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<PinCodeState, PinCodeState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<PinCodeState, PinCodeState>,
              PinCodeState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, () => build(mode: _$args));
  }
}
