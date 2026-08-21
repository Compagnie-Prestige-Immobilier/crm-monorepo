import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

@immutable
class TypeaheadOption {
  const TypeaheadOption({
    required this.id,
    required this.label,
    this.secondary,
    this.keywords = const <String>[],
  });

  final String id;
  final String label;
  final String? secondary;

  final List<String> keywords;

  bool matches(String query) {
    if (query.isEmpty) return true;
    final String q = foldSearch(query);
    if (foldSearch(label).contains(q)) return true;
    if (secondary != null && foldSearch(secondary!).contains(q)) return true;
    return keywords.any((String k) => foldSearch(k).contains(q));
  }
}

const Map<String, String> _diacritics = <String, String>{
  'à': 'a',
  'á': 'a',
  'â': 'a',
  'ä': 'a',
  'ã': 'a',
  'å': 'a',
  'ç': 'c',
  'è': 'e',
  'é': 'e',
  'ê': 'e',
  'ë': 'e',
  'ì': 'i',
  'í': 'i',
  'î': 'i',
  'ï': 'i',
  'ñ': 'n',
  'ò': 'o',
  'ó': 'o',
  'ô': 'o',
  'ö': 'o',
  'õ': 'o',
  'ù': 'u',
  'ú': 'u',
  'û': 'u',
  'ü': 'u',
  'ý': 'y',
  'ÿ': 'y',
};

String foldSearch(String input) {
  final StringBuffer out = StringBuffer();
  for (final int rune in input.toLowerCase().runes) {
    final String ch = String.fromCharCode(rune);
    out.write(_diacritics[ch] ?? ch);
  }
  return out.toString();
}

