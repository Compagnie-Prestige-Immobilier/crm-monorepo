import '../../utils/app_money.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/client_model.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_feedback.dart';
import '../../../shared/utils/communication_utils.dart';
import 'playful_card.dart';

class ClientCard extends ConsumerWidget {
  const ClientCard({
    super.key,
    required this.client,
    this.onTap,
    this.totalOrders,
    this.totalSpent,
    this.lastOrderDate,
    this.margin,
  });

  final ClientModel client;
  final VoidCallback? onTap;
  final int? totalOrders;
  final double? totalSpent;
  final DateTime? lastOrderDate;
  final EdgeInsetsGeometry? margin;

  String get _initials {
    final first = client.firstName.isNotEmpty ? client.firstName[0] : '';
    final last = client.lastName.isNotEmpty ? client.lastName[0] : '';
    return '$first$last'.toUpperCase();
  }

  bool get _isActiveRecently {
    final last = lastOrderDate;
    return last != null && DateTime.now().difference(last).inDays <= 30;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final phone = client.phone?.trim();
    return PlayfulCard(
      onTap: onTap,
      margin: margin,
      semanticLabel:
          'Client ${client.displayName}. ${phone?.isNotEmpty == true ? phone : 'Aucun téléphone'}',
      padding: const EdgeInsets.fromLTRB(14, 13, 8, 13),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Hero(
                tag: 'client-avatar-${client.id}',
                child: Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    // Neutral circle with ink initials — a contact avatar, not
                    // a tinted rounded-square. Circles read as people; squares
                    // read as app icons.
                    color: context.surfaceLightColor,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    _initials,
                    style: AppTextStyles.label.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                ),
              ),
              if (_isActiveRecently)
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Container(
                    width: 13,
                    height: 13,
                    decoration: BoxDecoration(
                      color: AppColors.success,
                      shape: BoxShape.circle,
                      border: Border.all(color: context.surfaceColor, width: 2),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  client.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyLarge.copyWith(
                    color: context.textPrimaryColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Icon(
                      phone?.isNotEmpty == true
                          ? Icons.phone_outlined
                          : Icons.phone_disabled_outlined,
                      size: 15,
                      color: context.textSecondaryColor,
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        phone?.isNotEmpty == true
                            ? phone!
                            : 'Téléphone non renseigné',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
                if (totalOrders != null || totalSpent != null) ...[
                  const SizedBox(height: 6),
                  // Plain metadata line, not coloured pills. Money is set with
                  // tabular figures so amounts align down a scrolling list.
                  Text.rich(
                    TextSpan(
                      children: [
                        if (totalOrders != null)
                          TextSpan(
                            text:
                                '$totalOrders commande${totalOrders == 1 ? '' : 's'}',
                          ),
                        if (totalOrders != null && totalSpent != null)
                          const TextSpan(text: '   ·   '),
                        if (totalSpent != null)
                          TextSpan(
                            text: money.format(
                              totalSpent!,
                              compactSymbol: true,
                            ),
                            style: AppTextStyles.numeric.copyWith(
                              color: context.textPrimaryColor,
                            ),
                          ),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ],
              ],
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Actions pour ${client.displayName}',
            icon: Icon(
              Icons.more_horiz_rounded,
              color: context.textSecondaryColor,
            ),
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'call',
                child: ListTile(
                  leading: Icon(Icons.call_outlined),
                  title: Text('Appeler'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              PopupMenuItem(
                value: 'message',
                child: ListTile(
                  leading: Icon(Icons.chat_outlined),
                  title: Text('WhatsApp'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              PopupMenuItem(
                value: 'edit',
                child: ListTile(
                  leading: Icon(Icons.edit_outlined),
                  title: Text('Modifier'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
            onSelected: (value) {
              switch (value) {
                case 'call':
                  _callClient();
                  break;
                case 'message':
                  _messageClient();
                  break;
                case 'edit':
                  AppNavigator.to(AppRoutes.addEditClient, arguments: client);
                  break;
              }
            },
          ),
        ],
      ),
    );
  }

  void _callClient() {
    final phone = client.phone;
    if (phone == null || phone.isEmpty) {
      AppFeedback.showError('Ce client n’a pas de numéro de téléphone.');
      return;
    }
    CommunicationUtils.makePhoneCall(phone);
  }

  void _messageClient() {
    final phone = client.phone;
    if (phone == null || phone.isEmpty) {
      AppFeedback.showError('Ce client n’a pas de numéro de téléphone.');
      return;
    }
    CommunicationUtils.openWhatsApp(phone);
  }
}
