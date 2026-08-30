import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart' hide Path;

import '../../../../routes/app_routes.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../../../core/location/location_service.dart';
import '../../discovery/controllers/marketplace_providers.dart';
import '../../discovery/domain/marketplace_atelier.dart';
import '../../shared/widgets/client_ui.dart';
import '../domain/map_tiles.dart';

/// La carte des couturiers (§2.1).
///
/// Une liste répond à « lequel », une carte répond à « où » — et dans une ville
/// où l'on se repère par quartier plutôt que par adresse, c'est souvent la
/// seconde question qui décide. Le cahier des charges la demande au même rang
/// que la recherche, et elle n'existait pas.
class ClientMapView extends ConsumerStatefulWidget {
  const ClientMapView({super.key});

  @override
  ConsumerState<ClientMapView> createState() => _ClientMapViewState();
}

class _ClientMapViewState extends ConsumerState<ClientMapView> {
  final _controller = MapController();

  /// Pas de rayon : la carte montre ce qui existe, et c'est le déplacement de
  /// la carte qui fait office de filtre de distance.
  static const _query = MarketplaceSearchQuery(limit: 50);

  /// Point de repli de la carte, quand ni la position de l'utilisateur ni un
  /// atelier placé ne donnent de centre. C'est un défaut d'affichage, pas une
  /// position supposée : aucune distance n'en est déduite.
  static const _mapFallbackCenter = LatLng(14.7167, -17.4677);

  String? _selectedId;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ateliers = ref.watch(marketplaceSearchProvider(_query));
    final brightness = Theme.of(context).brightness;

    return Scaffold(
      body: ateliers.when(
        loading: () =>
            const Center(child: CircularProgressIndicator.adaptive()),
        error: (_, _) => SafeArea(
          child: ClientStatePanel(
            motif: AtelierMotif.search,
            icon: Icons.map_outlined,
            title: 'Carte indisponible',
            message:
                'Les ateliers n’ont pas pu être chargés. Vérifiez la connexion puis réessayez.',
            actionLabel: 'Réessayer',
            onAction: () => ref.invalidate(marketplaceSearchProvider(_query)),
          ),
        ),
        data: (items) => _buildMap(context, items, brightness),
      ),
    );
  }

  Widget _buildMap(
    BuildContext context,
    List<MarketplaceAtelier> items,
    Brightness brightness,
  ) {
    final location = ref.watch(locationControllerProvider);
    // Les ateliers sans coordonnées n'apparaissent dans aucune recherche non
    // plus ; ils ne peuvent simplement pas être placés.
    final placed = items
        .where((item) => item.latitude != null && item.longitude != null)
        .toList(growable: false);
    final selected = placed
        .where((item) => item.id == _selectedId)
        .cast<MarketplaceAtelier?>()
        .firstWhere((item) => true, orElse: () => null);

    return Stack(
      children: [
        FlutterMap(
          mapController: _controller,
          options: MapOptions(
            initialCenter: location.hasPosition
                ? LatLng(location.latitude!, location.longitude!)
                : placed.isEmpty
                ? _mapFallbackCenter
                : LatLng(placed.first.latitude!, placed.first.longitude!),
            initialZoom: 12.5,
            minZoom: 5,
            maxZoom: 18,
            // Toucher le fond referme la fiche : c'est le geste attendu, et
            // sans lui la fiche masque la carte que l'on essaie de lire.
            onTap: (_, _) => setState(() => _selectedId = null),
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: MapTiles.urlFor(brightness),
              subdomains: MapTiles.subdomains,
              userAgentPackageName: MapTiles.userAgentPackageName,
              retinaMode: RetinaMode.isHighDensity(context),
            ),
            MarkerLayer(
              markers: [
                for (final atelier in placed)
                  Marker(
                    point: LatLng(atelier.latitude!, atelier.longitude!),
                    width: 46,
                    height: 46,
                    alignment: Alignment.topCenter,
                    child: _AtelierPin(
                      atelier: atelier,
                      selected: atelier.id == _selectedId,
                      onTap: () => _select(atelier),
                    ),
                  ),
              ],
            ),
            const _Attribution(),
          ],
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.gutter),
            child: Align(
              alignment: Alignment.topLeft,
              child: _MapBadge(
                label: placed.isEmpty
                    ? 'Aucun atelier situé'
                    : '${placed.length} atelier${placed.length == 1 ? '' : 's'} sur la carte',
              ),
            ),
          ),
        ),
        if (selected != null)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.gutter),
                child: _SelectedAtelierCard(
                  atelier: selected,
                  onOpen: () => context.push(
                    '${AppRoutes.clientAtelierDetail}/${selected.id}',
                  ),
                  onClose: () => setState(() => _selectedId = null),
                ),
              ),
            ),
          ),
      ],
    );
  }

  void _select(MarketplaceAtelier atelier) {
    setState(() => _selectedId = atelier.id);
    // Recentre sur l'atelier choisi, en laissant de la place à la fiche qui
    // s'ouvre en bas : sinon la pastille sélectionnée finit dessous.
    _controller.move(
      LatLng(atelier.latitude! - 0.006, atelier.longitude!),
      _controller.camera.zoom.clamp(13.0, 18.0),
    );
  }
}

