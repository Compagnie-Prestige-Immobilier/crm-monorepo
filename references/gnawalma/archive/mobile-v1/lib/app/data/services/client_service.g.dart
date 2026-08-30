// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'client_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(clientService)
final clientServiceProvider = ClientServiceProvider._();

final class ClientServiceProvider
    extends
        $FunctionalProvider<
          AsyncValue<ClientService>,
          ClientService,
          FutureOr<ClientService>
        >
    with $FutureModifier<ClientService>, $FutureProvider<ClientService> {
  ClientServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'clientServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$clientServiceHash();

  @$internal
  @override
  $FutureProviderElement<ClientService> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<ClientService> create(Ref ref) {
    return clientService(ref);
  }
}

String _$clientServiceHash() => r'bb2a5edfc0aadd367ae5acd5742505517f919954';
