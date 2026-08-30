import 'dart:io';
import 'dart:typed_data';
import 'package:get_it/get_it.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import '../../routes/app_routes.dart';
import 'package:gnawalma/app/shared/theme/app_colors.dart';
import '../models/project_model.dart';
import '../models/order_model.dart';
import '../models/client_model.dart';
import '../models/business_profile_model.dart';
import 'business_profile_service.dart';
import 'database_service.dart';
import '../../shared/utils/app_logger.dart';
import '../../shared/utils/app_feedback.dart';
import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../core/navigation/app_navigator.dart';

part 'invoice_service.g.dart';

@Riverpod(keepAlive: true)
Future<InvoiceService> invoice(Ref ref) async {
  final profileService = await ref.watch(businessProfileProvider.future);
  final isar = await ref.watch(databaseProvider.future);
  return InvoiceService(profileService, isar);
}

class InvoiceService {
  final BusinessProfileService _businessService;
  final Isar _db;

  InvoiceService([BusinessProfileService? businessService, Isar? db])
    : _businessService = businessService ?? GetIt.I<BusinessProfileService>(),
      _db = db ?? GetIt.I<DatabaseService>().isar;

  Future<void> handleInvoiceAction(ProjectModel project) async {
    if (project.orderId != null) {
      // Redirect to the new Live View with the parent Order ID
      AppNavigator.to(AppRoutes.invoiceLive, arguments: project.orderId);
    } else {
      AppFeedback.showWarning('Cet article n\'est rattaché à aucune commande');
    }
  }

  Future<void> shareInvoice({
    required ProjectModel project,
    OrderModel? order,
    List<ProjectModel> orderArticles = const [],
    required ClientModel? client,
    required BusinessProfileModel? businessProfile,
    required bool showTaxId,
    required bool showNote,
  }) async {
    if (client == null) {
      AppFeedback.showError('Aucun client associé à cette commande');
      return;
    }

    try {
      // 1. Generate PDF with options
      final pdfBytes = await _generateInvoicePdf(
        project,
        PdfPageFormat.a4,
        order: order,
        orderArticles: orderArticles,
        client: client,
        businessProfile: businessProfile,
        showTaxId: showTaxId,
        showNote: showNote,
      );

      // 2. Save to Temp
      final output = await getTemporaryDirectory();
      final orderRef = order?.orderNumber ?? project.name;
      final sanitizedName = orderRef.replaceAll(RegExp(r'[^\w\s]+'), '');
      final file = File('${output.path}/Facture_$sanitizedName.pdf');
      await file.writeAsBytes(pdfBytes);

      // 3. Share with text
      // ignore: deprecated_member_use
      await Share.shareXFiles([
        XFile(file.path),
      ], text: _buildShareMessage(project, order, client, businessProfile));
    } catch (e) {
      AppLogger.e('Error generating/sharing invoice', e);
      AppFeedback.showError('Erreur lors du partage : $e');
    }
  }

  String _buildShareMessage(
    ProjectModel project,
    OrderModel? order,
    ClientModel client,
    BusinessProfileModel? profile,
  ) {
    final amount = NumberFormat.currency(
      symbol: 'F',
      decimalDigits: 0,
      locale: 'fr_FR',
    ).format(order?.remainingBalance ?? project.remainingAmount);

    final orderRef = order?.orderNumber != null
        ? 'n° ${order!.orderNumber}'
        : '"${project.name}"';

    return 'Bonjour ${client.firstName},\n\n'
        'Voici votre facture pour la commande $orderRef.\n'
        'Reste à payer : $amount\n\n'
        'Merci de votre confiance !\n'
        '${profile?.businessName ?? ""}';
  }

