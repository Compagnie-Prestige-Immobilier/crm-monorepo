// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pattern_model.dart';

// **************************************************************************
// _IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

extension GetPatternModelCollection on Isar {
  IsarCollection<int, PatternModel> get patternModels => this.collection();
}

final PatternModelSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'PatternModel',
    idName: 'id',
    embedded: false,
    properties: [
      IsarPropertySchema(name: 'name', type: IsarType.string),
      IsarPropertySchema(
        name: 'category',
        type: IsarType.byte,

        enumMap: {
          "dress": 0,
          "pants": 1,
          "shirt": 2,
          "skirt": 3,
          "jacket": 4,
          "accessory": 5,
          "other": 6,
        },
      ),
      IsarPropertySchema(name: 'description', type: IsarType.string),
      IsarPropertySchema(name: 'pdfPath', type: IsarType.string),
      IsarPropertySchema(name: 'photoUrls', type: IsarType.stringList),
      IsarPropertySchema(name: 'tags', type: IsarType.stringList),
      IsarPropertySchema(
        name: 'difficulty',
        type: IsarType.byte,

        enumMap: {"beginner": 0, "intermediate": 1, "advanced": 2, "expert": 3},
      ),
      IsarPropertySchema(name: 'estimatedTimeInHours', type: IsarType.long),
      IsarPropertySchema(name: 'instructions', type: IsarType.string),
      IsarPropertySchema(name: 'notes', type: IsarType.string),
      IsarPropertySchema(name: 'galleryPhotoUrls', type: IsarType.stringList),
      IsarPropertySchema(name: 'createdAt', type: IsarType.dateTime),
      IsarPropertySchema(name: 'updatedAt', type: IsarType.dateTime),
      IsarPropertySchema(name: 'timesUsed', type: IsarType.long),
      IsarPropertySchema(name: 'searchableName', type: IsarType.string),
      IsarPropertySchema(name: 'estimatedTimeDisplay', type: IsarType.string),
      IsarPropertySchema(name: 'difficultyDisplay', type: IsarType.string),
      IsarPropertySchema(name: 'categoryDisplay', type: IsarType.string),
    ],
    indexes: [
      IsarIndexSchema(
        name: 'searchableName',
        properties: ["searchableName"],
        unique: false,
        hash: false,
      ),
    ],
  ),
  converter: IsarObjectConverter<int, PatternModel>(
    serialize: serializePatternModel,
    deserialize: deserializePatternModel,
    deserializeProperty: deserializePatternModelProp,
  ),
  getEmbeddedSchemas: () => [],
);

