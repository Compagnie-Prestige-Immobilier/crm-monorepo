import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/app_spacing.dart';
import 'app_text_field.dart';

/// Kept as the auth screens' entry point, but no longer a second field
/// implementation.
///
/// It used to render a floating label and its own success badge while every
/// other form in the app used [AppTextField] with the label above the box, so
/// the sign-up flow changed field style between the account screen and the
/// configuration wizard that immediately follows it. Both now resolve to the
/// same widget.
class ValidatedTextFormField extends StatelessWidget {
  const ValidatedTextFormField({
    super.key,
    required this.controller,
    required this.labelText,
    required this.hintText,
    required this.prefixIcon,
    required this.isValid,
    this.focusNode,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.inputFormatters,
    this.obscureText = false,
    this.validator,
    this.onChanged,
    this.onFieldSubmitted,
    this.trailing,
    this.helperText,
    this.enabled = true,
    this.scrollPadding = const EdgeInsets.only(
      bottom: AppSpacing.keyboardScrollPadding,
    ),
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
  final String labelText;
  final String hintText;
  final IconData prefixIcon;
  final bool isValid;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final bool obscureText;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final Widget? trailing;
  final String? helperText;
  final bool enabled;

  /// Keeps the focused field clear of the keyboard plus any sticky action bar.
  final EdgeInsets scrollPadding;

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      controller: controller,
      focusNode: focusNode,
      label: labelText,
      hint: hintText,
      helper: helperText,
      icon: prefixIcon,
      isValid: isValid,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      inputFormatters: inputFormatters,
      obscureText: obscureText,
      validator: validator,
      onChanged: onChanged,
      onFieldSubmitted: onFieldSubmitted,
      trailing: trailing,
      enabled: enabled,
      scrollPadding: scrollPadding,
    );
  }
}
