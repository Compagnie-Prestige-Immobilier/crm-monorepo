import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../controllers/invoice_preview_provider.dart';
import '../widgets/invoice/invoice_live_card.dart';
import '../widgets/invoice/invoice_live_controls.dart';

class InvoiceLiveView extends ConsumerWidget {
  const InvoiceLiveView({super.key, required this.orderId});

  final int orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(invoicePreviewProvider(orderId));
    final notifier = ref.read(invoicePreviewProvider(orderId).notifier);
    final hasDocument = state.order != null && state.orderArticles.isNotEmpty;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: const CustomAppBar(
        title: 'Préparer la facture',
        showBackButton: true,
      ),
      body: state.isLoading
          ? const _InvoiceLoadingState()
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.gutter,
                    AppSpacing.sm,
                    AppSpacing.gutter,
                    AppSpacing.sm,
                  ),
                  child: AppStatusBanner(
                    title: hasDocument
                        ? 'Aperçu prêt à vérifier'
                        : 'Facture indisponible',
                    message: hasDocument
                        ? 'Zoomez pour relire les montants, puis choisissez les informations à afficher avant le partage.'
                        : 'Cette commande ne contient aucun article exploitable pour générer une facture.',
                    icon: hasDocument
                        ? Icons.fact_check_outlined
                        : Icons.receipt_long_outlined,
                    tone: hasDocument
                        ? AppStatusTone.info
                        : AppStatusTone.warning,
                  ),
                ),
                Expanded(
                  child: hasDocument
                      ? _InvoiceDocumentViewport(
                          child: InvoiceLiveCard(
                            project: state.orderArticles.first,
                            state: state,
                            formatCurrency: _formatCurrency,
                          ),
                        )
                      : SafeArea(
                          top: false,
                          child: ErrorState(
                            message:
                                'Ajoutez au moins un article à la commande avant de générer sa facture.',
                            onRetry: () =>
                                ref.invalidate(invoicePreviewProvider(orderId)),
                          ),
                        ),
                ),
                if (hasDocument)
                  InvoiceLiveControls(
                    showTaxId: state.showTaxId,
                    showNote: state.showNote,
                    onToggleTaxId: notifier.toggleTaxId,
                    onToggleNote: notifier.toggleNote,
                    onShare: notifier.shareInvoice,
                  ),
              ],
            ),
    );
  }

  String _formatCurrency(double amount) {
    return NumberFormat.currency(
      symbol: 'F CFA',
      decimalDigits: 0,
      locale: 'fr_FR',
    ).format(amount);
  }
}

class _InvoiceDocumentViewport extends StatefulWidget {
  const _InvoiceDocumentViewport({required this.child});

  final Widget child;

  @override
  State<_InvoiceDocumentViewport> createState() =>
      _InvoiceDocumentViewportState();
}

class _InvoiceDocumentViewportState extends State<_InvoiceDocumentViewport> {
  final TransformationController _transformation = TransformationController();

  @override
  void dispose() {
    _transformation.dispose();
    super.dispose();
  }

  void _resetView() {
    _transformation.value = Matrix4.identity();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return ColoredBox(
      color: colorScheme.surfaceContainer,
      child: GestureDetector(
        onDoubleTap: _resetView,
        child: InteractiveViewer(
          transformationController: _transformation,
          boundaryMargin: const EdgeInsets.all(80),
          minScale: 0.55,
          maxScale: 3,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.gutter),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
                    border: Border.all(color: colorScheme.outlineVariant),
                  ),
                  child: widget.child,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InvoiceLoadingState extends StatelessWidget {
  const _InvoiceLoadingState();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Préparation de la facture',
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 280),
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppStatusBanner(
                title: 'Préparation de la facture',
                message:
                    'Nous rassemblons les informations de la commande et de l’atelier.',
                icon: Icons.receipt_long_outlined,
                tone: AppStatusTone.info,
              ),
              SizedBox(height: AppSpacing.md),
              SizedBox.square(
                dimension: 22,
                child: CircularProgressIndicator.adaptive(strokeWidth: 2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
