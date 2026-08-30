// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'business_profile_model.dart';

// **************************************************************************
// _IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

extension GetBusinessProfileModelCollection on Isar {
  IsarCollection<int, BusinessProfileModel> get businessProfileModels =>
      this.collection();
}

final BusinessProfileModelSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'BusinessProfileModel',
    idName: 'id',
    embedded: false,
    properties: [
      IsarPropertySchema(name: 'businessName', type: IsarType.string),
      IsarPropertySchema(name: 'address', type: IsarType.string),
      IsarPropertySchema(name: 'phone', type: IsarType.string),
      IsarPropertySchema(name: 'email', type: IsarType.string),
      IsarPropertySchema(name: 'logoPath', type: IsarType.string),
      IsarPropertySchema(name: 'footerNote', type: IsarType.string),
      IsarPropertySchema(name: 'brandColorValue', type: IsarType.long),
      IsarPropertySchema(name: 'taxId', type: IsarType.string),
    ],
    indexes: [],
  ),
  converter: IsarObjectConverter<int, BusinessProfileModel>(
    serialize: serializeBusinessProfileModel,
    deserialize: deserializeBusinessProfileModel,
    deserializeProperty: deserializeBusinessProfileModelProp,
  ),
  getEmbeddedSchemas: () => [],
);

@isarProtected
int serializeBusinessProfileModel(
  IsarWriter writer,
  BusinessProfileModel object,
) {
  {
    final value = object.businessName;
    if (value == null) {
      IsarCore.writeNull(writer, 1);
    } else {
      IsarCore.writeString(writer, 1, value);
    }
  }
  {
    final value = object.address;
    if (value == null) {
      IsarCore.writeNull(writer, 2);
    } else {
      IsarCore.writeString(writer, 2, value);
    }
  }
  {
    final value = object.phone;
    if (value == null) {
      IsarCore.writeNull(writer, 3);
    } else {
      IsarCore.writeString(writer, 3, value);
    }
  }
  {
    final value = object.email;
    if (value == null) {
      IsarCore.writeNull(writer, 4);
    } else {
      IsarCore.writeString(writer, 4, value);
    }
  }
  {
    final value = object.logoPath;
    if (value == null) {
      IsarCore.writeNull(writer, 5);
    } else {
      IsarCore.writeString(writer, 5, value);
    }
  }
  {
    final value = object.footerNote;
    if (value == null) {
      IsarCore.writeNull(writer, 6);
    } else {
      IsarCore.writeString(writer, 6, value);
    }
  }
  IsarCore.writeLong(writer, 7, object.brandColorValue ?? -9223372036854775808);
  {
    final value = object.taxId;
    if (value == null) {
      IsarCore.writeNull(writer, 8);
    } else {
      IsarCore.writeString(writer, 8, value);
    }
  }
  return object.id;
}

@isarProtected
BusinessProfileModel deserializeBusinessProfileModel(IsarReader reader) {
  final String? _businessName;
  _businessName = IsarCore.readString(reader, 1);
  final String? _address;
  _address = IsarCore.readString(reader, 2);
  final String? _phone;
  _phone = IsarCore.readString(reader, 3);
  final String? _email;
  _email = IsarCore.readString(reader, 4);
  final String? _logoPath;
  _logoPath = IsarCore.readString(reader, 5);
  final String? _footerNote;
  _footerNote = IsarCore.readString(reader, 6);
  final int? _brandColorValue;
  {
    final value = IsarCore.readLong(reader, 7);
    if (value == -9223372036854775808) {
      _brandColorValue = null;
    } else {
      _brandColorValue = value;
    }
  }
  final String? _taxId;
  _taxId = IsarCore.readString(reader, 8);
  final object = BusinessProfileModel(
    businessName: _businessName,
    address: _address,
    phone: _phone,
    email: _email,
    logoPath: _logoPath,
    footerNote: _footerNote,
    brandColorValue: _brandColorValue,
    taxId: _taxId,
  );
  object.id = IsarCore.readId(reader);
  return object;
}

