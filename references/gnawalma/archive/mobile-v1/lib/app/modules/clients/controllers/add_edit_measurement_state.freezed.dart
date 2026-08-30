// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'add_edit_measurement_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$AddEditMeasurementState {

 ClientModel? get client; Map<String, double> get customMeasurements; bool get isSaving; MeasurementRecord? get existingMeasurement;
/// Create a copy of AddEditMeasurementState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AddEditMeasurementStateCopyWith<AddEditMeasurementState> get copyWith => _$AddEditMeasurementStateCopyWithImpl<AddEditMeasurementState>(this as AddEditMeasurementState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AddEditMeasurementState&&(identical(other.client, client) || other.client == client)&&const DeepCollectionEquality().equals(other.customMeasurements, customMeasurements)&&(identical(other.isSaving, isSaving) || other.isSaving == isSaving)&&(identical(other.existingMeasurement, existingMeasurement) || other.existingMeasurement == existingMeasurement));
}


@override
int get hashCode => Object.hash(runtimeType,client,const DeepCollectionEquality().hash(customMeasurements),isSaving,existingMeasurement);

@override
String toString() {
  return 'AddEditMeasurementState(client: $client, customMeasurements: $customMeasurements, isSaving: $isSaving, existingMeasurement: $existingMeasurement)';
}


}

/// @nodoc
abstract mixin class $AddEditMeasurementStateCopyWith<$Res>  {
  factory $AddEditMeasurementStateCopyWith(AddEditMeasurementState value, $Res Function(AddEditMeasurementState) _then) = _$AddEditMeasurementStateCopyWithImpl;
@useResult
$Res call({
 ClientModel? client, Map<String, double> customMeasurements, bool isSaving, MeasurementRecord? existingMeasurement
});




}
/// @nodoc
class _$AddEditMeasurementStateCopyWithImpl<$Res>
    implements $AddEditMeasurementStateCopyWith<$Res> {
  _$AddEditMeasurementStateCopyWithImpl(this._self, this._then);

  final AddEditMeasurementState _self;
  final $Res Function(AddEditMeasurementState) _then;

/// Create a copy of AddEditMeasurementState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? client = freezed,Object? customMeasurements = null,Object? isSaving = null,Object? existingMeasurement = freezed,}) {
  return _then(_self.copyWith(
client: freezed == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as ClientModel?,customMeasurements: null == customMeasurements ? _self.customMeasurements : customMeasurements // ignore: cast_nullable_to_non_nullable
as Map<String, double>,isSaving: null == isSaving ? _self.isSaving : isSaving // ignore: cast_nullable_to_non_nullable
as bool,existingMeasurement: freezed == existingMeasurement ? _self.existingMeasurement : existingMeasurement // ignore: cast_nullable_to_non_nullable
as MeasurementRecord?,
  ));
}

}


/// Adds pattern-matching-related methods to [AddEditMeasurementState].
extension AddEditMeasurementStatePatterns on AddEditMeasurementState {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AddEditMeasurementState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AddEditMeasurementState() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AddEditMeasurementState value)  $default,){
final _that = this;
switch (_that) {
case _AddEditMeasurementState():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AddEditMeasurementState value)?  $default,){
final _that = this;
switch (_that) {
case _AddEditMeasurementState() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ClientModel? client,  Map<String, double> customMeasurements,  bool isSaving,  MeasurementRecord? existingMeasurement)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AddEditMeasurementState() when $default != null:
return $default(_that.client,_that.customMeasurements,_that.isSaving,_that.existingMeasurement);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ClientModel? client,  Map<String, double> customMeasurements,  bool isSaving,  MeasurementRecord? existingMeasurement)  $default,) {final _that = this;
switch (_that) {
case _AddEditMeasurementState():
return $default(_that.client,_that.customMeasurements,_that.isSaving,_that.existingMeasurement);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ClientModel? client,  Map<String, double> customMeasurements,  bool isSaving,  MeasurementRecord? existingMeasurement)?  $default,) {final _that = this;
switch (_that) {
case _AddEditMeasurementState() when $default != null:
return $default(_that.client,_that.customMeasurements,_that.isSaving,_that.existingMeasurement);case _:
  return null;

}
}

}

/// @nodoc


class _AddEditMeasurementState implements AddEditMeasurementState {
  const _AddEditMeasurementState({this.client, final  Map<String, double> customMeasurements = const {}, this.isSaving = false, this.existingMeasurement}): _customMeasurements = customMeasurements;
  

@override final  ClientModel? client;
 final  Map<String, double> _customMeasurements;
@override@JsonKey() Map<String, double> get customMeasurements {
  if (_customMeasurements is EqualUnmodifiableMapView) return _customMeasurements;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_customMeasurements);
}

@override@JsonKey() final  bool isSaving;
@override final  MeasurementRecord? existingMeasurement;

/// Create a copy of AddEditMeasurementState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AddEditMeasurementStateCopyWith<_AddEditMeasurementState> get copyWith => __$AddEditMeasurementStateCopyWithImpl<_AddEditMeasurementState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AddEditMeasurementState&&(identical(other.client, client) || other.client == client)&&const DeepCollectionEquality().equals(other._customMeasurements, _customMeasurements)&&(identical(other.isSaving, isSaving) || other.isSaving == isSaving)&&(identical(other.existingMeasurement, existingMeasurement) || other.existingMeasurement == existingMeasurement));
}


@override
int get hashCode => Object.hash(runtimeType,client,const DeepCollectionEquality().hash(_customMeasurements),isSaving,existingMeasurement);

@override
String toString() {
  return 'AddEditMeasurementState(client: $client, customMeasurements: $customMeasurements, isSaving: $isSaving, existingMeasurement: $existingMeasurement)';
}


}

/// @nodoc
abstract mixin class _$AddEditMeasurementStateCopyWith<$Res> implements $AddEditMeasurementStateCopyWith<$Res> {
  factory _$AddEditMeasurementStateCopyWith(_AddEditMeasurementState value, $Res Function(_AddEditMeasurementState) _then) = __$AddEditMeasurementStateCopyWithImpl;
@override @useResult
$Res call({
 ClientModel? client, Map<String, double> customMeasurements, bool isSaving, MeasurementRecord? existingMeasurement
});




}
/// @nodoc
class __$AddEditMeasurementStateCopyWithImpl<$Res>
    implements _$AddEditMeasurementStateCopyWith<$Res> {
  __$AddEditMeasurementStateCopyWithImpl(this._self, this._then);

  final _AddEditMeasurementState _self;
  final $Res Function(_AddEditMeasurementState) _then;

/// Create a copy of AddEditMeasurementState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? client = freezed,Object? customMeasurements = null,Object? isSaving = null,Object? existingMeasurement = freezed,}) {
  return _then(_AddEditMeasurementState(
client: freezed == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as ClientModel?,customMeasurements: null == customMeasurements ? _self._customMeasurements : customMeasurements // ignore: cast_nullable_to_non_nullable
as Map<String, double>,isSaving: null == isSaving ? _self.isSaving : isSaving // ignore: cast_nullable_to_non_nullable
as bool,existingMeasurement: freezed == existingMeasurement ? _self.existingMeasurement : existingMeasurement // ignore: cast_nullable_to_non_nullable
as MeasurementRecord?,
  ));
}


}

// dart format on
