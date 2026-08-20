import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../auth/auth_state.dart';
import '../visites_repository.dart';
import 'visite_form_screen.dart';

class RegistreScreen extends ConsumerWidget {
  const RegistreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final AuthState auth = ref.watch(authControllerProvider);
    final AsyncValue<List<VisiteDto>> registre = ref.watch(registreDuJourProvider);

    if (!peutTenirLeRegistre(auth.role)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Registre des visites')),
        body: Padding(
          padding: const EdgeInsets.all(CpiSpacing.xl),
          child: Center(
            child: Text(
              'Ce compte ne tient pas le registre des visites. '
              'Demandez l\'accès à la direction.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Registre des visites'),
        actions: <Widget>[
          IconButton(
            onPressed: () => ref.invalidate(registreDuJourProvider),
            tooltip: 'Actualiser',
            icon: const Icon(PhosphorIconsRegular.arrowClockwise),
          ),
          const SizedBox(width: CpiSpacing.xxs),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              child: RefreshIndicator(
                color: theme.colorScheme.primary,
                onRefresh: () async {
                  await HapticFeedback.selectionClick();
                  ref.invalidate(registreDuJourProvider);
                  await ref.read(registreDuJourProvider.future);
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(
                    CpiSpacing.md,
                    CpiSpacing.md,
                    CpiSpacing.md,
                    CpiSpacing.md,
                  ),
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: <Widget>[
                    const RegistreEnLigneSeulement(),
                    ...switch (registre) {
                      AsyncError<List<VisiteDto>>(:final Object error) =>
                        <Widget>[
                          BandeauEchec(
                            message:
                                'Le registre du jour n\'a pas pu être lu. '
                                '${messageErreur(error)}',
                          ),
                          const SizedBox(height: CpiSpacing.xs),
                          OutlinedButton.icon(
                            onPressed: () => ref.invalidate(registreDuJourProvider),
                            icon: const Icon(
                              PhosphorIconsRegular.arrowClockwise,
                              size: 20,
                            ),
                            label: const Text('Réessayer'),
                          ),
                        ],
                      AsyncData<List<VisiteDto>>(:final List<VisiteDto> value) =>
                        value.isEmpty
                            ? const <Widget>[_RegistreVide()]
                            : <Widget>[
                                _Compte(nombre: value.length),
                                const SizedBox(height: CpiSpacing.xs),
                                for (final VisiteDto visite in value)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      bottom: CpiSpacing.xs,
                                    ),
                                    child: _LigneVisite(visite: visite),
                                  ),
                              ],
                      _ => const <Widget>[_RegistreEnCours()],
                    },
                  ],
                ),
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.xs,
                CpiSpacing.md,
                CpiSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
              ),
              child: FilledButton.icon(
                onPressed: () {
                  HapticFeedback.selectionClick().ignore();
                  Navigator.of(context)
                      .push<void>(
                        MaterialPageRoute<void>(
                          builder: (BuildContext context) => const VisiteFormScreen(),
                        ),
                      )
                      .ignore();
                },
                icon: const Icon(PhosphorIconsRegular.userPlus, size: 22),
                label: const Text('Inscrire un visiteur'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Compte extends StatelessWidget {
  const _Compte({required this.nombre});

  final int nombre;

  @override
  Widget build(BuildContext context) {
    return Text(
      nombre == 1 ? '1 visite aujourd\'hui' : '$nombre visites aujourd\'hui',
      style: Theme.of(context).textTheme.titleMedium,
    );
  }
}

class _LigneVisite extends StatelessWidget {
  const _LigneVisite({required this.visite});

  final VisiteDto visite;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String heure = visite.time ?? '--:--';
    final List<String> details = <String>[
      visite.entreprise.label,
      visite.objet.label,
      if (visite.destinataire != null) visite.destinataire!.label,
      if (visite.direction != null) visite.direction!.label,
    ];

    return Container(
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        borderRadius: CpiRadius.brLg,
        border: Border.all(color: context.cpi.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              Text(heure, style: theme.textTheme.titleMedium),
              const SizedBox(width: CpiSpacing.xs),
              Expanded(
                child: Text(
                  visite.reference,
                  textAlign: TextAlign.end,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: CpiSpacing.xxs),
          Text(visite.visitorName, style: theme.textTheme.titleMedium),
          const SizedBox(height: CpiSpacing.xxs),
          Text(
            details.join(' · '),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          if (visite.phone != null) ...<Widget>[
            const SizedBox(height: CpiSpacing.xxs),
            Text(visite.phone!, style: theme.textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}

class _RegistreVide extends StatelessWidget {
  const _RegistreVide();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: CpiSpacing.xxl),
      child: Column(
        children: <Widget>[
          Icon(
            PhosphorIconsRegular.clipboardText,
            size: 48,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: CpiSpacing.sm),
          Text(
            'Aucune visite inscrite aujourd\'hui',
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: CpiSpacing.xxs),
          Text(
            'Inscrivez le premier visiteur avec le bouton du bas.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _RegistreEnCours extends StatelessWidget {
  const _RegistreEnCours();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: CpiSpacing.xxl),
      child: Center(child: CircularProgressIndicator()),
    );
  }
}
