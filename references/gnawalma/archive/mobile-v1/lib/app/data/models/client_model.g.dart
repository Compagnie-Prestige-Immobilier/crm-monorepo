// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'client_model.dart';

// **************************************************************************
// _IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

extension GetClientModelCollection on Isar {
  IsarCollection<int, ClientModel> get clientModels => this.collection();
}

final ClientModelSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'ClientModel',
    idName: 'id',
    embedded: false,
    properties: [
      IsarPropertySchema(name: 'firstName', type: IsarType.string),
      IsarPropertySchema(name: 'lastName', type: IsarType.string),
      IsarPropertySchema(
        name: 'gender',
        type: IsarType.byte,

        enumMap: {"male": 0, "female": 1},
      ),
      IsarPropertySchema(name: 'phone', type: IsarType.string),
      IsarPropertySchema(name: 'email', type: IsarType.string),
      IsarPropertySchema(name: 'address', type: IsarType.string),
      IsarPropertySchema(name: 'fullName', type: IsarType.string),
      IsarPropertySchema(
        name: 'measurements',
        type: IsarType.objectList,
        target: 'MeasurementRecord',
      ),
      IsarPropertySchema(name: 'favoriteColors', type: IsarType.stringList),
      IsarPropertySchema(name: 'preferredStyles', type: IsarType.stringList),
      IsarPropertySchema(name: 'notes', type: IsarType.string),
      IsarPropertySchema(name: 'orderIds', type: IsarType.longList),
      IsarPropertySchema(name: 'totalOrders', type: IsarType.long),
      IsarPropertySchema(name: 'totalSpent', type: IsarType.double),
      IsarPropertySchema(name: 'trustScore', type: IsarType.long),
      IsarPropertySchema(name: 'createdAt', type: IsarType.dateTime),
      IsarPropertySchema(name: 'lastOrderDate', type: IsarType.dateTime),
      IsarPropertySchema(
        name: 'latestMeasurement',
        type: IsarType.object,
        target: 'MeasurementRecord',
      ),
      IsarPropertySchema(name: 'displayName', type: IsarType.string),
      IsarPropertySchema(name: 'initials', type: IsarType.string),
    ],
    indexes: [
      IsarIndexSchema(
        name: 'fullName',
        properties: ["fullName"],
        unique: false,
        hash: false,
      ),
    ],
  ),
  converter: IsarObjectConverter<int, ClientModel>(
    serialize: serializeClientModel,
    deserialize: deserializeClientModel,
    deserializeProperty: deserializeClientModelProp,
  ),
  getEmbeddedSchemas: () => [MeasurementRecordSchema, CustomMeasurementSchema],
);

