// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'add_edit_project_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$AddEditProjectState {

 int get currentStep; List<String> get steps; ProjectStatus get selectedStatus; Gender get selectedGender; List<String> get photoUrls; DateTime? get startDate; DateTime? get expectedDeliveryDate; ClientModel? get selectedClient; PatternModel? get selectedPattern; List<ClientModel> get clients; List<PatternModel> get patterns; Map<String, double> get currentMeasurements; bool get isSaving; bool get isLoadingClients; bool get isLoadingPatterns; bool get isEditMode; String? get audioNotePath; String? get clientFabricPhotoUrl; ProjectModel? get existingProject;
/// Create a copy of AddEditProjectState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AddEditProjectStateCopyWith<AddEditProjectState> get copyWith => _$AddEditProjectStateCopyWithImpl<AddEditProjectState>(this as AddEditProjectState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AddEditProjectState&&(identical(other.currentStep, currentStep) || other.currentStep == currentStep)&&const DeepCollectionEquality().equals(other.steps, steps)&&(identical(other.selectedStatus, selectedStatus) || other.selectedStatus == selectedStatus)&&(identical(other.selectedGender, selectedGender) || other.selectedGender == selectedGender)&&const DeepCollectionEquality().equals(other.photoUrls, photoUrls)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.expectedDeliveryDate, expectedDeliveryDate) || other.expectedDeliveryDate == expectedDeliveryDate)&&(identical(other.selectedClient, selectedClient) || other.selectedClient == selectedClient)&&(identical(other.selectedPattern, selectedPattern) || other.selectedPattern == selectedPattern)&&const DeepCollectionEquality().equals(other.clients, clients)&&const DeepCollectionEquality().equals(other.patterns, patterns)&&const DeepCollectionEquality().equals(other.currentMeasurements, currentMeasurements)&&(identical(other.isSaving, isSaving) || other.isSaving == isSaving)&&(identical(other.isLoadingClients, isLoadingClients) || other.isLoadingClients == isLoadingClients)&&(identical(other.isLoadingPatterns, isLoadingPatterns) || other.isLoadingPatterns == isLoadingPatterns)&&(identical(other.isEditMode, isEditMode) || other.isEditMode == isEditMode)&&(identical(other.audioNotePath, audioNotePath) || other.audioNotePath == audioNotePath)&&(identical(other.clientFabricPhotoUrl, clientFabricPhotoUrl) || other.clientFabricPhotoUrl == clientFabricPhotoUrl)&&(identical(other.existingProject, existingProject) || other.existingProject == existingProject));
}


@override
int get hashCode => Object.hashAll([runtimeType,currentStep,const DeepCollectionEquality().hash(steps),selectedStatus,selectedGender,const DeepCollectionEquality().hash(photoUrls),startDate,expectedDeliveryDate,selectedClient,selectedPattern,const DeepCollectionEquality().hash(clients),const DeepCollectionEquality().hash(patterns),const DeepCollectionEquality().hash(currentMeasurements),isSaving,isLoadingClients,isLoadingPatterns,isEditMode,audioNotePath,clientFabricPhotoUrl,existingProject]);

@override
String toString() {
  return 'AddEditProjectState(currentStep: $currentStep, steps: $steps, selectedStatus: $selectedStatus, selectedGender: $selectedGender, photoUrls: $photoUrls, startDate: $startDate, expectedDeliveryDate: $expectedDeliveryDate, selectedClient: $selectedClient, selectedPattern: $selectedPattern, clients: $clients, patterns: $patterns, currentMeasurements: $currentMeasurements, isSaving: $isSaving, isLoadingClients: $isLoadingClients, isLoadingPatterns: $isLoadingPatterns, isEditMode: $isEditMode, audioNotePath: $audioNotePath, clientFabricPhotoUrl: $clientFabricPhotoUrl, existingProject: $existingProject)';
}


}

