import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:printing/printing.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';

class InvoicePreviewView extends StatelessWidget {
  const InvoicePreviewView({
    super.key,
    required this.title,
    required this.buildPdf,
  });

  final String title;
  final Future<Uint8List> Function(PdfPageFormat) buildPdf;

  @override
  Widget build(BuildContext context) {
    final fileName = '${title.trim().replaceAll(RegExp(r'\s+'), '_')}.pdf';

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: CustomAppBar(title: title, showBackButton: true),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                AppSpacing.sm,
                AppSpacing.gutter,
                AppSpacing.sm,
              ),
              child: AppStatusBanner(
                title: 'Document prêt à relire',
                message:
                    'Vérifiez les noms, montants et dates avant de partager.',
                icon: Icons.verified_outlined,
                tone: AppStatusTone.info,
              ),
            ),
            Expanded(
              child: PdfPreview(
                build: buildPdf,
                canChangeOrientation: false,
                canChangePageFormat: false,
                canDebug: false,
                padding: const EdgeInsets.all(AppSpacing.gutter),
                maxPageWidth: MediaQuery.sizeOf(context).width * 0.94,
                pdfFileName: fileName,
                loadingWidget: const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator.adaptive(strokeWidth: 2),
                      SizedBox(height: AppSpacing.md),
                      Text('Génération du document…'),
                    ],
                  ),
                ),
                onError: (context, error) => Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(AppSpacing.gutter),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const AppStatusBanner(
                            title: 'Impossible d’afficher le PDF',
                            message:
                                'Impossible de générer la facture. Revenez en arrière puis réessayez.',
                            icon: Icons.picture_as_pdf_outlined,
                            tone: AppStatusTone.error,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Theme(
                            data: Theme.of(
                              context,
                            ).copyWith(dividerColor: Colors.transparent),
                            child: ExpansionTile(
                              tilePadding: EdgeInsets.zero,
                              childrenPadding: EdgeInsets.zero,
                              title: Text(
                                'Détails techniques',
                                style: Theme.of(context).textTheme.labelLarge,
                              ),
                              children: [
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: SelectableText(
                                    '$error',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
