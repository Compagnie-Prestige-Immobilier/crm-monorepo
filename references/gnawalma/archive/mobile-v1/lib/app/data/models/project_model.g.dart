// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'project_model.dart';

// **************************************************************************
// _IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, invalid_use_of_protected_member, lines_longer_than_80_chars, constant_identifier_names, avoid_js_rounded_ints, no_leading_underscores_for_local_identifiers, require_trailing_commas, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_in_if_null_operators, library_private_types_in_public_api, prefer_const_constructors
// ignore_for_file: type=lint

extension GetProjectModelCollection on Isar {
  IsarCollection<int, ProjectModel> get projectModels => this.collection();
}

final ProjectModelSchema = IsarGeneratedSchema(
  schema: IsarSchema(
    name: 'ProjectModel',
    idName: 'id',
    embedded: false,
    properties: [
      IsarPropertySchema(name: 'name', type: IsarType.string),
      IsarPropertySchema(name: 'garmentType', type: IsarType.string),
      IsarPropertySchema(name: 'description', type: IsarType.string),
      IsarPropertySchema(name: 'eventTag', type: IsarType.string),
      IsarPropertySchema(name: 'createdAt', type: IsarType.dateTime),
      IsarPropertySchema(name: 'startDate', type: IsarType.dateTime),
      IsarPropertySchema(name: 'expectedDeliveryDate', type: IsarType.dateTime),
      IsarPropertySchema(name: 'actualDeliveryDate', type: IsarType.dateTime),
      IsarPropertySchema(
        name: 'status',
        type: IsarType.byte,

        enumMap: {"todo": 0, "inProgress": 1, "completed": 2, "delivered": 3},
      ),
      IsarPropertySchema(name: 'isRetouch', type: IsarType.bool),
      IsarPropertySchema(name: 'isArchived', type: IsarType.bool),
      IsarPropertySchema(name: 'progressPercentage', type: IsarType.double),
      IsarPropertySchema(name: 'completedSteps', type: IsarType.stringList),
      IsarPropertySchema(name: 'allSteps', type: IsarType.stringList),
      IsarPropertySchema(name: 'clientId', type: IsarType.long),
      IsarPropertySchema(name: 'orderId', type: IsarType.long),
      IsarPropertySchema(name: 'beneficiaryId', type: IsarType.long),
      IsarPropertySchema(name: 'forWhom', type: IsarType.string),
      IsarPropertySchema(name: 'patternId', type: IsarType.long),
      IsarPropertySchema(name: 'photoUrls', type: IsarType.stringList),
      IsarPropertySchema(name: 'fabricPhotoUrl', type: IsarType.string),
      IsarPropertySchema(name: 'measurementsSnapshot', type: IsarType.string),
      IsarPropertySchema(name: 'measurementNotes', type: IsarType.string),
      IsarPropertySchema(name: 'notes', type: IsarType.string),
      IsarPropertySchema(name: 'audioNotePath', type: IsarType.string),
      IsarPropertySchema(name: 'estimatedPrice', type: IsarType.double),
      IsarPropertySchema(name: 'actualPrice', type: IsarType.double),
      IsarPropertySchema(name: 'advancePayment', type: IsarType.double),
      IsarPropertySchema(name: 'remainingAmount', type: IsarType.double),
      IsarPropertySchema(name: 'isOverdue', type: IsarType.bool),
      IsarPropertySchema(name: 'daysUntilDelivery', type: IsarType.long),
    ],
    indexes: [
      IsarIndexSchema(
        name: 'clientId',
        properties: ["clientId"],
        unique: false,
        hash: false,
      ),
      IsarIndexSchema(
        name: 'orderId',
        properties: ["orderId"],
        unique: false,
        hash: false,
      ),
    ],
  ),
  converter: IsarObjectConverter<int, ProjectModel>(
    serialize: serializeProjectModel,
    deserialize: deserializeProjectModel,
    deserializeProperty: deserializeProjectModelProp,
  ),
  getEmbeddedSchemas: () => [],
);

