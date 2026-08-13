import 'package:flutter/material.dart';

/// Rôles de couleur que Material 3 ne définit pas.
///
/// Material 3 n'a ni `success`, ni `warning`, ni `info`, ni le moindre rôle
/// pour l'or CPI. Ils vivent ici, dans une [ThemeExtension], et non dans des
/// constantes globales : une constante globale n'est ni surchargeable dans un
/// test, ni lisible via `Theme.of(context)`, et finit toujours par être
/// dupliquée à la main dans un widget.
///
/// Règle non négociable (docs/design.md §2.3) : `#C8921A` fait 2,77:1 sur
/// blanc. Il échoue AA texte *et* le seuil grand texte. Il n'est exposé ici que
/// comme [accent] — une **surface décorative**. Pour du texte ou une icône or,
/// c'est [accentText] (`#856011`, 5,71:1) et rien d'autre.
@immutable
class CpiColors extends ThemeExtension<CpiColors> {
  const CpiColors({
    required this.success,
    required this.onSuccess,
    required this.successSurface,
    required this.warning,
    required this.onWarning,
    required this.warningSurface,
    required this.info,
    required this.onInfo,
    required this.infoSurface,
    required this.accent,
    required this.accentForeground,
    required this.accentText,
    required this.accentBorder,
    required this.accentOnDark,
    required this.accentSurface,
    required this.destructiveOnDark,
    required this.navSurface,
    required this.navForeground,
    required this.navActive,
    required this.navActiveForeground,
    required this.navBorder,
    required this.navRing,
    required this.inputBackground,
    required this.switchTrack,
    required this.borderSubtle,
    required this.chart1,
    required this.chart2,
    required this.chart3,
    required this.chart4,
    required this.chart5,
    required this.syncDraft,
    required this.syncPending,
    required this.syncSyncing,
    required this.syncSynced,
    required this.syncConflict,
    required this.syncFailed,
    required this.syncBlocked,
  });

  /// Palette claire auditée. Seule palette du mobile : l'app est verrouillée en
  /// clair (docs/design.md §3), elle sert en extérieur au soleil.
  static const CpiColors light = CpiColors(
    success: Color(0xFF1A6B44),
    onSuccess: Color(0xFFFFFFFF),
    successSurface: Color(0xFFE8F0EC),
    warning: Color(0xFF856011),
    onWarning: Color(0xFFFFFFFF),
    warningSurface: Color(0xFFFAF4E8),
    info: Color(0xFFA34462),
    onInfo: Color(0xFFFFFFFF),
    infoSurface: Color(0xFFF7EEF1),
    accent: Color(0xFFC8921A),
    accentForeground: Color(0xFF1C0810),
    accentText: Color(0xFF856011),
    accentBorder: Color(0xFFA87A15),
    accentOnDark: Color(0xFFFFC65A),
    accentSurface: Color(0xFFFAF4E8),
    destructiveOnDark: Color(0xFFF87171),
    navSurface: Color(0xFF3A010A),
    navForeground: Color(0xFFDFC0C8),
    navActive: Color(0xFF4A0110),
    navActiveForeground: Color(0xFFFFFFFF),
    navBorder: Color(0x14FFFFFF),
    navRing: Color(0xFFB05070),
    inputBackground: Color(0xFFF5ECEE),
    switchTrack: Color(0xFFC4A0AA),
    borderSubtle: Color(0x1F630210),
    chart1: Color(0xFF630210),
    chart2: Color(0xFFC8921A),
    chart3: Color(0xFF1A6B44),
    chart4: Color(0xFFB05070),
    chart5: Color(0xFF8B5CF6),
    syncDraft: Color(0xFF6B4A52),
    syncPending: Color(0xFF6B4A52),
    syncSyncing: Color(0xFFA34462),
    syncSynced: Color(0xFF1A6B44),
    syncConflict: Color(0xFF856011),
    syncFailed: Color(0xFFB91C1C),
    syncBlocked: Color(0xFF6B4A52),
  );

