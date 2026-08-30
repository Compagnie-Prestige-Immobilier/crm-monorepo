// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invoice_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(invoice)
final invoiceProvider = InvoiceProvider._();

final class InvoiceProvider
    extends
        $FunctionalProvider<
          AsyncValue<InvoiceService>,
          InvoiceService,
          FutureOr<InvoiceService>
        >
    with $FutureModifier<InvoiceService>, $FutureProvider<InvoiceService> {
  InvoiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'invoiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$invoiceHash();

  @$internal
  @override
  $FutureProviderElement<InvoiceService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<InvoiceService> create(Ref ref) {
    return invoice(ref);
  }
}

String _$invoiceHash() => r'999bae347d18f035fb4017ad1dac9334a5cf8b84';