@isarProtected
dynamic deserializeBusinessProfileModelProp(IsarReader reader, int property) {
  switch (property) {
    case 0:
      return IsarCore.readId(reader);
    case 1:
      return IsarCore.readString(reader, 1);
    case 2:
      return IsarCore.readString(reader, 2);
    case 3:
      return IsarCore.readString(reader, 3);
    case 4:
      return IsarCore.readString(reader, 4);
    case 5:
      return IsarCore.readString(reader, 5);
    case 6:
      return IsarCore.readString(reader, 6);
    case 7:
      {
        final value = IsarCore.readLong(reader, 7);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return value;
        }
      }
    case 8:
      return IsarCore.readString(reader, 8);
    default:
      throw ArgumentError('Unknown property: $property');
  }
}

sealed class _BusinessProfileModelUpdate {
  bool call({
    required int id,
    String? businessName,
    String? address,
    String? phone,
    String? email,
    String? logoPath,
    String? footerNote,
    int? brandColorValue,
    String? taxId,
  });
}

class _BusinessProfileModelUpdateImpl implements _BusinessProfileModelUpdate {
  const _BusinessProfileModelUpdateImpl(this.collection);

  final IsarCollection<int, BusinessProfileModel> collection;

  @override
  bool call({
    required int id,
    Object? businessName = ignore,
    Object? address = ignore,
    Object? phone = ignore,
    Object? email = ignore,
    Object? logoPath = ignore,
    Object? footerNote = ignore,
    Object? brandColorValue = ignore,
    Object? taxId = ignore,
  }) {
    return collection.updateProperties(
          [id],
          {
            if (businessName != ignore) 1: businessName as String?,
            if (address != ignore) 2: address as String?,
            if (phone != ignore) 3: phone as String?,
            if (email != ignore) 4: email as String?,
            if (logoPath != ignore) 5: logoPath as String?,
            if (footerNote != ignore) 6: footerNote as String?,
            if (brandColorValue != ignore) 7: brandColorValue as int?,
            if (taxId != ignore) 8: taxId as String?,
          },
        ) >
        0;
  }
}

sealed class _BusinessProfileModelUpdateAll {
  int call({
    required List<int> id,
    String? businessName,
    String? address,
    String? phone,
    String? email,
    String? logoPath,
    String? footerNote,
    int? brandColorValue,
    String? taxId,
  });
}

class _BusinessProfileModelUpdateAllImpl
    implements _BusinessProfileModelUpdateAll {
  const _BusinessProfileModelUpdateAllImpl(this.collection);

  final IsarCollection<int, BusinessProfileModel> collection;

  @override
  int call({
    required List<int> id,
    Object? businessName = ignore,
    Object? address = ignore,
    Object? phone = ignore,
    Object? email = ignore,
    Object? logoPath = ignore,
    Object? footerNote = ignore,
    Object? brandColorValue = ignore,
    Object? taxId = ignore,
  }) {
    return collection.updateProperties(id, {
      if (businessName != ignore) 1: businessName as String?,
      if (address != ignore) 2: address as String?,
      if (phone != ignore) 3: phone as String?,
      if (email != ignore) 4: email as String?,
      if (logoPath != ignore) 5: logoPath as String?,
      if (footerNote != ignore) 6: footerNote as String?,
      if (brandColorValue != ignore) 7: brandColorValue as int?,
      if (taxId != ignore) 8: taxId as String?,
    });
  }
}

extension BusinessProfileModelUpdate
    on IsarCollection<int, BusinessProfileModel> {
  _BusinessProfileModelUpdate get update =>
      _BusinessProfileModelUpdateImpl(this);

  _BusinessProfileModelUpdateAll get updateAll =>
      _BusinessProfileModelUpdateAllImpl(this);
}

sealed class _BusinessProfileModelQueryUpdate {
  int call({
    String? businessName,
    String? address,
    String? phone,
    String? email,
    String? logoPath,
    String? footerNote,
    int? brandColorValue,
    String? taxId,
  });
}

class _BusinessProfileModelQueryUpdateImpl
    implements _BusinessProfileModelQueryUpdate {
  const _BusinessProfileModelQueryUpdateImpl(this.query, {this.limit});

  final IsarQuery<BusinessProfileModel> query;
  final int? limit;

  @override
  int call({
    Object? businessName = ignore,
    Object? address = ignore,
    Object? phone = ignore,
    Object? email = ignore,
    Object? logoPath = ignore,
    Object? footerNote = ignore,
    Object? brandColorValue = ignore,
    Object? taxId = ignore,
  }) {
    return query.updateProperties(limit: limit, {
      if (businessName != ignore) 1: businessName as String?,
      if (address != ignore) 2: address as String?,
      if (phone != ignore) 3: phone as String?,
      if (email != ignore) 4: email as String?,
      if (logoPath != ignore) 5: logoPath as String?,
      if (footerNote != ignore) 6: footerNote as String?,
      if (brandColorValue != ignore) 7: brandColorValue as int?,
      if (taxId != ignore) 8: taxId as String?,
    });
  }
}

