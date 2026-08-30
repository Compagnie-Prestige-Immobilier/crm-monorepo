// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'project_detail_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$ProjectDetailState {

 ProjectModel? get project; OrderModel? get order; List<ProjectModel> get orderArticles; ClientModel? get client; PatternModel? get pattern; bool get isLoading; bool get isPreviewMode;
/// Create a copy of ProjectDetailState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProjectDetailStateCopyWith<ProjectDetailState> get copyWith => _$ProjectDetailStateCopyWithImpl<ProjectDetailState>(this as ProjectDetailState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProjectDetailState&&(identical(other.project, project) || other.project == project)&&(identical(other.order, order) || other.order == order)&&const DeepCollectionEquality().equals(other.orderArticles, orderArticles)&&(identical(other.client, client) || other.client == client)&&(identical(other.pattern, pattern) || other.pattern == pattern)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isPreviewMode, isPreviewMode) || other.isPreviewMode == isPreviewMode));
}


@override
int get hashCode => Object.hash(runtimeType,project,order,const DeepCollectionEquality().hash(orderArticles),client,pattern,isLoading,isPreviewMode);

@override
String toString() {
  return 'ProjectDetailState(project: $project, order: $order, orderArticles: $orderArticles, client: $client, pattern: $pattern, isLoading: $isLoading, isPreviewMode: $isPreviewMode)';
}


}

/// @nodoc
abstract mixin class $ProjectDetailStateCopyWith<$Res>  {
  factory $ProjectDetailStateCopyWith(ProjectDetailState value, $Res Function(ProjectDetailState) _then) = _$ProjectDetailStateCopyWithImpl;
@useResult
$Res call({
 ProjectModel? project, OrderModel? order, List<ProjectModel> orderArticles, ClientModel? client, PatternModel? pattern, bool isLoading, bool isPreviewMode
});




}
/// @nodoc
class _$ProjectDetailStateCopyWithImpl<$Res>
    implements $ProjectDetailStateCopyWith<$Res> {
  _$ProjectDetailStateCopyWithImpl(this._self, this._then);

  final ProjectDetailState _self;
  final $Res Function(ProjectDetailState) _then;

/// Create a copy of ProjectDetailState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? project = freezed,Object? order = freezed,Object? orderArticles = null,Object? client = freezed,Object? pattern = freezed,Object? isLoading = null,Object? isPreviewMode = null,}) {
  return _then(_self.copyWith(
project: freezed == project ? _self.project : project // ignore: cast_nullable_to_non_nullable
as ProjectModel?,order: freezed == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as OrderModel?,orderArticles: null == orderArticles ? _self.orderArticles : orderArticles // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,client: freezed == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as ClientModel?,pattern: freezed == pattern ? _self.pattern : pattern // ignore: cast_nullable_to_non_nullable
as PatternModel?,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isPreviewMode: null == isPreviewMode ? _self.isPreviewMode : isPreviewMode // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [ProjectDetailState].
extension ProjectDetailStatePatterns on ProjectDetailState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProjectDetailState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProjectDetailState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProjectDetailState value)  $default,){
final _that = this;
switch (_that) {
case _ProjectDetailState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProjectDetailState value)?  $default,){
final _that = this;
switch (_that) {
case _ProjectDetailState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ProjectModel? project,  OrderModel? order,  List<ProjectModel> orderArticles,  ClientModel? client,  PatternModel? pattern,  bool isLoading,  bool isPreviewMode)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProjectDetailState() when $default != null:
return $default(_that.project,_that.order,_that.orderArticles,_that.client,_that.pattern,_that.isLoading,_that.isPreviewMode);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ProjectModel? project,  OrderModel? order,  List<ProjectModel> orderArticles,  ClientModel? client,  PatternModel? pattern,  bool isLoading,  bool isPreviewMode)  $default,) {final _that = this;
switch (_that) {
case _ProjectDetailState():
return $default(_that.project,_that.order,_that.orderArticles,_that.client,_that.pattern,_that.isLoading,_that.isPreviewMode);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ProjectModel? project,  OrderModel? order,  List<ProjectModel> orderArticles,  ClientModel? client,  PatternModel? pattern,  bool isLoading,  bool isPreviewMode)?  $default,) {final _that = this;
switch (_that) {
case _ProjectDetailState() when $default != null:
return $default(_that.project,_that.order,_that.orderArticles,_that.client,_that.pattern,_that.isLoading,_that.isPreviewMode);case _:
  return null;

}
}

}

