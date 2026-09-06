import 'package:crm_api_client/crm_api_client.dart';

/// Le formulaire de conversion tel que l'administration l'a réglé : ordre,
/// champs masqués, champs exigés et champs ajoutés.
///
/// Miroir de `reglesChamps` du panel. Le serveur, lui, n'exige rien de tout
/// cela : ces règles sont une aide de saisie, pas une frontière de confiance.
class ReglesConversion {
  ReglesConversion({required this.champs, required this.libres})
    : _parChamp = <String, ReglageChampDto>{
        for (final ReglageChampDto regle in champs) regle.champ: regle,
      };

  factory ReglesConversion.de(ReglagesConversionDto dto) =>
      ReglesConversion(champs: dto.champs, libres: dto.libres);

  /// Ce que rend un téléphone qui n'a pas encore lu les réglages : le
  /// formulaire retombe alors sur ses champs d'usine.
  static final ReglesConversion aucune = ReglesConversion(
    champs: const <ReglageChampDto>[],
    libres: const <ChampLibreDto>[],
  );

  final List<ReglageChampDto> champs;
  final List<ChampLibreDto> libres;

  final Map<String, ReglageChampDto> _parChamp;

  bool visible(String champ, {bool defaut = true}) =>
      _parChamp[champ]?.visible ?? defaut;

  /// Un champ masqué n'est jamais exigé : le reproche porterait sur une
  /// question que l'écran ne pose plus.
  bool requis(String champ, {required bool defaut}) {
    final ReglageChampDto? regle = _parChamp[champ];
    if (regle == null) return defaut;
    return regle.visible && regle.obligatoire;
  }

  /// Les champs d'une étape, dans l'ordre voulu par l'administration. Ceux
  /// qu'aucun réglage ne nomme suivent, dans l'ordre du code.
  List<String> ordonner(List<String> etape) {
    final List<String> ranges = <String>[
      for (final ReglageChampDto regle in champs)
        if (etape.contains(regle.champ)) regle.champ,
    ];
    return <String>[
      ...ranges,
      for (final String champ in etape)
        if (!ranges.contains(champ)) champ,
    ];
  }

  /// Les valeurs proposées par un champ ajouté : une liste, ou le couple
  /// oui / non.
  static List<String> valeursProposees(ChampLibreDto champ) =>
      champ.type == ChampLibreDtoTypeEnum.OUI_NON
      ? const <String>['Oui', 'Non']
      : champ.options;
}
