// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pin_code_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PinCodeState {

 String get pin; String get title; bool get isConfirming; String get firstPin; bool get isOldVerified; String get mode; int get failedAttempts; DateTime? get lockedUntil;
/// Create a copy of PinCodeState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PinCodeStateCopyWith<PinCodeState> get copyWith => _$PinCodeStateCopyWithImpl<PinCodeState>(this as PinCodeState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PinCodeState&&(identical(other.pin, pin) || other.pin == pin)&&(identical(other.title, title) || other.title == title)&&(identical(other.isConfirming, isConfirming) || other.isConfirming == isConfirming)&&(identical(other.firstPin, firstPin) || other.firstPin == firstPin)&&(identical(other.isOldVerified, isOldVerified) || other.isOldVerified == isOldVerified)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.failedAttempts, failedAttempts) || other.failedAttempts == failedAttempts)&&(identical(other.lockedUntil, lockedUntil) || other.lockedUntil == lockedUntil));
}


@override
int get hashCode => Object.hash(runtimeType,pin,title,isConfirming,firstPin,isOldVerified,mode,failedAttempts,lockedUntil);

@override
String toString() {
  return 'PinCodeState(pin: $pin, title: $title, isConfirming: $isConfirming, firstPin: $firstPin, isOldVerified: $isOldVerified, mode: $mode, failedAttempts: $failedAttempts, lockedUntil: $lockedUntil)';
}


}

/// @nodoc
abstract mixin class $PinCodeStateCopyWith<$Res>  {
  factory $PinCodeStateCopyWith(PinCodeState value, $Res Function(PinCodeState) _then) = _$PinCodeStateCopyWithImpl;
@useResult
$Res call({
 String pin, String title, bool isConfirming, String firstPin, bool isOldVerified, String mode, int failedAttempts, DateTime? lockedUntil
});




}
/// @nodoc
class _$PinCodeStateCopyWithImpl<$Res>
    implements $PinCodeStateCopyWith<$Res> {
  _$PinCodeStateCopyWithImpl(this._self, this._then);

  final PinCodeState _self;
  final $Res Function(PinCodeState) _then;

/// Create a copy of PinCodeState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? pin = null,Object? title = null,Object? isConfirming = null,Object? firstPin = null,Object? isOldVerified = null,Object? mode = null,Object? failedAttempts = null,Object? lockedUntil = freezed,}) {
  return _then(_self.copyWith(
pin: null == pin ? _self.pin : pin // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,isConfirming: null == isConfirming ? _self.isConfirming : isConfirming // ignore: cast_nullable_to_non_nullable
as bool,firstPin: null == firstPin ? _self.firstPin : firstPin // ignore: cast_nullable_to_non_nullable
as String,isOldVerified: null == isOldVerified ? _self.isOldVerified : isOldVerified // ignore: cast_nullable_to_non_nullable
as bool,mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as String,failedAttempts: null == failedAttempts ? _self.failedAttempts : failedAttempts // ignore: cast_nullable_to_non_nullable
as int,lockedUntil: freezed == lockedUntil ? _self.lockedUntil : lockedUntil // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [PinCodeState].
extension PinCodeStatePatterns on PinCodeState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PinCodeState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PinCodeState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PinCodeState value)  $default,){
final _that = this;
switch (_that) {
case _PinCodeState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PinCodeState value)?  $default,){
final _that = this;
switch (_that) {
case _PinCodeState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String pin,  String title,  bool isConfirming,  String firstPin,  bool isOldVerified,  String mode,  int failedAttempts,  DateTime? lockedUntil)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PinCodeState() when $default != null:
return $default(_that.pin,_that.title,_that.isConfirming,_that.firstPin,_that.isOldVerified,_that.mode,_that.failedAttempts,_that.lockedUntil);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String pin,  String title,  bool isConfirming,  String firstPin,  bool isOldVerified,  String mode,  int failedAttempts,  DateTime? lockedUntil)  $default,) {final _that = this;
switch (_that) {
case _PinCodeState():
return $default(_that.pin,_that.title,_that.isConfirming,_that.firstPin,_that.isOldVerified,_that.mode,_that.failedAttempts,_that.lockedUntil);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String pin,  String title,  bool isConfirming,  String firstPin,  bool isOldVerified,  String mode,  int failedAttempts,  DateTime? lockedUntil)?  $default,) {final _that = this;
switch (_that) {
case _PinCodeState() when $default != null:
return $default(_that.pin,_that.title,_that.isConfirming,_that.firstPin,_that.isOldVerified,_that.mode,_that.failedAttempts,_that.lockedUntil);case _:
  return null;

}
}

}

