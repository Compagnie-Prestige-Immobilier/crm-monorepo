import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/voice/voice_providers.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../../theme/app_colors_extensions.dart';
import '../feedback/app_toast.dart';

/// Dicter sa recherche (§2.5).
///
/// Ouvre une feuille plutôt que d'écouter en arrière-plan : quelqu'un qui ne
/// lit pas bien doit voir que l'application écoute, voir ses mots s'inscrire, et
/// pouvoir arrêter. Un micro qui capte sans le montrer est illisible pour tout
/// le monde et inquiétant pour beaucoup.
class VoiceSearchButton extends ConsumerWidget {
  const VoiceSearchButton({super.key, required this.onResult, this.tooltip});

  final ValueChanged<String> onResult;
  final String? tooltip;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return IconButton(
      tooltip: tooltip ?? 'Dicter la recherche',
      icon: const Icon(Icons.mic_rounded),
      style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
      onPressed: () => _open(context, ref),
    );
  }

  Future<void> _open(BuildContext context, WidgetRef ref) async {
    final service = ref.read(voiceSearchServiceProvider);
    if (!await service.prepare()) {
      if (!context.mounted) return;
      AppToast.show(
        title: 'Dictée indisponible',
        message:
            'Cet appareil ne peut pas transcrire la voix, ou l’accès au micro a été refusé. Vous pouvez taper votre recherche.',
        type: ToastType.warning,
      );
      return;
    }
    if (!context.mounted) return;

    HapticFeedback.mediumImpact();
    final spoken = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      isDismissible: true,
      builder: (_) => const _VoiceSearchSheet(),
    );
    if (spoken != null && spoken.trim().isNotEmpty) {
      onResult(spoken.trim());
    }
  }
}

class _VoiceSearchSheet extends ConsumerStatefulWidget {
  const _VoiceSearchSheet();

  @override
  ConsumerState<_VoiceSearchSheet> createState() => _VoiceSearchSheetState();
}

class _VoiceSearchSheetState extends ConsumerState<_VoiceSearchSheet> {
  String _text = '';
  bool _listening = false;

  @override
  void initState() {
    super.initState();
    // L'écoute démarre seule : demander un second appui après avoir déjà appuyé
    // sur le micro est une étape de plus pour quelqu'un qui a du mal avec les
    // interfaces.
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    ref.read(voiceSearchServiceProvider).cancel();
    super.dispose();
  }

  /// Arrête l'écoute et rend ce qui a été compris jusque-là.
  Future<void> _finish() async {
    final navigator = Navigator.of(context);
    final spoken = _text;
    await ref.read(voiceSearchServiceProvider).stop();
    if (!mounted) return;
    navigator.pop(spoken);
  }

  Future<void> _start() async {
    setState(() => _listening = true);
    await ref
        .read(voiceSearchServiceProvider)
        .listen(
          onPartial: (value) {
            if (mounted) setState(() => _text = value);
          },
          onFinal: (value) {
            if (!mounted) return;
            setState(() {
              _text = value;
              _listening = false;
            });
            // Referme dès que la phrase est complète : l'utilisateur a fini de
            // parler, il n'a pas à chercher un bouton de validation.
            if (value.trim().isNotEmpty) Navigator.pop(context, value);
          },
        );
    if (mounted && !ref.read(voiceSearchServiceProvider).isListening) {
      setState(() => _listening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          0,
          AppSpacing.gutter,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _listening ? 'Je vous écoute' : 'Écoute terminée',
              style: AppTextStyles.h4.copyWith(color: context.textPrimaryColor),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Dites ce que vous cherchez. Par exemple : « une couturière pour un boubou ».',
              textAlign: TextAlign.center,
              style: AppTextStyles.bodySmall.copyWith(
                color: context.textSecondaryColor,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            // La preuve visible que le micro entend quelque chose.
            _Pulse(active: _listening),
            const SizedBox(height: AppSpacing.lg),
            Container(
              width: double.infinity,
              constraints: const BoxConstraints(minHeight: 64),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
              ),
              child: Text(
                _text.isEmpty ? '…' : _text,
                textAlign: TextAlign.center,
                style: AppTextStyles.bodyLarge.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Annuler'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: _listening ? _finish : _start,
                    icon: Icon(
                      _listening ? Icons.check_rounded : Icons.mic_rounded,
                    ),
                    label: Text(_listening ? 'J’ai fini' : 'Réessayer'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Un disque qui respire tant que le micro écoute.
class _Pulse extends StatefulWidget {
  const _Pulse({required this.active});

  final bool active;

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void initState() {
    super.initState();
    if (widget.active) _controller.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(_Pulse oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    } else if (!widget.active) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Respecte « réduire les animations » : le disque reste alors immobile, et
    // c'est le texte reconnu qui porte le retour.
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final scale = reduceMotion ? 1.0 : 1 + _controller.value * 0.18;
        return Transform.scale(scale: scale, child: child);
      },
      child: Container(
        width: 88,
        height: 88,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: widget.active
              ? scheme.primary
              : scheme.surfaceContainerHighest,
          shape: BoxShape.circle,
        ),
        child: Icon(
          Icons.mic_rounded,
          size: 40,
          color: widget.active ? scheme.onPrimary : scheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
