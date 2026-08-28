/// Bibliothèque de composants ForUI de CPI GO.
///
/// Chaque primitive installe elle-même le thème ForUI dérivé du thème Material
/// courant via [CpiForui] : un écran reste correct qu'il soit ou non enveloppé
/// d'un `FTheme`, et le clair/sombre CPI comme CHUES suit `Theme.of(context)`.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/feedback/feedback.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/theme/cpi_typography.dart';
import '../../core/theme/forui_theme.dart';
import 'cpi_forui.dart';
import 'sync_status_icon.dart';

/// Le geste, précédé de son retour haptique et sonore.
///
/// Le kit est le seul endroit d'où le service est appelé : un écran qui rejoue
/// `HapticFeedback` par-dessus une primitive vibre deux fois.
VoidCallback? _feedback(VoidCallback? action, CpiFeedback? retour) {
  if (action == null || retour == null) return action;
  return () {
    CpiFeedbackService.instance.jouer(retour);
    action();
  };
}

/// Coque d'écran : bandeau d'actions fin en haut, titre en gros dans le corps.
///
/// [leading] reçoit typiquement `const CpiBackButton()` et [actions] les
/// `OfflineIndicator()`/`SyncBadge()` déjà utilisés par les écrans.
class CpiScaffold extends StatelessWidget {
  const CpiScaffold({
    super.key,
    required this.title,
    required this.body,
    this.subtitle,
    this.leading,
    this.actions = const <Widget>[],
    this.banner,
    this.footer,
    this.showTitle = true,
  });

  final String title;

  /// Où l'on se trouve dans le parcours, sous le titre : « Phase 1 »,
  /// « Phase 2 ». Une ligne, jamais une phrase.
  final String? subtitle;

  final Widget body;
  final Widget? leading;
  final List<Widget> actions;

  /// Bandeau d'état pleine largeur, sous le titre et au-dessus du corps.
  /// Reçoit un [CpiStatusBand] : le bas de l'écran reste à la navigation et à
  /// une seule barre d'action.
  final Widget? banner;

  /// Barre d'action ou navigation du bas, posée sous le corps.
  final Widget? footer;

