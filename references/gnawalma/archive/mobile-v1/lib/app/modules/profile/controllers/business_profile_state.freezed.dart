// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'business_profile_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$BusinessProfileState {

 bool get isLoading; String? get logoPath; Color? get brandColor;/// True while a chosen image is being copied into app storage.
 bool get isPickingLogo;/// Set when a pick fails, so the error can be shown at the well rather
/// than as a toast — a toast never stands in for a correctable error.
 String? get logoError;/// L'atelier publié, quand il existe. C'est lui la source de vérité du nom,
/// du téléphone, de l'adresse, de la région et des spécialités : le profil
/// local ne sert plus qu'aux documents imprimés.
 String? get remoteAtelierId; String? get regionId; List<String> get specialties;
/// Create a copy of BusinessProfileState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BusinessProfileStateCopyWith<BusinessProfileState> get copyWith => _$BusinessProfileStateCopyWithImpl<BusinessProfileState>(this as BusinessProfileState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BusinessProfileState&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.logoPath, logoPath) || other.logoPath == logoPath)&&(identical(other.brandColor, brandColor) || other.brandColor == brandColor)&&(identical(other.isPickingLogo, isPickingLogo) || other.isPickingLogo == isPickingLogo)&&(identical(other.logoError, logoError) || other.logoError == logoError)&&(identical(other.remoteAtelierId, remoteAtelierId) || other.remoteAtelierId == remoteAtelierId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&const DeepCollectionEquality().equals(other.specialties, specialties));
}


@override
int get hashCode => Object.hash(runtimeType,isLoading,logoPath,brandColor,isPickingLogo,logoError,remoteAtelierId,regionId,const DeepCollectionEquality().hash(specialties));

@override
String toString() {
  return 'BusinessProfileState(isLoading: $isLoading, logoPath: $logoPath, brandColor: $brandColor, isPickingLogo: $isPickingLogo, logoError: $logoError, remoteAtelierId: $remoteAtelierId, regionId: $regionId, specialties: $specialties)';
}


}

/// @nodoc
abstract mixin class $BusinessProfileStateCopyWith<$Res>  {
  factory $BusinessProfileStateCopyWith(BusinessProfileState value, $Res Function(BusinessProfileState) _then) = _$BusinessProfileStateCopyWithImpl;
@useResult
$Res call({
 bool isLoading, String? logoPath, Color? brandColor, bool isPickingLogo, String? logoError, String? remoteAtelierId, String? regionId, List<String> specialties
});




}
/// @nodoc
class _$BusinessProfileStateCopyWithImpl<$Res>
    implements $BusinessProfileStateCopyWith<$Res> {
  _$BusinessProfileStateCopyWithImpl(this._self, this._then);

  final BusinessProfileState _self;
  final $Res Function(BusinessProfileState) _then;

/// Create a copy of BusinessProfileState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? isLoading = null,Object? logoPath = freezed,Object? brandColor = freezed,Object? isPickingLogo = null,Object? logoError = freezed,Object? remoteAtelierId = freezed,Object? regionId = freezed,Object? specialties = null,}) {
  return _then(_self.copyWith(
isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,logoPath: freezed == logoPath ? _self.logoPath : logoPath // ignore: cast_nullable_to_non_nullable
as String?,brandColor: freezed == brandColor ? _self.brandColor : brandColor // ignore: cast_nullable_to_non_nullable
as Color?,isPickingLogo: null == isPickingLogo ? _self.isPickingLogo : isPickingLogo // ignore: cast_nullable_to_non_nullable
as bool,logoError: freezed == logoError ? _self.logoError : logoError // ignore: cast_nullable_to_non_nullable
as String?,remoteAtelierId: freezed == remoteAtelierId ? _self.remoteAtelierId : remoteAtelierId // ignore: cast_nullable_to_non_nullable
as String?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as String?,specialties: null == specialties ? _self.specialties : specialties // ignore: cast_nullable_to_non_nullable
as List<String>,
  ));
}

}


/// Adds pattern-matching-related methods to [BusinessProfileState].
extension BusinessProfileStatePatterns on BusinessProfileState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BusinessProfileState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BusinessProfileState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BusinessProfileState value)  $default,){
final _that = this;
switch (_that) {
case _BusinessProfileState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BusinessProfileState value)?  $default,){
final _that = this;
switch (_that) {
case _BusinessProfileState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool isLoading,  String? logoPath,  Color? brandColor,  bool isPickingLogo,  String? logoError,  String? remoteAtelierId,  String? regionId,  List<String> specialties)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BusinessProfileState() when $default != null:
return $default(_that.isLoading,_that.logoPath,_that.brandColor,_that.isPickingLogo,_that.logoError,_that.remoteAtelierId,_that.regionId,_that.specialties);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool isLoading,  String? logoPath,  Color? brandColor,  bool isPickingLogo,  String? logoError,  String? remoteAtelierId,  String? regionId,  List<String> specialties)  $default,) {final _that = this;
switch (_that) {
case _BusinessProfileState():
return $default(_that.isLoading,_that.logoPath,_that.brandColor,_that.isPickingLogo,_that.logoError,_that.remoteAtelierId,_that.regionId,_that.specialties);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool isLoading,  String? logoPath,  Color? brandColor,  bool isPickingLogo,  String? logoError,  String? remoteAtelierId,  String? regionId,  List<String> specialties)?  $default,) {final _that = this;
switch (_that) {
case _BusinessProfileState() when $default != null:
return $default(_that.isLoading,_that.logoPath,_that.brandColor,_that.isPickingLogo,_that.logoError,_that.remoteAtelierId,_that.regionId,_that.specialties);case _:
  return null;

}
}

}

