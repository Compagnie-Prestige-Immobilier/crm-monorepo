// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'favorite_workshop_model.dart';

// **************************************************************************
// _IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

extension GetFavoriteWorkshopModelCollection on Isar {
  IsarCollection<int, FavoriteWorkshopModel> get favoriteWorkshopModels =>
      this.collection();
}

final FavoriteWorkshopModelSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'FavoriteWorkshopModel',
    idName: 'id',
    embedded: false,
    properties: [
      IsarPropertySchema(name: 'workshopId', type: IsarType.string),
      IsarPropertySchema(name: 'workshopName', type: IsarType.string),
      IsarPropertySchema(name: 'specialty', type: IsarType.string),
      IsarPropertySchema(name: 'phone', type: IsarType.string),
      IsarPropertySchema(name: 'address', type: IsarType.string),
      IsarPropertySchema(name: 'distanceKm', type: IsarType.double),
      IsarPropertySchema(name: 'rating', type: IsarType.double),
      IsarPropertySchema(name: 'imageUrl', type: IsarType.string),
      IsarPropertySchema(name: 'isVerified', type: IsarType.bool),
      IsarPropertySchema(name: 'createdAt', type: IsarType.dateTime),
    ],
    indexes: [],
  ),
  converter: IsarObjectConverter<int, FavoriteWorkshopModel>(
    serialize: serializeFavoriteWorkshopModel,
    deserialize: deserializeFavoriteWorkshopModel,
    deserializeProperty: deserializeFavoriteWorkshopModelProp,
  ),
  getEmbeddedSchemas: () => [],
);

@isarProtected
int serializeFavoriteWorkshopModel(
  IsarWriter writer,
  FavoriteWorkshopModel object,
) {
  IsarCore.writeString(writer, 1, object.workshopId);
  IsarCore.writeString(writer, 2, object.workshopName);
  {
    final value = object.specialty;
    if (value == null) {
      IsarCore.writeNull(writer, 3);
    } else {
      IsarCore.writeString(writer, 3, value);
    }
  }
  {
    final value = object.phone;
    if (value == null) {
      IsarCore.writeNull(writer, 4);
    } else {
      IsarCore.writeString(writer, 4, value);
    }
  }
  {
    final value = object.address;
    if (value == null) {
      IsarCore.writeNull(writer, 5);
    } else {
      IsarCore.writeString(writer, 5, value);
    }
  }
  IsarCore.writeDouble(writer, 6, object.distanceKm ?? double.nan);
  IsarCore.writeDouble(writer, 7, object.rating ?? double.nan);
  {
    final value = object.imageUrl;
    if (value == null) {
      IsarCore.writeNull(writer, 8);
    } else {
      IsarCore.writeString(writer, 8, value);
    }
  }
  IsarCore.writeBool(writer, 9, value: object.isVerified);
  IsarCore.writeLong(
    writer,
    10,
    object.createdAt.toUtc().microsecondsSinceEpoch,
  );
  return object.id;
}

