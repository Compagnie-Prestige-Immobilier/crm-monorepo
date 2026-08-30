// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_model.dart';

// **************************************************************************
// _IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

extension GetOrderModelCollection on Isar {
  IsarCollection<int, OrderModel> get orderModels => this.collection();
}

final OrderModelSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'OrderModel',
    idName: 'id',
    embedded: false,
    properties: [
      IsarPropertySchema(name: 'orderNumber', type: IsarType.string),
      IsarPropertySchema(name: 'remoteId', type: IsarType.string),
      IsarPropertySchema(name: 'clientId', type: IsarType.long),
      IsarPropertySchema(name: 'orderDate', type: IsarType.dateTime),
      IsarPropertySchema(name: 'expectedDeliveryDate', type: IsarType.dateTime),
      IsarPropertySchema(name: 'actualDeliveryDate', type: IsarType.dateTime),
      IsarPropertySchema(name: 'totalAmount', type: IsarType.double),
      IsarPropertySchema(name: 'depositPaid', type: IsarType.double),
      IsarPropertySchema(name: 'remainingBalance', type: IsarType.double),
      IsarPropertySchema(
        name: 'paymentStatus',
        type: IsarType.byte,

        enumMap: {"unpaid": 0, "partial": 1, "paid": 2},
      ),
      IsarPropertySchema(
        name: 'paymentHistory',
        type: IsarType.objectList,
        target: 'PaymentRecord',
      ),
      IsarPropertySchema(
        name: 'status',
        type: IsarType.byte,

        enumMap: {
          "pending": 0,
          "inProgress": 1,
          "completed": 2,
          "delivered": 3,
          "cancelled": 4,
        },
      ),
      IsarPropertySchema(name: 'isArchived', type: IsarType.bool),
      IsarPropertySchema(name: 'projectIds', type: IsarType.longList),
      IsarPropertySchema(name: 'notes', type: IsarType.string),
      IsarPropertySchema(name: 'createdAt', type: IsarType.dateTime),
      IsarPropertySchema(name: 'updatedAt', type: IsarType.dateTime),
      IsarPropertySchema(name: 'isOverdue', type: IsarType.bool),
      IsarPropertySchema(name: 'daysUntilDelivery', type: IsarType.long),
      IsarPropertySchema(name: 'isFullyPaid', type: IsarType.bool),
      IsarPropertySchema(name: 'paymentProgress', type: IsarType.double),
      IsarPropertySchema(name: 'projectCount', type: IsarType.long),
    ],
    indexes: [
      IsarIndexSchema(
        name: 'clientId',
        properties: ["clientId"],
        unique: false,
        hash: false,
      ),
    ],
  ),
  converter: IsarObjectConverter<int, OrderModel>(
    serialize: serializeOrderModel,
    deserialize: deserializeOrderModel,
    deserializeProperty: deserializeOrderModelProp,
  ),
  getEmbeddedSchemas: () => [PaymentRecordSchema],
);

