import 'package:flutter/material.dart';

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
    required this.inputBorder,
    required this.switchTrack,
    required this.borderSubtle,
    required this.cardBorder,
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
    inputBackground: Color(0xFFF3F1F2),
    // Neutre chaud, pas une teinte de marque : un contour de champ rose lisait
    // comme une erreur. Tient 3:1 sur le fond, la carte et le remplissage.
    inputBorder: Color(0xFF7E7679),
    switchTrack: Color(0xFFC4A0AA),
    borderSubtle: Color(0x1F630210),
    cardBorder: Color(0xFFECE1E2),
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

  /// CPI en mode sombre. Les neutres suivent le registre sobre de la migration
  /// (fond #141013, carte #211D20, filet #2E292C) ; seule la teinte bordeaux
  /// éclaircie porte l'identité, sinon les deux coques deviendraient le même
  /// gris sur noir.
  static const CpiColors dark = CpiColors(
    success: Color(0xFF5FBF8F),
    onSuccess: Color(0xFF0E2117),
    successSurface: Color(0xFF132A20),
    warning: Color(0xFFE8C069),
    onWarning: Color(0xFF231A05),
    warningSurface: Color(0xFF2E2512),
    info: Color(0xFFE39BB4),
    onInfo: Color(0xFF2A0F18),
    infoSurface: Color(0xFF2E1A21),
    accent: Color(0xFFC8921A),
    accentForeground: Color(0xFF1A1206),
    accentText: Color(0xFFE8C069),
    accentBorder: Color(0xFFD9A93E),
    accentOnDark: Color(0xFFF0CC7E),
    accentSurface: Color(0xFF332913),
    destructiveOnDark: Color(0xFFFFB3A8),
    navSurface: Color(0xFF1B171A),
    navForeground: Color(0xFFB0A6A9),
    navActive: Color(0xFF38262B),
    navActiveForeground: Color(0xFFF7D3D8),
    navBorder: Color(0x14FFFFFF),
    navRing: Color(0xFFE3919A),
    inputBackground: Color(0xFF1E1A1D),
    inputBorder: Color(0xFF7C7074),
    switchTrack: Color(0xFF7A6B70),
    borderSubtle: Color(0x1FF2C4CB),
    cardBorder: Color(0xFF423C40),
    chart1: Color(0xFFE3919A),
    chart2: Color(0xFFE8C069),
    chart3: Color(0xFF5FBF8F),
    chart4: Color(0xFFC97BA0),
    chart5: Color(0xFFA78BFA),
    syncDraft: Color(0xFFB0A6A9),
    syncPending: Color(0xFFB0A6A9),
    syncSyncing: Color(0xFFE39BB4),
    syncSynced: Color(0xFF5FBF8F),
    syncConflict: Color(0xFFE8C069),
    syncFailed: Color(0xFFFF8D7E),
    syncBlocked: Color(0xFFB0A6A9),
  );

  /// Identité de l'Union des Enseignants du Sénégal : noir massif, filet bleu.
  /// Le bleu est celui du logo (#0201E9, teinte dominante mesurée) ; les
  /// surfaces restent le gris froid neutre, elles ne prennent pas la teinte.
  ///
  /// La série 1 porte la marque ; les séries 2 à 5 sont le jeu catégoriel
  /// commun aux deux coques. Les décliner en bleus (l'ancien #1D4ED8 à 18° et
  /// 1,4:1 du bleu du logo) rendait deux courbes indiscernables.
  static const CpiColors chues = CpiColors(
    success: Color(0xFF1A6B44),
    onSuccess: Color(0xFFFFFFFF),
    successSurface: Color(0xFFE8F0EC),
    warning: Color(0xFF856011),
    onWarning: Color(0xFFFFFFFF),
    warningSurface: Color(0xFFFAF4E8),
    info: Color(0xFF0201E9),
    onInfo: Color(0xFFFFFFFF),
    infoSurface: Color(0xFFE6E6FF),
    accent: Color(0xFF0201CB),
    accentForeground: Color(0xFFFFFFFF),
    accentText: Color(0xFF0201CB),
    accentBorder: Color(0xFF0201E9),
    accentOnDark: Color(0xFFB3B3FF),
    accentSurface: Color(0xFFE6E6FF),
    destructiveOnDark: Color(0xFFFCA5A5),
    navSurface: Color(0xFF0B0D12),
    navForeground: Color(0xFFCDCDE4),
    navActive: Color(0xFF08087D),
    navActiveForeground: Color(0xFFFFFFFF),
    navBorder: Color(0x14FFFFFF),
    navRing: Color(0xFF6C6BFF),
    inputBackground: Color(0xFFF1F2F5),
    inputBorder: Color(0xFF78789B),
    switchTrack: Color(0xFF9F9FBC),
    borderSubtle: Color(0x1F0201E9),
    cardBorder: Color(0xFFDDE2EC),
    chart1: Color(0xFF0201E9),
    chart2: Color(0xFFC8921A),
    chart3: Color(0xFF1A6B44),
    chart4: Color(0xFFB05070),
    chart5: Color(0xFF8B5CF6),
    syncDraft: Color(0xFF44506A),
    syncPending: Color(0xFF44506A),
    syncSyncing: Color(0xFF0201E9),
    syncSynced: Color(0xFF1A6B44),
    syncConflict: Color(0xFF856011),
    syncFailed: Color(0xFFB91C1C),
    syncBlocked: Color(0xFF44506A),
  );

  /// CHUES en mode sombre : mêmes neutres sobres que [dark], à un cran froid,
  /// et le bleu du logo éclairci en accent.
  static const CpiColors chuesDark = CpiColors(
    success: Color(0xFF5FBF8F),
    onSuccess: Color(0xFF0E2117),
    successSurface: Color(0xFF132A20),
    warning: Color(0xFFE8C069),
    onWarning: Color(0xFF231A05),
    warningSurface: Color(0xFF2E2512),
    info: Color(0xFFA5A4FF),
    onInfo: Color(0xFF0A0940),
    infoSurface: Color(0xFF1E1E4A),
    accent: Color(0xFF3231E0),
    accentForeground: Color(0xFFFFFFFF),
    accentText: Color(0xFFA5A4FF),
    accentBorder: Color(0xFF6C6BFF),
    accentOnDark: Color(0xFFC4C4FF),
    accentSurface: Color(0xFF1E1E4A),
    destructiveOnDark: Color(0xFFFFC0B6),
    navSurface: Color(0xFF171A21),
    navForeground: Color(0xFFA6ACBA),
    navActive: Color(0xFF262560),
    navActiveForeground: Color(0xFFCFCEFF),
    navBorder: Color(0x14FFFFFF),
    navRing: Color(0xFF8B8AFF),
    inputBackground: Color(0xFF1A1D24),
    inputBorder: Color(0xFF7A7A93),
    switchTrack: Color(0xFF6E6E88),
    borderSubtle: Color(0x1F9A99FF),
    cardBorder: Color(0xFF3E4351),
    chart1: Color(0xFF9A99FF),
    chart2: Color(0xFFE8C069),
    chart3: Color(0xFF5FBF8F),
    chart4: Color(0xFFC97BA0),
    chart5: Color(0xFFA78BFA),
    syncDraft: Color(0xFFA6ACBA),
    syncPending: Color(0xFFA6ACBA),
    syncSyncing: Color(0xFFA5A4FF),
    syncSynced: Color(0xFF5FBF8F),
    syncConflict: Color(0xFFE8C069),
    syncFailed: Color(0xFFFF8D7E),
    syncBlocked: Color(0xFFA6ACBA),
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

  final Color accent;

  final Color accentForeground;

  final Color accentText;
  final Color accentBorder;

  final Color accentOnDark;
  final Color accentSurface;

  final Color destructiveOnDark;

  final Color navSurface;
  final Color navForeground;
  final Color navActive;
  final Color navActiveForeground;
  final Color navBorder;
  final Color navRing;

  final Color inputBackground;

  /// CONTOUR d'un champ ou d'une case, distinct de [borderSubtle] qui n'est que
  /// décoratif : WCAG 1.4.11 impose 3:1 contre le fond ET contre le remplissage.
  final Color inputBorder;
  final Color switchTrack;
  final Color borderSubtle;

  /// Filet d'une carte, d'une pastille de nav ou d'un calque flottant. En
  /// sombre l'ombre ne se voit pas : ce filet EST la limite de la surface, et
  /// `outlineVariant` la laissait à 1,2:1 de la carte.
  final Color cardBorder;

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

  List<Color> get chartSeries => <Color>[
    chart1,
    chart2,
    chart3,
    chart4,
    chart5,
  ];

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
    Color? inputBorder,
    Color? switchTrack,
    Color? borderSubtle,
    Color? cardBorder,
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
      inputBorder: inputBorder ?? this.inputBorder,
      switchTrack: switchTrack ?? this.switchTrack,
      borderSubtle: borderSubtle ?? this.borderSubtle,
      cardBorder: cardBorder ?? this.cardBorder,
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
      inputBorder: l(inputBorder, other.inputBorder),
      switchTrack: l(switchTrack, other.switchTrack),
      borderSubtle: l(borderSubtle, other.borderSubtle),
      cardBorder: l(cardBorder, other.cardBorder),
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

extension CpiColorsX on BuildContext {
  CpiColors get cpi => Theme.of(this).extension<CpiColors>() ?? CpiColors.light;
}
