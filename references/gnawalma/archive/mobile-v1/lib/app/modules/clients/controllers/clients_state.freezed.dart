// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'clients_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$ClientsState {

 List<ClientModel> get clients; List<ClientModel> get filteredClients; String get searchQuery; bool get isLoading;/// Set when the underlying stream failed. Distinguishes "load failed"
/// from "you have nothing yet".
 bool get hasError;
/// Create a copy of ClientsState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ClientsStateCopyWith<ClientsState> get copyWith => _$ClientsStateCopyWithImpl<ClientsState>(this as ClientsState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ClientsState&&const DeepCollectionEquality().equals(other.clients, clients)&&const DeepCollectionEquality().equals(other.filteredClients, filteredClients)&&(identical(other.searchQuery, searchQuery) || other.searchQuery == searchQuery)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.hasError, hasError) || other.hasError == hasError));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(clients),const DeepCollectionEquality().hash(filteredClients),searchQuery,isLoading,hasError);

@override
String toString() {
  return 'ClientsState(clients: $clients, filteredClients: $filteredClients, searchQuery: $searchQuery, isLoading: $isLoading, hasError: $hasError)';
}


}

/// @nodoc
abstract mixin class $ClientsStateCopyWith<$Res>  {
  factory $ClientsStateCopyWith(ClientsState value, $Res Function(ClientsState) _then) = _$ClientsStateCopyWithImpl;
@useResult
$Res call({
 List<ClientModel> clients, List<ClientModel> filteredClients, String searchQuery, bool isLoading, bool hasError
});




}
/// @nodoc
class _$ClientsStateCopyWithImpl<$Res>
    implements $ClientsStateCopyWith<$Res> {
  _$ClientsStateCopyWithImpl(this._self, this._then);

  final ClientsState _self;
  final $Res Function(ClientsState) _then;

/// Create a copy of ClientsState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? clients = null,Object? filteredClients = null,Object? searchQuery = null,Object? isLoading = null,Object? hasError = null,}) {
  return _then(_self.copyWith(
clients: null == clients ? _self.clients : clients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,filteredClients: null == filteredClients ? _self.filteredClients : filteredClients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,searchQuery: null == searchQuery ? _self.searchQuery : searchQuery // ignore: cast_nullable_to_non_nullable
as String,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,hasError: null == hasError ? _self.hasError : hasError // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [ClientsState].
extension ClientsStatePatterns on ClientsState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ClientsState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ClientsState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ClientsState value)  $default,){
final _that = this;
switch (_that) {
case _ClientsState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ClientsState value)?  $default,){
final _that = this;
switch (_that) {
case _ClientsState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<ClientModel> clients,  List<ClientModel> filteredClients,  String searchQuery,  bool isLoading,  bool hasError)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ClientsState() when $default != null:
return $default(_that.clients,_that.filteredClients,_that.searchQuery,_that.isLoading,_that.hasError);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<ClientModel> clients,  List<ClientModel> filteredClients,  String searchQuery,  bool isLoading,  bool hasError)  $default,) {final _that = this;
switch (_that) {
case _ClientsState():
return $default(_that.clients,_that.filteredClients,_that.searchQuery,_that.isLoading,_that.hasError);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<ClientModel> clients,  List<ClientModel> filteredClients,  String searchQuery,  bool isLoading,  bool hasError)?  $default,) {final _that = this;
switch (_that) {
case _ClientsState() when $default != null:
return $default(_that.clients,_that.filteredClients,_that.searchQuery,_that.isLoading,_that.hasError);case _:
  return null;

}
}

}

/// @nodoc


class _ClientsState implements ClientsState {
  const _ClientsState({final  List<ClientModel> clients = const [], final  List<ClientModel> filteredClients = const [], this.searchQuery = '', this.isLoading = true, this.hasError = false}): _clients = clients,_filteredClients = filteredClients;
  

 final  List<ClientModel> _clients;
@override@JsonKey() List<ClientModel> get clients {
  if (_clients is EqualUnmodifiableListView) return _clients;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_clients);
}

 final  List<ClientModel> _filteredClients;
@override@JsonKey() List<ClientModel> get filteredClients {
  if (_filteredClients is EqualUnmodifiableListView) return _filteredClients;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_filteredClients);
}

@override@JsonKey() final  String searchQuery;
@override@JsonKey() final  bool isLoading;
/// Set when the underlying stream failed. Distinguishes "load failed"
/// from "you have nothing yet".
@override@JsonKey() final  bool hasError;

/// Create a copy of ClientsState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ClientsStateCopyWith<_ClientsState> get copyWith => __$ClientsStateCopyWithImpl<_ClientsState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ClientsState&&const DeepCollectionEquality().equals(other._clients, _clients)&&const DeepCollectionEquality().equals(other._filteredClients, _filteredClients)&&(identical(other.searchQuery, searchQuery) || other.searchQuery == searchQuery)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.hasError, hasError) || other.hasError == hasError));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_clients),const DeepCollectionEquality().hash(_filteredClients),searchQuery,isLoading,hasError);

@override
String toString() {
  return 'ClientsState(clients: $clients, filteredClients: $filteredClients, searchQuery: $searchQuery, isLoading: $isLoading, hasError: $hasError)';
}


}

/// @nodoc
abstract mixin class _$ClientsStateCopyWith<$Res> implements $ClientsStateCopyWith<$Res> {
  factory _$ClientsStateCopyWith(_ClientsState value, $Res Function(_ClientsState) _then) = __$ClientsStateCopyWithImpl;
@override @useResult
$Res call({
 List<ClientModel> clients, List<ClientModel> filteredClients, String searchQuery, bool isLoading, bool hasError
});




}
/// @nodoc
class __$ClientsStateCopyWithImpl<$Res>
    implements _$ClientsStateCopyWith<$Res> {
  __$ClientsStateCopyWithImpl(this._self, this._then);

  final _ClientsState _self;
  final $Res Function(_ClientsState) _then;

/// Create a copy of ClientsState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? clients = null,Object? filteredClients = null,Object? searchQuery = null,Object? isLoading = null,Object? hasError = null,}) {
  return _then(_ClientsState(
clients: null == clients ? _self._clients : clients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,filteredClients: null == filteredClients ? _self._filteredClients : filteredClients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,searchQuery: null == searchQuery ? _self.searchQuery : searchQuery // ignore: cast_nullable_to_non_nullable
as String,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,hasError: null == hasError ? _self.hasError : hasError // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
