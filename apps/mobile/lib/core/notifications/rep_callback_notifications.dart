import 'dart:typed_data';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/timezone.dart' as tz;

import '../providers/app_providers.dart';
import '../sync/clock.dart';
import '../utils/phone.dart';

/// Le geste choisi sur l'alarme système.
enum RepCallbackAction { ouvrir, reporter }

/// Ce que l'alarme rapporte quand on la touche.
typedef RepCallbackTap = ({
  String rappelId,
  String representantId,
  RepCallbackAction action,
});

/// Ce que le système a accordé pour qu'un rappel sonne à l'heure.
typedef RepCallbackPermissions = ({bool notifications, bool alarmesExactes});

/// Avance du pré-rappel sur l'heure convenue.
const Duration kRepCallbackPreAlerte = Duration(minutes: 5);

/// Report du bouton « Plus tard », dans l'app comme sur l'alarme.
const Duration kRepCallbackReport = Duration(minutes: 10);

/// Alarmes système d'un rappel promis pendant un appel (issue CALLBACK).
///
/// DEUX alarmes par rappel : le pré-rappel cinq minutes avant, puis l'heure
/// convenue. Le popup in-app ([RepCallbackDueListener]) rattrape l'écart dès
/// que l'app est ouverte ; ces alarmes-ci couvrent l'app fermée.
class RepCallbackNotifications {
  RepCallbackNotifications({Clock clock = const SystemClock()})
    : _clock = clock,
      _plugin = FlutterLocalNotificationsPlugin();

  /// Canal NEUF, et non l'ancien `rep_callback_reminders` : Android fige
  /// importance, son et vibration à la création d'un canal. L'ancien reste
  /// pour toujours en importance « haute » et avec le son de notification.
  static const String _channelId = 'rep_callback_alarme';
  static const String _channelName = 'Rappels à honorer';

  /// `Settings.System.DEFAULT_ALARM_ALERT_URI` : la sonnerie de réveil de
  /// l'appareil, pas le « ding » des notifications.
  static const String _sonAlarme = 'content://settings/system/alarm_alert';

  static const String _actionOuvrir = 'appeler';
  static const String _actionReporter = 'reporter';

  final Clock _clock;
  final FlutterLocalNotificationsPlugin _plugin;
  bool _initialized = false;

  /// Les deux identifiants système d'un même rappel : pré-rappel, puis heure
  /// convenue. Dérivés de l'identifiant du rappel pour que reprogrammer et
  /// annuler retombent toujours sur les mêmes.
  static (int preAlerte, int heure) notificationIdsFor(String id) {
    final int base = id.hashCode & 0x7ffffffe;
    return (base, base | 1);
  }