class LocalTypeahead extends StatefulWidget {
  const LocalTypeahead({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.options,
    required this.label,
    required this.onSelected,
    this.hint,
    this.emptyHint = 'Aucun résultat',
    this.selectedId,
    this.textInputAction = TextInputAction.next,
    this.onChanged,
    this.freeText = false,
    this.maxLength,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final List<TypeaheadOption> options;
  final String label;
  final String? hint;
  final String emptyHint;
  final String? selectedId;
  final TextInputAction textInputAction;
  final ValueChanged<TypeaheadOption> onSelected;
  final ValueChanged<String>? onChanged;

  /// La liste ASSISTE la saisie sans la borner. Une valeur absente du
  /// référentiel est légitime, et « Aucun résultat » s'y lirait comme un refus.
  final bool freeText;

  /// Coupe la saisie à la longueur que le serveur accepte : au-delà, c'est le
  /// LOT de synchronisation entier qui serait refusé, pas cette seule fiche.
  final int? maxLength;

  @override
  State<LocalTypeahead> createState() => _LocalTypeaheadState();
}

class _LocalTypeaheadState extends State<LocalTypeahead> {
  // Revoir tout le référentiel se demande par un tap sur le champ. L'état
  // « une valeur est choisie » ne le dit pas : il est posé au moment du choix.
  bool _browsing = false;

  @override
  void initState() {
    super.initState();
    widget.focusNode.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(LocalTypeahead oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusNode != widget.focusNode) {
      oldWidget.focusNode.removeListener(_onFocusChange);
      widget.focusNode.addListener(_onFocusChange);
    }
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_onFocusChange);
    super.dispose();
  }

  void _onFocusChange() {
    final bool focused = widget.focusNode.hasFocus;
    if (mounted) setState(() => _browsing = _browsing && focused);
    if (!focused) return;
    final String text = widget.controller.text;
    if (text.isEmpty) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !widget.focusNode.hasFocus) return;
      widget.controller.selection = TextSelection(
        baseOffset: 0,
        extentOffset: widget.controller.text.length,
      );
    });
  }

  void _clear() {
    widget.controller.clear();
    widget.onChanged?.call('');
    widget.focusNode.requestFocus();
  }

  String? _inlineMessage(String text) {
    if (widget.options.isEmpty) return widget.emptyHint;
    if (widget.freeText) return null;
    if (!widget.focusNode.hasFocus) return null;
    if (widget.selectedId != null) return null;
    final String query = text.trim();
    if (query.isEmpty) return null;
    final bool anyMatch = widget.options.any((TypeaheadOption o) => o.matches(query));
    return anyMatch ? null : 'Aucun résultat pour « $query »';
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        _field(context, theme),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: widget.controller,
          builder: (BuildContext context, TextEditingValue value, Widget? _) {
            final String? message = _inlineMessage(value.text);
            if (message == null) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(
                top: CpiSpacing.xxs,
                left: CpiSpacing.sm,
                right: CpiSpacing.sm,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(
                    PhosphorIconsRegular.info,
                    size: 16,
                    color: context.cpi.accentText,
                  ),
                  const SizedBox(width: CpiSpacing.xxs),
                  Expanded(
                    child: Text(
                      message,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: context.cpi.accentText,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _field(BuildContext context, ThemeData theme) {
    return RawAutocomplete<TypeaheadOption>(
      textEditingController: widget.controller,
      focusNode: widget.focusNode,
      // Le dernier champ d'un formulaire, clavier ouvert, n'a plus rien
      // au-dessous de lui : la liste s'ouvre du côté où il reste de la place.
      optionsViewOpenDirection: OptionsViewOpenDirection.mostSpace,
      displayStringForOption: (TypeaheadOption o) => o.label,
      optionsBuilder: (TextEditingValue value) {
        final bool settled =
            widget.selectedId != null &&
            widget.options.any(
              (TypeaheadOption o) => o.id == widget.selectedId && o.label == value.text,
            );
        // Le choix est pose et rien ne le remet en cause: AUCUNE option. Sinon le
        // libelle retenu se retrouve seul dans la liste, l'overlay se rouvre sur
        // lui des que le champ reprend le focus, et l'utilisateur croit devoir
        // choisir une seconde fois.
        if (settled && !_browsing) return const Iterable<TypeaheadOption>.empty();
        // Revoir le referentiel: le libelle retenu remplit le champ et ne doit
        // pas filtrer la liste a lui seul.
        if (settled && value.text.trim().isNotEmpty) return widget.options;
        return widget.options.where((TypeaheadOption o) => o.matches(value.text));
      },
      onSelected: (TypeaheadOption option) {
        setState(() => _browsing = false);
        widget.focusNode.unfocus();
        widget.onSelected(option);
      },
      fieldViewBuilder:
          (
            BuildContext context,
            TextEditingController textController,
            FocusNode node,
            VoidCallback onFieldSubmitted,
          ) {
            return ValueListenableBuilder<TextEditingValue>(
              valueListenable: textController,
              builder: (BuildContext context, TextEditingValue value, Widget? _) {
                final bool hasText = value.text.isNotEmpty;
                return TextField(
                  controller: textController,
                  focusNode: node,
                  textInputAction: widget.textInputAction,
                  inputFormatters: widget.maxLength == null
                      ? null
                      : <TextInputFormatter>[
                          LengthLimitingTextInputFormatter(widget.maxLength),
                        ],
                  onTap: () => setState(() => _browsing = true),
                  onChanged: widget.onChanged,
                  onSubmitted: (String _) => onFieldSubmitted(),
                  decoration: InputDecoration(
                    labelText: widget.label,
                    hintText: widget.hint,
                    suffixIcon: hasText
                        ? IconButton(
                            onPressed: _clear,
                            tooltip: 'Effacer',
                            icon: Icon(
                              PhosphorIconsRegular.xCircle,
                              size: 20,
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          )
                        : Icon(
                            PhosphorIconsRegular.caretDown,
                            size: 20,
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                    prefixIcon: widget.selectedId == null
                        ? null
                        : Icon(
                            PhosphorIconsRegular.checkCircle,
                            size: 20,
                            color: context.cpi.success,
                          ),
                    suffixIconConstraints: const BoxConstraints(
                      minWidth: kCpiMinTouchTarget,
                      minHeight: kCpiMinTouchTarget,
                    ),
                  ),
                );
              },
            );
          },
      optionsViewBuilder:
          (
            BuildContext context,
            void Function(TypeaheadOption) onSelect,
            Iterable<TypeaheadOption> results,
          ) {
            return Align(
              alignment: Alignment.topLeft,
              child: Material(
                elevation: 2,
                borderRadius: CpiRadius.brMd,
                clipBehavior: Clip.antiAlias,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 280, maxWidth: 480),
                  child: Scrollbar(
                    child: ListView.builder(
                      padding: EdgeInsets.zero,
                      shrinkWrap: true,
                      itemCount: results.length,
                      itemBuilder: (BuildContext context, int index) {
                        final TypeaheadOption option = results.elementAt(index);
                        final bool current = option.id == widget.selectedId;
                        return ListTile(
                          minVerticalPadding: CpiSpacing.sm,
                          selected: current,
                          selectedTileColor: theme.colorScheme.secondaryContainer,
                          title: Text(option.label),
                          subtitle: option.secondary == null
                              ? null
                              : Text(option.secondary!),
                          trailing: current
                              ? Icon(
                                  PhosphorIconsRegular.check,
                                  size: 18,
                                  color: theme.colorScheme.primary,
                                )
                              : null,
                          onTap: () => onSelect(option),
                        );
                      },
                    ),
                  ),
                ),
              ),
            );
          },
    );
  }
}
