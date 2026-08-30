// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'order_detail_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$OrderDetailState {

 OrderModel? get order; ClientModel? get client; List<ProjectModel> get orderProjects; bool get isLoading;
/// Create a copy of OrderDetailState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OrderDetailStateCopyWith<OrderDetailState> get copyWith => _$OrderDetailStateCopyWithImpl<OrderDetailState>(this as OrderDetailState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OrderDetailState&&(identical(other.order, order) || other.order == order)&&(identical(other.client, client) || other.client == client)&&const DeepCollectionEquality().equals(other.orderProjects, orderProjects)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading));
}


@override
int get hashCode => Object.hash(runtimeType,order,client,const DeepCollectionEquality().hash(orderProjects),isLoading);

@override
String toString() {
  return 'OrderDetailState(order: $order, client: $client, orderProjects: $orderProjects, isLoading: $isLoading)';
}


}

/// @nodoc
abstract mixin class $OrderDetailStateCopyWith<$Res>  {
  factory $OrderDetailStateCopyWith(OrderDetailState value, $Res Function(OrderDetailState) _then) = _$OrderDetailStateCopyWithImpl;
@useResult
$Res call({
 OrderModel? order, ClientModel? client, List<ProjectModel> orderProjects, bool isLoading
});




}
/// @nodoc
class _$OrderDetailStateCopyWithImpl<$Res>
    implements $OrderDetailStateCopyWith<$Res> {
  _$OrderDetailStateCopyWithImpl(this._self, this._then);

  final OrderDetailState _self;
  final $Res Function(OrderDetailState) _then;

/// Create a copy of OrderDetailState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? order = freezed,Object? client = freezed,Object? orderProjects = null,Object? isLoading = null,}) {
  return _then(_self.copyWith(
order: freezed == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as OrderModel?,client: freezed == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as ClientModel?,orderProjects: null == orderProjects ? _self.orderProjects : orderProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [OrderDetailState].
extension OrderDetailStatePatterns on OrderDetailState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OrderDetailState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OrderDetailState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OrderDetailState value)  $default,){
final _that = this;
switch (_that) {
case _OrderDetailState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OrderDetailState value)?  $default,){
final _that = this;
switch (_that) {
case _OrderDetailState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( OrderModel? order,  ClientModel? client,  List<ProjectModel> orderProjects,  bool isLoading)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OrderDetailState() when $default != null:
return $default(_that.order,_that.client,_that.orderProjects,_that.isLoading);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( OrderModel? order,  ClientModel? client,  List<ProjectModel> orderProjects,  bool isLoading)  $default,) {final _that = this;
switch (_that) {
case _OrderDetailState():
return $default(_that.order,_that.client,_that.orderProjects,_that.isLoading);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( OrderModel? order,  ClientModel? client,  List<ProjectModel> orderProjects,  bool isLoading)?  $default,) {final _that = this;
switch (_that) {
case _OrderDetailState() when $default != null:
return $default(_that.order,_that.client,_that.orderProjects,_that.isLoading);case _:
  return null;

}
}

}

/// @nodoc


class _OrderDetailState implements OrderDetailState {
  const _OrderDetailState({this.order, this.client, final  List<ProjectModel> orderProjects = const [], this.isLoading = false}): _orderProjects = orderProjects;
  

@override final  OrderModel? order;
@override final  ClientModel? client;
 final  List<ProjectModel> _orderProjects;
@override@JsonKey() List<ProjectModel> get orderProjects {
  if (_orderProjects is EqualUnmodifiableListView) return _orderProjects;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_orderProjects);
}

@override@JsonKey() final  bool isLoading;

/// Create a copy of OrderDetailState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OrderDetailStateCopyWith<_OrderDetailState> get copyWith => __$OrderDetailStateCopyWithImpl<_OrderDetailState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OrderDetailState&&(identical(other.order, order) || other.order == order)&&(identical(other.client, client) || other.client == client)&&const DeepCollectionEquality().equals(other._orderProjects, _orderProjects)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading));
}


@override
int get hashCode => Object.hash(runtimeType,order,client,const DeepCollectionEquality().hash(_orderProjects),isLoading);

@override
String toString() {
  return 'OrderDetailState(order: $order, client: $client, orderProjects: $orderProjects, isLoading: $isLoading)';
}


}

/// @nodoc
abstract mixin class _$OrderDetailStateCopyWith<$Res> implements $OrderDetailStateCopyWith<$Res> {
  factory _$OrderDetailStateCopyWith(_OrderDetailState value, $Res Function(_OrderDetailState) _then) = __$OrderDetailStateCopyWithImpl;
@override @useResult
$Res call({
 OrderModel? order, ClientModel? client, List<ProjectModel> orderProjects, bool isLoading
});




}
/// @nodoc
class __$OrderDetailStateCopyWithImpl<$Res>
    implements _$OrderDetailStateCopyWith<$Res> {
  __$OrderDetailStateCopyWithImpl(this._self, this._then);

  final _OrderDetailState _self;
  final $Res Function(_OrderDetailState) _then;

/// Create a copy of OrderDetailState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? order = freezed,Object? client = freezed,Object? orderProjects = null,Object? isLoading = null,}) {
  return _then(_OrderDetailState(
order: freezed == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as OrderModel?,client: freezed == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as ClientModel?,orderProjects: null == orderProjects ? _self._orderProjects : orderProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
