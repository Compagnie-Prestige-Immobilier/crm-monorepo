import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:gnawalma/app/core/navigation/app_navigator.dart';
import 'package:gnawalma/app/data/models/client_model.dart';
import 'package:gnawalma/app/data/models/order_model.dart';
import 'package:gnawalma/app/data/models/project_model.dart';
import 'package:gnawalma/app/data/services/app_space.dart';
import 'package:gnawalma/app/data/services/storage_service.dart';
import 'package:gnawalma/app/init/app_bootstrapper.dart';
import 'package:gnawalma/app/shared/utils/app_logger.dart';
import 'package:gnawalma/app/core/network/session_controller.dart';
import 'package:gnawalma/app/modules/auth/domain/auth_session.dart';
import 'package:gnawalma/app/modules/auth/views/auth_view.dart';
import 'package:gnawalma/app/modules/client/activity/views/client_activity_view.dart';
import 'package:gnawalma/app/modules/client/discovery/views/workshop_detail_view.dart';
import 'package:gnawalma/app/modules/client/favorites/views/client_favorites_view.dart';
import 'package:gnawalma/app/modules/client/map/views/client_map_view.dart';
import 'package:gnawalma/app/modules/client/ranking/views/client_ranking_view.dart';
import 'package:gnawalma/app/modules/client/home/views/client_home_view.dart';
import 'package:gnawalma/app/modules/client/profile/views/client_profile_view.dart';
import 'package:gnawalma/app/modules/client/search/views/client_search_view.dart';
import 'package:gnawalma/app/modules/client/shell/views/client_shell_view.dart';
import 'package:gnawalma/app/modules/clients/views/add_edit_client_view.dart';
import 'package:gnawalma/app/modules/clients/views/add_edit_measurement_view.dart';
import 'package:gnawalma/app/modules/clients/views/client_detail_view.dart';
import 'package:gnawalma/app/modules/clients/views/clients_view.dart';
import 'package:gnawalma/app/modules/dashboard/views/dashboard_view.dart';
import 'package:gnawalma/app/modules/more/views/more_view.dart';
import 'package:gnawalma/app/modules/onboarding/views/onboarding_view.dart';
import 'package:gnawalma/app/modules/onboarding/views/space_selector_view.dart';
import 'package:gnawalma/app/modules/orders/views/add_edit_order_view.dart';
import 'package:gnawalma/app/modules/orders/views/new_order_view.dart';
import 'package:gnawalma/app/modules/orders/views/order_detail_view.dart';
import 'package:gnawalma/app/modules/orders/views/orders_view.dart';
import 'package:gnawalma/app/modules/preferences/views/client_preferences_view.dart';
import 'package:gnawalma/app/modules/preferences/views/preferences_view.dart';
import 'package:gnawalma/app/modules/profile/views/business_profile_view.dart';
import 'package:gnawalma/app/modules/projects/views/add_edit_project_view.dart';
import 'package:gnawalma/app/modules/projects/views/invoice_live_view.dart';
import 'package:gnawalma/app/modules/projects/views/project_detail_view.dart';
import 'package:gnawalma/app/modules/security/views/pin_code_view.dart';
import 'package:gnawalma/app/modules/setup_wizard/views/setup_wizard_view.dart';
import 'package:gnawalma/app/modules/shell/views/shell_view.dart';
import 'package:gnawalma/app/routes/app_pages.dart';
import 'package:gnawalma/app/shared/theme/app_colors.dart';
import 'package:gnawalma/app/shared/theme/app_colors_extensions.dart';
import 'package:gnawalma/app/shared/theme/app_spacing.dart';
import 'package:gnawalma/app/shared/widgets/layouts/polished_page.dart';

