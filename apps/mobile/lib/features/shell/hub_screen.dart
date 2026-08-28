import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/route_memory.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../ui/widgets/cpi_kit.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_state.dart';
import 'projects.dart';

class HubScreen extends ConsumerWidget {
  const HubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);
    // Une tuile verrouillée n'apprenait rien : elle promettait une porte que le
    // rôle ne peut pas ouvrir. Le hub ne montre que ce qui s'ouvre.
    final List<CpiProject> ouverts = CpiProject.values
        .where((CpiProject project) => project.isOpenTo(auth.role))
        .toList(growable: false);

    return CpiScaffold(
      title: 'CPI GO',
      // L'en-tête du hub porte la marque avant le titre : il est dessiné dans
      // le corps pour défiler avec les cartes.
      showTitle: false,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          CpiSpacing.md,
          0,
          CpiSpacing.md,
          CpiSpacing.xl,
        ),
        children: <Widget>[
          _Entete(name: auth.fullName, roleLabel: auth.roleLabel),
          const SizedBox(height: CpiSpacing.lg),
          if (ouverts.isEmpty)
            const _AucunProjet()
          else
            for (final CpiProject project in ouverts)
              Padding(
                padding: const EdgeInsets.only(bottom: CpiSpacing.md),
                child: _ProjectCard(project: project),
              ),
          const SizedBox(height: CpiSpacing.md),
          // La seule sortie de l'application pour un compte qui n'ouvre qu'un
          // projet : les Réglages vivent dans les coques, et le hub est la
          // page que tout le monde traverse.
          const _SeDeconnecter(),
        ],
      ),
    );
  }
}

class _Entete extends StatelessWidget {
  const _Entete({this.name, this.roleLabel});

  final String? name;
  final String? roleLabel;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String? first = name?.trim().split(' ').first;
    final String hello = (first == null || first.isEmpty)
        ? 'Bonjour'
        : 'Bonjour, $first';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Image.asset(
          'assets/brand/cpi-logo.png',
          width: 108,
          height: 44,
          cacheWidth: 216,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
          semanticLabel: 'CPI',
        ),
        const SizedBox(height: CpiSpacing.md),
        Semantics(
          header: true,
          child: Text(hello, style: theme.textTheme.headlineSmall),
        ),
        if (roleLabel != null) ...<Widget>[
          const SizedBox(height: CpiSpacing.xxs),
          Text(
            roleLabel!,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class _AucunProjet extends StatelessWidget {
  const _AucunProjet();

  @override
  Widget build(BuildContext context) => Text(
    'Votre compte n\'a accès à aucun projet. Contactez votre responsable.',
    style: Theme.of(context).textTheme.bodyLarge,
  );
}

class _SeDeconnecter extends ConsumerWidget {
  const _SeDeconnecter();

  @override
  Widget build(BuildContext context, WidgetRef ref) => CpiButton(
    'Se déconnecter',
    variant: CpiButtonVariant.ghost,
    icon: PhosphorIconsRegular.signOut,
    onPressed: () => unawaited(_signOut(context, ref)),
  );

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    // Lus avant la feuille : après l'attente, l'écran a pu être démonté, et la
    // mémoire de route non effacée rouvrirait l'écran du compte précédent.
    final AuthController auth = ref.read(authControllerProvider.notifier);
    final RouteMemory memoire = ref.read(routeMemoryProvider);
    final bool? confirmed = await cpiConfirm(
      context,
      title: 'Se déconnecter ?',
      message:
          'Vous devrez retaper votre mot de passe, et il faudra du réseau.',
      confirmLabel: 'Se déconnecter',
      danger: true,
    );
    if (confirmed != true) return;
    await auth.signOut();
    await memoire.clear();
  }
}

/// La marque et le geste d'un projet : ce que le hub montre avant tout mot.
typedef _Marque = ({String logo, String nom, String geste});

_Marque _marqueDe(CpiProject project) => switch (project) {
  CpiProject.chues => (
    logo: 'assets/brand/chues-logo.png',
    nom: 'CHUES',
    geste: 'Appeler, qualifier, enrôler',
  ),
  CpiProject.grandPublic => (
    logo: 'assets/brand/cpi-logo.png',
    nom: 'CPI',
    geste: 'Prospects et appels du jour',
  ),
  CpiProject.accueil => (
    logo: 'assets/brand/cpi-logo.png',
    nom: 'CPI',
    geste: 'Inscrire les visiteurs',
  ),
};

class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.project});

  final CpiProject project;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;
    final _Marque marque = _marqueDe(project);

    void enter() {
      HapticFeedback.selectionClick().ignore();
      context.go(project.path);
    }

    return Semantics(
      button: true,
      onTap: enter,
      label: '${project.label}. ${project.tagline}. ${marque.geste}.',
      child: ExcludeSemantics(
        child: CpiCard(
          onTap: enter,
          // La carte est la cible la plus large de l'app : on la touche au
          // soleil, une main sur le guidon, et c'est le logo qu'on reconnaît
          // avant de lire.
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              _Plaque(logo: marque.logo, nom: marque.nom),
              const SizedBox(height: CpiSpacing.md),
              Row(
                children: <Widget>[
                  Icon(
                    project.icon,
                    size: CpiIconSize.xl,
                    color: scheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: CpiSpacing.xs),
                  Expanded(
                    child: Text(
                      project.label,
                      style: theme.textTheme.titleLarge,
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
              const SizedBox(height: CpiSpacing.xxs),
              Text(
                project.tagline,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: CpiSpacing.xxs),
              Text(
                marque.geste,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Le logo sur son fond d'origine. Les deux fichiers sont dessinés pour du
/// blanc : posés sur une surface de thème, le sombre les rendrait illisibles et
/// le clair CHUES ferait apparaître un rectangle blanc dans la carte.
class _Plaque extends StatelessWidget {
  const _Plaque({required this.logo, required this.nom});

  final String logo;
  final String nom;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      color: Colors.white,
      borderRadius: CpiRadius.brMd,
    ),
    child: SizedBox(
      height: 96,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: CpiSpacing.md,
          vertical: CpiSpacing.sm,
        ),
        child: Image.asset(
          logo,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
          semanticLabel: nom,
        ),
      ),
    ),
  );
}
