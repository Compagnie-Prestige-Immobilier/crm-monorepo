import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../controllers/client_detail_provider.dart';
import '../widgets/client_app_bar.dart';
import '../widgets/client_editorial_notes.dart';
import '../widgets/client_measurements_card.dart';
import '../widgets/client_quick_actions.dart';
import '../widgets/client_stats.dart';
import '../widgets/client_wardrobe_section.dart';
import '../../../shared/theme/app_motion.dart';

class ClientDetailView extends ConsumerWidget {
  const ClientDetailView({super.key, required this.clientId});

  final int clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(clientDetailProvider(clientId));
    final notifier = ref.read(clientDetailProvider(clientId).notifier);

    if (state.isLoading) {
      return const _ClientDetailSkeleton();
    }

    final client = state.client;
    if (client == null) {
      return Scaffold(
        backgroundColor: context.backgroundColor,
        appBar: AppBar(
          leading: IconButton(
            tooltip: 'Retour',
            onPressed: AppNavigator.back,
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          title: const Text('Fiche client'),
        ),
        body: SafeArea(
          child: Column(
            children: [
              const Expanded(
                child: ErrorState(
                  message:
                      'Ce client n’existe plus ou ses informations ne sont pas disponibles sur cet appareil.',
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter,
                  0,
                  AppSpacing.gutter,
                  AppSpacing.lg,
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: AppNavigator.back,
                    icon: const Icon(Icons.arrow_back_rounded),
                    label: const Text('Retour'),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: Semantics(
        container: true,
        label: 'Fiche client ${client.displayName}',
        child: RefreshIndicator(
          onRefresh: notifier.refresh,
          edgeOffset: kToolbarHeight + MediaQuery.paddingOf(context).top,
          child: CustomScrollView(
            key: PageStorageKey('client-detail-$clientId'),
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              ClientAppBar(
                client: client,
                onEdit: notifier.navigateToEdit,
                isPreviewMode: state.isPreviewMode,
              ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.xl + MediaQuery.paddingOf(context).bottom,
                ),
                sliver: SliverList(
                  delegate: SliverChildListDelegate.fixed([
                    AppStatusBanner(
                      icon: client.totalOrders > 0
                          ? Icons.handshake_outlined
                          : Icons.person_add_alt_1_rounded,
                      title: client.totalOrders > 0
                          ? 'Relation client active'
                          : 'Nouveau client à accompagner',
                      message: client.totalOrders > 0
                          ? '${client.totalOrders} commande${client.totalOrders == 1 ? '' : 's'} enregistrée${client.totalOrders == 1 ? '' : 's'}. Les actions importantes restent accessibles ci-dessous.'
                          : 'Ajoutez ses mesures ou créez sa première commande pour compléter son dossier.',
                      tone: client.totalOrders > 0
                          ? AppStatusTone.success
                          : AppStatusTone.info,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    AppSectionHeader(
                      title: 'Actions utiles',
                      icon: Icons.bolt_rounded,
                      accentColor: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    ClientQuickActions(
                      client: client,
                      onCall: notifier.callClient,
                      onEmail: notifier.emailClient,
                      onAddMeasurement: notifier.navigateToAddMeasurement,
                      onNewOrder: notifier.navigateToNewOrder,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    ClientStats(client: client),
                    const SizedBox(height: AppSpacing.xl),
                    ClientMeasurementsCard(
                      client: client,
                      onAddMeasurement: notifier.navigateToAddMeasurement,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    ClientWardrobeSection(
                      isLoading: state.isLoadingProjects,
                      projects: state.clientProjects,
                      onProjectTap: notifier.navigateToProject,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    ClientEditorialNotes(client: client),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ClientDetailSkeleton extends StatelessWidget {
  const _ClientDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    Widget pulse(Widget child) => reduceMotion
        ? child
        : child
              .animate(onPlay: (controller) => controller.repeat(reverse: true))
              .fade(begin: .45, end: 1, duration: AppMotion.shimmer);

    Widget bar({double width = double.infinity, double height = 16}) => pulse(
      Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: context.borderColor.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(AppSpacing.radiusSheetTop),
        ),
      ),
    );

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        child: ListView(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.cardPadding),
          children: [
            Row(
              children: [
                const BackButton(),
                const Spacer(),
                pulse(
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: context.surfaceColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: context.borderColor),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              children: [
                pulse(
                  Container(
                    width: 86,
                    height: 86,
                    decoration: BoxDecoration(
                      color: context.borderColor.withValues(alpha: 0.48),
                      borderRadius: BorderRadius.circular(
                        AppSpacing.radiusSheetTop,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      bar(width: 190, height: 24),
                      const SizedBox(height: AppSpacing.sm),
                      bar(width: 142),
                      const SizedBox(height: AppSpacing.sm),
                      bar(width: 94, height: 24),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            for (var index = 0; index < 4; index++) ...[
              AppSectionSurface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    bar(width: 170, height: 20),
                    const SizedBox(height: AppSpacing.md),
                    bar(),
                    const SizedBox(height: AppSpacing.sm),
                    bar(width: 240),
                    const SizedBox(height: AppSpacing.sm),
                    bar(width: 200),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          ],
        ),
      ),
    );
  }
}
