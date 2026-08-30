// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'more_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$MoreState {

 bool get isLoading; bool get hasPin; String? get businessName; String? get appVersion;
/// Create a copy of MoreState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MoreStateCopyWith<MoreState> get copyWith => _$MoreStateCopyWithImpl<MoreState>(this as MoreState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MoreState&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.hasPin, hasPin) || other.hasPin == hasPin)&&(identical(other.businessName, businessName) || other.businessName == businessName)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion));
}


@override
int get hashCode => Object.hash(runtimeType,isLoading,hasPin,businessName,appVersion);

@override
String toString() {
  return 'MoreState(isLoading: $isLoading, hasPin: $hasPin, businessName: $businessName, appVersion: $appVersion)';
}


}

/// @nodoc
abstract mixin class $MoreStateCopyWith<$Res>  {
  factory $MoreStateCopyWith(MoreState value, $Res Function(MoreState) _then) = _$MoreStateCopyWithImpl;
@useResult
$Res call({
 bool isLoading, bool hasPin, String? businessName, String? appVersion
});




}
/// @nodoc
class _$MoreStateCopyWithImpl<$Res>
    implements $MoreStateCopyWith<$Res> {
  _$MoreStateCopyWithImpl(this._self, this._then);

  final MoreState _self;
  final $Res Function(MoreState) _then;

/// Create a copy of MoreState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? isLoading = null,Object? hasPin = null,Object? businessName = freezed,Object? appVersion = freezed,}) {
  return _then(_self.copyWith(
isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,hasPin: null == hasPin ? _self.hasPin : hasPin // ignore: cast_nullable_to_non_nullable
as bool,businessName: freezed == businessName ? _self.businessName : businessName // ignore: cast_nullable_to_non_nullable
as String?,appVersion: freezed == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [MoreState].
extension MoreStatePatterns on MoreState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MoreState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MoreState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MoreState value)  $default,){
final _that = this;
switch (_that) {
case _MoreState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MoreState value)?  $default,){
final _that = this;
switch (_that) {
case _MoreState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool isLoading,  bool hasPin,  String? businessName,  String? appVersion)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MoreState() when $default != null:
return $default(_that.isLoading,_that.hasPin,_that.businessName,_that.appVersion);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool isLoading,  bool hasPin,  String? businessName,  String? appVersion)  $default,) {final _that = this;
switch (_that) {
case _MoreState():
return $default(_that.isLoading,_that.hasPin,_that.businessName,_that.appVersion);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool isLoading,  bool hasPin,  String? businessName,  String? appVersion)?  $default,) {final _that = this;
switch (_that) {
case _MoreState() when $default != null:
return $default(_that.isLoading,_that.hasPin,_that.businessName,_that.appVersion);case _:
  return null;

}
}

}

/// @nodoc


class _MoreState implements MoreState {
  const _MoreState({this.isLoading = false, this.hasPin = false, this.businessName, this.appVersion});
  

@override@JsonKey() final  bool isLoading;
@override@JsonKey() final  bool hasPin;
@override final  String? businessName;
@override final  String? appVersion;

/// Create a copy of MoreState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MoreStateCopyWith<_MoreState> get copyWith => __$MoreStateCopyWithImpl<_MoreState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MoreState&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.hasPin, hasPin) || other.hasPin == hasPin)&&(identical(other.businessName, businessName) || other.businessName == businessName)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion));
}


@override
int get hashCode => Object.hash(runtimeType,isLoading,hasPin,businessName,appVersion);

@override
String toString() {
  return 'MoreState(isLoading: $isLoading, hasPin: $hasPin, businessName: $businessName, appVersion: $appVersion)';
}


}

/// @nodoc
abstract mixin class _$MoreStateCopyWith<$Res> implements $MoreStateCopyWith<$Res> {
  factory _$MoreStateCopyWith(_MoreState value, $Res Function(_MoreState) _then) = __$MoreStateCopyWithImpl;
@override @useResult
$Res call({
 bool isLoading, bool hasPin, String? businessName, String? appVersion
});




}
/// @nodoc
class __$MoreStateCopyWithImpl<$Res>
    implements _$MoreStateCopyWith<$Res> {
  __$MoreStateCopyWithImpl(this._self, this._then);

  final _MoreState _self;
  final $Res Function(_MoreState) _then;

/// Create a copy of MoreState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? isLoading = null,Object? hasPin = null,Object? businessName = freezed,Object? appVersion = freezed,}) {
  return _then(_MoreState(
isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,hasPin: null == hasPin ? _self.hasPin : hasPin // ignore: cast_nullable_to_non_nullable
as bool,businessName: freezed == businessName ? _self.businessName : businessName // ignore: cast_nullable_to_non_nullable
as String?,appVersion: freezed == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
