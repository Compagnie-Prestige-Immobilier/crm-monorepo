import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';

class ClientQuickActions extends StatelessWidget {
  const ClientQuickActions({
    super.key,
    required this.client,
    required this.onCall,
    required this.onEmail,
    required this.onAddMeasurement,
    required this.onNewOrder,
  });

  final ClientModel client;
  final void Function(String) onCall;
  final void Function(String) onEmail;
  final VoidCallback onAddMeasurement;
  final VoidCallback onNewOrder;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: onNewOrder,
                icon: const Icon(Icons.add_shopping_cart_rounded),
                label: const Text('Nouvelle commande'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onAddMeasurement,
                icon: const Icon(Icons.straighten_rounded),
                label: const Text('Mesures'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _ContactAction(
                icon: Icons.call_outlined,
                label: 'Appeler',
                enabled: client.phone?.trim().isNotEmpty == true,
                onTap: client.phone?.trim().isNotEmpty == true
                    ? () => onCall(client.phone!)
                    : null,
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _ContactAction(
                icon: Icons.chat_bubble_outline_rounded,
                label: 'Message',
                enabled: client.phone?.trim().isNotEmpty == true,
                onTap: client.phone?.trim().isNotEmpty == true
                    ? () async {
                        final uri = Uri(scheme: 'sms', path: client.phone!);
                        if (await canLaunchUrl(uri)) await launchUrl(uri);
                      }
                    : null,
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _ContactAction(
                icon: Icons.mail_outline_rounded,
                label: 'Email',
                enabled: client.email?.trim().isNotEmpty == true,
                onTap: client.email?.trim().isNotEmpty == true
                    ? () => onEmail(client.email!)
                    : null,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ContactAction extends StatelessWidget {
  const _ContactAction({
    required this.icon,
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      onTap: onTap,
      enabled: enabled,
      semanticLabel: label,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      backgroundColor: enabled
          ? context.surfaceColor
          : context.surfaceLightColor,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 21,
            color: enabled
                ? Theme.of(context).colorScheme.primary
                : context.textSecondaryColor,
          ),
          const SizedBox(height: 5),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: enabled
                  ? context.textPrimaryColor
                  : context.textSecondaryColor,
            ),
          ),
        ],
      ),
    );
  }
}
