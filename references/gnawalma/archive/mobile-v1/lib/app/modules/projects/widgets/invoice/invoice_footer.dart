import 'package:flutter/material.dart';

import '../../../../data/models/business_profile_model.dart';
import '../../../../shared/theme/app_text_styles.dart';

class InvoiceFooter extends StatelessWidget {
  const InvoiceFooter({
    super.key,
    required this.businessProfile,
    required this.showNote,
    required this.showTaxId,
    this.brandColor,
  });

  final BusinessProfileModel? businessProfile;
  final bool showNote;
  final bool showTaxId;
  final Color? brandColor;

  @override
  Widget build(BuildContext context) {
    final accent = brandColor ?? Colors.black87;
    final note = businessProfile?.footerNote?.trim();
    final taxId = businessProfile?.taxId?.trim();

    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 22, 28, 30),
      child: Column(
        children: [
          Divider(color: Colors.grey.shade200),
          if (showNote && note?.isNotEmpty == true) ...[
            const SizedBox(height: 16),
            Text(
              note!,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodySmall.copyWith(
                color: Colors.grey.shade700,
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: 18),
          Text(
            'Merci pour votre confiance',
            textAlign: TextAlign.center,
            style: AppTextStyles.label.copyWith(color: accent),
          ),
          if (showTaxId && taxId?.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              'NINEA : $taxId',
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(
                color: Colors.grey.shade500,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Text(
            'Document généré avec Gnawalma',
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(color: Colors.grey.shade400),
          ),
        ],
      ),
    );
  }
}
