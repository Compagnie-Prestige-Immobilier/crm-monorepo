import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../theme/app_spacing.dart';
import '../theme/app_text_styles.dart';

class AppDialogs {
  static bool _isCupertino(BuildContext context) {
    final platform = Theme.of(context).platform;
    return platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;
  }

  /// Shows a modal bottom sheet to pick a status from an enum.
  static Future<T?> showStatusPicker<T extends Enum>({
    required String title,
    required T currentValue,
    required List<T> options,
    required String Function(T) getLabel,
  }) async {
    final context = AppNavigator.navigatorKey.currentContext;
    if (context == null) return null;

    return await showModalBottomSheet<T>(
      context: context,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              // AppTextStyles carries the light-mode ink, so the sheet title
              // disappeared entirely under the dark theme.
              style: AppTextStyles.h4.copyWith(
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            RadioGroup<T>(
              groupValue: currentValue,
              onChanged: (val) => Navigator.pop(context, val),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final option in options)
                    RadioListTile<T>.adaptive(
                      title: Text(getLabel(option)),
                      value: option,
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }

  /// Platform-adaptive date picker: Material calendar on Android, a Cupertino
  /// wheel sheet on iOS/macOS.
  static Future<DateTime?> pickDate({
    required BuildContext context,
    DateTime? initialDate,
    DateTime? firstDate,
    DateTime? lastDate,
  }) async {
    final initial = initialDate ?? DateTime.now();
    final first = firstDate ?? DateTime(2020);
    final last = lastDate ?? DateTime(2035);

    if (_isCupertino(context)) {
      return _pickDateCupertino(context, initial, first, last);
    }
    return showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: first,
      lastDate: last,
    );
  }

  static Future<DateTime?> _pickDateCupertino(
    BuildContext context,
    DateTime initial,
    DateTime first,
    DateTime last,
  ) {
    var selected = initial;
    return showModalBottomSheet<DateTime>(
      context: context,
      useSafeArea: true,
      showDragHandle: false,
      builder: (sheetContext) => SafeArea(
        top: false,
        child: SizedBox(
          height: 320,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xs,
                  vertical: AppSpacing.xxs,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(sheetContext),
                      child: const Text('Annuler'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(sheetContext, selected),
                      child: const Text('OK'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.date,
                  initialDateTime: initial,
                  minimumDate: first,
                  maximumDate: last,
                  onDateTimeChanged: (value) => selected = value,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Shows a platform-adaptive confirmation dialog.
  static Future<bool?> showConfirmation({
    required String title,
    required String message,
    String confirmLabel = 'Confirmer',
    String cancelLabel = 'Annuler',
    bool isDangerous = false,
    IconData? icon,
  }) async {
    final context = AppNavigator.navigatorKey.currentContext;
    if (context == null) return null;

    return await showAdaptiveDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => _buildDialog(
        context: context,
        title: title,
        message: message,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
        isDangerous: isDangerous,
      ),
    );
  }

  static void showConfirmDialog({
    required String title,
    required String message,
    required VoidCallback onConfirm,
    String confirmText = 'Confirmer',
    String cancelText = 'Annuler',
    bool isDangerous = false,
    IconData? icon,
    VoidCallback? onCancel,
  }) {
    final context = AppNavigator.navigatorKey.currentContext;
    if (context == null) return;

    showAdaptiveDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _buildDialog(
        context: context,
        title: title,
        message: message,
        confirmLabel: confirmText,
        cancelLabel: cancelText,
        isDangerous: isDangerous,
        onConfirm: onConfirm,
        onCancel: onCancel,
      ),
    );
  }

  static Widget _buildDialog({
    required BuildContext context,
    required String title,
    required String message,
    required String confirmLabel,
    required String cancelLabel,
    required bool isDangerous,
    VoidCallback? onConfirm,
    VoidCallback? onCancel,
  }) {
    return AlertDialog.adaptive(
      title: Text(title),
      content: Text(message),
      actions: [
        _adaptiveAction(
          context: context,
          label: cancelLabel,
          onPressed: () {
            onCancel?.call();
            Navigator.pop(context, false);
          },
        ),
        _adaptiveAction(
          context: context,
          label: confirmLabel,
          isDefault: true,
          isDestructive: isDangerous,
          onPressed: () {
            Navigator.pop(context, true);
            onConfirm?.call();
          },
        ),
      ],
    );
  }

  static Widget _adaptiveAction({
    required BuildContext context,
    required String label,
    required VoidCallback onPressed,
    bool isDefault = false,
    bool isDestructive = false,
  }) {
    if (_isCupertino(context)) {
      return CupertinoDialogAction(
        isDefaultAction: isDefault,
        isDestructiveAction: isDestructive,
        onPressed: onPressed,
        child: Text(label),
      );
    }
    return TextButton(
      style: isDestructive
          ? TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            )
          : null,
      onPressed: onPressed,
      child: Text(label),
    );
  }
}
