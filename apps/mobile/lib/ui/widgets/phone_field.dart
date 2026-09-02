import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/utils/phone.dart';
import 'cpi_forui.dart';

/// Regroupe les chiffres au fil de la frappe en gardant le curseur sur le même
/// chiffre. Les sous-classes disent où couper et comment découper.
abstract class _GroupingFormatter extends TextInputFormatter {
  const _GroupingFormatter();

  int get maxDigits;

  String group(String digits);

  static String _digits(String input) =>
      input.replaceAll(RegExp(r'[^0-9]'), '');

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final int cursor = newValue.selection.baseOffset.clamp(
      0,
      newValue.text.length,
    );
    String digits = _digits(newValue.text);
    int digitsBeforeCursor = _digits(newValue.text.substring(0, cursor)).length;

    // Un retour arrière sur un espace de groupement ne retirait rien : le
    // regroupement le reposait aussitôt et il fallait deux appuis pour avancer
    // d'un chiffre. C'est le chiffre d'avant qui part.
    if (newValue.text.length < oldValue.text.length &&
        digits == _digits(oldValue.text) &&
        digitsBeforeCursor > 0) {
      digits =
          digits.substring(0, digitsBeforeCursor - 1) +
          digits.substring(digitsBeforeCursor);
      digitsBeforeCursor--;
    }

    if (digits.length > maxDigits) {
      digits = digits.substring(0, maxDigits);
      digitsBeforeCursor = digitsBeforeCursor.clamp(0, digits.length);
    }

    final String grouped = group(digits);

    int offset = 0;
    int seen = 0;
    while (offset < grouped.length && seen < digitsBeforeCursor) {
      if (_digits(grouped[offset]).isNotEmpty) seen++;
      offset++;
    }

    return TextEditingValue(
      text: grouped,
      selection: TextSelection.collapsed(offset: offset),
    );
  }
}

class SenegalPhoneFormatter extends _GroupingFormatter {
  const SenegalPhoneFormatter();

  @override
  int get maxDigits => kSenegalNationalLength;

  @override
  String group(String digits) => Phone.groupNational(digits);
}

class _NationalFormatter extends _GroupingFormatter {
  const _NationalFormatter(this.callingCode);

  final String callingCode;

  /// La borne E.164 : au-delà, aucun pays n'attribue rien.
  @override
  int get maxDigits => kInternationalMaxDigits;

  @override
  String group(String digits) =>
      WorldPhone.group(digits, callingCode: callingCode);
}

/// Le découpage du pays de l'indicatif, au fil de la frappe — SAUF quand le
/// texte porte déjà son propre indicatif. Même partage que [PhoneFormatter].
class WorldPhoneFormatter extends TextInputFormatter {
  const WorldPhoneFormatter(this.callingCode);

  final String callingCode;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (!Phone.isInternational(newValue.text)) {
      return _NationalFormatter(
        callingCode,
      ).formatEditUpdate(oldValue, newValue);
    }
    return newValue.text.length <= PhoneFormatter.maxLength
        ? newValue
        : oldValue;
  }
}

/// Le groupement sénégalais, SAUF quand l'utilisateur annonce un autre pays.
///
/// Un numéro qui commence par « + » ou « 00 » ne se plie ni aux neuf chiffres
/// ni au découpage 2-3-2-2 : il s'écrit comme il est dicté.
class PhoneFormatter extends TextInputFormatter {
  const PhoneFormatter();

  static const SenegalPhoneFormatter _senegal = SenegalPhoneFormatter();

  /// De quoi écrire l'indicatif le plus long et ses séparateurs, pas un roman.
  static const int maxLength = 24;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (!Phone.isInternational(newValue.text)) {
      return _senegal.formatEditUpdate(oldValue, newValue);
    }
    return newValue.text.length <= maxLength ? newValue : oldValue;
  }
}