  Future<Uint8List> _generateInvoicePdf(
    ProjectModel project,
    PdfPageFormat format, {
    OrderModel? order,
    List<ProjectModel> orderArticles = const [],
    ClientModel? client,
    BusinessProfileModel? businessProfile,
    bool showTaxId = true,
    bool showNote = true,
  }) async {
    // If dependencies not passed (e.g. old calls), load them
    businessProfile ??= await _businessService.getProfile();

    if (client == null) {
      if (project.clientId == null) throw 'Aucun client associé';
      client = await _db.collection<int, ClientModel>().getAsync(
        project.clientId!,
      );
    }
    if (client == null) throw 'Client introuvable';
    final nonNullClient = client;

    final doc = pw.Document();

    // Fonts
    pw.Font font;
    pw.Font fontBold;
    try {
      font = await PdfGoogleFonts.poppinsRegular();
      fontBold = await PdfGoogleFonts.poppinsBold();
    } catch (e) {
      font = pw.Font.courier();
      fontBold = pw.Font.courierBold();
    }

    // Colors
    final brandColorInt =
        businessProfile?.brandColorValue ?? AppColors.primary.toARGB32();
    PdfColor primaryColor = PdfColor.fromInt(brandColorInt);

    final greyLight = PdfColor.fromInt(0xFFF9F9F9);

    pw.ImageProvider? logoImage;

    if (businessProfile?.logoPath != null) {
      final file = File(businessProfile!.logoPath!);
      if (await file.exists()) {
        final imageBytes = await file.readAsBytes();
        logoImage = pw.MemoryImage(imageBytes);
      }
    }

    final articles = orderArticles.isNotEmpty ? orderArticles : [project];
    final total = order?.totalAmount ?? project.estimatedPrice ?? 0.0;
    final advance = order?.depositPaid ?? project.advancePayment ?? 0.0;
    final remaining = order?.remainingBalance ?? project.remainingAmount;

    final currencyFormat = NumberFormat.currency(
      symbol: 'F',
      decimalDigits: 0,
      locale: 'fr_FR',
    );

    doc.addPage(
      pw.Page(
        pageFormat: format,
        margin: pw.EdgeInsets.zero,
        theme: pw.ThemeData.withFont(base: font, bold: fontBold),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              // Header with accent
              pw.Container(
                height: 15,
                decoration: pw.BoxDecoration(color: primaryColor),
              ),
              pw.Padding(
                padding: const pw.EdgeInsets.all(40),
                child: pw.Column(
                  children: [
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            if (logoImage != null)
                              pw.Container(
                                width: 70,
                                height: 70,
                                margin: const pw.EdgeInsets.only(bottom: 15),
                                decoration: pw.BoxDecoration(
                                  image: pw.DecorationImage(
                                    image: logoImage,
                                    fit: pw.BoxFit.contain,
                                  ),
                                ),
                              ),
                            pw.Text(
                              (businessProfile?.businessName ?? 'Mon Atelier')
                                  .toUpperCase(),
                              style: pw.TextStyle(
                                fontSize: 18,
                                fontWeight: pw.FontWeight.bold,
                                color: primaryColor,
                              ),
                            ),
                            pw.SizedBox(height: 5),
                            pw.Text(
                              businessProfile?.address ?? '',
                              style: const pw.TextStyle(fontSize: 9),
                            ),
                            pw.Text(
                              businessProfile?.phone ?? '',
                              style: const pw.TextStyle(fontSize: 9),
                            ),
                            pw.Text(
                              businessProfile?.email ?? '',
                              style: const pw.TextStyle(fontSize: 9),
                            ),
                          ],
                        ),
                        pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.end,
                          children: [
                            pw.Text(
                              'FACTURE',
                              style: pw.TextStyle(
                                fontSize: 32,
                                fontWeight: pw.FontWeight.normal,
                                letterSpacing: 2,
                              ),
                            ),
                            pw.SizedBox(height: 20),
                            _buildPdfMetaRow(
                              'N° FACTURE',
                              order?.orderNumber ?? 'INV-${project.id}',
                              primaryColor,
                            ),
                            _buildPdfMetaRow(
                              'DATE',
                              DateFormat(
                                'dd/MM/yyyy',
                              ).format(order?.orderDate ?? DateTime.now()),
                              primaryColor,
                            ),
                          ],
                        ),
                      ],
                    ),
                    pw.SizedBox(height: 40),
                    // Client Box
                    pw.Container(
                      width: double.infinity,
                      padding: const pw.EdgeInsets.all(15),
                      decoration: pw.BoxDecoration(
                        color: greyLight,
                        border: pw.Border.all(color: PdfColors.grey200),
                        borderRadius: const pw.BorderRadius.all(
                          pw.Radius.circular(5),
                        ),
                      ),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            'FACTURÉ À',
                            style: pw.TextStyle(
                              fontSize: 8,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColors.grey600,
                            ),
                          ),
                          pw.SizedBox(height: 5),
                          pw.Text(
                            '${nonNullClient.firstName} ${nonNullClient.lastName}'
                                .toUpperCase(),
                            style: pw.TextStyle(
                              fontSize: 12,
                              fontWeight: pw.FontWeight.bold,
                            ),
                          ),
                          if (nonNullClient.phone != null)
                            pw.Text(
                              nonNullClient.phone!,
                              style: const pw.TextStyle(fontSize: 10),
                            ),
                        ],
                      ),
                    ),
                    pw.SizedBox(height: 40),
                    // Table
                    _buildPdfTable(
                      articles: articles,
                      currencyFormat: currencyFormat,
                      primaryColor: primaryColor,
                    ),
                    pw.SizedBox(height: 30),
                    // Totals
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.end,
                      children: [
                        pw.Container(
                          width: 220,
                          child: pw.Column(
                            children: [
                              _buildPdfTotalRow(
                                'TOTAL BRUT',
                                total,
                                currencyFormat,
                              ),
                              if (advance > 0)
                                _buildPdfTotalRow(
                                  'ACOMPTE PAYÉ',
                                  advance,
                                  currencyFormat,
                                  isNegative: true,
                                  color: PdfColors.red700,
                                ),
                              pw.SizedBox(height: 10),
                              pw.Container(
                                padding: const pw.EdgeInsets.all(12),
                                decoration: pw.BoxDecoration(
                                  color: primaryColor,
                                  borderRadius: const pw.BorderRadius.all(
                                    pw.Radius.circular(5),
                                  ),
                                ),
                                child: pw.Row(
                                  mainAxisAlignment:
                                      pw.MainAxisAlignment.spaceBetween,
                                  children: [
                                    pw.Text(
                                      'NET À PAYER',
                                      style: pw.TextStyle(
                                        color: PdfColors.white,
                                        fontWeight: pw.FontWeight.bold,
                                        fontSize: 10,
                                      ),
                                    ),
                                    pw.Text(
                                      currencyFormat.format(remaining),
                                      style: pw.TextStyle(
                                        color: PdfColors.white,
                                        fontWeight: pw.FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              pw.Spacer(),
              // Footer
              pw.Container(
                padding: const pw.EdgeInsets.symmetric(
                  vertical: 30,
                  horizontal: 40,
                ),
                child: pw.Column(
                  children: [
                    if (showNote && businessProfile?.footerNote != null)
                      pw.Padding(
                        padding: const pw.EdgeInsets.only(bottom: 15),
                        child: pw.Text(
                          businessProfile!.footerNote!,
                          style: pw.TextStyle(
                            fontSize: 9,
                            fontStyle: pw.FontStyle.italic,
                            color: PdfColors.grey700,
                          ),
                          textAlign: pw.TextAlign.center,
                        ),
                      ),
                    pw.Text(
                      'MERCI POUR VOTRE CONFIANCE !',
                      style: pw.TextStyle(
                        fontSize: 10,
                        fontWeight: pw.FontWeight.bold,
                        color: primaryColor,
                        letterSpacing: 1,
                      ),
                    ),
                    pw.SizedBox(height: 15),
                    if (showTaxId && businessProfile?.taxId != null)
                      pw.Text(
                        'NINEA: ${businessProfile!.taxId}',
                        style: const pw.TextStyle(
                          fontSize: 8,
                          color: PdfColors.grey500,
                        ),
                      ),
                    pw.Text(
                      'GÉNÉRÉ VIA GNAWALMA',
                      style: const pw.TextStyle(
                        fontSize: 7,
                        color: PdfColors.grey400,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );

    return doc.save();
  }

  pw.Widget _buildPdfMetaRow(String label, String value, PdfColor color) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 5),
      child: pw.Row(
        mainAxisSize: pw.MainAxisSize.min,
        children: [
          pw.Text(
            '$label: ',
            style: pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
          ),
          pw.Text(
            value,
            style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
          ),
        ],
      ),
    );
  }

  pw.Widget _buildPdfTable({
    required List<ProjectModel> articles,
    required NumberFormat currencyFormat,
    required PdfColor primaryColor,
  }) {
    return pw.Table(
      columnWidths: {
        0: const pw.FlexColumnWidth(3),
        1: const pw.FlexColumnWidth(1),
        2: const pw.FlexColumnWidth(1),
      },
      children: [
        // Header
        pw.TableRow(
          decoration: pw.BoxDecoration(
            border: pw.Border(
              bottom: pw.BorderSide(color: primaryColor, width: 1.5),
            ),
          ),
          children: [
            pw.Padding(
              padding: const pw.EdgeInsets.all(8),
              child: pw.Text(
                'ARTICLE & DESCRIPTION',
                style: pw.TextStyle(
                  fontSize: 8,
                  fontWeight: pw.FontWeight.bold,
                  color: primaryColor,
                ),
              ),
            ),
            pw.Padding(
              padding: const pw.EdgeInsets.all(8),
              child: pw.Text(
                'TYPE',
                textAlign: pw.TextAlign.center,
                style: pw.TextStyle(
                  fontSize: 8,
                  fontWeight: pw.FontWeight.bold,
                  color: primaryColor,
                ),
              ),
            ),
            pw.Padding(
              padding: const pw.EdgeInsets.all(8),
              child: pw.Text(
                'MONTANT',
                textAlign: pw.TextAlign.right,
                style: pw.TextStyle(
                  fontSize: 8,
                  fontWeight: pw.FontWeight.bold,
                  color: primaryColor,
                ),
              ),
            ),
          ],
        ),
        // Rows
        ...articles.map(
          (item) => pw.TableRow(
            decoration: pw.BoxDecoration(
              border: pw.Border(
                bottom: pw.BorderSide(color: PdfColors.grey100, width: 0.5),
              ),
            ),
            children: [
              pw.Padding(
                padding: const pw.EdgeInsets.all(8),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(
                      item.name.toUpperCase(),
                      style: pw.TextStyle(
                        fontSize: 10,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                    if (item.forWhom != null)
                      pw.Text(
                        'POUR : ${item.forWhom!.toUpperCase()}',
                        style: const pw.TextStyle(
                          fontSize: 7,
                          color: PdfColors.grey500,
                        ),
                      ),
                    pw.SizedBox(height: 2),
                    pw.Text(
                      item.description ?? 'Confection sur mesure.',
                      style: const pw.TextStyle(
                        fontSize: 8,
                        color: PdfColors.grey700,
                      ),
                    ),
                  ],
                ),
              ),
              pw.Padding(
                padding: const pw.EdgeInsets.all(8),
                child: pw.Text(
                  item.garmentType.toUpperCase(),
                  textAlign: pw.TextAlign.center,
                  style: const pw.TextStyle(fontSize: 9),
                ),
              ),
              pw.Padding(
                padding: const pw.EdgeInsets.all(8),
                child: pw.Text(
                  currencyFormat.format(
                    item.actualPrice ?? item.estimatedPrice ?? 0,
                  ),
                  textAlign: pw.TextAlign.right,
                  style: pw.TextStyle(
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  pw.Widget _buildPdfTotalRow(
    String label,
    double amount,
    NumberFormat format, {
    bool isNegative = false,
    PdfColor? color,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 8),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(
            label,
            style: pw.TextStyle(
              fontSize: 8,
              fontWeight: pw.FontWeight.bold,
              color: PdfColors.grey600,
            ),
          ),
          pw.Text(
            '${isNegative ? "- " : ""}${format.format(amount)}',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
              color: color ?? PdfColors.black,
            ),
          ),
        ],
      ),
    );
  }
}
