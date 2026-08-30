import 'package:flutter/material.dart';

import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../../../shared/theme/app_motion.dart';

class ClientPageHeader extends StatelessWidget {
  const ClientPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.eyebrow,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final String? eyebrow;

  @override
  Widget build(BuildContext context) {
    return AppPageHeader(
      title: title,
      subtitle: subtitle,
      eyebrow: eyebrow,
      trailing: trailing,
      // Resolved from the shell's theme, not the constant. `AppColors.accent`
      // is the space-neutral fallback and painted these client headers in the
      // atelier's blue.
      accentColor: context.accentColor,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.md,
        AppSpacing.gutter,
        AppSpacing.md,
      ),
    );
  }
}

class ClientSectionHeader extends StatelessWidget {
  const ClientSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.icon,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return AppSectionHeader(
      title: title,
      subtitle: subtitle,
      actionLabel: actionLabel,
      onAction: onAction,
      icon: icon,
      // Resolved from the shell's theme, not the constant. `AppColors.accent`
      // is the space-neutral fallback and painted these client headers in the
      // atelier's blue.
      accentColor: context.accentColor,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
    );
  }
}

class ClientOfflineBanner extends StatelessWidget {
  const ClientOfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.xs,
        AppSpacing.gutter,
        0,
      ),
      child: AppStatusBanner(
        title: 'Mode hors ligne',
        message:
            'Vos favoris restent accessibles. Les données distantes reprendront automatiquement à la reconnexion.',
        icon: Icons.cloud_off_rounded,
        tone: AppStatusTone.warning,
      ),
    );
  }
}

/// The one composed "nothing here" surface of the client space.
///
/// Every empty, error and no-result slot in the marketplace routes through it,
/// so a screen is never a headline over blank space: a drawn motif (or a bare
/// glyph in tight slots), one line of explanation, and an action that takes the
/// reader somewhere useful.
class ClientStatePanel extends StatelessWidget {
  const ClientStatePanel({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.actionIcon,
    this.secondaryActionLabel,
    this.onSecondaryAction,
    this.motif,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? actionIcon;
  final String? secondaryActionLabel;
  final VoidCallback? onSecondaryAction;

  /// Draws an [AtelierIllustration] instead of the glyph. Worth it whenever the
  /// panel *is* the screen; left null inside a card or a fixed-height carousel
  /// slot, where the drawing would outweigh what it sits beside.
  final AtelierMotif? motif;

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.gutter,
          vertical: compact ? AppSpacing.md : AppSpacing.lg,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (motif != null)
                AtelierIllustration(motif: motif!, height: compact ? 104 : 152)
              else
                // A bare line glyph, no tinted disc: the circle-with-coloured-
                // icon is the single most template-looking element there is.
                Icon(
                  icon,
                  size: compact ? 34 : 46,
                  color: context.textSecondaryColor.withValues(alpha: 0.5),
                ),
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              Text(
                title,
                style: (compact ? AppTextStyles.h5 : AppTextStyles.h3).copyWith(
                  color: context.textPrimaryColor,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                message,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: context.textSecondaryColor,
                  height: 1.42,
                ),
                textAlign: TextAlign.center,
              ),
              if (actionLabel != null && onAction != null) ...[
                SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 300),
                  child: SizedBox(
                    width: double.infinity,
                    child: actionIcon == null
                        ? FilledButton(
                            onPressed: onAction,
                            child: Text(
                              actionLabel!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          )
                        : FilledButton.icon(
                            onPressed: onAction,
                            icon: Icon(actionIcon, size: 19),
                            label: Text(
                              actionLabel!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                  ),
                ),
              ],
              if (secondaryActionLabel != null &&
                  onSecondaryAction != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                TextButton(
                  onPressed: onSecondaryAction,
                  style: TextButton.styleFrom(minimumSize: const Size(64, 44)),
                  child: Text(
                    secondaryActionLabel!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The caption that opens a list: what the reader is looking at, set as an
/// eyebrow over a hairline rule.
///
/// It replaces the tinted information banner that used to sit above every list
/// in this space. Three screens each washing their first 70 pixels in a pastel
/// panel is what made the marketplace read as a template; a rule and a label
/// carry the same information and let the content start.
class ClientListCaption extends StatelessWidget {
  const ClientListCaption({super.key, required this.label, this.trailing});

  final String label;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    final style = AppTextStyles.overline.copyWith(
      color: context.textSecondaryColor,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.xs,
        AppSpacing.gutter,
        AppSpacing.md,
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: style,
                ),
              ),
              if (trailing != null && trailing!.trim().isNotEmpty) ...[
                const SizedBox(width: AppSpacing.sm),
                Text(
                  trailing!.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: style,
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Divider(height: 1, thickness: 1, color: context.dividerColor),
        ],
      ),
    );
  }
}

class ClientLoadingList extends StatelessWidget {
  const ClientLoadingList({super.key, this.itemCount = 4});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.gutter,
        vertical: AppSpacing.md,
      ),
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemCount: itemCount,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (_, _) => const _LoadingCard(),
    );
  }
}

class _LoadingCard extends StatefulWidget {
  const _LoadingCard();

  @override
  State<_LoadingCard> createState() => _LoadingCardState();
}

class _LoadingCardState extends State<_LoadingCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: AppMotion.shimmer);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted &&
          !(MediaQuery.maybeOf(context)?.disableAnimations ?? false)) {
        _controller.repeat(reverse: true);
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = context.surfaceLightColor;
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion) {
      return _skeleton(base, .72);
    }
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, _) => _skeleton(base, 0.55 + (_controller.value * .25)),
    );
  }

  Widget _skeleton(Color color, double opacity) {
    return Opacity(
      opacity: opacity,
      child: Container(
        height: 122,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        ),
      ),
    );
  }
}
