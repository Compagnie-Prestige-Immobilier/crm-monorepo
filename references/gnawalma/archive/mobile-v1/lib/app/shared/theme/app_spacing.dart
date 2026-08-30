/// Application spacing constants
///
/// Provides consistent spacing values throughout the application
/// Based on an 8-point grid system
class AppSpacing {
  AppSpacing._(); // Private constructor to prevent instantiation

  // ===== Basic Spacing (8-point grid) =====

  /// Extra extra small spacing - 4.0
  static const double xxs = 4.0;

  /// Extra small spacing - 8.0
  static const double xs = 8.0;

  /// Small spacing - 12.0
  static const double sm = 12.0;

  /// Medium spacing - 16.0 (default)
  static const double md = 16.0;

  /// Large spacing - 24.0
  static const double lg = 24.0;

  /// Extra large spacing - 32.0
  static const double xl = 32.0;

  /// Extra extra large spacing - 48.0
  static const double xxl = 48.0;

  // ===== Specific Use Cases =====

  /// Horizontal page gutter.
  ///
  /// 20 per `knowledge-base/DESIGN.md`. This was 22 — deliberately off the
  /// 4/8 grid — which meant every screen's content column sat at a width no
  /// other token could align to, so nested paddings never resolved cleanly.
  /// 16 is the Material default and reads as "content pushed to the edge";
  /// 24 starts to feel like a tablet layout on a 360dp phone.
  static const double gutter = 20.0;

  /// Horizontal page gutter on narrow devices (≤ 360 dp).
  static const double gutterCompact = 16.0;

  /// Page padding (horizontal and vertical)
  static const double pagePadding = gutter;

  /// Padding inside a card or a tappable surface.
  ///
  /// Raised from 16: the single most common reason a mobile layout reads as
  /// cheap is content sitting too close to the edge of its own container.
  static const double cardPadding = 20.0;

  /// Gap between two unrelated groups on the same screen.
  ///
  /// The rule this encodes: generous *between* groups, tight *within* them.
  /// Uniform spacing everywhere is what makes a screen read as an undifferentiated
  /// list — the reader has no cue about what belongs with what.
  static const double sectionSpacing = 32.0;

  /// List item spacing
  static const double listItemSpacing = sm;

  /// Button padding (horizontal)
  static const double buttonPaddingHorizontal = lg;

  /// Button padding (vertical)
  static const double buttonPaddingVertical = sm;

  /// Form field spacing
  static const double formFieldSpacing = md;

  /// Distance a focused field keeps from the bottom of the viewport.
  ///
  /// Sized to clear the keyboard *plus* a sticky action bar — the common case
  /// in this app's forms. Flutter's default (20) only clears the keyboard, so
  /// the focused field lands underneath the CTA bar.
  static const double keyboardScrollPadding = 160.0;

  /// Divider spacing (top and bottom)
  static const double dividerSpacing = md;

  /// Horizontal inset of a settings-row divider.
  ///
  /// Derived from [AppActionTile]'s own geometry: 6pt row inset + a 22pt glyph
  /// + the 16pt gap before the label. Keeping it here stops the two drifting
  /// apart when either side is retuned.
  static const double listRowInset = 6.0;
  static const double listDividerIndent = listRowInset + 22 + md;

  // ===== Border Radius =====
  //
  // Four values, no more — `knowledge-base/DESIGN.md`. This list previously
  // held eleven, which is why the same role rendered at 18 on one screen and
  // 20 on the next: there was always another constant close enough to reach
  // for. The legacy names below are kept as aliases so existing call sites
  // keep compiling, but they all resolve to one of the four.

  /// Fields, buttons, chips, segments — anything the user acts on directly.
  static const double radiusControl = 12.0;

  /// Cards, panels, image wells — anything that *holds* content.
  static const double radiusContainer = 16.0;

  /// Modal bottom sheets.
  static const double radiusSheetTop = 24.0;

  /// Avatars and pills.
  static const double radiusCircle = 999.0;

  // --- Legacy aliases. Prefer the four canonical names above. ---

  /// Deprecated alias for [radiusControl].
  static const double radiusXS = radiusControl;

  /// Deprecated alias for [radiusControl].
  static const double radiusSM = radiusControl;

  /// Deprecated alias for [radiusControl].
  static const double radiusMD = radiusControl;

  /// Deprecated alias for [radiusContainer].
  static const double radiusLG = radiusContainer;

  /// Deprecated alias for [radiusSheetTop].
  static const double radiusXL = radiusSheetTop;

  /// Deprecated alias for [radiusCircle].
  static const double radiusCircular = radiusCircle;

  /// Deprecated alias for [radiusCircle].
  static const double pillRadius = radiusCircle;

  /// Deprecated alias for [radiusContainer].
  static const double radiusCard = radiusContainer;

  /// Deprecated alias for [radiusSheetTop].
  static const double radiusSheet = radiusSheetTop;

  /// Deprecated alias for [radiusContainer].
  static const double cardRadius = radiusContainer;

  /// Deprecated alias for [radiusControl].
  ///
  /// Was 18 — a value that existed only here, so a button never matched the
  /// field above it or the card behind it.
  static const double buttonRadius = radiusControl;

  // ===== Icon Sizes =====

  /// Small icon - 16.0
  static const double iconSM = 16.0;

  /// Medium icon - 24.0 (default)
  static const double iconMD = 24.0;

  /// Large icon - 32.0
  static const double iconLG = 32.0;

  /// Extra large icon - 48.0
  static const double iconXL = 48.0;

  // ===== Elevation/Shadow =====

  /// No elevation
  static const double elevation0 = 0.0;

  /// Low elevation
  static const double elevation1 = 1.0;

  /// Medium elevation
  static const double elevation2 = 2.0;

  /// High elevation
  static const double elevation4 = 4.0;

  /// Extra high elevation
  static const double elevation8 = 8.0;

  // ===== Dimensions =====

  /// App bar height
  static const double appBarHeight = 56.0;

  /// Bottom navigation bar height
  static const double bottomNavHeight = 56.0;

  /// Floating action button size
  static const double fabSize = 56.0;

  /// Avatar size - small
  static const double avatarSM = 32.0;

  /// Avatar size - medium
  static const double avatarMD = 48.0;

  /// Avatar size - large
  static const double avatarLG = 64.0;

  /// Avatar size - extra large
  static const double avatarXL = 96.0;

  /// Thumbnail size - small
  static const double thumbnailSM = 48.0;

  /// Thumbnail size - medium
  static const double thumbnailMD = 80.0;

  /// Thumbnail size - large
  static const double thumbnailLG = 120.0;

  // ===== Input Heights =====

  /// Text field height
  static const double textFieldHeight = 48.0;

  /// Button height - small
  static const double buttonHeightSM = 36.0;

  /// Button height - medium
  static const double buttonHeightMD = 48.0;

  /// Button height - large
  static const double buttonHeightLG = 56.0;

  // ===== Card Dimensions =====

  /// Stat card height
  static const double statCardHeight = 100.0;

  /// Project card height
  static const double projectCardHeight = 200.0;

  /// Client card height
  static const double clientCardHeight = 80.0;
}
