import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/utils/phone.dart';

/// Masque `XX XXX XX XX` appliqué à la frappe.
///
/// Le formateur ne travaille que sur les **chiffres** : il les extrait, les
/// regroupe, puis replace le curseur en comptant les chiffres à gauche de la
/// position d'origine. Repositionner le curseur à `text.length` — la solution
/// qu'on voit partout — renverrait le curseur en fin de champ à chaque
/// correction au milieu du numéro, ce qui rend impossible de rattraper une
/// faute de frappe sans tout effacer.
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
          newValue.text.replaceAll(RegExp(r'[^0-9]'), '').length.clamp(
            0,
            kSenegalNationalLength,
          ),
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

/// Champ téléphone : indicatif fixe, masque, validation vivante.
///
/// L'indicatif `+221` est un **préfixe non éditable** et pas du texte dans le
/// champ. Éditable, il finit toujours par être effacé par mégarde — et un
/// numéro sans indicatif produit une clé de déduplication différente, donc un
/// doublon que rien ne rattrape.
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

  /// Message secondaire affiché sous le champ quand la saisie est valide.
  final String? helper;

  final TextInputAction textInputAction;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (BuildContext context, TextEditingValue value, Widget? _) {
        final PhoneResult parsed = Phone.parse(value.text);
        // Une saisie incomplète n'est pas une erreur : afficher « numéro
        // incomplet » dès le premier chiffre transforme un champ vide en champ
        // en faute, et donne l'impression de se tromper avant même d'avoir tapé.
        final bool partial =
            parsed is PhoneInvalid &&
            (parsed.reason == PhoneProblem.tooShort ||
                parsed.reason == PhoneProblem.empty);
        final String? error = partial ? null : (parsed is PhoneInvalid ? parsed.message : null);

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
            helperText: parsed is PhoneValid ? helper : null,
            suffixIcon: parsed is PhoneValid
                ? Icon(
                    PhosphorIconsRegular.checkCircle,
                    size: 20,
                    color: context.cpi.success,
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
