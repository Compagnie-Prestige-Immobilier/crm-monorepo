import '../../../shared/utils/amount_input_formatters.dart';
import '../../../shared/utils/app_numbers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../data/models/client_model.dart';
import '../../../data/models/order_model.dart';
import '../../../data/models/project_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/utils/app_money.dart';
import '../../../shared/widgets/forms/custom_dropdown.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../controllers/add_edit_order_provider.dart';
import '../controllers/add_edit_order_state.dart';

class AddEditOrderView extends ConsumerStatefulWidget {
  const AddEditOrderView({super.key, this.existingOrder, this.orderId});

  final OrderModel? existingOrder;
  final int? orderId;

  @override
  ConsumerState<AddEditOrderView> createState() => _AddEditOrderViewState();
}

class _AddEditOrderViewState extends ConsumerState<AddEditOrderView> {
  bool _bypassGuard = false;

  @override
  Widget build(BuildContext context) {
    final provider = addEditOrderProvider(
      existingOrder: widget.existingOrder,
      orderId: widget.orderId,
    );
    final state = ref.watch(provider);
    final notifier = ref.read(provider.notifier);

    if (state.isLoading) {
      return Scaffold(
        backgroundColor: context.backgroundColor,
        appBar: CustomAppBar(
          title: state.isEditMode
              ? 'Modifier la commande'
              : 'Créer une commande',
        ),
        body: const Center(
          child: CircularProgressIndicator.adaptive(strokeWidth: 2),
        ),
      );
    }

    return AnimatedBuilder(
      animation: Listenable.merge([
        notifier.totalAmountController,
        notifier.depositPaidController,
      ]),
      builder: (context, _) {
        final total =
            AppNumbers.tryParse(notifier.totalAmountController.text) ?? 0;
        final deposit =
            AppNumbers.tryParse(notifier.depositPaidController.text) ?? 0;
        // La date de livraison est obligatoire ici comme dans l'assistant :
        // c'est elle qui déclenche les rappels et le calcul des retards, et une
        // commande éditée pouvait jusqu'ici la perdre sans rien signaler.
        final formReady =
            state.selectedClient != null &&
            state.orderDate != null &&
            state.expectedDeliveryDate != null &&
            total > 0 &&
            deposit >= 0 &&
            deposit <= total;
        final remaining = (total - deposit)
            .clamp(0, double.infinity)
            .toDouble();
        final hasUnsavedData = _hasUnsavedData(state, notifier, total, deposit);

        return PopScope(
          canPop: _bypassGuard || state.isSaving || !hasUnsavedData,
          onPopInvokedWithResult: (didPop, result) async {
            if (didPop) return;
            final leave = await _confirmDiscard(context);
            if (leave && context.mounted) {
              setState(() => _bypassGuard = true);
              Navigator.pop(context);
            }
          },
          child: Scaffold(
            backgroundColor: context.backgroundColor,
            appBar: CustomAppBar(
              title: state.isEditMode
                  ? 'Modifier la commande'
                  : 'Créer une commande',
            ),
            bottomNavigationBar: AppStickyActionBar(
              secondary: OutlinedButton(
                onPressed: state.isSaving
                    ? null
                    : () => Navigator.maybePop(context),
                child: const Text('Annuler'),
              ),
              primary: FilledButton.icon(
                onPressed: !formReady || state.isSaving
                    ? null
                    : () async {
                        final success = await notifier.saveOrder();
                        if (success && context.mounted) {
                          setState(() => _bypassGuard = true);
                          Navigator.pop(context);
                        }
                      },
                icon: state.isSaving
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator.adaptive(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            Theme.of(context).colorScheme.onPrimary,
                          ),
                        ),
                      )
                    : const Icon(Icons.check_rounded),
                label: Text(
                  state.isSaving
                      ? 'Enregistrement…'
                      : state.isEditMode
                      ? 'Enregistrer les modifications'
                      : 'Créer la commande',
                ),
              ),
            ),
            body: Form(
              key: notifier.formKey,
              child: ListView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter,
                  AppSpacing.sm,
                  AppSpacing.gutter,
                  AppSpacing.xl,
                ),
                children: [
                  AppPageHeader(
                    title: state.isEditMode
                        ? notifier.orderNumberController.text
                        : 'Nouvelle commande',
                    subtitle: state.isEditMode
                        ? 'Mettez à jour les informations sans modifier l’historique existant.'
                        : 'Renseignez le client, les dates et les montants essentiels.',
                    eyebrow: 'Commande Atelier',
                    padding: const EdgeInsets.fromLTRB(0, 8, 0, AppSpacing.lg),
                  ),
                  _ClientSection(state: state, notifier: notifier),
                  const SizedBox(height: AppSpacing.md),
                  _DatesSection(state: state, notifier: notifier),
                  const SizedBox(height: AppSpacing.md),
                  _FinancialSection(
                    notifier: notifier,
                    total: total,
                    deposit: deposit,
                    remaining: remaining,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _ProjectsSection(state: state, notifier: notifier),
                  const SizedBox(height: AppSpacing.md),
                  AppSectionSurface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const AppSectionHeader(
                          title: 'Note interne',
                          subtitle:
                              'Information visible uniquement par l’atelier',
                          icon: Icons.notes_rounded,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        TextFormField(
                          controller: notifier.notesController,
                          maxLines: 4,
                          textCapitalization: TextCapitalization.sentences,
                          textInputAction: TextInputAction.newline,
                          scrollPadding: const EdgeInsets.only(
                            bottom: AppSpacing.keyboardScrollPadding,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Consignes ou contexte particulier',
                            hintText: 'Ex. client à appeler avant la livraison',
                            alignLabelWithHint: true,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (!formReady) ...[
                    const SizedBox(height: AppSpacing.md),
                    const AppStatusBanner(
                      title: 'Informations à compléter',
                      message:
                          'Client, dates de commande et de livraison, et montant sont requis.',
                      icon: Icons.info_outline_rounded,
                      tone: AppStatusTone.info,
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  bool _hasUnsavedData(
    AddEditOrderState state,
    AddEditOrder notifier,
    double total,
    double deposit,
  ) {
    final notes = notifier.notesController.text.trim();
    final existing = state.existingOrder;
    if (existing == null) {
      return state.selectedClient != null ||
          state.orderDate != null ||
          state.expectedDeliveryDate != null ||
          state.selectedProjects.isNotEmpty ||
          total > 0 ||
          deposit > 0 ||
          notes.isNotEmpty;
    }
    return state.selectedClient?.id != existing.clientId ||
        state.orderDate != existing.orderDate ||
        state.expectedDeliveryDate != existing.expectedDeliveryDate ||
        total != existing.totalAmount ||
        deposit != existing.depositPaid ||
        notes != (existing.notes?.trim() ?? '');
  }

  Future<bool> _confirmDiscard(BuildContext context) async {
    final confirmed = await AppDialogs.showConfirmation(
      title: 'Quitter la commande ?',
      message:
          'Les informations non enregistrées seront perdues. La commande ne sera pas mise à jour.',
      confirmLabel: 'Quitter sans enregistrer',
      cancelLabel: 'Continuer la saisie',
      isDangerous: true,
      icon: Icons.warning_amber_rounded,
    );
    return confirmed ?? false;
  }
}

class _ClientSection extends StatelessWidget {
  const _ClientSection({required this.state, required this.notifier});

  final AddEditOrderState state;
  final AddEditOrder notifier;

  @override
  Widget build(BuildContext context) {
    return AppSectionSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Client',
            subtitle: 'Personne qui commande et règle la prestation',
            icon: Icons.person_outline_rounded,
          ),
          const SizedBox(height: AppSpacing.md),
          CustomDropdown<ClientModel>(
            value: state.selectedClient,
            items: state.availableClients,
            label: 'Sélectionner un client',
            itemLabelBuilder: (client) => client.displayName,
            onChanged: notifier.selectClient,
            prefixIcon: const Icon(Icons.person_search_rounded),
          ),
          if (state.availableClients.isEmpty &&
              state.selectedClient == null) ...[
            const SizedBox(height: AppSpacing.sm),
            const AppStatusBanner(
              title: 'Aucun client disponible',
              message:
                  'Ajoutez d’abord un client depuis l’onglet Clients, puis revenez à cette commande.',
              icon: Icons.person_add_alt_1_rounded,
              tone: AppStatusTone.warning,
            ),
          ],
        ],
      ),
    );
  }
}

class _DatesSection extends StatelessWidget {
  const _DatesSection({required this.state, required this.notifier});

  final AddEditOrderState state;
  final AddEditOrder notifier;

  @override
  Widget build(BuildContext context) {
    final format = DateFormat('EEEE d MMMM yyyy', 'fr');
    return AppSectionSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Planning',
            subtitle: 'Dates utilisées pour les rappels et les retards',
            icon: Icons.event_available_outlined,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppActionTile(
            icon: Icons.today_rounded,
            title: 'Date de commande',
            value: state.orderDate == null
                ? 'À définir'
                : format.format(state.orderDate!),
            onTap: () async {
              final picked = await AppDialogs.pickDate(
                context: context,
                initialDate: state.orderDate ?? DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime(2030),
              );
              if (picked != null) notifier.setOrderDate(picked);
            },
          ),
          const SizedBox(height: AppSpacing.xs),
          AppActionTile(
            icon: Icons.local_shipping_outlined,
            title: 'Livraison prévue',
            value: state.expectedDeliveryDate == null
                ? 'À définir'
                : format.format(state.expectedDeliveryDate!),
            onTap: () async {
              final picked = await AppDialogs.pickDate(
                context: context,
                initialDate:
                    state.expectedDeliveryDate ??
                    DateTime.now().add(const Duration(days: 7)),
                firstDate: DateTime.now(),
                lastDate: DateTime(2030),
              );
              if (picked != null) notifier.setExpectedDeliveryDate(picked);
            },
          ),
        ],
      ),
    );
  }
}

class _FinancialSection extends ConsumerWidget {
  const _FinancialSection({
    required this.notifier,
    required this.total,
    required this.deposit,
    required this.remaining,
  });

  final AddEditOrder notifier;
  final double total;
  final double deposit;
  final double remaining;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    return AppSectionSurface(
      showAccent: true,
      accentColor: Theme.of(context).colorScheme.primary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: 'Montants',
            subtitle: 'Les sommes sont enregistrées en ${money.currency}',
            icon: Icons.payments_outlined,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: notifier.totalAmountController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: amountInputFormatters,
            textInputAction: TextInputAction.next,
            scrollPadding: const EdgeInsets.only(
              bottom: AppSpacing.keyboardScrollPadding,
            ),
            validator: notifier.validateAmount,
            decoration: InputDecoration(
              labelText: 'Montant total',
              prefixIcon: const Icon(Icons.receipt_long_outlined),
              suffixText: money.currency,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextFormField(
            controller: notifier.depositPaidController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: amountInputFormatters,
            textInputAction: TextInputAction.next,
            scrollPadding: const EdgeInsets.only(
              bottom: AppSpacing.keyboardScrollPadding,
            ),
            validator: notifier.validateDeposit,
            decoration: InputDecoration(
              labelText: 'Acompte reçu',
              prefixIcon: const Icon(Icons.account_balance_wallet_outlined),
              suffixText: money.currency,
              helperText: 'Saisissez 0 si aucun paiement n’a été reçu.',
            ),
          ),
          if (total > 0) ...[
            const SizedBox(height: AppSpacing.md),
            AppStatusBanner(
              title: remaining > 0 ? 'Solde restant' : 'Commande soldée',
              message: remaining > 0
                  ? '${money.format(remaining)} restent à encaisser.'
                  : 'L’acompte couvre entièrement le montant de la commande.',
              icon: remaining > 0
                  ? Icons.pending_actions_rounded
                  : Icons.check_circle_outline_rounded,
              tone: remaining > 0
                  ? AppStatusTone.warning
                  : AppStatusTone.success,
            ),
          ],
        ],
      ),
    );
  }
}

class _ProjectsSection extends StatelessWidget {
  const _ProjectsSection({required this.state, required this.notifier});

