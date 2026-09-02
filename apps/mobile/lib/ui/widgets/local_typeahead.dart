import 'dart:math' as math;
import 'dart:ui' show FlutterView;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';

@immutable
class TypeaheadOption {
  const TypeaheadOption({
    required this.id,
    required this.label,
    this.secondary,
    this.keywords = const <String>[],
  }) : separator = false;

  /// Trait de séparation entre les intitulés les plus fréquents et le reste du
  /// référentiel. Ne se choisit pas, et disparaît dès qu'on filtre : une liste
  /// filtrée n'a plus de « tête » à séparer.
  const TypeaheadOption.separator(this.label)
    : id = '',
      secondary = null,
      keywords = const <String>[],
      separator = true;

  final String id;
  final String label;
  final String? secondary;

  final List<String> keywords;

  final bool separator;

  bool matches(String query) {
    if (query.isEmpty) return true;
    if (separator) return false;
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

/// Le bouton d'effacement d'un champ, posé en suffixe.
///
/// `FButton` s'annonce dans un nœud À LUI (`Semantics(container: true)`, ForUI
/// `FTappable`). Dans le suffixe d'un `FTextField`, ce nœud devient l'enfant
/// explicite du groupe fusionné d'`InputDecorator`, et Flutter n'y écarte pas
/// les nœuds devenus vides (`_mergeSiblingGroup`, rendering/object.dart) : un
/// champ à cheval sur la lisière du cache sémantique d'une liste défilante
/// publie alors un nœud de rectangle vide et l'arbre part en assertion. Le
/// bouton s'annonce donc DANS le nœud du suffixe, comme le fait `IconButton`.
Widget boutonEffacer(VoidCallback onPress, {required String label}) =>
    Semantics(
      button: true,
      label: label,
      onTap: onPress,
      child: ExcludeSemantics(
        child: FButton.icon(
          variant: FButtonVariant.ghost,
          onPress: onPress,
          child: const Icon(PhosphorIconsRegular.xCircle),
        ),
      ),
    );

/// Le calque des options, pour les tests de géométrie : c'est le seul repère
/// stable quand la liste change de primitive.
const Key kTypeaheadOptions = Key('typeahead-options');

/// Le trait entre les intitulés les plus servis et le reste du référentiel.
///
/// Une tuile, pour que le groupe lui pose ses filets comme aux autres, mais
/// sans rien à toucher : c'est un intertitre, pas un choix.
class _Separateur extends StatelessWidget with FTileMixin {
  const _Separateur(this.texte);

  final String texte;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return ExcludeSemantics(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          CpiSpacing.md,
          CpiSpacing.sm,
          CpiSpacing.md,
          CpiSpacing.xs,
        ),
        child: Text(
          texte,
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
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
    this.error,
    this.description,
    this.emptyHint = 'Aucun résultat',
    this.noMatchHint,
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

  /// Reproche de validation. Porté par le champ lui-même : posé à côté, il
  /// n'est rattaché à rien et le lecteur d'écran n'annonce que le libellé.
  final String? error;

  /// Aide permanente sous le champ, quand rien d'autre n'occupe la ligne de
  /// description : ce que la liste contient, ou ce qu'elle ne contient pas.
  final String? description;

  final String emptyHint;

  /// Ce qui se lit quand la saisie ne rencontre AUCUNE option. Par défaut
  /// « Aucun résultat pour « … » », qui ne dit pas où écrire la valeur absente.
  final String? noMatchHint;

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

class _LocalTypeaheadState extends State<LocalTypeahead>
    with AutomaticKeepAliveClientMixin<LocalTypeahead> {
  // Revoir tout le référentiel se demande par un tap sur le champ. L'état
  // « une valeur est choisie » ne le dit pas : il est posé au moment du choix.
  bool _browsing = false;

  /// Voir `PhoneField` : en `late … = …`, la valeur serait lue au premier
  /// `_onChange`, donc après la frappe, et le premier caractère n'annulerait
  /// pas le choix posé.
  String _last = '';

  /// `RawAutocomplete` INSCRIT son écouteur de focus sous `_onFocusChange` et
  /// le RETIRE sous `_updateOptionsViewVisibility` (Flutter, autocomplete.dart)
  /// : sur un `FocusNode` fourni par l'écran, l'écouteur survit à la
  /// destruction du champ. Une liste longue recycle ses enfants ; le champ
  /// revenu à l'écran en pose un second, et l'orphelin masque un `OverlayPortal`
  /// démonté — l'application casse au moment de choisir. Tant que le champ
  /// reste vivant, l'écouteur reste unique.
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _last = widget.controller.text;
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
    _last = '';
    widget.controller.clear();
    widget.onChanged?.call('');
    widget.focusNode.requestFocus();
  }

  /// Relance en cours : le texte fait un aller-retour, l'écran n'en saura rien.
  bool _relance = false;

  // ForUI notifie aussi les déplacements du curseur ; seul le texte remonte.
  void _onChange(TextEditingValue value) {
    if (_relance) return;
    if (value.text == _last) return;
    _last = value.text;
    widget.onChanged?.call(value.text);
  }

  /// Rouvre la liste au premier appui, quel que soit l'état du champ.
  ///
  /// `RawAutocomplete` ne calcule ses options que lorsque le TEXTE du champ
  /// change (`_onChangedField`, autocomplete.dart). Un champ prérempli — une
  /// correction, un brouillon repris — n'ouvrait donc plus jamais sa liste.
  /// Un champ VIDÉ par l'écran non plus : `TextEditingController.clear()`
  /// pose le curseur à zéro, l'appui ne déplace donc rien, le contrôleur ne
  /// notifie pas et la liste restait fermée jusqu'à la première frappe.
  ///
  /// Un aller-retour du texte la relance, sans que l'écran ni le choix retenu
  /// ne bougent.
  void _revoirLaListe() {
    setState(() => _browsing = true);
    final TextEditingValue valeur = widget.controller.value;
    _relance = true;
    widget.controller.value = valeur.copyWith(
      text: valeur.text.isEmpty ? ' ' : '',
      selection: const TextSelection.collapsed(offset: 0),
    );
    widget.controller.value = valeur;
    _relance = false;
  }

  String? _inlineMessage(String text) {
    if (widget.options.isEmpty) return widget.emptyHint;
    if (widget.freeText) return null;
    if (!widget.focusNode.hasFocus) return null;
    if (widget.selectedId != null) return null;
    final String query = text.trim();
    if (query.isEmpty) return null;
    final bool anyMatch = widget.options.any(
      (TypeaheadOption o) => o.matches(query),
    );
    if (anyMatch) return null;
    return widget.noMatchHint ?? 'Aucun résultat pour « $query »';
  }

  static const double _optionsMaxHeight = 280;

  /// La fenêtre, en pixels logiques. Le `MediaQuery` du champ ne peut pas
  /// servir : sous un `Scaffold` qui se redimensionne, celui du corps annonce
  /// un clavier de hauteur nulle (`removeBottomInset`, scaffold.dart), et
  /// `OverlayPortal` construit la liste avec ce même contexte alors qu'elle,
  /// s'étend jusqu'aux bords de l'écran.
  ({double height, double keyboard, double statusBar}) _window(
    BuildContext context,
  ) {
    final FlutterView view = View.of(context);
    final double ratio = view.devicePixelRatio;
    return (
      height: view.physicalSize.height / ratio,
      keyboard: view.viewInsets.bottom / ratio,
      statusBar: view.viewPadding.top / ratio,
    );
  }

  /// Le calque des options recouvre la fenêtre ENTIÈRE : `mostSpace` compte
  /// comme place libre les pixels cachés par le clavier et ouvre la liste
  /// dessous. Le côté se choisit ici, sur la fenêtre réellement visible.
  bool _opensUp(BuildContext context) {
    final RenderObject? box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return false;
    final ({double height, double keyboard, double statusBar}) window = _window(
      context,
    );
    final double top = box.localToGlobal(Offset.zero).dy;
    final double below =
        window.height - window.keyboard - top - box.size.height;
    return below < top - window.statusBar;
  }

  /// Le message d'état vit sous le champ, dans la ligne de description que
  /// ForUI réserve déjà : il ne peut plus être coupé de son champ.
  Widget _description(BuildContext context, String message) {
    final ThemeData theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(
          PhosphorIconsRegular.info,
          size: CpiIconSize.xs,
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
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return CpiForui(builder: _field);
  }

  Widget _field(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool up = _opensUp(context);
    return RawAutocomplete<TypeaheadOption>(
      textEditingController: widget.controller,
      focusNode: widget.focusNode,
      // Le dernier champ d'un formulaire, clavier ouvert, n'a plus rien
      // au-dessous de lui : la liste s'ouvre du côté où il reste de la place.
      optionsViewOpenDirection: up
          ? OptionsViewOpenDirection.up
          : OptionsViewOpenDirection.down,
      displayStringForOption: (TypeaheadOption o) => o.label,
      optionsBuilder: (TextEditingValue value) {
        final bool settled =
            widget.selectedId != null &&
            widget.options.any(
              (TypeaheadOption o) =>
                  o.id == widget.selectedId && o.label == value.text,
            );
        // Le choix est pose et rien ne le remet en cause: AUCUNE option. Sinon le
        // libelle retenu se retrouve seul dans la liste, l'overlay se rouvre sur
        // lui des que le champ reprend le focus, et l'utilisateur croit devoir
        // choisir une seconde fois.
        if (settled && !_browsing) {
          return const Iterable<TypeaheadOption>.empty();
        }
        // Revoir le referentiel: le libelle retenu remplit le champ et ne doit
        // pas filtrer la liste a lui seul.
        if (settled && value.text.trim().isNotEmpty) return widget.options;
        return widget.options.where(
          (TypeaheadOption o) => o.matches(value.text),
        );
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
              builder:
                  (BuildContext context, TextEditingValue value, Widget? _) {
                    final bool hasText = value.text.isNotEmpty;
                    final String? message = _inlineMessage(value.text);
                    final String? aide = widget.description;
                    return FTextField(
                      control: FTextFieldControl.managed(
                        controller: textController,
                        onChange: _onChange,
                      ),
                      focusNode: node,
                      label: Text(widget.label),
                      hint: widget.hint,
                      description: message != null
                          ? _description(context, message)
                          : (aide == null ? null : Text(aide)),
                      error: widget.error == null
                          ? null
                          : Semantics(
                              liveRegion: true,
                              child: Text(widget.error!),
                            ),
                      textInputAction: widget.textInputAction,
                      inputFormatters: widget.maxLength == null
                          ? null
                          : <TextInputFormatter>[
                              LengthLimitingTextInputFormatter(
                                widget.maxLength,
                              ),
                            ],
                      onTap: _revoirLaListe,
                      onSubmit: (String _) => onFieldSubmitted(),
                      prefixBuilder: widget.selectedId == null
                          ? null
                          : (
                              BuildContext _,
                              FTextFieldStyle _,
                              Set<FTextFieldVariant> _,
                            ) => Padding(
                              padding: const EdgeInsets.only(
                                left: CpiSpacing.md,
                              ),
                              child: Center(
                                widthFactor: 1,
                                child: Icon(
                                  PhosphorIconsRegular.checkCircle,
                                  size: CpiIconSize.md,
                                  color: context.cpi.success,
                                ),
                              ),
                            ),
                      suffixBuilder:
                          (
                            BuildContext _,
                            FTextFieldStyle _,
                            Set<FTextFieldVariant> _,
                          ) => hasText
                          ? boutonEffacer(_clear, label: 'Effacer')
                          : Padding(
                              padding: const EdgeInsets.only(
                                right: CpiSpacing.md,
                              ),
                              child: Icon(
                                PhosphorIconsRegular.caretDown,
                                size: CpiIconSize.md,
                                color: theme.colorScheme.onSurfaceVariant,
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
            // Rien ici ne doit occuper toute la place offerte : Flutter réserve
            // du bord de l'écran jusqu'au champ, puis colle SON contenu contre
            // le champ. Un `Align` étalé reprenait ce cadre à son compte et
            // affichait la liste au sommet de l'écran, sur la barre d'état.
            return LayoutBuilder(
              builder: (BuildContext context, BoxConstraints room) {
                // La place annoncée court jusqu'au bord du calque, c'est-à-dire
                // sous la barre d'état au-dessus, sous le clavier au-dessous.
                final ({double height, double keyboard, double statusBar})
                window = _window(context);
                final double usable =
                    room.maxHeight - (up ? window.statusBar : window.keyboard);
                // UN groupe, pas une pile de cartes : hors d'un `FTileGroup`,
                // chaque `FTile` porte son propre cadre et la liste se lit
                // comme dix boîtes empilées au lieu d'un menu.
                return CpiForui(
                  builder: (BuildContext context) => Container(
                    key: kTypeaheadOptions,
                    // La liste flotte au-dessus du formulaire : sans ombre, le
                    // filet seul ne la décolle pas du texte qu'elle recouvre.
                    decoration: const BoxDecoration(
                      borderRadius: CpiRadius.brLg,
                      boxShadow: CpiElevation.md,
                    ),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: FTileGroup.builder(
                        maxHeight: math.max(
                          math.min(_optionsMaxHeight, usable),
                          kMinInteractiveDimension,
                        ),
                        count: results.length,
                        tileBuilder: (BuildContext context, int index) {
                          final TypeaheadOption option = results.elementAt(
                            index,
                          );
                          if (option.separator) {
                            return _Separateur(option.label);
                          }
                          final bool current = option.id == widget.selectedId;
                          return FTile(
                            selected: current,
                            title: Text(option.label),
                            subtitle: option.secondary == null
                                ? null
                                : Text(option.secondary!),
                            suffix: current
                                ? Icon(
                                    PhosphorIconsRegular.check,
                                    size: CpiIconSize.sm,
                                    color: theme.colorScheme.primary,
                                  )
                                : null,
                            onPress: () => onSelect(option),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
            );
          },
    );
  }
}
