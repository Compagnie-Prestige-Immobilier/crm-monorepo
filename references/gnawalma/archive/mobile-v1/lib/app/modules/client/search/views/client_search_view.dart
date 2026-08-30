import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/location/location_service.dart';
import '../../../../core/network/network_providers.dart';
import '../../../../shared/constants/atelier_specialties.dart';
import '../../../../shared/widgets/forms/custom_dropdown.dart';
import '../../../setup_wizard/domain/atelier_regions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/widgets/forms/premium_search_bar.dart';
import '../../../../shared/widgets/inputs/app_filter_chip.dart';
import '../../../../shared/widgets/inputs/voice_search_button.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../discovery/controllers/marketplace_providers.dart';
import '../../discovery/domain/marketplace_atelier.dart';
import '../../shared/client_categories.dart';
import '../../shared/widgets/client_ui.dart';
import '../../shared/widgets/marketplace_atelier_card.dart';

/// Search results.
///
/// Pushed from the field on Accueil rather than living in a tab, so the back
/// gesture returns to the home feed with its scroll position intact instead of
/// switching workspace sections.
class ClientSearchView extends ConsumerStatefulWidget {
  const ClientSearchView({super.key, this.initialQuery, this.initialSpecialty});

  /// Free text typed on the previous screen.
  final String? initialQuery;

  /// A category term carried in from the home rail.
  final String? initialSpecialty;

  @override
  ConsumerState<ClientSearchView> createState() => _ClientSearchViewState();
}

