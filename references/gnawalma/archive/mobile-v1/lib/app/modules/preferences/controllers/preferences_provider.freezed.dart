// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'preferences_provider.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$PreferencesState {

 String get selectedCurrency; String get selectedTheme; int get maxProjectsPerWeek; bool get notificationsEnabled; bool get overdueReminders; bool get paymentReminders;
/// Create a copy of PreferencesState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PreferencesStateCopyWith<PreferencesState> get copyWith => _$PreferencesStateCopyWithImpl<PreferencesState>(this as PreferencesState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PreferencesState&&(identical(other.selectedCurrency, selectedCurrency) || other.selectedCurrency == selectedCurrency)&&(identical(other.selectedTheme, selectedTheme) || other.selectedTheme == selectedTheme)&&(identical(other.maxProjectsPerWeek, maxProjectsPerWeek) || other.maxProjectsPerWeek == maxProjectsPerWeek)&&(identical(other.notificationsEnabled, notificationsEnabled) || other.notificationsEnabled == notificationsEnabled)&&(identical(other.overdueReminders, overdueReminders) || other.overdueReminders == overdueReminders)&&(identical(other.paymentReminders, paymentReminders) || other.paymentReminders == paymentReminders));
}


@override
int get hashCode => Object.hash(runtimeType,selectedCurrency,selectedTheme,maxProjectsPerWeek,notificationsEnabled,overdueReminders,paymentReminders);

@override
String toString() {
  return 'PreferencesState(selectedCurrency: $selectedCurrency, selectedTheme: $selectedTheme, maxProjectsPerWeek: $maxProjectsPerWeek, notificationsEnabled: $notificationsEnabled, overdueReminders: $overdueReminders, paymentReminders: $paymentReminders)';
}


}

/// @nodoc
abstract mixin class $PreferencesStateCopyWith<$Res>  {
  factory $PreferencesStateCopyWith(PreferencesState value, $Res Function(PreferencesState) _then) = _$PreferencesStateCopyWithImpl;
@useResult
$Res call({
 String selectedCurrency, String selectedTheme, int maxProjectsPerWeek, bool notificationsEnabled, bool overdueReminders, bool paymentReminders
});




}
/// @nodoc
class _$PreferencesStateCopyWithImpl<$Res>
    implements $PreferencesStateCopyWith<$Res> {
  _$PreferencesStateCopyWithImpl(this._self, this._then);

  final PreferencesState _self;
  final $Res Function(PreferencesState) _then;

/// Create a copy of PreferencesState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? selectedCurrency = null,Object? selectedTheme = null,Object? maxProjectsPerWeek = null,Object? notificationsEnabled = null,Object? overdueReminders = null,Object? paymentReminders = null,}) {
  return _then(_self.copyWith(
selectedCurrency: null == selectedCurrency ? _self.selectedCurrency : selectedCurrency // ignore: cast_nullable_to_non_nullable
as String,selectedTheme: null == selectedTheme ? _self.selectedTheme : selectedTheme // ignore: cast_nullable_to_non_nullable
as String,maxProjectsPerWeek: null == maxProjectsPerWeek ? _self.maxProjectsPerWeek : maxProjectsPerWeek // ignore: cast_nullable_to_non_nullable
as int,notificationsEnabled: null == notificationsEnabled ? _self.notificationsEnabled : notificationsEnabled // ignore: cast_nullable_to_non_nullable
as bool,overdueReminders: null == overdueReminders ? _self.overdueReminders : overdueReminders // ignore: cast_nullable_to_non_nullable
as bool,paymentReminders: null == paymentReminders ? _self.paymentReminders : paymentReminders // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [PreferencesState].
extension PreferencesStatePatterns on PreferencesState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PreferencesState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PreferencesState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PreferencesState value)  $default,){
final _that = this;
switch (_that) {
case _PreferencesState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PreferencesState value)?  $default,){
final _that = this;
switch (_that) {
case _PreferencesState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String selectedCurrency,  String selectedTheme,  int maxProjectsPerWeek,  bool notificationsEnabled,  bool overdueReminders,  bool paymentReminders)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PreferencesState() when $default != null:
return $default(_that.selectedCurrency,_that.selectedTheme,_that.maxProjectsPerWeek,_that.notificationsEnabled,_that.overdueReminders,_that.paymentReminders);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String selectedCurrency,  String selectedTheme,  int maxProjectsPerWeek,  bool notificationsEnabled,  bool overdueReminders,  bool paymentReminders)  $default,) {final _that = this;
switch (_that) {
case _PreferencesState():
return $default(_that.selectedCurrency,_that.selectedTheme,_that.maxProjectsPerWeek,_that.notificationsEnabled,_that.overdueReminders,_that.paymentReminders);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String selectedCurrency,  String selectedTheme,  int maxProjectsPerWeek,  bool notificationsEnabled,  bool overdueReminders,  bool paymentReminders)?  $default,) {final _that = this;
switch (_that) {
case _PreferencesState() when $default != null:
return $default(_that.selectedCurrency,_that.selectedTheme,_that.maxProjectsPerWeek,_that.notificationsEnabled,_that.overdueReminders,_that.paymentReminders);case _:
  return null;

}
}

}

