import 'package:flutter/material.dart';
import 'package:simple_icons/simple_icons.dart';

/// Le réseau d'un couturier, avec sa vraie marque.
///
/// Les glyphes de `package:simple_icons` sont les marques officielles publiées
/// par Simple Icons (CC0), avec leurs couleurs officielles — pas une
/// approximation redessinée. Un pictogramme Material ne porte aucune de ces
/// marques : une note de musique pour TikTok ou un appareil photo pour
/// Instagram obligent à lire l'étiquette pour savoir où mène le bouton, alors
/// que la marque se reconnaît d'un coup d'œil, ce que §3.1 demande justement.
enum SocialNetwork {
  tiktok('TikTok', SimpleIcons.tiktok, SimpleIconColors.tiktok),
  instagram('Instagram', SimpleIcons.instagram, SimpleIconColors.instagram),
  facebook('Facebook', SimpleIcons.facebook, SimpleIconColors.facebook);

  const SocialNetwork(this.label, this.icon, this.brandColor);

  final String label;
  final IconData icon;

  /// Couleur officielle de la marque.
  ///
  /// Le reste de l'application réserve la couleur au statut ; ici elle porte de
  /// l'information — c'est ce qui rend le réseau identifiable sans le lire.
  final Color brandColor;

  static SocialNetwork? fromLabel(String label) {
    for (final network in SocialNetwork.values) {
      if (network.label == label) return network;
    }
    return null;
  }
}

class SocialIcon extends StatelessWidget {
  const SocialIcon({
    super.key,
    required this.network,
    this.size = 20,
    this.color,
  });

  final SocialNetwork network;
  final double size;

  /// Force une couleur — utilisée là où l'icône doit se fondre avec les autres
  /// champs plutôt que crier sa marque.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Icon(
      network.icon,
      size: size,
      color: color ?? network.brandColor,
      semanticLabel: network.label,
    );
  }
}
