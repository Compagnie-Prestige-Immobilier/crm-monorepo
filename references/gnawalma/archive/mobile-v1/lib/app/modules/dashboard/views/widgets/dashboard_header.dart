import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../data/models/business_profile_model.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/utils/app_assets.dart';

/// The page's opening statement.
///
/// Three ranks, deliberately far apart: a muted dateline, the greeting set in
/// the display face, then the atelier name at reading size. The previous
/// version set the date in ink at caption weight, which put it at almost the
/// same visual level as the name underneath — three lines, one rank, nothing to
/// read first.
class DashboardHeader extends StatelessWidget {
  const DashboardHeader({super.key, this.profile});

  final BusinessProfileModel? profile;

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  String _date() => DateFormat('EEEE d MMMM', 'fr_FR').format(DateTime.now());

  @override
  Widget build(BuildContext context) {
    final atelier = profile?.businessName?.trim().isNotEmpty == true
        ? profile!.businessName!
        : 'Mon atelier';
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.md,
        AppSpacing.gutter,
        AppSpacing.lg,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _date().toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.overline.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  _greeting(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.h2.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  atelier,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          _AtelierAvatar(profile: profile),
        ],
      ),
    );
  }
}

class _AtelierAvatar extends StatelessWidget {
  const _AtelierAvatar({required this.profile});

  static final Map<String, bool> _logoExists = {};

  final BusinessProfileModel? profile;

  @override
  Widget build(BuildContext context) {
    final logoPath = profile?.logoPath;
    final hasLocalLogo =
        logoPath != null &&
        _logoExists.putIfAbsent(logoPath, () => File(logoPath).existsSync());
    // A hairline ring rather than a drop shadow: on a white page the shadow was
    // the only floating element on the screen, which read as a rendering fault
    // next to the flat cards below it.
    return Container(
      width: 48,
      height: 48,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: context.surfaceColor,
        shape: BoxShape.circle,
        border: Border.all(color: context.borderColor),
      ),
      child: hasLocalLogo
          ? Image.file(File(logoPath), fit: BoxFit.cover)
          : Padding(
              padding: const EdgeInsets.all(10),
              child: Image.asset(
                AppAssets.logo,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => Icon(
                  Icons.storefront_rounded,
                  size: 20,
                  color: context.textPrimaryColor,
                ),
              ),
            ),
    );
  }
}