@isarProtected
FavoriteWorkshopModel deserializeFavoriteWorkshopModel(IsarReader reader) {
  final String _workshopId;
  _workshopId = IsarCore.readString(reader, 1) ?? '';
  final String _workshopName;
  _workshopName = IsarCore.readString(reader, 2) ?? '';
  final String? _specialty;
  _specialty = IsarCore.readString(reader, 3);
  final String? _phone;
  _phone = IsarCore.readString(reader, 4);
  final String? _address;
  _address = IsarCore.readString(reader, 5);
  final double? _distanceKm;
  {
    final value = IsarCore.readDouble(reader, 6);
    if (value.isNaN) {
      _distanceKm = null;
    } else {
      _distanceKm = value;
    }
  }
  final double? _rating;
  {
    final value = IsarCore.readDouble(reader, 7);
    if (value.isNaN) {
      _rating = null;
    } else {
      _rating = value;
    }
  }
  final String? _imageUrl;
  _imageUrl = IsarCore.readString(reader, 8);
  final bool _isVerified;
  _isVerified = IsarCore.readBool(reader, 9);
  final object = FavoriteWorkshopModel(
    workshopId: _workshopId,
    workshopName: _workshopName,
    specialty: _specialty,
    phone: _phone,
    address: _address,
    distanceKm: _distanceKm,
    rating: _rating,
    imageUrl: _imageUrl,
    isVerified: _isVerified,
  );
  object.id = IsarCore.readId(reader);
  {
    final value = IsarCore.readLong(reader, 10);
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
  return object;
}

@isarProtected
dynamic deserializeFavoriteWorkshopModelProp(IsarReader reader, int property) {
  switch (property) {
    case 0:
      return IsarCore.readId(reader);
    case 1:
      return IsarCore.readString(reader, 1) ?? '';
    case 2:
      return IsarCore.readString(reader, 2) ?? '';
    case 3:
      return IsarCore.readString(reader, 3);
    case 4:
      return IsarCore.readString(reader, 4);
    case 5:
      return IsarCore.readString(reader, 5);
    case 6:
      {
        final value = IsarCore.readDouble(reader, 6);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 7:
      {
        final value = IsarCore.readDouble(reader, 7);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 8:
      return IsarCore.readString(reader, 8);
    case 9:
      return IsarCore.readBool(reader, 9);
    case 10:
      {
        final value = IsarCore.readLong(reader, 10);
        if (value == -9223372036854775808) {
          return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true).toLocal();
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    default:
      throw ArgumentError('Unknown property: $property');
  }
}

sealed class _FavoriteWorkshopModelUpdate {
  bool call({
    required int id,
    String? workshopId,
    String? workshopName,
    String? specialty,
    String? phone,
    String? address,
    double? distanceKm,
    double? rating,
    String? imageUrl,
    bool? isVerified,
    DateTime? createdAt,
  });
}

class _FavoriteWorkshopModelUpdateImpl implements _FavoriteWorkshopModelUpdate {
  const _FavoriteWorkshopModelUpdateImpl(this.collection);

  final IsarCollection<int, FavoriteWorkshopModel> collection;

  @override
  bool call({
    required int id,
    Object? workshopId = ignore,
    Object? workshopName = ignore,
    Object? specialty = ignore,
    Object? phone = ignore,
    Object? address = ignore,
    Object? distanceKm = ignore,
    Object? rating = ignore,
    Object? imageUrl = ignore,
    Object? isVerified = ignore,
    Object? createdAt = ignore,
  }) {
    return collection.updateProperties(
          [id],
          {
            if (workshopId != ignore) 1: workshopId as String?,
            if (workshopName != ignore) 2: workshopName as String?,
            if (specialty != ignore) 3: specialty as String?,
            if (phone != ignore) 4: phone as String?,
            if (address != ignore) 5: address as String?,
            if (distanceKm != ignore) 6: distanceKm as double?,
            if (rating != ignore) 7: rating as double?,
            if (imageUrl != ignore) 8: imageUrl as String?,
            if (isVerified != ignore) 9: isVerified as bool?,
            if (createdAt != ignore) 10: createdAt as DateTime?,
          },
        ) >
        0;
  }
}

sealed class _FavoriteWorkshopModelUpdateAll {
  int call({
    required List<int> id,
    String? workshopId,
    String? workshopName,
    String? specialty,
    String? phone,
    String? address,
    double? distanceKm,
    double? rating,
    String? imageUrl,
    bool? isVerified,
    DateTime? createdAt,
  });
}

class _FavoriteWorkshopModelUpdateAllImpl
    implements _FavoriteWorkshopModelUpdateAll {
  const _FavoriteWorkshopModelUpdateAllImpl(this.collection);

  final IsarCollection<int, FavoriteWorkshopModel> collection;

  @override
  int call({
    required List<int> id,
    Object? workshopId = ignore,
    Object? workshopName = ignore,
    Object? specialty = ignore,
    Object? phone = ignore,
    Object? address = ignore,
    Object? distanceKm = ignore,
    Object? rating = ignore,
    Object? imageUrl = ignore,
    Object? isVerified = ignore,
    Object? createdAt = ignore,
  }) {
    return collection.updateProperties(id, {
      if (workshopId != ignore) 1: workshopId as String?,
      if (workshopName != ignore) 2: workshopName as String?,
      if (specialty != ignore) 3: specialty as String?,
      if (phone != ignore) 4: phone as String?,
      if (address != ignore) 5: address as String?,
      if (distanceKm != ignore) 6: distanceKm as double?,
      if (rating != ignore) 7: rating as double?,
      if (imageUrl != ignore) 8: imageUrl as String?,
      if (isVerified != ignore) 9: isVerified as bool?,
      if (createdAt != ignore) 10: createdAt as DateTime?,
    });
  }
}

extension FavoriteWorkshopModelUpdate
    on IsarCollection<int, FavoriteWorkshopModel> {
  _FavoriteWorkshopModelUpdate get update =>
      _FavoriteWorkshopModelUpdateImpl(this);

  _FavoriteWorkshopModelUpdateAll get updateAll =>
      _FavoriteWorkshopModelUpdateAllImpl(this);
}

sealed class _FavoriteWorkshopModelQueryUpdate {
  int call({
    String? workshopId,
    String? workshopName,
    String? specialty,
    String? phone,
    String? address,
    double? distanceKm,
    double? rating,
    String? imageUrl,
    bool? isVerified,
    DateTime? createdAt,
  });
}

class _FavoriteWorkshopModelQueryUpdateImpl
    implements _FavoriteWorkshopModelQueryUpdate {
  const _FavoriteWorkshopModelQueryUpdateImpl(this.query, {this.limit});

  final IsarQuery<FavoriteWorkshopModel> query;
  final int? limit;

  @override
  int call({
    Object? workshopId = ignore,
    Object? workshopName = ignore,
    Object? specialty = ignore,
    Object? phone = ignore,
    Object? address = ignore,
    Object? distanceKm = ignore,
    Object? rating = ignore,
    Object? imageUrl = ignore,
    Object? isVerified = ignore,
    Object? createdAt = ignore,
  }) {
    return query.updateProperties(limit: limit, {
      if (workshopId != ignore) 1: workshopId as String?,
      if (workshopName != ignore) 2: workshopName as String?,
      if (specialty != ignore) 3: specialty as String?,
      if (phone != ignore) 4: phone as String?,
      if (address != ignore) 5: address as String?,
      if (distanceKm != ignore) 6: distanceKm as double?,
      if (rating != ignore) 7: rating as double?,
      if (imageUrl != ignore) 8: imageUrl as String?,
      if (isVerified != ignore) 9: isVerified as bool?,
      if (createdAt != ignore) 10: createdAt as DateTime?,
    });
  }
}

extension FavoriteWorkshopModelQueryUpdate on IsarQuery<FavoriteWorkshopModel> {
  _FavoriteWorkshopModelQueryUpdate get updateFirst =>
      _FavoriteWorkshopModelQueryUpdateImpl(this, limit: 1);

  _FavoriteWorkshopModelQueryUpdate get updateAll =>
      _FavoriteWorkshopModelQueryUpdateImpl(this);
}

class _FavoriteWorkshopModelQueryBuilderUpdateImpl
    implements _FavoriteWorkshopModelQueryUpdate {
  const _FavoriteWorkshopModelQueryBuilderUpdateImpl(this.query, {this.limit});

  final QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QOperations>
  query;
  final int? limit;

  @override
  int call({
    Object? workshopId = ignore,
    Object? workshopName = ignore,
    Object? specialty = ignore,
    Object? phone = ignore,
    Object? address = ignore,
    Object? distanceKm = ignore,
    Object? rating = ignore,
    Object? imageUrl = ignore,
    Object? isVerified = ignore,
    Object? createdAt = ignore,
  }) {
    final q = query.build();
    try {
      return q.updateProperties(limit: limit, {
        if (workshopId != ignore) 1: workshopId as String?,
        if (workshopName != ignore) 2: workshopName as String?,
        if (specialty != ignore) 3: specialty as String?,
        if (phone != ignore) 4: phone as String?,
        if (address != ignore) 5: address as String?,
        if (distanceKm != ignore) 6: distanceKm as double?,
        if (rating != ignore) 7: rating as double?,
        if (imageUrl != ignore) 8: imageUrl as String?,
        if (isVerified != ignore) 9: isVerified as bool?,
        if (createdAt != ignore) 10: createdAt as DateTime?,
      });
    } finally {
      q.close();
    }
  }
}

extension FavoriteWorkshopModelQueryBuilderUpdate
    on QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QOperations> {
  _FavoriteWorkshopModelQueryUpdate get updateFirst =>
      _FavoriteWorkshopModelQueryBuilderUpdateImpl(this, limit: 1);

  _FavoriteWorkshopModelQueryUpdate get updateAll =>
      _FavoriteWorkshopModelQueryBuilderUpdateImpl(this);
}

extension FavoriteWorkshopModelQueryFilter
    on
        QueryBuilder<
          FavoriteWorkshopModel,
          FavoriteWorkshopModel,
          QFilterCondition
        > {
  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  idEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  idGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  idGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  idLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 0, value: value));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  idLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  idBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 0, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdBetween(String lower, String upper, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameBetween(String lower, String upper, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  workshopNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  specialtyIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  phoneIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 5, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 5, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  addressIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 5, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  distanceKmIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  distanceKmIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  distanceKmEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  distanceKmGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  distanceKmGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  distanceKmLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  distanceKmLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  distanceKmBetween(
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  ratingIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  ratingIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  ratingEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  ratingGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  ratingGreaterThanOrEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  ratingLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  ratingLessThanOrEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  ratingBetween(
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

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 8, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 8,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 8,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 8, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 8,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlBetween(String? lower, String? upper, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 8,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 8,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 8,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 8,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 8,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 8, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  imageUrlIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 8, value: ''),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  isVerifiedEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 9, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 10, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  createdAtGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 10, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  createdAtGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 10, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  createdAtLessThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 10, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  createdAtLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 10, value: value),
      );
    });
  }

  QueryBuilder<
    FavoriteWorkshopModel,
    FavoriteWorkshopModel,
    QAfterFilterCondition
  >
  createdAtBetween(DateTime lower, DateTime upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 10, lower: lower, upper: upper),
      );
    });
  }
}

