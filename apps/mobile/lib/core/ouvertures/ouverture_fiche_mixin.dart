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

  /// Bat la seconde. La durée ne se stocke pas : elle se lit entre la première
  /// saisie et maintenant.
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
    // Après un plantage, la fiche se rouvre avec sa borne : le chronomètre
    // repart de la première saisie, jamais de zéro.
    _suivreLeTemps();
    return resultat;
  }

  /// EB-09 : le chronomètre part de la PREMIÈRE SAISIE, une lettre tapée ou une
  /// case cochée. Lire la fiche, la faire défiler ou tourner une étape ne sont
  /// pas du traitement.
  ///
  /// La borne se pose une seule fois, tenue par la base et non par l'écran :
  /// rappelée à chaque frappe, elle ferait reculer le départ sans fin.
  Future<void> premiereSaisie(Map<String, Object?> draft) async {
    final OuverturesFicheData? prise = ouverture;
    if (prise == null || prise.firstInputAt != null) return;
    final OuverturesFicheData? posee = await ref
        .read(ouvertureRepositoryProvider)
        .marquerLaPremiereSaisie(id: prise.id, draft: draft);
    if (!mounted || posee?.firstInputAt == null) return;
    setState(() => ouverture = posee);
    _suivreLeTemps();
  }

  void _suivreLeTemps() {
    _battement?.cancel();
    _battement = null;
    final Duration? passe = tempsDeTraitement;
    if (passe == null) return;
    ecoule.value = passe;
    _battement = Timer.periodic(const Duration(seconds: 1), (Timer _) {
      if (mounted) ecoule.value = tempsDeTraitement ?? Duration.zero;
    });
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

  /// Le temps écoulé depuis la première saisie. Nul tant que la fiche n'a été
  /// que lue : un chronomètre qui n'a pas démarré n'affiche pas zéro.
  Duration? get tempsDeTraitement {
    final DateTime? depart = ouverture?.firstInputAt;
    if (depart == null) return null;
    final Duration passe = ref.read(clockProvider).now().difference(depart);
    return passe.isNegative ? Duration.zero : passe;
  }

  /// EB-09 : le temps passé SUR LA FICHE, visible jusqu'à la qualification.
  /// Distinct de la durée de communication du journal d'appels.
  Widget? chronometre(ThemeData theme) {
    if (ouverture?.firstInputAt == null) return null;
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
      label: 'Temps sur la fiche : ${passe.inMinutes} minutes',
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