extension BusinessProfileModelQueryUpdate on IsarQuery<BusinessProfileModel> {
  _BusinessProfileModelQueryUpdate get updateFirst =>
      _BusinessProfileModelQueryUpdateImpl(this, limit: 1);

  _BusinessProfileModelQueryUpdate get updateAll =>
      _BusinessProfileModelQueryUpdateImpl(this);
}

class _BusinessProfileModelQueryBuilderUpdateImpl
    implements _BusinessProfileModelQueryUpdate {
  const _BusinessProfileModelQueryBuilderUpdateImpl(this.query, {this.limit});

  final QueryBuilder<BusinessProfileModel, BusinessProfileModel, QOperations>
  query;
  final int? limit;

  @override
  int call({
    Object? businessName = ignore,
    Object? address = ignore,
    Object? phone = ignore,
    Object? email = ignore,
    Object? logoPath = ignore,
    Object? footerNote = ignore,
    Object? brandColorValue = ignore,
    Object? taxId = ignore,
  }) {
    final q = query.build();
    try {
      return q.updateProperties(limit: limit, {
        if (businessName != ignore) 1: businessName as String?,
        if (address != ignore) 2: address as String?,
        if (phone != ignore) 3: phone as String?,
        if (email != ignore) 4: email as String?,
        if (logoPath != ignore) 5: logoPath as String?,
        if (footerNote != ignore) 6: footerNote as String?,
        if (brandColorValue != ignore) 7: brandColorValue as int?,
        if (taxId != ignore) 8: taxId as String?,
      });
    } finally {
      q.close();
    }
  }
}

extension BusinessProfileModelQueryBuilderUpdate
    on QueryBuilder<BusinessProfileModel, BusinessProfileModel, QOperations> {
  _BusinessProfileModelQueryUpdate get updateFirst =>
      _BusinessProfileModelQueryBuilderUpdateImpl(this, limit: 1);

  _BusinessProfileModelQueryUpdate get updateAll =>
      _BusinessProfileModelQueryBuilderUpdateImpl(this);
}

extension BusinessProfileModelQueryFilter
    on
        QueryBuilder<
          BusinessProfileModel,
          BusinessProfileModel,
          QFilterCondition
        > {
  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
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
    BusinessProfileModel,
    BusinessProfileModel,
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
    BusinessProfileModel,
    BusinessProfileModel,
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  idLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 0, value: value));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
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
    BusinessProfileModel,
    BusinessProfileModel,
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 1));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 1));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameGreaterThan(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameStartsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameEndsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameContains(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameMatches(String pattern, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  businessNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 2));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 2));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressGreaterThan(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressStartsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressEndsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressContains(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressMatches(String pattern, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  addressIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneGreaterThan(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneStartsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneEndsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneContains(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneMatches(String pattern, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  phoneIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailGreaterThan(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailStartsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailEndsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailContains(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailMatches(String pattern, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  emailIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 5));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathGreaterThan(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 5, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathStartsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathEndsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathContains(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathMatches(String pattern, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 5, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  logoPathIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 5, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 6, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 6, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 6, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  footerNoteIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 6, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  brandColorValueIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  brandColorValueIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  brandColorValueEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 7, value: value),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  brandColorValueGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 7, value: value),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  brandColorValueGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 7, value: value),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  brandColorValueLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 7, value: value));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  brandColorValueLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 7, value: value),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  brandColorValueBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 7, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 8, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdGreaterThan(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 8, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdStartsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdEndsWith(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdContains(String value, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdMatches(String pattern, {bool caseSensitive = true}) {
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
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 8, value: ''),
      );
    });
  }

  QueryBuilder<
    BusinessProfileModel,
    BusinessProfileModel,
    QAfterFilterCondition
  >
  taxIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 8, value: ''),
      );
    });
  }
}

extension BusinessProfileModelQueryObject
    on
        QueryBuilder<
          BusinessProfileModel,
          BusinessProfileModel,
          QFilterCondition
        > {}

