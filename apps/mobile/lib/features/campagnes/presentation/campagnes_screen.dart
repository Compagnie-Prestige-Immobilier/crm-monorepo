import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../campagnes.dart';

class CampagnesScreen extends ConsumerStatefulWidget {
  const CampagnesScreen({
    super.key,
    this.grandPublic = false,
    this.representantsDabord = false,
  });

  final bool grandPublic;

  /// Arrivée depuis « Qualifier les représentants » : l'onglet Représentants
  /// est déjà celui qu'on regarde.
  final bool representantsDabord;

  @override
  ConsumerState<CampagnesScreen> createState() => _CampagnesScreenState();
}

class _CampagnesScreenState extends ConsumerState<CampagnesScreen> {
  late bool representants = widget.representantsDabord;

  /// Le raccourci vers la file unique ne part qu'une fois : `pushReplacement`
  /// laisse l'écran monté le temps de la transition.
  bool _ouvertureDirecte = false;

  @override
  Widget build(BuildContext context) {
    final bool grandPublic = widget.grandPublic;
    final AsyncValue<List<_CampaignItem>> campagnes = representants
        ? _mapCampaigns(
            ref.watch(repCampagnesProvider),
            (RepCampaignsWithOpenWorkResult row) => _CampaignItem(
              id: row.id,
              name: row.name,
              ouvertes: row.ouvertes,
              spreadDays: row.spreadDays,
            ),
          )
        : _mapCampaigns(
            ref.watch(
              grandPublic
                  ? grandPublicCampagnesProvider
                  : chuesCampagnesProvider,
            ),
            (CampaignsWithOpenWorkResult row) => _CampaignItem(
              id: row.id,
              name: row.name,
              ouvertes: row.ouvertes,
              spreadDays: row.spreadDays,
            ),
          );
    // Les files de représentants ne se voient que depuis l'onglet : le
    // raccourci ne doit pas les rendre inatteignables.
    final List<RepCampaignsWithOpenWorkResult>? repFiles = grandPublic
        ? const <RepCampaignsWithOpenWorkResult>[]
        : ref.watch(repCampagnesProvider).value;
    _peutOuvrirDirectement(campagnes.value, repFiles);

    final bool horsLigne =
        ref.watch(connectivityProvider) != CpiConnectivity.online;

    return CpiPopScope(
      child: CpiScaffold(
        title: 'Appels',
        leading: const CpiBackButton(),
        actions: <Widget>[
          if (representants)
            CpiHeaderAction(
              icon: PhosphorIconsRegular.magnifyingGlass,
              label: 'Chercher un représentant',
              onPressed: () =>
                  context.pushOnce(Routes.representantsPourQualifier()),
            ),
        ],
        banner: horsLigne
            ? const CpiStatusBand(
                text: 'Hors ligne. Liste du dernier téléchargement.',
                tone: CpiTone.warning,
              )
            : null,
        body: Column(
          children: <Widget>[
            if (!grandPublic)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  0,
                  CpiSpacing.md,
                  CpiSpacing.sm,
                ),
                child: Row(
                  spacing: CpiSpacing.xs,
                  children: <Widget>[
                    Expanded(
                      child: _Onglet(
                        label: 'Prospects',
                        icon: PhosphorIconsRegular.identificationCard,
                        selected: !representants,
                        onPress: () => setState(() => representants = false),
                      ),
                    ),
                    Expanded(
                      child: _Onglet(
                        label: 'Représentants',
                        icon: PhosphorIconsRegular.usersThree,
                        selected: representants,
                        onPress: () => setState(() => representants = true),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: _corps(
                campagnes,
                grandPublic: grandPublic,
                representants: representants,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Une seule liste confiée : le téléconseiller n'a aucun choix à faire, la
  /// file s'ouvre directement. `pushReplacement` garde le retour sur l'écran
  /// d'où l'on vient plutôt que de reboucler sur cette liste.
  void _peutOuvrirDirectement(
    List<_CampaignItem>? liste,
    List<RepCampaignsWithOpenWorkResult>? repFiles,
  ) {
    if (_ouvertureDirecte || representants) return;
    if (liste == null || liste.length != 1) return;
    if (repFiles == null || repFiles.isNotEmpty) return;
    final GoRouter? router = GoRouter.maybeOf(context);
    if (router == null) return;

    _ouvertureDirecte = true;
    final String cible = widget.grandPublic
        ? CampagnesRoutes.grandPublicFileFor(liste.single.id)
        : CampagnesRoutes.fileFor(liste.single.id);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.pushReplacement(cible);
    });
  }

  /// L'échec passe AVANT le chargement : Riverpod réessaie indéfiniment une
  /// lecture en défaut, et `when(error:)` laisserait tourner l'indicateur sans
  /// jamais dire au téléconseiller ce qui s'est passé.
  Widget _corps(
    AsyncValue<List<_CampaignItem>> campagnes, {
    required bool grandPublic,
    required bool representants,
  }) {
    final Object? erreur = campagnes.error;
    if (erreur != null) {
      return CpiErrorState(
        message: 'Lecture des campagnes impossible. ${messageErreur(erreur)}',
        onRetry: () => ref.invalidate(
          representants
              ? repCampagnesProvider
              : grandPublic
              ? grandPublicCampagnesProvider
              : chuesCampagnesProvider,
        ),
      );
    }
    final List<_CampaignItem>? list = campagnes.value;
    if (list == null) return const Center(child: FCircularProgress());
    if (list.isEmpty) return _AucuneCampagne(representants: representants);
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        0,
        CpiSpacing.md,
        CpiSpacing.xxl,
      ),
      itemCount: list.length,
      itemBuilder: (BuildContext context, int index) => CpiListEntrance(
        index: index,
        child: Padding(
          padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
          child: _CampagneTile(
            key: ValueKey<String>(list[index].id),
            campagne: list[index],
            grandPublic: grandPublic,
            representants: representants,
          ),
        ),
      ),
    );
  }

  static AsyncValue<List<_CampaignItem>> _mapCampaigns<T>(
    AsyncValue<List<T>> source,
    _CampaignItem Function(T row) convert,
  ) {
    final Object? error = source.error;
    if (error != null) {
      return AsyncError<List<_CampaignItem>>(
        error,
        source.stackTrace ?? StackTrace.current,
      );
    }
    final List<T>? rows = source.value;
    if (rows == null) return const AsyncLoading<List<_CampaignItem>>();
    return AsyncData<List<_CampaignItem>>(
      rows.map(convert).toList(growable: false),
    );
  }
}

class _CampaignItem {
  const _CampaignItem({
    required this.id,
    required this.name,
    required this.ouvertes,
    required this.spreadDays,
  });

  final String id;
  final String name;
  final int ouvertes;
  final int spreadDays;
}

/// Bascule entre les deux files confiées. Deux destinations seulement : des
/// pastilles côte à côte se lisent d'un coup d'œil, sans menu à ouvrir.
class _Onglet extends StatelessWidget {
  const _Onglet({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onPress,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onPress;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: kCpiMinTouchTarget),
    child: FButton(
      variant: selected ? FButtonVariant.primary : FButtonVariant.outline,
      selected: selected,
      onPress: onPress,
      prefix: Icon(icon, size: CpiIconSize.md),
      child: Flexible(
        child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
    ),
  );
}

class _CampagneTile extends StatelessWidget {
  const _CampagneTile({
    super.key,
    required this.campagne,
    required this.grandPublic,
    required this.representants,
  });

  final _CampaignItem campagne;
  final bool grandPublic;
  final bool representants;

  @override
  Widget build(BuildContext context) => CpiCard.rows(<CpiRow>[
    CpiRow(
      leading: const Icon(
        PhosphorIconsDuotone.phoneList,
        size: CpiIconSize.xxl,
      ),
      title: campagne.name,
      subtitle: resteALire(campagne.ouvertes, campagne.spreadDays),
      onTap: () {
        context.pushOnce(
          representants
              ? CampagnesRoutes.repFileFor(campagne.id)
              : grandPublic
              ? CampagnesRoutes.grandPublicFileFor(campagne.id)
              : CampagnesRoutes.fileFor(campagne.id),
        );
      },
    ),
  ]);

  static String resteALire(int ouvertes, int jours) {
    final String fiches = ouvertes == 1 ? '1 fiche' : '$ouvertes fiches';
    if (jours <= 1) return '$fiches à appeler';
    return '$fiches à appeler, réparties sur $jours jours';
  }
}

/// Sans liste reçue, l'écran ne doit pas être un cul-de-sac : le travail se
/// fait quand même depuis « Mes fiches », une fiche à la fois.
class _AucuneCampagne extends ConsumerWidget {
  const _AucuneCampagne({required this.representants});

  final bool representants;

  @override
  Widget build(BuildContext context, WidgetRef ref) => CpiEmptyState(
    icon: PhosphorIconsDuotone.phoneList,
    title: 'Aucune liste d\'appel',
    message: representants
        ? 'Personne ne vous a confié de liste. Cherchez le représentant '
              'par son nom ou son numéro.'
        : 'Personne ne vous a confié de liste. Touchez « Recevoir la liste » '
              'pour vérifier.',
    action: Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (representants) ...<Widget>[
          CpiButton(
            'Chercher un représentant',
            icon: PhosphorIconsRegular.magnifyingGlass,
            expand: false,
            onPressed: () =>
                context.pushOnce(Routes.representantsPourQualifier()),
          ),
          const SizedBox(height: CpiSpacing.sm),
        ],
        CpiButton(
          'Recevoir la liste',
          variant: representants
              ? CpiButtonVariant.ghost
              : CpiButtonVariant.primary,
          icon: PhosphorIconsRegular.cloudArrowDown,
          expand: false,
          onPressed: () =>
              unawaited(ref.read(syncCoordinatorProvider.notifier).run()),
        ),
      ],
    ),
  );
}
