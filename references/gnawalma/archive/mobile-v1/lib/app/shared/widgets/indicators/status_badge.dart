import 'package:flutter/material.dart';
import '../../../../app/data/models/project_model.dart';
import '../../../../app/data/models/order_model.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../theme/app_colors_extensions.dart';

/// A pill that names a status.
///
/// This used to be a `StatefulWidget` running a repeating fade whenever a badge
/// was marked overdue. `knowledge-base/DESIGN.md` forbids repetitive animation
/// on a daily work tool, and no caller ever enabled it — every `showPulse`
/// argument came from the two factories below and nothing else passed one — so
/// the controller ran the app's only perpetual animation for a feature that was
/// never used. Overdue is now carried by the colour *and* the label, which is
/// also what the "colour never carries status alone" rule requires.
///
/// The coloured drop shadow went with it: a glow tinted to the fill is the
/// decorative effect the design language rules out by name.
class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final Widget? icon;
  final EdgeInsetsGeometry? margin;
  final double? fontSize;

  const StatusBadge({
    super.key,
    required this.label,
    required this.color,
    this.icon,
    this.margin,
    this.fontSize,
  });

  /// Create status badge from ProjectStatus
  factory StatusBadge.fromProjectStatus(
    ProjectStatus status, {
    bool isOverdue = false,
  }) {
    return StatusBadge(
      label: isOverdue && status != ProjectStatus.delivered
          ? '${status.label} · en retard'
          : status.label,
      color: status.color,
      icon: Icon(status.icon, size: 14, color: Colors.white),
    );
  }

  /// Create status badge from OrderStatus
  factory StatusBadge.fromOrderStatus(
    OrderStatus status, {
    bool isOverdue = false,
  }) {
    return StatusBadge(
      label: isOverdue ? '${status.label} · en retard' : status.label,
      color: status.color,
      icon: Icon(status.icon, size: 14, color: Colors.white),
    );
  }

  /// Create payment status badge
  factory StatusBadge.fromPaymentStatus(PaymentStatus status) {
    return StatusBadge(
      label: status.label,
      color: status.color,
      icon: Icon(status.icon, size: 14, color: Colors.white),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin ?? EdgeInsets.zero,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        // Lifted on the dark page, where the light-tuned status hues sit too
        // close to the surface to read.
        color: context.statusForeground(color),
        borderRadius: BorderRadius.circular(AppSpacing.radiusCircle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[icon!, const SizedBox(width: AppSpacing.xxs)],
          Text(
            label,
            style: TextStyle(
              color: Colors.white,
              fontSize: fontSize ?? 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