class _ClientSearchViewState extends ConsumerState<ClientSearchView> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  late final bool _autofocus;

  /// Rayon choisi, ou `null` pour « partout ».
  ///
  /// Nul par défaut : §2.1 range la distance parmi les filtres, à côté du type
  /// de vêtement et de la note. Un rayon imposé faisait échouer la recherche
  /// par nom sans jamais dire que la distance en était la cause.
  int? _radiusMeters;

  /// Région administrative choisie, ou `null` pour tout le pays.
  String? _region;

  /// Homme, Femme ou Enfant. `null` = sans préférence.
  String? _specialty;

  int get _activeFilters =>
      (_radiusMeters == null ? 0 : 1) +
      (_region == null ? 0 : 1) +
      (_specialty == null ? 0 : 1);

  @override
  void initState() {
    super.initState();
    // `?specialite=` portait une valeur que rien ne transmettait, et qui
    // atterrissait dans le champ texte. Quand elle nomme une spécialité, elle
    // règle le filtre ; sinon elle reste un terme de recherche.
    final specialty = widget.initialSpecialty?.trim();
    if (specialty != null && AtelierSpecialties.all.contains(specialty)) {
      _specialty = specialty;
    }
    final seed =
        (widget.initialQuery ?? (_specialty == null ? specialty : null))
            ?.trim() ??
        '';
    // Only focus when arriving with nothing to show. Opening the keyboard
    // over a list of results the user asked for by tapping a category would
    // hide the very thing they came to see.
    _autofocus = seed.isEmpty;
    if (seed.isNotEmpty) {
      _query = seed;
      _searchController.text = seed;
    }
  }

  MarketplaceSearchQuery _searchFrom(LocationState location) =>
      MarketplaceSearchQuery(
        latitude: location.latitude,
        longitude: location.longitude,
        text: _query.trim().isEmpty ? null : _query.trim(),
        region: _region,
        specialty: _specialty,
        // Un rayon n'a de sens que mesuré depuis quelque part.
        radiusMeters: location.hasPosition ? _radiusMeters : null,
        limit: 40,
      );

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() => _query = value.trim());
    });
  }

  void _applySuggestion(String value) {
    _searchController.value = TextEditingValue(
      text: value,
      selection: TextSelection.collapsed(offset: value.length),
    );
    _debounce?.cancel();
    setState(() => _query = value);
    FocusManager.instance.primaryFocus?.unfocus();
  }

  void _clearSearch() {
    _debounce?.cancel();
    setState(() => _query = '');
  }

  @override
  Widget build(BuildContext context) {
    final location = ref.watch(locationControllerProvider);
    final hasPosition = location.hasPosition;
    final search = _searchFrom(location);
    final results = ref.watch(marketplaceSearchProvider(search));
    final online = ref.watch(networkAvailabilityProvider).asData?.value ?? true;

    return Scaffold(
      appBar: AppBar(title: const Text('Trouver un atelier')),
      body: SafeArea(
        top: false,
        bottom: false,
        child: Column(
          children: [
            if (!online) const ClientOfflineBanner(),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                0,
                AppSpacing.gutter,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: PremiumSearchBar(
                      controller: _searchController,
                      autofocus: _autofocus,
                      hintText: 'Robe, boubou, retouche, atelier…',
                      isLoading: results.isLoading && !results.isRefreshing,
                      onChanged: _onQueryChanged,
                      onClear: _clearSearch,
                      onSubmitted: (value) {
                        _debounce?.cancel();
                        setState(() => _query = value.trim());
                        FocusManager.instance.primaryFocus?.unfocus();
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  // §2.5 : la barre de recherche doit accepter la parole, pas
                  // seulement la frappe — c'est le public que ce produit vise.
                  VoiceSearchButton(onResult: _applySuggestion),
                  const SizedBox(width: AppSpacing.xs),
                  Badge(
                    isLabelVisible: _activeFilters > 0,
                    label: Text('$_activeFilters'),
                    // Ink, not error red. A changed search radius is a state, not
                    // a fault, and red here was a second saturated hue on a screen
                    // that already spends its accent on the result cards.
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    child: IconButton.filledTonal(
                      tooltip: 'Filtrer les résultats',
                      onPressed: () => _showFilters(hasPosition),
                      icon: const Icon(Icons.tune_rounded),
                      style: IconButton.styleFrom(
                        minimumSize: const Size(52, 52),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // The same taxonomy as the home rail, with the arriving category
            // shown as selected. These used to be six different words from the
            // six on the home screen, so tapping "Cérémonie" at home landed on a
            // screen that offered "Robe, Boubou, Bazin…" and no way to see which
            // filter was actually applied.
            SizedBox(
              height: MediaQuery.textScalerOf(
                context,
              ).clamp(maxScaleFactor: 1.6).scale(48),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.gutter,
                ),
                itemCount: ClientCategories.all.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.xs),
                itemBuilder: (_, index) {
                  final category = ClientCategories.all[index];
                  final selected = _query.trim().toLowerCase() == category.term;
                  return AppFilterChip(
                    selected: selected,
                    icon: category.icon,
                    label: category.label,
                    onSelected: (value) => value
                        ? _applySuggestion(category.term)
                        : _clearSearch(),
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(marketplaceSearchProvider(search));
                  await ref.read(marketplaceSearchProvider(search).future);
                },
                child: results.when(
                  loading: () => const CustomScrollView(
                    physics: AlwaysScrollableScrollPhysics(),
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    slivers: [
                      SliverToBoxAdapter(
                        child: ClientLoadingList(itemCount: 5),
                      ),
                    ],
                  ),
                  error: (_, _) => CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    slivers: [
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: ClientStatePanel(
                          icon: Icons.cloud_off_rounded,
                          title: 'Recherche indisponible',
                          message:
                              'Les résultats n’ont pas pu être chargés. Vérifiez la connexion puis réessayez.',
                          actionLabel: 'Réessayer',
                          onAction: () =>
                              ref.invalidate(marketplaceSearchProvider(search)),
                          secondaryActionLabel: _query.isEmpty
                              ? null
                              : 'Effacer la recherche',
                          onSecondaryAction: _query.isEmpty
                              ? null
                              : _clearSearch,
                        ),
                      ),
                    ],
                  ),
                  data: (items) => _buildResults(context, items),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResults(BuildContext context, List<MarketplaceAtelier> items) {
    if (items.isEmpty) {
      // A no-result search is the screen, so it gets the drawing and two ways
      // out: widen the zone, or drop the term.
      final canWiden = _radiusMeters != null;
      return CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        slivers: [
          SliverFillRemaining(
            hasScrollBody: false,
            child: ClientStatePanel(
              motif: AtelierMotif.search,
              icon: Icons.search_off_rounded,
              title: _query.isEmpty
                  ? 'Aucun atelier dans cette zone'
                  : 'Rien pour « $_query »',
              message: canWiden
                  ? 'Vous cherchez dans un rayon limité. Essayez partout, ou simplifiez le terme.'
                  : 'Aucun atelier publié ne correspond à ces critères pour le moment.',
              actionLabel: canWiden
                  ? 'Chercher partout'
                  : 'Effacer la recherche',
              actionIcon: canWiden
                  ? Icons.radar_rounded
                  : Icons.refresh_rounded,
              onAction: canWiden
                  ? () => setState(() => _radiusMeters = null)
                  : _clearSearch,
              secondaryActionLabel: canWiden && _query.isNotEmpty
                  ? 'Effacer la recherche'
                  : null,
              onSecondaryAction: canWiden && _query.isNotEmpty
                  ? _clearSearch
                  : null,
            ),
          ),
        ],
      );
    }

    return CustomScrollView(
      key: const PageStorageKey('client-search-results'),
      physics: const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      slivers: [
        SliverToBoxAdapter(
          child: ClientListCaption(
            label:
                '${items.length} atelier${items.length == 1 ? '' : 's'} trouvé${items.length == 1 ? '' : 's'}',
            trailing: _radiusMeters == null
                ? 'Partout'
                : 'Rayon ${_radiusLabel(_radiusMeters!)}',
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            0,
            AppSpacing.gutter,
            AppSpacing.sectionSpacing,
          ),
          sliver: SliverList.separated(
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
            itemBuilder: (_, index) =>
                MarketplaceAtelierCard(atelier: items[index], horizontal: true),
          ),
        ),
      ],
    );
  }

  Future<void> _showFilters(bool hasPosition) async {
    var draftRadius = _radiusMeters;
    var draftRegion = _region;
    var draftSpecialty = _specialty;

    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            0,
            AppSpacing.md,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AppSectionHeader(
                  title: 'Filtrer les ateliers',
                  subtitle:
                      'Le nom, le quartier et le type de vêtement se cherchent dans la barre ; ici on restreint.',
                  icon: Icons.tune_rounded,
                  accentColor: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: AppSpacing.md),
                CustomDropdown<String>(
                  label: 'Région',
                  hint: 'Toutes les régions',
                  value: draftRegion,
                  items: [
                    _anyRegion,
                    ...AtelierRegions.all.map((region) => region.label),
                  ],
                  itemLabelBuilder: (label) => label,
                  prefixIcon: const Icon(Icons.map_outlined),
                  onChanged: (label) => setModalState(
                    () => draftRegion = label == _anyRegion ? null : label,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Spécialité',
                  style: Theme.of(context).textTheme.labelLarge,
                ),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: AtelierSpecialties.all
                      .map(
                        (specialty) => FilterChip(
                          label: Text(specialty),
                          selected: draftSpecialty == specialty,
                          onSelected: (selected) => setModalState(
                            () => draftSpecialty = selected ? specialty : null,
                          ),
                        ),
                      )
                      .toList(growable: false),
                ),
                const SizedBox(height: AppSpacing.md),
                // Un rayon sans position ne veut rien dire : la distance se
                // mesure depuis quelque part.
                if (hasPosition) ...[
                  Text(
                    'Distance',
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  SegmentedButton<int>(
                    showSelectedIcon: false,
                    segments: const [-1, 5_000, 15_000, 30_000, 50_000]
                        .map(
                          (radius) => ButtonSegment<int>(
                            value: radius,
                            label: Text(
                              radius < 0 ? 'Partout' : _radiusLabel(radius),
                            ),
                          ),
                        )
                        .toList(),
                    selected: {draftRadius ?? -1},
                    onSelectionChanged: (selection) => setModalState(
                      () => draftRadius = selection.first < 0
                          ? null
                          : selection.first,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    _radiusDescription(draftRadius),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ] else
                  const AppStatusBanner(
                    message:
                        'Partagez votre position depuis l’accueil pour filtrer par distance.',
                    icon: Icons.near_me_outlined,
                    tone: AppStatusTone.info,
                  ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => setModalState(() {
                          draftRadius = null;
                          draftRegion = null;
                          draftSpecialty = null;
                        }),
                        child: const Text('Tout effacer'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      flex: 2,
                      child: FilledButton.icon(
                        onPressed: () => Navigator.pop(context, true),
                        icon: const Icon(Icons.search_rounded),
                        label: const Text('Afficher les résultats'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (applied == true && mounted) {
      setState(() {
        _radiusMeters = draftRadius;
        _region = draftRegion;
        _specialty = draftSpecialty;
      });
    }
  }

  static const _anyRegion = 'Toutes les régions';

  static String _radiusLabel(int radius) => '${radius ~/ 1000} km';

  static String _radiusDescription(int? radius) => switch (radius) {
    null => 'Tout le Sénégal, classé par distance',
    5_000 => 'À proximité immédiate',
    15_000 => 'Zone recommandée autour de Dakar',
    30_000 => 'Choix plus large',
    _ => 'Zone étendue, déplacements plus longs',
  };
}
