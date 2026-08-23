import 'dart:async';

import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/ids.dart';
import '../../../data/repositories/draft_repository.dart';
import '../../auth/auth_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../visites_repository.dart';

/// `null` : le choix a été abandonné. `_Choix(null)` : l'entrée a été retirée.
class _Choix {
  const _Choix(this.item);

  final VisiteReferentielDto? item;
}

class VisiteFormScreen extends ConsumerStatefulWidget {
  const VisiteFormScreen({super.key, this.draftId});

  final String? draftId;

  @override
  ConsumerState<VisiteFormScreen> createState() => _VisiteFormScreenState();
}

class _VisiteFormScreenState extends ConsumerState<VisiteFormScreen>
    with DraftFormMixin<VisiteFormScreen> {
  final TextEditingController _nom = TextEditingController();
  final TextEditingController _telephone = TextEditingController();
  final TextEditingController _commentaire = TextEditingController();
  final FocusNode _nomFocus = FocusNode();

  late DateTime _moment = ref.read(clockProvider).now();
  late final String _draftId = widget.draftId ?? Ids.newId();

  VisiteReferentielDto? _entreprise;
  VisiteReferentielDto? _objet;
  VisiteReferentielDto? _direction;
  VisiteReferentielDto? _destinataire;

  bool _envoiEnCours = false;
  String? _echec;
  String? _derniereInscrite;
  String? _erreurNom;
  String? _erreurEntreprise;
  String? _erreurObjet;

  @override
  String get draftId => _draftId;

  @override
  String get draftFormKey => 'visite.create';

  @override
  DraftRepository get draftRepository => ref.read(draftRepositoryProvider);

  @override
  bool get draftIsEmpty =>
      _nom.text.trim().isEmpty &&
      _telephone.text.trim().isEmpty &&
      _commentaire.text.trim().isEmpty &&
      _entreprise == null &&
      _objet == null &&
      _direction == null &&
      _destinataire == null;

  @override
  String? draftRouteWithId() => widget.draftId != null
      ? null
      : Routes.accueilVisiteNewWithDraft(_draftId);

  @override
  Map<String, Object?> collectDraftValues() => <String, Object?>{
    'nom': _nom.text,
    'telephone': _telephone.text,
    'commentaire': _commentaire.text,
    'moment': _moment.toIso8601String(),
    'entrepriseId': _entreprise?.id,
    'entrepriseLabel': _entreprise?.label,
    'objetId': _objet?.id,
    'objetLabel': _objet?.label,
    'directionId': _direction?.id,
    'directionLabel': _direction?.label,
    'destinataireId': _destinataire?.id,
    'destinataireLabel': _destinataire?.label,
  };

  @override
  void initState() {
    super.initState();
    for (final TextEditingController c in <TextEditingController>[
      _nom,
      _telephone,
      _commentaire,
    ]) {
      c.addListener(markDraftDirty);
    }
    unawaited(_restaurer());
  }

  /// Seul le brouillon d'un PLANTAGE est repris d'office. À l'accueil chaque
  /// visiteur est une saisie neuve : ressortir une saisie simplement
  /// interrompue remplirait le formulaire du visiteur précédent.
  Future<void> _restaurer() async {
    final DraftSnapshot? snapshot = await draftRepository.read(_draftId);
    if (snapshot == null || !mounted) return;
    if (snapshot.age != DraftAge.crash) return;
    setState(() {
      _nom.text = (snapshot.values['nom'] as String?) ?? '';
      _telephone.text = (snapshot.values['telephone'] as String?) ?? '';
      _commentaire.text = (snapshot.values['commentaire'] as String?) ?? '';
      _moment =
          DateTime.tryParse((snapshot.values['moment'] as String?) ?? '') ??
          _moment;
      // Les listes ne sont pas encore là : on retient les identifiants et on
      // les résout contre le référentiel réel, plutôt que de refabriquer des
      // DTO à partir du brouillon.
      _aResoudre = snapshot.values;
    });
  }

  Map<String, Object?>? _aResoudre;

  void _resoudreChoix(VisiteReferentielsBundleDto bundle) {
    final Map<String, Object?> valeurs = _aResoudre!;
    _aResoudre = null;
    VisiteReferentielDto? parmi(
      List<VisiteReferentielDto> liste,
      String champ,
    ) {
      final String? id = valeurs['${champ}Id'] as String?;
      if (id == null) return null;
      for (final VisiteReferentielDto item in liste) {
        if (item.id == id) return item;
      }
      return null;
    }

    setState(() {
      _entreprise = parmi(bundle.entreprises, 'entreprise');
      _objet = parmi(bundle.objets, 'objet');
      _direction = parmi(bundle.directions, 'direction');
      _destinataire = parmi(bundle.destinataires, 'destinataire');
    });
  }

  @override
  void dispose() {
    for (final TextEditingController c in <TextEditingController>[
      _nom,
      _telephone,
      _commentaire,
    ]) {
      c.removeListener(markDraftDirty);
      c.dispose();
    }
    _nomFocus.dispose();
    super.dispose();
  }

  Future<void> _changerHeure() async {
    final TimeOfDay? choisie = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: _moment.toUtc().hour,
        minute: _moment.toUtc().minute,
      ),
      helpText: 'Heure de la visite',
    );
    if (choisie == null || !mounted) return;
    final DateTime utc = _moment.toUtc();
    setState(() {
      _moment = DateTime.utc(
        utc.year,
        utc.month,
        utc.day,
        choisie.hour,
        choisie.minute,
      );
    });
  }

  Future<void> _choisir({
    required String titre,
    required List<VisiteReferentielDto> items,
    required VisiteReferentielDto? courant,
    required bool facultatif,
    required ValueChanged<VisiteReferentielDto?> onChoisi,
  }) async {
    final _Choix? choix = await showModalBottomSheet<_Choix>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext context) => _FeuilleDeChoix(
        titre: titre,
        items: items,
        courant: courant,
        facultatif: facultatif,
      ),
    );
    if (choix == null || !mounted) return;
    onChoisi(choix.item);
    markDraftDirty();
  }

  Future<void> _enregistrer() async {
    if (_envoiEnCours) return;

    final String nom = _nom.text.trim();
    final VisiteReferentielDto? entreprise = _entreprise;
    final VisiteReferentielDto? objet = _objet;

    setState(() {
      _erreurNom = nom.isEmpty ? 'À renseigner.' : null;
      _erreurEntreprise = entreprise == null
          ? 'À choisir dans la liste.'
          : null;
      _erreurObjet = objet == null ? 'À choisir dans la liste.' : null;
    });
    if (nom.isEmpty || entreprise == null || objet == null) return;

    final String telephone = _telephone.text.trim();
    final String commentaire = _commentaire.text.trim();

    setState(() {
      _envoiEnCours = true;
      _echec = null;
      _derniereInscrite = null;
    });

    try {
      final AuthState auth = ref.read(authControllerProvider);
      await ref
          .read(writeRepositoryProvider)
          .inscrireVisite(
            visitorName: nom,
            date: jourDakar(_moment),
            time: heureDakar(_moment),
            phone: telephone.isEmpty ? null : telephone,
            entrepriseId: entreprise.id,
            entrepriseLabel: entreprise.label,
            objetId: objet.id,
            objetLabel: objet.label,
            directionId: _direction?.id,
            directionLabel: _direction?.label,
            destinataireId: _destinataire?.id,
            destinataireLabel: _destinataire?.label,
            comment: commentaire.isEmpty ? null : commentaire,
            createdById: auth.userId ?? '',
          );
      // La visite est écrite et en file : le brouillon n'a plus rien à sauver,
      // et le laisser ferait revenir ce visiteur-ci sur la saisie du suivant.
      discardDraft();
      unawaited(draftRepository.delete(_draftId));
      if (!mounted) return;
      ref.read(syncCoordinatorProvider.notifier).nudge();
      _nom.clear();
      _telephone.clear();
      _commentaire.clear();
      setState(() {
        _derniereInscrite = nom;
        _objet = null;
        _direction = null;
        _destinataire = null;
        _moment = ref.read(clockProvider).now();
      });
      _nomFocus.requestFocus();
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _echec = 'La visite n\'a pas été enregistrée. ${messageErreur(error)}';
      });
    } finally {
      if (mounted) setState(() => _envoiEnCours = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final AsyncValue<VisiteReferentielsBundleDto> listes = ref.watch(
      visiteReferentielsProvider,
    );
    final VisiteReferentielsBundleDto? bundle = listes.value;
    if (bundle != null && _aResoudre != null) {
      WidgetsBinding.instance.addPostFrameCallback((Duration _) {
        if (mounted && _aResoudre != null) _resoudreChoix(bundle);
      });
    }
    // L'entreprise et l'objet sont obligatoires : sans elles, il n'y a rien à
    // enregistrer, et le bouton doit le montrer avant qu'on le touche.
    final bool listesUtilisables =
        bundle != null &&
        bundle.entreprises.isNotEmpty &&
        bundle.objets.isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('Inscrire un visiteur')),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  CpiSpacing.md,
                  CpiSpacing.md,
                  CpiSpacing.md,
                ),
                children: <Widget>[
                  if (_derniereInscrite != null)
                    _Confirmation(visitorName: _derniereInscrite!),
                  _Moment(moment: _moment, onChanger: _changerHeure),
                  const SizedBox(height: CpiSpacing.md),
                  TextField(
                    key: const ValueKey<String>('visite-nom'),
                    controller: _nom,
                    focusNode: _nomFocus,
                    autofocus: true,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      labelText: 'Nom et prénom du visiteur',
                      errorText: _erreurNom,
                    ),
                  ),
                  const SizedBox(height: CpiSpacing.md),
                  if (bundle == null)
                    const _ListesEnCours()
                  // L'entreprise et l'objet sont obligatoires : sans elles, la
                  // fiche ne peut pas être remplie. Les listes descendent par la
                  // synchronisation, il n'y a donc rien à réessayer en ligne.
                  else if (bundle.entreprises.isEmpty || bundle.objets.isEmpty)
                    _ListesIndisponibles(
                      onSynchroniser: () =>
                          ref.read(syncCoordinatorProvider.notifier).nudge(),
                    )
                  else ...<Widget>[
                    _ChampChoix(
                      key: const ValueKey<String>('champ-entreprise'),
                      label: 'Entreprise',
                      valeur: _entreprise,
                      erreur: _erreurEntreprise,
                      facultatif: false,
                      onTap: () => _choisir(
                        titre: 'Entreprise',
                        items: bundle.entreprises,
                        courant: _entreprise,
                        facultatif: false,
                        onChoisi: (VisiteReferentielDto? item) => setState(() {
                          _entreprise = item;
                          _erreurEntreprise = null;
                        }),
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.md),
                    _ChampChoix(
                      key: const ValueKey<String>('champ-objet'),
                      label: 'Objet de la visite',
                      valeur: _objet,
                      erreur: _erreurObjet,
                      facultatif: false,
                      onTap: () => _choisir(
                        titre: 'Objet de la visite',
                        items: bundle.objets,
                        courant: _objet,
                        facultatif: false,
                        onChoisi: (VisiteReferentielDto? item) => setState(() {
                          _objet = item;
                          _erreurObjet = null;
                        }),
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.md),
                    _ChampChoix(
                      key: const ValueKey<String>('champ-direction'),
                      label: 'Direction ou étage',
                      valeur: _direction,
                      erreur: null,
                      facultatif: true,
                      onTap: () => _choisir(
                        titre: 'Direction ou étage',
                        items: bundle.directions,
                        courant: _direction,
                        facultatif: true,
                        onChoisi: (VisiteReferentielDto? item) =>
                            setState(() => _direction = item),
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.md),
                    _ChampChoix(
                      key: const ValueKey<String>('champ-destinataire'),
                      label: 'Destinataire',
                      valeur: _destinataire,
                      erreur: null,
                      facultatif: true,
                      onTap: () => _choisir(
                        titre: 'Destinataire',
                        items: bundle.destinataires,
                        courant: _destinataire,
                        facultatif: true,
                        onChoisi: (VisiteReferentielDto? item) =>
                            setState(() => _destinataire = item),
                      ),
                    ),
                  ],
                  const SizedBox(height: CpiSpacing.md),
                  // Aucune normalisation ici : un numéro étranger ou incomplet
                  // part tel quel, le serveur le garde et laisse `phoneE164` nul.
                  TextField(
                    key: const ValueKey<String>('visite-telephone'),
                    controller: _telephone,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Téléphone',
                      helperText: 'Facultatif, noté tel qu\'il est donné.',
                      helperMaxLines: 2,
                    ),
                  ),
                  const SizedBox(height: CpiSpacing.md),
                  TextField(
                    key: const ValueKey<String>('visite-commentaire'),
                    controller: _commentaire,
                    minLines: 2,
                    maxLines: 4,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Commentaire',
                      helperText: 'Facultatif.',
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.sm,
                CpiSpacing.md,
                CpiSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(
                  top: BorderSide(color: context.cpi.borderSubtle),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  if (_echec != null) ...<Widget>[
                    CpiFailureBanner(message: _echec!),
                    const SizedBox(height: CpiSpacing.xs),
                  ],
                  FilledButton.icon(
                    key: const ValueKey<String>('visite-enregistrer'),
                    onPressed: listesUtilisables && !_envoiEnCours
                        ? _enregistrer
                        : null,
                    icon: _envoiEnCours
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(
                            PhosphorIconsRegular.checkCircle,
                            size: CpiIconSize.lg,
                          ),
                    label: Text(
                      _envoiEnCours
                          ? 'Enregistrement…'
                          : 'Enregistrer la visite',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Moment extends StatelessWidget {
  const _Moment({required this.moment, required this.onChanger});

  final DateTime moment;
  final Future<void> Function() onChanger;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: context.cpi.borderSubtle),
      ),
      child: Row(
        children: <Widget>[
          Icon(
            PhosphorIconsRegular.clock,
            size: CpiIconSize.lg,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              'Aujourd\'hui, ${heureDakar(moment)}',
              style: theme.textTheme.titleMedium,
            ),
          ),
          TextButton(
            onPressed: () => onChanger(),
            child: const Text('Changer'),
          ),
        ],
      ),
    );
  }
}

class _ChampChoix extends StatelessWidget {
  const _ChampChoix({
    super.key,
    required this.label,
    required this.valeur,
    required this.erreur,
    required this.facultatif,
    required this.onTap,
  });

  final String label;
  final VisiteReferentielDto? valeur;
  final String? erreur;
  final bool facultatif;
  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final VisiteReferentielDto? choisi = valeur;

    return InkWell(
      onTap: () => onTap(),
      borderRadius: CpiRadius.brMd,
      child: InputDecorator(
        isEmpty: false,
        decoration: InputDecoration(
          labelText: facultatif ? '$label (facultatif)' : label,
          errorText: erreur,
          errorMaxLines: 2,
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                choisi?.label ?? 'Choisir',
                style: choisi == null
                    ? theme.textTheme.bodyLarge?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      )
                    : theme.textTheme.bodyLarge,
              ),
            ),
            Icon(
              PhosphorIconsRegular.caretDown,
              size: CpiIconSize.md,
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ],
        ),
      ),
    );
  }
}

