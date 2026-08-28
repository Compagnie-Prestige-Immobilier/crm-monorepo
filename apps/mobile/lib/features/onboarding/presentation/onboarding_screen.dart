import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/onboarding/onboarding_controller.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final PageController _pages = PageController();
  int _index = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final CpiMotion motion = CpiMotion.of(context);
    return CpiScaffold(
      title: 'Bienvenue',
      showTitle: false,
      // Le message d'échec passe par le `FToaster` de la coque : il faut donc
      // un contexte pris SOUS elle, pas celui de l'écran.
      body: Builder(
        builder: (BuildContext context) => Padding(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            CpiSpacing.xs,
            CpiSpacing.md,
            CpiSpacing.md,
          ),
          child: Column(
            children: <Widget>[
              Expanded(
                child: PageView(
                  controller: _pages,
                  onPageChanged: (int index) => setState(() => _index = index),
                  children: const <Widget>[
                    _OnboardingPage(
                      icon: PhosphorIconsDuotone.notePencil,
                      title: 'Saisissez partout',
                      body:
                          'CPI GO fonctionne même quand le réseau est faible ou absent. Vos fiches restent sur le téléphone.',
                    ),
                    _OnboardingPage(
                      icon: PhosphorIconsDuotone.arrowsClockwise,
                      title: 'Tout part tout seul',
                      body:
                          'Dès que le réseau revient, vos fiches partent. Vous voyez toujours ce qui reste.',
                    ),
                  ],
                ),
              ),
              Semantics(
                label: 'Page ${_index + 1} sur 2',
                excludeSemantics: true,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List<Widget>.generate(
                    2,
                    (int index) => AnimatedContainer(
                      duration: motion.micro,
                      curve: motion.easeOut,
                      margin: const EdgeInsets.symmetric(
                        horizontal: CpiSpacing.xxs,
                      ),
                      height: CpiSpacing.xs,
                      width: index == _index ? CpiSpacing.xl : CpiSpacing.xs,
                      decoration: BoxDecoration(
                        color: index == _index
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.outlineVariant,
                        borderRadius: CpiRadius.brFull,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      footer: Builder(
        builder: (BuildContext context) => CpiActionBar(
          child: CpiButton(
            _index == 1 ? 'Commencer' : 'Continuer',
            onPressed: () {
              if (_index == 1) {
                unawaited(_finish(context));
              } else {
                _pages
                    .nextPage(duration: motion.component, curve: motion.easeOut)
                    .ignore();
              }
            },
          ),
        ),
      ),
    );
  }

  Future<void> _finish(BuildContext context) async {
    try {
      await ref.read(onboardingControllerProvider.notifier).complete();
    } on Object {
      if (!mounted || !context.mounted) return;
      // L'écran avance quand même : le réglage se réécrira au prochain
      // lancement, et bloquer ici enfermerait le téléphone sur cet écran.
      cpiToast(
        context,
        'Le téléphone n\'a pas pu garder ce réglage. '
        'Cet écran reviendra peut-être au prochain lancement.',
      );
    }
  }
}

class _OnboardingPage extends StatelessWidget {
  const _OnboardingPage({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(vertical: CpiSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            // Un disque neutre porte l'icône : la marque n'y est qu'un trait,
            // pas un aplat.
            DecoratedBox(
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHigh,
                shape: BoxShape.circle,
              ),
              child: Padding(
                padding: const EdgeInsets.all(CpiSpacing.xl),
                child: Icon(
                  icon,
                  size: CpiIconSize.display,
                  color: theme.colorScheme.primary,
                ),
              ),
            ),
            const SizedBox(height: CpiSpacing.xxl),
            Semantics(
              header: true,
              child: Text(
                title,
                style: theme.textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: CpiSpacing.sm),
            Text(
              body,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
