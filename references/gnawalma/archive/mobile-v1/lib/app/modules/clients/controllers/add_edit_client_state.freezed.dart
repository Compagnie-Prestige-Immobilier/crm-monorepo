// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'add_edit_client_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$AddEditClientState {

 int get currentStep; bool get isSaving; bool get isEditMode; ClientModel? get existingClient;// Phone validation fields
 bool get isCheckingPhone; bool get phoneExists; ClientModel? get existingPhoneClient; String? get phoneError;
/// Create a copy of AddEditClientState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AddEditClientStateCopyWith<AddEditClientState> get copyWith => _$AddEditClientStateCopyWithImpl<AddEditClientState>(this as AddEditClientState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AddEditClientState&&(identical(other.currentStep, currentStep) || other.currentStep == currentStep)&&(identical(other.isSaving, isSaving) || other.isSaving == isSaving)&&(identical(other.isEditMode, isEditMode) || other.isEditMode == isEditMode)&&(identical(other.existingClient, existingClient) || other.existingClient == existingClient)&&(identical(other.isCheckingPhone, isCheckingPhone) || other.isCheckingPhone == isCheckingPhone)&&(identical(other.phoneExists, phoneExists) || other.phoneExists == phoneExists)&&(identical(other.existingPhoneClient, existingPhoneClient) || other.existingPhoneClient == existingPhoneClient)&&(identical(other.phoneError, phoneError) || other.phoneError == phoneError));
}


@override
int get hashCode => Object.hash(runtimeType,currentStep,isSaving,isEditMode,existingClient,isCheckingPhone,phoneExists,existingPhoneClient,phoneError);

@override
String toString() {
  return 'AddEditClientState(currentStep: $currentStep, isSaving: $isSaving, isEditMode: $isEditMode, existingClient: $existingClient, isCheckingPhone: $isCheckingPhone, phoneExists: $phoneExists, existingPhoneClient: $existingPhoneClient, phoneError: $phoneError)';
}


}

/// @nodoc
abstract mixin class $AddEditClientStateCopyWith<$Res>  {
  factory $AddEditClientStateCopyWith(AddEditClientState value, $Res Function(AddEditClientState) _then) = _$AddEditClientStateCopyWithImpl;
@useResult
$Res call({
 int currentStep, bool isSaving, bool isEditMode, ClientModel? existingClient, bool isCheckingPhone, bool phoneExists, ClientModel? existingPhoneClient, String? phoneError
});




}
/// @nodoc
class _$AddEditClientStateCopyWithImpl<$Res>
    implements $AddEditClientStateCopyWith<$Res> {
  _$AddEditClientStateCopyWithImpl(this._self, this._then);

  final AddEditClientState _self;
  final $Res Function(AddEditClientState) _then;

/// Create a copy of AddEditClientState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? currentStep = null,Object? isSaving = null,Object? isEditMode = null,Object? existingClient = freezed,Object? isCheckingPhone = null,Object? phoneExists = null,Object? existingPhoneClient = freezed,Object? phoneError = freezed,}) {
  return _then(_self.copyWith(
currentStep: null == currentStep ? _self.currentStep : currentStep // ignore: cast_nullable_to_non_nullable
as int,isSaving: null == isSaving ? _self.isSaving : isSaving // ignore: cast_nullable_to_non_nullable
as bool,isEditMode: null == isEditMode ? _self.isEditMode : isEditMode // ignore: cast_nullable_to_non_nullable
as bool,existingClient: freezed == existingClient ? _self.existingClient : existingClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,isCheckingPhone: null == isCheckingPhone ? _self.isCheckingPhone : isCheckingPhone // ignore: cast_nullable_to_non_nullable
as bool,phoneExists: null == phoneExists ? _self.phoneExists : phoneExists // ignore: cast_nullable_to_non_nullable
as bool,existingPhoneClient: freezed == existingPhoneClient ? _self.existingPhoneClient : existingPhoneClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,phoneError: freezed == phoneError ? _self.phoneError : phoneError // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [AddEditClientState].
extension AddEditClientStatePatterns on AddEditClientState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AddEditClientState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AddEditClientState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AddEditClientState value)  $default,){
final _that = this;
switch (_that) {
case _AddEditClientState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AddEditClientState value)?  $default,){
final _that = this;
switch (_that) {
case _AddEditClientState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int currentStep,  bool isSaving,  bool isEditMode,  ClientModel? existingClient,  bool isCheckingPhone,  bool phoneExists,  ClientModel? existingPhoneClient,  String? phoneError)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AddEditClientState() when $default != null:
return $default(_that.currentStep,_that.isSaving,_that.isEditMode,_that.existingClient,_that.isCheckingPhone,_that.phoneExists,_that.existingPhoneClient,_that.phoneError);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int currentStep,  bool isSaving,  bool isEditMode,  ClientModel? existingClient,  bool isCheckingPhone,  bool phoneExists,  ClientModel? existingPhoneClient,  String? phoneError)  $default,) {final _that = this;
switch (_that) {
case _AddEditClientState():
return $default(_that.currentStep,_that.isSaving,_that.isEditMode,_that.existingClient,_that.isCheckingPhone,_that.phoneExists,_that.existingPhoneClient,_that.phoneError);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int currentStep,  bool isSaving,  bool isEditMode,  ClientModel? existingClient,  bool isCheckingPhone,  bool phoneExists,  ClientModel? existingPhoneClient,  String? phoneError)?  $default,) {final _that = this;
switch (_that) {
case _AddEditClientState() when $default != null:
return $default(_that.currentStep,_that.isSaving,_that.isEditMode,_that.existingClient,_that.isCheckingPhone,_that.phoneExists,_that.existingPhoneClient,_that.phoneError);case _:
  return null;

}
}

}

