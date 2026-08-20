import 'dart:async';

import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_tokens.dart';

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
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(widget.quiet, () => widget.onChanged(value));
  }

  void _clear() {
    _debounce?.cancel();
    _controller.clear();
    setState(() {});
    widget.onChanged('');
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: widget.hintText,
        prefixIcon: const Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Effacer la recherche',
                icon: const Icon(PhosphorIconsRegular.xCircle, size: 20),
                onPressed: _clear,
              ),
        suffixIconConstraints: const BoxConstraints(
          minWidth: kCpiMinTouchTarget,
          minHeight: kCpiMinTouchTarget,
        ),
      ),
      onChanged: _onChanged,
    );
  }
}
