// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_preview_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(InvoicePreview)
final invoicePreviewProvider = InvoicePreviewFamily._();

final class InvoicePreviewProvider
    extends $NotifierProvider<InvoicePreview, InvoicePreviewState> {
  InvoicePreviewProvider._({
    required InvoicePreviewFamily super.from,
    required int super.argument,
  }) : super(
         retry: null,
         name: r'invoicePreviewProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$invoicePreviewHash();

  @override
  String toString() {
    return r'invoicePreviewProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  InvoicePreview create() => InvoicePreview();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(InvoicePreviewState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<InvoicePreviewState>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is InvoicePreviewProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$invoicePreviewHash() => r'36e8909f1713a2147b76aeca3f9bb79346ea19db';

final class InvoicePreviewFamily extends $Family
    with
        $ClassFamilyOverride<
          InvoicePreview,
          InvoicePreviewState,
          InvoicePreviewState,
          InvoicePreviewState,
          int
        > {
  InvoicePreviewFamily._()
    : super(
        retry: null,
        name: r'invoicePreviewProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  InvoicePreviewProvider call(int orderId) =>
      InvoicePreviewProvider._(argument: orderId, from: this);

  @override
  String toString() => r'invoicePreviewProvider';
}

abstract class _$InvoicePreview extends $Notifier<InvoicePreviewState> {
  late final _$args = ref.$arg as int;
  int get orderId => _$args;

  InvoicePreviewState build(int orderId);
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<InvoicePreviewState, InvoicePreviewState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<InvoicePreviewState, InvoicePreviewState>,
              InvoicePreviewState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, () => build(_$args));
  }
}