/// @nodoc


class _AddEditClientState implements AddEditClientState {
  const _AddEditClientState({this.currentStep = 0, this.isSaving = false, this.isEditMode = false, this.existingClient, this.isCheckingPhone = false, this.phoneExists = false, this.existingPhoneClient, this.phoneError});
  

@override@JsonKey() final  int currentStep;
@override@JsonKey() final  bool isSaving;
@override@JsonKey() final  bool isEditMode;
@override final  ClientModel? existingClient;
// Phone validation fields
@override@JsonKey() final  bool isCheckingPhone;
@override@JsonKey() final  bool phoneExists;
@override final  ClientModel? existingPhoneClient;
@override final  String? phoneError;

/// Create a copy of AddEditClientState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AddEditClientStateCopyWith<_AddEditClientState> get copyWith => __$AddEditClientStateCopyWithImpl<_AddEditClientState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AddEditClientState&&(identical(other.currentStep, currentStep) || other.currentStep == currentStep)&&(identical(other.isSaving, isSaving) || other.isSaving == isSaving)&&(identical(other.isEditMode, isEditMode) || other.isEditMode == isEditMode)&&(identical(other.existingClient, existingClient) || other.existingClient == existingClient)&&(identical(other.isCheckingPhone, isCheckingPhone) || other.isCheckingPhone == isCheckingPhone)&&(identical(other.phoneExists, phoneExists) || other.phoneExists == phoneExists)&&(identical(other.existingPhoneClient, existingPhoneClient) || other.existingPhoneClient == existingPhoneClient)&&(identical(other.phoneError, phoneError) || other.phoneError == phoneError));
}


@override
int get hashCode => Object.hash(runtimeType,currentStep,isSaving,isEditMode,existingClient,isCheckingPhone,phoneExists,existingPhoneClient,phoneError);

@override
String toString() {
  return 'AddEditClientState(currentStep: $currentStep, isSaving: $isSaving, isEditMode: $isEditMode, existingClient: $existingClient, isCheckingPhone: $isCheckingPhone, phoneExists: $phoneExists, existingPhoneClient: $existingPhoneClient, phoneError: $phoneError)';
}


}

/// @nodoc
abstract mixin class _$AddEditClientStateCopyWith<$Res> implements $AddEditClientStateCopyWith<$Res> {
  factory _$AddEditClientStateCopyWith(_AddEditClientState value, $Res Function(_AddEditClientState) _then) = __$AddEditClientStateCopyWithImpl;
@override @useResult
$Res call({
 int currentStep, bool isSaving, bool isEditMode, ClientModel? existingClient, bool isCheckingPhone, bool phoneExists, ClientModel? existingPhoneClient, String? phoneError
});




}
/// @nodoc
class __$AddEditClientStateCopyWithImpl<$Res>
    implements _$AddEditClientStateCopyWith<$Res> {
  __$AddEditClientStateCopyWithImpl(this._self, this._then);

  final _AddEditClientState _self;
  final $Res Function(_AddEditClientState) _then;

/// Create a copy of AddEditClientState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? currentStep = null,Object? isSaving = null,Object? isEditMode = null,Object? existingClient = freezed,Object? isCheckingPhone = null,Object? phoneExists = null,Object? existingPhoneClient = freezed,Object? phoneError = freezed,}) {
  return _then(_AddEditClientState(
currentStep: null == currentStep ? _self.currentStep : currentStep // ignore: cast_nullable_to_non_nullable
as int,isSaving: null == isSaving ? _self.isSaving : isSaving // ignore: cast_nullable_to_non_nullable
as bool,isEditMode: null == isEditMode ? _self.isEditMode : isEditMode // ignore: cast_nullable_to_non_nullable
as bool,existingClient: freezed == existingClient ? _self.existingClient : existingClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,isCheckingPhone: null == isCheckingPhone ? _self.isCheckingPhone : isCheckingPhone // ignore: cast_nullable_to_non_nullable
as bool,phoneExists: null == phoneExists ? _self.phoneExists : phoneExists // ignore: cast_nullable_to_non_nullable
as bool,existingPhoneClient: freezed == existingPhoneClient ? _self.existingPhoneClient : existingPhoneClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,phoneError: freezed == phoneError ? _self.phoneError : phoneError // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