/// @nodoc


class _BusinessProfileState implements BusinessProfileState {
  const _BusinessProfileState({this.isLoading = false, this.logoPath, this.brandColor, this.isPickingLogo = false, this.logoError, this.remoteAtelierId, this.regionId, final  List<String> specialties = const <String>[]}): _specialties = specialties;
  

@override@JsonKey() final  bool isLoading;
@override final  String? logoPath;
@override final  Color? brandColor;
/// True while a chosen image is being copied into app storage.
@override@JsonKey() final  bool isPickingLogo;
/// Set when a pick fails, so the error can be shown at the well rather
/// than as a toast — a toast never stands in for a correctable error.
@override final  String? logoError;
/// L'atelier publié, quand il existe. C'est lui la source de vérité du nom,
/// du téléphone, de l'adresse, de la région et des spécialités : le profil
/// local ne sert plus qu'aux documents imprimés.
@override final  String? remoteAtelierId;
@override final  String? regionId;
 final  List<String> _specialties;
@override@JsonKey() List<String> get specialties {
  if (_specialties is EqualUnmodifiableListView) return _specialties;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_specialties);
}


/// Create a copy of BusinessProfileState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BusinessProfileStateCopyWith<_BusinessProfileState> get copyWith => __$BusinessProfileStateCopyWithImpl<_BusinessProfileState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BusinessProfileState&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.logoPath, logoPath) || other.logoPath == logoPath)&&(identical(other.brandColor, brandColor) || other.brandColor == brandColor)&&(identical(other.isPickingLogo, isPickingLogo) || other.isPickingLogo == isPickingLogo)&&(identical(other.logoError, logoError) || other.logoError == logoError)&&(identical(other.remoteAtelierId, remoteAtelierId) || other.remoteAtelierId == remoteAtelierId)&&(identical(other.regionId, regionId) || other.regionId == regionId)&&const DeepCollectionEquality().equals(other._specialties, _specialties));
}


@override
int get hashCode => Object.hash(runtimeType,isLoading,logoPath,brandColor,isPickingLogo,logoError,remoteAtelierId,regionId,const DeepCollectionEquality().hash(_specialties));

@override
String toString() {
  return 'BusinessProfileState(isLoading: $isLoading, logoPath: $logoPath, brandColor: $brandColor, isPickingLogo: $isPickingLogo, logoError: $logoError, remoteAtelierId: $remoteAtelierId, regionId: $regionId, specialties: $specialties)';
}


}

/// @nodoc
abstract mixin class _$BusinessProfileStateCopyWith<$Res> implements $BusinessProfileStateCopyWith<$Res> {
  factory _$BusinessProfileStateCopyWith(_BusinessProfileState value, $Res Function(_BusinessProfileState) _then) = __$BusinessProfileStateCopyWithImpl;
@override @useResult
$Res call({
 bool isLoading, String? logoPath, Color? brandColor, bool isPickingLogo, String? logoError, String? remoteAtelierId, String? regionId, List<String> specialties
});




}
/// @nodoc
class __$BusinessProfileStateCopyWithImpl<$Res>
    implements _$BusinessProfileStateCopyWith<$Res> {
  __$BusinessProfileStateCopyWithImpl(this._self, this._then);

  final _BusinessProfileState _self;
  final $Res Function(_BusinessProfileState) _then;

/// Create a copy of BusinessProfileState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? isLoading = null,Object? logoPath = freezed,Object? brandColor = freezed,Object? isPickingLogo = null,Object? logoError = freezed,Object? remoteAtelierId = freezed,Object? regionId = freezed,Object? specialties = null,}) {
  return _then(_BusinessProfileState(
isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,logoPath: freezed == logoPath ? _self.logoPath : logoPath // ignore: cast_nullable_to_non_nullable
as String?,brandColor: freezed == brandColor ? _self.brandColor : brandColor // ignore: cast_nullable_to_non_nullable
as Color?,isPickingLogo: null == isPickingLogo ? _self.isPickingLogo : isPickingLogo // ignore: cast_nullable_to_non_nullable
as bool,logoError: freezed == logoError ? _self.logoError : logoError // ignore: cast_nullable_to_non_nullable
as String?,remoteAtelierId: freezed == remoteAtelierId ? _self.remoteAtelierId : remoteAtelierId // ignore: cast_nullable_to_non_nullable
as String?,regionId: freezed == regionId ? _self.regionId : regionId // ignore: cast_nullable_to_non_nullable
as String?,specialties: null == specialties ? _self._specialties : specialties // ignore: cast_nullable_to_non_nullable
as List<String>,
  ));
}


}

// dart format on