class AppRouter {
  static final GoRouter router = GoRouter(
    navigatorKey: AppNavigator.navigatorKey,
    initialLocation: Routes.shell,
    redirect: _redirect,
    errorBuilder: (context, state) =>
        _RouteErrorView(path: state.uri.toString(), error: state.error),
    routes: [
      GoRoute(
        path: Routes.onboarding,
        builder: (context, state) => const OnboardingView(),
      ),
      GoRoute(
        path: Routes.spaceSelector,
        builder: (context, state) => const SpaceSelectorView(),
      ),
      GoRoute(path: Routes.auth, builder: (context, state) => const AuthView()),
      GoRoute(
        path: Routes.setupWizard,
        builder: (context, state) => const SetupWizardView(),
      ),
      GoRoute(
        path: Routes.pinCode,
        builder: (context, state) => PinCodeView(
          mode: (state.extra as Map<String, dynamic>?)?['mode'] ?? 'auth',
        ),
      ),
      GoRoute(
        path: Routes.preferences,
        builder: (context, state) => const PreferencesView(),
      ),
      GoRoute(
        path: Routes.clientPreferences,
        builder: (context, state) => const ClientPreferencesView(),
      ),

      // Atelier workspace. Navigation is integrated into the Scaffold so
      // content is never hidden underneath a floating dock.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            ShellView(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.shell,
                builder: (context, state) => const DashboardView(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.orders,
                builder: (context, state) => const OrdersView(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.clients,
                builder: (context, state) => const ClientsView(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.more,
                builder: (context, state) => const MoreView(),
              ),
            ],
          ),
        ],
      ),

