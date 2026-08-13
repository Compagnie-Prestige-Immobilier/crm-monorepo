import 'package:flutter/material.dart';

import 'cpi_colors.dart';

/// Grille 4 pt (docs/design.md §5). Une valeur d'espacement qui n'est pas dans
/// cette liste est un bug de mise en page, pas une nuance.
abstract final class CpiSpacing {
  static const double xxs = 4;
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

/// Rayons (docs/design.md §5).
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

/// Élévations : ombres teintées prune `rgba(28,8,16,·)`, jamais du noir pur.
///
/// Sur mobile bas de gamme on ne dépasse **pas** [sm] à l'intérieur d'une liste
/// défilante : chaque ombre coûte une passe de rendu par élément.
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

/// Opacités d'état Material 3 (docs/design.md §6).
abstract final class CpiStateOpacity {
  static const double hover = 0.08;
  static const double focus = 0.10;
  static const double pressed = 0.12;
  static const double selected = 0.12;
  static const double dragged = 0.16;
  static const double disabledContent = 0.38;
  static const double disabledContainer = 0.12;
}

/// Cible tactile minimale (docs/design.md §1). Le plancher, jamais la cible :
/// un contrôle qui porte une décision se dimensionne bien au-delà.
const double kCpiMinTouchTarget = 44;

/// Tokens de mouvement (docs/design.md §7).
///
/// Exposés en [ThemeExtension] pour que [CpiMotion.of] puisse les ramener à zéro
/// quand `MediaQuery.disableAnimations` est actif, sans qu'aucun appelant n'ait
/// à connaître la règle.
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

  /// 150 ms — micro-retours (coche de sync, pression de bouton).
  final Duration micro;

  /// 220 ms — transitions de composant (ouverture de champ, snackbar).
  final Duration component;

  /// 300 ms — transitions d'écran.
  final Duration screen;

  /// `cubic-bezier(0.22, 1, 0.36, 1)` — entrées et sorties.
  final Curve easeOut;

  /// `cubic-bezier(0.34, 1.56, 0.64, 1)` — confirmations (rebond léger).
  final Curve easeSpring;

  /// Les durées tombent à zéro si l'utilisateur a désactivé les animations ;
  /// la logique, elle, ne change pas.
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

/// Rendu d'un statut de synchronisation : icône + couleur + libellé.
///
/// Les icônes de sync sont les seules qui portent du sens métier
/// (docs/design.md §8) ; elles sont donc figées ici, pas choisies par écran.
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
