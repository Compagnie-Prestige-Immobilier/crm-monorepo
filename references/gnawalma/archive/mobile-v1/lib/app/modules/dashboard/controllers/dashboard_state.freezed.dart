// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$DashboardState {

 List<ProjectModel> get waitingProjects; List<ProjectModel> get readyProjects; List<ProjectModel> get deliveredUnpaidProjects;// Order-centric Pivot
 List<DashboardOrderCardVM> get waitingOrders; List<DashboardOrderCardVM> get readyOrders; List<DashboardOrderCardVM> get deliveredUnpaidOrders; BusinessProfileModel? get businessProfile; double get dailyCash; List<DailyTransaction> get dailyTransactions; int get pendingCount; bool get isLoading;/// Set when the dashboard load failed. Without it a failed read renders as
/// an empty atelier, which reads as data loss.
 bool get hasError;
/// Create a copy of DashboardState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DashboardStateCopyWith<DashboardState> get copyWith => _$DashboardStateCopyWithImpl<DashboardState>(this as DashboardState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DashboardState&&const DeepCollectionEquality().equals(other.waitingProjects, waitingProjects)&&const DeepCollectionEquality().equals(other.readyProjects, readyProjects)&&const DeepCollectionEquality().equals(other.deliveredUnpaidProjects, deliveredUnpaidProjects)&&const DeepCollectionEquality().equals(other.waitingOrders, waitingOrders)&&const DeepCollectionEquality().equals(other.readyOrders, readyOrders)&&const DeepCollectionEquality().equals(other.deliveredUnpaidOrders, deliveredUnpaidOrders)&&(identical(other.businessProfile, businessProfile) || other.businessProfile == businessProfile)&&(identical(other.dailyCash, dailyCash) || other.dailyCash == dailyCash)&&const DeepCollectionEquality().equals(other.dailyTransactions, dailyTransactions)&&(identical(other.pendingCount, pendingCount) || other.pendingCount == pendingCount)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.hasError, hasError) || other.hasError == hasError));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(waitingProjects),const DeepCollectionEquality().hash(readyProjects),const DeepCollectionEquality().hash(deliveredUnpaidProjects),const DeepCollectionEquality().hash(waitingOrders),const DeepCollectionEquality().hash(readyOrders),const DeepCollectionEquality().hash(deliveredUnpaidOrders),businessProfile,dailyCash,const DeepCollectionEquality().hash(dailyTransactions),pendingCount,isLoading,hasError);

@override
String toString() {
  return 'DashboardState(waitingProjects: $waitingProjects, readyProjects: $readyProjects, deliveredUnpaidProjects: $deliveredUnpaidProjects, waitingOrders: $waitingOrders, readyOrders: $readyOrders, deliveredUnpaidOrders: $deliveredUnpaidOrders, businessProfile: $businessProfile, dailyCash: $dailyCash, dailyTransactions: $dailyTransactions, pendingCount: $pendingCount, isLoading: $isLoading, hasError: $hasError)';
}


}