/// @nodoc
abstract mixin class $AddEditProjectStateCopyWith<$Res>  {
  factory $AddEditProjectStateCopyWith(AddEditProjectState value, $Res Function(AddEditProjectState) _then) = _$AddEditProjectStateCopyWithImpl;
@useResult
$Res call({
 int currentStep, List<String> steps, ProjectStatus selectedStatus, Gender selectedGender, List<String> photoUrls, DateTime? startDate, DateTime? expectedDeliveryDate, ClientModel? selectedClient, PatternModel? selectedPattern, List<ClientModel> clients, List<PatternModel> patterns, Map<String, double> currentMeasurements, bool isSaving, bool isLoadingClients, bool isLoadingPatterns, bool isEditMode, String? audioNotePath, String? clientFabricPhotoUrl, ProjectModel? existingProject
});




}
/// @nodoc
class _$AddEditProjectStateCopyWithImpl<$Res>
    implements $AddEditProjectStateCopyWith<$Res> {
  _$AddEditProjectStateCopyWithImpl(this._self, this._then);

  final AddEditProjectState _self;
  final $Res Function(AddEditProjectState) _then;

/// Create a copy of AddEditProjectState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? currentStep = null,Object? steps = null,Object? selectedStatus = null,Object? selectedGender = null,Object? photoUrls = null,Object? startDate = freezed,Object? expectedDeliveryDate = freezed,Object? selectedClient = freezed,Object? selectedPattern = freezed,Object? clients = null,Object? patterns = null,Object? currentMeasurements = null,Object? isSaving = null,Object? isLoadingClients = null,Object? isLoadingPatterns = null,Object? isEditMode = null,Object? audioNotePath = freezed,Object? clientFabricPhotoUrl = freezed,Object? existingProject = freezed,}) {
  return _then(_self.copyWith(
currentStep: null == currentStep ? _self.currentStep : currentStep // ignore: cast_nullable_to_non_nullable
as int,steps: null == steps ? _self.steps : steps // ignore: cast_nullable_to_non_nullable
as List<String>,selectedStatus: null == selectedStatus ? _self.selectedStatus : selectedStatus // ignore: cast_nullable_to_non_nullable
as ProjectStatus,selectedGender: null == selectedGender ? _self.selectedGender : selectedGender // ignore: cast_nullable_to_non_nullable
as Gender,photoUrls: null == photoUrls ? _self.photoUrls : photoUrls // ignore: cast_nullable_to_non_nullable
as List<String>,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as DateTime?,expectedDeliveryDate: freezed == expectedDeliveryDate ? _self.expectedDeliveryDate : expectedDeliveryDate // ignore: cast_nullable_to_non_nullable
as DateTime?,selectedClient: freezed == selectedClient ? _self.selectedClient : selectedClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,selectedPattern: freezed == selectedPattern ? _self.selectedPattern : selectedPattern // ignore: cast_nullable_to_non_nullable
as PatternModel?,clients: null == clients ? _self.clients : clients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,patterns: null == patterns ? _self.patterns : patterns // ignore: cast_nullable_to_non_nullable
as List<PatternModel>,currentMeasurements: null == currentMeasurements ? _self.currentMeasurements : currentMeasurements // ignore: cast_nullable_to_non_nullable
as Map<String, double>,isSaving: null == isSaving ? _self.isSaving : isSaving // ignore: cast_nullable_to_non_nullable
as bool,isLoadingClients: null == isLoadingClients ? _self.isLoadingClients : isLoadingClients // ignore: cast_nullable_to_non_nullable
as bool,isLoadingPatterns: null == isLoadingPatterns ? _self.isLoadingPatterns : isLoadingPatterns // ignore: cast_nullable_to_non_nullable
as bool,isEditMode: null == isEditMode ? _self.isEditMode : isEditMode // ignore: cast_nullable_to_non_nullable
as bool,audioNotePath: freezed == audioNotePath ? _self.audioNotePath : audioNotePath // ignore: cast_nullable_to_non_nullable
as String?,clientFabricPhotoUrl: freezed == clientFabricPhotoUrl ? _self.clientFabricPhotoUrl : clientFabricPhotoUrl // ignore: cast_nullable_to_non_nullable
as String?,existingProject: freezed == existingProject ? _self.existingProject : existingProject // ignore: cast_nullable_to_non_nullable
as ProjectModel?,
  ));
}

}