@isarProtected
int serializeProjectModel(IsarWriter writer, ProjectModel object) {
  IsarCore.writeString(writer, 1, object.name);
  IsarCore.writeString(writer, 2, object.garmentType);
  {
    final value = object.description;
    if (value == null) {
      IsarCore.writeNull(writer, 3);
    } else {
      IsarCore.writeString(writer, 3, value);
    }
  }
  {
    final value = object.eventTag;
    if (value == null) {
      IsarCore.writeNull(writer, 4);
    } else {
      IsarCore.writeString(writer, 4, value);
    }
  }
  IsarCore.writeLong(
    writer,
    5,
    object.createdAt.toUtc().microsecondsSinceEpoch,
  );
  IsarCore.writeLong(
    writer,
    6,
    object.startDate?.toUtc().microsecondsSinceEpoch ?? -9223372036854775808,
  );
  IsarCore.writeLong(
    writer,
    7,
    object.expectedDeliveryDate?.toUtc().microsecondsSinceEpoch ??
        -9223372036854775808,
  );
  IsarCore.writeLong(
    writer,
    8,
    object.actualDeliveryDate?.toUtc().microsecondsSinceEpoch ??
        -9223372036854775808,
  );
  IsarCore.writeByte(writer, 9, object.status.index);
  IsarCore.writeBool(writer, 10, value: object.isRetouch);
  IsarCore.writeBool(writer, 11, value: object.isArchived);
  IsarCore.writeDouble(writer, 12, object.progressPercentage);
  {
    final list = object.completedSteps;
    final listWriter = IsarCore.beginList(writer, 13, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeString(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  {
    final list = object.allSteps;
    final listWriter = IsarCore.beginList(writer, 14, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeString(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  IsarCore.writeLong(writer, 15, object.clientId ?? -9223372036854775808);
  IsarCore.writeLong(writer, 16, object.orderId ?? -9223372036854775808);
  IsarCore.writeLong(writer, 17, object.beneficiaryId ?? -9223372036854775808);
  {
    final value = object.forWhom;
    if (value == null) {
      IsarCore.writeNull(writer, 18);
    } else {
      IsarCore.writeString(writer, 18, value);
    }
  }
  IsarCore.writeLong(writer, 19, object.patternId ?? -9223372036854775808);
  {
    final list = object.photoUrls;
    final listWriter = IsarCore.beginList(writer, 20, list.length);
    for (var i = 0; i < list.length; i++) {
      IsarCore.writeString(listWriter, i, list[i]);
    }
    IsarCore.endList(writer, listWriter);
  }
  {
    final value = object.fabricPhotoUrl;
    if (value == null) {
      IsarCore.writeNull(writer, 21);
    } else {
      IsarCore.writeString(writer, 21, value);
    }
  }
  {
    final value = object.measurementsSnapshot;
    if (value == null) {
      IsarCore.writeNull(writer, 22);
    } else {
      IsarCore.writeString(writer, 22, value);
    }
  }
  {
    final value = object.measurementNotes;
    if (value == null) {
      IsarCore.writeNull(writer, 23);
    } else {
      IsarCore.writeString(writer, 23, value);
    }
  }
  {
    final value = object.notes;
    if (value == null) {
      IsarCore.writeNull(writer, 24);
    } else {
      IsarCore.writeString(writer, 24, value);
    }
  }
  {
    final value = object.audioNotePath;
    if (value == null) {
      IsarCore.writeNull(writer, 25);
    } else {
      IsarCore.writeString(writer, 25, value);
    }
  }
  IsarCore.writeDouble(writer, 26, object.estimatedPrice ?? double.nan);
  IsarCore.writeDouble(writer, 27, object.actualPrice ?? double.nan);
  IsarCore.writeDouble(writer, 28, object.advancePayment ?? double.nan);
  IsarCore.writeDouble(writer, 29, object.remainingAmount);
  IsarCore.writeBool(writer, 30, value: object.isOverdue);
  IsarCore.writeLong(
    writer,
    31,
    object.daysUntilDelivery ?? -9223372036854775808,
  );
  return object.id;
}

@isarProtected
ProjectModel deserializeProjectModel(IsarReader reader) {
  final object = ProjectModel();
  object.id = IsarCore.readId(reader);
  object.name = IsarCore.readString(reader, 1) ?? '';
  object.garmentType = IsarCore.readString(reader, 2) ?? '';
  object.description = IsarCore.readString(reader, 3);
  object.eventTag = IsarCore.readString(reader, 4);
  {
    final value = IsarCore.readLong(reader, 5);
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
    final value = IsarCore.readLong(reader, 6);
    if (value == -9223372036854775808) {
      object.startDate = null;
    } else {
      object.startDate = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  {
    final value = IsarCore.readLong(reader, 7);
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
    final value = IsarCore.readLong(reader, 8);
    if (value == -9223372036854775808) {
      object.actualDeliveryDate = null;
    } else {
      object.actualDeliveryDate = DateTime.fromMicrosecondsSinceEpoch(
        value,
        isUtc: true,
      ).toLocal();
    }
  }
  {
    if (IsarCore.readNull(reader, 9)) {
      object.status = ProjectStatus.todo;
    } else {
      object.status =
          _projectModelStatus[IsarCore.readByte(reader, 9)] ??
          ProjectStatus.todo;
    }
  }
  object.isRetouch = IsarCore.readBool(reader, 10);
  object.isArchived = IsarCore.readBool(reader, 11);
  object.progressPercentage = IsarCore.readDouble(reader, 12);
  {
    final length = IsarCore.readList(reader, 13, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.completedSteps = const <String>[];
      } else {
        final list = List<String>.filled(length, '', growable: true);
        for (var i = 0; i < length; i++) {
          list[i] = IsarCore.readString(reader, i) ?? '';
        }
        IsarCore.freeReader(reader);
        object.completedSteps = list;
      }
    }
  }
  {
    final length = IsarCore.readList(reader, 14, IsarCore.readerPtrPtr);
    {
      final reader = IsarCore.readerPtr;
      if (reader.isNull) {
        object.allSteps = const <String>[];
      } else {
        final list = List<String>.filled(length, '', growable: true);
        for (var i = 0; i < length; i++) {
          list[i] = IsarCore.readString(reader, i) ?? '';
        }
        IsarCore.freeReader(reader);
        object.allSteps = list;
      }
    }
  }
  {
    final value = IsarCore.readLong(reader, 15);
    if (value == -9223372036854775808) {
      object.clientId = null;
    } else {
      object.clientId = value;
    }
  }
  {
    final value = IsarCore.readLong(reader, 16);
    if (value == -9223372036854775808) {
      object.orderId = null;
    } else {
      object.orderId = value;
    }
  }
  {
    final value = IsarCore.readLong(reader, 17);
    if (value == -9223372036854775808) {
      object.beneficiaryId = null;
    } else {
      object.beneficiaryId = value;
    }
  }
  object.forWhom = IsarCore.readString(reader, 18);
  {
    final value = IsarCore.readLong(reader, 19);
    if (value == -9223372036854775808) {
      object.patternId = null;
    } else {
      object.patternId = value;
    }
  }
  {
    final length = IsarCore.readList(reader, 20, IsarCore.readerPtrPtr);
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
  object.fabricPhotoUrl = IsarCore.readString(reader, 21);
  object.measurementsSnapshot = IsarCore.readString(reader, 22);
  object.measurementNotes = IsarCore.readString(reader, 23);
  object.notes = IsarCore.readString(reader, 24);
  object.audioNotePath = IsarCore.readString(reader, 25);
  {
    final value = IsarCore.readDouble(reader, 26);
    if (value.isNaN) {
      object.estimatedPrice = null;
    } else {
      object.estimatedPrice = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 27);
    if (value.isNaN) {
      object.actualPrice = null;
    } else {
      object.actualPrice = value;
    }
  }
  {
    final value = IsarCore.readDouble(reader, 28);
    if (value.isNaN) {
      object.advancePayment = null;
    } else {
      object.advancePayment = value;
    }
  }
  return object;
}

@isarProtected
dynamic deserializeProjectModelProp(IsarReader reader, int property) {
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
      {
        final value = IsarCore.readLong(reader, 5);
        if (value == -9223372036854775808) {
          return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true).toLocal();
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
      {
        final value = IsarCore.readLong(reader, 7);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 8:
      {
        final value = IsarCore.readLong(reader, 8);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return DateTime.fromMicrosecondsSinceEpoch(
            value,
            isUtc: true,
          ).toLocal();
        }
      }
    case 9:
      {
        if (IsarCore.readNull(reader, 9)) {
          return ProjectStatus.todo;
        } else {
          return _projectModelStatus[IsarCore.readByte(reader, 9)] ??
              ProjectStatus.todo;
        }
      }
    case 10:
      return IsarCore.readBool(reader, 10);
    case 11:
      return IsarCore.readBool(reader, 11);
    case 12:
      return IsarCore.readDouble(reader, 12);
    case 13:
      {
        final length = IsarCore.readList(reader, 13, IsarCore.readerPtrPtr);
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
    case 14:
      {
        final length = IsarCore.readList(reader, 14, IsarCore.readerPtrPtr);
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
    case 15:
      {
        final value = IsarCore.readLong(reader, 15);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return value;
        }
      }
    case 16:
      {
        final value = IsarCore.readLong(reader, 16);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return value;
        }
      }
    case 17:
      {
        final value = IsarCore.readLong(reader, 17);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return value;
        }
      }
    case 18:
      return IsarCore.readString(reader, 18);
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
      {
        final length = IsarCore.readList(reader, 20, IsarCore.readerPtrPtr);
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
    case 21:
      return IsarCore.readString(reader, 21);
    case 22:
      return IsarCore.readString(reader, 22);
    case 23:
      return IsarCore.readString(reader, 23);
    case 24:
      return IsarCore.readString(reader, 24);
    case 25:
      return IsarCore.readString(reader, 25);
    case 26:
      {
        final value = IsarCore.readDouble(reader, 26);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 27:
      {
        final value = IsarCore.readDouble(reader, 27);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 28:
      {
        final value = IsarCore.readDouble(reader, 28);
        if (value.isNaN) {
          return null;
        } else {
          return value;
        }
      }
    case 29:
      return IsarCore.readDouble(reader, 29);
    case 30:
      return IsarCore.readBool(reader, 30);
    case 31:
      {
        final value = IsarCore.readLong(reader, 31);
        if (value == -9223372036854775808) {
          return null;
        } else {
          return value;
        }
      }
    default:
      throw ArgumentError('Unknown property: $property');
  }
}

sealed class _ProjectModelUpdate {
  bool call({
    required int id,
    String? name,
    String? garmentType,
    String? description,
    String? eventTag,
    DateTime? createdAt,
    DateTime? startDate,
    DateTime? expectedDeliveryDate,
    DateTime? actualDeliveryDate,
    ProjectStatus? status,
    bool? isRetouch,
    bool? isArchived,
    double? progressPercentage,
    int? clientId,
    int? orderId,
    int? beneficiaryId,
    String? forWhom,
    int? patternId,
    String? fabricPhotoUrl,
    String? measurementsSnapshot,
    String? measurementNotes,
    String? notes,
    String? audioNotePath,
    double? estimatedPrice,
    double? actualPrice,
    double? advancePayment,
    double? remainingAmount,
    bool? isOverdue,
    int? daysUntilDelivery,
  });
}

class _ProjectModelUpdateImpl implements _ProjectModelUpdate {
  const _ProjectModelUpdateImpl(this.collection);

  final IsarCollection<int, ProjectModel> collection;

  @override
  bool call({
    required int id,
    Object? name = ignore,
    Object? garmentType = ignore,
    Object? description = ignore,
    Object? eventTag = ignore,
    Object? createdAt = ignore,
    Object? startDate = ignore,
    Object? expectedDeliveryDate = ignore,
    Object? actualDeliveryDate = ignore,
    Object? status = ignore,
    Object? isRetouch = ignore,
    Object? isArchived = ignore,
    Object? progressPercentage = ignore,
    Object? clientId = ignore,
    Object? orderId = ignore,
    Object? beneficiaryId = ignore,
    Object? forWhom = ignore,
    Object? patternId = ignore,
    Object? fabricPhotoUrl = ignore,
    Object? measurementsSnapshot = ignore,
    Object? measurementNotes = ignore,
    Object? notes = ignore,
    Object? audioNotePath = ignore,
    Object? estimatedPrice = ignore,
    Object? actualPrice = ignore,
    Object? advancePayment = ignore,
    Object? remainingAmount = ignore,
    Object? isOverdue = ignore,
    Object? daysUntilDelivery = ignore,
  }) {
    return collection.updateProperties(
          [id],
          {
            if (name != ignore) 1: name as String?,
            if (garmentType != ignore) 2: garmentType as String?,
            if (description != ignore) 3: description as String?,
            if (eventTag != ignore) 4: eventTag as String?,
            if (createdAt != ignore) 5: createdAt as DateTime?,
            if (startDate != ignore) 6: startDate as DateTime?,
            if (expectedDeliveryDate != ignore)
              7: expectedDeliveryDate as DateTime?,
            if (actualDeliveryDate != ignore)
              8: actualDeliveryDate as DateTime?,
            if (status != ignore) 9: status as ProjectStatus?,
            if (isRetouch != ignore) 10: isRetouch as bool?,
            if (isArchived != ignore) 11: isArchived as bool?,
            if (progressPercentage != ignore) 12: progressPercentage as double?,
            if (clientId != ignore) 15: clientId as int?,
            if (orderId != ignore) 16: orderId as int?,
            if (beneficiaryId != ignore) 17: beneficiaryId as int?,
            if (forWhom != ignore) 18: forWhom as String?,
            if (patternId != ignore) 19: patternId as int?,
            if (fabricPhotoUrl != ignore) 21: fabricPhotoUrl as String?,
            if (measurementsSnapshot != ignore)
              22: measurementsSnapshot as String?,
            if (measurementNotes != ignore) 23: measurementNotes as String?,
            if (notes != ignore) 24: notes as String?,
            if (audioNotePath != ignore) 25: audioNotePath as String?,
            if (estimatedPrice != ignore) 26: estimatedPrice as double?,
            if (actualPrice != ignore) 27: actualPrice as double?,
            if (advancePayment != ignore) 28: advancePayment as double?,
            if (remainingAmount != ignore) 29: remainingAmount as double?,
            if (isOverdue != ignore) 30: isOverdue as bool?,
            if (daysUntilDelivery != ignore) 31: daysUntilDelivery as int?,
          },
        ) >
        0;
  }
}

sealed class _ProjectModelUpdateAll {
  int call({
    required List<int> id,
    String? name,
    String? garmentType,
    String? description,
    String? eventTag,
    DateTime? createdAt,
    DateTime? startDate,
    DateTime? expectedDeliveryDate,
    DateTime? actualDeliveryDate,
    ProjectStatus? status,
    bool? isRetouch,
    bool? isArchived,
    double? progressPercentage,
    int? clientId,
    int? orderId,
    int? beneficiaryId,
    String? forWhom,
    int? patternId,
    String? fabricPhotoUrl,
    String? measurementsSnapshot,
    String? measurementNotes,
    String? notes,
    String? audioNotePath,
    double? estimatedPrice,
    double? actualPrice,
    double? advancePayment,
    double? remainingAmount,
    bool? isOverdue,
    int? daysUntilDelivery,
  });
}

class _ProjectModelUpdateAllImpl implements _ProjectModelUpdateAll {
  const _ProjectModelUpdateAllImpl(this.collection);

  final IsarCollection<int, ProjectModel> collection;

  @override
  int call({
    required List<int> id,
    Object? name = ignore,
    Object? garmentType = ignore,
    Object? description = ignore,
    Object? eventTag = ignore,
    Object? createdAt = ignore,
    Object? startDate = ignore,
    Object? expectedDeliveryDate = ignore,
    Object? actualDeliveryDate = ignore,
    Object? status = ignore,
    Object? isRetouch = ignore,
    Object? isArchived = ignore,
    Object? progressPercentage = ignore,
    Object? clientId = ignore,
    Object? orderId = ignore,
    Object? beneficiaryId = ignore,
    Object? forWhom = ignore,
    Object? patternId = ignore,
    Object? fabricPhotoUrl = ignore,
    Object? measurementsSnapshot = ignore,
    Object? measurementNotes = ignore,
    Object? notes = ignore,
    Object? audioNotePath = ignore,
    Object? estimatedPrice = ignore,
    Object? actualPrice = ignore,
    Object? advancePayment = ignore,
    Object? remainingAmount = ignore,
    Object? isOverdue = ignore,
    Object? daysUntilDelivery = ignore,
  }) {
    return collection.updateProperties(id, {
      if (name != ignore) 1: name as String?,
      if (garmentType != ignore) 2: garmentType as String?,
      if (description != ignore) 3: description as String?,
      if (eventTag != ignore) 4: eventTag as String?,
      if (createdAt != ignore) 5: createdAt as DateTime?,
      if (startDate != ignore) 6: startDate as DateTime?,
      if (expectedDeliveryDate != ignore) 7: expectedDeliveryDate as DateTime?,
      if (actualDeliveryDate != ignore) 8: actualDeliveryDate as DateTime?,
      if (status != ignore) 9: status as ProjectStatus?,
      if (isRetouch != ignore) 10: isRetouch as bool?,
      if (isArchived != ignore) 11: isArchived as bool?,
      if (progressPercentage != ignore) 12: progressPercentage as double?,
      if (clientId != ignore) 15: clientId as int?,
      if (orderId != ignore) 16: orderId as int?,
      if (beneficiaryId != ignore) 17: beneficiaryId as int?,
      if (forWhom != ignore) 18: forWhom as String?,
      if (patternId != ignore) 19: patternId as int?,
      if (fabricPhotoUrl != ignore) 21: fabricPhotoUrl as String?,
      if (measurementsSnapshot != ignore) 22: measurementsSnapshot as String?,
      if (measurementNotes != ignore) 23: measurementNotes as String?,
      if (notes != ignore) 24: notes as String?,
      if (audioNotePath != ignore) 25: audioNotePath as String?,
      if (estimatedPrice != ignore) 26: estimatedPrice as double?,
      if (actualPrice != ignore) 27: actualPrice as double?,
      if (advancePayment != ignore) 28: advancePayment as double?,
      if (remainingAmount != ignore) 29: remainingAmount as double?,
      if (isOverdue != ignore) 30: isOverdue as bool?,
      if (daysUntilDelivery != ignore) 31: daysUntilDelivery as int?,
    });
  }
}

extension ProjectModelUpdate on IsarCollection<int, ProjectModel> {
  _ProjectModelUpdate get update => _ProjectModelUpdateImpl(this);

  _ProjectModelUpdateAll get updateAll => _ProjectModelUpdateAllImpl(this);
}

sealed class _ProjectModelQueryUpdate {
  int call({
    String? name,
    String? garmentType,
    String? description,
    String? eventTag,
    DateTime? createdAt,
    DateTime? startDate,
    DateTime? expectedDeliveryDate,
    DateTime? actualDeliveryDate,
    ProjectStatus? status,
    bool? isRetouch,
    bool? isArchived,
    double? progressPercentage,
    int? clientId,
    int? orderId,
    int? beneficiaryId,
    String? forWhom,
    int? patternId,
    String? fabricPhotoUrl,
    String? measurementsSnapshot,
    String? measurementNotes,
    String? notes,
    String? audioNotePath,
    double? estimatedPrice,
    double? actualPrice,
    double? advancePayment,
    double? remainingAmount,
    bool? isOverdue,
    int? daysUntilDelivery,
  });
}

class _ProjectModelQueryUpdateImpl implements _ProjectModelQueryUpdate {
  const _ProjectModelQueryUpdateImpl(this.query, {this.limit});

  final IsarQuery<ProjectModel> query;
  final int? limit;

  @override
  int call({
    Object? name = ignore,
    Object? garmentType = ignore,
    Object? description = ignore,
    Object? eventTag = ignore,
    Object? createdAt = ignore,
    Object? startDate = ignore,
    Object? expectedDeliveryDate = ignore,
    Object? actualDeliveryDate = ignore,
    Object? status = ignore,
    Object? isRetouch = ignore,
    Object? isArchived = ignore,
    Object? progressPercentage = ignore,
    Object? clientId = ignore,
    Object? orderId = ignore,
    Object? beneficiaryId = ignore,
    Object? forWhom = ignore,
    Object? patternId = ignore,
    Object? fabricPhotoUrl = ignore,
    Object? measurementsSnapshot = ignore,
    Object? measurementNotes = ignore,
    Object? notes = ignore,
    Object? audioNotePath = ignore,
    Object? estimatedPrice = ignore,
    Object? actualPrice = ignore,
    Object? advancePayment = ignore,
    Object? remainingAmount = ignore,
    Object? isOverdue = ignore,
    Object? daysUntilDelivery = ignore,
  }) {
    return query.updateProperties(limit: limit, {
      if (name != ignore) 1: name as String?,
      if (garmentType != ignore) 2: garmentType as String?,
      if (description != ignore) 3: description as String?,
      if (eventTag != ignore) 4: eventTag as String?,
      if (createdAt != ignore) 5: createdAt as DateTime?,
      if (startDate != ignore) 6: startDate as DateTime?,
      if (expectedDeliveryDate != ignore) 7: expectedDeliveryDate as DateTime?,
      if (actualDeliveryDate != ignore) 8: actualDeliveryDate as DateTime?,
      if (status != ignore) 9: status as ProjectStatus?,
      if (isRetouch != ignore) 10: isRetouch as bool?,
      if (isArchived != ignore) 11: isArchived as bool?,
      if (progressPercentage != ignore) 12: progressPercentage as double?,
      if (clientId != ignore) 15: clientId as int?,
      if (orderId != ignore) 16: orderId as int?,
      if (beneficiaryId != ignore) 17: beneficiaryId as int?,
      if (forWhom != ignore) 18: forWhom as String?,
      if (patternId != ignore) 19: patternId as int?,
      if (fabricPhotoUrl != ignore) 21: fabricPhotoUrl as String?,
      if (measurementsSnapshot != ignore) 22: measurementsSnapshot as String?,
      if (measurementNotes != ignore) 23: measurementNotes as String?,
      if (notes != ignore) 24: notes as String?,
      if (audioNotePath != ignore) 25: audioNotePath as String?,
      if (estimatedPrice != ignore) 26: estimatedPrice as double?,
      if (actualPrice != ignore) 27: actualPrice as double?,
      if (advancePayment != ignore) 28: advancePayment as double?,
      if (remainingAmount != ignore) 29: remainingAmount as double?,
      if (isOverdue != ignore) 30: isOverdue as bool?,
      if (daysUntilDelivery != ignore) 31: daysUntilDelivery as int?,
    });
  }
}

extension ProjectModelQueryUpdate on IsarQuery<ProjectModel> {
  _ProjectModelQueryUpdate get updateFirst =>
      _ProjectModelQueryUpdateImpl(this, limit: 1);

  _ProjectModelQueryUpdate get updateAll => _ProjectModelQueryUpdateImpl(this);
}

class _ProjectModelQueryBuilderUpdateImpl implements _ProjectModelQueryUpdate {
  const _ProjectModelQueryBuilderUpdateImpl(this.query, {this.limit});

  final QueryBuilder<ProjectModel, ProjectModel, QOperations> query;
  final int? limit;

  @override
  int call({
    Object? name = ignore,
    Object? garmentType = ignore,
    Object? description = ignore,
    Object? eventTag = ignore,
    Object? createdAt = ignore,
    Object? startDate = ignore,
    Object? expectedDeliveryDate = ignore,
    Object? actualDeliveryDate = ignore,
    Object? status = ignore,
    Object? isRetouch = ignore,
    Object? isArchived = ignore,
    Object? progressPercentage = ignore,
    Object? clientId = ignore,
    Object? orderId = ignore,
    Object? beneficiaryId = ignore,
    Object? forWhom = ignore,
    Object? patternId = ignore,
    Object? fabricPhotoUrl = ignore,
    Object? measurementsSnapshot = ignore,
    Object? measurementNotes = ignore,
    Object? notes = ignore,
    Object? audioNotePath = ignore,
    Object? estimatedPrice = ignore,
    Object? actualPrice = ignore,
    Object? advancePayment = ignore,
    Object? remainingAmount = ignore,
    Object? isOverdue = ignore,
    Object? daysUntilDelivery = ignore,
  }) {
    final q = query.build();
    try {
      return q.updateProperties(limit: limit, {
        if (name != ignore) 1: name as String?,
        if (garmentType != ignore) 2: garmentType as String?,
        if (description != ignore) 3: description as String?,
        if (eventTag != ignore) 4: eventTag as String?,
        if (createdAt != ignore) 5: createdAt as DateTime?,
        if (startDate != ignore) 6: startDate as DateTime?,
        if (expectedDeliveryDate != ignore)
          7: expectedDeliveryDate as DateTime?,
        if (actualDeliveryDate != ignore) 8: actualDeliveryDate as DateTime?,
        if (status != ignore) 9: status as ProjectStatus?,
        if (isRetouch != ignore) 10: isRetouch as bool?,
        if (isArchived != ignore) 11: isArchived as bool?,
        if (progressPercentage != ignore) 12: progressPercentage as double?,
        if (clientId != ignore) 15: clientId as int?,
        if (orderId != ignore) 16: orderId as int?,
        if (beneficiaryId != ignore) 17: beneficiaryId as int?,
        if (forWhom != ignore) 18: forWhom as String?,
        if (patternId != ignore) 19: patternId as int?,
        if (fabricPhotoUrl != ignore) 21: fabricPhotoUrl as String?,
        if (measurementsSnapshot != ignore) 22: measurementsSnapshot as String?,
        if (measurementNotes != ignore) 23: measurementNotes as String?,
        if (notes != ignore) 24: notes as String?,
        if (audioNotePath != ignore) 25: audioNotePath as String?,
        if (estimatedPrice != ignore) 26: estimatedPrice as double?,
        if (actualPrice != ignore) 27: actualPrice as double?,
        if (advancePayment != ignore) 28: advancePayment as double?,
        if (remainingAmount != ignore) 29: remainingAmount as double?,
        if (isOverdue != ignore) 30: isOverdue as bool?,
        if (daysUntilDelivery != ignore) 31: daysUntilDelivery as int?,
      });
    } finally {
      q.close();
    }
  }
}

extension ProjectModelQueryBuilderUpdate
    on QueryBuilder<ProjectModel, ProjectModel, QOperations> {
  _ProjectModelQueryUpdate get updateFirst =>
      _ProjectModelQueryBuilderUpdateImpl(this, limit: 1);

  _ProjectModelQueryUpdate get updateAll =>
      _ProjectModelQueryBuilderUpdateImpl(this);
}

const _projectModelStatus = {
  0: ProjectStatus.todo,
  1: ProjectStatus.inProgress,
  2: ProjectStatus.completed,
  3: ProjectStatus.delivered,
};

extension ProjectModelQueryFilter
    on QueryBuilder<ProjectModel, ProjectModel, QFilterCondition> {
  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> idEqualTo(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> idGreaterThan(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  idGreaterThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> idLessThan(
    int value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 0, value: value));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  idLessThanOrEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 0, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> idBetween(
    int lower,
    int upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 0, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> nameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> nameLessThan(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 1, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> nameBetween(
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> nameEndsWith(
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> nameContains(
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> nameMatches(
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  nameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  nameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 1, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeGreaterThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 2, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeBetween(String lower, String upper, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  garmentTypeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 2, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  descriptionIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  descriptionIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 3));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  descriptionEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  descriptionLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 3, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  descriptionIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  descriptionIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 3, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 4));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 4, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  eventTagIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 4, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  createdAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  createdAtGreaterThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  createdAtGreaterThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  createdAtLessThan(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 5, value: value));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  createdAtLessThanOrEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 5, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  createdAtBetween(DateTime lower, DateTime upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 5, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  startDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  startDateIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 6));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  startDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 6, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  startDateGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 6, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  startDateGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 6, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  startDateLessThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 6, value: value));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  startDateLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 6, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  startDateBetween(DateTime? lower, DateTime? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 6, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  expectedDeliveryDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  expectedDeliveryDateIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 7));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  expectedDeliveryDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 7, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  expectedDeliveryDateGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 7, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  expectedDeliveryDateGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 7, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  expectedDeliveryDateLessThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 7, value: value));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  expectedDeliveryDateLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 7, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  expectedDeliveryDateBetween(DateTime? lower, DateTime? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 7, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualDeliveryDateIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualDeliveryDateIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 8));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualDeliveryDateEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 8, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualDeliveryDateGreaterThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 8, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualDeliveryDateGreaterThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 8, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualDeliveryDateLessThan(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(LessCondition(property: 8, value: value));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualDeliveryDateLessThanOrEqualTo(DateTime? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 8, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualDeliveryDateBetween(DateTime? lower, DateTime? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 8, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> statusEqualTo(
    ProjectStatus value,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 9, value: value.index),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  statusGreaterThan(ProjectStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 9, value: value.index),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  statusGreaterThanOrEqualTo(ProjectStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 9, value: value.index),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  statusLessThan(ProjectStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 9, value: value.index),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  statusLessThanOrEqualTo(ProjectStatus value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 9, value: value.index),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> statusBetween(
    ProjectStatus lower,
    ProjectStatus upper,
  ) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 9, lower: lower.index, upper: upper.index),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  isRetouchEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 10, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  isArchivedEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 11, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  progressPercentageEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  progressPercentageGreaterThan(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  progressPercentageGreaterThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  progressPercentageLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  progressPercentageLessThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 12, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  progressPercentageBetween(
    double lower,
    double upper, {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementEqualTo(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 13,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementGreaterThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 13,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 13,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 13, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementLessThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 13,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementBetween(
    String lower,
    String upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 13,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 13,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 13,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 13,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 13,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 13, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 13, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsIsEmpty() {
    return not().completedStepsIsNotEmpty();
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  completedStepsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 13, value: null),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 14, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementBetween(
    String lower,
    String upper, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 14, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 14, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsIsEmpty() {
    return not().allStepsIsNotEmpty();
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  allStepsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 14, value: null),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  clientIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 15));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  clientIdIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 15));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  clientIdEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  clientIdGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  clientIdGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  clientIdLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  clientIdLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 15, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  clientIdBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 15, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  orderIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 16));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  orderIdIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 16));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  orderIdEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  orderIdGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  orderIdGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  orderIdLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  orderIdLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 16, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  orderIdBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 16, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  beneficiaryIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 17));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  beneficiaryIdIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 17));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  beneficiaryIdEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  beneficiaryIdGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  beneficiaryIdGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  beneficiaryIdLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  beneficiaryIdLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 17, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  beneficiaryIdBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 17, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 18));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 18));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomGreaterThan(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 18, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomBetween(String? lower, String? upper, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 18, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  forWhomIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 18, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  patternIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 19));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  patternIdIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 19));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  patternIdEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  patternIdGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  patternIdGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  patternIdLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  patternIdLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 19, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  patternIdBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 19, lower: lower, upper: upper),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementGreaterThan(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementGreaterThanOrEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementLessThan(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 20, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementLessThanOrEqualTo(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementBetween(
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementStartsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementEndsWith(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementContains(String value, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementMatches(String pattern, {bool caseSensitive = true}) {
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

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 20, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsElementIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 20, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsIsEmpty() {
    return not().photoUrlsIsNotEmpty();
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  photoUrlsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterOrEqualCondition(property: 20, value: null),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 21));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 21));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 21,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 21,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlGreaterThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 21,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 21, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 21,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 21,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 21,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 21,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 21,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 21,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 21, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  fabricPhotoUrlIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 21, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 22));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 22));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 22,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 22,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotGreaterThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 22,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 22, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotLessThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 22,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 22,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 22,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 22,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 22,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 22,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 22, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementsSnapshotIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 22, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 23));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 23));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 23,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 23,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesGreaterThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 23,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 23, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesLessThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 23,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 23,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 23,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 23,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 23,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 23,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 23, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  measurementNotesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 23, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  notesIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 24));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  notesIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 24));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> notesEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 24,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  notesGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 24,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  notesGreaterThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 24,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> notesLessThan(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 24, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  notesLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 24,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> notesBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 24,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  notesStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 24,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> notesEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 24,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> notesContains(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 24,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition> notesMatches(
    String pattern, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 24,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  notesIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 24, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  notesIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 24, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 25));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 25));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(
          property: 25,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathGreaterThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(
          property: 25,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathGreaterThanOrEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(
          property: 25,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathLessThan(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 25, value: value, caseSensitive: caseSensitive),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathLessThanOrEqualTo(String? value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(
          property: 25,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathBetween(
    String? lower,
    String? upper, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 25,
          lower: lower,
          upper: upper,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathStartsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        StartsWithCondition(
          property: 25,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathEndsWith(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EndsWithCondition(
          property: 25,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        ContainsCondition(
          property: 25,
          value: value,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        MatchesCondition(
          property: 25,
          wildcard: pattern,
          caseSensitive: caseSensitive,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const EqualCondition(property: 25, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  audioNotePathIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        const GreaterCondition(property: 25, value: ''),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  estimatedPriceIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 26));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  estimatedPriceIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 26));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  estimatedPriceEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 26, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  estimatedPriceGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 26, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  estimatedPriceGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 26, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  estimatedPriceLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 26, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  estimatedPriceLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 26, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  estimatedPriceBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 26,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualPriceIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 27));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualPriceIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 27));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualPriceEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 27, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualPriceGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 27, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualPriceGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 27, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualPriceLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 27, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualPriceLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 27, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  actualPriceBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 27,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  advancePaymentIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 28));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  advancePaymentIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 28));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  advancePaymentEqualTo(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 28, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  advancePaymentGreaterThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 28, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  advancePaymentGreaterThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 28, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  advancePaymentLessThan(double? value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 28, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  advancePaymentLessThanOrEqualTo(
    double? value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 28, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  advancePaymentBetween(
    double? lower,
    double? upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 28,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  remainingAmountEqualTo(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 29, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  remainingAmountGreaterThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 29, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  remainingAmountGreaterThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 29, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  remainingAmountLessThan(double value, {double epsilon = Filter.epsilon}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 29, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  remainingAmountLessThanOrEqualTo(
    double value, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 29, value: value, epsilon: epsilon),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  remainingAmountBetween(
    double lower,
    double upper, {
    double epsilon = Filter.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(
          property: 29,
          lower: lower,
          upper: upper,

          epsilon: epsilon,
        ),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  isOverdueEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 30, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  daysUntilDeliveryIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const IsNullCondition(property: 31));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  daysUntilDeliveryIsNotNull() {
    return QueryBuilder.apply(not(), (query) {
      return query.addFilterCondition(const IsNullCondition(property: 31));
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  daysUntilDeliveryEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        EqualCondition(property: 31, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  daysUntilDeliveryGreaterThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterCondition(property: 31, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  daysUntilDeliveryGreaterThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        GreaterOrEqualCondition(property: 31, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  daysUntilDeliveryLessThan(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessCondition(property: 31, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  daysUntilDeliveryLessThanOrEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        LessOrEqualCondition(property: 31, value: value),
      );
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterFilterCondition>
  daysUntilDeliveryBetween(int? lower, int? upper) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(
        BetweenCondition(property: 31, lower: lower, upper: upper),
      );
    });
  }
}

extension ProjectModelQueryObject
    on QueryBuilder<ProjectModel, ProjectModel, QFilterCondition> {}

extension ProjectModelQuerySortBy
    on QueryBuilder<ProjectModel, ProjectModel, QSortBy> {
  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByGarmentType({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByGarmentTypeDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByDescription({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByDescriptionDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByEventTag({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByEventTagDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByStartDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByExpectedDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByExpectedDeliveryDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByActualDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByActualDeliveryDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByIsRetouch() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByIsRetouchDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByIsArchived() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByIsArchivedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByProgressPercentage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByProgressPercentageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByClientIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByOrderId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByOrderIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByBeneficiaryId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByBeneficiaryIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByForWhom({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByForWhomDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByPatternId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByPatternIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByFabricPhotoUrl({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(21, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByFabricPhotoUrlDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(21, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByMeasurementsSnapshot({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(22, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByMeasurementsSnapshotDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(22, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByMeasurementNotes({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(23, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByMeasurementNotesDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(23, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(24, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByNotesDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(24, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByAudioNotePath({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(25, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByAudioNotePathDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(25, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByEstimatedPrice() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(26);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByEstimatedPriceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(26, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByActualPrice() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(27);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByActualPriceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(27, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByAdvancePayment() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(28);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByAdvancePaymentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(28, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByRemainingAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(29);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByRemainingAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(29, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByIsOverdue() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(30);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> sortByIsOverdueDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(30, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByDaysUntilDelivery() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(31);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  sortByDaysUntilDeliveryDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(31, sort: Sort.desc);
    });
  }
}

extension ProjectModelQuerySortThenBy
    on QueryBuilder<ProjectModel, ProjectModel, QSortThenBy> {
  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(0, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByNameDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(1, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByGarmentType({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByGarmentTypeDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(2, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByDescription({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByDescriptionDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(3, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByEventTag({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByEventTagDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(4, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(5, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByStartDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(6, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByExpectedDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByExpectedDeliveryDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(7, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByActualDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByActualDeliveryDateDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(8, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByStatusDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(9, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByIsRetouch() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByIsRetouchDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(10, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByIsArchived() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByIsArchivedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(11, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByProgressPercentage() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByProgressPercentageDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(12, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByClientIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(15, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByOrderId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByOrderIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(16, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByBeneficiaryId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByBeneficiaryIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(17, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByForWhom({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByForWhomDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(18, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByPatternId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByPatternIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(19, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByFabricPhotoUrl({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(21, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByFabricPhotoUrlDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(21, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByMeasurementsSnapshot({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(22, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByMeasurementsSnapshotDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(22, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByMeasurementNotes({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(23, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByMeasurementNotesDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(23, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(24, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByNotesDesc({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(24, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByAudioNotePath({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(25, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByAudioNotePathDesc({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(25, sort: Sort.desc, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByEstimatedPrice() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(26);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByEstimatedPriceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(26, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByActualPrice() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(27);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByActualPriceDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(27, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByAdvancePayment() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(28);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByAdvancePaymentDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(28, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByRemainingAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(29);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByRemainingAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(29, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByIsOverdue() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(30);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy> thenByIsOverdueDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(30, sort: Sort.desc);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByDaysUntilDelivery() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(31);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterSortBy>
  thenByDaysUntilDeliveryDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(31, sort: Sort.desc);
    });
  }
}

extension ProjectModelQueryWhereDistinct
    on QueryBuilder<ProjectModel, ProjectModel, QDistinct> {
  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct> distinctByName({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(1, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByGarmentType({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(2, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByDescription({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(3, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct> distinctByEventTag({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(4, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(5);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByStartDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(6);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByExpectedDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(7);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByActualDeliveryDate() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(8);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct> distinctByStatus() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(9);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByIsRetouch() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(10);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByIsArchived() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(11);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByProgressPercentage() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(12);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByCompletedSteps() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(13);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByAllSteps() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(14);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByClientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(15);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct> distinctByOrderId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(16);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByBeneficiaryId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(17);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct> distinctByForWhom({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(18, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByPatternId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(19);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByPhotoUrls() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(20);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByFabricPhotoUrl({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(21, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByMeasurementsSnapshot({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(22, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByMeasurementNotes({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(23, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct> distinctByNotes({
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(24, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByAudioNotePath({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(25, caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByEstimatedPrice() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(26);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByActualPrice() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(27);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByAdvancePayment() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(28);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByRemainingAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(29);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByIsOverdue() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(30);
    });
  }

  QueryBuilder<ProjectModel, ProjectModel, QAfterDistinct>
  distinctByDaysUntilDelivery() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(31);
    });
  }
}

extension ProjectModelQueryProperty1
    on QueryBuilder<ProjectModel, ProjectModel, QProperty> {
  QueryBuilder<ProjectModel, int, QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<ProjectModel, String, QAfterProperty> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<ProjectModel, String, QAfterProperty> garmentTypeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<ProjectModel, String?, QAfterProperty> descriptionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<ProjectModel, String?, QAfterProperty> eventTagProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<ProjectModel, DateTime, QAfterProperty> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<ProjectModel, DateTime?, QAfterProperty> startDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<ProjectModel, DateTime?, QAfterProperty>
  expectedDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<ProjectModel, DateTime?, QAfterProperty>
  actualDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<ProjectModel, ProjectStatus, QAfterProperty> statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<ProjectModel, bool, QAfterProperty> isRetouchProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<ProjectModel, bool, QAfterProperty> isArchivedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<ProjectModel, double, QAfterProperty>
  progressPercentageProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<ProjectModel, List<String>, QAfterProperty>
  completedStepsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<ProjectModel, List<String>, QAfterProperty> allStepsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<ProjectModel, int?, QAfterProperty> clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<ProjectModel, int?, QAfterProperty> orderIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<ProjectModel, int?, QAfterProperty> beneficiaryIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<ProjectModel, String?, QAfterProperty> forWhomProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<ProjectModel, int?, QAfterProperty> patternIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<ProjectModel, List<String>, QAfterProperty> photoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }

  QueryBuilder<ProjectModel, String?, QAfterProperty> fabricPhotoUrlProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(21);
    });
  }

  QueryBuilder<ProjectModel, String?, QAfterProperty>
  measurementsSnapshotProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(22);
    });
  }

  QueryBuilder<ProjectModel, String?, QAfterProperty>
  measurementNotesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(23);
    });
  }

  QueryBuilder<ProjectModel, String?, QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(24);
    });
  }

  QueryBuilder<ProjectModel, String?, QAfterProperty> audioNotePathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(25);
    });
  }

  QueryBuilder<ProjectModel, double?, QAfterProperty> estimatedPriceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(26);
    });
  }

  QueryBuilder<ProjectModel, double?, QAfterProperty> actualPriceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(27);
    });
  }

  QueryBuilder<ProjectModel, double?, QAfterProperty> advancePaymentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(28);
    });
  }

  QueryBuilder<ProjectModel, double, QAfterProperty> remainingAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(29);
    });
  }

  QueryBuilder<ProjectModel, bool, QAfterProperty> isOverdueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(30);
    });
  }

  QueryBuilder<ProjectModel, int?, QAfterProperty> daysUntilDeliveryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(31);
    });
  }
}

extension ProjectModelQueryProperty2<R>
    on QueryBuilder<ProjectModel, R, QAfterProperty> {
  QueryBuilder<ProjectModel, (R, int), QAfterProperty> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<ProjectModel, (R, String), QAfterProperty> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<ProjectModel, (R, String), QAfterProperty>
  garmentTypeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<ProjectModel, (R, String?), QAfterProperty>
  descriptionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<ProjectModel, (R, String?), QAfterProperty> eventTagProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<ProjectModel, (R, DateTime), QAfterProperty>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<ProjectModel, (R, DateTime?), QAfterProperty>
  startDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<ProjectModel, (R, DateTime?), QAfterProperty>
  expectedDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<ProjectModel, (R, DateTime?), QAfterProperty>
  actualDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<ProjectModel, (R, ProjectStatus), QAfterProperty>
  statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<ProjectModel, (R, bool), QAfterProperty> isRetouchProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<ProjectModel, (R, bool), QAfterProperty> isArchivedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<ProjectModel, (R, double), QAfterProperty>
  progressPercentageProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<ProjectModel, (R, List<String>), QAfterProperty>
  completedStepsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<ProjectModel, (R, List<String>), QAfterProperty>
  allStepsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<ProjectModel, (R, int?), QAfterProperty> clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<ProjectModel, (R, int?), QAfterProperty> orderIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<ProjectModel, (R, int?), QAfterProperty>
  beneficiaryIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<ProjectModel, (R, String?), QAfterProperty> forWhomProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<ProjectModel, (R, int?), QAfterProperty> patternIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<ProjectModel, (R, List<String>), QAfterProperty>
  photoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }

  QueryBuilder<ProjectModel, (R, String?), QAfterProperty>
  fabricPhotoUrlProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(21);
    });
  }

  QueryBuilder<ProjectModel, (R, String?), QAfterProperty>
  measurementsSnapshotProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(22);
    });
  }

  QueryBuilder<ProjectModel, (R, String?), QAfterProperty>
  measurementNotesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(23);
    });
  }

  QueryBuilder<ProjectModel, (R, String?), QAfterProperty> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(24);
    });
  }

  QueryBuilder<ProjectModel, (R, String?), QAfterProperty>
  audioNotePathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(25);
    });
  }

  QueryBuilder<ProjectModel, (R, double?), QAfterProperty>
  estimatedPriceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(26);
    });
  }

  QueryBuilder<ProjectModel, (R, double?), QAfterProperty>
  actualPriceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(27);
    });
  }

  QueryBuilder<ProjectModel, (R, double?), QAfterProperty>
  advancePaymentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(28);
    });
  }

  QueryBuilder<ProjectModel, (R, double), QAfterProperty>
  remainingAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(29);
    });
  }

  QueryBuilder<ProjectModel, (R, bool), QAfterProperty> isOverdueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(30);
    });
  }

  QueryBuilder<ProjectModel, (R, int?), QAfterProperty>
  daysUntilDeliveryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(31);
    });
  }
}

extension ProjectModelQueryProperty3<R1, R2>
    on QueryBuilder<ProjectModel, (R1, R2), QAfterProperty> {
  QueryBuilder<ProjectModel, (R1, R2, int), QOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(0);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String), QOperations> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(1);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String), QOperations>
  garmentTypeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(2);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String?), QOperations>
  descriptionProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(3);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String?), QOperations>
  eventTagProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(4);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, DateTime), QOperations>
  createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(5);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, DateTime?), QOperations>
  startDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(6);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, DateTime?), QOperations>
  expectedDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(7);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, DateTime?), QOperations>
  actualDeliveryDateProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(8);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, ProjectStatus), QOperations>
  statusProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(9);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, bool), QOperations> isRetouchProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(10);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, bool), QOperations> isArchivedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(11);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, double), QOperations>
  progressPercentageProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(12);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, List<String>), QOperations>
  completedStepsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(13);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, List<String>), QOperations>
  allStepsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(14);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, int?), QOperations> clientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(15);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, int?), QOperations> orderIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(16);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, int?), QOperations>
  beneficiaryIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(17);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String?), QOperations> forWhomProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(18);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, int?), QOperations> patternIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(19);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, List<String>), QOperations>
  photoUrlsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(20);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String?), QOperations>
  fabricPhotoUrlProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(21);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String?), QOperations>
  measurementsSnapshotProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(22);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String?), QOperations>
  measurementNotesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(23);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String?), QOperations> notesProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(24);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, String?), QOperations>
  audioNotePathProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(25);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, double?), QOperations>
  estimatedPriceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(26);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, double?), QOperations>
  actualPriceProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(27);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, double?), QOperations>
  advancePaymentProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(28);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, double), QOperations>
  remainingAmountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(29);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, bool), QOperations> isOverdueProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(30);
    });
  }

  QueryBuilder<ProjectModel, (R1, R2, int?), QOperations>
  daysUntilDeliveryProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addProperty(31);
    });
  }
}
