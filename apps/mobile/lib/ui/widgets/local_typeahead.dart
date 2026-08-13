import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// Une option de complétion, réduite à ce dont l'affichage a besoin.
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

  /// Termes supplémentaires sur lesquels la recherche doit mordre : le sigle
  /// d'un syndicat, le nom court d'une banque. Sans eux, chercher « SUDES » ne
  /// trouve rien alors que c'est le seul nom que l'utilisateur connaisse.
  final List<String> keywords;

  bool matches(String query) {
    if (query.isEmpty) return true;
    final String q = foldSearch(query);
    if (foldSearch(label).contains(q)) return true;
    if (secondary != null && foldSearch(secondary!).contains(q)) return true;
    return keywords.any((String k) => foldSearch(k).contains(q));
  }
}

/// Table de repli des diacritiques présents dans les référentiels : noms de
/// départements, de banques et de syndicats sénégalais.
///
/// Dart n'expose pas de normalisation Unicode (pas d'équivalent de
/// `String.normalize('NFD')`), et tirer une dépendance entière pour une
/// vingtaine de caractères serait disproportionné.
const Map<String, String> _diacritics = <String, String>{
  'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
  'ç': 'c',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ñ': 'n',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y',
};

/// Réduit une chaîne à sa forme comparable : minuscules ET sans accents.
///
/// Sans le repli des accents, chercher « Thies » ne trouve pas « Thiès », et
/// « Kedougou » ne trouve pas « Kédougou ». Or personne ne pose les accents en
/// tapant vite sur un clavier de téléphone : le commercial conclut que le
/// département n'existe pas, et ne peut plus enregistrer sa fiche.
///
/// Le repli s'applique des DEUX côtés de la comparaison, si bien que la saisie
/// accentuée continue de fonctionner aussi.
String foldSearch(String input) {
  final StringBuffer out = StringBuffer();
  for (final int rune in input.toLowerCase().runes) {
    final String ch = String.fromCharCode(rune);
    out.write(_diacritics[ch] ?? ch);
  }
  return out.toString();
}

/// Complétion **sur données locales uniquement**.
///
/// C'est le point de conception, pas un raccourci : la liste vient de la base
/// SQLite, donc elle répond en moins d'une frame et fonctionne sans réseau. Une
/// complétion adossée au serveur mettrait plusieurs secondes à répondre sur un
/// lien EDGE, et rendrait une liste vide dans un village — c'est-à-dire
/// exactement là où l'app sert.
///
/// `RawAutocomplete` plutôt que `Autocomplete` : ce dernier impose son propre
/// `TextEditingController`, ce qui empêche le formulaire de piloter la valeur
/// (pré-remplissage entre deux prospects, restauration d'un brouillon).
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

  @override
  State<LocalTypeahead> createState() => _LocalTypeaheadState();
}

class _LocalTypeaheadState extends State<LocalTypeahead> {
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

  /// Revenir sur un champ déjà rempli SÉLECTIONNE tout.
  ///
  /// Sans ça, le curseur atterrit là où le doigt a touché — au milieu du mot —
  /// et corriger « Dakar » en « Diourbel » demande d'effacer caractère par
  /// caractère. Tout sélectionner rend les deux gestes naturels : une frappe
  /// remplace, une suppression vide.
  void _onFocusChange() {
    if (!widget.focusNode.hasFocus) return;
    final String text = widget.controller.text;
    if (text.isEmpty) return;
    // Reporté d'une frame : la plateforme repositionne le curseur elle-même
    // quand le champ prend le focus, et écrire la sélection avant elle serait
    // écrasé.
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

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return RawAutocomplete<TypeaheadOption>(
      textEditingController: widget.controller,
      focusNode: widget.focusNode,
      displayStringForOption: (TypeaheadOption o) => o.label,
      optionsBuilder: (TextEditingValue value) {
        // Une valeur DÉJÀ choisie n'est pas un filtre.
        //
        // Sinon rouvrir la liste sur « Dakar » ne proposait plus que « Dakar » :
        // le texte du champ servait de filtre à lui-même, et il devenait
        // impossible de parcourir les voisins sans tout effacer d'abord.
        if (widget.selectedId != null &&
            value.text.trim().isNotEmpty &&
            widget.options.any(
              (TypeaheadOption o) => o.id == widget.selectedId && o.label == value.text,
            )) {
          return widget.options;
        }
        // Plus de troncature à 8 : le panneau est borné en hauteur et
        // **défile**. Tronquer cachait des entrées sans le dire, et personne ne
        // devine qu'une liste s'arrête.
        return widget.options.where((TypeaheadOption o) => o.matches(value.text));
      },
      onSelected: widget.onSelected,
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
                  onChanged: widget.onChanged,
                  onSubmitted: (String _) => onFieldSubmitted(),
                  decoration: InputDecoration(
                    labelText: widget.label,
                    hintText: widget.hint,
                    suffixIcon: hasText
                        // Bouton d'effacement dès qu'il y a quelque chose à
                        // effacer : c'est le geste que réclame un champ à
                        // complétion, et il vaut mieux qu'un appui long sur la
                        // touche de retour arrière.
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
                    // La coche de validité passe en préfixe : elle disait
                    // « c'est bon », le bouton d'effacement dit « on peut
                    // recommencer », et les deux doivent tenir ensemble.
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
                  child: results.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(CpiSpacing.md),
                          child: Text(widget.emptyHint, style: theme.textTheme.bodyMedium),
                        )
                      // `shrinkWrap` avec une hauteur bornée : le panneau prend
                      // la place de son contenu tant qu'il tient, et **défile**
                      // au-delà. C'est ce défilement qui rend la liste entière
                      // parcourable maintenant qu'elle n'est plus tronquée.
                      : Scrollbar(
                          child: ListView.builder(
                            padding: EdgeInsets.zero,
                            shrinkWrap: true,
                            itemCount: results.length,
                            itemBuilder: (BuildContext context, int index) {
                              final TypeaheadOption option = results.elementAt(index);
                              final bool current = option.id == widget.selectedId;
                              return ListTile(
                                // 44 px minimum de cible tactile
                                // (docs/design.md §1).
                                minVerticalPadding: CpiSpacing.sm,
                                selected: current,
                                selectedTileColor:
                                    theme.colorScheme.secondaryContainer,
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