/// @nodoc
abstract mixin class $DashboardStateCopyWith<$Res>  {
  factory $DashboardStateCopyWith(DashboardState value, $Res Function(DashboardState) _then) = _$DashboardStateCopyWithImpl;
@useResult
$Res call({
 List<ProjectModel> waitingProjects, List<ProjectModel> readyProjects, List<ProjectModel> deliveredUnpaidProjects, List<DashboardOrderCardVM> waitingOrders, List<DashboardOrderCardVM> readyOrders, List<DashboardOrderCardVM> deliveredUnpaidOrders, BusinessProfileModel? businessProfile, double dailyCash, List<DailyTransaction> dailyTransactions, int pendingCount, bool isLoading, bool hasError
});




}
/// @nodoc
class _$DashboardStateCopyWithImpl<$Res>
    implements $DashboardStateCopyWith<$Res> {
  _$DashboardStateCopyWithImpl(this._self, this._then);

  final DashboardState _self;
  final $Res Function(DashboardState) _then;

/// Create a copy of DashboardState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? waitingProjects = null,Object? readyProjects = null,Object? deliveredUnpaidProjects = null,Object? waitingOrders = null,Object? readyOrders = null,Object? deliveredUnpaidOrders = null,Object? businessProfile = freezed,Object? dailyCash = null,Object? dailyTransactions = null,Object? pendingCount = null,Object? isLoading = null,Object? hasError = null,}) {
  return _then(_self.copyWith(
waitingProjects: null == waitingProjects ? _self.waitingProjects : waitingProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,readyProjects: null == readyProjects ? _self.readyProjects : readyProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,deliveredUnpaidProjects: null == deliveredUnpaidProjects ? _self.deliveredUnpaidProjects : deliveredUnpaidProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,waitingOrders: null == waitingOrders ? _self.waitingOrders : waitingOrders // ignore: cast_nullable_to_non_nullable
as List<DashboardOrderCardVM>,readyOrders: null == readyOrders ? _self.readyOrders : readyOrders // ignore: cast_nullable_to_non_nullable
as List<DashboardOrderCardVM>,deliveredUnpaidOrders: null == deliveredUnpaidOrders ? _self.deliveredUnpaidOrders : deliveredUnpaidOrders // ignore: cast_nullable_to_non_nullable
as List<DashboardOrderCardVM>,businessProfile: freezed == businessProfile ? _self.businessProfile : businessProfile // ignore: cast_nullable_to_non_nullable
as BusinessProfileModel?,dailyCash: null == dailyCash ? _self.dailyCash : dailyCash // ignore: cast_nullable_to_non_nullable
as double,dailyTransactions: null == dailyTransactions ? _self.dailyTransactions : dailyTransactions // ignore: cast_nullable_to_non_nullable
as List<DailyTransaction>,pendingCount: null == pendingCount ? _self.pendingCount : pendingCount // ignore: cast_nullable_to_non_nullable
as int,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,hasError: null == hasError ? _self.hasError : hasError // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [DashboardState].
extension DashboardStatePatterns on DashboardState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DashboardState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DashboardState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DashboardState value)  $default,){
final _that = this;
switch (_that) {
case _DashboardState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DashboardState value)?  $default,){
final _that = this;
switch (_that) {
case _DashboardState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<ProjectModel> waitingProjects,  List<ProjectModel> readyProjects,  List<ProjectModel> deliveredUnpaidProjects,  List<DashboardOrderCardVM> waitingOrders,  List<DashboardOrderCardVM> readyOrders,  List<DashboardOrderCardVM> deliveredUnpaidOrders,  BusinessProfileModel? businessProfile,  double dailyCash,  List<DailyTransaction> dailyTransactions,  int pendingCount,  bool isLoading,  bool hasError)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DashboardState() when $default != null:
return $default(_that.waitingProjects,_that.readyProjects,_that.deliveredUnpaidProjects,_that.waitingOrders,_that.readyOrders,_that.deliveredUnpaidOrders,_that.businessProfile,_that.dailyCash,_that.dailyTransactions,_that.pendingCount,_that.isLoading,_that.hasError);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<ProjectModel> waitingProjects,  List<ProjectModel> readyProjects,  List<ProjectModel> deliveredUnpaidProjects,  List<DashboardOrderCardVM> waitingOrders,  List<DashboardOrderCardVM> readyOrders,  List<DashboardOrderCardVM> deliveredUnpaidOrders,  BusinessProfileModel? businessProfile,  double dailyCash,  List<DailyTransaction> dailyTransactions,  int pendingCount,  bool isLoading,  bool hasError)  $default,) {final _that = this;
switch (_that) {
case _DashboardState():
return $default(_that.waitingProjects,_that.readyProjects,_that.deliveredUnpaidProjects,_that.waitingOrders,_that.readyOrders,_that.deliveredUnpaidOrders,_that.businessProfile,_that.dailyCash,_that.dailyTransactions,_that.pendingCount,_that.isLoading,_that.hasError);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<ProjectModel> waitingProjects,  List<ProjectModel> readyProjects,  List<ProjectModel> deliveredUnpaidProjects,  List<DashboardOrderCardVM> waitingOrders,  List<DashboardOrderCardVM> readyOrders,  List<DashboardOrderCardVM> deliveredUnpaidOrders,  BusinessProfileModel? businessProfile,  double dailyCash,  List<DailyTransaction> dailyTransactions,  int pendingCount,  bool isLoading,  bool hasError)?  $default,) {final _that = this;
switch (_that) {
case _DashboardState() when $default != null:
return $default(_that.waitingProjects,_that.readyProjects,_that.deliveredUnpaidProjects,_that.waitingOrders,_that.readyOrders,_that.deliveredUnpaidOrders,_that.businessProfile,_that.dailyCash,_that.dailyTransactions,_that.pendingCount,_that.isLoading,_that.hasError);case _:
  return null;

}
}

}