/// @nodoc


class _PreferencesState implements PreferencesState {
  const _PreferencesState({this.selectedCurrency = 'FCFA', this.selectedTheme = AppConstants.themeSystem, this.maxProjectsPerWeek = 10, this.notificationsEnabled = true, this.overdueReminders = true, this.paymentReminders = true});
  

@override@JsonKey() final  String selectedCurrency;
@override@JsonKey() final  String selectedTheme;
@override@JsonKey() final  int maxProjectsPerWeek;
@override@JsonKey() final  bool notificationsEnabled;
@override@JsonKey() final  bool overdueReminders;
@override@JsonKey() final  bool paymentReminders;

/// Create a copy of PreferencesState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PreferencesStateCopyWith<_PreferencesState> get copyWith => __$PreferencesStateCopyWithImpl<_PreferencesState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PreferencesState&&(identical(other.selectedCurrency, selectedCurrency) || other.selectedCurrency == selectedCurrency)&&(identical(other.selectedTheme, selectedTheme) || other.selectedTheme == selectedTheme)&&(identical(other.maxProjectsPerWeek, maxProjectsPerWeek) || other.maxProjectsPerWeek == maxProjectsPerWeek)&&(identical(other.notificationsEnabled, notificationsEnabled) || other.notificationsEnabled == notificationsEnabled)&&(identical(other.overdueReminders, overdueReminders) || other.overdueReminders == overdueReminders)&&(identical(other.paymentReminders, paymentReminders) || other.paymentReminders == paymentReminders));
}


@override
int get hashCode => Object.hash(runtimeType,selectedCurrency,selectedTheme,maxProjectsPerWeek,notificationsEnabled,overdueReminders,paymentReminders);

@override
String toString() {
  return 'PreferencesState(selectedCurrency: $selectedCurrency, selectedTheme: $selectedTheme, maxProjectsPerWeek: $maxProjectsPerWeek, notificationsEnabled: $notificationsEnabled, overdueReminders: $overdueReminders, paymentReminders: $paymentReminders)';
}


}

/// @nodoc
abstract mixin class _$PreferencesStateCopyWith<$Res> implements $PreferencesStateCopyWith<$Res> {
  factory _$PreferencesStateCopyWith(_PreferencesState value, $Res Function(_PreferencesState) _then) = __$PreferencesStateCopyWithImpl;
@override @useResult
$Res call({
 String selectedCurrency, String selectedTheme, int maxProjectsPerWeek, bool notificationsEnabled, bool overdueReminders, bool paymentReminders
});




}
/// @nodoc
class __$PreferencesStateCopyWithImpl<$Res>
    implements _$PreferencesStateCopyWith<$Res> {
  __$PreferencesStateCopyWithImpl(this._self, this._then);

  final _PreferencesState _self;
  final $Res Function(_PreferencesState) _then;

/// Create a copy of PreferencesState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? selectedCurrency = null,Object? selectedTheme = null,Object? maxProjectsPerWeek = null,Object? notificationsEnabled = null,Object? overdueReminders = null,Object? paymentReminders = null,}) {
  return _then(_PreferencesState(
selectedCurrency: null == selectedCurrency ? _self.selectedCurrency : selectedCurrency // ignore: cast_nullable_to_non_nullable
as String,selectedTheme: null == selectedTheme ? _self.selectedTheme : selectedTheme // ignore: cast_nullable_to_non_nullable
as String,maxProjectsPerWeek: null == maxProjectsPerWeek ? _self.maxProjectsPerWeek : maxProjectsPerWeek // ignore: cast_nullable_to_non_nullable
as int,notificationsEnabled: null == notificationsEnabled ? _self.notificationsEnabled : notificationsEnabled // ignore: cast_nullable_to_non_nullable
as bool,overdueReminders: null == overdueReminders ? _self.overdueReminders : overdueReminders // ignore: cast_nullable_to_non_nullable
as bool,paymentReminders: null == paymentReminders ? _self.paymentReminders : paymentReminders // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
