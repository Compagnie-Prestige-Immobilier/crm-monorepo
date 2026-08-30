// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'orders_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$OrdersState {

 List<OrderModel> get orders; List<OrderModel> get filteredOrders; String get searchQuery; bool get isLoading;/// Set when the underlying stream failed. Distinguishes "load failed"
/// from "you have nothing yet" — rendering the second for the first tells
/// a tailor their order book is empty.
 bool get hasError; PaymentStatus? get selectedPaymentStatus; OrderStatus? get selectedOrderStatus; DateTime? get startDate; DateTime? get endDate; String get filterStatus;
/// Create a copy of OrdersState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OrdersStateCopyWith<OrdersState> get copyWith => _$OrdersStateCopyWithImpl<OrdersState>(this as OrdersState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OrdersState&&const DeepCollectionEquality().equals(other.orders, orders)&&const DeepCollectionEquality().equals(other.filteredOrders, filteredOrders)&&(identical(other.searchQuery, searchQuery) || other.searchQuery == searchQuery)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.hasError, hasError) || other.hasError == hasError)&&(identical(other.selectedPaymentStatus, selectedPaymentStatus) || other.selectedPaymentStatus == selectedPaymentStatus)&&(identical(other.selectedOrderStatus, selectedOrderStatus) || other.selectedOrderStatus == selectedOrderStatus)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.filterStatus, filterStatus) || other.filterStatus == filterStatus));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(orders),const DeepCollectionEquality().hash(filteredOrders),searchQuery,isLoading,hasError,selectedPaymentStatus,selectedOrderStatus,startDate,endDate,filterStatus);

@override
String toString() {
  return 'OrdersState(orders: $orders, filteredOrders: $filteredOrders, searchQuery: $searchQuery, isLoading: $isLoading, hasError: $hasError, selectedPaymentStatus: $selectedPaymentStatus, selectedOrderStatus: $selectedOrderStatus, startDate: $startDate, endDate: $endDate, filterStatus: $filterStatus)';
}


}

/// @nodoc
abstract mixin class $OrdersStateCopyWith<$Res>  {
  factory $OrdersStateCopyWith(OrdersState value, $Res Function(OrdersState) _then) = _$OrdersStateCopyWithImpl;
@useResult
$Res call({
 List<OrderModel> orders, List<OrderModel> filteredOrders, String searchQuery, bool isLoading, bool hasError, PaymentStatus? selectedPaymentStatus, OrderStatus? selectedOrderStatus, DateTime? startDate, DateTime? endDate, String filterStatus
});




}
/// @nodoc
class _$OrdersStateCopyWithImpl<$Res>
    implements $OrdersStateCopyWith<$Res> {
  _$OrdersStateCopyWithImpl(this._self, this._then);

  final OrdersState _self;
  final $Res Function(OrdersState) _then;

/// Create a copy of OrdersState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? orders = null,Object? filteredOrders = null,Object? searchQuery = null,Object? isLoading = null,Object? hasError = null,Object? selectedPaymentStatus = freezed,Object? selectedOrderStatus = freezed,Object? startDate = freezed,Object? endDate = freezed,Object? filterStatus = null,}) {
  return _then(_self.copyWith(
orders: null == orders ? _self.orders : orders // ignore: cast_nullable_to_non_nullable
as List<OrderModel>,filteredOrders: null == filteredOrders ? _self.filteredOrders : filteredOrders // ignore: cast_nullable_to_non_nullable
as List<OrderModel>,searchQuery: null == searchQuery ? _self.searchQuery : searchQuery // ignore: cast_nullable_to_non_nullable
as String,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,hasError: null == hasError ? _self.hasError : hasError // ignore: cast_nullable_to_non_nullable
as bool,selectedPaymentStatus: freezed == selectedPaymentStatus ? _self.selectedPaymentStatus : selectedPaymentStatus // ignore: cast_nullable_to_non_nullable
as PaymentStatus?,selectedOrderStatus: freezed == selectedOrderStatus ? _self.selectedOrderStatus : selectedOrderStatus // ignore: cast_nullable_to_non_nullable
as OrderStatus?,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as DateTime?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as DateTime?,filterStatus: null == filterStatus ? _self.filterStatus : filterStatus // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [OrdersState].
extension OrdersStatePatterns on OrdersState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OrdersState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OrdersState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OrdersState value)  $default,){
final _that = this;
switch (_that) {
case _OrdersState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OrdersState value)?  $default,){
final _that = this;
switch (_that) {
case _OrdersState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<OrderModel> orders,  List<OrderModel> filteredOrders,  String searchQuery,  bool isLoading,  bool hasError,  PaymentStatus? selectedPaymentStatus,  OrderStatus? selectedOrderStatus,  DateTime? startDate,  DateTime? endDate,  String filterStatus)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OrdersState() when $default != null:
return $default(_that.orders,_that.filteredOrders,_that.searchQuery,_that.isLoading,_that.hasError,_that.selectedPaymentStatus,_that.selectedOrderStatus,_that.startDate,_that.endDate,_that.filterStatus);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<OrderModel> orders,  List<OrderModel> filteredOrders,  String searchQuery,  bool isLoading,  bool hasError,  PaymentStatus? selectedPaymentStatus,  OrderStatus? selectedOrderStatus,  DateTime? startDate,  DateTime? endDate,  String filterStatus)  $default,) {final _that = this;
switch (_that) {
case _OrdersState():
return $default(_that.orders,_that.filteredOrders,_that.searchQuery,_that.isLoading,_that.hasError,_that.selectedPaymentStatus,_that.selectedOrderStatus,_that.startDate,_that.endDate,_that.filterStatus);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<OrderModel> orders,  List<OrderModel> filteredOrders,  String searchQuery,  bool isLoading,  bool hasError,  PaymentStatus? selectedPaymentStatus,  OrderStatus? selectedOrderStatus,  DateTime? startDate,  DateTime? endDate,  String filterStatus)?  $default,) {final _that = this;
switch (_that) {
case _OrdersState() when $default != null:
return $default(_that.orders,_that.filteredOrders,_that.searchQuery,_that.isLoading,_that.hasError,_that.selectedPaymentStatus,_that.selectedOrderStatus,_that.startDate,_that.endDate,_that.filterStatus);case _:
  return null;

}
}

}

