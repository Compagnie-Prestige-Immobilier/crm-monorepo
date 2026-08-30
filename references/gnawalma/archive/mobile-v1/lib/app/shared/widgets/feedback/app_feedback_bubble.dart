import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../theme/app_colors.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../theme/app_spacing.dart';

class AppFeedbackBubble extends StatelessWidget {
  final String message;
  final IconData icon;
  final Color color;
  final Alignment alignment;

  const AppFeedbackBubble({
    super.key,
    required this.message,
    this.icon = Icons.check_rounded,
    this.color = AppColors.success,
    this.alignment = const Alignment(0.8, 0.8), // Bottom Right default
  });

  static void show(
    BuildContext? context, {
    required String message,
    IconData icon = Icons.check_rounded,
    Color color = AppColors.success,
    bool isLeft = false,
    VoidCallback? onDismissed,
  }) {
    // Try to get overlay from provided context or global navigator context
    final effectiveContext =
        context ?? AppNavigator.navigatorKey.currentContext;
    if (effectiveContext == null) {
      debugPrint(
        '⚠️ [AppFeedbackBubble] Could not show: No valid context found.',
      );
      onDismissed?.call();
      return;
    }

    final overlay =
        Overlay.maybeOf(effectiveContext) ??
        (AppNavigator.navigatorKey.currentState?.overlay);

    if (overlay == null) {
      debugPrint(
        '⚠️ [AppFeedbackBubble] Could not show: No Overlay found in context.',
      );
      onDismissed?.call();
      return;
    }

    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (context) => AppFeedbackBubble(
        message: message,
        icon: icon,
        color: color,
        alignment: isLeft
            ? const Alignment(-0.8, 0.8)
            : const Alignment(0.8, 0.8),
      ),
    );

    overlay.insert(entry);

    // Auto-remove after animation
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (entry.mounted) {
        entry.remove();
      }
      onDismissed?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: Material(
        color: Colors.transparent,
        child: Container(
          margin: const EdgeInsets.all(24),
          child: Stack(
            alignment: Alignment.center,
            children: [
              // 1. RIPPLE RINGS
              ...List.generate(
                2,
                (index) =>
                    Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: color.withValues(alpha: 0.3),
                              width: 2,
                            ),
                          ),
                        )
                        .animate(onPlay: (c) => c.repeat())
                        .scale(
                          begin: const Offset(0.8, 0.8),
                          end: const Offset(2.0, 2.0),
                          duration: (1000 + (index * 400)).ms,
                          curve: Curves.easeOut,
                        )
                        .fadeOut(duration: (1000 + (index * 400)).ms),
              ),

              // 2. THE BUBBLE
              Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(
                        AppSpacing.radiusSheetTop,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: color.withValues(alpha: 0.4),
                          blurRadius: 15,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, color: Colors.white, size: 24),
                        const SizedBox(width: 8),
                        Text(
                          message,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  )
                  .animate()
                  .scale(duration: 400.ms, curve: Curves.elasticOut)
                  .slideY(
                    begin: 0.5,
                    end: 0,
                    duration: 400.ms,
                    curve: Curves.easeOutBack,
                  )
                  .then(delay: 1500.ms)
                  .fadeOut(duration: 300.ms)
                  .scale(end: const Offset(0.5, 0.5)),
            ],
          ),
        ),
      ),
    );
  }
}