  final AddEditOrderState state;
  final AddEditOrder notifier;

  @override
  Widget build(BuildContext context) {
    return AppSectionSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: 'Articles associés',
            subtitle: state.selectedProjects.isEmpty
                ? 'Optionnel pour une commande créée manuellement'
                : '${state.selectedProjects.length} article${state.selectedProjects.length > 1 ? 's' : ''} sélectionné${state.selectedProjects.length > 1 ? 's' : ''}',
            icon: Icons.checkroom_outlined,
          ),
          const SizedBox(height: AppSpacing.md),
          if (state.availableProjects.isEmpty)
            const AppStatusBanner(
              title: 'Aucun article disponible',
              message:
                  'Les articles créés hors commande apparaîtront ici pour être rattachés.',
              icon: Icons.inventory_2_outlined,
              tone: AppStatusTone.neutral,
            )
          else
            ...state.availableProjects.map(
              (ProjectModel project) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: CheckboxListTile.adaptive(
                  value: state.selectedProjects.contains(project),
                  onChanged: (_) => notifier.toggleProjectSelection(project),
                  title: Text(
                    project.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: context.textPrimaryColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: Text(
                    project.garmentType,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                  secondary: Icon(
                    project.status.icon,
                    color: project.status.color,
                  ),
                  controlAffinity: ListTileControlAffinity.trailing,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
                    side: BorderSide(
                      color: state.selectedProjects.contains(project)
                          ? Theme.of(
                              context,
                            ).colorScheme.primary.withValues(alpha: .5)
                          : context.borderColor,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