/// Champ téléphone d'un pays quelconque : l'indicatif est celui du pays choisi
/// à côté, le masque et la validation viennent du plan de numérotation de ce
/// pays.
///
/// Ce que le champ contient est la partie NATIONALE ; l'indicatif reste dans le
/// décor, comme sur [PhoneField]. Un texte annoncé « + » ou « 00 » prime : on
/// note alors ce qui est dicté.
class InternationalPhoneField extends StatefulWidget {
  const InternationalPhoneField({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.callingCode,
    this.label = 'Téléphone',
    this.helper,
    this.hint,
    this.onChanged,
    this.textInputAction = TextInputAction.next,
  });

  final TextEditingController controller;
  final FocusNode focusNode;

  /// Indicatif SANS le « + », tel que le référentiel `pays` le porte.
  final String callingCode;

  final String label;
  final String? helper;
  final String? hint;
  final ValueChanged<String>? onChanged;
  final TextInputAction textInputAction;

  @override
  State<InternationalPhoneField> createState() =>
      _InternationalPhoneFieldState();
}

class _InternationalPhoneFieldState extends State<InternationalPhoneField> {
  String _last = '';

  @override
  void initState() {
    super.initState();
    _last = widget.controller.text;
    widget.focusNode.addListener(_onFocus);
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_onFocus);
    super.dispose();
  }

  // Le reproche attend que la saisie soit posée : dire « incomplet » au premier
  // chiffre, c'est reprocher d'avoir commencé à taper.
  void _onFocus() => setState(() {});

  void _onChange(TextEditingValue value) {
    if (value.text == _last) return;
    _last = value.text;
    widget.onChanged?.call(value.text);
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final CpiColors cpi = context.cpi;

      return ValueListenableBuilder<TextEditingValue>(
        valueListenable: widget.controller,
        builder: (BuildContext context, TextEditingValue value, Widget? _) {
          final bool vide = value.text.trim().isEmpty;
          // L'indicatif du décor disparaît dès que l'utilisateur écrit le
          // sien : « +221 +39 333 … » ne veut rien dire.
          final bool annonce = Phone.isInternational(value.text);
          final bool complet =
              !vide &&
              WorldPhone.toE164(value.text, callingCode: widget.callingCode) !=
                  null;
          final String? error = vide || complet || widget.focusNode.hasFocus
              ? null
              : 'Numéro incomplet pour ce pays.';

          return FTextField(
            control: FTextFieldControl.managed(
              controller: widget.controller,
              onChange: _onChange,
            ),
            label: Text(widget.label),
            hint: widget.hint,
            focusNode: widget.focusNode,
            keyboardType: TextInputType.phone,
            textInputAction: widget.textInputAction,
            inputFormatters: <TextInputFormatter>[
              WorldPhoneFormatter(widget.callingCode),
            ],
            error: error == null
                ? null
                : Semantics(liveRegion: true, child: Text(error)),
            description: error != null || widget.helper == null
                ? null
                : Text(widget.helper!, maxLines: 2),
            prefixBuilder: annonce
                ? null
                : (
                    BuildContext _,
                    FTextFieldStyle _,
                    Set<FTextFieldVariant> _,
                  ) => Padding(
                    padding: const EdgeInsets.only(left: CpiSpacing.md),
                    child: Center(
                      widthFactor: 1,
                      child: Text(
                        '+${widget.callingCode}',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
            suffixBuilder: !complet
                ? null
                : (
                    BuildContext _,
                    FTextFieldStyle _,
                    Set<FTextFieldVariant> _,
                  ) => Padding(
                    padding: const EdgeInsets.only(right: CpiSpacing.md),
                    child: Icon(
                      PhosphorIconsRegular.checkCircle,
                      size: CpiIconSize.md,
                      color: cpi.success,
                    ),
                  ),
          );
        },
      );
    },
  );
}

class PhoneField extends StatefulWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.label = 'Téléphone',
    this.onChanged,
    this.onEditingComplete,
    this.focusNode,
    this.autofocus = false,
    this.enabled = true,
    this.helper,
    this.textInputAction = TextInputAction.next,
    this.strictSenegal = true,
  });

  final TextEditingController controller;
  final String label;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onEditingComplete;
  final FocusNode? focusNode;
  final bool autofocus;
  final bool enabled;

  final String? helper;

  final TextInputAction textInputAction;

  /// Vrai : neuf chiffres sénégalais, rien d'autre — c'est ce qu'exigent les
  /// fiches représentant et prospect, dont le numéro sert de clé.
  /// Faux : le Sénégal reste la saisie par défaut, mais un numéro annoncé
  /// « + » ou « 00 » est accepté tel quel. Le registre de l'accueil reçoit des
  /// visiteurs étrangers ; il note ce qu'on lui dicte.
  final bool strictSenegal;

  @override
  State<PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<PhoneField> {
  // Posé dans `initState` et non en `late … = …` : un champ initialisé
  // PARESSEUSEMENT lit le contrôleur au premier `_onChange`, donc APRÈS la
  // frappe, se croit inchangé et avale la première saisie. L'écran ne se
  // reconstruisait pas, et son bouton restait éteint sur un champ rempli.
  String _last = '';

  @override
  void initState() {
    super.initState();
    _last = widget.controller.text;
  }

  // ForUI notifie aussi les déplacements du curseur ; seul le texte remonte.
  void _onChange(TextEditingValue value) {
    if (value.text == _last) return;
    _last = value.text;
    widget.onChanged?.call(value.text);
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final CpiColors cpi = context.cpi;

      return ValueListenableBuilder<TextEditingValue>(
        valueListenable: widget.controller,
        builder: (BuildContext context, TextEditingValue value, Widget? _) {
          final bool etranger =
              !widget.strictSenegal && Phone.isInternational(value.text);
          final PhoneResult parsed = Phone.parse(
            value.text,
            strictSenegal: widget.strictSenegal,
          );
          final bool partial =
              parsed is PhoneInvalid &&
              (parsed.reason == PhoneProblem.tooShort ||
                  parsed.reason == PhoneProblem.empty);
          final String? error = partial
              ? null
              : (parsed is PhoneInvalid ? parsed.message : null);
          final String? warning = parsed is PhoneValid
              ? parsed.warningMessage
              : null;
          // L'aide se lit AVANT d'avoir fini de taper : dire comment écrire un
          // numéro étranger une fois le numéro écrit ne sert plus à rien.
          final String? description = error == null
              ? (warning ?? widget.helper)
              : null;

          return FTextField(
            control: FTextFieldControl.managed(
              controller: widget.controller,
              onChange: _onChange,
            ),
            label: Text(widget.label),
            hint: '77 123 45 67',
            enabled: widget.enabled,
            focusNode: widget.focusNode,
            autofocus: widget.autofocus,
            keyboardType: TextInputType.phone,
            textInputAction: widget.textInputAction,
            inputFormatters: <TextInputFormatter>[
              if (widget.strictSenegal)
                const SenegalPhoneFormatter()
              else
                const PhoneFormatter(),
            ],
            onEditingComplete: widget.onEditingComplete,
            error: error == null
                ? null
                : Semantics(liveRegion: true, child: Text(error)),
            description: description == null
                ? null
                : Text(
                    description,
                    maxLines: 2,
                    style: warning == null
                        ? null
                        : theme.textTheme.bodySmall?.copyWith(
                            color: cpi.accentText,
                          ),
                  ),
            // L'indicatif du décor disparaît dès que l'utilisateur écrit le
            // sien : « +221 +33 6 … » ne veut rien dire.
            prefixBuilder: etranger
                ? null
                : (
                    BuildContext _,
                    FTextFieldStyle _,
                    Set<FTextFieldVariant> _,
                  ) => Padding(
                    padding: const EdgeInsets.only(left: CpiSpacing.md),
                    child: Center(
                      widthFactor: 1,
                      child: Text(
                        '+$kSenegalCallingCode',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
            suffixBuilder: parsed is! PhoneValid
                ? null
                : (
                    BuildContext _,
                    FTextFieldStyle _,
                    Set<FTextFieldVariant> _,
                  ) => Padding(
                    padding: const EdgeInsets.only(right: CpiSpacing.md),
                    child: Icon(
                      warning == null
                          ? PhosphorIconsRegular.checkCircle
                          : PhosphorIconsRegular.warningCircle,
                      size: CpiIconSize.md,
                      color: warning == null ? cpi.success : cpi.accentText,
                    ),
                  ),
          );
        },
      );
    },
  );
}
