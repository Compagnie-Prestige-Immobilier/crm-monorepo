import 'package:flutter/material.dart';

/// A tailoring category the client can filter by.
class ClientCategory {
  const ClientCategory({
    required this.label,
    required this.icon,
    required this.term,
  });

  /// Shown on the chip.
  final String label;

  final IconData icon;

  /// What is sent to the API as `q`.
  ///
  /// `search_document` on `ateliers` is a generated tsvector over name,
  /// description, address and **specialties**
  /// (`migrations/0004_marketplace_discovery_profiles.sql`), so a plain term
  /// query already filters by specialty. No new endpoint is needed — the
  /// categories simply never passed anything.
  final String term;
}

/// The client space's tailoring taxonomy.
///
/// There used to be two of these and neither worked. The home screen drew six
/// tiles — Sur mesure, Retouches, Cérémonie, Tenue homme, Tenue femme,
/// Broderie — that **all shared one callback and applied no filter at all**, so
/// every tile went to the same unfiltered search. The search screen then
/// offered six *different* suggestions — Robe, Boubou, Bazin, Retouche,
/// Broderie, Cérémonie — so the vocabulary the user learned on one screen did
/// not exist on the next.
///
/// One list, defined once, used by both, and each entry actually queries.
class ClientCategories {
  ClientCategories._();

  static const List<ClientCategory> all = [
    ClientCategory(
      label: 'Sur mesure',
      icon: Icons.straighten_rounded,
      term: 'sur mesure',
    ),
    ClientCategory(
      label: 'Retouche',
      icon: Icons.content_cut_rounded,
      term: 'retouche',
    ),
    ClientCategory(
      label: 'Cérémonie',
      icon: Icons.celebration_rounded,
      term: 'cérémonie',
    ),
    ClientCategory(
      label: 'Boubou',
      icon: Icons.checkroom_rounded,
      term: 'boubou',
    ),
    ClientCategory(label: 'Bazin', icon: Icons.layers_rounded, term: 'bazin'),
    ClientCategory(label: 'Robe', icon: Icons.woman_rounded, term: 'robe'),
    ClientCategory(
      label: 'Broderie',
      icon: Icons.auto_awesome_rounded,
      term: 'broderie',
    ),
    ClientCategory(
      label: 'Tenue homme',
      icon: Icons.man_rounded,
      term: 'tenue homme',
    ),
  ];

  /// Matches a free-text query back to a category, so the search screen can
  /// show which chip is active after arriving from the home rail.
  static ClientCategory? forTerm(String? term) {
    if (term == null) return null;
    final normalised = term.trim().toLowerCase();
    if (normalised.isEmpty) return null;
    for (final category in all) {
      if (category.term == normalised) return category;
    }
    return null;
  }
}
