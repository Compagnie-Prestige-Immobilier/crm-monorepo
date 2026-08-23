import 'package:cpi_go/core/push/push_message.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter_test/flutter_test.dart';

/// Les tables de vocabulaire retapées à la main.
///
/// `openapi-config.yaml` demande `enumUnknownDefaultCase: true` **pour** la
/// compatibilité ascendante : un membre ajouté côté serveur doit arriver sans
/// rien casser. Chaque copie manuscrite de ces valeurs annulait cette garantie,
/// et chacune avait déjà divergé.
void main() {
  group('rôles : le miroir suit l\'énumération générée', () {
    test('BANQUE_FINANCE a un libellé, il n\'en avait pas', () {
      expect(
        const AuthState(
          status: AuthStatus.authenticated,
          role: 'BANQUE_FINANCE',
        ).roleLabel,
        isNot('BANQUE_FINANCE'),
        reason: 'un utilisateur de banque voyait la chaîne brute du jeton',
      );
    });

    test('chaque rôle du serveur a son libellé, aucun n\'est inventé', () {
      for (final Role role in Role.values) {
        if (role == Role.unknownDefaultOpenApi) continue;
        final String? label = AuthState(
          status: AuthStatus.authenticated,
          role: role.value,
        ).roleLabel;
        expect(label, isNotNull);
        expect(
          label,
          isNot(role.value),
          reason: '${role.value} doit être traduit, pas rendu brut',
        );
      }
    });

    test('un rôle inconnu se rend tel quel plutôt que de disparaître', () {
      expect(
        const AuthState(
          status: AuthStatus.authenticated,
          role: 'DIRECTEUR',
        ).roleLabel,
        'DIRECTEUR',
      );
      expect(
        const AuthState(status: AuthStatus.authenticated).roleLabel,
        isNull,
      );
    });
  });

  group('phase 2 : une seule définition du vocabulaire', () {
    test('les issues d\'appel viennent de CallOutcome', () {
      expect(
        CallOutcomes.all.toSet(),
        CallOutcome.values
            .where((CallOutcome o) => o != CallOutcome.unknownDefaultOpenApi)
            .map((CallOutcome o) => o.value)
            .toSet(),
      );
      expect(CallOutcomes.all, isNot(contains('unknown_default_open_api')));
    });

    test('les méthodes d\'enrôlement viennent d\'EnrollmentMethod', () {
      expect(
        EnrollmentMethods.all.toSet(),
        EnrollmentMethod.values
            .where(
              (EnrollmentMethod m) =>
                  m != EnrollmentMethod.unknownDefaultOpenApi,
            )
            .map((EnrollmentMethod m) => m.value)
            .toSet(),
      );
    });

    test('les effets qui ferment couvrent exactement les statuts non PENDING', () {
      expect(
        CallEffects.all.toSet(),
        CallOutcomeEffect.values
            .where(
              (CallOutcomeEffect e) =>
                  e != CallOutcomeEffect.unknownDefaultOpenApi,
            )
            .map((CallOutcomeEffect e) => e.value)
            .toSet(),
      );
      // C'est l'EFFET qui ferme un dossier, plus l'issue : un motif ajouté par
      // le client ferme selon son effet, sans qu'aucune liste d'issues ait à le
      // connaître.
      expect(
        CallEffects.closing.map(CallEffects.phase2Status).toSet(),
        Phase2Status.values
            .where(
              (Phase2Status s) =>
                  s != Phase2Status.PENDING &&
                  s != Phase2Status.unknownDefaultOpenApi,
            )
            .map((Phase2Status s) => s.value)
            .toSet(),
      );
      expect(CallEffects.phase2Status(CallEffects.keepOpen), isNull);
      expect(CallEffects.phase2Status(CallEffects.scheduleCallback), isNull);
    });

    test('une issue non terminale ne se convertit PAS en statut de dossier', () {
      // Le vrai défaut : une valeur de `CallOutcome` était écrite telle quelle
      // dans une colonne de `Phase2Status`. Ça ne marchait que parce que trois
      // membres portent le même nom des deux côtés.
      expect(Phase2Statuses.forOutcome(CallOutcomes.callback), isNull);
      expect(Phase2Statuses.forOutcome(CallOutcomes.unreachable), isNull);
      expect(Phase2Statuses.forOutcome(CallOutcomes.other), isNull);
      expect(Phase2Statuses.forOutcome('PENDING'), isNull);
      expect(
        Phase2Statuses.forOutcome(CallOutcomes.methodObtained),
        Phase2Statuses.methodObtained,
      );
    });
  });

  group('push : on ne lit que ce que le serveur émet', () {
    test('title et body du bloc data sont ignorés', () {
      final PushMessage? message = PushMessage.fromData(<String, String>{
        'notificationId': 'n1',
        // Le serveur n'émet JAMAIS ces deux clés. Les lire laissait croire à une
        // source de repli qui n'a jamais existé.
        'title': 'faux titre',
        'body': 'faux corps',
      });
      expect(message, isNotNull);
      expect(message!.title, isEmpty);
      expect(message.body, isEmpty);
    });

    test('le bloc notification, lui, est bien la source', () {
      final PushMessage? message = PushMessage.fromData(
        <String, String>{'notificationId': 'n1'},
        notificationTitle: 'Vrai titre',
        notificationBody: 'Vrai corps',
      );
      expect(message!.title, 'Vrai titre');
      expect(message.body, 'Vrai corps');
    });
  });
}
