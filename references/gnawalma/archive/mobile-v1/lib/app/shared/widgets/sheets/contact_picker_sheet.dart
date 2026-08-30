import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../layouts/polished_page.dart';
import '../states/empty_state.dart';

/// Ce qu'on retient d'un contact du téléphone.
class PickedContact {
  const PickedContact({
    required this.firstName,
    required this.lastName,
    required this.phone,
  });

  final String firstName;
  final String lastName;
  final String phone;
}

/// Choisit un client dans le répertoire du téléphone.
///
/// Le gérant retapait le nom et le numéro d'une personne qu'il a déjà dans son
/// téléphone. Le répertoire n'est lu qu'ici, à la demande, et rien n'est envoyé
/// nulle part : seul le contact choisi remplit le formulaire, que l'utilisateur
/// relit et valide.
Future<PickedContact?> pickContact(BuildContext context) async {
  final status = await FlutterContacts.permissions.request(PermissionType.read);
  if (!context.mounted) return null;
  final granted =
      status == PermissionStatus.granted || status == PermissionStatus.limited;
  if (!granted) {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheetContext) => const Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          AppSpacing.xl,
        ),
        child: AppStatusBanner(
          title: 'Répertoire non autorisé',
          message:
              'Autorisez l’accès aux contacts dans les réglages du téléphone, ou saisissez le client à la main.',
          icon: Icons.contacts_outlined,
          tone: AppStatusTone.info,
        ),
      ),
    );
    return null;
  }

  final contacts = await FlutterContacts.getAll(
    properties: {ContactProperty.name, ContactProperty.phone},
  );
  if (!context.mounted) return null;

  final usable = contacts
      .where((contact) => contact.phones.isNotEmpty)
      .toList(growable: false)
    ..sort((a, b) => _label(a).toLowerCase().compareTo(_label(b).toLowerCase()));

  return showModalBottomSheet<PickedContact>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (sheetContext) => _ContactList(contacts: usable),
  );
}

/// Le nom affiché, quel que soit ce que le carnet a rempli.
String _label(Contact contact) {
  final display = contact.displayName?.trim() ?? '';
  if (display.isNotEmpty) return display;
  final name = contact.name;
  return [
    name?.first?.trim() ?? '',
    name?.last?.trim() ?? '',
  ].where((part) => part.isNotEmpty).join(' ');
}

class _ContactList extends StatefulWidget {
  const _ContactList({required this.contacts});

  final List<Contact> contacts;

  @override
  State<_ContactList> createState() => _ContactListState();
}

class _ContactListState extends State<_ContactList> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final needle = _query.trim().toLowerCase();
    final shown = needle.isEmpty
        ? widget.contacts
        : widget.contacts
              .where(
                (contact) =>
                    _label(contact).toLowerCase().contains(needle) ||
                    contact.phones.any(
                      (phone) => phone.number.replaceAll(' ', '').contains(
                        needle.replaceAll(' ', ''),
                      ),
                    ),
              )
              .toList(growable: false);

    return FractionallySizedBox(
      heightFactor: 0.85,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AppSectionHeader(
              title: 'Vos contacts',
              subtitle: 'Choisissez la personne à enregistrer comme cliente.',
              icon: Icons.contacts_outlined,
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
              decoration: const InputDecoration(
                hintText: 'Nom ou numéro',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: shown.isEmpty
                  ? const EmptyState(
                      icon: Icons.contacts_outlined,
                      title: 'Aucun contact',
                      message:
                          'Aucun contact avec un numéro de téléphone ne correspond.',
                      compact: true,
                    )
                  : ListView.separated(
                      itemCount: shown.length,
                      separatorBuilder: (_, _) => Divider(
                        height: 1,
                        color: context.dividerColor,
                      ),
                      itemBuilder: (_, index) {
                        final contact = shown[index];
                        final phone = contact.phones.first.number;
                        return ListTile(
                          title: Text(
                            _label(contact),
                            style: AppTextStyles.label.copyWith(
                              color: context.textPrimaryColor,
                            ),
                          ),
                          subtitle: Text(
                            phone,
                            style: AppTextStyles.bodySmall.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                          onTap: () => Navigator.pop(
                            context,
                            _pickedFrom(contact, phone),
                          ),
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

/// Le carnet ne garantit pas un prénom et un nom séparés : quand seule la
/// ligne affichée existe, le premier mot devient le prénom et le reste le nom.
PickedContact _pickedFrom(Contact contact, String phone) {
  final first = contact.name?.first?.trim() ?? '';
  final last = contact.name?.last?.trim() ?? '';
  if (first.isNotEmpty || last.isNotEmpty) {
    return PickedContact(firstName: first, lastName: last, phone: phone);
  }
  final parts = _label(contact).split(RegExp(r'\s+'))
    ..removeWhere((part) => part.isEmpty);
  return PickedContact(
    firstName: parts.isEmpty ? '' : parts.first,
    lastName: parts.length > 1 ? parts.skip(1).join(' ') : '',
    phone: phone,
  );
}