@isarProtected
int serializeClientModel(IsarWriter writer, ClientModel object) {
  IsarCore.writeString(writer, 1, object.firstName);
  IsarCore.writeString(writer, 2, object.lastName);
  IsarCore.writeByte(writer, 3, object.gender.index);
  {
    final value = object.phone;
    if (value == null) {
      IsarCore.writeNull(writer, 4);
    } else {
      IsarCore.writeString(writer, 4, value);
    }
  }
  {
    final value = object.email;
    if (value == null) {
      IsarCore.writeNull(writer, 5);
    } else {
      IsarCore.writeString(writer, 5, value);
    }
  }
  {
    final value = object.address;
    if (value == null) {
      IsarCore.writeNull(writer, 6);
    } else {
      IsarCore.writeString(writer, 6, value);
    }
  }
  {
    final value = object.fullName;
    if (value == null) {
      IsarCore.writeNull(writer, 7);
    } else {
      IsarCore.writeString(writer, 7, value);
    }
  }
  {
    final list = object.measurements;
    final listWriter = IsarCore.beginList(writer, 8, list.length);
    for (var i = 0; i < list.length; i++) {
      {
        final value = list[i];
        final objectWriter = IsarCore.beginObject(listWriter, i);
        serializeMeasurementRecord(objectWriter, value);
        IsarCore.endObject(listWriter, objectWriter);
      }
    }
    IsarCore.endList(writer, listWriter);
  }
  {
    final list = object.favoriteColors;
    final listWriter = IsarCore.beginList(writer, 9, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeString(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  {
    final list = object.preferredStyles;
    final listWriter = IsarCore.beginList(writer, 10, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeString(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  {
    final value = object.notes;
    if (value == null) {
      IsarCore.writeNull(writer, 11);
    } else {
      IsarCore.writeString(writer, 11, value);
    }
  }
  {
    final list = object.orderIds;
    final listWriter = IsarCore.beginList(writer, 12, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeLong(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  IsarCore.writeLong(writer, 13, object.totalOrders);
  IsarCore.writeDouble(writer, 14, object.totalSpent);
  IsarCore.writeLong(writer, 15, object.trustScore);
  IsarCore.writeLong(
    writer,
    16,
    object.createdAt.toUtc().microsecondsSinceEpoch,
  );
  IsarCore.writeLong(
    writer,
    17,
    object.lastOrderDate?.toUtc().microsecondsSinceEpoch ??
        -9223372036854775808,
  );
  {
    final value = object.latestMeasurement;
    if (value == null) {
      IsarCore.writeNull(writer, 18);
    } else {
      final objectWriter = IsarCore.beginObject(writer, 18);
      serializeMeasurementRecord(objectWriter, value);
      IsarCore.endObject(writer, objectWriter);
    }
  }
  IsarCore.writeString(writer, 19, object.displayName);
  IsarCore.writeString(writer, 20, object.initials);
  return object.id;
}

@isarProtected
ClientModel deserializeClientModel(IsarReader reader) {
  final object = ClientModel();
  object.id = IsarCore.readId(reader);
  object.firstName = IsarCore.readString(reader, 1) ?? '';
  object.lastName = IsarCore.readString(reader, 2) ?? '';
  {
    if (IsarCore.readNull(reader, 3)) {
      object.gender = Gender.male;
    } else {
      object.gender =
          _clientModelGender[IsarCore.readByte(reader, 3)] ?? Gender.male;
    }
  }
  object.phone = IsarCore.readString(reader, 4);
  object.email = IsarCore.readString(reader, 5);
  object.address = IsarCore.readString(reader, 6);
  object.fullName = IsarCore.readString(reader, 7);
  {
    final length = IsarCore.readList(reader, 8, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.measurements = const <MeasurementRecord>[];
      } else {
        final list = List<MeasurementRecord>.filled(
          length,
          MeasurementRecord(),
          growable: true,
        );
        for (var i = 0; i < length; i++) {
          {
            final objectReader = IsarCore.readObject(reader, i);
            if (objectReader.isNull) {
              list[i] = MeasurementRecord();
            } else {
              final embedded = deserializeMeasurementRecord(objectReader);
              IsarCore.freeReader(objectReader);
              list[i] = embedded;
            }
          }
        }
        IsarCore.freeReader(reader);
        object.measurements = list;
      }
    }
  }
  {
    final length = IsarCore.readList(reader, 9, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.favoriteColors = const <String>[];
      } else {
        final list = List<String>.filled(length, '', growable: true);
        for (var i = 0; i < length; i++) {
          list[i] = IsarCore.readString(reader, i) ?? '';
        }
        IsarCore.freeReader(reader);
        object.favoriteColors = list;
      }
    }
  }
  {
    final length = IsarCore.readList(reader, 10, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.preferredStyles = const <String>[];
      } else {
        final list = List<String>.filled(length, '', growable: true);
        for (var i = 0; i < length; i++) {
          list[i] = IsarCore.readString(reader, i) ?? '';
        }
        IsarCore.freeReader(reader);
        object.preferredStyles = list;
      }
    }
  }
  object.notes = IsarCore.readString(reader, 11);
  {
    final length = IsarCore.readList(reader, 12, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.orderIds = const <int>[];
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
        object.orderIds = list;
      }
    }
  }
  object.totalOrders = IsarCore.readLong(reader, 13);
  object.totalSpent = IsarCore.readDouble(reader, 14);
  object.trustScore = IsarCore.readLong(reader, 15);
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
      object.lastOrderDate = null;
    } else {
      object.lastOrderDate = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  return object;
}

@isarProtected
dynamic deserializeClientModelProp(IsarReader reader, int property) {
  switch (property) {
    case 0:
      return IsarCore.readId(reader);
    case 1:
      return IsarCore.readString(reader, 1) ?? '';
    case 2:
      return IsarCore.readString(reader, 2) ?? '';
    case 3:
      {
        if (IsarCore.readNull(reader, 3)) {
          return Gender.male;
        } else {
          return _clientModelGender[IsarCore.readByte(reader, 3)] ??
              Gender.male;
        }
      }
    case 4:
      return IsarCore.readString(reader, 4);
    case 5:
      return IsarCore.readString(reader, 5);
    case 6:
      return IsarCore.readString(reader, 6);
    case 7:
      return IsarCore.readString(reader, 7);
    case 8:
      {
        final length = IsarCore.readList(reader, 8, IsarCore.readerPtrPtr);
        {
          final reader = IsarCore.readerPtr;
          if (reader.isNull) {
            return const <MeasurementRecord>[];
          } else {
            final list = List<MeasurementRecord>.filled(
              length,
              MeasurementRecord(),
              growable: true,
            );
            for (var i = 0; i < length; i++) {
              {
                final objectReader = IsarCore.readObject(reader, i);
                if (objectReader.isNull) {
                  list[i] = MeasurementRecord();
                } else {
                  final embedded = deserializeMeasurementRecord(objectReader);
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
    case 9:
      {
        final length = IsarCore.readList(reader, 9, IsarCore.readerPtrPtr);
        {
          final reader = IsarCore.readerPtr;
          if (reader.isNull) {
            return const <String>[];
          } else {
            final list = List<String>.filled(length, '', growable: true);
            for (var i = 0; i < length; i++) {
              list[i] = IsarCore.readString(reader, i) ?? '';
            }
            IsarCore.freeReader(reader);
            return list;
          }
        }
      }
    case 10:
      {
        final length = IsarCore.readList(reader, 10, IsarCore.readerPtrPtr);
        {
          final reader = IsarCore.readerPtr;
          if (reader.isNull) {
            return const <String>[];
          } else {
            final list = List<String>.filled(length, '', growable: true);
            for (var i = 0; i < length; i++) {
              list[i] = IsarCore.readString(reader, i) ?? '';
            }
            IsarCore.freeReader(reader);
            return list;
          }
        }
      }
    case 11:
      return IsarCore.readString(reader, 11);
    case 12:
      {
        final length = IsarCore.readList(reader, 12, IsarCore.readerPtrPtr);
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
    case 13:
      return IsarCore.readLong(reader, 13);
    case 14:
      return IsarCore.readDouble(reader, 14);
    case 15:
      return IsarCore.readLong(reader, 15);
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
      {
        final objectReader = IsarCore.readObject(reader, 18);
        if (objectReader.isNull) {
          return null;
        } else {
          final embedded = deserializeMeasurementRecord(objectReader);
          IsarCore.freeReader(objectReader);
          return embedded;
        }
      }
    case 19:
      return IsarCore.readString(reader, 19) ?? '';
    case 20:
      return IsarCore.readString(reader, 20) ?? '';
    default:
      throw ArgumentError('Unknown property: $property');
  }
}

sealed class _ClientModelUpdate {
  bool call({
    required int id,
    String? firstName,
    String? lastName,
    Gender? gender,
    String? phone,
    String? email,
    String? address,
    String? fullName,
    String? notes,
    int? totalOrders,
    double? totalSpent,
    int? trustScore,
    DateTime? createdAt,
    DateTime? lastOrderDate,
    String? displayName,
    String? initials,
  });
}

class _ClientModelUpdateImpl implements _ClientModelUpdate {
  const _ClientModelUpdateImpl(this.collection);

  final IsarCollection<int, ClientModel> collection;

  @override
  bool call({
    required int id,
    Object? firstName = ignore,
    Object? lastName = ignore,
    Object? gender = ignore,
    Object? phone = ignore,
    Object? email = ignore,
    Object? address = ignore,
    Object? fullName = ignore,
    Object? notes = ignore,
    Object? totalOrders = ignore,
    Object? totalSpent = ignore,
    Object? trustScore = ignore,
    Object? createdAt = ignore,
    Object? lastOrderDate = ignore,
    Object? displayName = ignore,
    Object? initials = ignore,
  }) {
    return collection.updateProperties(
          [id],
          {
            if (firstName != ignore) 1: firstName as String?,
            if (lastName != ignore) 2: lastName as String?,
            if (gender != ignore) 3: gender as Gender?,
            if (phone != ignore) 4: phone as String?,
            if (email != ignore) 5: email as String?,
            if (address != ignore) 6: address as String?,
            if (fullName != ignore) 7: fullName as String?,
            if (notes != ignore) 11: notes as String?,
            if (totalOrders != ignore) 13: totalOrders as int?,
            if (totalSpent != ignore) 14: totalSpent as double?,
            if (trustScore != ignore) 15: trustScore as int?,
            if (createdAt != ignore) 16: createdAt as DateTime?,
            if (lastOrderDate != ignore) 17: lastOrderDate as DateTime?,
            if (displayName != ignore) 19: displayName as String?,
            if (initials != ignore) 20: initials as String?,
          },
        ) >
        0;
  }
}

sealed class _ClientModelUpdateAll {
  int call({
    required List<int> id,
    String? firstName,
    String? lastName,
    Gender? gender,
    String? phone,
    String? email,
    String? address,
    String? fullName,
    String? notes,
    int? totalOrders,
    double? totalSpent,
    int? trustScore,
    DateTime? createdAt,
    DateTime? lastOrderDate,
    String? displayName,
    String? initials,
  });
}

class _ClientModelUpdateAllImpl implements _ClientModelUpdateAll {
  const _ClientModelUpdateAllImpl(this.collection);

  final IsarCollection<int, ClientModel> collection;

  @override
  int call({
    required List<int> id,
    Object? firstName = ignore,
    Object? lastName = ignore,
    Object? gender = ignore,
    Object? phone = ignore,
    Object? email = ignore,
    Object? address = ignore,
    Object? fullName = ignore,
    Object? notes = ignore,
    Object? totalOrders = ignore,
    Object? totalSpent = ignore,
    Object? trustScore = ignore,
    Object? createdAt = ignore,
    Object? lastOrderDate = ignore,
    Object? displayName = ignore,
    Object? initials = ignore,
  }) {
    return collection.updateProperties(id, {
      if (firstName != ignore) 1: firstName as String?,
      if (lastName != ignore) 2: lastName as String?,
      if (gender != ignore) 3: gender as Gender?,
      if (phone != ignore) 4: phone as String?,
      if (email != ignore) 5: email as String?,
      if (address != ignore) 6: address as String?,
      if (fullName != ignore) 7: fullName as String?,
      if (notes != ignore) 11: notes as String?,
      if (totalOrders != ignore) 13: totalOrders as int?,
      if (totalSpent != ignore) 14: totalSpent as double?,
      if (trustScore != ignore) 15: trustScore as int?,
      if (createdAt != ignore) 16: createdAt as DateTime?,
      if (lastOrderDate != ignore) 17: lastOrderDate as DateTime?,
      if (displayName != ignore) 19: displayName as String?,
      if (initials != ignore) 20: initials as String?,
    });
  }
}

extension ClientModelUpdate on IsarCollection<int, ClientModel> {
  _ClientModelUpdate get update => _ClientModelUpdateImpl(this);

  _ClientModelUpdateAll get updateAll => _ClientModelUpdateAllImpl(this);
}

sealed class _ClientModelQueryUpdate {
  int call({
    String? firstName,
    String? lastName,
    Gender? gender,
    String? phone,
    String? email,
    String? address,
    String? fullName,
    String? notes,
    int? totalOrders,
    double? totalSpent,
    int? trustScore,
    DateTime? createdAt,
    DateTime? lastOrderDate,
    String? displayName,
    String? initials,
  });
}

class _ClientModelQueryUpdateImpl implements _ClientModelQueryUpdate {
  const _ClientModelQueryUpdateImpl(this.query, {this.limit});

  final IsarQuery<ClientModel> query;
  final int? limit;

  @override
  int call({
    Object? firstName = ignore,
    Object? lastName = ignore,
    Object? gender = ignore,
    Object? phone = ignore,
    Object? email = ignore,
    Object? address = ignore,
    Object? fullName = ignore,
    Object? notes = ignore,
    Object? totalOrders = ignore,
    Object? totalSpent = ignore,
    Object? trustScore = ignore,
    Object? createdAt = ignore,
    Object? lastOrderDate = ignore,
    Object? displayName = ignore,
    Object? initials = ignore,
  }) {
    return query.updateProperties(limit: limit, {
      if (firstName != ignore) 1: firstName as String?,
      if (lastName != ignore) 2: lastName as String?,
      if (gender != ignore) 3: gender as Gender?,
      if (phone != ignore) 4: phone as String?,
      if (email != ignore) 5: email as String?,
      if (address != ignore) 6: address as String?,
      if (fullName != ignore) 7: fullName as String?,
      if (notes != ignore) 11: notes as String?,
      if (totalOrders != ignore) 13: totalOrders as int?,
      if (totalSpent != ignore) 14: totalSpent as double?,
      if (trustScore != ignore) 15: trustScore as int?,
      if (createdAt != ignore) 16: createdAt as DateTime?,
      if (lastOrderDate != ignore) 17: lastOrderDate as DateTime?,
      if (displayName != ignore) 19: displayName as String?,
      if (initials != ignore) 20: initials as String?,
    });
  }
}

extension ClientModelQueryUpdate on IsarQuery<ClientModel> {
  _ClientModelQueryUpdate get updateFirst =>
      _ClientModelQueryUpdateImpl(this, limit: 1);

  _ClientModelQueryUpdate get updateAll => _ClientModelQueryUpdateImpl(this);
}

class _ClientModelQueryBuilderUpdateImpl implements _ClientModelQueryUpdate {
  const _ClientModelQueryBuilderUpdateImpl(this.query, {this.limit});

  final QueryBuilder<ClientModel, ClientModel, QOperations> query;
  final int? limit;

  @override
  int call({
    Object? firstName = ignore,
    Object? lastName = ignore,
    Object? gender = ignore,
    Object? phone = ignore,
    Object? email = ignore,
    Object? address = ignore,
    Object? fullName = ignore,
    Object? notes = ignore,
    Object? totalOrders = ignore,
    Object? totalSpent = ignore,
    Object? trustScore = ignore,
    Object? createdAt = ignore,
    Object? lastOrderDate = ignore,
    Object? displayName = ignore,
    Object? initials = ignore,
  }) {
    final q = query.build();
    try {
      return q.updateProperties(limit: limit, {
        if (firstName != ignore) 1: firstName as String?,
        if (lastName != ignore) 2: lastName as String?,
        if (gender != ignore) 3: gender as Gender?,
        if (phone != ignore) 4: phone as String?,
        if (email != ignore) 5: email as String?,
        if (address != ignore) 6: address as String?,
        if (fullName != ignore) 7: fullName as String?,
        if (notes != ignore) 11: notes as String?,
        if (totalOrders != ignore) 13: totalOrders as int?,
        if (totalSpent != ignore) 14: totalSpent as double?,
        if (trustScore != ignore) 15: trustScore as int?,
        if (createdAt != ignore) 16: createdAt as DateTime?,
        if (lastOrderDate != ignore) 17: lastOrderDate as DateTime?,
        if (displayName != ignore) 19: displayName as String?,
        if (initials != ignore) 20: initials as String?,
      });
    } finally {
      q.close();
    }
  }
}

extension ClientModelQueryBuilderUpdate
    on QueryBuilder<ClientModel, ClientModel, QOperations> {
  _ClientModelQueryUpdate get updateFirst =>
      _ClientModelQueryBuilderUpdateImpl(this, limit: 1);

  _ClientModelQueryUpdate get updateAll =>
      _ClientModelQueryBuilderUpdateImpl(this);
}

const _clientModelGender = {0: Gender.male, 1: Gender.female};

extension ClientModelQueryFilter
    on QueryBuilder<ClientModel, ClientModel, QFilterCondition> {
  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> idEqualTo(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> idGreaterThan(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  idGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> idLessThan(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 0, value: value));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  idLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> idBetween(
    int lower,
    int upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 0, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameBetween(String lower, String upper, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  firstNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> lastNameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> lastNameBetween(
    String lower,
    String upper, {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> lastNameMatches(
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> genderEqualTo(
    Gender value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  genderGreaterThan(Gender value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  genderGreaterThanOrEqualTo(Gender value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> genderLessThan(
    Gender value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  genderLessThanOrEqualTo(Gender value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> genderBetween(
    Gender lower,
    Gender upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 3, lower: lower.index, upper: upper.index),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  phoneIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  phoneGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  phoneGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneLessThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  phoneLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneContains(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> phoneIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  phoneIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  emailIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  emailGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 5,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  emailGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 5,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailLessThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 5, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  emailLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 5,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 5,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 5,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 5,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 5,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 5,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> emailIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 5, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  emailIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 5, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  addressIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  addressIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> addressEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 6, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  addressGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 6,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  addressGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 6,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> addressLessThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 6, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  addressLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 6,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> addressBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 6,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  addressStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 6,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> addressEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 6,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> addressContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 6,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> addressMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 6,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  addressIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 6, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  addressIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 6, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> fullNameEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 7, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 7,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 7,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 7, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 7,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> fullNameBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 7,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 7,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 7,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 7,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> fullNameMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 7,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 7, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  fullNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 7, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  measurementsIsEmpty() {
    return not().measurementsIsNotEmpty();
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  measurementsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 8, value: null),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 9, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 9,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 9,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 9, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementLessThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 9,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementBetween(
    String lower,
    String upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 9,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 9,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 9,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 9,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 9,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 9, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 9, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsIsEmpty() {
    return not().favoriteColorsIsNotEmpty();
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  favoriteColorsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 9, value: null),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 10,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 10,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 10,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 10, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementLessThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 10,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementBetween(
    String lower,
    String upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 10,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 10,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 10,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 10,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 10,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 10, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 10, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesIsEmpty() {
    return not().preferredStylesIsNotEmpty();
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  preferredStylesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 10, value: null),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 11));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  notesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 11));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 11,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  notesGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 11,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  notesGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 11,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesLessThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 11, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  notesLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 11,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 11,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 11,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 11,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 11,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 11,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 11, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 11, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  orderIdsElementEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  orderIdsElementGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  orderIdsElementGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  orderIdsElementLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  orderIdsElementLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  orderIdsElementBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 12, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  orderIdsIsEmpty() {
    return not().orderIdsIsNotEmpty();
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  orderIdsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 12, value: null),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalOrdersEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalOrdersGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalOrdersGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalOrdersLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalOrdersLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalOrdersBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 13, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalSpentEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 14, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalSpentGreaterThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 14, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalSpentGreaterThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 14, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalSpentLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 14, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalSpentLessThanOrEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 14, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  totalSpentBetween(
    double lower,
    double upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 14,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  trustScoreEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  trustScoreGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  trustScoreGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  trustScoreLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  trustScoreLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  trustScoreBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 15, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  createdAtGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  createdAtGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  createdAtLessThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  createdAtLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  createdAtBetween(DateTime lower, DateTime upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 16, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastOrderDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 17));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastOrderDateIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 17));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastOrderDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastOrderDateGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastOrderDateGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastOrderDateLessThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastOrderDateLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  lastOrderDateBetween(DateTime? lower, DateTime? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 17, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  latestMeasurementIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 18));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  latestMeasurementIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 18));
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 19,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 19,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 19,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 19, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 19,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameBetween(String lower, String upper, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 19,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 19,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 19,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 19,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 19,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 19, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  displayNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 19, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> initialsEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 20,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 20,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 20,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 20, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 20,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> initialsBetween(
    String lower,
    String upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 20,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 20,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 20,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 20,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition> initialsMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 20,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 20, value: ''),
      );
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  initialsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 20, value: ''),
      );
    });
  }
}

extension ClientModelQueryObject
    on QueryBuilder<ClientModel, ClientModel, QFilterCondition> {
  QueryBuilder<ClientModel, ClientModel, QAfterFilterCondition>
  latestMeasurement(FilterQuery<MeasurementRecord> q) {
    return QueryBuilder.apply(this, (query) {
      return query.object(q, 18);
    });
  }
}

extension ClientModelQuerySortBy
    on QueryBuilder<ClientModel, ClientModel, QSortBy> {
  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByFirstName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByFirstNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByLastName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByLastNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByGender() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByGenderDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByPhone({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByPhoneDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByEmail({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByEmailDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByAddress({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByAddressDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByFullName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByFullNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByNotesDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByTotalOrders() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByTotalOrdersDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByTotalSpent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByTotalSpentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByTrustScore() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByTrustScoreDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByLastOrderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy>
  sortByLastOrderDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByDisplayName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByDisplayNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByInitials({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(20, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> sortByInitialsDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(20, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }
}

extension ClientModelQuerySortThenBy
    on QueryBuilder<ClientModel, ClientModel, QSortThenBy> {
  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByFirstName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByFirstNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByLastName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByLastNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByGender() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByGenderDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByPhone({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByPhoneDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByEmail({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByEmailDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByAddress({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByAddressDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByFullName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByFullNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByNotesDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByTotalOrders() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByTotalOrdersDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByTotalSpent() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByTotalSpentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByTrustScore() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByTrustScoreDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByLastOrderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy>
  thenByLastOrderDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, sort: Sort.desc);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByDisplayName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByDisplayNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByInitials({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(20, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterSortBy> thenByInitialsDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(20, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }
}

extension ClientModelQueryWhereDistinct
    on QueryBuilder<ClientModel, ClientModel, QDistinct> {
  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByFirstName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByLastName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByGender() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(3);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByPhone({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByEmail({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByAddress({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(6, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByFullName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(7, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct>
  distinctByFavoriteColors() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(9);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct>
  distinctByPreferredStyles() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(10);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(11, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByOrderIds() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(12);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct>
  distinctByTotalOrders() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(13);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct>
  distinctByTotalSpent() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(14);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct>
  distinctByTrustScore() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(15);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(16);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct>
  distinctByLastOrderDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(17);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByDisplayName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(19, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ClientModel, ClientModel, QAfterDistinct> distinctByInitials({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(20, caseSensitive: caseSensitive);
    });
  }
}

extension ClientModelQueryProperty1
    on QueryBuilder<ClientModel, ClientModel, QProperty> {
  QueryBuilder<ClientModel, int, QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<ClientModel, String, QAfterProperty> firstNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<ClientModel, String, QAfterProperty> lastNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<ClientModel, Gender, QAfterProperty> genderProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<ClientModel, String?, QAfterProperty> phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<ClientModel, String?, QAfterProperty> emailProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<ClientModel, String?, QAfterProperty> addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<ClientModel, String?, QAfterProperty> fullNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<ClientModel, List<MeasurementRecord>, QAfterProperty>
  measurementsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<ClientModel, List<String>, QAfterProperty>
  favoriteColorsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<ClientModel, List<String>, QAfterProperty>
  preferredStylesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<ClientModel, String?, QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<ClientModel, List<int>, QAfterProperty> orderIdsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<ClientModel, int, QAfterProperty> totalOrdersProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<ClientModel, double, QAfterProperty> totalSpentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<ClientModel, int, QAfterProperty> trustScoreProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<ClientModel, DateTime, QAfterProperty> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<ClientModel, DateTime?, QAfterProperty> lastOrderDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<ClientModel, MeasurementRecord?, QAfterProperty>
  latestMeasurementProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<ClientModel, String, QAfterProperty> displayNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<ClientModel, String, QAfterProperty> initialsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }
}

extension ClientModelQueryProperty2<R>
    on QueryBuilder<ClientModel, R, QAfterProperty> {
  QueryBuilder<ClientModel, (R, int), QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<ClientModel, (R, String), QAfterProperty> firstNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<ClientModel, (R, String), QAfterProperty> lastNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<ClientModel, (R, Gender), QAfterProperty> genderProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<ClientModel, (R, String?), QAfterProperty> phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<ClientModel, (R, String?), QAfterProperty> emailProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<ClientModel, (R, String?), QAfterProperty> addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<ClientModel, (R, String?), QAfterProperty> fullNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<ClientModel, (R, List<MeasurementRecord>), QAfterProperty>
  measurementsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<ClientModel, (R, List<String>), QAfterProperty>
  favoriteColorsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<ClientModel, (R, List<String>), QAfterProperty>
  preferredStylesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<ClientModel, (R, String?), QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<ClientModel, (R, List<int>), QAfterProperty> orderIdsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<ClientModel, (R, int), QAfterProperty> totalOrdersProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<ClientModel, (R, double), QAfterProperty> totalSpentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<ClientModel, (R, int), QAfterProperty> trustScoreProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<ClientModel, (R, DateTime), QAfterProperty> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<ClientModel, (R, DateTime?), QAfterProperty>
  lastOrderDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<ClientModel, (R, MeasurementRecord?), QAfterProperty>
  latestMeasurementProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<ClientModel, (R, String), QAfterProperty> displayNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<ClientModel, (R, String), QAfterProperty> initialsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }
}

extension ClientModelQueryProperty3<R1, R2>
    on QueryBuilder<ClientModel, (R1, R2), QAfterProperty> {
  QueryBuilder<ClientModel, (R1, R2, int), QOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String), QOperations> firstNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String), QOperations> lastNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, Gender), QOperations> genderProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String?), QOperations> phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String?), QOperations> emailProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String?), QOperations> addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String?), QOperations> fullNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, List<MeasurementRecord>), QOperations>
  measurementsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, List<String>), QOperations>
  favoriteColorsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, List<String>), QOperations>
  preferredStylesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String?), QOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, List<int>), QOperations>
  orderIdsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, int), QOperations> totalOrdersProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, double), QOperations>
  totalSpentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, int), QOperations> trustScoreProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, DateTime), QOperations>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, DateTime?), QOperations>
  lastOrderDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, MeasurementRecord?), QOperations>
  latestMeasurementProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String), QOperations>
  displayNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<ClientModel, (R1, R2, String), QOperations> initialsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }
}

// **************************************************************************
// _IsarEmbeddedGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

final MeasurementRecordSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'MeasurementRecord',

    embedded: true,
    properties: [
      IsarPropertySchema(name: 'recordedDate', type: IsarType.dateTime),
      IsarPropertySchema(name: 'bustCircumference', type: IsarType.double),
      IsarPropertySchema(name: 'waistCircumference', type: IsarType.double),
      IsarPropertySchema(name: 'hipCircumference', type: IsarType.double),
      IsarPropertySchema(name: 'backLength', type: IsarType.double),
      IsarPropertySchema(name: 'sleeveLength', type: IsarType.double),
      IsarPropertySchema(name: 'inseamLength', type: IsarType.double),
      IsarPropertySchema(name: 'neckCircumference', type: IsarType.double),
      IsarPropertySchema(name: 'shoulderWidth', type: IsarType.double),
      IsarPropertySchema(name: 'totalHeight', type: IsarType.double),
      IsarPropertySchema(name: 'armCircumference', type: IsarType.double),
      IsarPropertySchema(name: 'skirtLength', type: IsarType.double),
      IsarPropertySchema(name: 'pantsLength', type: IsarType.double),
      IsarPropertySchema(
        name: 'customMeasurements',
        type: IsarType.objectList,
        target: 'CustomMeasurement',
      ),
      IsarPropertySchema(name: 'notes', type: IsarType.string),
      IsarPropertySchema(name: 'isEmpty', type: IsarType.bool),
    ],
    indexes: [],
  ),
  converter: IsarObjectConverter<void, MeasurementRecord>(
    serialize: serializeMeasurementRecord,
    deserialize: deserializeMeasurementRecord,
  ),
);

@isarProtected
int serializeMeasurementRecord(IsarWriter writer, MeasurementRecord object) {
  IsarCore.writeLong(
    writer,
    1,
    object.recordedDate.toUtc().microsecondsSinceEpoch,
  );
  IsarCore.writeDouble(writer, 2, object.bustCircumference ?? double.nan);
  IsarCore.writeDouble(writer, 3, object.waistCircumference ?? double.nan);
  IsarCore.writeDouble(writer, 4, object.hipCircumference ?? double.nan);
  IsarCore.writeDouble(writer, 5, object.backLength ?? double.nan);
  IsarCore.writeDouble(writer, 6, object.sleeveLength ?? double.nan);
  IsarCore.writeDouble(writer, 7, object.inseamLength ?? double.nan);
  IsarCore.writeDouble(writer, 8, object.neckCircumference ?? double.nan);
  IsarCore.writeDouble(writer, 9, object.shoulderWidth ?? double.nan);
  IsarCore.writeDouble(writer, 10, object.totalHeight ?? double.nan);
  IsarCore.writeDouble(writer, 11, object.armCircumference ?? double.nan);
  IsarCore.writeDouble(writer, 12, object.skirtLength ?? double.nan);
  IsarCore.writeDouble(writer, 13, object.pantsLength ?? double.nan);
  {
    final list = object.customMeasurements;
    final listWriter = IsarCore.beginList(writer, 14, list.length);
    for (var i = 0; i < list.length; i++) {
      {
        final value = list[i];
        final objectWriter = IsarCore.beginObject(listWriter, i);
        serializeCustomMeasurement(objectWriter, value);
        IsarCore.endObject(listWriter, objectWriter);
      }
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
  IsarCore.writeBool(writer, 16, value: object.isEmpty);
  return 0;
}

@isarProtected
MeasurementRecord deserializeMeasurementRecord(IsarReader reader) {
  final object = MeasurementRecord();
  {
    final value = IsarCore.readLong(reader, 1);
    if (value == -9223372036854775808) {
      object.recordedDate = DateTime.fromMillisecondsSinceEpoch(
        0,
        isUtc: true,
      ).toLocal();
    } else {
      object.recordedDate = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  {
    final value = IsarCore.readDouble(reader, 2);
    if (value.isNaN) {
      object.bustCircumference = null;
    } else {
      object.bustCircumference = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 3);
    if (value.isNaN) {
      object.waistCircumference = null;
    } else {
      object.waistCircumference = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 4);
    if (value.isNaN) {
      object.hipCircumference = null;
    } else {
      object.hipCircumference = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 5);
    if (value.isNaN) {
      object.backLength = null;
    } else {
      object.backLength = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 6);
    if (value.isNaN) {
      object.sleeveLength = null;
    } else {
      object.sleeveLength = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 7);
    if (value.isNaN) {
      object.inseamLength = null;
    } else {
      object.inseamLength = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 8);
    if (value.isNaN) {
      object.neckCircumference = null;
    } else {
      object.neckCircumference = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 9);
    if (value.isNaN) {
      object.shoulderWidth = null;
    } else {
      object.shoulderWidth = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 10);
    if (value.isNaN) {
      object.totalHeight = null;
    } else {
      object.totalHeight = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 11);
    if (value.isNaN) {
      object.armCircumference = null;
    } else {
      object.armCircumference = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 12);
    if (value.isNaN) {
      object.skirtLength = null;
    } else {
      object.skirtLength = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 13);
    if (value.isNaN) {
      object.pantsLength = null;
    } else {
      object.pantsLength = value;
    }
  }
  {
    final length = IsarCore.readList(reader, 14, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.customMeasurements = const <CustomMeasurement>[];
      } else {
        final list = List<CustomMeasurement>.filled(
          length,
          CustomMeasurement(),
          growable: true,
        );
        for (var i = 0; i < length; i++) {
          {
            final objectReader = IsarCore.readObject(reader, i);
            if (objectReader.isNull) {
              list[i] = CustomMeasurement();
            } else {
              final embedded = deserializeCustomMeasurement(objectReader);
              IsarCore.freeReader(objectReader);
              list[i] = embedded;
            }
          }
        }
        IsarCore.freeReader(reader);
        object.customMeasurements = list;
      }
    }
  }
  object.notes = IsarCore.readString(reader, 15);
  return object;
}

extension MeasurementRecordQueryFilter
    on QueryBuilder<MeasurementRecord, MeasurementRecord, QFilterCondition> {
  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  recordedDateEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  recordedDateGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 1, value: value),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  recordedDateGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 1, value: value),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  recordedDateLessThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 1, value: value));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  recordedDateLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 1, value: value),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  recordedDateBetween(DateTime lower, DateTime upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 1, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  bustCircumferenceIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 2));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  bustCircumferenceIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 2));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  bustCircumferenceEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  bustCircumferenceGreaterThan(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  bustCircumferenceGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  bustCircumferenceLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  bustCircumferenceLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  bustCircumferenceBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 2,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  waistCircumferenceIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  waistCircumferenceIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  waistCircumferenceEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  waistCircumferenceGreaterThan(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 3, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  waistCircumferenceGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 3, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  waistCircumferenceLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 3, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  waistCircumferenceLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 3, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  waistCircumferenceBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 3,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  hipCircumferenceIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  hipCircumferenceIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  hipCircumferenceEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  hipCircumferenceGreaterThan(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  hipCircumferenceGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  hipCircumferenceLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  hipCircumferenceLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  hipCircumferenceBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 4,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  backLengthIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  backLengthIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  backLengthEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  backLengthGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  backLengthGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  backLengthLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  backLengthLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  backLengthBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 5,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  sleeveLengthIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  sleeveLengthIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  sleeveLengthEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  sleeveLengthGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  sleeveLengthGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  sleeveLengthLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  sleeveLengthLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  sleeveLengthBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 6,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  inseamLengthIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  inseamLengthIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  inseamLengthEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  inseamLengthGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  inseamLengthGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  inseamLengthLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  inseamLengthLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  inseamLengthBetween(
    double? lower,
    double? upper, {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  neckCircumferenceIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  neckCircumferenceIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  neckCircumferenceEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  neckCircumferenceGreaterThan(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  neckCircumferenceGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  neckCircumferenceLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  neckCircumferenceLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  neckCircumferenceBetween(
    double? lower,
    double? upper, {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  shoulderWidthIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 9));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  shoulderWidthIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 9));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  shoulderWidthEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  shoulderWidthGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  shoulderWidthGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  shoulderWidthLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  shoulderWidthLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  shoulderWidthBetween(
    double? lower,
    double? upper, {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  totalHeightIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 10));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  totalHeightIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 10));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  totalHeightEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  totalHeightGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  totalHeightGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  totalHeightLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  totalHeightLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  totalHeightBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 10,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  armCircumferenceIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 11));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  armCircumferenceIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 11));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  armCircumferenceEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  armCircumferenceGreaterThan(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  armCircumferenceGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  armCircumferenceLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  armCircumferenceLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  armCircumferenceBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 11,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  skirtLengthIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 12));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  skirtLengthIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 12));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  skirtLengthEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  skirtLengthGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  skirtLengthGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  skirtLengthLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  skirtLengthLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  skirtLengthBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 12,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  pantsLengthIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 13));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  pantsLengthIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 13));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  pantsLengthEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 13, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  pantsLengthGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 13, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  pantsLengthGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 13, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  pantsLengthLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 13, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  pantsLengthLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 13, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  pantsLengthBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 13,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  customMeasurementsIsEmpty() {
    return not().customMeasurementsIsNotEmpty();
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  customMeasurementsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 14, value: null),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 15));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 15));
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 15, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 15, value: ''),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 15, value: ''),
      );
    });
  }

  QueryBuilder<MeasurementRecord, MeasurementRecord, QAfterFilterCondition>
  isEmptyEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 16, value: value),
      );
    });
  }
}

