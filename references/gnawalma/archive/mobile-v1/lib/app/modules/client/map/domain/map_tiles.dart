import 'package:flutter/material.dart';

/// Le fond de carte, et pourquoi celui-ci.
///
/// OpenStreetMap via CARTO Basemaps, pas Google Maps : pas de clé d'API, pas de
/// facturation, pas de SDK propriétaire — le dépôt reste utilisable tel quel.
///
/// Le style « Positron » (et son pendant sombre « Dark Matter ») est un fond
/// désaturé, sans routes criardes ni icônes de commerces. C'est ce qu'il faut
/// ici : la carte n'est pas le sujet, les ateliers le sont. Sur un fond
/// standard OSM, des pastilles d'atelier disparaissent au milieu des étiquettes
/// jaunes et vertes ; sur un fond gris très clair, elles sont la seule chose
/// colorée de l'écran. Cela prolonge aussi le blanc/encre du reste de
/// l'application au lieu d'y coller un rectangle venu d'ailleurs.
///
/// L'attribution est obligatoire — © OpenStreetMap pour les données, © CARTO
/// pour le rendu — et n'est donc jamais masquée.
abstract final class MapTiles {
  static const _light =
      'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  static const _dark =
      'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  /// Le fond suit le thème : une carte blanche dans une application en thème
  /// sombre éblouit, et c'est l'écran que l'on ouvre dehors, le soir.
  static String urlFor(Brightness brightness) =>
      brightness == Brightness.dark ? _dark : _light;

  /// Exigé par les licences ODbL (données) et CARTO (rendu).
  static const attribution = '© OpenStreetMap · © CARTO';

  /// Sous-domaines CARTO, pour répartir le chargement des tuiles.
  static const subdomains = ['a', 'b', 'c', 'd'];

  /// Requis par la politique d'usage de CARTO : identifier l'application.
  static const userAgentPackageName = 'com.lic.gnawalma';
}

/// Estimation du temps de trajet (§2.1).
///
/// Calculée depuis la distance à vol d'oiseau, faute de service de routage —
/// en ajouter un signifierait une clé d'API et une facturation, ce que ce
/// projet évite. Le détour réel en ville est d'environ 30 % et la vitesse
/// moyenne dans Dakar tourne autour de 20 km/h aux heures ouvrables.
///
/// Le résultat est donc annoncé comme une estimation partout où il s'affiche :
/// une durée présentée comme exacte serait fausse, et un client qui organise
/// son déplacement dessus se retrouverait en retard.
abstract final class TravelEstimate {
  static const _detourFactor = 1.3;
  static const _cityKmPerHour = 20.0;

  /// Durée estimée, ou `null` quand la distance est inconnue.
  static Duration? forDistance(int? straightLineMeters) {
    if (straightLineMeters == null || straightLineMeters < 0) return null;
    final km = (straightLineMeters / 1000) * _detourFactor;
    final minutes = (km / _cityKmPerHour * 60).round();
    return Duration(minutes: minutes.clamp(1, 24 * 60));
  }

  /// « ≈ 12 min » / « ≈ 1 h 20 ». Le signe dit que c'est une estimation.
  static String? label(int? straightLineMeters) {
    final duration = forDistance(straightLineMeters);
    if (duration == null) return null;
    final minutes = duration.inMinutes;
    if (minutes < 60) return '≈ $minutes min';
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    return rest == 0 ? '≈ $hours h' : '≈ $hours h $rest';
  }
}
