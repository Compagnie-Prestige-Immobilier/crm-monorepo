import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../ui/widgets/cpi_pressable.dart';
import '../auth/auth_state.dart';
import 'projects.dart';

class HubScreen extends ConsumerWidget {
  const HubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('CPI GO')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            CpiSpacing.md,
            CpiSpacing.md,
            CpiSpacing.xl,
          ),
          children: <Widget>[
            _Greeting(name: auth.fullName, roleLabel: auth.roleLabel),
            const SizedBox(height: CpiSpacing.md),
            for (final CpiProject project in CpiProject.values)
              Padding(
                padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
                child: _ProjectTile(
                  project: project,
                  open: project.isOpenTo(auth.role),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({this.name, this.roleLabel});

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
        Text(hello, style: theme.textTheme.headlineSmall),
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

class _ProjectTile extends StatelessWidget {
  const _ProjectTile({required this.project, required this.open});

  final CpiProject project;
  final bool open;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;

    void enter() {
      HapticFeedback.selectionClick().ignore();
      context.go(project.path);
    }

    return Semantics(
      button: open,
      enabled: open,
      onTap: open ? enter : null,
      label: open
          ? '${project.label}. ${project.tagline}.'
          : '${project.label}. ${project.tagline}. '
                'Hors de portée de votre rôle.',
      child: ExcludeSemantics(
        child: CpiPressable(
          onTap: open ? enter : null,
          child: Container(
            constraints: const BoxConstraints(minHeight: 96),
            padding: const EdgeInsets.all(CpiSpacing.md),
            decoration: BoxDecoration(
              color: open
                  ? scheme.surfaceContainerLowest
                  : scheme.surfaceContainer,
              borderRadius: CpiRadius.brLg,
              border: Border.all(
                color: open ? context.cpi.borderSubtle : scheme.outlineVariant,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: open ? scheme.primary : scheme.surfaceContainerHigh,
                    borderRadius: CpiRadius.brMd,
                  ),
                  child: Icon(
                    project.icon,
                    size: CpiIconSize.xxl,
                    color: open ? scheme.onPrimary : scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: CpiSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        project.label,
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: open
                              ? scheme.onSurface
                              : scheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: CpiSpacing.xxs),
                      Text(
                        project.tagline,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: CpiSpacing.xs),
                Icon(
                  open
                      ? PhosphorIconsRegular.caretRight
                      : PhosphorIconsRegular.lockSimple,
                  size: CpiIconSize.lg,
                  color: scheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
