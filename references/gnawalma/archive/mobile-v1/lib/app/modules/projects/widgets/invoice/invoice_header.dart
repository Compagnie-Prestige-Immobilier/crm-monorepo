import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../data/models/business_profile_model.dart';
import '../../../../data/models/client_model.dart';
import '../../../../data/models/order_model.dart';
import '../../../../data/models/project_model.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/theme/app_spacing.dart';

class InvoiceHeader extends StatelessWidget {
  const InvoiceHeader({
    super.key,
    required this.businessProfile,
    required this.client,
    required this.project,
    this.order,
    this.brandColor,
  });

  final BusinessProfileModel? businessProfile;
  final ClientModel? client;
  final ProjectModel project;
  final OrderModel? order;
  final Color? brandColor;

  @override
  Widget build(BuildContext context) {
    final accent = brandColor ?? AppColors.primary;
    final issuedAt = order?.orderDate ?? project.createdAt;
    final reference = order?.orderNumber ?? 'PROJET-${project.id}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(height: 8, color: accent),
        Padding(
          padding: const EdgeInsets.fromLTRB(28, 28, 28, 22),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 420;
              final identity = _BusinessIdentity(
                profile: businessProfile,
                accent: accent,
              );
              final metadata = _InvoiceMetadata(
                reference: reference,
                issuedAt: issuedAt,
                dueAt: order?.expectedDeliveryDate,
                accent: accent,
              );
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (compact) ...[
                    identity,
                    const SizedBox(height: 24),
                    metadata,
                  ] else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(flex: 3, child: identity),
                        const SizedBox(width: 24),
                        Expanded(flex: 2, child: metadata),
                      ],
                    ),
                  const SizedBox(height: 26),
                  Divider(color: Colors.grey.shade200),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.documentSurface,
                      borderRadius: BorderRadius.circular(
                        AppSpacing.radiusControl,
                      ),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(
                              AppSpacing.radiusControl,
                            ),
                          ),
                          child: Icon(
                            Icons.person_outline_rounded,
                            color: accent,
                            size: 21,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Facturé à',
                                style: AppTextStyles.caption.copyWith(
                                  color: Colors.grey.shade600,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                client?.displayName ?? 'Client non renseigné',
                                style: AppTextStyles.h5.copyWith(
                                  color: Colors.black87,
                                ),
                              ),
                              if (client?.phone?.trim().isNotEmpty == true) ...[
                                const SizedBox(height: 3),
                                Text(
                                  client!.phone!,
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: Colors.grey.shade700,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _BusinessIdentity extends StatelessWidget {
  const _BusinessIdentity({required this.profile, required this.accent});

  final BusinessProfileModel? profile;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (profile?.logoPath?.trim().isNotEmpty == true) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
            child: Image.file(
              File(profile!.logoPath!),
              width: 64,
              height: 64,
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) => _LogoFallback(accent: accent),
            ),
          ),
          const SizedBox(height: 14),
        ] else ...[
          _LogoFallback(accent: accent),
          const SizedBox(height: 14),
        ],
        Text(
          profile?.businessName?.trim().isNotEmpty == true
              ? profile!.businessName!
              : 'Mon atelier',
          style: AppTextStyles.h3.copyWith(
            color: Colors.black87,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        if (profile?.address?.trim().isNotEmpty == true)
          _ContactLine(
            icon: Icons.location_on_outlined,
            value: profile!.address!,
          ),
        if (profile?.phone?.trim().isNotEmpty == true)
          _ContactLine(icon: Icons.phone_outlined, value: profile!.phone!),
        if (profile?.email?.trim().isNotEmpty == true)
          _ContactLine(
            icon: Icons.mail_outline_rounded,
            value: profile!.email!,
          ),
      ],
    );
  }
}

class _LogoFallback extends StatelessWidget {
  const _LogoFallback({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 64,
      height: 64,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
      ),
      child: Icon(Icons.storefront_outlined, color: accent, size: 30),
    );
  }
}

class _ContactLine extends StatelessWidget {
  const _ContactLine({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 15, color: Colors.grey.shade500),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              value,
              style: AppTextStyles.bodySmall.copyWith(
                color: Colors.grey.shade700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InvoiceMetadata extends StatelessWidget {
  const _InvoiceMetadata({
    required this.reference,
    required this.issuedAt,
    required this.dueAt,
    required this.accent,
  });

  final String reference;
  final DateTime issuedAt;
  final DateTime? dueAt;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy', 'fr_FR');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          'Facture',
          textAlign: TextAlign.end,
          style: AppTextStyles.h2.copyWith(
            color: accent,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        _MetaLine(label: 'Référence', value: reference),
        _MetaLine(label: 'Date', value: dateFormat.format(issuedAt)),
        if (dueAt != null)
          _MetaLine(
            label: 'Livraison prévue',
            value: dateFormat.format(dueAt!),
          ),
      ],
    );
  }
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text(
            '$label : ',
            style: AppTextStyles.bodySmall.copyWith(
              color: Colors.grey.shade600,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppTextStyles.bodySmall.copyWith(
                color: Colors.black87,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
