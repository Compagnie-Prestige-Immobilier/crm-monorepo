/// The fourteen regions of Senegal, with the coordinates of their capital.
///
/// The marketplace is a distance search: `GET /marketplace/ateliers` filters on
/// `location IS NOT NULL` and orders by `ST_Distance`. An atelier created
/// without coordinates is excluded from every result, permanently and silently,
/// so a region always carries a point even when the owner types no address.
///
/// A picked region rather than a GPS fix: the app asks for a value the owner
/// already knows, not a runtime permission that is refused often. The precise
/// street is typed beside it and stays optional.
class AtelierRegion {
  const AtelierRegion({
    required this.id,
    required this.label,
    required this.latitude,
    required this.longitude,
  });

  final String id;
  final String label;
  final double latitude;
  final double longitude;
}

abstract final class AtelierRegions {
  /// Dakar first — it is where the demand is — then alphabetical.
  static const all = <AtelierRegion>[
    AtelierRegion(
      id: 'dakar',
      label: 'Dakar',
      latitude: 14.6928,
      longitude: -17.4467,
    ),
    AtelierRegion(
      id: 'diourbel',
      label: 'Diourbel',
      latitude: 14.6522,
      longitude: -16.2314,
    ),
    AtelierRegion(
      id: 'fatick',
      label: 'Fatick',
      latitude: 14.3390,
      longitude: -16.4110,
    ),
    AtelierRegion(
      id: 'kaffrine',
      label: 'Kaffrine',
      latitude: 14.1059,
      longitude: -15.5508,
    ),
    AtelierRegion(
      id: 'kaolack',
      label: 'Kaolack',
      latitude: 14.1520,
      longitude: -16.0730,
    ),
    AtelierRegion(
      id: 'kedougou',
      label: 'Kédougou',
      latitude: 12.5556,
      longitude: -12.1747,
    ),
    AtelierRegion(
      id: 'kolda',
      label: 'Kolda',
      latitude: 12.8939,
      longitude: -14.9410,
    ),
    AtelierRegion(
      id: 'louga',
      label: 'Louga',
      latitude: 15.6144,
      longitude: -16.2264,
    ),
    AtelierRegion(
      id: 'matam',
      label: 'Matam',
      latitude: 15.6559,
      longitude: -13.2554,
    ),
    AtelierRegion(
      id: 'saint-louis',
      label: 'Saint-Louis',
      latitude: 16.0180,
      longitude: -16.4890,
    ),
    AtelierRegion(
      id: 'sedhiou',
      label: 'Sédhiou',
      latitude: 12.7081,
      longitude: -15.5569,
    ),
    AtelierRegion(
      id: 'tambacounda',
      label: 'Tambacounda',
      latitude: 13.7707,
      longitude: -13.6673,
    ),
    AtelierRegion(
      id: 'thies',
      label: 'Thiès',
      latitude: 14.7910,
      longitude: -16.9260,
    ),
    AtelierRegion(
      id: 'ziguinchor',
      label: 'Ziguinchor',
      latitude: 12.5680,
      longitude: -16.2730,
    ),
  ];

  static AtelierRegion? byId(String? id) {
    if (id == null) return null;
    for (final region in all) {
      if (region.id == id) return region;
    }
    return null;
  }

  /// Maps a stored `ateliers.address_text` or region name back to a region.
  static AtelierRegion? byLabel(String? label) {
    if (label == null) return null;
    final needle = label.trim().toLowerCase();
    if (needle.isEmpty) return null;
    for (final region in all) {
      if (region.label.toLowerCase() == needle) return region;
    }
    return null;
  }
}
