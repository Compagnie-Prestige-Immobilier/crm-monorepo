import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/add_edit_project_provider.dart';

/// One way in: the client file. The provisional name is a fallback, offered
/// only once a search has come back empty, so the step never holds two
/// competing answers to "who is this for".
class ProjectClientStep extends ConsumerStatefulWidget {
  const ProjectClientStep({super.key});

  @override
  ConsumerState<ProjectClientStep> createState() => _ProjectClientStepState();
}

class _ProjectClientStepState extends ConsumerState<ProjectClientStep> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  String _query = '';
  bool _manualEntry = false;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onQueryChanged);
  }

  @override
  void dispose() {
    _searchController
      ..removeListener(_onQueryChanged)
      ..dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _onQueryChanged() {
    final query = _searchController.text.trim();
    if (query == _query) return;
    setState(() => _query = query);
  }

  AddEditProject get _notifier => ref.read(addEditProjectProvider().notifier);

  void _selectClient(ClientModel client) {
    _notifier.selectClient(client);
    _searchController.text = client.displayName;
    _searchFocus.unfocus();
    setState(() => _manualEntry = false);
  }

  void _startManualEntry() {
    final controller = _notifier.clientNameController;
    if (controller.text.trim().isEmpty) controller.text = _query;
    setState(() => _manualEntry = true);
  }

  List<ClientModel> _matches(List<ClientModel> clients) {
    final query = _query.toLowerCase();
    return clients
        .where((client) => client.displayName.toLowerCase().contains(query))
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(addEditProjectProvider());
    final selected = state.selectedClient;
    final searching = _query.length >= 2;
    final matches = searching ? _matches(state.clients) : const <ClientModel>[];
    final recents = state.clients.take(3).toList(growable: false);

    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      children: [
        const AppSectionHeader(
          title: 'À qui appartient cet article ?',
          subtitle:
              'Retrouvez un client existant pour réutiliser ses coordonnées et mesures.',
          icon: Icons.person_search_rounded,
        ),
        const SizedBox(height: AppSpacing.md),
        if (selected != null) ...[
          AppStatusBanner(
            title: selected.displayName,
            message:
                'Client sélectionné. Ses mesures pourront être reprises à l’étape dédiée.',
            icon: Icons.check_circle_rounded,
            tone: AppStatusTone.success,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        AppSectionSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Rechercher dans le fichier client',
                style: AppTextStyles.h5.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Saisissez au moins deux lettres du nom.',
                style: AppTextStyles.bodySmall.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (state.isLoadingClients)
                const LinearProgressIndicator(minHeight: 3)
              else ...[
                TextField(
                  controller: _searchController,
                  focusNode: _searchFocus,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    labelText: 'Nom du client',
                    hintText: 'Ex. Awa Ndiaye',
                    prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: _query.isEmpty
                        ? null
                        : IconButton(
                            onPressed: _searchController.clear,
                            tooltip: 'Effacer la recherche',
                            icon: const Icon(Icons.close_rounded),
                          ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (!searching)
                  _ClientList(
                    title: 'Clients récents',
                    clients: recents,
                    selectedId: selected?.id,
                    onSelected: _selectClient,
                    emptyMessage:
                        'Aucun client enregistré pour l’instant. Saisissez un nom pour continuer.',
                    emptyAction: _manualEntry ? null : _startManualEntry,
                  )
                else if (matches.isNotEmpty)
                  _ClientList(
                    title:
                        '${matches.length} résultat${matches.length == 1 ? '' : 's'}',
                    clients: matches,
                    selectedId: selected?.id,
                    onSelected: _selectClient,
                  )
                else
                  _NoMatch(
                    query: _query,
                    onUseProvisionalName: selected != null || _manualEntry
                        ? null
                        : _startManualEntry,
                  ),
              ],
            ],
          ),
        ),
        if (_manualEntry && selected == null) ...[
          const SizedBox(height: AppSpacing.md),
          AppSectionSurface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Client non enregistré',
                  style: AppTextStyles.h5.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Sa fiche sera créée avec ce nom provisoire, à compléter plus tard.',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _notifier.clientNameController,
                  autofocus: true,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.done,
                  decoration: const InputDecoration(
                    labelText: 'Nom provisoire *',
                    hintText: 'Prénom et nom',
                    prefixIcon: Icon(Icons.person_add_alt_1_rounded),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }
}

class _ClientList extends StatelessWidget {
  const _ClientList({
    required this.title,
    required this.clients,
    required this.onSelected,
    this.selectedId,
    this.emptyMessage,
    this.emptyAction,
  });

  final String title;
  final List<ClientModel> clients;
  final ValueChanged<ClientModel> onSelected;
  final int? selectedId;
  final String? emptyMessage;
  final VoidCallback? emptyAction;

  @override
  Widget build(BuildContext context) {
    if (clients.isEmpty) {
      if (emptyMessage == null) return const SizedBox.shrink();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            emptyMessage!,
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          if (emptyAction != null) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: emptyAction,
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Text('Saisir un nom provisoire'),
            ),
          ],
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: AppTextStyles.caption.copyWith(
            color: context.textSecondaryColor,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        ...clients.map(
          (client) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: _ClientTile(
              client: client,
              selected: selectedId == client.id,
              onTap: () => onSelected(client),
            ),
          ),
        ),
      ],
    );
  }
}

class _ClientTile extends StatelessWidget {
  const _ClientTile({
    required this.client,
    required this.selected,
    required this.onTap,
  });

  final ClientModel client;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      onTap: onTap,
      selected: selected,
      accentColor: Theme.of(context).colorScheme.primary,
      semanticLabel: selected
          ? '${client.displayName}, client sélectionné'
          : 'Sélectionner ${client.displayName}',
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: context.surfaceLightColor,
            foregroundColor: context.textSecondaryColor,
            child: Text(client.initials),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  client.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyLarge.copyWith(
                    color: context.textPrimaryColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  client.phone ?? 'Aucun numéro renseigné',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            selected ? Icons.check_rounded : Icons.chevron_right_rounded,
            color: selected
                ? context.textPrimaryColor
                : context.textSecondaryColor,
          ),
        ],
      ),
    );
  }
}

class _NoMatch extends StatelessWidget {
  const _NoMatch({required this.query, this.onUseProvisionalName});

  final String query;
  final VoidCallback? onUseProvisionalName;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Aucun client ne correspond à « $query ».',
          style: AppTextStyles.bodySmall.copyWith(
            color: context.textSecondaryColor,
          ),
        ),
        if (onUseProvisionalName != null) ...[
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: onUseProvisionalName,
            icon: const Icon(Icons.person_add_alt_1_rounded),
            label: Text('Continuer avec « $query »'),
          ),
        ],
      ],
    );
  }
}
