import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../data/local/database.dart';
import '../../data/repositories/ouverture_repository.dart';
import '../../ui/widgets/cpi_kit.dart';
import '../providers/app_providers.dart';
import '../theme/cpi_tokens.dart';

/// EB-07 à EB-09 : la fiche prise en main, le verrou qu'elle pose et le temps
/// qu'elle dure.
///
/// Deux écrans qualifient une fiche, celui du représentant et celui du
/// prospect. Ils posent la même confirmation, tiennent le même verrou et
/// comptent le même temps ; ce qu'ils font d'une fiche déjà tenue, en revanche,
/// leur appartient : l'un a une fiche à rouvrir par sa route, l'autre part d'un
/// numéro.
mixin OuvertureFicheMixin<T extends ConsumerStatefulWidget>
    on ConsumerState<T> {
  /// La fiche prise en main. Non nulle : le verrou tient, et l'écran refuse de
  /// se fermer tant qu'aucun statut n'est posé.
  OuverturesFicheData? ouverture;

  /// Bat la seconde. La durée ne se stocke pas : elle se lit entre l'ouverture
  /// et maintenant.
  Timer? _battement;

  /// Le temps affiché, hors `setState` : un rebâti par seconde marquerait le
  /// brouillon sale sans qu'une seule réponse ait changé.
  final ValueNotifier<Duration> ecoule = ValueNotifier<Duration>(Duration.zero);

  bool get sousVerrou => ouverture != null;

  @override
  void dispose() {
    _battement?.cancel();
    ecoule.dispose();
    super.dispose();
  }

  /// Le compte connecté. Nul : la session n'est pas lisible, et rien ne
  /// s'ouvre ni ne se verrouille au nom de personne.
  String? get compteConnecte {
    final String? moi = ref.read(authControllerProvider).userId;
    return moi == null || moi.isEmpty ? null : moi;
  }

  /// La fiche que ce compte tient déjà sur CET appareil. Le verrou se lit
  /// d'abord ici : hors ligne, le serveur ne répond pas et la fiche en cours
  /// doit quand même se rouvrir.
  Future<OuverturesFicheData?> ficheEnCours() async {
    final String? moi = compteConnecte;
    if (moi == null) return null;
    return ref.read(ouvertureRepositoryProvider).courante(moi);
  }

  /// EB-07 : la boîte nomme la personne, sans quoi elle ne dit pas ce qu'elle
  /// ouvre.
  Future<bool> confirmerLOuverture(String nom) async {
    final bool? ouvrir = await cpiConfirm(
      context,
      title: 'Ouvrir la fiche de $nom ?',
      message: 'Vous ne pourrez pas la quitter sans la qualifier.',
      confirmLabel: 'Ouvrir',
    );
    return ouvrir == true;
  }

  /// Enregistre l'ouverture confirmée, pose le verrou et lance le chronomètre.
  /// [OuvertureResultat.tenue] non nulle : le compte tient une AUTRE fiche, et
  /// rien n'a été ouvert.
  Future<OuvertureResultat> ouvrirLaFiche({
    String? representantId,
    String? prospectId,
  }) async {
    final String? moi = compteConnecte;
    if (moi == null) return (ouverte: null, tenue: null);
    final OuvertureResultat resultat = await ref
        .read(ouvertureRepositoryProvider)
        .ouvrir(
          openedById: moi,
          representantId: representantId,
          prospectId: prospectId,
        );
    if (!mounted || resultat.ouverte == null) return resultat;
    setState(() => ouverture = resultat.ouverte);
    ecoule.value = tempsDeTraitement ?? Duration.zero;
    _battement?.cancel();
    _battement = Timer.periodic(const Duration(seconds: 1), (Timer _) {
      if (mounted) ecoule.value = tempsDeTraitement ?? Duration.zero;
    });
    return resultat;
  }

  /// La qualification lève le verrou : elle a déjà fermé l'ouverture en base.
  void libererLeVerrou() {
    _battement?.cancel();
    _battement = null;
    ouverture = null;
  }

  /// Le brouillon remonté au serveur, au passage d'étape et non à la frappe :
  /// une remontée par lettre saisie noierait le lien. Au mieux : c'est la copie
  /// locale qui rouvre le formulaire, celle-ci sert la reprise ailleurs.
  Future<void> remonterLeBrouillon(Map<String, Object?> draft) async {
    final OuverturesFicheData? prise = ouverture;
    if (prise == null) return;
    await ref
        .read(ouvertureRepositoryProvider)
        .enregistrerBrouillon(id: prise.id, draft: draft);
  }

  /// Le temps écoulé depuis l'ouverture confirmée. Nul tant qu'aucune fiche
  /// n'est prise en main.
  Duration? get tempsDeTraitement {
    final OuverturesFicheData? prise = ouverture;
    if (prise == null) return null;
    final Duration passe = ref
        .read(clockProvider)
        .now()
        .difference(prise.openedAt);
    return passe.isNegative ? Duration.zero : passe;
  }

  /// EB-09 : le temps de traitement, visible jusqu'à la qualification.
  /// Distinct de la durée de communication du journal d'appels.
  Widget? chronometre(ThemeData theme) {
    if (ouverture == null) return null;
    return ValueListenableBuilder<Duration>(
      valueListenable: ecoule,
      builder: (BuildContext context, Duration passe, Widget? _) =>
          _bandeau(theme, passe),
    );
  }

  Widget _bandeau(ThemeData theme, Duration passe) => Padding(
    padding: const EdgeInsets.fromLTRB(
      CpiSpacing.md,
      CpiSpacing.xs,
      CpiSpacing.md,
      0,
    ),
    child: Semantics(
      liveRegion: true,
      label: 'Fiche ouverte depuis ${passe.inMinutes} minutes',
      excludeSemantics: true,
      child: Row(
        children: <Widget>[
          Icon(
            PhosphorIconsRegular.timer,
            size: CpiSpacing.md,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: CpiSpacing.xs),
          Text(
            chrono(passe),
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    ),
  );
}

String chrono(Duration duree) {
  final String mm = duree.inMinutes.remainder(60).toString().padLeft(2, '0');
  final String ss = duree.inSeconds.remainder(60).toString().padLeft(2, '0');
  if (duree.inHours == 0) return '$mm:$ss';
  return '${duree.inHours}:$mm:$ss';
}