  final Color success;
  final Color onSuccess;
  final Color successSurface;

  final Color warning;
  final Color onWarning;
  final Color warningSurface;

  final Color info;
  final Color onInfo;
  final Color infoSurface;

  /// Or CPI. **Surface décorative uniquement.** Jamais de texte dessus sans
  /// passer par [accentForeground], jamais de texte *en* cette couleur.
  final Color accent;

  /// Texte posé sur une surface [accent] — 6,95:1.
  final Color accentForeground;

  /// Seule déclinaison d'or autorisée pour du texte et des icônes — 5,71:1.
  final Color accentText;
  final Color accentBorder;

  /// Or lisible sur bordeaux — 8,71:1 sur `primary`.
  final Color accentOnDark;
  final Color accentSurface;

  /// Rouge d'erreur lisible SUR BORDEAUX — 4,91:1 sur `primary`.
  ///
  /// `destructive` (#B91C1C) ne fait que **2,10:1** sur `#630210` : il échoue
  /// AA texte *et* le seuil 3:1 des éléments non textuels. Or l'écran de
  /// connexion est bordeaux plein, et ses messages de validation s'y posaient
  /// directement — ils étaient illisibles. C'est la déclinaison `destructive`
  /// du mode sombre de docs/design.md §3, réutilisée ici pour la même raison
  /// qu'elle existe là-bas : le rouge foncé ne passe pas sur fond foncé.
  final Color destructiveOnDark;

  final Color navSurface;
  final Color navForeground;
  final Color navActive;
  final Color navActiveForeground;
  final Color navBorder;
  final Color navRing;

  final Color inputBackground;
  final Color switchTrack;
  final Color borderSubtle;

  final Color chart1;
  final Color chart2;
  final Color chart3;
  final Color chart4;
  final Color chart5;

  final Color syncDraft;
  final Color syncPending;
  final Color syncSyncing;
  final Color syncSynced;
  final Color syncConflict;
  final Color syncFailed;
  final Color syncBlocked;

  /// Les 5 couleurs de série, dans l'ordre. Au-delà de 5 séries on regroupe en
  /// « Autres » (docs/design.md §2.6) — on ne rallonge pas la liste.
  List<Color> get chartSeries => <Color>[chart1, chart2, chart3, chart4, chart5];

  @override
  CpiColors copyWith({
    Color? success,
    Color? onSuccess,
    Color? successSurface,
    Color? warning,
    Color? onWarning,
    Color? warningSurface,
    Color? info,
    Color? onInfo,
    Color? infoSurface,
    Color? accent,
    Color? accentForeground,
    Color? accentText,
    Color? accentBorder,
    Color? accentOnDark,
    Color? accentSurface,
    Color? destructiveOnDark,
    Color? navSurface,
    Color? navForeground,
    Color? navActive,
    Color? navActiveForeground,
    Color? navBorder,
    Color? navRing,
    Color? inputBackground,
    Color? switchTrack,
    Color? borderSubtle,
    Color? chart1,
    Color? chart2,
    Color? chart3,
    Color? chart4,
    Color? chart5,
    Color? syncDraft,
    Color? syncPending,
    Color? syncSyncing,
    Color? syncSynced,
    Color? syncConflict,
    Color? syncFailed,
    Color? syncBlocked,
  }) {
    return CpiColors(
      success: success ?? this.success,
      onSuccess: onSuccess ?? this.onSuccess,
      successSurface: successSurface ?? this.successSurface,
      warning: warning ?? this.warning,
      onWarning: onWarning ?? this.onWarning,
      warningSurface: warningSurface ?? this.warningSurface,
      info: info ?? this.info,
      onInfo: onInfo ?? this.onInfo,
      infoSurface: infoSurface ?? this.infoSurface,
      accent: accent ?? this.accent,
      accentForeground: accentForeground ?? this.accentForeground,
      accentText: accentText ?? this.accentText,
      accentBorder: accentBorder ?? this.accentBorder,
      accentOnDark: accentOnDark ?? this.accentOnDark,
      accentSurface: accentSurface ?? this.accentSurface,
      destructiveOnDark: destructiveOnDark ?? this.destructiveOnDark,
      navSurface: navSurface ?? this.navSurface,
      navForeground: navForeground ?? this.navForeground,
      navActive: navActive ?? this.navActive,
      navActiveForeground: navActiveForeground ?? this.navActiveForeground,
      navBorder: navBorder ?? this.navBorder,
      navRing: navRing ?? this.navRing,
      inputBackground: inputBackground ?? this.inputBackground,
      switchTrack: switchTrack ?? this.switchTrack,
      borderSubtle: borderSubtle ?? this.borderSubtle,
      chart1: chart1 ?? this.chart1,
      chart2: chart2 ?? this.chart2,
      chart3: chart3 ?? this.chart3,
      chart4: chart4 ?? this.chart4,
      chart5: chart5 ?? this.chart5,
      syncDraft: syncDraft ?? this.syncDraft,
      syncPending: syncPending ?? this.syncPending,
      syncSyncing: syncSyncing ?? this.syncSyncing,
      syncSynced: syncSynced ?? this.syncSynced,
      syncConflict: syncConflict ?? this.syncConflict,
      syncFailed: syncFailed ?? this.syncFailed,
      syncBlocked: syncBlocked ?? this.syncBlocked,
    );
  }