@isarProtected
int serializeOrderModel(IsarWriter writer, OrderModel object) {
  IsarCore.writeString(writer, 1, object.orderNumber);
  {
    final value = object.remoteId;
    if (value == null) {
      IsarCore.writeNull(writer, 2);
    } else {
      IsarCore.writeString(writer, 2, value);
    }
  }
  IsarCore.writeLong(writer, 3, object.clientId ?? -9223372036854775808);
  IsarCore.writeLong(
    writer,
    4,
    object.orderDate.toUtc().microsecondsSinceEpoch,
  );
  IsarCore.writeLong(
    writer,
    5,
    object.expectedDeliveryDate?.toUtc().microsecondsSinceEpoch ??
        -9223372036854775808,
  );
  IsarCore.writeLong(
    writer,
    6,
    object.actualDeliveryDate?.toUtc().microsecondsSinceEpoch ??
        -9223372036854775808,
  );
  IsarCore.writeDouble(writer, 7, object.totalAmount);
  IsarCore.writeDouble(writer, 8, object.depositPaid);
  IsarCore.writeDouble(writer, 9, object.remainingBalance);
  IsarCore.writeByte(writer, 10, object.paymentStatus.index);
  {
    final list = object.paymentHistory;
    final listWriter = IsarCore.beginList(writer, 11, list.length);
    for (var i = 0; i < list.length; i++) {
      {
        final value = list[i];
        final objectWriter = IsarCore.beginObject(listWriter, i);
        serializePaymentRecord(objectWriter, value);
        IsarCore.endObject(listWriter, objectWriter);
      }
    }
    IsarCore.endList(writer, listWriter);
  }
  IsarCore.writeByte(writer, 12, object.status.index);
  IsarCore.writeBool(writer, 13, value: object.isArchived);
  {
    final list = object.projectIds;
    final listWriter = IsarCore.beginList(writer, 14, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeLong(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  {
    final value = object.notes;
    if (value == null) {
      IsarCore.writeNull(writer, 15);
    } else {
      IsarCore.writeString(writer, 15, value);
    }
  }
  IsarCore.writeLong(
    writer,
    16,
    object.createdAt.toUtc().microsecondsSinceEpoch,
  );
  IsarCore.writeLong(
    writer,
    17,
    object.updatedAt?.toUtc().microsecondsSinceEpoch ?? -9223372036854775808,
  );
  IsarCore.writeBool(writer, 18, value: object.isOverdue);
  IsarCore.writeLong(
    writer,
    19,
    object.daysUntilDelivery ?? -9223372036854775808,
  );
  IsarCore.writeBool(writer, 20, value: object.isFullyPaid);
  IsarCore.writeDouble(writer, 21, object.paymentProgress);
  IsarCore.writeLong(writer, 22, object.projectCount);
  return object.id;
}

@isarProtected
OrderModel deserializeOrderModel(IsarReader reader) {
  final object = OrderModel();
  object.id = IsarCore.readId(reader);
  object.orderNumber = IsarCore.readString(reader, 1) ?? '';
  object.remoteId = IsarCore.readString(reader, 2);
  {
    final value = IsarCore.readLong(reader, 3);
    if (value == -9223372036854775808) {
      object.clientId = null;
    } else {
      object.clientId = value;
    }
  }
  {
    final value = IsarCore.readLong(reader, 4);
    if (value == -9223372036854775808) {
      object.orderDate = DateTime.fromMillisecondsSinceEpoch(
        0,
        isUtc: true,
      ).toLocal();
    } else {
      object.orderDate = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  {
    final value = IsarCore.readLong(reader, 5);
    if (value == -9223372036854775808) {
      object.expectedDeliveryDate = null;
    } else {
      object.expectedDeliveryDate = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  {
    final value = IsarCore.readLong(reader, 6);
    if (value == -9223372036854775808) {
      object.actualDeliveryDate = null;
    } else {
      object.actualDeliveryDate = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  object.totalAmount = IsarCore.readDouble(reader, 7);
  object.depositPaid = IsarCore.readDouble(reader, 8);
  object.remainingBalance = IsarCore.readDouble(reader, 9);
  {
    if (IsarCore.readNull(reader, 10)) {
      object.paymentStatus = PaymentStatus.unpaid;
    } else {
      object.paymentStatus =
          _orderModelPaymentStatus[IsarCore.readByte(reader, 10)] ??
          PaymentStatus.unpaid;
    }
  }
  {
    final length = IsarCore.readList(reader, 11, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.paymentHistory = const <PaymentRecord>[];
      } else {
        final list = List<PaymentRecord>.filled(
          length,
          PaymentRecord(),
          growable: true,
        );
        for (var i = 0; i < length; i++) {
          {
            final objectReader = IsarCore.readObject(reader, i);
            if (objectReader.isNull) {
              list[i] = PaymentRecord();
            } else {
              final embedded = deserializePaymentRecord(objectReader);
              IsarCore.freeReader(objectReader);
              list[i] = embedded;
            }
          }
        }
        IsarCore.freeReader(reader);
        object.paymentHistory = list;
      }
    }
  }
  {
    if (IsarCore.readNull(reader, 12)) {
      object.status = OrderStatus.pending;
    } else {
      object.status =
          _orderModelStatus[IsarCore.readByte(reader, 12)] ??
          OrderStatus.pending;
    }
  }
  object.isArchived = IsarCore.readBool(reader, 13);
  {
    final length = IsarCore.readList(reader, 14, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.projectIds = const <int>[];
      } else {
        final list = List<int>.filled(
          length,
          -9223372036854775808,
          growable: true,
        );
        for (var i = 0; i < length; i++) {
          list[i] = IsarCore.readLong(reader, i);
        }
        IsarCore.freeReader(reader);
        object.projectIds = list;
      }
    }
  }
  object.notes = IsarCore.readString(reader, 15);
  {
    final value = IsarCore.readLong(reader, 16);
    if (value == -9223372036854775808) {
      object.createdAt = DateTime.fromMillisecondsSinceEpoch(
        0,
        isUtc: true,
      ).toLocal();
    } else {
      object.createdAt = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  {
    final value = IsarCore.readLong(reader, 17);
    if (value == -9223372036854775808) {
      object.updatedAt = null;
    } else {
      object.updatedAt = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  return object;
}

@isarProtected
dynamic deserializeOrderModelProp(IsarReader reader, int property) {
  switch (property) {
    case 0:
      return IsarCore.readId(reader);
    case 1:
      return IsarCore.readString(reader, 1) ?? '';
    case 2:
      return IsarCore.readString(reader, 2);
    case 3:
      {
        final value = IsarCore.readLong(reader, 3);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return value;
        }
      }
    case 4:
      {
        final value = IsarCore.readLong(reader, 4);
        if (value == -9223372036854775808) {
          return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true).toLocal();
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 5:
      {
        final value = IsarCore.readLong(reader, 5);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 6:
      {
        final value = IsarCore.readLong(reader, 6);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 7:
      return IsarCore.readDouble(reader, 7);
    case 8:
      return IsarCore.readDouble(reader, 8);
    case 9:
      return IsarCore.readDouble(reader, 9);
    case 10:
      {
        if (IsarCore.readNull(reader, 10)) {
          return PaymentStatus.unpaid;
        } else {
          return _orderModelPaymentStatus[IsarCore.readByte(reader, 10)] ??
              PaymentStatus.unpaid;
        }
      }
    case 11:
      {
        final length = IsarCore.readList(reader, 11, IsarCore.readerPtrPtr);
        {
          final reader = IsarCore.readerPtr;
          if (reader.isNull) {
            return const <PaymentRecord>[];
          } else {
            final list = List<PaymentRecord>.filled(
              length,
              PaymentRecord(),
              growable: true,
            );
            for (var i = 0; i < length; i++) {
              {
                final objectReader = IsarCore.readObject(reader, i);
                if (objectReader.isNull) {
                  list[i] = PaymentRecord();
                } else {
                  final embedded = deserializePaymentRecord(objectReader);
                  IsarCore.freeReader(objectReader);
                  list[i] = embedded;
                }
              }
            }
            IsarCore.freeReader(reader);
            return list;
          }
        }
      }
    case 12:
      {
        if (IsarCore.readNull(reader, 12)) {
          return OrderStatus.pending;
        } else {
          return _orderModelStatus[IsarCore.readByte(reader, 12)] ??
              OrderStatus.pending;
        }
      }
    case 13:
      return IsarCore.readBool(reader, 13);
    case 14:
      {
        final length = IsarCore.readList(reader, 14, IsarCore.readerPtrPtr);
        {
          final reader = IsarCore.readerPtr;
          if (reader.isNull) {
            return const <int>[];
          } else {
            final list = List<int>.filled(
              length,
              -9223372036854775808,
              growable: true,
            );
            for (var i = 0; i < length; i++) {
              list[i] = IsarCore.readLong(reader, i);
            }
            IsarCore.freeReader(reader);
            return list;
          }
        }
      }
    case 15:
      return IsarCore.readString(reader, 15);
    case 16:
      {
        final value = IsarCore.readLong(reader, 16);
        if (value == -9223372036854775808) {
          return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true).toLocal();
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 17:
      {
        final value = IsarCore.readLong(reader, 17);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 18:
      return IsarCore.readBool(reader, 18);
    case 19:
      {
        final value = IsarCore.readLong(reader, 19);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return value;
        }
      }
    case 20:
      return IsarCore.readBool(reader, 20);
    case 21:
      return IsarCore.readDouble(reader, 21);
    case 22:
      return IsarCore.readLong(reader, 22);
    default:
      throw ArgumentError('Unknown property: $property');
  }
}

sealed class _OrderModelUpdate {
  bool call({
    required int id,
    String? orderNumber,
    String? remoteId,
    int? clientId,
    DateTime? orderDate,
    DateTime? expectedDeliveryDate,
    DateTime? actualDeliveryDate,
    double? totalAmount,
    double? depositPaid,
    double? remainingBalance,
    PaymentStatus? paymentStatus,
    OrderStatus? status,
    bool? isArchived,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isOverdue,
    int? daysUntilDelivery,
    bool? isFullyPaid,
    double? paymentProgress,
    int? projectCount,
  });
}

class _OrderModelUpdateImpl implements _OrderModelUpdate {
  const _OrderModelUpdateImpl(this.collection);

  final IsarCollection<int, OrderModel> collection;

  @override
  bool call({
    required int id,
    Object? orderNumber = ignore,
    Object? remoteId = ignore,
    Object? clientId = ignore,
    Object? orderDate = ignore,
    Object? expectedDeliveryDate = ignore,
    Object? actualDeliveryDate = ignore,
    Object? totalAmount = ignore,
    Object? depositPaid = ignore,
    Object? remainingBalance = ignore,
    Object? paymentStatus = ignore,
    Object? status = ignore,
    Object? isArchived = ignore,
    Object? notes = ignore,
    Object? createdAt = ignore,
    Object? updatedAt = ignore,
    Object? isOverdue = ignore,
    Object? daysUntilDelivery = ignore,
    Object? isFullyPaid = ignore,
    Object? paymentProgress = ignore,
    Object? projectCount = ignore,
  }) {
    return collection.updateProperties(
          [id],
          {
            if (orderNumber != ignore) 1: orderNumber as String?,
            if (remoteId != ignore) 2: remoteId as String?,
            if (clientId != ignore) 3: clientId as int?,
            if (orderDate != ignore) 4: orderDate as DateTime?,
            if (expectedDeliveryDate != ignore)
              5: expectedDeliveryDate as DateTime?,
            if (actualDeliveryDate != ignore)
              6: actualDeliveryDate as DateTime?,
            if (totalAmount != ignore) 7: totalAmount as double?,
            if (depositPaid != ignore) 8: depositPaid as double?,
            if (remainingBalance != ignore) 9: remainingBalance as double?,
            if (paymentStatus != ignore) 10: paymentStatus as PaymentStatus?,
            if (status != ignore) 12: status as OrderStatus?,
            if (isArchived != ignore) 13: isArchived as bool?,
            if (notes != ignore) 15: notes as String?,
            if (createdAt != ignore) 16: createdAt as DateTime?,
            if (updatedAt != ignore) 17: updatedAt as DateTime?,
            if (isOverdue != ignore) 18: isOverdue as bool?,
            if (daysUntilDelivery != ignore) 19: daysUntilDelivery as int?,
            if (isFullyPaid != ignore) 20: isFullyPaid as bool?,
            if (paymentProgress != ignore) 21: paymentProgress as double?,
            if (projectCount != ignore) 22: projectCount as int?,
          },
        ) >
        0;
  }
}

sealed class _OrderModelUpdateAll {
  int call({
    required List<int> id,
    String? orderNumber,
    String? remoteId,
    int? clientId,
    DateTime? orderDate,
    DateTime? expectedDeliveryDate,
    DateTime? actualDeliveryDate,
    double? totalAmount,
    double? depositPaid,
    double? remainingBalance,
    PaymentStatus? paymentStatus,
    OrderStatus? status,
    bool? isArchived,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isOverdue,
    int? daysUntilDelivery,
    bool? isFullyPaid,
    double? paymentProgress,
    int? projectCount,
  });
}

class _OrderModelUpdateAllImpl implements _OrderModelUpdateAll {
  const _OrderModelUpdateAllImpl(this.collection);

  final IsarCollection<int, OrderModel> collection;

  @override
  int call({
    required List<int> id,
    Object? orderNumber = ignore,
    Object? remoteId = ignore,
    Object? clientId = ignore,
    Object? orderDate = ignore,
    Object? expectedDeliveryDate = ignore,
    Object? actualDeliveryDate = ignore,
    Object? totalAmount = ignore,
    Object? depositPaid = ignore,
    Object? remainingBalance = ignore,
    Object? paymentStatus = ignore,
    Object? status = ignore,
    Object? isArchived = ignore,
    Object? notes = ignore,
    Object? createdAt = ignore,
    Object? updatedAt = ignore,
    Object? isOverdue = ignore,
    Object? daysUntilDelivery = ignore,
    Object? isFullyPaid = ignore,
    Object? paymentProgress = ignore,
    Object? projectCount = ignore,
  }) {
    return collection.updateProperties(id, {
      if (orderNumber != ignore) 1: orderNumber as String?,
      if (remoteId != ignore) 2: remoteId as String?,
      if (clientId != ignore) 3: clientId as int?,
      if (orderDate != ignore) 4: orderDate as DateTime?,
      if (expectedDeliveryDate != ignore) 5: expectedDeliveryDate as DateTime?,
      if (actualDeliveryDate != ignore) 6: actualDeliveryDate as DateTime?,
      if (totalAmount != ignore) 7: totalAmount as double?,
      if (depositPaid != ignore) 8: depositPaid as double?,
      if (remainingBalance != ignore) 9: remainingBalance as double?,
      if (paymentStatus != ignore) 10: paymentStatus as PaymentStatus?,
      if (status != ignore) 12: status as OrderStatus?,
      if (isArchived != ignore) 13: isArchived as bool?,
      if (notes != ignore) 15: notes as String?,
      if (createdAt != ignore) 16: createdAt as DateTime?,
      if (updatedAt != ignore) 17: updatedAt as DateTime?,
      if (isOverdue != ignore) 18: isOverdue as bool?,
      if (daysUntilDelivery != ignore) 19: daysUntilDelivery as int?,
      if (isFullyPaid != ignore) 20: isFullyPaid as bool?,
      if (paymentProgress != ignore) 21: paymentProgress as double?,
      if (projectCount != ignore) 22: projectCount as int?,
    });
  }
}

extension OrderModelUpdate on IsarCollection<int, OrderModel> {
  _OrderModelUpdate get update => _OrderModelUpdateImpl(this);

  _OrderModelUpdateAll get updateAll => _OrderModelUpdateAllImpl(this);
}

sealed class _OrderModelQueryUpdate {
  int call({
    String? orderNumber,
    String? remoteId,
    int? clientId,
    DateTime? orderDate,
    DateTime? expectedDeliveryDate,
    DateTime? actualDeliveryDate,
    double? totalAmount,
    double? depositPaid,
    double? remainingBalance,
    PaymentStatus? paymentStatus,
    OrderStatus? status,
    bool? isArchived,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isOverdue,
    int? daysUntilDelivery,
    bool? isFullyPaid,
    double? paymentProgress,
    int? projectCount,
  });
}

class _OrderModelQueryUpdateImpl implements _OrderModelQueryUpdate {
  const _OrderModelQueryUpdateImpl(this.query, {this.limit});

  final IsarQuery<OrderModel> query;
  final int? limit;

  @override
  int call({
    Object? orderNumber = ignore,
    Object? remoteId = ignore,
    Object? clientId = ignore,
    Object? orderDate = ignore,
    Object? expectedDeliveryDate = ignore,
    Object? actualDeliveryDate = ignore,
    Object? totalAmount = ignore,
    Object? depositPaid = ignore,
    Object? remainingBalance = ignore,
    Object? paymentStatus = ignore,
    Object? status = ignore,
    Object? isArchived = ignore,
    Object? notes = ignore,
    Object? createdAt = ignore,
    Object? updatedAt = ignore,
    Object? isOverdue = ignore,
    Object? daysUntilDelivery = ignore,
    Object? isFullyPaid = ignore,
    Object? paymentProgress = ignore,
    Object? projectCount = ignore,
  }) {
    return query.updateProperties(limit: limit, {
      if (orderNumber != ignore) 1: orderNumber as String?,
      if (remoteId != ignore) 2: remoteId as String?,
      if (clientId != ignore) 3: clientId as int?,
      if (orderDate != ignore) 4: orderDate as DateTime?,
      if (expectedDeliveryDate != ignore) 5: expectedDeliveryDate as DateTime?,
      if (actualDeliveryDate != ignore) 6: actualDeliveryDate as DateTime?,
      if (totalAmount != ignore) 7: totalAmount as double?,
      if (depositPaid != ignore) 8: depositPaid as double?,
      if (remainingBalance != ignore) 9: remainingBalance as double?,
      if (paymentStatus != ignore) 10: paymentStatus as PaymentStatus?,
      if (status != ignore) 12: status as OrderStatus?,
      if (isArchived != ignore) 13: isArchived as bool?,
      if (notes != ignore) 15: notes as String?,
      if (createdAt != ignore) 16: createdAt as DateTime?,
      if (updatedAt != ignore) 17: updatedAt as DateTime?,
      if (isOverdue != ignore) 18: isOverdue as bool?,
      if (daysUntilDelivery != ignore) 19: daysUntilDelivery as int?,
      if (isFullyPaid != ignore) 20: isFullyPaid as bool?,
      if (paymentProgress != ignore) 21: paymentProgress as double?,
      if (projectCount != ignore) 22: projectCount as int?,
    });
  }
}

extension OrderModelQueryUpdate on IsarQuery<OrderModel> {
  _OrderModelQueryUpdate get updateFirst =>
      _OrderModelQueryUpdateImpl(this, limit: 1);

  _OrderModelQueryUpdate get updateAll => _OrderModelQueryUpdateImpl(this);
}

class _OrderModelQueryBuilderUpdateImpl implements _OrderModelQueryUpdate {
  const _OrderModelQueryBuilderUpdateImpl(this.query, {this.limit});

  final QueryBuilder<OrderModel, OrderModel, QOperations> query;
  final int? limit;

  @override
  int call({
    Object? orderNumber = ignore,
    Object? remoteId = ignore,
    Object? clientId = ignore,
    Object? orderDate = ignore,
    Object? expectedDeliveryDate = ignore,
    Object? actualDeliveryDate = ignore,
    Object? totalAmount = ignore,
    Object? depositPaid = ignore,
    Object? remainingBalance = ignore,
    Object? paymentStatus = ignore,
    Object? status = ignore,
    Object? isArchived = ignore,
    Object? notes = ignore,
    Object? createdAt = ignore,
    Object? updatedAt = ignore,
    Object? isOverdue = ignore,
    Object? daysUntilDelivery = ignore,
    Object? isFullyPaid = ignore,
    Object? paymentProgress = ignore,
    Object? projectCount = ignore,
  }) {
    final q = query.build();
    try {
      return q.updateProperties(limit: limit, {
        if (orderNumber != ignore) 1: orderNumber as String?,
        if (remoteId != ignore) 2: remoteId as String?,
        if (clientId != ignore) 3: clientId as int?,
        if (orderDate != ignore) 4: orderDate as DateTime?,
        if (expectedDeliveryDate != ignore)
          5: expectedDeliveryDate as DateTime?,
        if (actualDeliveryDate != ignore) 6: actualDeliveryDate as DateTime?,
        if (totalAmount != ignore) 7: totalAmount as double?,
        if (depositPaid != ignore) 8: depositPaid as double?,
        if (remainingBalance != ignore) 9: remainingBalance as double?,
        if (paymentStatus != ignore) 10: paymentStatus as PaymentStatus?,
        if (status != ignore) 12: status as OrderStatus?,
        if (isArchived != ignore) 13: isArchived as bool?,
        if (notes != ignore) 15: notes as String?,
        if (createdAt != ignore) 16: createdAt as DateTime?,
        if (updatedAt != ignore) 17: updatedAt as DateTime?,
        if (isOverdue != ignore) 18: isOverdue as bool?,
        if (daysUntilDelivery != ignore) 19: daysUntilDelivery as int?,
        if (isFullyPaid != ignore) 20: isFullyPaid as bool?,
        if (paymentProgress != ignore) 21: paymentProgress as double?,
        if (projectCount != ignore) 22: projectCount as int?,
      });
    } finally {
      q.close();
    }
  }
}

extension OrderModelQueryBuilderUpdate
    on QueryBuilder<OrderModel, OrderModel, QOperations> {
  _OrderModelQueryUpdate get updateFirst =>
      _OrderModelQueryBuilderUpdateImpl(this, limit: 1);

  _OrderModelQueryUpdate get updateAll =>
      _OrderModelQueryBuilderUpdateImpl(this);
}

const _orderModelPaymentStatus = {
  0: PaymentStatus.unpaid,
  1: PaymentStatus.partial,
  2: PaymentStatus.paid,
};
const _orderModelStatus = {
  0: OrderStatus.pending,
  1: OrderStatus.inProgress,
  2: OrderStatus.completed,
  3: OrderStatus.delivered,
  4: OrderStatus.cancelled,
};

extension OrderModelQueryFilter
    on QueryBuilder<OrderModel, OrderModel, QFilterCondition> {
  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> idEqualTo(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> idGreaterThan(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  idGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> idLessThan(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 0, value: value));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  idLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> idBetween(
    int lower,
    int upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 0, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 1,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 1,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 1,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberBetween(String lower, String upper, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 1,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 1,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 1,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 1,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 1,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderNumberIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> remoteIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 2));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remoteIdIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 2));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> remoteIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remoteIdGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 2,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remoteIdGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 2,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> remoteIdLessThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remoteIdLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 2,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> remoteIdBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 2,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remoteIdStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 2,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> remoteIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 2,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> remoteIdContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 2,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> remoteIdMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 2,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remoteIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remoteIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> clientIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  clientIdIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> clientIdEqualTo(
    int? value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  clientIdGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 3, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  clientIdGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 3, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> clientIdLessThan(
    int? value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 3, value: value));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  clientIdLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 3, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> clientIdBetween(
    int? lower,
    int? upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 3, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> orderDateEqualTo(
    DateTime value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderDateGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 4, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderDateGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 4, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> orderDateLessThan(
    DateTime value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 4, value: value));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  orderDateLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 4, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> orderDateBetween(
    DateTime lower,
    DateTime upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 4, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  expectedDeliveryDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  expectedDeliveryDateIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  expectedDeliveryDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  expectedDeliveryDateGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  expectedDeliveryDateGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  expectedDeliveryDateLessThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 5, value: value));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  expectedDeliveryDateLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  expectedDeliveryDateBetween(DateTime? lower, DateTime? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 5, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  actualDeliveryDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  actualDeliveryDateIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  actualDeliveryDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 6, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  actualDeliveryDateGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 6, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  actualDeliveryDateGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 6, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  actualDeliveryDateLessThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 6, value: value));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  actualDeliveryDateLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 6, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  actualDeliveryDateBetween(DateTime? lower, DateTime? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 6, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  totalAmountEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  totalAmountGreaterThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  totalAmountGreaterThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  totalAmountLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  totalAmountLessThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  totalAmountBetween(
    double lower,
    double upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 7,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  depositPaidEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  depositPaidGreaterThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  depositPaidGreaterThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  depositPaidLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  depositPaidLessThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  depositPaidBetween(
    double lower,
    double upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 8,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remainingBalanceEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remainingBalanceGreaterThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remainingBalanceGreaterThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remainingBalanceLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remainingBalanceLessThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  remainingBalanceBetween(
    double lower,
    double upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 9,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentStatusEqualTo(PaymentStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 10, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentStatusGreaterThan(PaymentStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 10, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentStatusGreaterThanOrEqualTo(PaymentStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 10, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentStatusLessThan(PaymentStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 10, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentStatusLessThanOrEqualTo(PaymentStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 10, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentStatusBetween(PaymentStatus lower, PaymentStatus upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 10, lower: lower.index, upper: upper.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentHistoryIsEmpty() {
    return not().paymentHistoryIsNotEmpty();
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentHistoryIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 11, value: null),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> statusEqualTo(
    OrderStatus value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 12, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> statusGreaterThan(
    OrderStatus value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 12, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  statusGreaterThanOrEqualTo(OrderStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 12, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> statusLessThan(
    OrderStatus value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 12, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  statusLessThanOrEqualTo(OrderStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 12, value: value.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> statusBetween(
    OrderStatus lower,
    OrderStatus upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 12, lower: lower.index, upper: upper.index),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> isArchivedEqualTo(
    bool value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectIdsElementEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectIdsElementGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectIdsElementGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectIdsElementLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectIdsElementLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectIdsElementBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 14, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectIdsIsEmpty() {
    return not().projectIdsIsNotEmpty();
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectIdsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 14, value: null),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 15));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 15));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 15,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesGreaterThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 15,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  notesGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 15,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesLessThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 15, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  notesLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 15,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 15,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 15,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 15,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 15,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 15,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 15, value: ''),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 15, value: ''),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> createdAtEqualTo(
    DateTime value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  createdAtGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  createdAtGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> createdAtLessThan(
    DateTime value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  createdAtLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> createdAtBetween(
    DateTime lower,
    DateTime upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 16, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  updatedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 17));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  updatedAtIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 17));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> updatedAtEqualTo(
    DateTime? value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  updatedAtGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  updatedAtGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> updatedAtLessThan(
    DateTime? value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  updatedAtLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> updatedAtBetween(
    DateTime? lower,
    DateTime? upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 17, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> isOverdueEqualTo(
    bool value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 18, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  daysUntilDeliveryIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 19));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  daysUntilDeliveryIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 19));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  daysUntilDeliveryEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  daysUntilDeliveryGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  daysUntilDeliveryGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  daysUntilDeliveryLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  daysUntilDeliveryLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  daysUntilDeliveryBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 19, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  isFullyPaidEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 20, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentProgressEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 21, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentProgressGreaterThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 21, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentProgressGreaterThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 21, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentProgressLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 21, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentProgressLessThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 21, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  paymentProgressBetween(
    double lower,
    double upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 21,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectCountEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 22, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectCountGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 22, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectCountGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 22, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectCountLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 22, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectCountLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 22, value: value),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
  projectCountBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 22, lower: lower, upper: upper),
      );
    });
  }
}

extension OrderModelQueryObject
    on QueryBuilder<OrderModel, OrderModel, QFilterCondition> {}

extension OrderModelQuerySortBy
    on QueryBuilder<OrderModel, OrderModel, QSortBy> {
  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByOrderNumber({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByOrderNumberDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByRemoteId({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByRemoteIdDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByClientIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByOrderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByOrderDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  sortByExpectedDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  sortByExpectedDeliveryDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  sortByActualDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  sortByActualDeliveryDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByTotalAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByTotalAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByDepositPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByDepositPaidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByRemainingBalance() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  sortByRemainingBalanceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByPaymentStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByPaymentStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIsArchived() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIsArchivedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByNotesDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIsOverdue() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIsOverdueDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByDaysUntilDelivery() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  sortByDaysUntilDeliveryDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIsFullyPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(20);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIsFullyPaidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(20, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByPaymentProgress() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(21);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  sortByPaymentProgressDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(21, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByProjectCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(22);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByProjectCountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(22, sort: Sort.desc);
    });
  }
}

extension OrderModelQuerySortThenBy
    on QueryBuilder<OrderModel, OrderModel, QSortThenBy> {
  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByOrderNumber({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByOrderNumberDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByRemoteId({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByRemoteIdDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByClientIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByOrderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByOrderDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  thenByExpectedDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  thenByExpectedDeliveryDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  thenByActualDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  thenByActualDeliveryDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByTotalAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByTotalAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByDepositPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByDepositPaidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByRemainingBalance() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  thenByRemainingBalanceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByPaymentStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByPaymentStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIsArchived() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIsArchivedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByNotesDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIsOverdue() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIsOverdueDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByDaysUntilDelivery() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  thenByDaysUntilDeliveryDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIsFullyPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(20);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIsFullyPaidDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(20, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByPaymentProgress() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(21);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy>
  thenByPaymentProgressDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(21, sort: Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByProjectCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(22);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByProjectCountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(22, sort: Sort.desc);
    });
  }
}

extension OrderModelQueryWhereDistinct
    on QueryBuilder<OrderModel, OrderModel, QDistinct> {
  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByOrderNumber({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByRemoteId({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(3);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByOrderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(4);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct>
  distinctByExpectedDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(5);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct>
  distinctByActualDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(6);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByTotalAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(7);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByDepositPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(8);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct>
  distinctByRemainingBalance() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(9);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct>
  distinctByPaymentStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(10);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(12);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByIsArchived() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(13);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByProjectIds() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(14);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(15, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(16);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(17);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByIsOverdue() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(18);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct>
  distinctByDaysUntilDelivery() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(19);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct> distinctByIsFullyPaid() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(20);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct>
  distinctByPaymentProgress() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(21);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterDistinct>
  distinctByProjectCount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(22);
    });
  }
}

extension OrderModelQueryProperty1
    on QueryBuilder<OrderModel, OrderModel, QProperty> {
  QueryBuilder<OrderModel, int, QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<OrderModel, String, QAfterProperty> orderNumberProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<OrderModel, String?, QAfterProperty> remoteIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<OrderModel, int?, QAfterProperty> clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<OrderModel, DateTime, QAfterProperty> orderDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<OrderModel, DateTime?, QAfterProperty>
  expectedDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<OrderModel, DateTime?, QAfterProperty>
  actualDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<OrderModel, double, QAfterProperty> totalAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<OrderModel, double, QAfterProperty> depositPaidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<OrderModel, double, QAfterProperty> remainingBalanceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<OrderModel, PaymentStatus, QAfterProperty>
  paymentStatusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<OrderModel, List<PaymentRecord>, QAfterProperty>
  paymentHistoryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<OrderModel, OrderStatus, QAfterProperty> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<OrderModel, bool, QAfterProperty> isArchivedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<OrderModel, List<int>, QAfterProperty> projectIdsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<OrderModel, String?, QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<OrderModel, DateTime, QAfterProperty> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<OrderModel, DateTime?, QAfterProperty> updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<OrderModel, bool, QAfterProperty> isOverdueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<OrderModel, int?, QAfterProperty> daysUntilDeliveryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<OrderModel, bool, QAfterProperty> isFullyPaidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }

  QueryBuilder<OrderModel, double, QAfterProperty> paymentProgressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(21);
    });
  }

  QueryBuilder<OrderModel, int, QAfterProperty> projectCountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(22);
    });
  }
}

extension OrderModelQueryProperty2<R>
    on QueryBuilder<OrderModel, R, QAfterProperty> {
  QueryBuilder<OrderModel, (R, int), QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<OrderModel, (R, String), QAfterProperty> orderNumberProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<OrderModel, (R, String?), QAfterProperty> remoteIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<OrderModel, (R, int?), QAfterProperty> clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<OrderModel, (R, DateTime), QAfterProperty> orderDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<OrderModel, (R, DateTime?), QAfterProperty>
  expectedDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<OrderModel, (R, DateTime?), QAfterProperty>
  actualDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<OrderModel, (R, double), QAfterProperty> totalAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<OrderModel, (R, double), QAfterProperty> depositPaidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<OrderModel, (R, double), QAfterProperty>
  remainingBalanceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<OrderModel, (R, PaymentStatus), QAfterProperty>
  paymentStatusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<OrderModel, (R, List<PaymentRecord>), QAfterProperty>
  paymentHistoryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<OrderModel, (R, OrderStatus), QAfterProperty> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<OrderModel, (R, bool), QAfterProperty> isArchivedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<OrderModel, (R, List<int>), QAfterProperty>
  projectIdsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<OrderModel, (R, String?), QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<OrderModel, (R, DateTime), QAfterProperty> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<OrderModel, (R, DateTime?), QAfterProperty> updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<OrderModel, (R, bool), QAfterProperty> isOverdueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<OrderModel, (R, int?), QAfterProperty>
  daysUntilDeliveryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<OrderModel, (R, bool), QAfterProperty> isFullyPaidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }

  QueryBuilder<OrderModel, (R, double), QAfterProperty>
  paymentProgressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(21);
    });
  }

  QueryBuilder<OrderModel, (R, int), QAfterProperty> projectCountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(22);
    });
  }
}

extension OrderModelQueryProperty3<R1, R2>
    on QueryBuilder<OrderModel, (R1, R2), QAfterProperty> {
  QueryBuilder<OrderModel, (R1, R2, int), QOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, String), QOperations>
  orderNumberProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, String?), QOperations> remoteIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, int?), QOperations> clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, DateTime), QOperations>
  orderDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, DateTime?), QOperations>
  expectedDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, DateTime?), QOperations>
  actualDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, double), QOperations>
  totalAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, double), QOperations>
  depositPaidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, double), QOperations>
  remainingBalanceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, PaymentStatus), QOperations>
  paymentStatusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, List<PaymentRecord>), QOperations>
  paymentHistoryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, OrderStatus), QOperations>
  statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, bool), QOperations> isArchivedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, List<int>), QOperations>
  projectIdsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, String?), QOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, DateTime), QOperations>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, DateTime?), QOperations>
  updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, bool), QOperations> isOverdueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, int?), QOperations>
  daysUntilDeliveryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, bool), QOperations> isFullyPaidProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, double), QOperations>
  paymentProgressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(21);
    });
  }

  QueryBuilder<OrderModel, (R1, R2, int), QOperations> projectCountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(22);
    });
  }
}