/// Adds pattern-matching-related methods to [AddEditProjectState].
extension AddEditProjectStatePatterns on AddEditProjectState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AddEditProjectState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AddEditProjectState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AddEditProjectState value)  $default,){
final _that = this;
switch (_that) {
case _AddEditProjectState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AddEditProjectState value)?  $default,){
final _that = this;
switch (_that) {
case _AddEditProjectState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int currentStep,  List<String> steps,  ProjectStatus selectedStatus,  Gender selectedGender,  List<String> photoUrls,  DateTime? startDate,  DateTime? expectedDeliveryDate,  ClientModel? selectedClient,  PatternModel? selectedPattern,  List<ClientModel> clients,  List<PatternModel> patterns,  Map<String, double> currentMeasurements,  bool isSaving,  bool isLoadingClients,  bool isLoadingPatterns,  bool isEditMode,  String? audioNotePath,  String? clientFabricPhotoUrl,  ProjectModel? existingProject)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AddEditProjectState() when $default != null:
return $default(_that.currentStep,_that.steps,_that.selectedStatus,_that.selectedGender,_that.photoUrls,_that.startDate,_that.expectedDeliveryDate,_that.selectedClient,_that.selectedPattern,_that.clients,_that.patterns,_that.currentMeasurements,_that.isSaving,_that.isLoadingClients,_that.isLoadingPatterns,_that.isEditMode,_that.audioNotePath,_that.clientFabricPhotoUrl,_that.existingProject);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int currentStep,  List<String> steps,  ProjectStatus selectedStatus,  Gender selectedGender,  List<String> photoUrls,  DateTime? startDate,  DateTime? expectedDeliveryDate,  ClientModel? selectedClient,  PatternModel? selectedPattern,  List<ClientModel> clients,  List<PatternModel> patterns,  Map<String, double> currentMeasurements,  bool isSaving,  bool isLoadingClients,  bool isLoadingPatterns,  bool isEditMode,  String? audioNotePath,  String? clientFabricPhotoUrl,  ProjectModel? existingProject)  $default,) {final _that = this;
switch (_that) {
case _AddEditProjectState():
return $default(_that.currentStep,_that.steps,_that.selectedStatus,_that.selectedGender,_that.photoUrls,_that.startDate,_that.expectedDeliveryDate,_that.selectedClient,_that.selectedPattern,_that.clients,_that.patterns,_that.currentMeasurements,_that.isSaving,_that.isLoadingClients,_that.isLoadingPatterns,_that.isEditMode,_that.audioNotePath,_that.clientFabricPhotoUrl,_that.existingProject);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int currentStep,  List<String> steps,  ProjectStatus selectedStatus,  Gender selectedGender,  List<String> photoUrls,  DateTime? startDate,  DateTime? expectedDeliveryDate,  ClientModel? selectedClient,  PatternModel? selectedPattern,  List<ClientModel> clients,  List<PatternModel> patterns,  Map<String, double> currentMeasurements,  bool isSaving,  bool isLoadingClients,  bool isLoadingPatterns,  bool isEditMode,  String? audioNotePath,  String? clientFabricPhotoUrl,  ProjectModel? existingProject)?  $default,) {final _that = this;
switch (_that) {
case _AddEditProjectState() when $default != null:
return $default(_that.currentStep,_that.steps,_that.selectedStatus,_that.selectedGender,_that.photoUrls,_that.startDate,_that.expectedDeliveryDate,_that.selectedClient,_that.selectedPattern,_that.clients,_that.patterns,_that.currentMeasurements,_that.isSaving,_that.isLoadingClients,_that.isLoadingPatterns,_that.isEditMode,_that.audioNotePath,_that.clientFabricPhotoUrl,_that.existingProject);case _:
  return null;

}
}

}

/// @nodoc


class _AddEditProjectState implements AddEditProjectState {
  const _AddEditProjectState({this.currentStep = 0, final  List<String> steps = const ['Client', 'Tissu', 'Modèle', 'Mesures', 'Contrat'], this.selectedStatus = ProjectStatus.todo, this.selectedGender = Gender.female, final  List<String> photoUrls = const [], this.startDate, this.expectedDeliveryDate, this.selectedClient, this.selectedPattern, final  List<ClientModel> clients = const [], final  List<PatternModel> patterns = const [], final  Map<String, double> currentMeasurements = const {}, this.isSaving = false, this.isLoadingClients = false, this.isLoadingPatterns = false, this.isEditMode = false, this.audioNotePath, this.clientFabricPhotoUrl, this.existingProject}): _steps = steps,_photoUrls = photoUrls,_clients = clients,_patterns = patterns,_currentMeasurements = currentMeasurements;
  

@override@JsonKey() final  int currentStep;
 final  List<String> _steps;
@override@JsonKey() List<String> get steps {
  if (_steps is EqualUnmodifiableListView) return _steps;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_steps);
}

@override@JsonKey() final  ProjectStatus selectedStatus;
@override@JsonKey() final  Gender selectedGender;
 final  List<String> _photoUrls;
@override@JsonKey() List<String> get photoUrls {
  if (_photoUrls is EqualUnmodifiableListView) return _photoUrls;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_photoUrls);
}

