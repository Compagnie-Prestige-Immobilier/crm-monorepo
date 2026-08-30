import 'dart:io';
import 'package:flutter/material.dart';
import '../../theme/app_colors_extensions.dart';

/// Centralized Image widget for handling local file images with error handling.
class AppImage extends StatelessWidget {
  final String? path;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget? placeholder;
  final BorderRadius? borderRadius;

  const AppImage({
    super.key,
    this.path,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.placeholder,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    Widget content;

    if (path == null || path!.isEmpty) {
      content = placeholder ?? _buildDefaultPlaceholder(context);
    } else {
      content = Image.file(
        File(path!),
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (context, error, stackTrace) {
          return placeholder ?? _buildDefaultPlaceholder(context);
        },
      );
    }

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: content);
    }

    return content;
  }

  // Was a fixed light-mode fill and icon colour: a bright white square for a
  // broken image sat on the dark page like a rendering fault rather than a
  // placeholder.
  Widget _buildDefaultPlaceholder(BuildContext context) {
    return Container(
      width: width,
      height: height,
      color: context.surfaceLightColor,
      alignment: Alignment.center,
      child: Icon(
        Icons.image_not_supported_outlined,
        color: context.textSecondaryColor,
        size: 32,
      ),
    );
  }
}
