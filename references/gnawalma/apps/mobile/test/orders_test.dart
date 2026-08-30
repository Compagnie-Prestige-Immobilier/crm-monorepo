import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/models.dart';
import 'package:gnawalma/ui.dart';

Map<String, dynamic> orderJson({required DateTime dueAt, String status = 'en_cours', List<Map<String, dynamic>> payments = const [], Object? totalCfa = 10000}) => {
  'id': 1, 'atelier_id': 1, 'client_id': 1, 'beneficiary_id': null, 'reference': 'CMD-1',
  'measurements': '48 / 108', 'description': null, 'fabric_photo_path': null, 'fabric_photo_url': null,
  'total_cfa': totalCfa, 'status': status, 'due_at': dueAt.toIso8601String(),
  'created_at': null, 'updated_at': null, 'paid_cfa': 0, 'remaining_cfa': 0, 'payments': payments,
};

void main() {
  test('retard : la journée entière compte, pas l\'heure', () {
    final morning = today().add(const Duration(hours: 1));
    expect(decodeOrder(orderJson(dueAt: morning)).isLate, false);
    expect(decodeOrder(orderJson(dueAt: today())).isLate, false);
    expect(decodeOrder(orderJson(dueAt: today().add(const Duration(hours: 23)))).isLate, false);
    expect(decodeOrder(orderJson(dueAt: today().subtract(const Duration(minutes: 1)))).isLate, true);
    expect(decodeOrder(orderJson(dueAt: today().subtract(const Duration(days: 2)))).isLate, true);
  });

  test('retard : seule une commande ouverte est en retard', () {
    final past = today().subtract(const Duration(days: 3));
    expect(decodeOrder(orderJson(dueAt: past, status: 'pret')).isLate, true);
    expect(decodeOrder(orderJson(dueAt: past, status: 'livre')).isLate, false);
    expect(decodeOrder(orderJson(dueAt: past, status: 'annule')).isLate, false);
  });

  test('daysUntil compte des jours calendaires', () {
    expect(daysUntil(today()), 0);
    expect(daysUntil(today().add(const Duration(hours: 23))), 0);
    expect(daysUntil(today().add(const Duration(days: 3))), 3);
    expect(daysUntil(today().subtract(const Duration(days: 1))), -1);
  });

  test('montant facultatif tant qu\'il n\'est pas fixé', () {
    expect(decodeOrder(orderJson(dueAt: today(), totalCfa: null)).hasTotal, false);
    expect(decodeOrder(orderJson(dueAt: today(), totalCfa: null)).totalCfa, 0);
    expect(decodeOrder(orderJson(dueAt: today())).hasTotal, true);
  });

  test('paiements : ordre chronologique, corrections repérées', () {
    final o = decodeOrder(orderJson(dueAt: today(), payments: [
      {'id': 3, 'order_id': 1, 'amount_cfa': -500, 'created_at': '2026-03-02T10:00:00Z', 'correction_of': 1},
      {'id': 1, 'order_id': 1, 'amount_cfa': 5000, 'created_at': '2026-03-01T10:00:00Z'},
      {'id': 2, 'order_id': 1, 'amount_cfa': 2000, 'created_at': '2026-03-01T10:00:00Z'},
    ]));
    expect(o.paymentsChrono.map((p) => p.id).toList(), [1, 2, 3]);
    expect(o.isCorrection(o.paymentsChrono.last), true);
    expect(o.isCorrection(o.paymentsChrono.first), false);
  });

  test('clé d\'idempotence unique', () {
    expect(clientToken(), isNot(clientToken()));
  });

  test('montants en francs CFA', () {
    expect(formatCfa(0), '0 FCFA');
    expect(formatCfa(1500), '1 500 FCFA');
    expect(formatCfa(1250000), '1 250 000 FCFA');
    expect(formatCfa(1500, short: true), '1 500 F');
    expect(formatCfa(-500), '-500 FCFA');
  });

  test('libellé de statut avec repli sur la valeur brute', () {
    expect(orderStatuses['pret'], 'Prêt');
    expect(orderStatuses['inconnu'] ?? 'inconnu', 'inconnu');
  });
}
