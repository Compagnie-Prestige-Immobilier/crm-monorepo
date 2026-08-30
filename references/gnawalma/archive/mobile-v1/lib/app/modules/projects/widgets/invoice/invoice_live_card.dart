import 'package:flutter/material.dart';

import '../../../../data/models/project_model.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../controllers/invoice_preview_provider.dart';
import 'invoice_footer.dart';
import 'invoice_header.dart';
import 'invoice_items_table.dart';
import 'invoice_totals.dart';

class InvoiceLiveCard extends StatelessWidget {
  const InvoiceLiveCard({
    super.key,
    required this.project,
    required this.state,
    required this.formatCurrency,
  });

  final ProjectModel project;
  final InvoicePreviewState state;
  final String Function(double) formatCurrency;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 560),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InvoiceHeader(
            businessProfile: state.businessProfile,
            client: state.client,
            project: project,
            order: state.order,
            brandColor: state.brandColor,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              children: [
                InvoiceItemsTable(
                  articles: state.orderArticles,
                  formatCurrency: formatCurrency,
                  brandColor: state.brandColor,
                ),
                const SizedBox(height: 22),
                InvoiceTotals(
                  project: project,
                  order: state.order,
                  formatCurrency: formatCurrency,
                  brandColor: state.brandColor,
                ),
              ],
            ),
          ),
          InvoiceFooter(
            businessProfile: state.businessProfile,
            showNote: state.showNote,
            showTaxId: state.showTaxId,
            brandColor: state.brandColor,
          ),
        ],
      ),
    );
  }
}
