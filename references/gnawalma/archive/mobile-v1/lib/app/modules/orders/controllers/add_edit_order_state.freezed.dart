// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'add_edit_order_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$AddEditOrderState {

 bool get isEditMode; bool get isLoading; bool get isSaving; OrderModel? get existingOrder; ClientModel? get selectedClient; List<ProjectModel> get selectedProjects; List<ClientModel> get availableClients; List<ProjectModel> get availableProjects; DateTime? get orderDate; DateTime? get expectedDeliveryDate;
/// Create a copy of AddEditOrderState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AddEditOrderStateCopyWith<AddEditOrderState> get copyWith => _$AddEditOrderStateCopyWithImpl<AddEditOrderState>(this as AddEditOrderState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AddEditOrderState&&(identical(other.isEditMode, isEditMode) || other.isEditMode == isEditMode)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isSaving, isSaving) || other.isSaving == isSaving)&&(identical(other.existingOrder, existingOrder) || other.existingOrder == existingOrder)&&(identical(other.selectedClient, selectedClient) || other.selectedClient == selectedClient)&&const DeepCollectionEquality().equals(other.selectedProjects, selectedProjects)&&const DeepCollectionEquality().equals(other.availableClients, availableClients)&&const DeepCollectionEquality().equals(other.availableProjects, availableProjects)&&(identical(other.orderDate, orderDate) || other.orderDate == orderDate)&&(identical(other.expectedDeliveryDate, expectedDeliveryDate) || other.expectedDeliveryDate == expectedDeliveryDate));
}


@override
int get hashCode => Object.hash(runtimeType,isEditMode,isLoading,isSaving,existingOrder,selectedClient,const DeepCollectionEquality().hash(selectedProjects),const DeepCollectionEquality().hash(availableClients),const DeepCollectionEquality().hash(availableProjects),orderDate,expectedDeliveryDate);

@override
String toString() {
  return 'AddEditOrderState(isEditMode: $isEditMode, isLoading: $isLoading, isSaving: $isSaving, existingOrder: $existingOrder, selectedClient: $selectedClient, selectedProjects: $selectedProjects, availableClients: $availableClients, availableProjects: $availableProjects, orderDate: $orderDate, expectedDeliveryDate: $expectedDeliveryDate)';
}


}