  /// Passer à false pour un écran qui dessine lui-même son en-tête.
  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    final bool hasHeader = leading != null || actions.isNotEmpty;
    return CpiForui(
      builder: (BuildContext context) => Material(
        type: MaterialType.transparency,
        child: FToaster(
          child: FScaffold(
            childPad: false,
            header: hasHeader
                ? FHeader.nested(
                    prefixes: <Widget>[?leading],
                    suffixes: actions,
                  )
                : null,
            footer: footer,
            child: SafeArea(
              top: !hasHeader,
              bottom: footer == null,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  // Sans bandeau d'actions, le titre respire sous la barre
                  // système comme il le fait sous un en-tête.
                  if (!hasHeader) const SizedBox(height: CpiSpacing.lg),
                  if (showTitle) CpiTitle(title, subtitle: subtitle),
                  _Banner(banner),
                  Expanded(child: body),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// L'emplacement du bandeau d'état. Une bande qui apparaît pousse le corps :
/// sans transition, la liste sautait d'une ligne sous le doigt.
class _Banner extends StatelessWidget {
  const _Banner(this.child);

  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final CpiMotion motion = CpiMotion.of(context);
    return AnimatedSize(
      duration: motion.component,
      curve: motion.easeOut,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: motion.component,
        switchInCurve: motion.easeOut,
        switchOutCurve: motion.easeOut,
        child:
            child ??
            const SizedBox(
              key: ValueKey<String>('sans-bandeau'),
              width: double.infinity,
            ),
      ),
    );
  }
}

/// Titre d'écran en gros, annoncé comme en-tête aux lecteurs d'écran.
class CpiTitle extends StatelessWidget {
  const CpiTitle(this.text, {super.key, this.subtitle});

  final String text;

  /// Rang dans le parcours, sous le titre et dans le même nœud : deux en-têtes
  /// qui se suivent se liraient comme deux écrans.
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String? subtitle = this.subtitle;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.md,
      ),
      child: subtitle == null
          ? Semantics(
              header: true,
              child: Text(text, style: theme.textTheme.headlineSmall),
            )
          : Semantics(
              header: true,
              label: '$text. $subtitle',
              excludeSemantics: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(text, style: theme.textTheme.headlineSmall),
                  Text(
                    subtitle,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

/// Action du bandeau. À poser dans `leading`/`actions` de [CpiScaffold].
///
/// `FHeaderAction` s'appuie sur `FTappable`, dont les rappels sont annulés par
/// le `FTappableGroup` de `FHeader.nested` : le nœud sémantique n'expose plus
/// que `focus`, Switch Access et Voice Access ne peuvent plus l'activer. La
/// coquille sémantique redonne le nom, le rôle et l'activation (WCAG 4.1.2).
class CpiHeaderAction extends StatelessWidget {
  const CpiHeaderAction({
    super.key,
    required this.icon,
    required this.label,
    this.onPressed,
  });

  final IconData icon;

  /// Nom accessible : l'icône seule n'en porte aucun.
  final String label;

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => MergeSemantics(
    child: Semantics(
      container: true,
      button: true,
      enabled: onPressed != null,
      label: label,
      onTap: onPressed,
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minWidth: kCpiHeaderActionSize,
          minHeight: kCpiHeaderActionSize,
        ),
        child: FHeaderAction(onPress: onPressed, icon: Icon(icon)),
      ),
    ),
  );
}

enum CpiButtonVariant { primary, secondary, ghost, danger }

/// Bouton d'action et ses trois peaux : repos, envoi ([loading]) et
/// confirmation ([success]).
///
/// La confirmation retombe au repos toute seule au bout de
/// [successLinger] : le commercial voit que c'est parti, puis le bouton
/// redevient utilisable pour la fiche suivante.
class CpiButton extends StatefulWidget {
  const CpiButton(
    this.label, {
    super.key,
    this.onPressed,
    this.variant = CpiButtonVariant.primary,
    this.icon,
    this.subtitle,
    this.loading = false,
    this.loadingLabel,
    this.success = false,
    this.successLabel,
    this.onSuccessShown,
    this.expand = true,
  });

  /// Temps d'affichage de la confirmation. Assez long pour être lu debout,
  /// assez court pour ne pas bloquer la saisie suivante.
  static const Duration successLinger = Duration(milliseconds: 800);

  final String label;
  final VoidCallback? onPressed;
  final CpiButtonVariant variant;
  final IconData? icon;

  /// Raison du blocage, sous le libellé. N'apparaît que sur un bouton éteint :
  /// sinon elle répéterait ce que le libellé dit déjà.
  final String? subtitle;

  /// Pendant l'envoi le libellé reste, la roue remplace l'icône et les touches
  /// ne passent plus : verrou anti double envoi.
  final bool loading;

  final String? loadingLabel;

  /// L'envoi a abouti : aplat vert, coche, libellé de confirmation.
  final bool success;

  final String? successLabel;

  /// Appelé quand la confirmation s'efface. C'est là qu'un écran ferme sa
  /// feuille ou remet son formulaire à zéro.
  final VoidCallback? onSuccessShown;

  final bool expand;

  @override
  State<CpiButton> createState() => _CpiButtonState();
}

class _CpiButtonState extends State<CpiButton> {
  Timer? _timer;
  late bool _success = widget.success;

  @override
  void initState() {
    super.initState();
    if (_success) _linger();
  }

  @override
  void didUpdateWidget(CpiButton old) {
    super.didUpdateWidget(old);
    if (widget.success && !old.success) {
      setState(() => _success = true);
      _linger();
    }
  }

  void _linger() {
    _timer?.cancel();
    _timer = Timer(CpiButton.successLinger, () {
      if (!mounted) return;
      setState(() => _success = false);
      widget.onSuccessShown?.call();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final CpiColors cpi = context.cpi;
      final FButtonVariant variant = switch (widget.variant) {
        CpiButtonVariant.primary => FButtonVariant.primary,
        CpiButtonVariant.secondary => FButtonVariant.outline,
        CpiButtonVariant.ghost => FButtonVariant.ghost,
        CpiButtonVariant.danger => FButtonVariant.destructive,
      };
      final FButtonStyle rest = context.theme.buttonStyles.resolve(<FVariant>{
        variant,
      }).base;
      final Color restInk =
          rest.contentStyle.textStyle.resolve(const <FVariant>{}).color ??
          Theme.of(context).colorScheme.onSurface;

      final String label = _success
          ? (widget.successLabel ?? 'Enregistré')
          : widget.loading
          ? (widget.loadingLabel ?? 'Enregistrement…')
          : widget.label;

      return Semantics(
        enabled: !widget.loading && widget.onPressed != null,
        // L'état d'un bouton d'envoi est le compte rendu de l'action : il doit
        // être annoncé sans que le doigt ait à retrouver le bouton.
        liveRegion: _success || widget.loading,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kCpiButtonHeight),
          child: FButton(
            variant: variant,
            style: _skin(cpi, rest, restInk),
            onPress: _success || widget.loading
                ? null
                // Le geste engageant vibre ; annuler, revenir ou fermer, non.
                : _feedback(widget.onPressed, switch (widget.variant) {
                    CpiButtonVariant.primary => CpiFeedback.etape,
                    CpiButtonVariant.danger => CpiFeedback.echec,
                    CpiButtonVariant.secondary ||
                    CpiButtonVariant.ghost => null,
                  }),
            mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
            prefix: _success
                ? const Icon(
                    PhosphorIconsFill.checkCircle,
                    size: CpiIconSize.lg,
                  )
                : widget.loading
                ? const FCircularProgress()
                : (widget.icon == null
                      ? null
                      : Icon(widget.icon, size: CpiIconSize.lg)),
            // La rangée de `FButton` ne fléchit pas son libellé : sans
            // `Flexible`, un libellé long déborde au lieu de s'élider.
            child: Flexible(child: _content(label)),
          ),
        ),
      );
    },
  );

  /// La peau de l'état courant. L'envoi et la confirmation posent leur aplat à
  /// TOUTES les variantes tactiles : sans rappel, ForUI rendrait l'aplat éteint
  /// (`onPress` est nul) et le bouton s'effacerait au moment où il compte.
  FButtonStyleDelta _skin(CpiColors cpi, FButtonStyle rest, Color restInk) {
    if (_success) {
      return FButtonStyleDelta.delta(
        decoration: _states<Decoration, DecorationDelta>(
          DecorationDelta.shapeDelta(color: cpi.success),
        ),
        contentStyle: FButtonContentStyleDelta.delta(
          textStyle: _states<TextStyle, TextStyleDelta>(
            TextStyleDelta.delta(color: cpi.onSuccess),
          ),
          iconStyle: _states<IconThemeData, IconThemeDataDelta>(
            IconThemeDataDelta.delta(color: cpi.onSuccess),
          ),
        ),
      );
    }
    if (!widget.loading) return const FButtonStyleDelta.context();
    return FButtonStyleDelta.delta(
      decoration: _states<Decoration, DecorationDelta>(
        DecorationDelta.value(rest.decoration.resolve(const <FVariant>{})),
      ),
      contentStyle: FButtonContentStyleDelta.delta(
        textStyle: _states<TextStyle, TextStyleDelta>(
          TextStyleDelta.delta(color: restInk),
        ),
        // Dans un bouton, la taille de la roue vient du style hérité : le
        // `size:` de `FCircularProgress` n'y est jamais lu.
        circularProgressStyle:
            _states<FCircularProgressStyle, FCircularProgressStyleDelta>(
              FCircularProgressStyleDelta.delta(
                iconStyle: IconThemeDataDelta.delta(
                  color: restInk,
                  size: CpiIconSize.lg,
                ),
              ),
            ),
      ),
    );
  }

  Widget _content(String label) {
    final Widget text = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
    final String? subtitle = widget.subtitle;
    if (subtitle == null || widget.onPressed != null) return text;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        text,
        // Sans couleur : le style hérite de celle du bouton éteint.
        Text(
          subtitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: CpiTypography.minLabelSize,
            fontWeight: FontWeight.w600,
            height: CpiTypography.leadingSnug,
          ),
        ),
      ],
    );
  }
}