// **************************************************************************
// _IsarEmbeddedGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

final PaymentRecordSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'PaymentRecord',

    embedded: true,
    properties: [
      IsarPropertySchema(name: 'amount', type: IsarType.double),
      IsarPropertySchema(name: 'paymentDate', type: IsarType.dateTime),
      IsarPropertySchema(name: 'paymentMethod', type: IsarType.string),
      IsarPropertySchema(name: 'notes', type: IsarType.string),
      IsarPropertySchema(name: 'projectId', type: IsarType.long),
    ],
    indexes: [],
  ),
  converter: IsarObjectConverter<void, PaymentRecord>(
    serialize: serializePaymentRecord,
    deserialize: deserializePaymentRecord,
  ),
);

@isarProtected
int serializePaymentRecord(IsarWriter writer, PaymentRecord object) {
  IsarCore.writeDouble(writer, 1, object.amount);
  IsarCore.writeLong(
    writer,
    2,
    object.paymentDate.toUtc().microsecondsSinceEpoch,
  );
  {
    final value = object.paymentMethod;
    if (value == null) {
      IsarCore.writeNull(writer, 3);
    } else {
      IsarCore.writeString(writer, 3, value);
    }
  }
  {
    final value = object.notes;
    if (value == null) {
      IsarCore.writeNull(writer, 4);
    } else {
      IsarCore.writeString(writer, 4, value);
    }
  }
  IsarCore.writeLong(writer, 5, object.projectId ?? -9223372036854775808);
  return 0;
}