/// @nodoc


class _PinCodeState implements PinCodeState {
  const _PinCodeState({this.pin = '', this.title = 'Entrez votre code PIN', this.isConfirming = false, this.firstPin = '', this.isOldVerified = false, this.mode = 'auth', this.failedAttempts = 0, this.lockedUntil});
  

@override@JsonKey() final  String pin;
@override@JsonKey() final  String title;
@override@JsonKey() final  bool isConfirming;
@override@JsonKey() final  String firstPin;
@override@JsonKey() final  bool isOldVerified;
@override@JsonKey() final  String mode;
@override@JsonKey() final  int failedAttempts;
@override final  DateTime? lockedUntil;

/// Create a copy of PinCodeState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PinCodeStateCopyWith<_PinCodeState> get copyWith => __$PinCodeStateCopyWithImpl<_PinCodeState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PinCodeState&&(identical(other.pin, pin) || other.pin == pin)&&(identical(other.title, title) || other.title == title)&&(identical(other.isConfirming, isConfirming) || other.isConfirming == isConfirming)&&(identical(other.firstPin, firstPin) || other.firstPin == firstPin)&&(identical(other.isOldVerified, isOldVerified) || other.isOldVerified == isOldVerified)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.failedAttempts, failedAttempts) || other.failedAttempts == failedAttempts)&&(identical(other.lockedUntil, lockedUntil) || other.lockedUntil == lockedUntil));
}


@override
int get hashCode => Object.hash(runtimeType,pin,title,isConfirming,firstPin,isOldVerified,mode,failedAttempts,lockedUntil);

@override
String toString() {
  return 'PinCodeState(pin: $pin, title: $title, isConfirming: $isConfirming, firstPin: $firstPin, isOldVerified: $isOldVerified, mode: $mode, failedAttempts: $failedAttempts, lockedUntil: $lockedUntil)';
}


}

/// @nodoc
abstract mixin class _$PinCodeStateCopyWith<$Res> implements $PinCodeStateCopyWith<$Res> {
  factory _$PinCodeStateCopyWith(_PinCodeState value, $Res Function(_PinCodeState) _then) = __$PinCodeStateCopyWithImpl;
@override @useResult
$Res call({
 String pin, String title, bool isConfirming, String firstPin, bool isOldVerified, String mode, int failedAttempts, DateTime? lockedUntil
});




}
/// @nodoc
class __$PinCodeStateCopyWithImpl<$Res>
    implements _$PinCodeStateCopyWith<$Res> {
  __$PinCodeStateCopyWithImpl(this._self, this._then);

  final _PinCodeState _self;
  final $Res Function(_PinCodeState) _then;

/// Create a copy of PinCodeState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? pin = null,Object? title = null,Object? isConfirming = null,Object? firstPin = null,Object? isOldVerified = null,Object? mode = null,Object? failedAttempts = null,Object? lockedUntil = freezed,}) {
  return _then(_PinCodeState(
pin: null == pin ? _self.pin : pin // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,isConfirming: null == isConfirming ? _self.isConfirming : isConfirming // ignore: cast_nullable_to_non_nullable
as bool,firstPin: null == firstPin ? _self.firstPin : firstPin // ignore: cast_nullable_to_non_nullable
as String,isOldVerified: null == isOldVerified ? _self.isOldVerified : isOldVerified // ignore: cast_nullable_to_non_nullable
as bool,mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as String,failedAttempts: null == failedAttempts ? _self.failedAttempts : failedAttempts // ignore: cast_nullable_to_non_nullable
as int,lockedUntil: freezed == lockedUntil ? _self.lockedUntil : lockedUntil // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