/// Le même delta pour toutes les variantes tactiles d'un style ForUI.
FVariantsDelta<FTappableVariantConstraint, FTappableVariant, V, D>
_states<V, D extends Delta>(
  D delta,
) => FVariantsDelta<FTappableVariantConstraint, FTappableVariant, V, D>.delta(
  <FVariantOperation<FTappableVariantConstraint, FTappableVariant, V, D>>[
    FVariantOperation<FTappableVariantConstraint, FTappableVariant, V, D>.all(
      delta,
    ),
  ],
);

/// Carte plate : filet `borderSubtle`, rayon `CpiRadius.lg`, aucune ombre.
///
/// `CpiCard.rows` compose des [CpiRow] dans une seule carte, filets compris.
class CpiCard extends StatelessWidget {
  const CpiCard({
    super.key,
    required Widget this.child,
    this.padding = const EdgeInsets.all(CpiSpacing.md),
    this.onTap,
  }) : rows = null;

  const CpiCard.rows(List<CpiRow> this.rows, {super.key})
    : child = null,
      padding = null,
      onTap = null;

  final Widget? child;
  final List<CpiRow>? rows;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final List<CpiRow>? rows = this.rows;
      if (rows != null) return FTileGroup(children: rows);

      final Widget card = FCard.raw(
        child: ClipRRect(
          borderRadius: CpiRadius.brXxl,
          child: Padding(padding: padding!, child: child),
        ),
      );
      if (onTap == null) return card;
      // Le rebond et la durée d'appui viennent du thème (`cpiForuiTheme`) ;
      // seul l'anneau de focus doit épouser le rayon de la carte.
      return FTappable(
        onPress: _feedback(onTap, CpiFeedback.tap),
        behavior: HitTestBehavior.opaque,
        focusedOutlineStyle: const FFocusedOutlineStyleDelta.delta(
          borderRadius: CpiRadius.brXxl,
        ),
        child: card,
      );
    },
  );
}

