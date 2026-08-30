import 'package:flutter/material.dart';
import 'package:isar_plus/isar_plus.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/order_model.dart';
import '../../../data/models/business_profile_model.dart';
import '../../../data/services/business_profile_service.dart' as service;
import '../../../data/services/database_service.dart';
import '../../../data/services/invoice_service.dart';
import '../../../shared/services/feedback_service.dart';
import '../../profile/controllers/business_profile_provider.dart';

part 'invoice_preview_provider.g.dart';

class InvoicePreviewState {
  final BusinessProfileModel? businessProfile;
  final ClientModel? client;
  final OrderModel? order;
  final List<ProjectModel> orderArticles;
  final bool isLoading;
  final bool showTaxId;
  final bool showNote;
  final Color? brandColor;

  InvoicePreviewState({
    this.businessProfile,
    this.client,
    this.order,
    this.orderArticles = const [],
    this.isLoading = false,
    this.showTaxId = true,
    this.showNote = true,
    this.brandColor,
  });

  InvoicePreviewState copyWith({
    BusinessProfileModel? businessProfile,
    ClientModel? client,
    OrderModel? order,
    List<ProjectModel>? orderArticles,
    bool? isLoading,
    bool? showTaxId,
    bool? showNote,
    Color? brandColor,
  }) {
    return InvoicePreviewState(
      businessProfile: businessProfile ?? this.businessProfile,
      client: client ?? this.client,
      order: order ?? this.order,
      orderArticles: orderArticles ?? this.orderArticles,
      isLoading: isLoading ?? this.isLoading,
      showTaxId: showTaxId ?? this.showTaxId,
      showNote: showNote ?? this.showNote,
      brandColor: brandColor ?? this.brandColor,
    );
  }
}

@riverpod
class InvoicePreview extends _$InvoicePreview {
  @override
  InvoicePreviewState build(int orderId) {
    Future.microtask(() => _loadData(orderId));
    return InvoicePreviewState();
  }

  Future<void> _loadData(int orderId) async {
    state = state.copyWith(isLoading: true);
    try {
      final profileService = await ref.read(
        service.businessProfileProvider.future,
      );
      final profile = await profileService.getProfile();
      final profileState = ref.read(businessProfileProvider);

      ClientModel? client;
      final isar = await ref.read(databaseProvider.future);

      final order = await isar.orderModels.getAsync(orderId);
      if (order == null) throw 'Commande introuvable';

      if (order.clientId != null) {
        client = await isar.clientModels.getAsync(order.clientId!);
      }

      // Load all associated articles
      final articles = await isar.projectModels
          .where()
          .orderIdEqualTo(orderId)
          .findAllAsync();

      state = state.copyWith(
        businessProfile: profile,
        client: client,
        order: order,
        orderArticles: articles,
        brandColor: profileState.brandColor,
        isLoading: false,
      );
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors du chargement des données: $e');
      state = state.copyWith(isLoading: false);
    }
  }

  void toggleTaxId() => state = state.copyWith(showTaxId: !state.showTaxId);
  void toggleNote() => state = state.copyWith(showNote: !state.showNote);

  Future<void> shareInvoice() async {
    if (state.order == null || state.orderArticles.isEmpty) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showWarning('Commande incomplète');
      return;
    }

    try {
      final invoiceService = await ref.read(invoiceProvider.future);

      await invoiceService.shareInvoice(
        project: state.orderArticles.first,
        order: state.order,
        orderArticles: state.orderArticles,
        client: state.client,
        businessProfile: state.businessProfile,
        showTaxId: state.showTaxId,
        showNote: state.showNote,
      );
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors du partage : $e');
    }
  }
}
