import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

@immutable
class ActivityDay {
  const ActivityDay({required this.day, required this.synced, required this.pending});

  final DateTime day;

  final int synced;

  final int pending;

  int get total => synced + pending;
}

class ActivityChart extends StatelessWidget {
  const ActivityChart({super.key, required this.days});

  final List<ActivityDay> days;

  static final DateFormat _weekday = DateFormat('E', 'fr');

  static String _dayLetters(DateTime d) {
    final String raw = _weekday.format(d).replaceAll('.', '');
    return raw.length <= 2 ? raw : raw.substring(0, 2);
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final int total = days.fold(0, (int a, ActivityDay d) => a + d.total);

    return Semantics(
      label: _semanticSummary(total),
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    '7 derniers jours',
                    style: theme.textTheme.titleSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: CpiSpacing.xs),
                Text(
                  '$total',
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: theme.colorScheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: CpiSpacing.sm),
            SizedBox(
              height: 84,
              child: CustomPaint(
                size: Size.infinite,
                painter: _BarsPainter(
                  days: days,
                  syncedColor: theme.colorScheme.primary,
                  pendingColor: cpi.accent,
                  pendingBorder: cpi.accentBorder,
                  trackColor: theme.colorScheme.surfaceContainerHigh.withValues(
                    alpha: 0.45,
                  ),
                ),
              ),
            ),
            const SizedBox(height: CpiSpacing.xxs),
            Row(
              children: <Widget>[
                for (final ActivityDay d in days)
                  Expanded(
                    child: Text(
                      _dayLetters(d.day),
                      textAlign: TextAlign.center,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: CpiSpacing.xs),
            Wrap(
              spacing: CpiSpacing.md,
              runSpacing: CpiSpacing.xxs,
              children: <Widget>[
                _LegendDot(color: theme.colorScheme.primary, label: 'Envoyé'),
                _LegendDot(
                  color: cpi.accent,
                  border: cpi.accentBorder,
                  label: 'En attente',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _semanticSummary(int total) {
    if (total == 0) return 'Aucune saisie sur les sept derniers jours.';
    final StringBuffer out = StringBuffer('$total saisies sur sept jours. ');
    for (final ActivityDay d in days) {
      if (d.total == 0) continue;
      out.write(
        '${DateFormat('EEEE d', 'fr').format(d.day)} : '
        '${d.synced} envoyées, ${d.pending} en attente. ',
      );
    }
    return out.toString();
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label, this.border});

  final Color color;
  final Color? border;
  final String label;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: CpiRadius.brXs,
            border: border == null ? null : Border.all(color: border!),
          ),
        ),
        const SizedBox(width: CpiSpacing.xxs + 2),
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _BarsPainter extends CustomPainter {
  _BarsPainter({
    required this.days,
    required this.syncedColor,
    required this.pendingColor,
    required this.pendingBorder,
    required this.trackColor,
  });

  final List<ActivityDay> days;
  final Color syncedColor;
  final Color pendingColor;
  final Color pendingBorder;
  final Color trackColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (days.isEmpty) return;
    final int peak = days
        .map((ActivityDay d) => d.total)
        .fold(0, (int a, int b) => a > b ? a : b);
    final double slot = size.width / days.length;
    const double gap = 5;
    final double barWidth = (slot - gap * 2).clamp(4.0, 28.0);
    const Radius radius = Radius.circular(4);

    final Paint paint = Paint()..style = PaintingStyle.fill;
    final Paint stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = pendingBorder;

    for (int i = 0; i < days.length; i++) {
      final ActivityDay d = days[i];
      final double left = i * slot + (slot - barWidth) / 2;
      final Rect track = Rect.fromLTWH(left, 0, barWidth, size.height);

      paint.color = trackColor;
      canvas.drawRRect(RRect.fromRectAndRadius(track, radius), paint);

      if (peak == 0 || d.total == 0) continue;

      final double fullHeight = size.height * (d.total / peak);
      final double pendingHeight = d.total == 0 ? 0 : fullHeight * (d.pending / d.total);
      final double syncedHeight = fullHeight - pendingHeight;

      if (syncedHeight > 0) {
        paint.color = syncedColor;
        canvas.drawRRect(
          RRect.fromRectAndCorners(
            Rect.fromLTWH(left, size.height - syncedHeight, barWidth, syncedHeight),
            bottomLeft: radius,
            bottomRight: radius,
            topLeft: pendingHeight > 0 ? Radius.zero : radius,
            topRight: pendingHeight > 0 ? Radius.zero : radius,
          ),
          paint,
        );
      }

      if (pendingHeight > 0) {
        final Rect r = Rect.fromLTWH(
          left,
          size.height - fullHeight,
          barWidth,
          pendingHeight,
        );
        final RRect rr = RRect.fromRectAndCorners(
          r,
          topLeft: radius,
          topRight: radius,
          bottomLeft: syncedHeight > 0 ? Radius.zero : radius,
          bottomRight: syncedHeight > 0 ? Radius.zero : radius,
        );
        paint.color = pendingColor;
        canvas.drawRRect(rr, paint);
        canvas.drawRRect(rr.deflate(0.5), stroke);
      }
    }
  }

  @override
  bool shouldRepaint(_BarsPainter old) {
    if (old.days.length != days.length) return true;
    for (int i = 0; i < days.length; i++) {
      if (old.days[i].synced != days[i].synced ||
          old.days[i].pending != days[i].pending ||
          old.days[i].day != days[i].day) {
        return true;
      }
    }
    return old.syncedColor != syncedColor || old.pendingColor != pendingColor;
  }
}
