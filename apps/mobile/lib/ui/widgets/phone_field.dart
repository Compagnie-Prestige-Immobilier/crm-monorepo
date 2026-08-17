import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/utils/phone.dart';

class SenegalPhoneFormatter extends TextInputFormatter {
  const SenegalPhoneFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final String digits = newValue.text
        .replaceAll(RegExp(r'[^0-9]'), '')
        .substring(
          0,
          newValue.text
              .replaceAll(RegExp(r'[^0-9]'), '')
              .length
              .clamp(0, kSenegalNationalLength),
        );

    final int digitsBeforeCursor = newValue.text
        .substring(0, newValue.selection.baseOffset.clamp(0, newValue.text.length))
        .replaceAll(RegExp(r'[^0-9]'), '')
        .length;

    final String grouped = Phone.groupNational(digits);

    int offset = 0;
    int seen = 0;
    while (offset < grouped.length && seen < digitsBeforeCursor) {
      if (grouped.codeUnitAt(offset) != 0x20) seen++;
      offset++;
    }

    return TextEditingValue(
      text: grouped,
      selection: TextSelection.collapsed(offset: offset),
    );
  }
}

class PhoneField extends StatelessWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.label = 'Téléphone',
    this.onChanged,
    this.onEditingComplete,
    this.focusNode,
    this.autofocus = false,
    this.helper,
    this.textInputAction = TextInputAction.next,
  });

  final TextEditingController controller;
  final String label;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onEditingComplete;
  final FocusNode? focusNode;
  final bool autofocus;

  final String? helper;

  final TextInputAction textInputAction;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (BuildContext context, TextEditingValue value, Widget? _) {
        final PhoneResult parsed = Phone.parse(value.text);
        final bool partial =
            parsed is PhoneInvalid &&
            (parsed.reason == PhoneProblem.tooShort ||
                parsed.reason == PhoneProblem.empty);
        final String? error = partial
            ? null
            : (parsed is PhoneInvalid ? parsed.message : null);
        final String? warning = parsed is PhoneValid ? parsed.warningMessage : null;

        return TextField(
          controller: controller,
          focusNode: focusNode,
          autofocus: autofocus,
          keyboardType: TextInputType.phone,
          textInputAction: textInputAction,
          inputFormatters: const <TextInputFormatter>[SenegalPhoneFormatter()],
          onChanged: onChanged,
          onEditingComplete: onEditingComplete,
          decoration: InputDecoration(
            labelText: label,
            prefixText: '+$kSenegalCallingCode ',
            prefixStyle: Theme.of(context).textTheme.bodyLarge,
            hintText: '77 123 45 67',
            errorText: error,
            helperText: parsed is PhoneValid ? (warning ?? helper) : null,
            helperStyle: warning == null
                ? null
                : Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: context.cpi.accentText),
            helperMaxLines: 2,
            suffixIcon: parsed is PhoneValid
                ? Icon(
                    warning == null
                        ? PhosphorIconsRegular.checkCircle
                        : PhosphorIconsRegular.warningCircle,
                    size: 20,
                    color: warning == null
                        ? context.cpi.success
                        : context.cpi.accentText,
                  )
                : null,
            suffixIconConstraints: const BoxConstraints(
              minWidth: kCpiMinTouchTarget,
              minHeight: kCpiMinTouchTarget,
            ),
          ),
        );
      },
    );
  }
}
