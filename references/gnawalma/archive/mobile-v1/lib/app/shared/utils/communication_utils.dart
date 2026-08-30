import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/material.dart';
import "../utils/app_feedback.dart";

class CommunicationUtils {
  static String _cleanPhoneNumber(String phoneNumber) {
    // Keep only + and digits
    return phoneNumber.replaceAll(RegExp(r'[^\d+]'), '');
  }

  static Future<void> makePhoneCall(String phoneNumber) async {
    final cleanNumber = _cleanPhoneNumber(phoneNumber);
    final Uri launchUri = Uri(scheme: 'tel', path: cleanNumber);
    try {
      if (await canLaunchUrl(launchUri)) {
        await launchUrl(launchUri);
      } else {
        AppFeedback.showError('Impossible de lancer l\'appel');
      }
    } catch (e) {
      debugPrint('Error launching call: $e');
      AppFeedback.showError('Erreur lors de l\'appel: $e');
    }
  }

  static Future<void> sendSms(String phoneNumber, {String? body}) async {
    final cleanNumber = _cleanPhoneNumber(phoneNumber);
    final Uri launchUri = Uri(
      scheme: 'sms',
      path: cleanNumber,
      queryParameters: body != null ? {'body': body} : null,
    );
    try {
      if (await canLaunchUrl(launchUri)) {
        await launchUrl(launchUri);
      } else {
        AppFeedback.showError('Impossible d\'envoyer le SMS');
      }
    } catch (e) {
      debugPrint('Error launching SMS: $e');
      AppFeedback.showError('Erreur lors de l\'envoi du SMS: $e');
    }
  }

  static Future<void> openWhatsApp(
    String phoneNumber, {
    String? message,
  }) async {
    // WhatsApp requires pure digits for the phone number (with country code)
    String cleanNumber = phoneNumber.replaceAll(RegExp(r'[^\d]'), '');

    // 1. Try native intent (forces app)
    final String intentUrl =
        "whatsapp://send?phone=$cleanNumber${message != null ? "&text=${Uri.encodeComponent(message)}" : ""}";
    final Uri intentUri = Uri.parse(intentUrl);

    // 2. Fallback web URL
    final String webUrl =
        "https://wa.me/$cleanNumber${message != null ? "?text=${Uri.encodeComponent(message)}" : ""}";
    final Uri webUri = Uri.parse(webUrl);

    try {
      if (await canLaunchUrl(intentUri)) {
        await launchUrl(
          intentUri,
          mode: LaunchMode.externalNonBrowserApplication,
        );
      } else {
        // Fallback to web link (might open browser or app if associated)
        if (await canLaunchUrl(webUri)) {
          await launchUrl(webUri, mode: LaunchMode.externalApplication);
        } else {
          debugPrint('WhatsApp not found, falling back to SMS');
          await sendSms(phoneNumber, body: message);
        }
      }
    } catch (e) {
      debugPrint('Error launching WhatsApp: $e');
      // Fallback
      await sendSms(phoneNumber, body: message);
    }
  }
}