extension BusinessProfileModelQuerySortBy
    on QueryBuilder<BusinessProfileModel, BusinessProfileModel, QSortBy> {
  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByBusinessName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByBusinessNameDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByAddress({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByAddressDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByPhone({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByPhoneDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByEmail({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByEmailDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByLogoPath({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByLogoPathDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByFooterNote({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByFooterNoteDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByBrandColorValue() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByBrandColorValueDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByTaxId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  sortByTaxIdDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }
}

extension BusinessProfileModelQuerySortThenBy
    on QueryBuilder<BusinessProfileModel, BusinessProfileModel, QSortThenBy> {
  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByBusinessName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByBusinessNameDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByAddress({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByAddressDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByPhone({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByPhoneDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByEmail({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByEmailDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByLogoPath({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByLogoPathDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByFooterNote({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByFooterNoteDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByBrandColorValue() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByBrandColorValueDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByTaxId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterSortBy>
  thenByTaxIdDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }
}

extension BusinessProfileModelQueryWhereDistinct
    on QueryBuilder<BusinessProfileModel, BusinessProfileModel, QDistinct> {
  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterDistinct>
  distinctByBusinessName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterDistinct>
  distinctByAddress({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterDistinct>
  distinctByPhone({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterDistinct>
  distinctByEmail({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterDistinct>
  distinctByLogoPath({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(5, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterDistinct>
  distinctByFooterNote({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(6, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterDistinct>
  distinctByBrandColorValue() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(7);
    });
  }

  QueryBuilder<BusinessProfileModel, BusinessProfileModel, QAfterDistinct>
  distinctByTaxId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(8, caseSensitive: caseSensitive);
    });
  }
}

extension BusinessProfileModelQueryProperty1
    on QueryBuilder<BusinessProfileModel, BusinessProfileModel, QProperty> {
  QueryBuilder<BusinessProfileModel, int, QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<BusinessProfileModel, String?, QAfterProperty>
  businessNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<BusinessProfileModel, String?, QAfterProperty>
  addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<BusinessProfileModel, String?, QAfterProperty> phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<BusinessProfileModel, String?, QAfterProperty> emailProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<BusinessProfileModel, String?, QAfterProperty>
  logoPathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<BusinessProfileModel, String?, QAfterProperty>
  footerNoteProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<BusinessProfileModel, int?, QAfterProperty>
  brandColorValueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<BusinessProfileModel, String?, QAfterProperty> taxIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }
}

extension BusinessProfileModelQueryProperty2<R>
    on QueryBuilder<BusinessProfileModel, R, QAfterProperty> {
  QueryBuilder<BusinessProfileModel, (R, int), QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<BusinessProfileModel, (R, String?), QAfterProperty>
  businessNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<BusinessProfileModel, (R, String?), QAfterProperty>
  addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<BusinessProfileModel, (R, String?), QAfterProperty>
  phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<BusinessProfileModel, (R, String?), QAfterProperty>
  emailProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<BusinessProfileModel, (R, String?), QAfterProperty>
  logoPathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<BusinessProfileModel, (R, String?), QAfterProperty>
  footerNoteProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<BusinessProfileModel, (R, int?), QAfterProperty>
  brandColorValueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<BusinessProfileModel, (R, String?), QAfterProperty>
  taxIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }
}

extension BusinessProfileModelQueryProperty3<R1, R2>
    on QueryBuilder<BusinessProfileModel, (R1, R2), QAfterProperty> {
  QueryBuilder<BusinessProfileModel, (R1, R2, int), QOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<BusinessProfileModel, (R1, R2, String?), QOperations>
  businessNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<BusinessProfileModel, (R1, R2, String?), QOperations>
  addressProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<BusinessProfileModel, (R1, R2, String?), QOperations>
  phoneProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<BusinessProfileModel, (R1, R2, String?), QOperations>
  emailProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<BusinessProfileModel, (R1, R2, String?), QOperations>
  logoPathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<BusinessProfileModel, (R1, R2, String?), QOperations>
  footerNoteProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<BusinessProfileModel, (R1, R2, int?), QOperations>
  brandColorValueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<BusinessProfileModel, (R1, R2, String?), QOperations>
  taxIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }
}
