import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/timezone.dart' as tz;

/// Alarme système d'un rappel promis à un représentant (issue CALLBACK).
///
/// `inexactAllowWhileIdle` et non `exact*` : les modes exacts exigent la
/// permission `SCHEDULE_EXACT_ALARM`, restreinte par Play Store. Un écart de
/// quelques minutes est acceptable pour un rappel commercial ; le popup
/// in-app (`RepCallbackDueListener`) rattrape de toute façon l'écart dès que
/// l'app est ouverte, y compris si l'alarme système a été perdue (redémarrage
/// de l'appareil : aucun réarmement au boot n'est fait ici).
class RepCallbackNotifications {
  RepCallbackNotifications() : _plugin = FlutterLocalNotificationsPlugin();

  static const String _channelId = 'rep_callback_reminders';
  static const String _channelName = 'Rappels représentants';

  final FlutterLocalNotificationsPlugin _plugin;
  bool _initialized = false;

  Future<void> initialize({
    required void Function(String representantId) onTap,
  }) async {
    if (_initialized) return;
    _initialized = true;

    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final String? payload = response.payload;
        if (payload != null && payload.isNotEmpty) onTap(payload);
      },
    );

    final NotificationAppLaunchDetails? launch = await _plugin
        .getNotificationAppLaunchDetails();
    final String? launchPayload = launch?.notificationResponse?.payload;
    if (launch?.didNotificationLaunchApp == true &&
        launchPayload != null &&
        launchPayload.isNotEmpty) {
      onTap(launchPayload);
    }

    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();
  }

  Future<void> schedule({
    required String id,
    required String representantId,
    required String fullName,
    required DateTime at,
  }) async {
    await _plugin.zonedSchedule(
      _notificationId(id),
      'Rappel : $fullName',
      'C\'est l\'heure de rappeler ce représentant.',
      tz.TZDateTime.from(at.toUtc(), tz.UTC),
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription:
              'Rappel programmé après un appel à un représentant.',
          importance: Importance.high,
          priority: Priority.high,
          playSound: true,
          enableVibration: true,
        ),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: representantId,
    );
  }

  Future<void> cancel(String id) => _plugin.cancel(_notificationId(id));

  static int _notificationId(String id) => id.hashCode & 0x7fffffff;
}

final Provider<RepCallbackNotifications> repCallbackNotificationsProvider =
    Provider<RepCallbackNotifications>((Ref ref) => RepCallbackNotifications());
