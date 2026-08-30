import 'package:gnawalma/app/shared/extensions/list_extensions.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/client_model.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../routes/app_routes.dart';
import 'clients_state.dart';

part 'clients_provider.g.dart';

@riverpod
Stream<List<ClientModel>> clientsStream(Ref ref) async* {
  final repository = await ref.watch(clientRepositoryProvider.future);

  // Initial data fetch
  final initialClients = await repository.getAllClients();
  yield initialClients;

  // Subsequent updates
  yield* repository.watchClients();
}

@Riverpod(keepAlive: true)
class Clients extends _$Clients {
  @override
  ClientsState build() {
    final clientsAsync = ref.watch(clientsStreamProvider);

    return clientsAsync.maybeWhen(
      data: (clients) {
        // Create initial state with data
        final initialState = ClientsState(
          clients: clients,
          isLoading: false,
          searchQuery: stateOrNull?.searchQuery ?? '',
        );

        // Return filtered state
        return _filterClientsInternal(initialState);
      },
      error: (_, _) => ClientsState(
        isLoading: false,
        hasError: true,
        searchQuery: stateOrNull?.searchQuery ?? '',
        clients: stateOrNull?.clients ?? [],
        filteredClients: stateOrNull?.filteredClients ?? [],
      ),
      orElse: () => ClientsState(
        isLoading: clientsAsync.isLoading,
        searchQuery: stateOrNull?.searchQuery ?? '',
        clients: stateOrNull?.clients ?? [],
        filteredClients: stateOrNull?.filteredClients ?? [],
      ),
    );
  }

  void setSearchQuery(String query) {
    state = _filterClientsInternal(state.copyWith(searchQuery: query));
  }

  ClientsState _filterClientsInternal(ClientsState currentState) {
    final query = currentState.searchQuery.toLowerCase().trim();
    var filtered = List<ClientModel>.from(currentState.clients);

    if (query.isNotEmpty) {
      filtered = filtered.where((client) {
        final fullName = '${client.firstName} ${client.lastName}'.toLowerCase();
        return fullName.contains(query) ||
            (client.phone?.toLowerCase().contains(query) ?? false);
      }).toList();
    }

    // Always sort alphabetically
    filtered.sort((a, b) {
      final nameA = '${a.firstName} ${a.lastName}'.trim().toLowerCase();
      final nameB = '${b.firstName} ${b.lastName}'.trim().toLowerCase();
      return nameA.compareTo(nameB);
    });

    return currentState.copyWith(filteredClients: filtered);
  }

  // Group clients by first letter for alphabetical sections
  Map<String, List<ClientModel>> get groupedClients {
    return state.filteredClients.groupBy(
      (client) =>
          client.firstName.isNotEmpty ? client.firstName[0].toUpperCase() : '#',
    );
  }

  void navigateToAddClient() {
    AppNavigator.to(AppRoutes.addEditClient);
  }

  void navigateToClientDetails(ClientModel client) {
    AppNavigator.to('${AppRoutes.clientDetail}/${client.id}');
  }

  Future<void> refresh() async {
    ref.invalidate(clientsStreamProvider);
  }
}