/// Ligne de liste : remplace `ListTile`. Seule ou dans un `CpiCard.rows`.
class CpiRow extends StatelessWidget with FTileMixin {
  const CpiRow({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.onLongPress,
    this.danger = false,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Ligne destructrice (supprimer, se déconnecter) : texte et icône en rouge.
  final bool danger;

  @override
  Widget build(BuildContext context) => CpiForui(
    // Le plancher tactile vient du rembourrage de la tuile (voir
    // `cpiForuiTheme`) : sa boîte de rendu ignore les contraintes reçues.
    builder: (BuildContext context) {
      // Le même rappel des deux côtés : un appui du doigt passe par la tuile,
      // un appui de Switch Access par la coquille sémantique. Jamais les deux.
      final VoidCallback? tap = _feedback(onTap, CpiFeedback.tap);
      final VoidCallback? long = _feedback(onLongPress, CpiFeedback.rappel);
      final Widget tile = FTile(
        variant: danger ? FItemVariant.destructive : FItemVariant.primary,
        title: Text(title),
        subtitle: subtitle == null ? null : Text(subtitle!),
        prefix: leading,
        details: trailing,
        suffix: trailing == null && onTap != null
            ? const Icon(PhosphorIconsRegular.caretRight, size: CpiIconSize.lg)
            : null,
        onPress: tap,
        // Sans reconnaisseur d'appui long, un appui maintenu retombe en `onTap`.
        onLongPress: long ?? (tap == null ? null : () {}),
      );
      if (onTap == null && onLongPress == null) return tile;

      // Dans un `FTileGroup`, `FTappableGroup` annule les rappels du
      // `GestureDetector` de la tuile : son nœud reste `isButton` mais n'offre
      // plus `SemanticsAction.tap`. La fusion rend une seule feuille portant le
      // titre, le rôle et l'activation (WCAG 4.1.2).
      return MergeSemantics(
        child: Semantics(
          container: true,
          button: true,
          onTap: tap,
          onLongPress: long,
          child: tile,
        ),
      );
    },
  );
}

/// Champ de saisie. Remplace `TextField`/`TextFormField`.
class CpiField extends StatefulWidget {
  const CpiField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.error,
    this.description,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.inputFormatters,
    this.obscureText = false,
    this.autofocus = false,
    this.enabled = true,
    this.readOnly = false,
    this.maxLines = 1,
    this.maxLength,
    this.prefix,
    this.suffix,
    this.focusNode,
    this.onChanged,
    this.onSubmitted,
    this.onTap,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final String? error;
  final String? description;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter>? inputFormatters;
  final bool obscureText;
  final bool autofocus;
  final bool enabled;
  final bool readOnly;
  final int maxLines;
  final int? maxLength;
  final Widget? prefix;
  final Widget? suffix;
  final FocusNode? focusNode;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onTap;

  @override
  State<CpiField> createState() => _CpiFieldState();
}

class _CpiFieldState extends State<CpiField> {
  // Voir `PhoneField` : en `late … = …`, la valeur est lue au premier
  // `_onChange`, c'est-à-dire APRÈS la frappe, et la première saisie ne
  // remonte jamais à l'écran.
  String? _last;

  @override
  void initState() {
    super.initState();
    _last = widget.controller?.text;
  }

  // ForUI notifie aussi les déplacements du curseur ; seul le texte remonte.
  void _onChange(TextEditingValue value) {
    if (value.text == _last) return;
    _last = value.text;
    widget.onChanged?.call(value.text);
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => FTextField(
      control: FTextFieldControl.managed(
        controller: widget.controller,
        onChange: _onChange,
      ),
      label: Text(widget.label),
      hint: widget.hint,
      description: widget.description == null
          ? null
          : Text(widget.description!),
      error: widget.error == null
          ? null
          : Semantics(liveRegion: true, child: Text(widget.error!)),
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      textCapitalization: widget.textCapitalization,
      inputFormatters: widget.inputFormatters,
      obscureText: widget.obscureText,
      autofocus: widget.autofocus,
      enabled: widget.enabled,
      readOnly: widget.readOnly,
      maxLines: widget.maxLines,
      maxLength: widget.maxLength,
      focusNode: widget.focusNode,
      onSubmit: widget.onSubmitted,
      onTap: widget.onTap,
      prefixBuilder: widget.prefix == null
          ? null
          : (BuildContext _, FTextFieldStyle _, Set<FTextFieldVariant> _) =>
                widget.prefix!,
      suffixBuilder: widget.suffix == null
          ? null
          : (BuildContext _, FTextFieldStyle _, Set<FTextFieldVariant> _) =>
                widget.suffix!,
    ),
  );
}

enum CpiTone { neutral, success, warning, danger }

/// Pastille d'état : statut de synchronisation, qualification, compteur.
class CpiTag extends StatelessWidget {
  const CpiTag(this.text, {super.key, this.tone = CpiTone.neutral});

  final String text;
  final CpiTone tone;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final CpiColors cpi = context.cpi;
      final (Color foreground, Color surface) = switch (tone) {
        CpiTone.neutral => (
          theme.colorScheme.onSurfaceVariant,
          theme.colorScheme.surfaceContainerHigh,
        ),
        CpiTone.success => (cpi.success, cpi.successSurface),
        CpiTone.warning => (cpi.accentText, cpi.warningSurface),
        CpiTone.danger => (
          theme.colorScheme.error,
          theme.colorScheme.errorContainer,
        ),
      };
      // Le ton d'une pastille change sous les yeux (« Envoi… » → « Envoyé ») :
      // sauter d'une couleur à l'autre se lit comme un changement de ligne.
      final CpiMotion motion = CpiMotion.of(context);
      final bool dark = theme.brightness == Brightness.dark;
      return TweenAnimationBuilder<Color?>(
        duration: motion.micro,
        curve: motion.easeOut,
        tween: ColorTween(end: foreground),
        builder: (BuildContext context, Color? ink, Widget? _) =>
            TweenAnimationBuilder<Color?>(
              duration: motion.micro,
              curve: motion.easeOut,
              tween: ColorTween(end: surface),
              builder: (BuildContext context, Color? fond, Widget? _) => FBadge(
                style: FBadgeStyle(
                  decoration: BoxDecoration(
                    color: fond,
                    borderRadius: CpiRadius.brFull,
                    // Sur fond sombre le neutre et la carte se touchent à
                    // 1,2:1 : le filet redonne à la pastille sa limite.
                    border: dark && tone == CpiTone.neutral
                        ? Border.all(color: theme.colorScheme.outline)
                        : null,
                  ),
                  contentStyle: FBadgeContentStyle(
                    labelTextStyle:
                        theme.textTheme.labelSmall?.copyWith(color: ink) ??
                        TextStyle(color: ink ?? foreground),
                    padding: const EdgeInsets.symmetric(
                      horizontal: CpiSpacing.xs,
                      vertical: CpiSpacing.xxs,
                    ),
                  ),
                ),
                child: Text(text),
              ),
            ),
      );
    },
  );
}