@isarProtected
PaymentRecord deserializePaymentRecord(IsarReader reader) {
  final object = PaymentRecord();
  object.amount = IsarCore.readDouble(reader, 1);
  {
    final value = IsarCore.readLong(reader, 2);
    if (value == -9223372036854775808) {
      object.paymentDate = DateTime.fromMillisecondsSinceEpoch(
        0,
        isUtc: true,
      ).toLocal();
    } else {
      object.paymentDate = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  object.paymentMethod = IsarCore.readString(reader, 3);
  object.notes = IsarCore.readString(reader, 4);
  {
    final value = IsarCore.readLong(reader, 5);
    if (value == -9223372036854775808) {
      object.projectId = null;
    } else {
      object.projectId = value;
    }
  }
  return object;
}

extension PaymentRecordQueryFilter
    on QueryBuilder<PaymentRecord, PaymentRecord, QFilterCondition> {
  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  amountEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  amountGreaterThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 1, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  amountGreaterThanOrEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 1, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  amountLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 1, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  amountLessThanOrEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 1, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  amountBetween(double lower, double upper, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 1,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentDateEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentDateGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 2, value: value),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentDateGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 2, value: value),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentDateLessThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 2, value: value));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentDateLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 2, value: value),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentDateBetween(DateTime lower, DateTime upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 2, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 3,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodGreaterThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 3,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 3,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 3,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 3,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 3,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 3,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 3,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  paymentMethodIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 4,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 4,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 4,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesBetween(String? lower, String? upper, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 4,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 4,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 4,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 4,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 4,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  projectIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  projectIdIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  projectIdEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  projectIdGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  projectIdGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  projectIdLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 5, value: value));
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  projectIdLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<PaymentRecord, PaymentRecord, QAfterFilterCondition>
  projectIdBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 5, lower: lower, upper: upper),
      );
    });
  }
}

extension PaymentRecordQueryObject
    on QueryBuilder<PaymentRecord, PaymentRecord, QFilterCondition> {}