@override final  DateTime? startDate;
@override final  DateTime? expectedDeliveryDate;
@override final  ClientModel? selectedClient;
@override final  PatternModel? selectedPattern;
 final  List<ClientModel> _clients;
@override@JsonKey() List<ClientModel> get clients {
  if (_clients is EqualUnmodifiableListView) return _clients;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_clients);
}

 final  List<PatternModel> _patterns;
@override@JsonKey() List<PatternModel> get patterns {
  if (_patterns is EqualUnmodifiableListView) return _patterns;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_patterns);
}

 final  Map<String, double> _currentMeasurements;
@override@JsonKey() Map<String, double> get currentMeasurements {
  if (_currentMeasurements is EqualUnmodifiableMapView) return _currentMeasurements;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_currentMeasurements);
}

@override@JsonKey() final  bool isSaving;
@override@JsonKey() final  bool isLoadingClients;
@override@JsonKey() final  bool isLoadingPatterns;
@override@JsonKey() final  bool isEditMode;
@override final  String? audioNotePath;
@override final  String? clientFabricPhotoUrl;
@override final  ProjectModel? existingProject;

/// Create a copy of AddEditProjectState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AddEditProjectStateCopyWith<_AddEditProjectState> get copyWith => __$AddEditProjectStateCopyWithImpl<_AddEditProjectState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AddEditProjectState&&(identical(other.currentStep, currentStep) || other.currentStep == currentStep)&&const DeepCollectionEquality().equals(other._steps, _steps)&&(identical(other.selectedStatus, selectedStatus) || other.selectedStatus == selectedStatus)&&(identical(other.selectedGender, selectedGender) || other.selectedGender == selectedGender)&&const DeepCollectionEquality().equals(other._photoUrls, _photoUrls)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.expectedDeliveryDate, expectedDeliveryDate) || other.expectedDeliveryDate == expectedDeliveryDate)&&(identical(other.selectedClient, selectedClient) || other.selectedClient == selectedClient)&&(identical(other.selectedPattern, selectedPattern) || other.selectedPattern == selectedPattern)&&const DeepCollectionEquality().equals(other._clients, _clients)&&const DeepCollectionEquality().equals(other._patterns, _patterns)&&const DeepCollectionEquality().equals(other._currentMeasurements, _currentMeasurements)&&(identical(other.isSaving, isSaving) || other.isSaving == isSaving)&&(identical(other.isLoadingClients, isLoadingClients) || other.isLoadingClients == isLoadingClients)&&(identical(other.isLoadingPatterns, isLoadingPatterns) || other.isLoadingPatterns == isLoadingPatterns)&&(identical(other.isEditMode, isEditMode) || other.isEditMode == isEditMode)&&(identical(other.audioNotePath, audioNotePath) || other.audioNotePath == audioNotePath)&&(identical(other.clientFabricPhotoUrl, clientFabricPhotoUrl) || other.clientFabricPhotoUrl == clientFabricPhotoUrl)&&(identical(other.existingProject, existingProject) || other.existingProject == existingProject));
}


@override
int get hashCode => Object.hashAll([runtimeType,currentStep,const DeepCollectionEquality().hash(_steps),selectedStatus,selectedGender,const DeepCollectionEquality().hash(_photoUrls),startDate,expectedDeliveryDate,selectedClient,selectedPattern,const DeepCollectionEquality().hash(_clients),const DeepCollectionEquality().hash(_patterns),const DeepCollectionEquality().hash(_currentMeasurements),isSaving,isLoadingClients,isLoadingPatterns,isEditMode,audioNotePath,clientFabricPhotoUrl,existingProject]);

@override
String toString() {
  return 'AddEditProjectState(currentStep: $currentStep, steps: $steps, selectedStatus: $selectedStatus, selectedGender: $selectedGender, photoUrls: $photoUrls, startDate: $startDate, expectedDeliveryDate: $expectedDeliveryDate, selectedClient: $selectedClient, selectedPattern: $selectedPattern, clients: $clients, patterns: $patterns, currentMeasurements: $currentMeasurements, isSaving: $isSaving, isLoadingClients: $isLoadingClients, isLoadingPatterns: $isLoadingPatterns, isEditMode: $isEditMode, audioNotePath: $audioNotePath, clientFabricPhotoUrl: $clientFabricPhotoUrl, existingProject: $existingProject)';
}


}

