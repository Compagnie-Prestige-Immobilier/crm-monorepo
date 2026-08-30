import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../shared/utils/app_logger.dart';

import '../../routes/app_router.dart';
import '../../routes/app_routes.dart';

/// AppNavigator - Unified navigation wrapper around go_router
class AppNavigator {
  AppNavigator._();

  //===========================================================================
  // Global Key Navigation (For Controllers/Services without context)
  //===========================================================================

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static BuildContext get _context {
    final ctx = navigatorKey.currentContext;
    if (ctx == null) {
      AppLogger.e("AppNavigator: Navigator Context is null.");
      throw Exception(
        "AppNavigator: Context is null - ensure navigatorKey is set on MaterialApp.router",
      );
    }
    return ctx;
  }

  /// Push a named route onto the stack (Global version)
  static Future<T?>? to<T extends Object?>(
    String routePath, {
    Object? arguments,
  }) {
    AppLogger.i('🚀 AppNavigator.to: $routePath');
    return _context.push<T>(routePath, extra: arguments);
  }

  /// Replace the current route (Global version)
  static void off(String routePath, {Object? arguments}) {
    AppLogger.i('🚀 AppNavigator.off: $routePath');
    try {
      _context.pushReplacement(routePath, extra: arguments);
    } catch (e) {
      // Fallback: Use GoRouter directly
      AppLogger.w('AppNavigator.off: Using GoRouter fallback');
      AppRouter.router.pushReplacement(routePath, extra: arguments);
    }
  }

  /// Clear stack and go to route (Global version)
  static void offAll(String routePath, {Object? arguments}) {
    AppLogger.i('🚀 AppNavigator.offAll: $routePath');
    _context.go(routePath, extra: arguments);
  }

  /// Pop the current route (Global version)
  static void back<T extends Object?>([T? result]) {
    AppLogger.i('🚀 AppNavigator.back (result: $result)');
    try {
      if (_context.canPop()) {
        _context.pop(result);
      } else {
        AppLogger.w('AppNavigator.back: Global context cannot pop');
      }
    } catch (e) {
      AppLogger.e('AppNavigator.back: Error popping global context', e);
      // Fallback to Router if context fails
      if (AppRouter.router.canPop()) {
        AppRouter.router.pop(result);
      }
    }
  }

  //===========================================================================
  // Context-Based Navigation (For Widgets - Type-safe)
  //===========================================================================

  /// Navigate to a route by path
  static void toContext(BuildContext context, String path, {Object? extra}) {
    context.push(path, extra: extra);
  }

  /// Navigate and replace
  static void replaceContext(
    BuildContext context,
    String path, {
    Object? extra,
  }) {
    context.replace(path, extra: extra);
  }

  /// Navigate and clear stack
  static void goContext(BuildContext context, String path, {Object? extra}) {
    context.go(path, extra: extra);
  }

  /// Pop with context
  static void backContext<T>(BuildContext context, [T? result]) {
    if (context.canPop()) {
      context.pop(result);
    } else {
      AppLogger.w('AppNavigator.backContext: Context cannot pop');
    }
  }

  //===========================================================================
  // Type-Safe Route Helpers (Use these from Widgets when possible)
  //===========================================================================

  // Root Routes
  static void toOnboarding(BuildContext context) =>
      goContext(context, AppRoutes.onboarding);
  static void toSetupWizard(BuildContext context) =>
      goContext(context, AppRoutes.setupWizard);

  // Shell Routes (Main tabs)
  static void toDashboard(BuildContext context) =>
      goContext(context, AppRoutes.shell);
  static void toClients(BuildContext context) =>
      goContext(context, AppRoutes.clients);
  static void toMore(BuildContext context) =>
      goContext(context, AppRoutes.more);

  // Client Routes
  static void toClientShell(BuildContext context) =>
      goContext(context, AppRoutes.clientShell);

  // Detail Routes
  static void toProjectDetail(BuildContext context, {required int projectId}) {
    toContext(context, '${AppRoutes.projectDetail}/$projectId');
  }

  static void toClientDetail(BuildContext context, {required int clientId}) {
    toContext(context, '${AppRoutes.clientDetail}/$clientId');
  }

  static void toOrderDetail(BuildContext context, {required int orderId}) {
    toContext(context, '${AppRoutes.orderDetail}/$orderId');
  }

  // Edit/Create Routes
  static void toAddEditProject(BuildContext context, {dynamic extra}) {
    toContext(context, AppRoutes.addEditProject, extra: extra);
  }

  static void toAddEditClient(BuildContext context, {dynamic extra}) {
    toContext(context, AppRoutes.addEditClient, extra: extra);
  }

  static void toAddEditMeasurement(BuildContext context, {dynamic extra}) {
    toContext(context, AppRoutes.addEditMeasurement, extra: extra);
  }

  static void toNewOrder(BuildContext context) =>
      toContext(context, AppRoutes.newOrder);
  static void toAddEditOrder(BuildContext context, {dynamic extra}) =>
      toContext(context, AppRoutes.addEditOrder, extra: extra);
  static void toOrders(BuildContext context) =>
      toContext(context, AppRoutes.orders);

  // Other Routes
  static void toPreferences(BuildContext context) =>
      toContext(context, AppRoutes.preferences);
  static void toBusinessProfile(BuildContext context) =>
      toContext(context, AppRoutes.businessProfile);
  static void toPinCode(BuildContext context) =>
      goContext(context, AppRoutes.pinCode);

  //===========================================================================
  // Utility Methods
  //===========================================================================

  /// Check if can pop
  static bool canPop(BuildContext context) => context.canPop();

  /// Navigate and wait for result
  static Future<T?> toAndWait<T>(
    BuildContext context,
    String path, {
    Object? extra,
  }) {
    return context.push<T>(path, extra: extra);
  }
}
