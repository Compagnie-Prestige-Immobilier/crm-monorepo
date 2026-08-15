import 'dart:ui' show AppExitResponse;

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../data/repositories/draft_repository.dart';
import 'draft_debouncer.dart';

/// Colle le cycle de vie Android à [DraftDebouncer].
///
/// **On vide sur `inactive`, pas sur `paused`.**
///
/// `inactive` est émis *avant* `paused` : à l'apparition du sélecteur d'app, à
/// l'arrivée d'un appel, au verrouillage de l'écran. `paused` arrive ensuite :
/// et sur plusieurs ROM constructeurs (Transsion et Xiaomi en tête, c'est-à-dire
/// l'essentiel du parc sénégalais visé) le processus peut être tué avant que le
/// callback `paused` n'ait eu le temps de rendre la main à Dart. Écrire à
/// `paused`, c'est écrire trop tard, une fois sur dix, sans jamais savoir
/// laquelle.
///
/// On écrit donc à `inactive`, quitte à écrire pour rien quand l'utilisateur
/// revient aussitôt : une écriture SQLite de 2 ko sans raison est infiniment
/// moins grave qu'un formulaire perdu.
///
/// `AppLifecycleListener` plutôt que `implements WidgetsBindingObserver` :
/// l'interface compte une quinzaine de méthodes dont aucune ne nous concerne, et
/// Flutter en ajoute à chaque version : chaque ajout casserait la compilation de
/// tous les écrans de saisie pour rien.
mixin DraftFormMixin<T extends StatefulWidget> on State<T> {
  DraftDebouncer? _debouncer;
  AppLifecycleListener? _lifecycle;

  /// Identifiant du brouillon de cet écran. Il voyage aussi dans l'URL
  /// (`?draft=<id>`), ce qui découple la restauration de navigation de la
  /// restauration des données.
  String get draftId;

  /// Clé de formulaire (`representant.create`, `prospect.create`, …).
  String get draftFormKey;

  /// L'état courant du formulaire, tel qu'il sera réécrit au retour.
  Map<String, Object?> collectDraftValues();

  /// Étape courante d'un formulaire à plusieurs écrans.
  int get draftStep => 0;

  String? get draftEntityId => null;
  String? get draftParentId => null;

  DraftRepository get draftRepository;

  /// Vrai quand le formulaire est vide : on ne crée pas un brouillon pour un
  /// écran qu'on a seulement ouvert puis refermé.
  bool get draftIsEmpty => false;

  /// URL à substituer pour que l'adresse porte `?draft=<id>`, ou `null` quand
  /// elle le porte déjà (ou que l'écran ne participe pas).
  ///
  /// **Sans cette substitution, la restauration de brouillon ne peut pas
  /// marcher.** `draftId` vaut `widget.draftId ?? Ids.newId()` : un écran ouvert
  /// depuis un bouton : « Nouveau représentant », « Ajouter un prospect » : tire
  /// un identifiant neuf et l'garde en mémoire seulement. La mémoire de route
  /// enregistre alors `/representants/nouveau` **sans référence**, et au
  /// redémarrage l'écran se reconstruit, tire un *deuxième* identifiant neuf, et
  /// lit un brouillon qui n'a jamais été écrit sous cette clé.
  ///
  /// Le formulaire revenait donc vide après une éjection mémoire, alors que le
  /// brouillon était bien en base : la donnée était sauvée, mais plus personne
  /// ne savait sous quel nom la chercher. On publie l'identifiant dans l'URL dès
  /// le premier cadre, pour que la mémoire de route le capture.
  String? draftRouteWithId() => null;

  @override
  void initState() {
    super.initState();
    _debouncer = DraftDebouncer(onFlush: _persist);
    // Après le premier cadre : `initState` est trop tôt pour toucher au
    // routeur, et `replace` plutôt que `go` pour ne pas empiler une entrée
    // d'historique que le bouton retour devrait ensuite traverser.
    WidgetsBinding.instance.addPostFrameCallback((Duration _) {
      republishDraftRoute();
    });
    _lifecycle = AppLifecycleListener(
      // `inactive` : la dernière notification garantie avant une éjection.
      onInactive: () => _debouncer?.flush(),
      // `pause` et `detach` sont redondants avec `inactive` dans le cas nominal,
      // et ne coûtent rien quand il n'y a plus rien à écrire (le debouncer sort
      // immédiatement s'il n'est pas sale). On les garde comme filet.
      onPause: () => _debouncer?.flush(),
      onDetach: () => _debouncer?.flush(),
      onExitRequested: () async {
        await _debouncer?.flush();
        return AppExitResponse.exit;
      },
    );
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    _lifecycle = null;
    // `dispose()` du debouncer vide d'abord : quitter l'écran par le bouton
    // retour ne doit pas perdre les 400 dernières millisecondes de frappe.
    _debouncer?.dispose();
    _debouncer = null;
    super.dispose();
  }

  /// (Re)publie `?draft=<id>` dans l'adresse.
  ///
  /// Appelée au premier cadre, et **de nouveau après l'adoption d'un brouillon
  /// retrouvé sous un autre identifiant** : sans ce second appel, l'URL
  /// continuerait de désigner l'identifiant neuf qui vient d'être abandonné, et
  /// un redémarrage rouvrirait le formulaire vide alors que la saisie est là.
  ///
  /// `maybeOf` et non `of` : l'écran doit rester montable dans un test de widget
  /// sans routeur, et une exception ici tuerait le premier cadre du formulaire.
  void republishDraftRoute() {
    if (!mounted) return;
    final String? target = draftRouteWithId();
    if (target == null) return;
    GoRouter.maybeOf(context)?.replace(target);
  }

  /// À appeler à chaque changement de champ.
  void markDraftDirty() => _debouncer?.touch();

  /// À appeler sur perte de focus d'un champ et sur changement d'étape.
  Future<void> flushDraft() async => _debouncer?.flush();

  /// À appeler après un enregistrement réussi : la transaction d'écriture a déjà
  /// supprimé le brouillon, le réécrire le ferait réapparaître.
  void discardDraft() => _debouncer?.discard();

  /// ═══ CE QUI FAIT TENIR L'ÉCRITURE DÉCLENCHÉE PAR `dispose()` ═══
  ///
  /// `dispose()` vide le debouncer, qui appelle ceci, qui est asynchrone : le
  /// `await` rend la main **après** que l'écran a été démonté. Ce qui sauve la
  /// saisie tient à trois faits, et à aucune garantie explicite :
  ///
  /// * tout ce qui lit l'état du widget est évalué **avant** le premier
  ///   `await` : le test `mounted`, `collectDraftValues()`, `draftEntityId`,
  ///   `draftParentId`, et le `ref.read` du dépôt. Au moment de cette
  ///   évaluation, `super.dispose()` n'a pas encore été appelé : c'est la
  ///   dernière ligne de `dispose()`, et le vidage est la troisième ;
  /// * lire la `value` d'un `TextEditingController` déjà disposé ne lève pas :
  ///   `ValueNotifier` n'a pas d'assertion de disposition sur son accesseur ;
  /// * l'écriture elle-même ne touche plus au widget : c'est du drift pur.
  ///
  /// **Ne jamais insérer de `await` avant la collecte.** Et si une version de
  /// Flutter ajoute un jour cette assertion à `ValueNotifier.value`, ce chemin
  /// devient une perte silencieuse de brouillon à chaque appui sur « retour » :
  /// la parade serait de collecter les valeurs dans `dispose()` et de les
  /// passer ici, pas de rattraper l'exception.
  Future<void> _persist() async {
    if (!mounted || draftIsEmpty) return;
    await draftRepository.save(
      draftId: draftId,
      formKey: draftFormKey,
      values: collectDraftValues(),
      step: draftStep,
      entityId: draftEntityId,
      parentId: draftParentId,
    );
  }
}