/// @nodoc
abstract mixin class $AddEditOrderStateCopyWith<$Res>  {
  factory $AddEditOrderStateCopyWith(AddEditOrderState value, $Res Function(AddEditOrderState) _then) = _$AddEditOrderStateCopyWithImpl;
@useResult
$Res call({
 bool isEditMode, bool isLoading, bool isSaving, OrderModel? existingOrder, ClientModel? selectedClient, List<ProjectModel> selectedProjects, List<ClientModel> availableClients, List<ProjectModel> availableProjects, DateTime? orderDate, DateTime? expectedDeliveryDate
});




}
/// @nodoc
class _$AddEditOrderStateCopyWithImpl<$Res>
    implements $AddEditOrderStateCopyWith<$Res> {
  _$AddEditOrderStateCopyWithImpl(this._self, this._then);

  final AddEditOrderState _self;
  final $Res Function(AddEditOrderState) _then;

/// Create a copy of AddEditOrderState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? isEditMode = null,Object? isLoading = null,Object? isSaving = null,Object? existingOrder = freezed,Object? selectedClient = freezed,Object? selectedProjects = null,Object? availableClients = null,Object? availableProjects = null,Object? orderDate = freezed,Object? expectedDeliveryDate = freezed,}) {
  return _then(_self.copyWith(
isEditMode: null == isEditMode ? _self.isEditMode : isEditMode // ignore: cast_nullable_to_non_nullable
as bool,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isSaving: null == isSaving ? _self.isSaving : isSaving // ignore: cast_nullable_to_non_nullable
as bool,existingOrder: freezed == existingOrder ? _self.existingOrder : existingOrder // ignore: cast_nullable_to_non_nullable
as OrderModel?,selectedClient: freezed == selectedClient ? _self.selectedClient : selectedClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,selectedProjects: null == selectedProjects ? _self.selectedProjects : selectedProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,availableClients: null == availableClients ? _self.availableClients : availableClients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,availableProjects: null == availableProjects ? _self.availableProjects : availableProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,orderDate: freezed == orderDate ? _self.orderDate : orderDate // ignore: cast_nullable_to_non_nullable
as DateTime?,expectedDeliveryDate: freezed == expectedDeliveryDate ? _self.expectedDeliveryDate : expectedDeliveryDate // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [AddEditOrderState].
extension AddEditOrderStatePatterns on AddEditOrderState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AddEditOrderState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AddEditOrderState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AddEditOrderState value)  $default,){
final _that = this;
switch (_that) {
case _AddEditOrderState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AddEditOrderState value)?  $default,){
final _that = this;
switch (_that) {
case _AddEditOrderState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool isEditMode,  bool isLoading,  bool isSaving,  OrderModel? existingOrder,  ClientModel? selectedClient,  List<ProjectModel> selectedProjects,  List<ClientModel> availableClients,  List<ProjectModel> availableProjects,  DateTime? orderDate,  DateTime? expectedDeliveryDate)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AddEditOrderState() when $default != null:
return $default(_that.isEditMode,_that.isLoading,_that.isSaving,_that.existingOrder,_that.selectedClient,_that.selectedProjects,_that.availableClients,_that.availableProjects,_that.orderDate,_that.expectedDeliveryDate);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool isEditMode,  bool isLoading,  bool isSaving,  OrderModel? existingOrder,  ClientModel? selectedClient,  List<ProjectModel> selectedProjects,  List<ClientModel> availableClients,  List<ProjectModel> availableProjects,  DateTime? orderDate,  DateTime? expectedDeliveryDate)  $default,) {final _that = this;
switch (_that) {
case _AddEditOrderState():
return $default(_that.isEditMode,_that.isLoading,_that.isSaving,_that.existingOrder,_that.selectedClient,_that.selectedProjects,_that.availableClients,_that.availableProjects,_that.orderDate,_that.expectedDeliveryDate);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool isEditMode,  bool isLoading,  bool isSaving,  OrderModel? existingOrder,  ClientModel? selectedClient,  List<ProjectModel> selectedProjects,  List<ClientModel> availableClients,  List<ProjectModel> availableProjects,  DateTime? orderDate,  DateTime? expectedDeliveryDate)?  $default,) {final _that = this;
switch (_that) {
case _AddEditOrderState() when $default != null:
return $default(_that.isEditMode,_that.isLoading,_that.isSaving,_that.existingOrder,_that.selectedClient,_that.selectedProjects,_that.availableClients,_that.availableProjects,_that.orderDate,_that.expectedDeliveryDate);case _:
  return null;

}
}

}

/// @nodoc


class _AddEditOrderState implements AddEditOrderState {
  const _AddEditOrderState({this.isEditMode = false, this.isLoading = false, this.isSaving = false, this.existingOrder, this.selectedClient, final  List<ProjectModel> selectedProjects = const [], final  List<ClientModel> availableClients = const [], final  List<ProjectModel> availableProjects = const [], this.orderDate, this.expectedDeliveryDate}): _selectedProjects = selectedProjects,_availableClients = availableClients,_availableProjects = availableProjects;
  

@override@JsonKey() final  bool isEditMode;
@override@JsonKey() final  bool isLoading;
@override@JsonKey() final  bool isSaving;
@override final  OrderModel? existingOrder;
@override final  ClientModel? selectedClient;
 final  List<ProjectModel> _selectedProjects;
@override@JsonKey() List<ProjectModel> get selectedProjects {
  if (_selectedProjects is EqualUnmodifiableListView) return _selectedProjects;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_selectedProjects);
}

 final  List<ClientModel> _availableClients;
@override@JsonKey() List<ClientModel> get availableClients {
  if (_availableClients is EqualUnmodifiableListView) return _availableClients;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_availableClients);
}

 final  List<ProjectModel> _availableProjects;
@override@JsonKey() List<ProjectModel> get availableProjects {
  if (_availableProjects is EqualUnmodifiableListView) return _availableProjects;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_availableProjects);
}

@override final  DateTime? orderDate;
@override final  DateTime? expectedDeliveryDate;

