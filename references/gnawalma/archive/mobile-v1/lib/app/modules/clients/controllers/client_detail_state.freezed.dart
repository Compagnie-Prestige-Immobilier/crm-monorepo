// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'client_detail_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$ClientDetailState {

 ClientModel? get client; List<ProjectModel> get clientProjects; bool get isLoading; bool get isLoadingProjects; bool get isPreviewMode;
/// Create a copy of ClientDetailState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ClientDetailStateCopyWith<ClientDetailState> get copyWith => _$ClientDetailStateCopyWithImpl<ClientDetailState>(this as ClientDetailState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ClientDetailState&&(identical(other.client, client) || other.client == client)&&const DeepCollectionEquality().equals(other.clientProjects, clientProjects)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isLoadingProjects, isLoadingProjects) || other.isLoadingProjects == isLoadingProjects)&&(identical(other.isPreviewMode, isPreviewMode) || other.isPreviewMode == isPreviewMode));
}


@override
int get hashCode => Object.hash(runtimeType,client,const DeepCollectionEquality().hash(clientProjects),isLoading,isLoadingProjects,isPreviewMode);

@override
String toString() {
  return 'ClientDetailState(client: $client, clientProjects: $clientProjects, isLoading: $isLoading, isLoadingProjects: $isLoadingProjects, isPreviewMode: $isPreviewMode)';
}


}

/// @nodoc
abstract mixin class $ClientDetailStateCopyWith<$Res>  {
  factory $ClientDetailStateCopyWith(ClientDetailState value, $Res Function(ClientDetailState) _then) = _$ClientDetailStateCopyWithImpl;
@useResult
$Res call({
 ClientModel? client, List<ProjectModel> clientProjects, bool isLoading, bool isLoadingProjects, bool isPreviewMode
});




}
/// @nodoc
class _$ClientDetailStateCopyWithImpl<$Res>
    implements $ClientDetailStateCopyWith<$Res> {
  _$ClientDetailStateCopyWithImpl(this._self, this._then);

  final ClientDetailState _self;
  final $Res Function(ClientDetailState) _then;

/// Create a copy of ClientDetailState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? client = freezed,Object? clientProjects = null,Object? isLoading = null,Object? isLoadingProjects = null,Object? isPreviewMode = null,}) {
  return _then(_self.copyWith(
client: freezed == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as ClientModel?,clientProjects: null == clientProjects ? _self.clientProjects : clientProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isLoadingProjects: null == isLoadingProjects ? _self.isLoadingProjects : isLoadingProjects // ignore: cast_nullable_to_non_nullable
as bool,isPreviewMode: null == isPreviewMode ? _self.isPreviewMode : isPreviewMode // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [ClientDetailState].
extension ClientDetailStatePatterns on ClientDetailState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ClientDetailState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ClientDetailState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ClientDetailState value)  $default,){
final _that = this;
switch (_that) {
case _ClientDetailState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ClientDetailState value)?  $default,){
final _that = this;
switch (_that) {
case _ClientDetailState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ClientModel? client,  List<ProjectModel> clientProjects,  bool isLoading,  bool isLoadingProjects,  bool isPreviewMode)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ClientDetailState() when $default != null:
return $default(_that.client,_that.clientProjects,_that.isLoading,_that.isLoadingProjects,_that.isPreviewMode);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ClientModel? client,  List<ProjectModel> clientProjects,  bool isLoading,  bool isLoadingProjects,  bool isPreviewMode)  $default,) {final _that = this;
switch (_that) {
case _ClientDetailState():
return $default(_that.client,_that.clientProjects,_that.isLoading,_that.isLoadingProjects,_that.isPreviewMode);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ClientModel? client,  List<ProjectModel> clientProjects,  bool isLoading,  bool isLoadingProjects,  bool isPreviewMode)?  $default,) {final _that = this;
switch (_that) {
case _ClientDetailState() when $default != null:
return $default(_that.client,_that.clientProjects,_that.isLoading,_that.isLoadingProjects,_that.isPreviewMode);case _:
  return null;

}
}

}

/// @nodoc


class _ClientDetailState implements ClientDetailState {
  const _ClientDetailState({this.client, final  List<ProjectModel> clientProjects = const [], this.isLoading = true, this.isLoadingProjects = true, this.isPreviewMode = false}): _clientProjects = clientProjects;
  

@override final  ClientModel? client;
 final  List<ProjectModel> _clientProjects;
@override@JsonKey() List<ProjectModel> get clientProjects {
  if (_clientProjects is EqualUnmodifiableListView) return _clientProjects;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_clientProjects);
}

@override@JsonKey() final  bool isLoading;
@override@JsonKey() final  bool isLoadingProjects;
@override@JsonKey() final  bool isPreviewMode;

/// Create a copy of ClientDetailState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ClientDetailStateCopyWith<_ClientDetailState> get copyWith => __$ClientDetailStateCopyWithImpl<_ClientDetailState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ClientDetailState&&(identical(other.client, client) || other.client == client)&&const DeepCollectionEquality().equals(other._clientProjects, _clientProjects)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isLoadingProjects, isLoadingProjects) || other.isLoadingProjects == isLoadingProjects)&&(identical(other.isPreviewMode, isPreviewMode) || other.isPreviewMode == isPreviewMode));
}


@override
int get hashCode => Object.hash(runtimeType,client,const DeepCollectionEquality().hash(_clientProjects),isLoading,isLoadingProjects,isPreviewMode);

@override
String toString() {
  return 'ClientDetailState(client: $client, clientProjects: $clientProjects, isLoading: $isLoading, isLoadingProjects: $isLoadingProjects, isPreviewMode: $isPreviewMode)';
}


}

/// @nodoc
abstract mixin class _$ClientDetailStateCopyWith<$Res> implements $ClientDetailStateCopyWith<$Res> {
  factory _$ClientDetailStateCopyWith(_ClientDetailState value, $Res Function(_ClientDetailState) _then) = __$ClientDetailStateCopyWithImpl;
@override @useResult
$Res call({
 ClientModel? client, List<ProjectModel> clientProjects, bool isLoading, bool isLoadingProjects, bool isPreviewMode
});




}
/// @nodoc
class __$ClientDetailStateCopyWithImpl<$Res>
    implements _$ClientDetailStateCopyWith<$Res> {
  __$ClientDetailStateCopyWithImpl(this._self, this._then);

  final _ClientDetailState _self;
  final $Res Function(_ClientDetailState) _then;

/// Create a copy of ClientDetailState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? client = freezed,Object? clientProjects = null,Object? isLoading = null,Object? isLoadingProjects = null,Object? isPreviewMode = null,}) {
  return _then(_ClientDetailState(
client: freezed == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as ClientModel?,clientProjects: null == clientProjects ? _self._clientProjects : clientProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isLoadingProjects: null == isLoadingProjects ? _self.isLoadingProjects : isLoadingProjects // ignore: cast_nullable_to_non_nullable
as bool,isPreviewMode: null == isPreviewMode ? _self.isPreviewMode : isPreviewMode // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
