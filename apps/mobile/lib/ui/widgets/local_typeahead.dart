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
class LocalTypeahead extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return RawAutocomplete<TypeaheadOption>(
      textEditingController: controller,
      focusNode: focusNode,
      displayStringForOption: (TypeaheadOption o) => o.label,
      optionsBuilder: (TextEditingValue value) {
        // 8 propositions et pas la liste entière : au-delà, le panneau couvre le
        // clavier et l'utilisateur ne voit plus ce qu'il tape.
        return options.where((TypeaheadOption o) => o.matches(value.text)).take(8);
      },
      onSelected: onSelected,
      fieldViewBuilder:
          (
            BuildContext context,
            TextEditingController textController,
            FocusNode node,
            VoidCallback onFieldSubmitted,
          ) {
            return TextField(
              controller: textController,
              focusNode: node,
              textInputAction: textInputAction,
              onChanged: onChanged,
              onSubmitted: (String _) => onFieldSubmitted(),
              decoration: InputDecoration(
                labelText: label,
                hintText: hint,
                suffixIcon: Icon(
                  selectedId == null
                      ? PhosphorIconsRegular.caretDown
                      : PhosphorIconsRegular.checkCircle,
                  size: 20,
                  color: selectedId == null
                      ? theme.colorScheme.onSurfaceVariant
                      : context.cpi.success,
                ),
                suffixIconConstraints: const BoxConstraints(
                  minWidth: kCpiMinTouchTarget,
                  minHeight: kCpiMinTouchTarget,
                ),
              ),
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
                  constraints: const BoxConstraints(maxHeight: 260, maxWidth: 480),
                  child: results.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(CpiSpacing.md),
                          child: Text(emptyHint, style: theme.textTheme.bodyMedium),
                        )
                      : ListView.builder(
                          padding: EdgeInsets.zero,
                          shrinkWrap: true,
                          itemCount: results.length,
                          itemBuilder: (BuildContext context, int index) {
                            final TypeaheadOption option = results.elementAt(index);
                            return ListTile(
                              dense: true,
                              // 44 px minimum : l'app se tient debout, souvent à
                              // une main (docs/design.md §1).
                              minVerticalPadding: CpiSpacing.sm,
                              title: Text(option.label),
                              subtitle: option.secondary == null
                                  ? null
                                  : Text(option.secondary!),
                              onTap: () => onSelect(option),
                            );
                          },
                        ),
                ),
              ),
            );
          },
    );
  }
}