/// Intertitre d'une section de liste ou de formulaire.
///
/// Onze écrans posaient leur propre `Text` en `sectionLabel` avec chacun sa
/// marge : les blocs ne s'alignaient pas d'un écran à l'autre.
class CpiSectionHeader extends StatelessWidget {
  const CpiSectionHeader(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(0, CpiSpacing.lg, 0, CpiSpacing.xs),
    child: Semantics(
      header: true,
      child: Text(
        text,
        style: CpiTypography.sectionLabel.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    ),
  );
}

/// Ligne d'une personne dans une liste : état d'envoi à gauche, nom et
/// téléphone au milieu, état en toutes lettres à droite.
///
/// Quatre listes recomposaient cette ligne, chacune avec sa propre grammaire
/// d'état : l'icône seule ici, la pastille seule là.
class CpiPersonRow extends StatelessWidget {
  const CpiPersonRow({
    super.key,
    required this.name,
    required this.status,
    this.phone,
    this.onTap,
  });

  final String name;
  final String? phone;
  final SyncStatus status;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => CpiRow(
    title: name,
    subtitle: phone,
    // L'icône n'est pas étiquetée : la pastille dit déjà l'état, et deux
    // annonces pour un seul signal font une ligne bavarde.
    leading: SyncStatusIcon(status: status, labelled: false),
    trailing: CpiTag(status.label, tone: status.tone),
    onTap: onTap,
  );
}

/// Chiffre de tableau de bord qui défile jusqu'à sa valeur.
///
/// Rien ne défile depuis l'inconnu : tant que la valeur n'est pas chargée le
/// tiret reste, et le premier chiffre s'affiche d'un coup.
class CpiCountUp extends StatelessWidget {
  const CpiCountUp({super.key, required this.value, this.style});

  final int? value;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final CpiMotion motion = CpiMotion.of(context);
    final int? value = this.value;
    if (value == null) {
      return Text('—', style: style, semanticsLabel: 'inconnu');
    }
    if (motion.figure == Duration.zero) return Text('$value', style: style);
    return TweenAnimationBuilder<int>(
      duration: motion.figure,
      curve: motion.easeOut,
      tween: IntTween(end: value),
      builder: (BuildContext context, int courant, Widget? _) => Text(
        '$courant',
        style: style,
        // Le lecteur d'écran annonce le chiffre, pas le défilement.
        semanticsLabel: '$value',
      ),
    );
  }
}

/// Écran en cours de chargement. Même géométrie que [CpiEmptyState] : les deux
/// se succèdent au même endroit, ils ne doivent pas se déplacer entre eux.
class CpiLoadingState extends StatelessWidget {
  const CpiLoadingState({super.key, required this.label});

  /// Ce qu'on attend, en clair. Une roue sans phrase ne dit pas si l'écran
  /// charge ou s'il est cassé.
  final String label;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => Center(
      child: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            FCircularProgress(
              size: FCircularProgressSizeVariant.lg,
              semanticsLabel: label,
            ),
            const SizedBox(height: CpiSpacing.lg),
            Text(
              label,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );
}

/// « Tirer pour rafraîchir » de l'application : couleurs du thème et retour
/// haptique au déclenchement.
///
/// Six écrans montaient leur `RefreshIndicator` nu, sans haptique.
class CpiRefresh extends StatelessWidget {
  const CpiRefresh({super.key, required this.onRefresh, required this.child});

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: () async {
      CpiFeedbackService.instance.tap();
      await onRefresh();
    },
    child: child,
  );
}

