/// Pour qui un atelier coud.
///
/// Stocké tel quel dans `ateliers.specialties`, et comparé tel quel par le
/// filtre de recherche (`a.specialties @> ARRAY[$8]`) : la valeur affichée est
/// la valeur enregistrée, sans table de correspondance à maintenir des deux
/// côtés.
///
/// L'assistant de création demandait des matières (Wax, Bazin, Soie…) sous le
/// titre « Vos spécialités », que les propriétaires lisaient comme « pour qui
/// cousez-vous ». La question est posée une seule fois, ici, et depuis le
/// profil — pas à l'inscription.
abstract final class AtelierSpecialties {
  static const all = <String>['Homme', 'Femme', 'Enfant'];
}
