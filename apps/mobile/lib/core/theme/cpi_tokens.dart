import 'package:flutter/material.dart';

import 'cpi_colors.dart';

abstract final class CpiSpacing {
  static const double xxs = 4;

  /// Comble le saut de 4 à 8 : cinq widgets écrivaient `xxs + 2`.
  static const double xxsPlus = 6;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 40;
  static const double huge = 48;
  static const double giant = 64;
  static const double colossal = 80;
}

abstract final class CpiIconSize {
  static const double xxs = 12;
  static const double xs = 16;
  static const double sm = 18;
  static const double md = 20;
  static const double lg = 22;
  static const double xl = 26;
  static const double xxl = 28;
  static const double xxxl = 36;
  static const double display = 56;
  static const double hero = 88;
}

abstract final class CpiRadius {
  static const double xs = 6;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double full = 9999;

  static const BorderRadius brXs = BorderRadius.all(Radius.circular(xs));
  static const BorderRadius brSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius brMd = BorderRadius.all(Radius.circular(md));
  static const BorderRadius brLg = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius brXl = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius brXxl = BorderRadius.all(Radius.circular(xxl));
  static const BorderRadius brFull = BorderRadius.all(Radius.circular(full));
}

abstract final class CpiElevation {
  static const Color _tint = Color(0xFF1C0810);

  static const List<BoxShadow> xs = <BoxShadow>[
    BoxShadow(color: Color(0x0A1C0810), offset: Offset(0, 1), blurRadius: 2),
  ];

  static const List<BoxShadow> sm = <BoxShadow>[
    BoxShadow(color: Color(0x0D1C0810), offset: Offset(0, 1), blurRadius: 3),
    BoxShadow(color: Color(0x0A1C0810), offset: Offset(0, 1), blurRadius: 2),
  ];

  static const List<BoxShadow> md = <BoxShadow>[
    BoxShadow(color: Color(0x0F1C0810), offset: Offset(0, 4), blurRadius: 12),
    BoxShadow(color: Color(0x0A1C0810), offset: Offset(0, 2), blurRadius: 6),
  ];

  static const List<BoxShadow> lg = <BoxShadow>[
    BoxShadow(color: Color(0x141C0810), offset: Offset(0, 8), blurRadius: 24),
    BoxShadow(color: Color(0x0D1C0810), offset: Offset(0, 4), blurRadius: 12),
  ];

  static const List<BoxShadow> xl = <BoxShadow>[
    BoxShadow(color: Color(0x1A1C0810), offset: Offset(0, 16), blurRadius: 48),
    BoxShadow(color: Color(0x0F1C0810), offset: Offset(0, 8), blurRadius: 24),
  ];

  static Color get shadowTint => _tint;
}

abstract final class CpiStateOpacity {
  static const double hover = 0.08;
  static const double focus = 0.10;
  static const double pressed = 0.12;
  static const double selected = 0.12;
  static const double dragged = 0.16;
  static const double disabledContent = 0.38;
  static const double disabledContainer = 0.12;
}

/// Plancher de cible tactile. 48 dp est le minimum Android (Material 3, WCAG
/// 2.5.8 AAA) ; 44 laissait `SyncBadge` et `NotificationBell` coder 48 à côté.
const double kCpiMinTouchTarget = 48;

/// Piste de progression posée sur un aplat de marque : le blanc translucide
/// doit rester à 3:1 du fond ET de l'indicateur blanc (WCAG 1.4.11).
Color cpiTrackOn(Color brand) =>
    Color.alphaBlend(const Color(0x73FFFFFF), brand);

/// Dégradé plein écran d'un aplat de marque : la même teinte éclaircie puis
/// assombrie, pour qu'une autre coque n'hérite pas du bordeaux CPI.
List<Color> cpiBrandGradient(Color brand) {
  final HSLColor base = HSLColor.fromColor(brand);
  return <Color>[
    base.withLightness((base.lightness + 0.06).clamp(0.0, 1.0)).toColor(),
    brand,
    base.withLightness((base.lightness - 0.05).clamp(0.0, 1.0)).toColor(),
  ];
}

@immutable
class CpiMotion extends ThemeExtension<CpiMotion> {
  const CpiMotion({
    required this.micro,
    required this.component,
    required this.screen,
    required this.easeOut,
    required this.easeSpring,
  });

  static const CpiMotion standard = CpiMotion(
    micro: Duration(milliseconds: 150),
    component: Duration(milliseconds: 220),
    screen: Duration(milliseconds: 300),
    easeOut: Cubic(0.22, 1, 0.36, 1),
    easeSpring: Cubic(0.34, 1.56, 0.64, 1),
  );

  static const CpiMotion none = CpiMotion(
    micro: Duration.zero,
    component: Duration.zero,
    screen: Duration.zero,
    easeOut: Cubic(0.22, 1, 0.36, 1),
    easeSpring: Cubic(0.34, 1.56, 0.64, 1),
  );

  final Duration micro;

  final Duration component;

  final Duration screen;

  final Curve easeOut;

  final Curve easeSpring;

  static CpiMotion of(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return none;
    return Theme.of(context).extension<CpiMotion>() ?? standard;
  }

  @override
  CpiMotion copyWith({
    Duration? micro,
    Duration? component,
    Duration? screen,
    Curve? easeOut,
    Curve? easeSpring,
  }) {
    return CpiMotion(
      micro: micro ?? this.micro,
      component: component ?? this.component,
      screen: screen ?? this.screen,
      easeOut: easeOut ?? this.easeOut,
      easeSpring: easeSpring ?? this.easeSpring,
    );
  }

  @override
  CpiMotion lerp(covariant CpiMotion? other, double t) =>
      t < 0.5 ? this : (other ?? this);
}

extension CpiSyncPalette on CpiColors {
  Color colorForSyncStatus(String status) => switch (status) {
    'draft' => syncDraft,
    'pending' => syncPending,
    'syncing' => syncSyncing,
    'synced' => syncSynced,
    'conflict' => syncConflict,
    'failed' => syncFailed,
    'blocked' => syncBlocked,
    _ => syncDraft,
  };
}