      GoRoute(
        path: '${Routes.clientAtelierDetail}/:id',
        builder: (context, state) =>
            WorkshopDetailView(atelierId: state.pathParameters['id'] ?? ''),
      ),
      // Client workspace. Same shell mechanism as the atelier — both spaces
      // keep their branch stacks in the router rather than one of them holding
      // them in widget state.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            ClientShellView(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.clientShell,
                builder: (context, state) => const ClientHomeView(),
              ),
            ],
          ),
          // L'ordre suit celui des onglets de `ClientShellView` : `goBranch`
          // adresse une branche par son index, donc les deux listes doivent
          // rester alignees.
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.clientMap,
                builder: (context, state) => const ClientMapView(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.clientFavorites,
                builder: (context, state) => const ClientFavoritesView(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.clientActivity,
                builder: (context, state) => const ClientActivityView(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Routes.clientProfile,
                builder: (context, state) => const ClientProfileView(),
              ),
            ],
          ),
        ],
      ),

      GoRoute(
        path: Routes.clientRanking,
        builder: (context, state) => const ClientRankingView(),
      ),

      // Search is pushed from the field on Accueil, not a destination. Back
      // returns to Accueil with its scroll position intact.
      GoRoute(
        path: Routes.clientSearch,
        builder: (context, state) => ClientSearchView(
          initialQuery: state.uri.queryParameters['q'],
          initialSpecialty: state.uri.queryParameters['specialite'],
        ),
      ),
      GoRoute(
        path: Routes.businessProfile,
        builder: (context, state) => const BusinessProfileView(),
      ),
      GoRoute(
        path: Routes.addEditClient,
        builder: (context, state) =>
            AddEditClientView(client: state.extra as ClientModel?),
      ),
      GoRoute(
        path: '${Routes.clientDetail}/:id',
        builder: (context, state) => ClientDetailView(
          clientId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: Routes.addEditMeasurement,
        builder: (context, state) =>
            AddEditMeasurementView(client: state.extra as ClientModel?),
      ),
      GoRoute(
        path: Routes.addEditProject,
        builder: (context, state) =>
            AddEditProjectView(project: state.extra as ProjectModel?),
      ),
      GoRoute(
        path: '${Routes.projectDetail}/:id',
        builder: (context, state) => ProjectDetailView(
          projectId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: '${Routes.orderDetail}/:id',
        builder: (context, state) => OrderDetailView(
          orderId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: Routes.addEditOrder,
        builder: (context, state) =>
            AddEditOrderView(existingOrder: state.extra as OrderModel?),
      ),
      GoRoute(
        path: Routes.newOrder,
        builder: (context, state) =>
            NewOrderView(preSelectedClient: state.extra as ClientModel?),
      ),
      GoRoute(
        path: Routes.invoiceLive,
        builder: (context, state) =>
            InvoiceLiveView(orderId: state.extra as int),
      ),
    ],
  );

  static Future<String?> _redirect(
    BuildContext context,
    GoRouterState state,
  ) async {
    try {
      final storage = StorageService();
      final location = state.matchedLocation;
      final seenOnboarding = await storage.hasSeenOnboarding;

      if (!seenOnboarding) {
        return location == Routes.onboarding ? null : Routes.onboarding;
      }
      if (location == Routes.onboarding) return Routes.spaceSelector;

      final activeSpace = await storage.activeSpace;
      if (activeSpace == null) {
        return location == Routes.spaceSelector ? null : Routes.spaceSelector;
      }
      if (location == Routes.spaceSelector) return null;

      final session = await AppBootstrapper.container.read(
        sessionControllerProvider.future,
      );
      final matchesSpace = _sessionMatchesSpace(session, activeSpace);
      if (location == Routes.auth) {
        if (!matchesSpace) return null;
        return _workspaceEntry(activeSpace, session!);
      }

      if (!matchesSpace) return Routes.auth;

      final isLocked = await storage.isAppLocked;
      if (isLocked && location != Routes.pinCode) return Routes.pinCode;

      if (activeSpace == AppSpace.client && _isAtelierRoot(location)) {
        return Routes.clientShell;
      }
      if (activeSpace == AppSpace.atelier && _isClientRoot(location)) {
        return _workspaceEntry(activeSpace, session!);
      }

      return null;
    } catch (error, stackTrace) {
      // Failing to onboarding sends a fully set-up tailor back to the first-run
      // welcome screen because one storage read threw — which reads as "the app
      // lost my atelier". A redirect that cannot decide should not decide:
      // staying put leaves the user where they already were, and the screen's
      // own error state handles a genuinely missing session.
      AppLogger.e(
        'Route redirect failed, staying on current route',
        error,
        stackTrace,
      );
      return null;
    }
  }

  static bool _sessionMatchesSpace(AuthSession? session, AppSpace activeSpace) {
    if (session == null) return false;
    if (activeSpace == AppSpace.client) return session.role == 'client';
    // 'atelier_staff' used to be listed here. The API can only ever issue
    // 'platform_admin', 'atelier_owner', 'atelier_manager' or 'client'
    // (apps/api/src/auth/auth.types.ts), so that arm was dead — and
    // 'atelier_manager', the role that actually exists, was matched only by
    // coincidence of being listed beside it.
    //
    // 'platform_admin' deliberately matches neither space: it has no atelier
    // and no client record, so every screen here would be empty. The auth
    // screen names that outcome instead of looping.
    return session.role == 'atelier_owner' || session.role == 'atelier_manager';
  }

  static String _workspaceEntry(AppSpace activeSpace, AuthSession session) {
    if (activeSpace == AppSpace.client) return Routes.clientShell;
    return session.ateliers.isEmpty ? Routes.setupWizard : Routes.shell;
  }

  static bool _isAtelierRoot(String location) {
    return location == Routes.shell ||
        location == Routes.orders ||
        location == Routes.clients ||
        location == Routes.more;
  }

  static bool _isClientRoot(String location) {
    return location == Routes.clientShell ||
        location.startsWith('${Routes.clientAtelierDetail}/');
  }
}

class _RouteErrorView extends StatelessWidget {
  const _RouteErrorView({required this.path, this.error});

  final String path;
  final Exception? error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: AppSectionSurface(
                bordered: true,
                showAccent: true,
                accentColor: AppColors.primary,
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.09),
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusSheetTop,
                        ),
                      ),
                      child: const Icon(
                        Icons.explore_off_rounded,
                        size: 42,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      'Cette page est introuvable',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Le lien « $path » est invalide ou la page a été déplacée. Vos données n’ont pas été modifiées.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: context.textSecondaryColor,
                        height: 1.5,
                      ),
                    ),
                    if (error != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: const Text('Informations techniques'),
                        children: [
                          SelectableText(
                            error.toString(),
                            maxLines: 6,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: context.textSecondaryColor),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () =>
                            AppNavigator.offAll(Routes.spaceSelector),
                        icon: const Icon(Icons.home_rounded),
                        label: const Text('Revenir à l’accueil'),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    TextButton.icon(
                      onPressed: AppNavigator.back,
                      icon: const Icon(Icons.arrow_back_rounded),
                      label: const Text('Retour'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
