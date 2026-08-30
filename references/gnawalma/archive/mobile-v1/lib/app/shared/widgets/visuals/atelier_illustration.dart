import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../theme/app_colors_extensions.dart';

/// Which motif an [AtelierIllustration] draws.
enum AtelierMotif {
  /// A person arriving. Used where the product introduces itself — onboarding,
  /// the space selector, sign-in.
  thread,

  /// Garments being tried on. Used for empty collections of work — orders,
  /// projects, the articles attached to an order.
  garment,

  /// Stacked parcels. Used for empty stock.
  cloth,

  /// A profile being filled in. Used for an empty client book.
  client,

  /// A magnifier sweeping a field of pins. Used when a search returns nothing.
  search,

  /// A receipt. Used when no payment has been recorded yet.
  payment,

  /// Blank sheets. The generic "nothing here yet" and failure fallback.
  nodata,
}

/// An illustration from the unDraw library, renormalised onto this app's palette.
///
/// unDraw ships one systematic palette, which is what makes it safe to adopt:
/// every asset was rewritten once, at import time, so that
///
///  * its stock indigo became the app's accent blue,
///  * its dark inks became `currentColor`, which [SvgTheme] resolves per theme,
///    so the art inverts in dark mode instead of disappearing into the page,
///  * its uniformly pale skin tones became warm brown — these screens are used
///    by Senegalese tailors and their clients, and the stock art did not
///    reflect them,
///  * its many near-whites collapsed to a single mid neutral that holds on
///    paper and on ink.
///
/// The alternative, Storyset, requires an attribution link on its free tier;
/// unDraw's licence asks for none and permits modification, which the recolour
/// above depends on. Sources are recorded in `assets/illustrations/SOURCES.json`.
class AtelierIllustration extends StatelessWidget {
  const AtelierIllustration({
    super.key,
    this.motif = AtelierMotif.thread,
    this.height = 180,
    this.semanticLabel,
  });

  final AtelierMotif motif;
  final double height;
  final String? semanticLabel;

  static const Map<AtelierMotif, String> _assets = {
    AtelierMotif.thread: 'welcome',
    AtelierMotif.garment: 'garment',
    AtelierMotif.cloth: 'cloth',
    AtelierMotif.client: 'client',
    AtelierMotif.search: 'search',
    AtelierMotif.payment: 'payment',
    AtelierMotif.nodata: 'nodata',
  };

  @override
  Widget build(BuildContext context) {
    final art = SizedBox(
      height: height,
      width: double.infinity,
      child: SvgPicture.asset(
        'assets/illustrations/${_assets[motif]}.svg',
        fit: BoxFit.contain,
        // Every ink shape in the asset is `currentColor`, so this one value is
        // what makes the art legible in both themes.
        theme: SvgTheme(currentColor: context.textPrimaryColor),
      ),
    );

    if (semanticLabel == null) return ExcludeSemantics(child: art);
    return Semantics(label: semanticLabel, image: true, child: art);
  }
}
