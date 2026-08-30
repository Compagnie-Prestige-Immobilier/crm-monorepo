import 'package:flutter/material.dart';

import '../../../shared/theme/app_spacing.dart';
import '../../../shared/utils/social_link_utils.dart';
import '../../../shared/widgets/forms/app_text_field.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/visuals/social_icon.dart';

/// Résultat de [SocialLinksEditorSheet] : trois URL canoniques, prêtes à
/// stocker telles quelles. Une chaîne vide retire le lien correspondant.
typedef SocialLinksResult = ({
  String tiktokUrl,
  String instagramUrl,
  String facebookUrl,
});

/// Saisie des trois réseaux, partagée entre le tableau de bord, la fiche
/// profil et l'assistant d'inscription — un seul champ à faire évoluer plutôt
/// que trois copies qui dérivent (§ règle app-wide sur les widgets dupliqués).
///
/// L'atelier tape juste son identifiant ("monatelier") ; le préfixe du
/// domaine ("tiktok.com/@") est affiché devant le champ plutôt que demandé à
/// la saisie. Un lien complet collé par erreur est nettoyé automatiquement.
class SocialLinksEditorSheet extends StatefulWidget {
  const SocialLinksEditorSheet({
    super.key,
    this.initialTiktokUrl,
    this.initialInstagramUrl,
    this.initialFacebookUrl,
  });

  final String? initialTiktokUrl;
  final String? initialInstagramUrl;
  final String? initialFacebookUrl;

  @override
  State<SocialLinksEditorSheet> createState() =>
      _SocialLinksEditorSheetState();
}

class _SocialLinksEditorSheetState extends State<SocialLinksEditorSheet> {
  late final _tiktok = TextEditingController(
    text: SocialLinkUtils.usernameFromUrl(
      SocialNetwork.tiktok,
      widget.initialTiktokUrl,
    ),
  );
  late final _instagram = TextEditingController(
    text: SocialLinkUtils.usernameFromUrl(
      SocialNetwork.instagram,
      widget.initialInstagramUrl,
    ),
  );
  late final _facebook = TextEditingController(
    text: SocialLinkUtils.usernameFromUrl(
      SocialNetwork.facebook,
      widget.initialFacebookUrl,
    ),
  );

  @override
  void dispose() {
    _tiktok.dispose();
    _instagram.dispose();
    _facebook.dispose();
    super.dispose();
  }

  String? _validateHandle(String? value) {
    final trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.contains(RegExp(r'\s'))) {
      return 'Pas d’espace dans un identifiant';
    }
    if (trimmed.contains('/')) {
      return 'Juste l’identifiant, pas le lien complet';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          0,
          AppSpacing.gutter,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AppSectionHeader(
              title: 'Vos réseaux',
              subtitle:
                  'Vos clients y voient vos réalisations. Videz un champ pour retirer le lien.',
              icon: Icons.public_outlined,
            ),
            const SizedBox(height: AppSpacing.md),
            _SocialHandleField(
              network: SocialNetwork.tiktok,
              controller: _tiktok,
              validator: _validateHandle,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: AppSpacing.md),
            _SocialHandleField(
              network: SocialNetwork.instagram,
              controller: _instagram,
              validator: _validateHandle,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: AppSpacing.md),
            _SocialHandleField(
              network: SocialNetwork.facebook,
              controller: _facebook,
              validator: _validateHandle,
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              onPressed: () => Navigator.pop<SocialLinksResult>(context, (
                tiktokUrl: SocialLinkUtils.canonicalUrl(
                  SocialNetwork.tiktok,
                  _tiktok.text,
                ),
                instagramUrl: SocialLinkUtils.canonicalUrl(
                  SocialNetwork.instagram,
                  _instagram.text,
                ),
                facebookUrl: SocialLinkUtils.canonicalUrl(
                  SocialNetwork.facebook,
                  _facebook.text,
                ),
              )),
              child: const Text('Enregistrer'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SocialHandleField extends StatelessWidget {
  const _SocialHandleField({
    required this.network,
    required this.controller,
    required this.validator,
    required this.textInputAction,
  });

  final SocialNetwork network;
  final TextEditingController controller;
  final String? Function(String?) validator;
  final TextInputAction textInputAction;

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      label: network.label,
      hint: 'votreatelier',
      controller: controller,
      iconWidget: SocialIcon(network: network, size: 20),
      validator: validator,
      keyboardType: TextInputType.text,
      textInputAction: textInputAction,
      prefixText: SocialLinkUtils.prefix(network),
    );
  }
}