extension FavoriteWorkshopModelQueryObject
    on
        QueryBuilder<
          FavoriteWorkshopModel,
          FavoriteWorkshopModel,
          QFilterCondition
        > {}

extension FavoriteWorkshopModelQuerySortBy
    on QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QSortBy> {
  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByWorkshopId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByWorkshopIdDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByWorkshopName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByWorkshopNameDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortBySpecialty({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortBySpecialtyDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByPhone({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByPhoneDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByAddress({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByAddressDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByDistanceKm() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByDistanceKmDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByRating() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByRatingDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByImageUrl({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByImageUrlDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByIsVerified() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByIsVerifiedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc);
    });
  }
}

extension FavoriteWorkshopModelQuerySortThenBy
    on QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QSortThenBy> {
  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByWorkshopId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByWorkshopIdDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByWorkshopName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByWorkshopNameDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenBySpecialty({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenBySpecialtyDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByPhone({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByPhoneDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByAddress({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByAddressDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByDistanceKm() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByDistanceKmDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByRating() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByRatingDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByImageUrl({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByImageUrlDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByIsVerified() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByIsVerifiedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterSortBy>
  thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc);
    });
  }
}

extension FavoriteWorkshopModelQueryWhereDistinct
    on QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QDistinct> {
  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByWorkshopId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByWorkshopName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctBySpecialty({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByPhone({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByAddress({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByDistanceKm() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(6);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByRating() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(7);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByImageUrl({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(8, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByIsVerified() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(9);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QAfterDistinct>
  distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(10);
    });
  }
}

extension FavoriteWorkshopModelQueryProperty1
    on QueryBuilder<FavoriteWorkshopModel, FavoriteWorkshopModel, QProperty> {
  QueryBuilder<FavoriteWorkshopModel, int, QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, String, QAfterProperty>
  workshopIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, String, QAfterProperty>
  workshopNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, String?, QAfterProperty>
  specialtyProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, String?, QAfterProperty> phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, String?, QAfterProperty>
  addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, double?, QAfterProperty>
  distanceKmProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, double?, QAfterProperty>
  ratingProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, String?, QAfterProperty>
  imageUrlProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, bool, QAfterProperty>
  isVerifiedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, DateTime, QAfterProperty>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }
}

extension FavoriteWorkshopModelQueryProperty2<R>
    on QueryBuilder<FavoriteWorkshopModel, R, QAfterProperty> {
  QueryBuilder<FavoriteWorkshopModel, (R, int), QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, String), QAfterProperty>
  workshopIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, String), QAfterProperty>
  workshopNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, String?), QAfterProperty>
  specialtyProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, String?), QAfterProperty>
  phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, String?), QAfterProperty>
  addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, double?), QAfterProperty>
  distanceKmProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, double?), QAfterProperty>
  ratingProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, String?), QAfterProperty>
  imageUrlProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, bool), QAfterProperty>
  isVerifiedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R, DateTime), QAfterProperty>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }
}

extension FavoriteWorkshopModelQueryProperty3<R1, R2>
    on QueryBuilder<FavoriteWorkshopModel, (R1, R2), QAfterProperty> {
  QueryBuilder<FavoriteWorkshopModel, (R1, R2, int), QOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, String), QOperations>
  workshopIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, String), QOperations>
  workshopNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, String?), QOperations>
  specialtyProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, String?), QOperations>
  phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, String?), QOperations>
  addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, double?), QOperations>
  distanceKmProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, double?), QOperations>
  ratingProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, String?), QOperations>
  imageUrlProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, bool), QOperations>
  isVerifiedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<FavoriteWorkshopModel, (R1, R2, DateTime), QOperations>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }
}
