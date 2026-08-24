import 'dart:async';

import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/drafts/draft_form_mixin.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/ids.dart';
import '../../../data/repositories/draft_repository.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/local_typeahead.dart';
import '../../auth/auth_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../visites_repository.dart';

class VisiteFormScreen extends ConsumerStatefulWidget {
  const VisiteFormScreen({super.key, this.draftId});

  final String? draftId;

  @override
  ConsumerState<VisiteFormScreen> createState() => _VisiteFormScreenState();
}

class _VisiteFormScreenState extends ConsumerState<VisiteFormScreen>
    with DraftFormMixin<VisiteFormScreen> {
  final TextEditingController _nom = TextEditingController();
  final TextEditingController _entreprise = TextEditingController();
  final TextEditingController _objet = TextEditingController();
  final TextEditingController _destinataire = TextEditingController();
  final TextEditingController _direction = TextEditingController();
  final TextEditingController _telephone = TextEditingController();
  final TextEditingController _commentaire = TextEditingController();

  final FocusNode _nomFocus = FocusNode();
  final FocusNode _entrepriseFocus = FocusNode();
  final FocusNode _objetFocus = FocusNode();
  final FocusNode _destinataireFocus = FocusNode();
  final FocusNode _directionFocus = FocusNode();

  late DateTime _moment = ref.read(clockProvider).now();
  late final String _draftId = widget.draftId ?? Ids.newId();

  String? _entrepriseId;
  String? _objetId;
  String? _directionId;
  String? _destinataireId;

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
      _entrepriseId == null &&
      _objetId == null &&
      _directionId == null &&
      _destinataireId == null;

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
    'entrepriseId': _entrepriseId,
    'entrepriseLabel': _entreprise.text,
    'objetId': _objetId,
    'objetLabel': _objet.text,
    'directionId': _directionId,
    'directionLabel': _direction.text,
    'destinataireId': _destinataireId,
    'destinataireLabel': _destinataire.text,
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
  /// interrompue remplirait le formulaire du visiteur précédent. Une ligne
  /// qui ne sera jamais montrée ne reste pas non plus en base sept jours avec
  /// un nom et un numéro de visiteur en clair.
  Future<void> _restaurer() async {
    final DraftSnapshot? snapshot = await draftRepository.read(_draftId);
    if (snapshot == null) return;
    if (snapshot.age != DraftAge.crash) {
      await draftRepository.delete(_draftId);
      return;
    }
    if (!mounted) return;
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
      final VisiteReferentielDto? entreprise = parmi(
        bundle.entreprises,
        'entreprise',
      );
      _entrepriseId = entreprise?.id;
      _entreprise.text = entreprise?.label ?? '';

      final VisiteReferentielDto? objet = parmi(bundle.objets, 'objet');
      _objetId = objet?.id;
      _objet.text = objet?.label ?? '';

      final VisiteReferentielDto? direction = parmi(
        bundle.directions,
        'direction',
      );
      _directionId = direction?.id;
      _direction.text = direction?.label ?? '';

      final VisiteReferentielDto? destinataire = parmi(
        bundle.destinataires,
        'destinataire',
      );
      _destinataireId = destinataire?.id;
      _destinataire.text = destinataire?.label ?? '';
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
    }
    for (final TextEditingController c in <TextEditingController>[
      _nom,
      _entreprise,
      _objet,
      _destinataire,
      _direction,
      _telephone,
      _commentaire,
    ]) {
      c.dispose();
    }
    for (final FocusNode n in <FocusNode>[
      _nomFocus,
      _entrepriseFocus,
      _objetFocus,
      _destinataireFocus,
      _directionFocus,
    ]) {
      n.dispose();
    }
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

  Future<void> _enregistrer() async {
    if (_envoiEnCours) return;

    final String nom = _nom.text.trim();
    final String? entrepriseId = _entrepriseId;
    final String? objetId = _objetId;

    setState(() {
      _erreurNom = nom.isEmpty ? 'À renseigner.' : null;
      _erreurEntreprise = entrepriseId == null
          ? 'À choisir dans la liste.'
          : null;
      _erreurObjet = objetId == null ? 'À choisir dans la liste.' : null;
    });
    if (nom.isEmpty || entrepriseId == null || objetId == null) return;

    final String telephone = _telephone.text.trim();
    final String commentaire = _commentaire.text.trim();
    final String entrepriseLabel = _entreprise.text.trim();
    final String objetLabel = _objet.text.trim();
    final String? directionId = _directionId;
    final String? directionLabel = _directionId == null
        ? null
        : _direction.text.trim();
    final String? destinataireId = _destinataireId;
    final String? destinataireLabel = _destinataireId == null
        ? null
        : _destinataire.text.trim();

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
            entrepriseId: entrepriseId,
            entrepriseLabel: entrepriseLabel,
            objetId: objetId,
            objetLabel: objetLabel,
            directionId: directionId,
            directionLabel: directionLabel,
            destinataireId: destinataireId,
            destinataireLabel: destinataireLabel,
            comment: commentaire.isEmpty ? null : commentaire,
            createdById: auth.userId ?? '',
          );
      // La visite est écrite et en file : le brouillon n'a plus rien à sauver,
      // et le laisser ferait revenir ce visiteur-ci sur la saisie du suivant.
      discardDraft();
      await draftRepository.delete(_draftId);
      unawaited(HapticFeedback.mediumImpact());
      if (!mounted) return;
      ref.read(syncCoordinatorProvider.notifier).nudge();
      _nom.clear();
      _objet.clear();
      _direction.clear();
      _destinataire.clear();
      setState(() {
        _derniereInscrite = nom;
        _objetId = null;
        _directionId = null;
        _destinataireId = null;
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
                    LocalTypeahead(
                      key: const ValueKey<String>('champ-entreprise'),
                      controller: _entreprise,
                      focusNode: _entrepriseFocus,
                      label: 'Entreprise',
                      selectedId: _entrepriseId,
                      freeText: false,
                      options: bundle.entreprises
                          .map(
                            (VisiteReferentielDto d) =>
                                TypeaheadOption(id: d.id, label: d.label),
                          )
                          .toList(growable: false),
                      onChanged: (String _) {
                        if (_entrepriseId != null) {
                          setState(() => _entrepriseId = null);
                        }
                        markDraftDirty();
                      },
                      onSelected: (TypeaheadOption option) {
                        setState(() {
                          _entrepriseId = option.id;
                          _erreurEntreprise = null;
                        });
                        markDraftDirty();
                      },
                    ),
                    if (_erreurEntreprise != null)
                      _ErreurChamp(_erreurEntreprise!),
                    const SizedBox(height: CpiSpacing.md),
                    LocalTypeahead(
                      key: const ValueKey<String>('champ-objet'),
                      controller: _objet,
                      focusNode: _objetFocus,
                      label: 'Objet de la visite',
                      selectedId: _objetId,
                      freeText: false,
                      options: bundle.objets
                          .map(
                            (VisiteReferentielDto d) =>
                                TypeaheadOption(id: d.id, label: d.label),
                          )
                          .toList(growable: false),
                      onChanged: (String _) {
                        if (_objetId != null) setState(() => _objetId = null);
                        markDraftDirty();
                      },
                      onSelected: (TypeaheadOption option) {
                        setState(() {
                          _objetId = option.id;
                          _erreurObjet = null;
                        });
                        markDraftDirty();
                      },
                    ),
                    if (_erreurObjet != null) _ErreurChamp(_erreurObjet!),
                    const SizedBox(height: CpiSpacing.md),
                    LocalTypeahead(
                      key: const ValueKey<String>('champ-destinataire'),
                      controller: _destinataire,
                      focusNode: _destinataireFocus,
                      label: 'Destinataire (facultatif)',
                      selectedId: _destinataireId,
                      freeText: false,
                      options: bundle.destinataires
                          .map(
                            (VisiteReferentielDto d) =>
                                TypeaheadOption(id: d.id, label: d.label),
                          )
                          .toList(growable: false),
                      onChanged: (String _) {
                        if (_destinataireId != null) {
                          setState(() => _destinataireId = null);
                        }
                        markDraftDirty();
                      },
                      onSelected: (TypeaheadOption option) {
                        setState(() => _destinataireId = option.id);
                        markDraftDirty();
                      },
                    ),
                    const SizedBox(height: CpiSpacing.md),
                    LocalTypeahead(
                      key: const ValueKey<String>('champ-direction'),
                      controller: _direction,
                      focusNode: _directionFocus,
                      label: 'Direction ou étage (facultatif)',
                      selectedId: _directionId,
                      freeText: false,
                      options: bundle.directions
                          .map(
                            (VisiteReferentielDto d) =>
                                TypeaheadOption(id: d.id, label: d.label),
                          )
                          .toList(growable: false),
                      onChanged: (String _) {
                        if (_directionId != null) {
                          setState(() => _directionId = null);
                        }
                        markDraftDirty();
                      },
                      onSelected: (TypeaheadOption option) {
                        setState(() => _directionId = option.id);
                        markDraftDirty();
                      },
                    ),
                  ],
                  const SizedBox(height: CpiSpacing.md),
                  // Juste 99 fois sur 100 : descendu ici, les trois champs
                  // obligatoires tiennent au-dessus du pli, clavier ouvert.
                  _Moment(moment: _moment, onChanger: _changerHeure),
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
            CpiActionBar(
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

class _ErreurChamp extends StatelessWidget {
  const _ErreurChamp(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: CpiSpacing.xxs, left: CpiSpacing.sm),
      child: Text(
        message,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.error,
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
