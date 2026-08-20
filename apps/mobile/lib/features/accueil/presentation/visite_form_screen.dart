import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../visites_repository.dart';

/// `null` : le choix a été abandonné. `_Choix(null)` : l'entrée a été retirée.
class _Choix {
  const _Choix(this.item);

  final VisiteReferentielDto? item;
}

class VisiteFormScreen extends ConsumerStatefulWidget {
  const VisiteFormScreen({super.key});

  @override
  ConsumerState<VisiteFormScreen> createState() => _VisiteFormScreenState();
}

class _VisiteFormScreenState extends ConsumerState<VisiteFormScreen> {
  final TextEditingController _nom = TextEditingController();
  final TextEditingController _telephone = TextEditingController();
  final TextEditingController _commentaire = TextEditingController();
  final FocusNode _nomFocus = FocusNode();

  late DateTime _moment = ref.read(clockProvider).now();

  VisiteReferentielDto? _entreprise;
  VisiteReferentielDto? _objet;
  VisiteReferentielDto? _direction;
  VisiteReferentielDto? _destinataire;

  bool _envoiEnCours = false;
  String? _echec;
  VisiteDto? _derniere;
  String? _erreurNom;
  String? _erreurEntreprise;
  String? _erreurObjet;

  @override
  void dispose() {
    _nom.dispose();
    _telephone.dispose();
    _commentaire.dispose();
    _nomFocus.dispose();
    super.dispose();
  }

  Future<void> _changerHeure() async {
    final TimeOfDay? choisie = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: _moment.toUtc().hour, minute: _moment.toUtc().minute),
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
  }

  Future<void> _enregistrer() async {
    if (_envoiEnCours) return;

    final String nom = _nom.text.trim();
    final VisiteReferentielDto? entreprise = _entreprise;
    final VisiteReferentielDto? objet = _objet;

    setState(() {
      _erreurNom = nom.isEmpty ? 'À renseigner.' : null;
      _erreurEntreprise = entreprise == null ? 'À choisir dans la liste.' : null;
      _erreurObjet = objet == null ? 'À choisir dans la liste.' : null;
    });
    if (nom.isEmpty || entreprise == null || objet == null) return;

    final String telephone = _telephone.text.trim();
    final String commentaire = _commentaire.text.trim();

    setState(() {
      _envoiEnCours = true;
      _echec = null;
      _derniere = null;
    });

    try {
      final VisiteDto enregistree = await ref
          .read(visitesPortProvider)
          .inscrire(
            CreateVisiteDto(
              date: jourDakar(_moment),
              time: heureDakar(_moment),
              visitorName: nom,
              phone: telephone.isEmpty ? null : telephone,
              entrepriseId: entreprise.id,
              objetId: objet.id,
              directionId: _direction?.id,
              destinataireId: _destinataire?.id,
              comment: commentaire.isEmpty ? null : commentaire,
            ),
          );
      if (!mounted) return;
      ref.invalidate(registreDuJourProvider);
      _nom.clear();
      _telephone.clear();
      _commentaire.clear();
      setState(() {
        _derniere = enregistree;
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
                  const RegistreEnLigneSeulement(),
                  if (_derniere != null) _Confirmation(visite: _derniere!),
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
                  if (listes.hasError)
                    _ListesIndisponibles(
                      message: messageErreur(listes.error ?? 'Erreur inconnue'),
                      onReessayer: () => ref.invalidate(visiteReferentielsProvider),
                    )
                  else if (bundle == null)
                    const _ListesEnCours()
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
                border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  if (_echec != null) ...<Widget>[
                    BandeauEchec(message: _echec!),
                    const SizedBox(height: CpiSpacing.xs),
                  ],
                  FilledButton.icon(
                    key: const ValueKey<String>('visite-enregistrer'),
                    onPressed: bundle == null || _envoiEnCours ? null : _enregistrer,
                    icon: _envoiEnCours
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(PhosphorIconsRegular.checkCircle, size: 22),
                    label: Text(
                      _envoiEnCours ? 'Enregistrement…' : 'Enregistrer la visite',
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

/// Le registre ne se garde pas sur le téléphone : le dire avant la saisie, pas
/// après l'échec.
class RegistreEnLigneSeulement extends ConsumerWidget {
  const RegistreEnLigneSeulement({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(connectivityProvider) == CpiConnectivity.online) {
      return const SizedBox.shrink();
    }
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Container(
      margin: const EdgeInsets.only(bottom: CpiSpacing.md),
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: cpi.accentSurface,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: cpi.accentBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(PhosphorIconsRegular.wifiSlash, size: 20, color: cpi.accentText),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              'Hors ligne. Le registre des visites s\'écrit sur le serveur : '
              'il n\'attend pas le retour du réseau comme les autres saisies.',
              style: theme.textTheme.bodyMedium?.copyWith(color: cpi.accentText),
            ),
          ),
        ],
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
            size: 22,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              'Aujourd\'hui, ${heureDakar(moment)}',
              style: theme.textTheme.titleMedium,
            ),
          ),
          TextButton(onPressed: () => onChanger(), child: const Text('Changer')),
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
              size: 20,
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
                            size: 20,
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
  const _Confirmation({required this.visite});

  final VisiteDto visite;

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
          Icon(PhosphorIconsRegular.checkCircle, size: 22, color: cpi.success),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  '${visite.visitorName} inscrit sous ${visite.reference}.',
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

class BandeauEchec extends StatelessWidget {
  const BandeauEchec({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer,
        borderRadius: CpiRadius.brMd,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(
            PhosphorIconsRegular.warningCircle,
            size: 20,
            color: theme.colorScheme.onErrorContainer,
          ),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onErrorContainer,
              ),
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
  const _ListesIndisponibles({required this.message, required this.onReessayer});

  final String message;
  final VoidCallback onReessayer;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        BandeauEchec(message: 'Les listes de l\'accueil manquent. $message'),
        const SizedBox(height: CpiSpacing.xs),
        OutlinedButton.icon(
          onPressed: onReessayer,
          icon: const Icon(PhosphorIconsRegular.arrowClockwise, size: 20),
          label: const Text('Réessayer'),
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
