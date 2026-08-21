import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/router/back_navigation.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_tokens.dart';

class GrandPublicScreen extends StatelessWidget {
  const GrandPublicScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          leading: const CpiBackButton(),
          title: const Text('Projet Grand Public'),
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(CpiSpacing.xl),
            children: <Widget>[
              Icon(
                PhosphorIconsRegular.usersThree,
                size: 48,
                color: theme.colorScheme.onSurfaceVariant,
              ),
              const SizedBox(height: CpiSpacing.md),
              Text(
                'L\'enrôlement grand public n\'est pas encore ouvert.',
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: CpiSpacing.xs),
              Text(
                'Son processus ne ressemble pas à celui du Projet CHUES : il '
                'aura sa propre saisie, dans sa propre coque. Rien ne s\'y '
                'enregistre pour l\'instant.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: CpiSpacing.xl),
              FilledButton(
                onPressed: () => context.go(Routes.home),
                child: const Text('Revenir aux projets'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
