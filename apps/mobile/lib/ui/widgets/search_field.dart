import 'dart:async';

import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';
import 'local_typeahead.dart';

/// Champ de recherche des listes de représentants.
///
/// La requête sous-jacente balaye la table sans index : la relancer à chaque
/// frappe coûte dix balayages pour un nom de dix lettres.
class CpiSearchField extends StatefulWidget {
  const CpiSearchField({
    super.key,
    required this.onChanged,
    this.initial = '',
    this.hintText = 'Nom ou numéro',
    this.quiet = const Duration(milliseconds: 300),
  });

  final ValueChanged<String> onChanged;
  final String initial;
  final String hintText;
  final Duration quiet;

  @override
  State<CpiSearchField> createState() => _CpiSearchFieldState();
}

class _CpiSearchFieldState extends State<CpiSearchField> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.initial,
  );
  late String _last = widget.initial;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  // ForUI notifie aussi les déplacements du curseur ; seul le texte relance.
  void _onChange(TextEditingValue value) {
    if (value.text == _last) return;
    _last = value.text;
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(widget.quiet, () => widget.onChanged(value.text));
  }

  // Effacer est un geste, pas une frappe : rien à attendre.
  void _clear() {
    _debounce?.cancel();
    _controller.clear();
    _last = '';
    setState(() {});
    widget.onChanged('');
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => FTextField(
      control: FTextFieldControl.managed(
        controller: _controller,
        onChange: _onChange,
      ),
      hint: widget.hintText,
      textInputAction: TextInputAction.search,
      prefixBuilder:
          (BuildContext _, FTextFieldStyle _, Set<FTextFieldVariant> _) =>
              const Padding(
                padding: EdgeInsets.only(left: CpiSpacing.md),
                child: Center(
                  widthFactor: 1,
                  child: Icon(
                    PhosphorIconsRegular.magnifyingGlass,
                    size: CpiIconSize.md,
                  ),
                ),
              ),
      suffixBuilder: _controller.text.isEmpty
          ? null
          : (BuildContext _, FTextFieldStyle _, Set<FTextFieldVariant> _) =>
                boutonEffacer(_clear, label: 'Effacer la recherche'),
    ),
  );
}