/// Create a copy of AddEditOrderState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AddEditOrderStateCopyWith<_AddEditOrderState> get copyWith => __$AddEditOrderStateCopyWithImpl<_AddEditOrderState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AddEditOrderState&&(identical(other.isEditMode, isEditMode) || other.isEditMode == isEditMode)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isSaving, isSaving) || other.isSaving == isSaving)&&(identical(other.existingOrder, existingOrder) || other.existingOrder == existingOrder)&&(identical(other.selectedClient, selectedClient) || other.selectedClient == selectedClient)&&const DeepCollectionEquality().equals(other._selectedProjects, _selectedProjects)&&const DeepCollectionEquality().equals(other._availableClients, _availableClients)&&const DeepCollectionEquality().equals(other._availableProjects, _availableProjects)&&(identical(other.orderDate, orderDate) || other.orderDate == orderDate)&&(identical(other.expectedDeliveryDate, expectedDeliveryDate) || other.expectedDeliveryDate == expectedDeliveryDate));
}


@override
int get hashCode => Object.hash(runtimeType,isEditMode,isLoading,isSaving,existingOrder,selectedClient,const DeepCollectionEquality().hash(_selectedProjects),const DeepCollectionEquality().hash(_availableClients),const DeepCollectionEquality().hash(_availableProjects),orderDate,expectedDeliveryDate);

@override
String toString() {
  return 'AddEditOrderState(isEditMode: $isEditMode, isLoading: $isLoading, isSaving: $isSaving, existingOrder: $existingOrder, selectedClient: $selectedClient, selectedProjects: $selectedProjects, availableClients: $availableClients, availableProjects: $availableProjects, orderDate: $orderDate, expectedDeliveryDate: $expectedDeliveryDate)';
}


}

/// @nodoc
abstract mixin class _$AddEditOrderStateCopyWith<$Res> implements $AddEditOrderStateCopyWith<$Res> {
  factory _$AddEditOrderStateCopyWith(_AddEditOrderState value, $Res Function(_AddEditOrderState) _then) = __$AddEditOrderStateCopyWithImpl;
@override @useResult
$Res call({
 bool isEditMode, bool isLoading, bool isSaving, OrderModel? existingOrder, ClientModel? selectedClient, List<ProjectModel> selectedProjects, List<ClientModel> availableClients, List<ProjectModel> availableProjects, DateTime? orderDate, DateTime? expectedDeliveryDate
});




}
/// @nodoc
class __$AddEditOrderStateCopyWithImpl<$Res>
    implements _$AddEditOrderStateCopyWith<$Res> {
  __$AddEditOrderStateCopyWithImpl(this._self, this._then);

  final _AddEditOrderState _self;
  final $Res Function(_AddEditOrderState) _then;

/// Create a copy of AddEditOrderState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? isEditMode = null,Object? isLoading = null,Object? isSaving = null,Object? existingOrder = freezed,Object? selectedClient = freezed,Object? selectedProjects = null,Object? availableClients = null,Object? availableProjects = null,Object? orderDate = freezed,Object? expectedDeliveryDate = freezed,}) {
  return _then(_AddEditOrderState(
isEditMode: null == isEditMode ? _self.isEditMode : isEditMode // ignore: cast_nullable_to_non_nullable
as bool,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isSaving: null == isSaving ? _self.isSaving : isSaving // ignore: cast_nullable_to_non_nullable
as bool,existingOrder: freezed == existingOrder ? _self.existingOrder : existingOrder // ignore: cast_nullable_to_non_nullable
as OrderModel?,selectedClient: freezed == selectedClient ? _self.selectedClient : selectedClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,selectedProjects: null == selectedProjects ? _self._selectedProjects : selectedProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,availableClients: null == availableClients ? _self._availableClients : availableClients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,availableProjects: null == availableProjects ? _self._availableProjects : availableProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,orderDate: freezed == orderDate ? _self.orderDate : orderDate // ignore: cast_nullable_to_non_nullable
as DateTime?,expectedDeliveryDate: freezed == expectedDeliveryDate ? _self.expectedDeliveryDate : expectedDeliveryDate // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
