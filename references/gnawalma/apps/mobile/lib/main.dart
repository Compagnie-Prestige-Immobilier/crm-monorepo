import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'api.dart';
import 'notifications.dart';
import 'queries.dart';
import 'router.dart';
import 'session.dart';
import 'ui.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr');
  try { await initNotifications(); } catch (_) {}
  CachedQuery.instance.configFlutter(storage: await CachedStorage.ensureInitialized(), config: queryConfig);
  if (kDebugMode) SemanticsBinding.instance.ensureSemantics();
  final container = ProviderContainer();
  container.read(apiProvider).warmup();
  runApp(UncontrolledProviderScope(container: container, child: const App()));
}

final _forui = {for (final b in Brightness.values) b: buildForuiTheme(b)};

class App extends ConsumerWidget {
  const App({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'Gnawalma',
    routerConfig: ref.watch(routerProvider),
    theme: buildTheme(Brightness.light),
    darkTheme: buildTheme(Brightness.dark),
    themeMode: ref.watch(themeModeProvider),
    locale: const Locale('fr'),
    supportedLocales: const [Locale('fr')],
    localizationsDelegates: const [...GlobalMaterialLocalizations.delegates, FLocalizations.delegate],
    builder: (context, child) => FTheme(data: _forui[Theme.of(context).brightness]!, child: FToaster(child: _Lifecycle(child: child!))),
    debugShowCheckedModeBanner: false,
  );
}

/// Sous le toaster : réveil du serveur au retour d'arrière-plan, et message de session expirée.
class _Lifecycle extends ConsumerStatefulWidget {
  const _Lifecycle({required this.child});
  final Widget child;
  @override
  ConsumerState<_Lifecycle> createState() => _LifecycleState();
}

class _LifecycleState extends ConsumerState<_Lifecycle> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    sessionNotice.addListener(_notice);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    sessionNotice.removeListener(_notice);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    // warmupIfStale relance le ping lui-même ; wakingProvider ne fait que le suivre.
    ref.read(apiProvider).warmupIfStale();
    ref.invalidate(wakingProvider);
  }

  void _notice() {
    final message = sessionNotice.value;
    if (message == null) return;
    sessionNotice.value = null;
    clearCache();
    if (mounted) toast(context, message);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
