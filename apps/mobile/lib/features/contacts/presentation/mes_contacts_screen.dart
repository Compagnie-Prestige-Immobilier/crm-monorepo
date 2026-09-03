import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/sync/phase2_directory_sync.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../ui/async_value_x.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../phase2/phase2_controller.dart';
import '../../rappels/presentation/rappels_screen.dart' show quandRappeler;
import '../../representant/presentation/representant_detail_screen.dart'
    show libelleIssueRepresentant, relationLabel;

/// Les personnes que J'AI appelées, du plus récent au plus ancien.
///
/// Les rappels ne montrent que ce qui a été promis, et « Injoignables » que les
/// appels sans réponse : un téléconseiller n'avait aucun chemin pour retrouver
/// quelqu'un qu'il venait d'appeler. Le Grand Public n'a pas de représentants :
/// il n'y a rien à mettre en face de l'onglet « Prospects ».
class MesContactsScreen extends ConsumerWidget {
  const MesContactsScreen({super.key, this.grandPublic = false});

  final bool grandPublic;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String retour = grandPublic ? Routes.grandPublic : Routes.chues;
    final Widget prospects = _Liste(
      contacts: ref.watch(mesContactsProspectsProvider(grandPublic)),
      onRetry: () => ref.invalidate(mesContactsProspectsProvider(grandPublic)),
      route: Routes.prospectDetailFor,
      libelleIssue: _issueProspect,
      libelleStatut: Phase2Controller.labelForStatus,
    );

    return CpiPopScope(
      fallback: retour,
      child: CpiScaffold(
        title: 'Mes contacts',
        subtitle: 'Les personnes que vous avez appelées',
        leading: canPopHere(context) ? CpiBackButton(fallback: retour) : null,
        body: grandPublic
            ? prospects
            : FTabs(
                expands: true,
                children: <FTabEntry>[
                  FTabEntry(label: const Text('Prospects'), child: prospects),
                  FTabEntry(
                    label: const Text('Représentants'),
                    child: _Liste(
                      contacts: ref.watch(mesContactsRepresentantsProvider),
                      onRetry: () =>
                          ref.invalidate(mesContactsRepresentantsProvider),
                      route: Routes.representantDetailFor,
                      libelleIssue: libelleIssueRepresentant,
                      libelleStatut: relationLabel,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// Les six motifs système portent déjà les libellés du terrain.
String _issueProspect(String code) =>
    SystemCallReasons.byCode[code]?.label ?? code;

class _Liste extends ConsumerWidget {
  const _Liste({
    required this.contacts,
    required this.onRetry,
    required this.route,
    required this.libelleIssue,
    required this.libelleStatut,
  });

  final AsyncValue<List<Contact>> contacts;
  final VoidCallback onRetry;
  final String Function(String id) route;
  final String Function(String code) libelleIssue;
  final String Function(String code) libelleStatut;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final DateTime maintenant = ref.watch(clockProvider).now();
    return contacts.whenEchecDAbord(
      loading: () =>
          const Center(child: FCircularProgress(semanticsLabel: 'Chargement')),
      error: (Object error, StackTrace _) => CpiErrorState(
        message: 'Les contacts n\'ont pas pu être lus. ${messageErreur(error)}',
        onRetry: onRetry,
      ),
      data: (List<Contact> rows) {
        if (rows.isEmpty) return const _Vide();
        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            CpiSpacing.sm,
            CpiSpacing.md,
            CpiSpacing.xxl,
          ),
          itemCount: rows.length,
          itemBuilder: (BuildContext context, int index) => Padding(
            padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
            child: _ContactTile(
              key: ValueKey<String>(rows[index].id),
              contact: rows[index],
              maintenant: maintenant,
              destination: route(rows[index].id),
              libelleIssue: libelleIssue,
              libelleStatut: libelleStatut,
            ),
          ),
        );
      },
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({
    super.key,
    required this.contact,
    required this.maintenant,
    required this.destination,
    required this.libelleIssue,
    required this.libelleStatut,
  });

  final Contact contact;
  final DateTime maintenant;
  final String destination;
  final String Function(String code) libelleIssue;
  final String Function(String code) libelleStatut;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;
    final String phone = Phone.format(contact.phoneE164);
    final DateTime? at = contact.at;
    final String quand = at == null
        ? 'Dernier appel : date inconnue'
        : 'Dernier appel : ${quandRappeler(context, at, maintenant)}';
    final String? issue = contact.issue;
    final String statut = contact.statutLabel ?? libelleStatut(contact.statut);

    void ouvrir() {
      HapticFeedback.selectionClick().ignore();
      context.pushOnce(destination);
    }

    return Semantics(
      button: true,
      onTap: ouvrir,
      label:
          '${contact.nom}. $phone. $quand. '
          '${issue == null ? '' : '${libelleIssue(issue)}. '}$statut.',
      child: ExcludeSemantics(
        child: CpiCard(
          onTap: ouvrir,
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      contact.nom,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(
                      phone,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.xs),
                    Text(
                      quand,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.xs),
                    Wrap(
                      spacing: CpiSpacing.xs,
                      runSpacing: CpiSpacing.xxs,
                      children: <Widget>[
                        if (issue != null) CpiTag(libelleIssue(issue)),
                        if (contact.statut == 'AMBASSADEUR')
                          Icon(
                            PhosphorIconsFill.star,
                            size: CpiIconSize.xs,
                            color: context.cpi.success,
                          ),
                        CpiTag(statut),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: CpiSpacing.xs),
              Icon(
                PhosphorIconsRegular.caretRight,
                size: CpiIconSize.xl,
                color: scheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Vide extends StatelessWidget {
  const _Vide();

  @override
  Widget build(BuildContext context) => const CpiEmptyState(
    icon: PhosphorIconsDuotone.phoneCall,
    title: 'Aucun appel consigné.',
    message: 'Les personnes que vous appelez apparaissent ici.',
  );
}