extension MeasurementRecordQueryObject
    on QueryBuilder<MeasurementRecord, MeasurementRecord, QFilterCondition> {}

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

final CustomMeasurementSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'CustomMeasurement',

    embedded: true,
    properties: [
      IsarPropertySchema(name: 'name', type: IsarType.string),
      IsarPropertySchema(name: 'value', type: IsarType.double),
    ],
    indexes: [],
  ),
  converter: IsarObjectConverter<void, CustomMeasurement>(
    serialize: serializeCustomMeasurement,
    deserialize: deserializeCustomMeasurement,
  ),
);

@isarProtected
int serializeCustomMeasurement(IsarWriter writer, CustomMeasurement object) {
  IsarCore.writeString(writer, 1, object.name);
  IsarCore.writeDouble(writer, 2, object.value);
  return 0;
}

@isarProtected
CustomMeasurement deserializeCustomMeasurement(IsarReader reader) {
  final object = CustomMeasurement();
  object.name = IsarCore.readString(reader, 1) ?? '';
  object.value = IsarCore.readDouble(reader, 2);
  return object;
}

extension CustomMeasurementQueryFilter
    on QueryBuilder<CustomMeasurement, CustomMeasurement, QFilterCondition> {
  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameBetween(String lower, String upper, {bool caseSensitive = true}) {
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

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  nameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  valueEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  valueGreaterThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  valueGreaterThanOrEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  valueLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  valueLessThanOrEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 2, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<CustomMeasurement, CustomMeasurement, QAfterFilterCondition>
  valueBetween(double lower, double upper, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 2,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }
}

extension CustomMeasurementQueryObject
    on QueryBuilder<CustomMeasurement, CustomMeasurement, QFilterCondition> {}