  Future<void> initialize({
    required void Function(RepCallbackTap tap) onAction,
  }) async {
    if (_initialized) return;
    _initialized = true;

    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final RepCallbackTap? tap = _lire(response);
        if (tap != null) onAction(tap);
      },
    );

    final NotificationAppLaunchDetails? launch = await _plugin
        .getNotificationAppLaunchDetails();
    final NotificationResponse? auDemarrage = launch?.notificationResponse;
    if (launch?.didNotificationLaunchApp == true && auDemarrage != null) {
      final RepCallbackTap? tap = _lire(auDemarrage);
      if (tap != null) onAction(tap);
    }
  }

  /// Demande ce qu'il faut pour qu'un rappel sonne. Appelée à la programmation
  /// d'un rappel, jamais au démarrage : c'est là que la demande a un sens.
  Future<RepCallbackPermissions> ensurePermissions() async {
    final AndroidFlutterLocalNotificationsPlugin? android = _android;
    if (android == null) {
      return (notifications: true, alarmesExactes: true);
    }
    final bool notifications =
        await android.requestNotificationsPermission() ?? false;
    return (
      notifications: notifications,
      alarmesExactes: await _alarmesExactes(android),
    );
  }

  /// Ouvre le réglage « Notifications plein écran » d'Android 14+. Depuis
  /// cette version l'autorisation n'est plus accordée d'office aux
  /// applications qui ne sont ni réveil ni téléphonie.
  Future<void> requestFullScreenIntent() async {
    await _android?.requestFullScreenIntentPermission();
  }

  Future<void> schedule({
    required String id,
    required String representantId,
    required String fullName,
    required String phoneE164,
    required DateTime at,
  }) async {
    await cancel(id);

    final (int preAlerte, int heure) = notificationIdsFor(id);
    final String qui = '$fullName · ${Phone.format(phoneE164)}';
    final String payload = '$id|$representantId';
    final DateTime avant = at.subtract(kRepCallbackPreAlerte);
    final AndroidScheduleMode mode = await _scheduleMode();

    if (avant.isAfter(_clock.now())) {
      await _plugin.zonedSchedule(
        preAlerte,
        'Rappel dans 5 min',
        qui,
        tz.TZDateTime.from(avant.toUtc(), tz.UTC),
        _details(insistante: false),
        androidScheduleMode: mode,
        payload: payload,
      );
    }
    await _plugin.zonedSchedule(
      heure,
      'À rappeler maintenant',
      qui,
      tz.TZDateTime.from(at.toUtc(), tz.UTC),
      _details(insistante: true),
      androidScheduleMode: mode,
      payload: payload,
    );
  }

  Future<void> cancel(String id) async {
    final (int preAlerte, int heure) = notificationIdsFor(id);
    await _plugin.cancel(preAlerte);
    await _plugin.cancel(heure);
  }

  AndroidFlutterLocalNotificationsPlugin? get _android => _plugin
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();

  Future<bool> _alarmesExactes(
    AndroidFlutterLocalNotificationsPlugin android,
  ) async {
    if (await android.canScheduleExactNotifications() ?? false) return true;
    return await android.requestExactAlarmsPermission() ?? false;
  }

  /// `alarmClock` traverse le mode économie d'énergie et pose l'icône de
  /// réveil ; sans l'autorisation, un rappel approximatif vaut mieux que rien.
  Future<AndroidScheduleMode> _scheduleMode() async {
    final AndroidFlutterLocalNotificationsPlugin? android = _android;
    if (android == null) return AndroidScheduleMode.exactAllowWhileIdle;
    return await android.canScheduleExactNotifications() ?? false
        ? AndroidScheduleMode.alarmClock
        : AndroidScheduleMode.inexactAllowWhileIdle;
  }

  static NotificationDetails _details({required bool insistante}) =>
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription:
              'Alarme d\'un rappel promis pendant un appel. Sonne cinq '
              'minutes avant, puis à l\'heure convenue.',
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.alarm,
          fullScreenIntent: insistante,
          playSound: true,
          sound: const UriAndroidNotificationSound(_sonAlarme),
          audioAttributesUsage: AudioAttributesUsage.alarm,
          enableVibration: true,
          vibrationPattern: _vibration,
          autoCancel: false,
          // `Notification.FLAG_INSISTENT` : à l'heure convenue le son boucle
          // jusqu'à ce que quelqu'un touche l'alarme. Le pré-rappel, lui,
          // sonne une seule fois.
          additionalFlags: insistante ? Int32List.fromList(<int>[4]) : null,
          actions: _actions,
        ),
      );

  static final Int64List _vibration = Int64List.fromList(<int>[
    0,
    600,
    300,
    600,
    300,
    600,
  ]);

  /// Les deux gestes ouvrent l'application : reporter écrit en base et
  /// reprogramme les deux alarmes, ce qu'un récepteur d'arrière-plan ne peut
  /// pas faire sans rouvrir la base sur un second isolat.
  static const List<AndroidNotificationAction> _actions =
      <AndroidNotificationAction>[
        AndroidNotificationAction(
          _actionOuvrir,
          'Appeler maintenant',
          showsUserInterface: true,
        ),
        AndroidNotificationAction(
          _actionReporter,
          'Reporter de 10 min',
          showsUserInterface: true,
        ),
      ];

  /// Les alarmes posées par une version antérieure portaient le seul
  /// identifiant du représentant : elles restent ouvrables, sans report.
  static RepCallbackTap? _lire(NotificationResponse response) {
    final String payload = response.payload ?? '';
    if (payload.isEmpty) return null;
    final int coupure = payload.indexOf('|');
    final String rappelId = coupure < 0 ? '' : payload.substring(0, coupure);
    final String representantId = coupure < 0
        ? payload
        : payload.substring(coupure + 1);
    if (representantId.isEmpty) return null;
    return (
      rappelId: rappelId,
      representantId: representantId,
      action: response.actionId == _actionReporter && rappelId.isNotEmpty
          ? RepCallbackAction.reporter
          : RepCallbackAction.ouvrir,
    );
  }
}

final Provider<RepCallbackNotifications> repCallbackNotificationsProvider =
    Provider<RepCallbackNotifications>(
      (Ref ref) => RepCallbackNotifications(clock: ref.watch(clockProvider)),
    );
