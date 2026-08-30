import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'models.dart';

final _plugin = FlutterLocalNotificationsPlugin();
final _prefs = SharedPreferencesAsync();

/// Chemin à ouvrir après un tap sur une notification, consommé par le routeur.
final notificationTap = ValueNotifier<String?>(null);

const _dueChannel = AndroidNotificationDetails('echeances', 'Rappels de livraison', channelDescription: 'Rappel la veille de la date de livraison d\'une commande');

// Le décalage sert d'étiquette : cancelDueReminders reconnaît ses notifications à ce seuil.
int _dueNotificationId(int orderId) => orderId + 1000000;

Future<void> initNotifications() async {
  tzdata.initializeTimeZones();
  // Dakar est UTC+0 toute l'année ; le jeu de données allégé omet ce nom.
  tz.setLocalLocation(tz.timeZoneDatabase.locations['Africa/Dakar'] ?? tz.UTC);
  await _plugin.initialize(
    settings: const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
    ),
    onDidReceiveNotificationResponse: (r) => notificationTap.value = r.payload,
  );
  final launch = await _plugin.getNotificationAppLaunchDetails();
  if (launch?.didNotificationLaunchApp == true) notificationTap.value = launch!.notificationResponse?.payload;
}

/// Lecture seule : aucune programmation ne doit déclencher la demande système.
Future<bool> notificationsGranted() async {
  final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  if (android != null) return await android.areNotificationsEnabled() ?? false;
  final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
  if (ios != null) return (await ios.checkPermissions())?.isEnabled ?? false;
  return false;
}

/// Appelée depuis les réglages seulement, après une explication.
Future<bool> requestNotificationPermission() async {
  final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  if (android != null) {
    if (await android.areNotificationsEnabled() == true) return true;
    return await android.requestNotificationsPermission() ?? false;
  }
  final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
  if (ios != null) return await ios.requestPermissions(alert: true, sound: true) ?? false;
  return false;
}

/// Une seule relance par commande : un nouveau créneau remplace l'ancien.
Future<void> scheduleDueReminder({required int id, required String clientName, required DateTime dueAt}) async {
  if (await _prefs.getString('due_reminders') == '0') return;
  final at = tz.TZDateTime(tz.local, dueAt.year, dueAt.month, dueAt.day - 1, 9);
  if (at.isBefore(tz.TZDateTime.now(tz.local))) return;
  if (!await notificationsGranted()) return;
  await _plugin.zonedSchedule(
    id: _dueNotificationId(id),
    title: 'Livraison demain',
    body: 'La commande de $clientName est à livrer demain.',
    payload: '/atelier/commandes/$id',
    scheduledDate: at,
    notificationDetails: const NotificationDetails(android: _dueChannel, iOS: DarwinNotificationDetails()),
    androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
  );
}

Future<void> cancelDueReminder(int id) => _plugin.cancel(id: _dueNotificationId(id));

/// Réactivation du réglage : seules les commandes encore en cours retrouvent un rappel.
Future<void> rescheduleDueReminders(List<Order> orders) async {
  await cancelDueReminders();
  for (final o in orders) {
    if (o.status == 'en_cours') await scheduleDueReminder(id: o.id, clientName: o.clientName, dueAt: o.dueAt);
  }
}

Future<void> cancelDueReminders() async {
  for (final p in await _plugin.pendingNotificationRequests()) {
    if (p.id >= 1000000) await _plugin.cancel(id: p.id);
  }
}
