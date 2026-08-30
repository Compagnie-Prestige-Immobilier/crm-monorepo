// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'beneficiary_model.dart';

// **************************************************************************
// _IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

extension GetBeneficiaryModelCollection on Isar {
  IsarCollection<int, BeneficiaryModel> get beneficiaryModels =>
      this.collection();
}

final BeneficiaryModelSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'BeneficiaryModel',
    idName: 'id',
    embedded: false,
    properties: [
      IsarPropertySchema(name: 'clientId', type: IsarType.long),
      IsarPropertySchema(name: 'label', type: IsarType.string),
      IsarPropertySchema(
        name: 'gender',
        type: IsarType.byte,

        enumMap: {"male": 0, "female": 1, "child": 2},
      ),
      IsarPropertySchema(name: 'tourCou', type: IsarType.double),
      IsarPropertySchema(name: 'tourEpaule', type: IsarType.double),
      IsarPropertySchema(name: 'tourPoitrine', type: IsarType.double),
      IsarPropertySchema(name: 'tourTaille', type: IsarType.double),
      IsarPropertySchema(name: 'tourHanches', type: IsarType.double),
      IsarPropertySchema(name: 'longueurTotale', type: IsarType.double),
      IsarPropertySchema(name: 'epauleGenou', type: IsarType.double),
      IsarPropertySchema(name: 'tailleSol', type: IsarType.double),
      IsarPropertySchema(name: 'createdAt', type: IsarType.dateTime),
      IsarPropertySchema(
        name: 'measurementsUpdatedAt',
        type: IsarType.dateTime,
      ),
      IsarPropertySchema(name: 'notes', type: IsarType.string),
      IsarPropertySchema(name: 'hasMeasurements', type: IsarType.bool),
      IsarPropertySchema(name: 'genderIcon', type: IsarType.string),
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
  converter: IsarObjectConverter<int, BeneficiaryModel>(
    serialize: serializeBeneficiaryModel,
    deserialize: deserializeBeneficiaryModel,
    deserializeProperty: deserializeBeneficiaryModelProp,
  ),
  getEmbeddedSchemas: () => [],
);

@isarProtected
int serializeBeneficiaryModel(IsarWriter writer, BeneficiaryModel object) {
  IsarCore.writeLong(writer, 1, object.clientId);
  IsarCore.writeString(writer, 2, object.label);
  IsarCore.writeByte(writer, 3, object.gender.index);
  IsarCore.writeDouble(writer, 4, object.tourCou ?? double.nan);
  IsarCore.writeDouble(writer, 5, object.tourEpaule ?? double.nan);
  IsarCore.writeDouble(writer, 6, object.tourPoitrine ?? double.nan);
  IsarCore.writeDouble(writer, 7, object.tourTaille ?? double.nan);
  IsarCore.writeDouble(writer, 8, object.tourHanches ?? double.nan);
  IsarCore.writeDouble(writer, 9, object.longueurTotale ?? double.nan);
  IsarCore.writeDouble(writer, 10, object.epauleGenou ?? double.nan);
  IsarCore.writeDouble(writer, 11, object.tailleSol ?? double.nan);
  IsarCore.writeLong(
    writer,
    12,
    object.createdAt.toUtc().microsecondsSinceEpoch,
  );
  IsarCore.writeLong(
    writer,
    13,
    object.measurementsUpdatedAt?.toUtc().microsecondsSinceEpoch ??
        -9223372036854775808,
  );
  {
    final value = object.notes;
    if (value == null) {
      IsarCore.writeNull(writer, 14);
    } else {
      IsarCore.writeString(writer, 14, value);
    }
  }
  IsarCore.writeBool(writer, 15, value: object.hasMeasurements);
  IsarCore.writeString(writer, 16, object.genderIcon);
  return object.id;
}

