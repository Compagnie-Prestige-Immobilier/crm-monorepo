import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

part 'notification_service.g.dart';

@Riverpod(keepAlive: true)
Future<NotificationService> notification(Ref ref) async {
  final service = NotificationService();
  await service.init();
  return service;
}

class NotificationService {
  final _notifications = FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    tz.initializeTimeZones();
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings();
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notifications.initialize(settings);

    // Request Android 13+ Permissions
    final androidImplementation = _notifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();

    if (androidImplementation != null) {
      await androidImplementation.requestNotificationsPermission();
    }
  }

  Future<void> showWelcomeNotification() async {
    await _notifications.show(
      0,
      'Bienvenue sur Gnawalma !',
      'Les notifications sont activées pour vous rappeler vos livraisons.',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'welcome_channel',
          'Bienvenue',
          channelDescription: 'Notification de bienvenue',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }

  Future<void> scheduleOrderDueDate({
    required int id,
    required String clientName,
    required DateTime dueDate,
  }) async {
    // Schedule: Due Date - 24h
    final scheduledDate = dueDate.subtract(const Duration(days: 1));

    // Check if date is in the future
    if (scheduledDate.isBefore(DateTime.now())) return;

    await _notifications.zonedSchedule(
      id,
      'Rappel Livraison Demain',
      'La commande de $clientName doit être livrée demain.',
      tz.TZDateTime.from(scheduledDate, tz.local),
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'order_reminders',
          'Rappels de Commandes',
          channelDescription: 'Notifications pour les livraisons proches',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
    );
  }

  Future<void> cancelNotification(int id) async {
    await _notifications.cancel(id);
  }
}