/// @nodoc


class _ProjectDetailState implements ProjectDetailState {
  const _ProjectDetailState({this.project, this.order, final  List<ProjectModel> orderArticles = const [], this.client, this.pattern, this.isLoading = true, this.isPreviewMode = false}): _orderArticles = orderArticles;
  

@override final  ProjectModel? project;
@override final  OrderModel? order;
 final  List<ProjectModel> _orderArticles;
@override@JsonKey() List<ProjectModel> get orderArticles {
  if (_orderArticles is EqualUnmodifiableListView) return _orderArticles;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_orderArticles);
}

@override final  ClientModel? client;
@override final  PatternModel? pattern;
@override@JsonKey() final  bool isLoading;
@override@JsonKey() final  bool isPreviewMode;

/// Create a copy of ProjectDetailState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProjectDetailStateCopyWith<_ProjectDetailState> get copyWith => __$ProjectDetailStateCopyWithImpl<_ProjectDetailState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProjectDetailState&&(identical(other.project, project) || other.project == project)&&(identical(other.order, order) || other.order == order)&&const DeepCollectionEquality().equals(other._orderArticles, _orderArticles)&&(identical(other.client, client) || other.client == client)&&(identical(other.pattern, pattern) || other.pattern == pattern)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.isPreviewMode, isPreviewMode) || other.isPreviewMode == isPreviewMode));
}


@override
int get hashCode => Object.hash(runtimeType,project,order,const DeepCollectionEquality().hash(_orderArticles),client,pattern,isLoading,isPreviewMode);

@override
String toString() {
  return 'ProjectDetailState(project: $project, order: $order, orderArticles: $orderArticles, client: $client, pattern: $pattern, isLoading: $isLoading, isPreviewMode: $isPreviewMode)';
}


}

/// @nodoc
abstract mixin class _$ProjectDetailStateCopyWith<$Res> implements $ProjectDetailStateCopyWith<$Res> {
  factory _$ProjectDetailStateCopyWith(_ProjectDetailState value, $Res Function(_ProjectDetailState) _then) = __$ProjectDetailStateCopyWithImpl;
@override @useResult
$Res call({
 ProjectModel? project, OrderModel? order, List<ProjectModel> orderArticles, ClientModel? client, PatternModel? pattern, bool isLoading, bool isPreviewMode
});




}
/// @nodoc
class __$ProjectDetailStateCopyWithImpl<$Res>
    implements _$ProjectDetailStateCopyWith<$Res> {
  __$ProjectDetailStateCopyWithImpl(this._self, this._then);

  final _ProjectDetailState _self;
  final $Res Function(_ProjectDetailState) _then;

/// Create a copy of ProjectDetailState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? project = freezed,Object? order = freezed,Object? orderArticles = null,Object? client = freezed,Object? pattern = freezed,Object? isLoading = null,Object? isPreviewMode = null,}) {
  return _then(_ProjectDetailState(
project: freezed == project ? _self.project : project // ignore: cast_nullable_to_non_nullable
as ProjectModel?,order: freezed == order ? _self.order : order // ignore: cast_nullable_to_non_nullable
as OrderModel?,orderArticles: null == orderArticles ? _self._orderArticles : orderArticles // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,client: freezed == client ? _self.client : client // ignore: cast_nullable_to_non_nullable
as ClientModel?,pattern: freezed == pattern ? _self.pattern : pattern // ignore: cast_nullable_to_non_nullable
as PatternModel?,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,isPreviewMode: null == isPreviewMode ? _self.isPreviewMode : isPreviewMode // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
