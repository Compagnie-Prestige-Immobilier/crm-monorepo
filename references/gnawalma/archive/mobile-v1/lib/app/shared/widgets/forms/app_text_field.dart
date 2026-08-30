import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../../theme/app_motion.dart';

/// The one text field in the product.
///
/// The label sits above the box rather than floating inside it: the floating
/// variant shrinks to an 11pt uppercase overline once the field has content,
/// which is the smallest type in the app carrying the field's only name.
///
/// The visible label is excluded from the semantics tree and re-attached to the
/// field itself, so a screen reader announces "Téléphone professionnel, edit
/// box" instead of reading a stray line of text followed by an unnamed box.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    this.controller,
    required this.label,
    this.hint,
    this.helper,
    this.suffix,
    this.prefixText,
    this.icon,
    this.iconWidget,
    this.validator,
    this.keyboardType,
    this.style,
    this.obscureText = false,
    this.maxLines = 1,
    this.focusNode,
    this.onChanged,
    this.onFieldSubmitted,
    this.errorText,
    this.isValid,
    this.enabled = true,
    this.textInputAction,
    this.inputFormatters,
    this.autofillHints,
    this.initialValue,
    this.trailing,
    this.scrollPadding = const EdgeInsets.only(
      bottom: AppSpacing.keyboardScrollPadding,
    ),
  }) : assert(
         controller == null || initialValue == null,
         'Provide either a controller or an initialValue, not both.',
       );

  final TextEditingController? controller;
  final String label;
  final String? hint;

  /// Quiet line under the field. Use it for the reason a value is prefilled or
  /// constrained — not for errors, which have their own slot.
  final String? helper;
  final String? suffix;

  /// Texte fixe affiché avant la saisie, dans le champ ("tiktok.com/@").
  /// Contrairement à [hint], il reste visible une fois que l'utilisateur a
  /// tapé quelque chose.
  final String? prefixText;
  final IconData? icon;

  /// Icône dessinée plutôt que glyphe Material.
  ///
  /// Utilisée pour les marques — TikTok, Instagram, Facebook — qu'aucun glyphe
  /// Material ne représente : la note de musique et l'appareil photo obligeaient
  /// à lire l'étiquette pour savoir de quel réseau il s'agissait.
  final Widget? iconWidget;

  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final TextStyle? style;
  final bool obscureText;
  final int? maxLines;
  final FocusNode? focusNode;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final String? errorText;
  final bool? isValid;
  final bool enabled;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;
  final String? initialValue;

  /// An action that belongs to the field itself — a reveal toggle, a unit
  /// switch. Rendered beside the validity badge so the two never overlap.
  final Widget? trailing;

  /// Keeps the focused field clear of the keyboard plus any sticky action bar.
  final EdgeInsets scrollPadding;

  @override
  Widget build(BuildContext context) {
    final showBadge = isValid != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(
          child: Text(
            label,
            style: AppTextStyles.bodyMedium.copyWith(
              fontWeight: FontWeight.w600,
              color: errorText != null
                  ? AppColors.error
                  : context.textPrimaryColor,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Semantics(
          label: label,
          child: TextFormField(
            controller: controller,
            initialValue: initialValue,
            focusNode: focusNode,
            enabled: enabled,
            onChanged: onChanged,
            onFieldSubmitted: onFieldSubmitted,
            style: style,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            inputFormatters: inputFormatters,
            autofillHints: autofillHints,
            obscureText: obscureText,
            maxLines: obscureText ? 1 : maxLines,
            scrollPadding: scrollPadding,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            decoration: InputDecoration(
              hintText: hint,
              errorText: errorText,
              prefixText: prefixText,
              prefixStyle: style ?? AppTextStyles.input,
              prefixIcon: iconWidget != null
                  ? Padding(
                      padding: const EdgeInsets.all(14),
                      child: iconWidget,
                    )
                  : icon != null
                  ? Icon(icon, color: context.textSecondaryColor)
                  : null,
              suffixText: isValid == true ? null : suffix,
              suffixStyle: const TextStyle(fontWeight: FontWeight.bold),
              suffixIconConstraints: const BoxConstraints(
                minWidth: 48,
                minHeight: 48,
              ),
              suffixIcon: showBadge || trailing != null
                  ? FieldValidityActions(
                      isValid: isValid ?? false,
                      showBadge: showBadge,
                      trailing: trailing,
                    )
                  : null,
            ),
            validator: validator,
          ),
        ),
        if (helper != null) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            helper!,
            style: AppTextStyles.caption.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
        ],
      ],
    );
  }
}

/// The validity badge and any field-owned action, in one row.
///
/// Shared so a field looks the same wherever it is built. The badge is
/// decorative — errors stay textual and are announced by [TextFormField].
class FieldValidityActions extends StatelessWidget {
  const FieldValidityActions({
    super.key,
    required this.isValid,
    this.showBadge = true,
    this.trailing,
  });

  final bool isValid;
  final bool showBadge;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showBadge)
            AnimatedSwitcher(
              duration: AppMotion.quick,
              reverseDuration: const Duration(milliseconds: 120),
              transitionBuilder: (child, animation) => ScaleTransition(
                scale: CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeOutBack,
                  reverseCurve: Curves.easeIn,
                ),
                child: FadeTransition(opacity: animation, child: child),
              ),
              child: isValid
                  ? Semantics(
                      key: const ValueKey('valid'),
                      label: 'Champ valide',
                      child: Container(
                        width: 26,
                        height: 26,
                        decoration: BoxDecoration(
                          color: AppColors.success.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check_rounded,
                          size: 17,
                          color: AppColors.success,
                        ),
                      ),
                    )
                  : const SizedBox(
                      key: ValueKey('invalid-or-empty'),
                      width: 26,
                      height: 26,
                    ),
            ),
          if (trailing != null) ...[
            const SizedBox(width: 2),
            IconTheme(
              data: IconThemeData(color: context.textSecondaryColor),
              child: trailing!,
            ),
          ],
        ],
      ),
    );
  }
}
