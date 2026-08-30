import 'package:flutter/material.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/client_model.dart';
import '../../../shared/widgets/layouts/polished_page.dart';

class OrderClientInfo extends StatelessWidget {
  const OrderClientInfo({super.key, required this.client});

  final ClientModel? client;

  @override
  Widget build(BuildContext context) {
    final value = client;
    if (value == null) {
      return const AppStatusBanner(
        title: 'Client non renseigné',
        message: 'Aucun dossier client n’est rattaché à cette commande.',
        icon: Icons.person_off_outlined,
        tone: AppStatusTone.warning,
      );
    }

    return AppActionTile(
      title: value.displayName,
      subtitle: value.phone?.trim().isNotEmpty == true
          ? value.phone
          : 'Téléphone non renseigné',
      value:
          '${value.totalOrders} commande${value.totalOrders == 1 ? '' : 's'}',
      icon: Icons.person_outline_rounded,
      accentColor: Theme.of(context).colorScheme.primary,
      onTap: () => AppNavigator.toClientDetail(context, clientId: value.id),
    );
  }
}