class _FeuilleDeChoix extends StatelessWidget {
  const _FeuilleDeChoix({
    required this.titre,
    required this.items,
    required this.courant,
    required this.facultatif,
  });

  final String titre;
  final List<VisiteReferentielDto> items;
  final VisiteReferentielDto? courant;
  final bool facultatif;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.md,
                CpiSpacing.md,
                CpiSpacing.xs,
              ),
              child: Text(titre, style: theme.textTheme.titleLarge),
            ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: facultatif ? items.length + 1 : items.length,
                itemBuilder: (BuildContext context, int index) {
                  if (facultatif && index == 0) {
                    return ListTile(
                      minVerticalPadding: CpiSpacing.md,
                      title: Text(
                        'Aucun',
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      selected: courant == null,
                      onTap: () =>
                          Navigator.of(context).pop(const _Choix(null)),
                    );
                  }
                  final VisiteReferentielDto item =
                      items[facultatif ? index - 1 : index];
                  final bool actif = item.id == courant?.id;
                  return ListTile(
                    minVerticalPadding: CpiSpacing.md,
                    title: Text(item.label, style: theme.textTheme.bodyLarge),
                    selected: actif,
                    trailing: actif
                        ? Icon(
                            PhosphorIconsRegular.check,
                            size: CpiIconSize.md,
                            color: theme.colorScheme.primary,
                          )
                        : null,
                    onTap: () => Navigator.of(context).pop(_Choix(item)),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Confirmation extends StatelessWidget {
  const _Confirmation({required this.visitorName});

  final String visitorName;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Container(
      margin: const EdgeInsets.only(bottom: CpiSpacing.md),
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: cpi.successSurface,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: cpi.success),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(
            PhosphorIconsRegular.checkCircle,
            size: CpiIconSize.lg,
            color: cpi.success,
          ),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  '$visitorName inscrit(e) au registre.',
                  style: theme.textTheme.titleSmall,
                ),
                Text(
                  'Le visiteur suivant peut être saisi.',
                  style: theme.textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ListesEnCours extends StatelessWidget {
  const _ListesEnCours();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        const SizedBox.square(
          dimension: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        const SizedBox(width: CpiSpacing.xs),
        Expanded(
          child: Text(
            'Chargement des listes de l\'accueil…',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      ],
    );
  }
}

class _ListesIndisponibles extends StatelessWidget {
  const _ListesIndisponibles({required this.onSynchroniser});

  final VoidCallback onSynchroniser;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const CpiFailureBanner(
          message: 'Les listes de l\'accueil ne sont pas encore descendues.',
        ),
        const SizedBox(height: CpiSpacing.xs),
        OutlinedButton.icon(
          onPressed: onSynchroniser,
          icon: const Icon(
            PhosphorIconsRegular.arrowClockwise,
            size: CpiIconSize.md,
          ),
          label: const Text('Synchroniser'),
        ),
        const SizedBox(height: CpiSpacing.xxs),
        Text(
          'Sans elles, l\'entreprise et l\'objet ne peuvent pas être choisis.',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}