/// @nodoc


class _OrdersState implements OrdersState {
  const _OrdersState({final  List<OrderModel> orders = const [], final  List<OrderModel> filteredOrders = const [], this.searchQuery = '', this.isLoading = true, this.hasError = false, this.selectedPaymentStatus = null, this.selectedOrderStatus = null, this.startDate, this.endDate, this.filterStatus = 'all'}): _orders = orders,_filteredOrders = filteredOrders;
  

 final  List<OrderModel> _orders;
@override@JsonKey() List<OrderModel> get orders {
  if (_orders is EqualUnmodifiableListView) return _orders;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_orders);
}

 final  List<OrderModel> _filteredOrders;
@override@JsonKey() List<OrderModel> get filteredOrders {
  if (_filteredOrders is EqualUnmodifiableListView) return _filteredOrders;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_filteredOrders);
}

@override@JsonKey() final  String searchQuery;
@override@JsonKey() final  bool isLoading;
/// Set when the underlying stream failed. Distinguishes "load failed"
/// from "you have nothing yet" — rendering the second for the first tells
/// a tailor their order book is empty.
@override@JsonKey() final  bool hasError;
@override@JsonKey() final  PaymentStatus? selectedPaymentStatus;
@override@JsonKey() final  OrderStatus? selectedOrderStatus;
@override final  DateTime? startDate;
@override final  DateTime? endDate;
@override@JsonKey() final  String filterStatus;

/// Create a copy of OrdersState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OrdersStateCopyWith<_OrdersState> get copyWith => __$OrdersStateCopyWithImpl<_OrdersState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OrdersState&&const DeepCollectionEquality().equals(other._orders, _orders)&&const DeepCollectionEquality().equals(other._filteredOrders, _filteredOrders)&&(identical(other.searchQuery, searchQuery) || other.searchQuery == searchQuery)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.hasError, hasError) || other.hasError == hasError)&&(identical(other.selectedPaymentStatus, selectedPaymentStatus) || other.selectedPaymentStatus == selectedPaymentStatus)&&(identical(other.selectedOrderStatus, selectedOrderStatus) || other.selectedOrderStatus == selectedOrderStatus)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.filterStatus, filterStatus) || other.filterStatus == filterStatus));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_orders),const DeepCollectionEquality().hash(_filteredOrders),searchQuery,isLoading,hasError,selectedPaymentStatus,selectedOrderStatus,startDate,endDate,filterStatus);

@override
String toString() {
  return 'OrdersState(orders: $orders, filteredOrders: $filteredOrders, searchQuery: $searchQuery, isLoading: $isLoading, hasError: $hasError, selectedPaymentStatus: $selectedPaymentStatus, selectedOrderStatus: $selectedOrderStatus, startDate: $startDate, endDate: $endDate, filterStatus: $filterStatus)';
}


}

/// @nodoc
abstract mixin class _$OrdersStateCopyWith<$Res> implements $OrdersStateCopyWith<$Res> {
  factory _$OrdersStateCopyWith(_OrdersState value, $Res Function(_OrdersState) _then) = __$OrdersStateCopyWithImpl;
@override @useResult
$Res call({
 List<OrderModel> orders, List<OrderModel> filteredOrders, String searchQuery, bool isLoading, bool hasError, PaymentStatus? selectedPaymentStatus, OrderStatus? selectedOrderStatus, DateTime? startDate, DateTime? endDate, String filterStatus
});




}
/// @nodoc
class __$OrdersStateCopyWithImpl<$Res>
    implements _$OrdersStateCopyWith<$Res> {
  __$OrdersStateCopyWithImpl(this._self, this._then);

  final _OrdersState _self;
  final $Res Function(_OrdersState) _then;

/// Create a copy of OrdersState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? orders = null,Object? filteredOrders = null,Object? searchQuery = null,Object? isLoading = null,Object? hasError = null,Object? selectedPaymentStatus = freezed,Object? selectedOrderStatus = freezed,Object? startDate = freezed,Object? endDate = freezed,Object? filterStatus = null,}) {
  return _then(_OrdersState(
orders: null == orders ? _self._orders : orders // ignore: cast_nullable_to_non_nullable
as List<OrderModel>,filteredOrders: null == filteredOrders ? _self._filteredOrders : filteredOrders // ignore: cast_nullable_to_non_nullable
as List<OrderModel>,searchQuery: null == searchQuery ? _self.searchQuery : searchQuery // ignore: cast_nullable_to_non_nullable
as String,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,hasError: null == hasError ? _self.hasError : hasError // ignore: cast_nullable_to_non_nullable
as bool,selectedPaymentStatus: freezed == selectedPaymentStatus ? _self.selectedPaymentStatus : selectedPaymentStatus // ignore: cast_nullable_to_non_nullable
as PaymentStatus?,selectedOrderStatus: freezed == selectedOrderStatus ? _self.selectedOrderStatus : selectedOrderStatus // ignore: cast_nullable_to_non_nullable
as OrderStatus?,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as DateTime?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as DateTime?,filterStatus: null == filterStatus ? _self.filterStatus : filterStatus // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