@isarProtected
int serializePatternModel(IsarWriter writer, PatternModel object) {
  IsarCore.writeString(writer, 1, object.name);
  IsarCore.writeByte(writer, 2, object.category.index);
  {
    final value = object.description;
    if (value == null) {
      IsarCore.writeNull(writer, 3);
    } else {
      IsarCore.writeString(writer, 3, value);
    }
  }
  {
    final value = object.pdfPath;
    if (value == null) {
      IsarCore.writeNull(writer, 4);
    } else {
      IsarCore.writeString(writer, 4, value);
    }
  }
  {
    final list = object.photoUrls;
    final listWriter = IsarCore.beginList(writer, 5, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeString(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  {
    final list = object.tags;
    final listWriter = IsarCore.beginList(writer, 6, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeString(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  IsarCore.writeByte(writer, 7, object.difficulty.index);
  IsarCore.writeLong(
    writer,
    8,
    object.estimatedTimeInHours ?? -9223372036854775808,
  );
  {
    final value = object.instructions;
    if (value == null) {
      IsarCore.writeNull(writer, 9);
    } else {
      IsarCore.writeString(writer, 9, value);
    }
  }
  {
    final value = object.notes;
    if (value == null) {
      IsarCore.writeNull(writer, 10);
    } else {
      IsarCore.writeString(writer, 10, value);
    }
  }
  {
    final list = object.galleryPhotoUrls;
    final listWriter = IsarCore.beginList(writer, 11, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeString(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  IsarCore.writeLong(
    writer,
    12,
    object.createdAt.toUtc().microsecondsSinceEpoch,
  );
  IsarCore.writeLong(
    writer,
    13,
    object.updatedAt?.toUtc().microsecondsSinceEpoch ?? -9223372036854775808,
  );
  IsarCore.writeLong(writer, 14, object.timesUsed);
  {
    final value = object.searchableName;
    if (value == null) {
      IsarCore.writeNull(writer, 15);
    } else {
      IsarCore.writeString(writer, 15, value);
    }
  }
  {
    final value = object.estimatedTimeDisplay;
    if (value == null) {
      IsarCore.writeNull(writer, 16);
    } else {
      IsarCore.writeString(writer, 16, value);
    }
  }
  IsarCore.writeString(writer, 17, object.difficultyDisplay);
  IsarCore.writeString(writer, 18, object.categoryDisplay);
  return object.id;
}

@isarProtected
PatternModel deserializePatternModel(IsarReader reader) {
  final object = PatternModel();
  object.id = IsarCore.readId(reader);
  object.name = IsarCore.readString(reader, 1) ?? '';
  {
    if (IsarCore.readNull(reader, 2)) {
      object.category = PatternCategory.dress;
    } else {
      object.category =
          _patternModelCategory[IsarCore.readByte(reader, 2)] ??
          PatternCategory.dress;
    }
  }
  object.description = IsarCore.readString(reader, 3);
  object.pdfPath = IsarCore.readString(reader, 4);
  {
    final length = IsarCore.readList(reader, 5, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.photoUrls = const <String>[];
      } else {
        final list = List<String>.filled(length, '', growable: true);
        for (var i = 0; i < length; i++) {
          list[i] = IsarCore.readString(reader, i) ?? '';
        }
        IsarCore.freeReader(reader);
        object.photoUrls = list;
      }
    }
  }
  {
    final length = IsarCore.readList(reader, 6, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.tags = const <String>[];
      } else {
        final list = List<String>.filled(length, '', growable: true);
        for (var i = 0; i < length; i++) {
          list[i] = IsarCore.readString(reader, i) ?? '';
        }
        IsarCore.freeReader(reader);
        object.tags = list;
      }
    }
  }
  {
    if (IsarCore.readNull(reader, 7)) {
      object.difficulty = DifficultyLevel.beginner;
    } else {
      object.difficulty =
          _patternModelDifficulty[IsarCore.readByte(reader, 7)] ??
          DifficultyLevel.beginner;
    }
  }
  {
    final value = IsarCore.readLong(reader, 8);
    if (value == -9223372036854775808) {
      object.estimatedTimeInHours = null;
    } else {
      object.estimatedTimeInHours = value;
    }
  }
  object.instructions = IsarCore.readString(reader, 9);
  object.notes = IsarCore.readString(reader, 10);
  {
    final length = IsarCore.readList(reader, 11, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.galleryPhotoUrls = const <String>[];
      } else {
        final list = List<String>.filled(length, '', growable: true);
        for (var i = 0; i < length; i++) {
          list[i] = IsarCore.readString(reader, i) ?? '';
        }
        IsarCore.freeReader(reader);
        object.galleryPhotoUrls = list;
      }
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
      object.updatedAt = null;
    } else {
      object.updatedAt = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  object.timesUsed = IsarCore.readLong(reader, 14);
  object.searchableName = IsarCore.readString(reader, 15);
  return object;
}

@isarProtected
dynamic deserializePatternModelProp(IsarReader reader, int property) {
  switch (property) {
    case 0:
      return IsarCore.readId(reader);
    case 1:
      return IsarCore.readString(reader, 1) ?? '';
    case 2:
      {
        if (IsarCore.readNull(reader, 2)) {
          return PatternCategory.dress;
        } else {
          return _patternModelCategory[IsarCore.readByte(reader, 2)] ??
              PatternCategory.dress;
        }
      }
    case 3:
      return IsarCore.readString(reader, 3);
    case 4:
      return IsarCore.readString(reader, 4);
    case 5:
      {
        final length = IsarCore.readList(reader, 5, IsarCore.readerPtrPtr);
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
    case 6:
      {
        final length = IsarCore.readList(reader, 6, IsarCore.readerPtrPtr);
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
    case 7:
      {
        if (IsarCore.readNull(reader, 7)) {
          return DifficultyLevel.beginner;
        } else {
          return _patternModelDifficulty[IsarCore.readByte(reader, 7)] ??
              DifficultyLevel.beginner;
        }
      }
    case 8:
      {
        final value = IsarCore.readLong(reader, 8);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return value;
        }
      }
    case 9:
      return IsarCore.readString(reader, 9);
    case 10:
      return IsarCore.readString(reader, 10);
    case 11:
      {
        final length = IsarCore.readList(reader, 11, IsarCore.readerPtrPtr);
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
      return IsarCore.readLong(reader, 14);
    case 15:
      return IsarCore.readString(reader, 15);
    case 16:
      return IsarCore.readString(reader, 16);
    case 17:
      return IsarCore.readString(reader, 17) ?? '';
    case 18:
      return IsarCore.readString(reader, 18) ?? '';
    default:
      throw ArgumentError('Unknown property: $property');
  }
}

sealed class _PatternModelUpdate {
  bool call({
    required int id,
    String? name,
    PatternCategory? category,
    String? description,
    String? pdfPath,
    DifficultyLevel? difficulty,
    int? estimatedTimeInHours,
    String? instructions,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? timesUsed,
    String? searchableName,
    String? estimatedTimeDisplay,
    String? difficultyDisplay,
    String? categoryDisplay,
  });
}

class _PatternModelUpdateImpl implements _PatternModelUpdate {
  const _PatternModelUpdateImpl(this.collection);

  final IsarCollection<int, PatternModel> collection;

  @override
  bool call({
    required int id,
    Object? name = ignore,
    Object? category = ignore,
    Object? description = ignore,
    Object? pdfPath = ignore,
    Object? difficulty = ignore,
    Object? estimatedTimeInHours = ignore,
    Object? instructions = ignore,
    Object? notes = ignore,
    Object? createdAt = ignore,
    Object? updatedAt = ignore,
    Object? timesUsed = ignore,
    Object? searchableName = ignore,
    Object? estimatedTimeDisplay = ignore,
    Object? difficultyDisplay = ignore,
    Object? categoryDisplay = ignore,
  }) {
    return collection.updateProperties(
          [id],
          {
            if (name != ignore) 1: name as String?,
            if (category != ignore) 2: category as PatternCategory?,
            if (description != ignore) 3: description as String?,
            if (pdfPath != ignore) 4: pdfPath as String?,
            if (difficulty != ignore) 7: difficulty as DifficultyLevel?,
            if (estimatedTimeInHours != ignore) 8: estimatedTimeInHours as int?,
            if (instructions != ignore) 9: instructions as String?,
            if (notes != ignore) 10: notes as String?,
            if (createdAt != ignore) 12: createdAt as DateTime?,
            if (updatedAt != ignore) 13: updatedAt as DateTime?,
            if (timesUsed != ignore) 14: timesUsed as int?,
            if (searchableName != ignore) 15: searchableName as String?,
            if (estimatedTimeDisplay != ignore)
              16: estimatedTimeDisplay as String?,
            if (difficultyDisplay != ignore) 17: difficultyDisplay as String?,
            if (categoryDisplay != ignore) 18: categoryDisplay as String?,
          },
        ) >
        0;
  }
}

sealed class _PatternModelUpdateAll {
  int call({
    required List<int> id,
    String? name,
    PatternCategory? category,
    String? description,
    String? pdfPath,
    DifficultyLevel? difficulty,
    int? estimatedTimeInHours,
    String? instructions,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? timesUsed,
    String? searchableName,
    String? estimatedTimeDisplay,
    String? difficultyDisplay,
    String? categoryDisplay,
  });
}

class _PatternModelUpdateAllImpl implements _PatternModelUpdateAll {
  const _PatternModelUpdateAllImpl(this.collection);

  final IsarCollection<int, PatternModel> collection;

  @override
  int call({
    required List<int> id,
    Object? name = ignore,
    Object? category = ignore,
    Object? description = ignore,
    Object? pdfPath = ignore,
    Object? difficulty = ignore,
    Object? estimatedTimeInHours = ignore,
    Object? instructions = ignore,
    Object? notes = ignore,
    Object? createdAt = ignore,
    Object? updatedAt = ignore,
    Object? timesUsed = ignore,
    Object? searchableName = ignore,
    Object? estimatedTimeDisplay = ignore,
    Object? difficultyDisplay = ignore,
    Object? categoryDisplay = ignore,
  }) {
    return collection.updateProperties(id, {
      if (name != ignore) 1: name as String?,
      if (category != ignore) 2: category as PatternCategory?,
      if (description != ignore) 3: description as String?,
      if (pdfPath != ignore) 4: pdfPath as String?,
      if (difficulty != ignore) 7: difficulty as DifficultyLevel?,
      if (estimatedTimeInHours != ignore) 8: estimatedTimeInHours as int?,
      if (instructions != ignore) 9: instructions as String?,
      if (notes != ignore) 10: notes as String?,
      if (createdAt != ignore) 12: createdAt as DateTime?,
      if (updatedAt != ignore) 13: updatedAt as DateTime?,
      if (timesUsed != ignore) 14: timesUsed as int?,
      if (searchableName != ignore) 15: searchableName as String?,
      if (estimatedTimeDisplay != ignore) 16: estimatedTimeDisplay as String?,
      if (difficultyDisplay != ignore) 17: difficultyDisplay as String?,
      if (categoryDisplay != ignore) 18: categoryDisplay as String?,
    });
  }
}

extension PatternModelUpdate on IsarCollection<int, PatternModel> {
  _PatternModelUpdate get update => _PatternModelUpdateImpl(this);

  _PatternModelUpdateAll get updateAll => _PatternModelUpdateAllImpl(this);
}

sealed class _PatternModelQueryUpdate {
  int call({
    String? name,
    PatternCategory? category,
    String? description,
    String? pdfPath,
    DifficultyLevel? difficulty,
    int? estimatedTimeInHours,
    String? instructions,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? timesUsed,
    String? searchableName,
    String? estimatedTimeDisplay,
    String? difficultyDisplay,
    String? categoryDisplay,
  });
}

class _PatternModelQueryUpdateImpl implements _PatternModelQueryUpdate {
  const _PatternModelQueryUpdateImpl(this.query, {this.limit});

  final IsarQuery<PatternModel> query;
  final int? limit;

  @override
  int call({
    Object? name = ignore,
    Object? category = ignore,
    Object? description = ignore,
    Object? pdfPath = ignore,
    Object? difficulty = ignore,
    Object? estimatedTimeInHours = ignore,
    Object? instructions = ignore,
    Object? notes = ignore,
    Object? createdAt = ignore,
    Object? updatedAt = ignore,
    Object? timesUsed = ignore,
    Object? searchableName = ignore,
    Object? estimatedTimeDisplay = ignore,
    Object? difficultyDisplay = ignore,
    Object? categoryDisplay = ignore,
  }) {
    return query.updateProperties(limit: limit, {
      if (name != ignore) 1: name as String?,
      if (category != ignore) 2: category as PatternCategory?,
      if (description != ignore) 3: description as String?,
      if (pdfPath != ignore) 4: pdfPath as String?,
      if (difficulty != ignore) 7: difficulty as DifficultyLevel?,
      if (estimatedTimeInHours != ignore) 8: estimatedTimeInHours as int?,
      if (instructions != ignore) 9: instructions as String?,
      if (notes != ignore) 10: notes as String?,
      if (createdAt != ignore) 12: createdAt as DateTime?,
      if (updatedAt != ignore) 13: updatedAt as DateTime?,
      if (timesUsed != ignore) 14: timesUsed as int?,
      if (searchableName != ignore) 15: searchableName as String?,
      if (estimatedTimeDisplay != ignore) 16: estimatedTimeDisplay as String?,
      if (difficultyDisplay != ignore) 17: difficultyDisplay as String?,
      if (categoryDisplay != ignore) 18: categoryDisplay as String?,
    });
  }
}

extension PatternModelQueryUpdate on IsarQuery<PatternModel> {
  _PatternModelQueryUpdate get updateFirst =>
      _PatternModelQueryUpdateImpl(this, limit: 1);

  _PatternModelQueryUpdate get updateAll => _PatternModelQueryUpdateImpl(this);
}

class _PatternModelQueryBuilderUpdateImpl implements _PatternModelQueryUpdate {
  const _PatternModelQueryBuilderUpdateImpl(this.query, {this.limit});

  final QueryBuilder<PatternModel, PatternModel, QOperations> query;
  final int? limit;

  @override
  int call({
    Object? name = ignore,
    Object? category = ignore,
    Object? description = ignore,
    Object? pdfPath = ignore,
    Object? difficulty = ignore,
    Object? estimatedTimeInHours = ignore,
    Object? instructions = ignore,
    Object? notes = ignore,
    Object? createdAt = ignore,
    Object? updatedAt = ignore,
    Object? timesUsed = ignore,
    Object? searchableName = ignore,
    Object? estimatedTimeDisplay = ignore,
    Object? difficultyDisplay = ignore,
    Object? categoryDisplay = ignore,
  }) {
    final q = query.build();
    try {
      return q.updateProperties(limit: limit, {
        if (name != ignore) 1: name as String?,
        if (category != ignore) 2: category as PatternCategory?,
        if (description != ignore) 3: description as String?,
        if (pdfPath != ignore) 4: pdfPath as String?,
        if (difficulty != ignore) 7: difficulty as DifficultyLevel?,
        if (estimatedTimeInHours != ignore) 8: estimatedTimeInHours as int?,
        if (instructions != ignore) 9: instructions as String?,
        if (notes != ignore) 10: notes as String?,
        if (createdAt != ignore) 12: createdAt as DateTime?,
        if (updatedAt != ignore) 13: updatedAt as DateTime?,
        if (timesUsed != ignore) 14: timesUsed as int?,
        if (searchableName != ignore) 15: searchableName as String?,
        if (estimatedTimeDisplay != ignore) 16: estimatedTimeDisplay as String?,
        if (difficultyDisplay != ignore) 17: difficultyDisplay as String?,
        if (categoryDisplay != ignore) 18: categoryDisplay as String?,
      });
    } finally {
      q.close();
    }
  }
}

extension PatternModelQueryBuilderUpdate
    on QueryBuilder<PatternModel, PatternModel, QOperations> {
  _PatternModelQueryUpdate get updateFirst =>
      _PatternModelQueryBuilderUpdateImpl(this, limit: 1);

  _PatternModelQueryUpdate get updateAll =>
      _PatternModelQueryBuilderUpdateImpl(this);
}

const _patternModelCategory = {
  0: PatternCategory.dress,
  1: PatternCategory.pants,
  2: PatternCategory.shirt,
  3: PatternCategory.skirt,
  4: PatternCategory.jacket,
  5: PatternCategory.accessory,
  6: PatternCategory.other,
};
const _patternModelDifficulty = {
  0: DifficultyLevel.beginner,
  1: DifficultyLevel.intermediate,
  2: DifficultyLevel.advanced,
  3: DifficultyLevel.expert,
};

extension PatternModelQueryFilter
    on QueryBuilder<PatternModel, PatternModel, QFilterCondition> {
  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> idEqualTo(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> idGreaterThan(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  idGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> idLessThan(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 0, value: value));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  idLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> idBetween(
    int lower,
    int upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 0, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> nameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> nameLessThan(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> nameBetween(
    String lower,
    String upper, {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> nameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> nameContains(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> nameMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  nameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  nameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryEqualTo(PatternCategory value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryGreaterThan(PatternCategory value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 2, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryGreaterThanOrEqualTo(PatternCategory value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 2, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryLessThan(PatternCategory value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryLessThanOrEqualTo(PatternCategory value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 2, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryBetween(PatternCategory lower, PatternCategory upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 2, lower: lower.index, upper: upper.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionBetween(
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  descriptionIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  pdfPathIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 5, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementBetween(
    String lower,
    String upper, {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 5, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 5, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsIsEmpty() {
    return not().photoUrlsIsNotEmpty();
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  photoUrlsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 5, value: null),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 6, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 6, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementBetween(String lower, String upper, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 6, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 6, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsIsEmpty() {
    return not().tagsIsNotEmpty();
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  tagsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 6, value: null),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyEqualTo(DifficultyLevel value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 7, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyGreaterThan(DifficultyLevel value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 7, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyGreaterThanOrEqualTo(DifficultyLevel value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 7, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyLessThan(DifficultyLevel value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 7, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyLessThanOrEqualTo(DifficultyLevel value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 7, value: value.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyBetween(DifficultyLevel lower, DifficultyLevel upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 7, lower: lower.index, upper: upper.index),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeInHoursIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeInHoursIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeInHoursEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 8, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeInHoursGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 8, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeInHoursGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 8, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeInHoursLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 8, value: value));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeInHoursLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 8, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeInHoursBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 8, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 9));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 9));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 9, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 9, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsBetween(
    String? lower,
    String? upper, {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 9, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  instructionsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 9, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 10));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  notesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 10));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> notesEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  notesGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  notesGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> notesLessThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 10, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  notesLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> notesBetween(
    String? lower,
    String? upper, {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  notesStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> notesEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> notesContains(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition> notesMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 10, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 10, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementGreaterThan(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 11, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementLessThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementBetween(
    String lower,
    String upper, {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 11, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 11, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsIsEmpty() {
    return not().galleryPhotoUrlsIsNotEmpty();
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  galleryPhotoUrlsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 11, value: null),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  createdAtGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  createdAtGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  createdAtLessThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  createdAtLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 12, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  createdAtBetween(DateTime lower, DateTime upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 12, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  updatedAtIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 13));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  updatedAtIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 13));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  updatedAtEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  updatedAtGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  updatedAtGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  updatedAtLessThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  updatedAtLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 13, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  updatedAtBetween(DateTime? lower, DateTime? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 13, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  timesUsedEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  timesUsedGreaterThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  timesUsedGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  timesUsedLessThan(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  timesUsedLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 14, value: value),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  timesUsedBetween(int lower, int upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 14, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 15));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 15));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameGreaterThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 15, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameBetween(
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 15, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  searchableNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 15, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 16));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 16));
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayGreaterThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 16, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayLessThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 16, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  estimatedTimeDisplayIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 16, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 17,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 17,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 17,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 17, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayLessThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 17,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayBetween(
    String lower,
    String upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 17,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 17,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 17,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 17,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 17,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 17, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  difficultyDisplayIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 17, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 18,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 18,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 18,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 18, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 18,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayBetween(
    String lower,
    String upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 18,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 18,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 18,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 18,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 18,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 18, value: ''),
      );
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterFilterCondition>
  categoryDisplayIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 18, value: ''),
      );
    });
  }
}

extension PatternModelQueryObject
    on QueryBuilder<PatternModel, PatternModel, QFilterCondition> {}

extension PatternModelQuerySortBy
    on QueryBuilder<PatternModel, PatternModel, QSortBy> {
  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByCategory() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByCategoryDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByDescription({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByDescriptionDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByPdfPath({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByPdfPathDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByDifficulty() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByDifficultyDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByEstimatedTimeInHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByEstimatedTimeInHoursDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByInstructions({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByInstructionsDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByNotesDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByTimesUsed() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByTimesUsedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortBySearchableName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortBySearchableNameDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByEstimatedTimeDisplay({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByEstimatedTimeDisplayDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByDifficultyDisplay({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByDifficultyDisplayDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> sortByCategoryDisplay({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  sortByCategoryDisplayDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }
}

extension PatternModelQuerySortThenBy
    on QueryBuilder<PatternModel, PatternModel, QSortThenBy> {
  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByCategory() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByCategoryDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByDescription({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByDescriptionDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByPdfPath({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByPdfPathDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByDifficulty() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByDifficultyDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByEstimatedTimeInHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByEstimatedTimeInHoursDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByInstructions({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByInstructionsDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByNotesDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(13, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByTimesUsed() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByTimesUsedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(14, sort: Sort.desc);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenBySearchableName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenBySearchableNameDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByEstimatedTimeDisplay({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByEstimatedTimeDisplayDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByDifficultyDisplay({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByDifficultyDisplayDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy> thenByCategoryDisplay({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterSortBy>
  thenByCategoryDisplayDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }
}

extension PatternModelQueryWhereDistinct
    on QueryBuilder<PatternModel, PatternModel, QDistinct> {
  QueryBuilder<PatternModel, PatternModel, QAfterDistinct> distinctByName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByCategory() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(2);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByDescription({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct> distinctByPdfPath({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByPhotoUrls() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(5);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct> distinctByTags() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(6);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByDifficulty() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(7);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByEstimatedTimeInHours() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(8);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByInstructions({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(9, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct> distinctByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(10, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByGalleryPhotoUrls() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(11);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(12);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(13);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByTimesUsed() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(14);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctBySearchableName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(15, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByEstimatedTimeDisplay({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(16, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByDifficultyDisplay({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(17, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<PatternModel, PatternModel, QAfterDistinct>
  distinctByCategoryDisplay({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(18, caseSensitive: caseSensitive);
    });
  }
}

extension PatternModelQueryProperty1
    on QueryBuilder<PatternModel, PatternModel, QProperty> {
  QueryBuilder<PatternModel, int, QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<PatternModel, String, QAfterProperty> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<PatternModel, PatternCategory, QAfterProperty>
  categoryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<PatternModel, String?, QAfterProperty> descriptionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<PatternModel, String?, QAfterProperty> pdfPathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<PatternModel, List<String>, QAfterProperty> photoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<PatternModel, List<String>, QAfterProperty> tagsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<PatternModel, DifficultyLevel, QAfterProperty>
  difficultyProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<PatternModel, int?, QAfterProperty>
  estimatedTimeInHoursProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<PatternModel, String?, QAfterProperty> instructionsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<PatternModel, String?, QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<PatternModel, List<String>, QAfterProperty>
  galleryPhotoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<PatternModel, DateTime, QAfterProperty> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<PatternModel, DateTime?, QAfterProperty> updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<PatternModel, int, QAfterProperty> timesUsedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<PatternModel, String?, QAfterProperty> searchableNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<PatternModel, String?, QAfterProperty>
  estimatedTimeDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<PatternModel, String, QAfterProperty>
  difficultyDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<PatternModel, String, QAfterProperty> categoryDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }
}

extension PatternModelQueryProperty2<R>
    on QueryBuilder<PatternModel, R, QAfterProperty> {
  QueryBuilder<PatternModel, (R, int), QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<PatternModel, (R, String), QAfterProperty> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<PatternModel, (R, PatternCategory), QAfterProperty>
  categoryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<PatternModel, (R, String?), QAfterProperty>
  descriptionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<PatternModel, (R, String?), QAfterProperty> pdfPathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<PatternModel, (R, List<String>), QAfterProperty>
  photoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<PatternModel, (R, List<String>), QAfterProperty> tagsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<PatternModel, (R, DifficultyLevel), QAfterProperty>
  difficultyProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<PatternModel, (R, int?), QAfterProperty>
  estimatedTimeInHoursProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<PatternModel, (R, String?), QAfterProperty>
  instructionsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<PatternModel, (R, String?), QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<PatternModel, (R, List<String>), QAfterProperty>
  galleryPhotoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<PatternModel, (R, DateTime), QAfterProperty>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<PatternModel, (R, DateTime?), QAfterProperty>
  updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<PatternModel, (R, int), QAfterProperty> timesUsedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<PatternModel, (R, String?), QAfterProperty>
  searchableNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<PatternModel, (R, String?), QAfterProperty>
  estimatedTimeDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<PatternModel, (R, String), QAfterProperty>
  difficultyDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<PatternModel, (R, String), QAfterProperty>
  categoryDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }
}

extension PatternModelQueryProperty3<R1, R2>
    on QueryBuilder<PatternModel, (R1, R2), QAfterProperty> {
  QueryBuilder<PatternModel, (R1, R2, int), QOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String), QOperations> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, PatternCategory), QOperations>
  categoryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String?), QOperations>
  descriptionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String?), QOperations> pdfPathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, List<String>), QOperations>
  photoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, List<String>), QOperations>
  tagsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, DifficultyLevel), QOperations>
  difficultyProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, int?), QOperations>
  estimatedTimeInHoursProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String?), QOperations>
  instructionsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String?), QOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, List<String>), QOperations>
  galleryPhotoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, DateTime), QOperations>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, DateTime?), QOperations>
  updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, int), QOperations> timesUsedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String?), QOperations>
  searchableNameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String?), QOperations>
  estimatedTimeDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String), QOperations>
  difficultyDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<PatternModel, (R1, R2, String), QOperations>
  categoryDisplayProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }
}