/// Bandeau d'état pleine largeur. Se pose dans `CpiScaffold.banner`.
///
/// Trois lignes au plus : un bandeau qui grandit sans fin pousse le corps hors
/// de l'écran au lieu de le coiffer.
class CpiStatusBand extends StatelessWidget {
  const CpiStatusBand({
    super.key,
    required this.text,
    this.tone = CpiTone.neutral,
    this.actionLabel,
    this.onAction,
    this.padded = true,
  });

  final String text;
  final CpiTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Faux quand l'appelant pose déjà la marge : `CpiScaffold.banner` la donne,
  /// et deux marges empilées décalaient la bande du corps qu'elle coiffe.
  final bool padded;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final CpiColors cpi = context.cpi;
      final (Color foreground, Color surface, IconData icon) = switch (tone) {
        CpiTone.neutral => (
          theme.colorScheme.onSurfaceVariant,
          theme.colorScheme.surfaceContainerHigh,
          PhosphorIconsRegular.info,
        ),
        CpiTone.success => (
          cpi.success,
          cpi.successSurface,
          PhosphorIconsRegular.checkCircle,
        ),
        CpiTone.warning => (
          cpi.accentText,
          cpi.warningSurface,
          PhosphorIconsRegular.warning,
        ),
        CpiTone.danger => (
          theme.colorScheme.error,
          theme.colorScheme.errorContainer,
          PhosphorIconsRegular.warningCircle,
        ),
      };
      final String? actionLabel = this.actionLabel;
      // Une bande, pas une alerte : un filet de couleur porte le ton, le
      // texte reste en encre neutre et sur deux lignes au plus. Le neutre
      // (hors ligne, envoi en cours) n'a même pas de fond teinté.
      final bool tinted = tone != CpiTone.neutral;
      return Semantics(
        liveRegion: true,
        child: Padding(
          padding: padded
              ? const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  0,
                  CpiSpacing.md,
                  CpiSpacing.sm,
                )
              : EdgeInsets.zero,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: tinted ? surface : theme.colorScheme.surfaceContainerHigh,
              borderRadius: CpiRadius.brMd,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: CpiSpacing.sm,
                vertical: CpiSpacing.xs,
              ),
              // L'action sous le message, pas à côté : « Envoyer maintenant »
              // à droite d'un texte débordait de 93 px dès 360 dp, et le
              // message y perdait la moitié de sa largeur.
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Icon(icon, size: CpiIconSize.md, color: foreground),
                      const SizedBox(width: CpiSpacing.xs),
                      Expanded(
                        child: Text(
                          text,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: theme.colorScheme.onSurface,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (actionLabel != null && onAction != null)
                    Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: CpiButton(
                        actionLabel,
                        variant: CpiButtonVariant.ghost,
                        expand: false,
                        onPressed: onAction,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}

/// En-tête d'une étape de formulaire : rang, question et jauge d'avancement.
class CpiStepHeader extends StatelessWidget {
  const CpiStepHeader({
    super.key,
    required this.step,
    required this.total,
    required this.question,
    this.forward = true,
  }) : assert(1 <= step && step <= total, 'étape hors des bornes');

  final int step;
  final int total;
  final String question;

  /// Sens du parcours. La question sortante et l'entrante glissent dans ce
  /// sens : revenir en arrière doit se voir comme un retour.
  final bool forward;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) {
      final ThemeData theme = Theme.of(context);
      final CpiMotion motion = CpiMotion.of(context);
      final String rank = 'Étape $step sur $total';
      final double slide = forward ? 0.12 : -0.12;
      return Semantics(
        container: true,
        header: true,
        label: '$rank. $question',
        excludeSemantics: true,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            CpiSpacing.xs,
            CpiSpacing.md,
            CpiSpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              AnimatedSwitcher(
                duration: motion.component,
                switchInCurve: motion.easeOut,
                switchOutCurve: motion.easeOut,
                transitionBuilder: (Widget child, Animation<double> value) =>
                    _SlideFade(slide: slide, animation: value, child: child),
                child: Column(
                  key: ValueKey<int>(step),
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      rank,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(question, style: theme.textTheme.headlineSmall),
                  ],
                ),
              ),
              const SizedBox(height: CpiSpacing.sm),
              // La jauge RAMPE d'une étape à l'autre : c'est le seul endroit de
              // l'app où l'on montre un avancement, il doit se voir avancer.
              TweenAnimationBuilder<double>(
                duration: motion.screen,
                curve: motion.easeOut,
                tween: Tween<double>(end: step / total),
                builder: (BuildContext context, double value, Widget? _) =>
                    FDeterminateProgress(
                      value: value,
                      style: const FDeterminateProgressStyleDelta.delta(
                        constraints: BoxConstraints.tightFor(
                          height: CpiSpacing.xxs,
                        ),
                      ),
                    ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// Fondu et glissement sur l'axe X : la transition d'un contenu qui se remplace
/// sans changer de place.
class _SlideFade extends StatelessWidget {
  const _SlideFade({
    required this.slide,
    required this.animation,
    required this.child,
  });

  final double slide;
  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: animation,
    child: SlideTransition(
      position: animation.drive(
        Tween<Offset>(begin: Offset(slide, 0), end: Offset.zero),
      ),
      child: child,
    ),
  );
}

/// Destination de la navigation du bas.
class CpiNavItem {
  const CpiNavItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    this.badge = 0,
    this.badgeSemanticsLabel,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;

  /// Compteur affiché sur l'icône ; 0 n'affiche rien.
  final int badge;

  final String? badgeSemanticsLabel;

  /// Nom accessible complet : `FBottomNavigationBarItem` masque l'icône aux
  /// lecteurs d'écran (`ExcludeSemantics`), la pastille n'atteint donc jamais
  /// l'assistance si le compteur n'est pas replié dans le libellé (WCAG 1.3.1).
  String get semanticsLabel => badge <= 0
      ? label
      : '$label, ${badgeSemanticsLabel ?? '$badge en attente'}';
}

/// Navigation du bas en pastille flottante.
class CpiBottomNav extends StatelessWidget {
  const CpiBottomNav({
    super.key,
    required this.items,
    required this.index,
    required this.onSelected,
  });

  final List<CpiNavItem> items;
  final int index;
  final ValueChanged<int> onSelected;

  /// Changer d'onglet est un geste de navigation : il claque une fois, que le
  /// doigt ou l'assistance l'ait déclenché.
  void _select(int i) {
    CpiFeedbackService.instance.tap();
    onSelected(i);
  }

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => Padding(
      padding: EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        MediaQuery.viewPaddingOf(context).bottom + CpiSpacing.xs,
      ),
      child: MediaQuery.removeViewPadding(
        context: context,
        removeBottom: true,
        child: FBottomNavigationBar(
          index: index,
          onChange: _select,
          children: <Widget>[
            for (int i = 0; i < items.length; i += 1)
              // `FTappableGroup` annule les rappels du `GestureDetector` de
              // chaque destination : sans cette coquille le nœud n'expose que
              // `focus` et ne peut plus être activé par l'assistance.
              MergeSemantics(
                child: Semantics(
                  container: true,
                  button: true,
                  selected: i == index,
                  label: items[i].semanticsLabel,
                  onTap: () => _select(i),
                  child: FBottomNavigationBarItem(
                    icon: _NavIcon(items[i], active: i == index),
                    // `FittedBox` rapetissait « Notifications » à 7 sp au lieu
                    // de suivre l'échelle du système (WCAG 1.4.4).
                    label: ExcludeSemantics(
                      child: Text(
                        items[i].label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

class _NavIcon extends StatelessWidget {
  const _NavIcon(this.item, {required this.active});

  final CpiNavItem item;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiMotion motion = CpiMotion.of(context);

    // La destination active porte une pastille pleine à la marque : le seul
    // endroit, avec le bouton fantôme, où l'enseigne peint un aplat. Mesuré
    // 1,10 à 1,16:1 avec `primaryContainer` — invisible ; l'aplat plein tient
    // 6,6 à 13,6:1 sur la pastille de nav (WCAG 1.4.11).
    final Widget icon = Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: CpiSpacing.sm,
        vertical: CpiSpacing.xxs,
      ),
      child: Icon(
        active ? item.activeIcon : item.icon,
        color: active ? theme.colorScheme.onPrimary : null,
      ),
    );
    // Même widget dans les deux états : c'est ce qui permet à la pastille de
    // grandir et de se teinter au changement d'onglet plutôt que d'apparaître.
    final Widget marked = AnimatedScale(
      scale: active ? 1 : 0.92,
      duration: motion.micro,
      curve: motion.easeSpring,
      child: AnimatedContainer(
        duration: motion.micro,
        curve: motion.easeOut,
        decoration: BoxDecoration(
          color: active ? theme.colorScheme.primary : Colors.transparent,
          borderRadius: CpiRadius.brFull,
        ),
        child: icon,
      ),
    );

    if (item.badge <= 0) return RepaintBoundary(child: marked);

    // `syncFailed` est calibré pour contraster avec la surface : la surface
    // elle-même est donc le seul texte lisible par-dessus, en clair comme en
    // sombre.
    final Color badgeSurface = context.cpi.syncFailed;
    return RepaintBoundary(
      child: Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          marked,
          Positioned(
            top: -CpiSpacing.xxs,
            right: -CpiSpacing.xxsPlus,
            child: _PopIn(
              motion: motion,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: badgeSurface,
                  borderRadius: CpiRadius.brFull,
                  border: Border.all(color: theme.colorScheme.surface),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: CpiSpacing.xxs,
                  ),
                  child: Text(
                    item.badge > 99 ? '99+' : '${item.badge}',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.surface,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Une pastille qui apparaît en grandissant. Elle n'apparaît qu'à l'arrivée
/// d'une saisie à corriger : c'est ce moment-là qui doit attirer l'œil.
class _PopIn extends StatefulWidget {
  const _PopIn({required this.motion, required this.child});

  final CpiMotion motion;
  final Widget child;

  @override
  State<_PopIn> createState() => _PopInState();
}

class _PopInState extends State<_PopIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.motion.micro,
    value: widget.motion.micro == Duration.zero ? 1 : 0,
  );
  late final CurvedAnimation _curved = CurvedAnimation(
    parent: _controller,
    curve: widget.motion.easeSpring,
  );

  @override
  void initState() {
    super.initState();
    if (widget.motion.micro != Duration.zero) {
      unawaited(_controller.forward());
    }
  }

  @override
  void dispose() {
    _curved.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      ScaleTransition(scale: _curved, child: widget.child);
}

/// Feuille du bas : remplace `showModalBottomSheet` et `showDialog`.
///
/// La feuille vit dans le navigateur racine, au-dessus de la nav du bas ; on la
/// referme avec `Navigator.of(context).pop(valeur)` depuis [builder].
Future<T?> showCpiSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  String? title,
}) {
  final CpiMotion motion = CpiMotion.of(context);
  return showFSheet<T>(
    context: context,
    side: FLayout.btt,
    useRootNavigator: true,
    mainAxisMaxRatio: null,
    style: FModalSheetStyleDelta.delta(
      motion: FModalSheetMotionDelta.delta(
        expandDuration: motion.screen,
        collapseDuration: motion.component,
        curve: motion.easeOut,
      ),
    ),
    builder: (BuildContext context) =>
        _CpiSheet(title: title, builder: builder),
  );
}

class _CpiSheet extends StatelessWidget {
  const _CpiSheet({required this.builder, this.title});

  final WidgetBuilder builder;
  final String? title;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => Material(
      type: MaterialType.transparency,
      child: FCard.raw(
        style: const FCardStyleDelta.delta(
          decoration: DecorationDelta.boxDelta(
            borderRadius: CpiRadius.brXxl,
            boxShadow: <BoxShadow>[],
          ),
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              CpiSpacing.md,
              CpiSpacing.xs,
              CpiSpacing.md,
              CpiSpacing.md + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                const Center(
                  child: SizedBox(
                    width: CpiSpacing.xxxl,
                    child: FDivider(
                      style: FDividerStyleDelta.delta(width: CpiSpacing.xxs),
                    ),
                  ),
                ),
                const SizedBox(height: CpiSpacing.md),
                if (title != null) ...<Widget>[
                  Semantics(
                    header: true,
                    child: Text(
                      title!,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  const SizedBox(height: CpiSpacing.md),
                ],
                Builder(builder: builder),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

/// Confirmation en feuille : remplace les `AlertDialog` à deux boutons.
///
/// Renvoie `null` si l'utilisateur referme la feuille sans choisir.
Future<bool?> cpiConfirm(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirmer',
  String cancelLabel = 'Annuler',
  bool danger = false,
}) => showCpiSheet<bool>(
  context,
  title: title,
  builder: (BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      Text(
        message,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
      const SizedBox(height: CpiSpacing.lg),
      CpiButton(
        confirmLabel,
        variant: danger ? CpiButtonVariant.danger : CpiButtonVariant.primary,
        onPressed: () => Navigator.of(context).pop(true),
      ),
      const SizedBox(height: CpiSpacing.xs),
      CpiButton(
        cancelLabel,
        variant: CpiButtonVariant.ghost,
        onPressed: () => Navigator.of(context).pop(false),
      ),
    ],
  ),
);

/// Durée de lecture d'un message : six secondes au plancher, puis le temps de
/// lire. WCAG 2.2.1 interdit les quatre secondes fixes d'avant.
Duration cpiToastDuration(String message) =>
    Duration(milliseconds: math.max(6000, message.length * 90));

/// Message bref. Remplace `ScaffoldMessenger.showSnackBar`.
///
/// Un `FToaster` est fourni par [CpiScaffold] ; sans lui (écran Material encore
/// à migrer) le message repasse par la `SnackBar` du `ScaffoldMessenger`.
///
/// [persistent] pour un message qui est le SEUL compte rendu d'une erreur : il
/// ne s'efface plus tout seul et porte un bouton « Fermer » (WCAG 2.2.1).
void cpiToast(BuildContext context, String message, {bool persistent = false}) {
  final Duration duration = cpiToastDuration(message);
  if (context.findAncestorWidgetOfExactType<FToaster>() == null) {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(message),
        duration: persistent ? const Duration(days: 1) : duration,
        action: persistent
            ? SnackBarAction(
                label: 'Fermer',
                onPressed: () =>
                    ScaffoldMessenger.of(context).hideCurrentSnackBar(),
              )
            : null,
      ),
    );
    return;
  }
  showFToast(
    context: context,
    alignment: FToastAlignment.topCenter,
    title: Semantics(liveRegion: true, child: Text(message)),
    duration: persistent ? null : duration,
    suffixBuilder: persistent
        ? (BuildContext context, FToasterEntry entry) => Semantics(
            container: true,
            button: true,
            label: 'Fermer',
            onTap: entry.dismiss,
            excludeSemantics: true,
            child: FButton.icon(
              variant: FButtonVariant.ghost,
              onPress: entry.dismiss,
              child: const Icon(PhosphorIconsRegular.x),
            ),
          )
        : null,
  );
}