@isarProtected
BeneficiaryModel deserializeBeneficiaryModel(IsarReader reader) {
  final object = BeneficiaryModel();
  object.id = IsarCore.readId(reader);
  object.clientId = IsarCore.readLong(reader, 1);
  object.label = IsarCore.readString(reader, 2) ?? '';
  {
    if (IsarCore.readNull(reader, 3)) {
      object.gender = BeneficiaryGender.male;
    } else {
      object.gender =
          _beneficiaryModelGender[IsarCore.readByte(reader, 3)] ??
          BeneficiaryGender.male;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 4);
    if (value.isNaN) {
      object.tourCou = null;
    } else {
      object.tourCou = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 5);
    if (value.isNaN) {
      object.tourEpaule = null;
    } else {
      object.tourEpaule = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 6);
    if (value.isNaN) {
      object.tourPoitrine = null;
    } else {
      object.tourPoitrine = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 7);
    if (value.isNaN) {
      object.tourTaille = null;
    } else {
      object.tourTaille = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 8);
    if (value.isNaN) {
      object.tourHanches = null;
    } else {
      object.tourHanches = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 9);
    if (value.isNaN) {
      object.longueurTotale = null;
    } else {
      object.longueurTotale = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 10);
    if (value.isNaN) {
      object.epauleGenou = null;
    } else {
      object.epauleGenou = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 11);
    if (value.isNaN) {
      object.tailleSol = null;
    } else {
      object.tailleSol = value;
    }
  }
  {
    final value = IsarCore.readLong(reader, 12);
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
    final value = IsarCore.readLong(reader, 13);
    if (value == -9223372036854775808) {
      object.measurementsUpdatedAt = null;
    } else {
      object.measurementsUpdatedAt = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  object.notes = IsarCore.readString(reader, 14);
  return object;
}

@isarProtected
dynamic deserializeBeneficiaryModelProp(IsarReader reader, int property) {
  switch (property) {
    case 0:
      return IsarCore.readId(reader);
    case 1:
      return IsarCore.readLong(reader, 1);
    case 2:
      return IsarCore.readString(reader, 2) ?? '';
    case 3:
      {
        if (IsarCore.readNull(reader, 3)) {
          return BeneficiaryGender.male;
        } else {
          return _beneficiaryModelGender[IsarCore.readByte(reader, 3)] ??
              BeneficiaryGender.male;
        }
      }
    case 4:
      {
        final value = IsarCore.readDouble(reader, 4);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 5:
      {
        final value = IsarCore.readDouble(reader, 5);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
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
      {
        final value = IsarCore.readDouble(reader, 8);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 9:
      {
        final value = IsarCore.readDouble(reader, 9);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 10:
      {
        final value = IsarCore.readDouble(reader, 10);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 11:
      {
        final value = IsarCore.readDouble(reader, 11);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 12:
      {
        final value = IsarCore.readLong(reader, 12);
        if (value == -9223372036854775808) {
          return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true).toLocal();
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 13:
      {
        final value = IsarCore.readLong(reader, 13);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 14:
      return IsarCore.readString(reader, 14);
    case 15:
      return IsarCore.readBool(reader, 15);
    case 16:
      return IsarCore.readString(reader, 16) ?? '';
    default:
      throw ArgumentError('Unknown property: $property');
  }
}

sealed class _BeneficiaryModelUpdate {
  bool call({
    required int id,
    int? clientId,
    String? label,
    BeneficiaryGender? gender,
    double? tourCou,
    double? tourEpaule,
    double? tourPoitrine,
    double? tourTaille,
    double? tourHanches,
    double? longueurTotale,
    double? epauleGenou,
    double? tailleSol,
    DateTime? createdAt,
    DateTime? measurementsUpdatedAt,
    String? notes,
    bool? hasMeasurements,
    String? genderIcon,
  });
}

class _BeneficiaryModelUpdateImpl implements _BeneficiaryModelUpdate {
  const _BeneficiaryModelUpdateImpl(this.collection);

  final IsarCollection<int, BeneficiaryModel> collection;

  @override
  bool call({
    required int id,
    Object? clientId = ignore,
    Object? label = ignore,
    Object? gender = ignore,
    Object? tourCou = ignore,
    Object? tourEpaule = ignore,
    Object? tourPoitrine = ignore,
    Object? tourTaille = ignore,
    Object? tourHanches = ignore,
    Object? longueurTotale = ignore,
    Object? epauleGenou = ignore,
    Object? tailleSol = ignore,
    Object? createdAt = ignore,
    Object? measurementsUpdatedAt = ignore,
    Object? notes = ignore,
    Object? hasMeasurements = ignore,
    Object? genderIcon = ignore,
  }) {
    return collection.updateProperties(
          [id],
          {
            if (clientId != ignore) 1: clientId as int?,
            if (label != ignore) 2: label as String?,
            if (gender != ignore) 3: gender as BeneficiaryGender?,
            if (tourCou != ignore) 4: tourCou as double?,
            if (tourEpaule != ignore) 5: tourEpaule as double?,
            if (tourPoitrine != ignore) 6: tourPoitrine as double?,
            if (tourTaille != ignore) 7: tourTaille as double?,
            if (tourHanches != ignore) 8: tourHanches as double?,
            if (longueurTotale != ignore) 9: longueurTotale as double?,
            if (epauleGenou != ignore) 10: epauleGenou as double?,
            if (tailleSol != ignore) 11: tailleSol as double?,
            if (createdAt != ignore) 12: createdAt as DateTime?,
            if (measurementsUpdatedAt != ignore)
              13: measurementsUpdatedAt as DateTime?,
            if (notes != ignore) 14: notes as String?,
            if (hasMeasurements != ignore) 15: hasMeasurements as bool?,
            if (genderIcon != ignore) 16: genderIcon as String?,
          },
        ) >
        0;
  }
}

sealed class _BeneficiaryModelUpdateAll {
  int call({
    required List<int> id,
    int? clientId,
    String? label,
    BeneficiaryGender? gender,
    double? tourCou,
    double? tourEpaule,
    double? tourPoitrine,
    double? tourTaille,
    double? tourHanches,
    double? longueurTotale,
    double? epauleGenou,
    double? tailleSol,
    DateTime? createdAt,
    DateTime? measurementsUpdatedAt,
    String? notes,
    bool? hasMeasurements,
    String? genderIcon,
  });
}

class _BeneficiaryModelUpdateAllImpl implements _BeneficiaryModelUpdateAll {
  const _BeneficiaryModelUpdateAllImpl(this.collection);

  final IsarCollection<int, BeneficiaryModel> collection;

  @override
  int call({
    required List<int> id,
    Object? clientId = ignore,
    Object? label = ignore,
    Object? gender = ignore,
    Object? tourCou = ignore,
    Object? tourEpaule = ignore,
    Object? tourPoitrine = ignore,
    Object? tourTaille = ignore,
    Object? tourHanches = ignore,
    Object? longueurTotale = ignore,
    Object? epauleGenou = ignore,
    Object? tailleSol = ignore,
    Object? createdAt = ignore,
    Object? measurementsUpdatedAt = ignore,
    Object? notes = ignore,
    Object? hasMeasurements = ignore,
    Object? genderIcon = ignore,
  }) {
    return collection.updateProperties(id, {
      if (clientId != ignore) 1: clientId as int?,
      if (label != ignore) 2: label as String?,
      if (gender != ignore) 3: gender as BeneficiaryGender?,
      if (tourCou != ignore) 4: tourCou as double?,
      if (tourEpaule != ignore) 5: tourEpaule as double?,
      if (tourPoitrine != ignore) 6: tourPoitrine as double?,
      if (tourTaille != ignore) 7: tourTaille as double?,
      if (tourHanches != ignore) 8: tourHanches as double?,
      if (longueurTotale != ignore) 9: longueurTotale as double?,
      if (epauleGenou != ignore) 10: epauleGenou as double?,
      if (tailleSol != ignore) 11: tailleSol as double?,
      if (createdAt != ignore) 12: createdAt as DateTime?,
      if (measurementsUpdatedAt != ignore)
        13: measurementsUpdatedAt as DateTime?,
      if (notes != ignore) 14: notes as String?,
      if (hasMeasurements != ignore) 15: hasMeasurements as bool?,
      if (genderIcon != ignore) 16: genderIcon as String?,
    });
  }
}

extension BeneficiaryModelUpdate on IsarCollection<int, BeneficiaryModel> {
  _BeneficiaryModelUpdate get update => _BeneficiaryModelUpdateImpl(this);

  _BeneficiaryModelUpdateAll get updateAll =>
      _BeneficiaryModelUpdateAllImpl(this);
}

sealed class _BeneficiaryModelQueryUpdate {
  int call({
    int? clientId,
    String? label,
    BeneficiaryGender? gender,
    double? tourCou,
    double? tourEpaule,
    double? tourPoitrine,
    double? tourTaille,
    double? tourHanches,
    double? longueurTotale,
    double? epauleGenou,
    double? tailleSol,
    DateTime? createdAt,
    DateTime? measurementsUpdatedAt,
    String? notes,
    bool? hasMeasurements,
    String? genderIcon,
  });
}

class _BeneficiaryModelQueryUpdateImpl implements _BeneficiaryModelQueryUpdate {
  const _BeneficiaryModelQueryUpdateImpl(this.query, {this.limit});

  final IsarQuery<BeneficiaryModel> query;
  final int? limit;

  @override
  int call({
    Object? clientId = ignore,
    Object? label = ignore,
    Object? gender = ignore,
    Object? tourCou = ignore,
    Object? tourEpaule = ignore,
    Object? tourPoitrine = ignore,
    Object? tourTaille = ignore,
    Object? tourHanches = ignore,
    Object? longueurTotale = ignore,
    Object? epauleGenou = ignore,
    Object? tailleSol = ignore,
    Object? createdAt = ignore,
    Object? measurementsUpdatedAt = ignore,
    Object? notes = ignore,
    Object? hasMeasurements = ignore,
    Object? genderIcon = ignore,
  }) {
    return query.updateProperties(limit: limit, {
      if (clientId != ignore) 1: clientId as int?,
      if (label != ignore) 2: label as String?,
      if (gender != ignore) 3: gender as BeneficiaryGender?,
      if (tourCou != ignore) 4: tourCou as double?,
      if (tourEpaule != ignore) 5: tourEpaule as double?,
      if (tourPoitrine != ignore) 6: tourPoitrine as double?,
      if (tourTaille != ignore) 7: tourTaille as double?,
      if (tourHanches != ignore) 8: tourHanches as double?,
      if (longueurTotale != ignore) 9: longueurTotale as double?,
      if (epauleGenou != ignore) 10: epauleGenou as double?,
      if (tailleSol != ignore) 11: tailleSol as double?,
      if (createdAt != ignore) 12: createdAt as DateTime?,
      if (measurementsUpdatedAt != ignore)
        13: measurementsUpdatedAt as DateTime?,
      if (notes != ignore) 14: notes as String?,
      if (hasMeasurements != ignore) 15: hasMeasurements as bool?,
      if (genderIcon != ignore) 16: genderIcon as String?,
    });
  }
}

extension BeneficiaryModelQueryUpdate on IsarQuery<BeneficiaryModel> {
  _BeneficiaryModelQueryUpdate get updateFirst =>
      _BeneficiaryModelQueryUpdateImpl(this, limit: 1);

  _BeneficiaryModelQueryUpdate get updateAll =>
      _BeneficiaryModelQueryUpdateImpl(this);
}

class _BeneficiaryModelQueryBuilderUpdateImpl
    implements _BeneficiaryModelQueryUpdate {
  const _BeneficiaryModelQueryBuilderUpdateImpl(this.query, {this.limit});

  final QueryBuilder<BeneficiaryModel, BeneficiaryModel, QOperations> query;
  final int? limit;

  @override
  int call({
    Object? clientId = ignore,
    Object? label = ignore,
    Object? gender = ignore,
    Object? tourCou = ignore,
    Object? tourEpaule = ignore,
    Object? tourPoitrine = ignore,
    Object? tourTaille = ignore,
    Object? tourHanches = ignore,
    Object? longueurTotale = ignore,
    Object? epauleGenou = ignore,
    Object? tailleSol = ignore,
    Object? createdAt = ignore,
    Object? measurementsUpdatedAt = ignore,
    Object? notes = ignore,
    Object? hasMeasurements = ignore,
    Object? genderIcon = ignore,
  }) {
    final q = query.build();
    try {
      return q.updateProperties(limit: limit, {
        if (clientId != ignore) 1: clientId as int?,
        if (label != ignore) 2: label as String?,
        if (gender != ignore) 3: gender as BeneficiaryGender?,
        if (tourCou != ignore) 4: tourCou as double?,
        if (tourEpaule != ignore) 5: tourEpaule as double?,
        if (tourPoitrine != ignore) 6: tourPoitrine as double?,
        if (tourTaille != ignore) 7: tourTaille as double?,
        if (tourHanches != ignore) 8: tourHanches as double?,
        if (longueurTotale != ignore) 9: longueurTotale as double?,
        if (epauleGenou != ignore) 10: epauleGenou as double?,
        if (tailleSol != ignore) 11: tailleSol as double?,
        if (createdAt != ignore) 12: createdAt as DateTime?,
        if (measurementsUpdatedAt != ignore)
          13: measurementsUpdatedAt as DateTime?,
        if (notes != ignore) 14: notes as String?,
        if (hasMeasurements != ignore) 15: hasMeasurements as bool?,
        if (genderIcon != ignore) 16: genderIcon as String?,
      });
    } finally {
      q.close();
    }
  }
}

extension BeneficiaryModelQueryBuilderUpdate
    on QueryBuilder<BeneficiaryModel, BeneficiaryModel, QOperations> {
  _BeneficiaryModelQueryUpdate get updateFirst =>
      _BeneficiaryModelQueryBuilderUpdateImpl(this, limit: 1);

  _BeneficiaryModelQueryUpdate get updateAll =>
      _BeneficiaryModelQueryBuilderUpdateImpl(this);
}

const _beneficiaryModelGender = {
  0: BeneficiaryGender.male,
  1: BeneficiaryGender.female,
  2: BeneficiaryGender.child,
};

extension BeneficiaryModelQueryFilter
    on QueryBuilder<BeneficiaryModel, BeneficiaryModel, QFilterCondition> {
  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  idEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  idGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  idGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  idLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 0, value: value));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  idLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  idBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 0, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  clientIdEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  clientIdGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 1, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  clientIdGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 1, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  clientIdLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 1, value: value));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  clientIdLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 1, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  clientIdBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 1, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelBetween(String lower, String upper, {bool caseSensitive = true}) {
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  labelIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderEqualTo(BeneficiaryGender value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderGreaterThan(BeneficiaryGender value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderGreaterThanOrEqualTo(BeneficiaryGender value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderLessThan(BeneficiaryGender value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderLessThanOrEqualTo(BeneficiaryGender value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 3, value: value.index),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderBetween(BeneficiaryGender lower, BeneficiaryGender upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 3, lower: lower.index, upper: upper.index),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourCouIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourCouIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourCouEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourCouGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourCouGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourCouLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourCouLessThanOrEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 4, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourCouBetween(
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourEpauleIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourEpauleIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourEpauleEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourEpauleGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourEpauleGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourEpauleLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourEpauleLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 5, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourEpauleBetween(
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourPoitrineIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourPoitrineIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourPoitrineEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourPoitrineGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourPoitrineGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourPoitrineLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourPoitrineLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 6, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourPoitrineBetween(
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourTailleIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourTailleIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourTailleEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourTailleGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourTailleGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourTailleLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourTailleLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 7, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourTailleBetween(
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourHanchesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourHanchesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourHanchesEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourHanchesGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourHanchesGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourHanchesLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourHanchesLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 8, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tourHanchesBetween(
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  longueurTotaleIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 9));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  longueurTotaleIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 9));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  longueurTotaleEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  longueurTotaleGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  longueurTotaleGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  longueurTotaleLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  longueurTotaleLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 9, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  longueurTotaleBetween(
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  epauleGenouIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 10));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  epauleGenouIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 10));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  epauleGenouEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  epauleGenouGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  epauleGenouGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  epauleGenouLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  epauleGenouLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 10, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  epauleGenouBetween(
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tailleSolIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 11));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tailleSolIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 11));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tailleSolEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tailleSolGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tailleSolGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tailleSolLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tailleSolLessThanOrEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 11, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  tailleSolBetween(
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

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  createdAtGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  createdAtGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  createdAtLessThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  createdAtLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  createdAtBetween(DateTime lower, DateTime upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 12, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  measurementsUpdatedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 13));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  measurementsUpdatedAtIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 13));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  measurementsUpdatedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  measurementsUpdatedAtGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  measurementsUpdatedAtGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  measurementsUpdatedAtLessThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  measurementsUpdatedAtLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  measurementsUpdatedAtBetween(DateTime? lower, DateTime? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 13, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 14));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 14));
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 14,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 14,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 14,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 14, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 14,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesBetween(String? lower, String? upper, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 14,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 14,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 14,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 14,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 14,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 14, value: ''),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 14, value: ''),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  hasMeasurementsEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 16,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 16,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 16,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 16, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 16,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconBetween(String lower, String upper, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 16,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 16,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 16,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 16,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 16,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 16, value: ''),
      );
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterFilterCondition>
  genderIconIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 16, value: ''),
      );
    });
  }
}