/// @nodoc


class _DashboardState implements DashboardState {
  const _DashboardState({final  List<ProjectModel> waitingProjects = const [], final  List<ProjectModel> readyProjects = const [], final  List<ProjectModel> deliveredUnpaidProjects = const [], final  List<DashboardOrderCardVM> waitingOrders = const [], final  List<DashboardOrderCardVM> readyOrders = const [], final  List<DashboardOrderCardVM> deliveredUnpaidOrders = const [], this.businessProfile, this.dailyCash = 0.0, final  List<DailyTransaction> dailyTransactions = const [], this.pendingCount = 0, this.isLoading = true, this.hasError = false}): _waitingProjects = waitingProjects,_readyProjects = readyProjects,_deliveredUnpaidProjects = deliveredUnpaidProjects,_waitingOrders = waitingOrders,_readyOrders = readyOrders,_deliveredUnpaidOrders = deliveredUnpaidOrders,_dailyTransactions = dailyTransactions;
  

 final  List<ProjectModel> _waitingProjects;
@override@JsonKey() List<ProjectModel> get waitingProjects {
  if (_waitingProjects is EqualUnmodifiableListView) return _waitingProjects;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_waitingProjects);
}

 final  List<ProjectModel> _readyProjects;
@override@JsonKey() List<ProjectModel> get readyProjects {
  if (_readyProjects is EqualUnmodifiableListView) return _readyProjects;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_readyProjects);
}

 final  List<ProjectModel> _deliveredUnpaidProjects;
@override@JsonKey() List<ProjectModel> get deliveredUnpaidProjects {
  if (_deliveredUnpaidProjects is EqualUnmodifiableListView) return _deliveredUnpaidProjects;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_deliveredUnpaidProjects);
}

// Order-centric Pivot
 final  List<DashboardOrderCardVM> _waitingOrders;
// Order-centric Pivot
@override@JsonKey() List<DashboardOrderCardVM> get waitingOrders {
  if (_waitingOrders is EqualUnmodifiableListView) return _waitingOrders;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_waitingOrders);
}

 final  List<DashboardOrderCardVM> _readyOrders;
@override@JsonKey() List<DashboardOrderCardVM> get readyOrders {
  if (_readyOrders is EqualUnmodifiableListView) return _readyOrders;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_readyOrders);
}

 final  List<DashboardOrderCardVM> _deliveredUnpaidOrders;
@override@JsonKey() List<DashboardOrderCardVM> get deliveredUnpaidOrders {
  if (_deliveredUnpaidOrders is EqualUnmodifiableListView) return _deliveredUnpaidOrders;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_deliveredUnpaidOrders);
}

@override final  BusinessProfileModel? businessProfile;
@override@JsonKey() final  double dailyCash;
 final  List<DailyTransaction> _dailyTransactions;
@override@JsonKey() List<DailyTransaction> get dailyTransactions {
  if (_dailyTransactions is EqualUnmodifiableListView) return _dailyTransactions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_dailyTransactions);
}

@override@JsonKey() final  int pendingCount;
@override@JsonKey() final  bool isLoading;
/// Set when the dashboard load failed. Without it a failed read renders as
/// an empty atelier, which reads as data loss.
@override@JsonKey() final  bool hasError;

/// Create a copy of DashboardState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DashboardStateCopyWith<_DashboardState> get copyWith => __$DashboardStateCopyWithImpl<_DashboardState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DashboardState&&const DeepCollectionEquality().equals(other._waitingProjects, _waitingProjects)&&const DeepCollectionEquality().equals(other._readyProjects, _readyProjects)&&const DeepCollectionEquality().equals(other._deliveredUnpaidProjects, _deliveredUnpaidProjects)&&const DeepCollectionEquality().equals(other._waitingOrders, _waitingOrders)&&const DeepCollectionEquality().equals(other._readyOrders, _readyOrders)&&const DeepCollectionEquality().equals(other._deliveredUnpaidOrders, _deliveredUnpaidOrders)&&(identical(other.businessProfile, businessProfile) || other.businessProfile == businessProfile)&&(identical(other.dailyCash, dailyCash) || other.dailyCash == dailyCash)&&const DeepCollectionEquality().equals(other._dailyTransactions, _dailyTransactions)&&(identical(other.pendingCount, pendingCount) || other.pendingCount == pendingCount)&&(identical(other.isLoading, isLoading) || other.isLoading == isLoading)&&(identical(other.hasError, hasError) || other.hasError == hasError));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_waitingProjects),const DeepCollectionEquality().hash(_readyProjects),const DeepCollectionEquality().hash(_deliveredUnpaidProjects),const DeepCollectionEquality().hash(_waitingOrders),const DeepCollectionEquality().hash(_readyOrders),const DeepCollectionEquality().hash(_deliveredUnpaidOrders),businessProfile,dailyCash,const DeepCollectionEquality().hash(_dailyTransactions),pendingCount,isLoading,hasError);