  @override
  CpiColors lerp(covariant CpiColors? other, double t) {
    if (other == null) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return CpiColors(
      success: l(success, other.success),
      onSuccess: l(onSuccess, other.onSuccess),
      successSurface: l(successSurface, other.successSurface),
      warning: l(warning, other.warning),
      onWarning: l(onWarning, other.onWarning),
      warningSurface: l(warningSurface, other.warningSurface),
      info: l(info, other.info),
      onInfo: l(onInfo, other.onInfo),
      infoSurface: l(infoSurface, other.infoSurface),
      accent: l(accent, other.accent),
      accentForeground: l(accentForeground, other.accentForeground),
      accentText: l(accentText, other.accentText),
      accentBorder: l(accentBorder, other.accentBorder),
      accentOnDark: l(accentOnDark, other.accentOnDark),
      accentSurface: l(accentSurface, other.accentSurface),
      destructiveOnDark: l(destructiveOnDark, other.destructiveOnDark),
      navSurface: l(navSurface, other.navSurface),
      navForeground: l(navForeground, other.navForeground),
      navActive: l(navActive, other.navActive),
      navActiveForeground: l(navActiveForeground, other.navActiveForeground),
      navBorder: l(navBorder, other.navBorder),
      navRing: l(navRing, other.navRing),
      inputBackground: l(inputBackground, other.inputBackground),
      switchTrack: l(switchTrack, other.switchTrack),
      borderSubtle: l(borderSubtle, other.borderSubtle),
      chart1: l(chart1, other.chart1),
      chart2: l(chart2, other.chart2),
      chart3: l(chart3, other.chart3),
      chart4: l(chart4, other.chart4),
      chart5: l(chart5, other.chart5),
      syncDraft: l(syncDraft, other.syncDraft),
      syncPending: l(syncPending, other.syncPending),
      syncSyncing: l(syncSyncing, other.syncSyncing),
      syncSynced: l(syncSynced, other.syncSynced),
      syncConflict: l(syncConflict, other.syncConflict),
      syncFailed: l(syncFailed, other.syncFailed),
      syncBlocked: l(syncBlocked, other.syncBlocked),
    );
  }
}

/// Accès court aux rôles CPI depuis un `BuildContext`.
extension CpiColorsX on BuildContext {
  CpiColors get cpi => Theme.of(this).extension<CpiColors>() ?? CpiColors.light;
}