/// @nodoc
abstract mixin class _$AddEditProjectStateCopyWith<$Res> implements $AddEditProjectStateCopyWith<$Res> {
  factory _$AddEditProjectStateCopyWith(_AddEditProjectState value, $Res Function(_AddEditProjectState) _then) = __$AddEditProjectStateCopyWithImpl;
@override @useResult
$Res call({
 int currentStep, List<String> steps, ProjectStatus selectedStatus, Gender selectedGender, List<String> photoUrls, DateTime? startDate, DateTime? expectedDeliveryDate, ClientModel? selectedClient, PatternModel? selectedPattern, List<ClientModel> clients, List<PatternModel> patterns, Map<String, double> currentMeasurements, bool isSaving, bool isLoadingClients, bool isLoadingPatterns, bool isEditMode, String? audioNotePath, String? clientFabricPhotoUrl, ProjectModel? existingProject
});




}
/// @nodoc
class __$AddEditProjectStateCopyWithImpl<$Res>
    implements _$AddEditProjectStateCopyWith<$Res> {
  __$AddEditProjectStateCopyWithImpl(this._self, this._then);

  final _AddEditProjectState _self;
  final $Res Function(_AddEditProjectState) _then;

/// Create a copy of AddEditProjectState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? currentStep = null,Object? steps = null,Object? selectedStatus = null,Object? selectedGender = null,Object? photoUrls = null,Object? startDate = freezed,Object? expectedDeliveryDate = freezed,Object? selectedClient = freezed,Object? selectedPattern = freezed,Object? clients = null,Object? patterns = null,Object? currentMeasurements = null,Object? isSaving = null,Object? isLoadingClients = null,Object? isLoadingPatterns = null,Object? isEditMode = null,Object? audioNotePath = freezed,Object? clientFabricPhotoUrl = freezed,Object? existingProject = freezed,}) {
  return _then(_AddEditProjectState(
currentStep: null == currentStep ? _self.currentStep : currentStep // ignore: cast_nullable_to_non_nullable
as int,steps: null == steps ? _self._steps : steps // ignore: cast_nullable_to_non_nullable
as List<String>,selectedStatus: null == selectedStatus ? _self.selectedStatus : selectedStatus // ignore: cast_nullable_to_non_nullable
as ProjectStatus,selectedGender: null == selectedGender ? _self.selectedGender : selectedGender // ignore: cast_nullable_to_non_nullable
as Gender,photoUrls: null == photoUrls ? _self._photoUrls : photoUrls // ignore: cast_nullable_to_non_nullable
as List<String>,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as DateTime?,expectedDeliveryDate: freezed == expectedDeliveryDate ? _self.expectedDeliveryDate : expectedDeliveryDate // ignore: cast_nullable_to_non_nullable
as DateTime?,selectedClient: freezed == selectedClient ? _self.selectedClient : selectedClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,selectedPattern: freezed == selectedPattern ? _self.selectedPattern : selectedPattern // ignore: cast_nullable_to_non_nullable
as PatternModel?,clients: null == clients ? _self._clients : clients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,patterns: null == patterns ? _self._patterns : patterns // ignore: cast_nullable_to_non_nullable
as List<PatternModel>,currentMeasurements: null == currentMeasurements ? _self._currentMeasurements : currentMeasurements // ignore: cast_nullable_to_non_nullable
as Map<String, double>,isSaving: null == isSaving ? _self.isSaving : isSaving // ignore: cast_nullable_to_non_nullable
as bool,isLoadingClients: null == isLoadingClients ? _self.isLoadingClients : isLoadingClients // ignore: cast_nullable_to_non_nullable
as bool,isLoadingPatterns: null == isLoadingPatterns ? _self.isLoadingPatterns : isLoadingPatterns // ignore: cast_nullable_to_non_nullable
as bool,isEditMode: null == isEditMode ? _self.isEditMode : isEditMode // ignore: cast_nullable_to_non_nullable
as bool,audioNotePath: freezed == audioNotePath ? _self.audioNotePath : audioNotePath // ignore: cast_nullable_to_non_nullable
as String?,clientFabricPhotoUrl: freezed == clientFabricPhotoUrl ? _self.clientFabricPhotoUrl : clientFabricPhotoUrl // ignore: cast_nullable_to_non_nullable
as String?,existingProject: freezed == existingProject ? _self.existingProject : existingProject // ignore: cast_nullable_to_non_nullable
as ProjectModel?,
  ));
}


}

// dart format on