/// Une pastille d'atelier.
///
/// Encre pleine, initiale en réserve : sur un fond désaturé c'est le seul objet
/// sombre de l'écran, donc lisible sans couleur criarde. La sélection agrandit
/// et passe à l'accent, plutôt que d'ajouter un halo.
class _AtelierPin extends StatelessWidget {
  const _AtelierPin({
    required this.atelier,
    required this.selected,
    required this.onTap,
  });

  final MarketplaceAtelier atelier;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fill = selected ? scheme.primary : scheme.onSurface;
    return Semantics(
      button: true,
      label: '${atelier.name}, ${atelier.distanceLabel}',
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: selected ? 38 : 30,
              height: selected ? 38 : 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: fill,
                shape: BoxShape.circle,
                border: Border.all(color: scheme.surface, width: 2.5),
              ),
              child: Text(
                atelier.name.characters.first.toUpperCase(),
                style: AppTextStyles.label.copyWith(
                  color: scheme.surface,
                  fontSize: selected ? 15 : 13,
                ),
              ),
            ),
            // La pointe : sans elle, une pastille ronde flotte au-dessus du
            // lieu au lieu de le désigner.
            CustomPaint(
              size: const Size(10, 7),
              painter: _PinTipPainter(color: fill),
            ),
          ],
        ),
      ),
    );
  }
}

class _PinTipPainter extends CustomPainter {
  const _PinTipPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_PinTipPainter oldDelegate) => oldDelegate.color != color;
}

/// La fiche qui s'ouvre sous la pastille choisie.
class _SelectedAtelierCard extends StatelessWidget {
  const _SelectedAtelierCard({
    required this.atelier,
    required this.onOpen,
    required this.onClose,
  });

  final MarketplaceAtelier atelier;
  final VoidCallback onOpen;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final travel = TravelEstimate.label(atelier.distanceMeters);
    return Material(
      color: scheme.surface,
      borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.cardPadding),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      atelier.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      atelier.primarySpecialty,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Row(
                      children: [
                        Icon(
                          Icons.place_outlined,
                          size: 15,
                          color: context.textSecondaryColor,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          atelier.distanceLabel,
                          style: AppTextStyles.caption.copyWith(
                            color: context.textSecondaryColor,
                          ),
                        ),
                        if (travel != null) ...[
                          const SizedBox(width: AppSpacing.sm),
                          Icon(
                            Icons.directions_car_outlined,
                            size: 15,
                            color: context.textSecondaryColor,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            travel,
                            style: AppTextStyles.caption.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Fermer',
                onPressed: onClose,
                icon: const Icon(Icons.close_rounded),
              ),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapBadge extends StatelessWidget {
  const _MapBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCircular),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Text(
        label,
        style: AppTextStyles.label.copyWith(color: scheme.onSurface),
      ),
    );
  }
}

/// Attribution ODbL/CARTO. Obligatoire, donc jamais masquée.
class _Attribution extends StatelessWidget {
  const _Attribution();

  @override
  Widget build(BuildContext context) {
    return RichAttributionWidget(
      showFlutterMapAttribution: false,
      attributions: const [TextSourceAttribution(MapTiles.attribution)],
    );
  }
}