@override
String toString() {
  return 'DashboardState(waitingProjects: $waitingProjects, readyProjects: $readyProjects, deliveredUnpaidProjects: $deliveredUnpaidProjects, waitingOrders: $waitingOrders, readyOrders: $readyOrders, deliveredUnpaidOrders: $deliveredUnpaidOrders, businessProfile: $businessProfile, dailyCash: $dailyCash, dailyTransactions: $dailyTransactions, pendingCount: $pendingCount, isLoading: $isLoading, hasError: $hasError)';
}


}

/// @nodoc
abstract mixin class _$DashboardStateCopyWith<$Res> implements $DashboardStateCopyWith<$Res> {
  factory _$DashboardStateCopyWith(_DashboardState value, $Res Function(_DashboardState) _then) = __$DashboardStateCopyWithImpl;
@override @useResult
$Res call({
 List<ProjectModel> waitingProjects, List<ProjectModel> readyProjects, List<ProjectModel> deliveredUnpaidProjects, List<DashboardOrderCardVM> waitingOrders, List<DashboardOrderCardVM> readyOrders, List<DashboardOrderCardVM> deliveredUnpaidOrders, BusinessProfileModel? businessProfile, double dailyCash, List<DailyTransaction> dailyTransactions, int pendingCount, bool isLoading, bool hasError
});




}
/// @nodoc
class __$DashboardStateCopyWithImpl<$Res>
    implements _$DashboardStateCopyWith<$Res> {
  __$DashboardStateCopyWithImpl(this._self, this._then);

  final _DashboardState _self;
  final $Res Function(_DashboardState) _then;

/// Create a copy of DashboardState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? waitingProjects = null,Object? readyProjects = null,Object? deliveredUnpaidProjects = null,Object? waitingOrders = null,Object? readyOrders = null,Object? deliveredUnpaidOrders = null,Object? businessProfile = freezed,Object? dailyCash = null,Object? dailyTransactions = null,Object? pendingCount = null,Object? isLoading = null,Object? hasError = null,}) {
  return _then(_DashboardState(
waitingProjects: null == waitingProjects ? _self._waitingProjects : waitingProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,readyProjects: null == readyProjects ? _self._readyProjects : readyProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,deliveredUnpaidProjects: null == deliveredUnpaidProjects ? _self._deliveredUnpaidProjects : deliveredUnpaidProjects // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,waitingOrders: null == waitingOrders ? _self._waitingOrders : waitingOrders // ignore: cast_nullable_to_non_nullable
as List<DashboardOrderCardVM>,readyOrders: null == readyOrders ? _self._readyOrders : readyOrders // ignore: cast_nullable_to_non_nullable
as List<DashboardOrderCardVM>,deliveredUnpaidOrders: null == deliveredUnpaidOrders ? _self._deliveredUnpaidOrders : deliveredUnpaidOrders // ignore: cast_nullable_to_non_nullable
as List<DashboardOrderCardVM>,businessProfile: freezed == businessProfile ? _self.businessProfile : businessProfile // ignore: cast_nullable_to_non_nullable
as BusinessProfileModel?,dailyCash: null == dailyCash ? _self.dailyCash : dailyCash // ignore: cast_nullable_to_non_nullable
as double,dailyTransactions: null == dailyTransactions ? _self._dailyTransactions : dailyTransactions // ignore: cast_nullable_to_non_nullable
as List<DailyTransaction>,pendingCount: null == pendingCount ? _self.pendingCount : pendingCount // ignore: cast_nullable_to_non_nullable
as int,isLoading: null == isLoading ? _self.isLoading : isLoading // ignore: cast_nullable_to_non_nullable
as bool,hasError: null == hasError ? _self.hasError : hasError // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
