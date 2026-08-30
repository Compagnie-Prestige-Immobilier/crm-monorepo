class DailyTransaction {
  final String clientName;
  final double amount;
  final DateTime time;
  final String orderId;

  DailyTransaction({
    required this.clientName,
    required this.amount,
    required this.time,
    required this.orderId,
  });
}
