import 'package:uuid/uuid.dart';

abstract final class Ids {
  static const Uuid _uuid = Uuid();

  static String newId() => _uuid.v7();

  static String newRequestId() => _uuid.v7();
}