extension BeneficiaryModelQueryObject
    on QueryBuilder<BeneficiaryModel, BeneficiaryModel, QFilterCondition> {}

extension BeneficiaryModelQuerySortBy
    on QueryBuilder<BeneficiaryModel, BeneficiaryModel, QSortBy> {
  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy> sortById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByClientIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy> sortByLabel({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByLabelDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByGender() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByGenderDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourCou() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourCouDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourEpaule() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourEpauleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourPoitrine() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourPoitrineDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourTaille() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourTailleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourHanches() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTourHanchesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByLongueurTotale() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByLongueurTotaleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByEpauleGenou() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByEpauleGenouDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTailleSol() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByTailleSolDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByMeasurementsUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByMeasurementsUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy> sortByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByNotesDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByHasMeasurements() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByHasMeasurementsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByGenderIcon({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  sortByGenderIconDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }
}

extension BeneficiaryModelQuerySortThenBy
    on QueryBuilder<BeneficiaryModel, BeneficiaryModel, QSortThenBy> {
  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByClientIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy> thenByLabel({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByLabelDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByGender() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByGenderDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourCou() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourCouDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourEpaule() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourEpauleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourPoitrine() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourPoitrineDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourTaille() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourTailleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourHanches() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTourHanchesDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByLongueurTotale() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByLongueurTotaleDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByEpauleGenou() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByEpauleGenouDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTailleSol() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByTailleSolDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByMeasurementsUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByMeasurementsUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy> thenByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByNotesDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByHasMeasurements() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByHasMeasurementsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByGenderIcon({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterSortBy>
  thenByGenderIconDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }
}

extension BeneficiaryModelQueryWhereDistinct
    on QueryBuilder<BeneficiaryModel, BeneficiaryModel, QDistinct> {
  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(1);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByLabel({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByGender() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(3);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByTourCou() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(4);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByTourEpaule() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(5);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByTourPoitrine() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(6);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByTourTaille() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(7);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByTourHanches() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(8);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByLongueurTotale() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(9);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByEpauleGenou() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(10);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByTailleSol() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(11);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(12);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByMeasurementsUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(13);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByNotes({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(14, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByHasMeasurements() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(15);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryModel, QAfterDistinct>
  distinctByGenderIcon({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(16, caseSensitive: caseSensitive);
    });
  }
}

extension BeneficiaryModelQueryProperty1
    on QueryBuilder<BeneficiaryModel, BeneficiaryModel, QProperty> {
  QueryBuilder<BeneficiaryModel, int, QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<BeneficiaryModel, int, QAfterProperty> clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<BeneficiaryModel, String, QAfterProperty> labelProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<BeneficiaryModel, BeneficiaryGender, QAfterProperty>
  genderProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<BeneficiaryModel, double?, QAfterProperty> tourCouProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<BeneficiaryModel, double?, QAfterProperty> tourEpauleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<BeneficiaryModel, double?, QAfterProperty>
  tourPoitrineProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<BeneficiaryModel, double?, QAfterProperty> tourTailleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<BeneficiaryModel, double?, QAfterProperty>
  tourHanchesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<BeneficiaryModel, double?, QAfterProperty>
  longueurTotaleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<BeneficiaryModel, double?, QAfterProperty>
  epauleGenouProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<BeneficiaryModel, double?, QAfterProperty> tailleSolProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<BeneficiaryModel, DateTime, QAfterProperty> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<BeneficiaryModel, DateTime?, QAfterProperty>
  measurementsUpdatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<BeneficiaryModel, String?, QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<BeneficiaryModel, bool, QAfterProperty>
  hasMeasurementsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<BeneficiaryModel, String, QAfterProperty> genderIconProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }
}

extension BeneficiaryModelQueryProperty2<R>
    on QueryBuilder<BeneficiaryModel, R, QAfterProperty> {
  QueryBuilder<BeneficiaryModel, (R, int), QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, int), QAfterProperty> clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, String), QAfterProperty> labelProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, BeneficiaryGender), QAfterProperty>
  genderProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, double?), QAfterProperty>
  tourCouProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, double?), QAfterProperty>
  tourEpauleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, double?), QAfterProperty>
  tourPoitrineProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, double?), QAfterProperty>
  tourTailleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, double?), QAfterProperty>
  tourHanchesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, double?), QAfterProperty>
  longueurTotaleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, double?), QAfterProperty>
  epauleGenouProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, double?), QAfterProperty>
  tailleSolProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, DateTime), QAfterProperty>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, DateTime?), QAfterProperty>
  measurementsUpdatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, String?), QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, bool), QAfterProperty>
  hasMeasurementsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<BeneficiaryModel, (R, String), QAfterProperty>
  genderIconProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }
}

extension BeneficiaryModelQueryProperty3<R1, R2>
    on QueryBuilder<BeneficiaryModel, (R1, R2), QAfterProperty> {
  QueryBuilder<BeneficiaryModel, (R1, R2, int), QOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, int), QOperations>
  clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, String), QOperations>
  labelProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, BeneficiaryGender), QOperations>
  genderProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, double?), QOperations>
  tourCouProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, double?), QOperations>
  tourEpauleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, double?), QOperations>
  tourPoitrineProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, double?), QOperations>
  tourTailleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, double?), QOperations>
  tourHanchesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, double?), QOperations>
  longueurTotaleProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, double?), QOperations>
  epauleGenouProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, double?), QOperations>
  tailleSolProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, DateTime), QOperations>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, DateTime?), QOperations>
  measurementsUpdatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, String?), QOperations>
  notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, bool), QOperations>
  hasMeasurementsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<BeneficiaryModel, (R1, R2, String), QOperations>
  genderIconProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }
}
