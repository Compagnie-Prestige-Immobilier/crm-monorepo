// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'clients_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(clientsStream)
final clientsStreamProvider = ClientsStreamProvider._();

final class ClientsStreamProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<ClientModel>>,
          List<ClientModel>,
          Stream<List<ClientModel>>
        >
    with
        $FutureModifier<List<ClientModel>>,
        $StreamProvider<List<ClientModel>> {
  ClientsStreamProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'clientsStreamProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$clientsStreamHash();

  @$internal
  @override
  $StreamProviderElement<List<ClientModel>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<ClientModel>> create(Ref ref) {
    return clientsStream(ref);
  }
}

String _$clientsStreamHash() => r'e01e46f94ce4ff9d52128f65ff264232fb93d32b';

@ProviderFor(Clients)
final clientsProvider = ClientsProvider._();

final class ClientsProvider extends $NotifierProvider<Clients, ClientsState> {
  ClientsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'clientsProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$clientsHash();

  @$internal
  @override
  Clients create() => Clients();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(ClientsState value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<ClientsState>(value),
    );
  }
}

String _$clientsHash() => r'844883cb795bfda0762970d1d233c888f691e648';

abstract class _$Clients extends $Notifier<ClientsState> {
  ClientsState build();
  @$mustCallSuper
  @override
  void runBuild() {
    final ref = this.ref as $Ref<ClientsState, ClientsState>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<ClientsState, ClientsState>,
              ClientsState,
              Object?,
              Object?
            >;
    element.handleCreate(ref, build);
  }
}
