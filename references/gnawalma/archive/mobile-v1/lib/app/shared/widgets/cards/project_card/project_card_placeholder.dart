import 'package:flutter/material.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/utils/app_assets.dart';

class ProjectCardPlaceholder extends StatelessWidget {
  final String garmentType;

  const ProjectCardPlaceholder({super.key, required this.garmentType});

  @override
  Widget build(BuildContext context) {
    final placeholderIcon = _resolveIcon(garmentType);

    return Container(
      color: context.surfaceLightColor,
      child: Center(
        child: ColorFiltered(
          colorFilter: ColorFilter.mode(
            Theme.of(context).colorScheme.primary.withValues(alpha: 0.3),
            BlendMode.srcIn,
          ),
          child: Image.asset(placeholderIcon, width: 50, height: 50),
        ),
      ),
    );
  }

  String _resolveIcon(String type) {
    final lower = type.toLowerCase();
    if (lower.contains('robe')) return AppAssets.garmentDress;
    if (lower.contains('chemise') || lower.contains('boubou')) {
      return AppAssets.garmentShirt;
    }
    if (lower.contains('pantalon')) return AppAssets.garmentPants;
    if (lower.contains('veste')) return AppAssets.garmentJacket;
    if (lower.contains('jupe')) return AppAssets.garmentSkirt;
    if (lower.contains('kaftan')) return AppAssets.garmentKaftan;
    return AppAssets.sewingMachine;
  }
}
