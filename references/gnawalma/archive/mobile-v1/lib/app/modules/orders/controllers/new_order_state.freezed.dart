// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'new_order_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$NewOrderState {

 int get currentStep; List<String> get steps;// Step 1: Client Selection
 ClientModel? get selectedClient; String get searchQuery; List<ClientModel> get recentClients; List<ClientModel> get searchResults; bool get isSearching;// Step 2: Item Building
 List<ProjectModel> get cartItems; Map<String, String?> get itemErrors; BeneficiaryModel? get selectedBeneficiary; String get selectedForWhom; String get garmentType; Map<String, double> get itemMeasurements; String get measurementNotes; double get itemPrice; List<String> get itemPhotos; String? get fabricPhoto; String get fabricNote; String? get audioNotePath; List<BeneficiaryModel> get clientBeneficiaries;// Step 3: Payment
 double get depositAmount; DateTime? get deliveryDate;// UI State
 bool get isCreatingOrder; bool get orderCreationAttempted; bool get showHistory;
/// Create a copy of NewOrderState
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NewOrderStateCopyWith<NewOrderState> get copyWith => _$NewOrderStateCopyWithImpl<NewOrderState>(this as NewOrderState, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NewOrderState&&(identical(other.currentStep, currentStep) || other.currentStep == currentStep)&&const DeepCollectionEquality().equals(other.steps, steps)&&(identical(other.selectedClient, selectedClient) || other.selectedClient == selectedClient)&&(identical(other.searchQuery, searchQuery) || other.searchQuery == searchQuery)&&const DeepCollectionEquality().equals(other.recentClients, recentClients)&&const DeepCollectionEquality().equals(other.searchResults, searchResults)&&(identical(other.isSearching, isSearching) || other.isSearching == isSearching)&&const DeepCollectionEquality().equals(other.cartItems, cartItems)&&const DeepCollectionEquality().equals(other.itemErrors, itemErrors)&&(identical(other.selectedBeneficiary, selectedBeneficiary) || other.selectedBeneficiary == selectedBeneficiary)&&(identical(other.selectedForWhom, selectedForWhom) || other.selectedForWhom == selectedForWhom)&&(identical(other.garmentType, garmentType) || other.garmentType == garmentType)&&const DeepCollectionEquality().equals(other.itemMeasurements, itemMeasurements)&&(identical(other.measurementNotes, measurementNotes) || other.measurementNotes == measurementNotes)&&(identical(other.itemPrice, itemPrice) || other.itemPrice == itemPrice)&&const DeepCollectionEquality().equals(other.itemPhotos, itemPhotos)&&(identical(other.fabricPhoto, fabricPhoto) || other.fabricPhoto == fabricPhoto)&&(identical(other.fabricNote, fabricNote) || other.fabricNote == fabricNote)&&(identical(other.audioNotePath, audioNotePath) || other.audioNotePath == audioNotePath)&&const DeepCollectionEquality().equals(other.clientBeneficiaries, clientBeneficiaries)&&(identical(other.depositAmount, depositAmount) || other.depositAmount == depositAmount)&&(identical(other.deliveryDate, deliveryDate) || other.deliveryDate == deliveryDate)&&(identical(other.isCreatingOrder, isCreatingOrder) || other.isCreatingOrder == isCreatingOrder)&&(identical(other.orderCreationAttempted, orderCreationAttempted) || other.orderCreationAttempted == orderCreationAttempted)&&(identical(other.showHistory, showHistory) || other.showHistory == showHistory));
}


@override
int get hashCode => Object.hashAll([runtimeType,currentStep,const DeepCollectionEquality().hash(steps),selectedClient,searchQuery,const DeepCollectionEquality().hash(recentClients),const DeepCollectionEquality().hash(searchResults),isSearching,const DeepCollectionEquality().hash(cartItems),const DeepCollectionEquality().hash(itemErrors),selectedBeneficiary,selectedForWhom,garmentType,const DeepCollectionEquality().hash(itemMeasurements),measurementNotes,itemPrice,const DeepCollectionEquality().hash(itemPhotos),fabricPhoto,fabricNote,audioNotePath,const DeepCollectionEquality().hash(clientBeneficiaries),depositAmount,deliveryDate,isCreatingOrder,orderCreationAttempted,showHistory]);

@override
String toString() {
  return 'NewOrderState(currentStep: $currentStep, steps: $steps, selectedClient: $selectedClient, searchQuery: $searchQuery, recentClients: $recentClients, searchResults: $searchResults, isSearching: $isSearching, cartItems: $cartItems, itemErrors: $itemErrors, selectedBeneficiary: $selectedBeneficiary, selectedForWhom: $selectedForWhom, garmentType: $garmentType, itemMeasurements: $itemMeasurements, measurementNotes: $measurementNotes, itemPrice: $itemPrice, itemPhotos: $itemPhotos, fabricPhoto: $fabricPhoto, fabricNote: $fabricNote, audioNotePath: $audioNotePath, clientBeneficiaries: $clientBeneficiaries, depositAmount: $depositAmount, deliveryDate: $deliveryDate, isCreatingOrder: $isCreatingOrder, orderCreationAttempted: $orderCreationAttempted, showHistory: $showHistory)';
}


}

/// @nodoc
abstract mixin class $NewOrderStateCopyWith<$Res>  {
  factory $NewOrderStateCopyWith(NewOrderState value, $Res Function(NewOrderState) _then) = _$NewOrderStateCopyWithImpl;
@useResult
$Res call({
 int currentStep, List<String> steps, ClientModel? selectedClient, String searchQuery, List<ClientModel> recentClients, List<ClientModel> searchResults, bool isSearching, List<ProjectModel> cartItems, Map<String, String?> itemErrors, BeneficiaryModel? selectedBeneficiary, String selectedForWhom, String garmentType, Map<String, double> itemMeasurements, String measurementNotes, double itemPrice, List<String> itemPhotos, String? fabricPhoto, String fabricNote, String? audioNotePath, List<BeneficiaryModel> clientBeneficiaries, double depositAmount, DateTime? deliveryDate, bool isCreatingOrder, bool orderCreationAttempted, bool showHistory
});




}
/// @nodoc
class _$NewOrderStateCopyWithImpl<$Res>
    implements $NewOrderStateCopyWith<$Res> {
  _$NewOrderStateCopyWithImpl(this._self, this._then);

  final NewOrderState _self;
  final $Res Function(NewOrderState) _then;

/// Create a copy of NewOrderState
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? currentStep = null,Object? steps = null,Object? selectedClient = freezed,Object? searchQuery = null,Object? recentClients = null,Object? searchResults = null,Object? isSearching = null,Object? cartItems = null,Object? itemErrors = null,Object? selectedBeneficiary = freezed,Object? selectedForWhom = null,Object? garmentType = null,Object? itemMeasurements = null,Object? measurementNotes = null,Object? itemPrice = null,Object? itemPhotos = null,Object? fabricPhoto = freezed,Object? fabricNote = null,Object? audioNotePath = freezed,Object? clientBeneficiaries = null,Object? depositAmount = null,Object? deliveryDate = freezed,Object? isCreatingOrder = null,Object? orderCreationAttempted = null,Object? showHistory = null,}) {
  return _then(_self.copyWith(
currentStep: null == currentStep ? _self.currentStep : currentStep // ignore: cast_nullable_to_non_nullable
as int,steps: null == steps ? _self.steps : steps // ignore: cast_nullable_to_non_nullable
as List<String>,selectedClient: freezed == selectedClient ? _self.selectedClient : selectedClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,searchQuery: null == searchQuery ? _self.searchQuery : searchQuery // ignore: cast_nullable_to_non_nullable
as String,recentClients: null == recentClients ? _self.recentClients : recentClients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,searchResults: null == searchResults ? _self.searchResults : searchResults // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,isSearching: null == isSearching ? _self.isSearching : isSearching // ignore: cast_nullable_to_non_nullable
as bool,cartItems: null == cartItems ? _self.cartItems : cartItems // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,itemErrors: null == itemErrors ? _self.itemErrors : itemErrors // ignore: cast_nullable_to_non_nullable
as Map<String, String?>,selectedBeneficiary: freezed == selectedBeneficiary ? _self.selectedBeneficiary : selectedBeneficiary // ignore: cast_nullable_to_non_nullable
as BeneficiaryModel?,selectedForWhom: null == selectedForWhom ? _self.selectedForWhom : selectedForWhom // ignore: cast_nullable_to_non_nullable
as String,garmentType: null == garmentType ? _self.garmentType : garmentType // ignore: cast_nullable_to_non_nullable
as String,itemMeasurements: null == itemMeasurements ? _self.itemMeasurements : itemMeasurements // ignore: cast_nullable_to_non_nullable
as Map<String, double>,measurementNotes: null == measurementNotes ? _self.measurementNotes : measurementNotes // ignore: cast_nullable_to_non_nullable
as String,itemPrice: null == itemPrice ? _self.itemPrice : itemPrice // ignore: cast_nullable_to_non_nullable
as double,itemPhotos: null == itemPhotos ? _self.itemPhotos : itemPhotos // ignore: cast_nullable_to_non_nullable
as List<String>,fabricPhoto: freezed == fabricPhoto ? _self.fabricPhoto : fabricPhoto // ignore: cast_nullable_to_non_nullable
as String?,fabricNote: null == fabricNote ? _self.fabricNote : fabricNote // ignore: cast_nullable_to_non_nullable
as String,audioNotePath: freezed == audioNotePath ? _self.audioNotePath : audioNotePath // ignore: cast_nullable_to_non_nullable
as String?,clientBeneficiaries: null == clientBeneficiaries ? _self.clientBeneficiaries : clientBeneficiaries // ignore: cast_nullable_to_non_nullable
as List<BeneficiaryModel>,depositAmount: null == depositAmount ? _self.depositAmount : depositAmount // ignore: cast_nullable_to_non_nullable
as double,deliveryDate: freezed == deliveryDate ? _self.deliveryDate : deliveryDate // ignore: cast_nullable_to_non_nullable
as DateTime?,isCreatingOrder: null == isCreatingOrder ? _self.isCreatingOrder : isCreatingOrder // ignore: cast_nullable_to_non_nullable
as bool,orderCreationAttempted: null == orderCreationAttempted ? _self.orderCreationAttempted : orderCreationAttempted // ignore: cast_nullable_to_non_nullable
as bool,showHistory: null == showHistory ? _self.showHistory : showHistory // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [NewOrderState].
extension NewOrderStatePatterns on NewOrderState {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NewOrderState value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NewOrderState() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NewOrderState value)  $default,){
final _that = this;
switch (_that) {
case _NewOrderState():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NewOrderState value)?  $default,){
final _that = this;
switch (_that) {
case _NewOrderState() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int currentStep,  List<String> steps,  ClientModel? selectedClient,  String searchQuery,  List<ClientModel> recentClients,  List<ClientModel> searchResults,  bool isSearching,  List<ProjectModel> cartItems,  Map<String, String?> itemErrors,  BeneficiaryModel? selectedBeneficiary,  String selectedForWhom,  String garmentType,  Map<String, double> itemMeasurements,  String measurementNotes,  double itemPrice,  List<String> itemPhotos,  String? fabricPhoto,  String fabricNote,  String? audioNotePath,  List<BeneficiaryModel> clientBeneficiaries,  double depositAmount,  DateTime? deliveryDate,  bool isCreatingOrder,  bool orderCreationAttempted,  bool showHistory)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NewOrderState() when $default != null:
return $default(_that.currentStep,_that.steps,_that.selectedClient,_that.searchQuery,_that.recentClients,_that.searchResults,_that.isSearching,_that.cartItems,_that.itemErrors,_that.selectedBeneficiary,_that.selectedForWhom,_that.garmentType,_that.itemMeasurements,_that.measurementNotes,_that.itemPrice,_that.itemPhotos,_that.fabricPhoto,_that.fabricNote,_that.audioNotePath,_that.clientBeneficiaries,_that.depositAmount,_that.deliveryDate,_that.isCreatingOrder,_that.orderCreationAttempted,_that.showHistory);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int currentStep,  List<String> steps,  ClientModel? selectedClient,  String searchQuery,  List<ClientModel> recentClients,  List<ClientModel> searchResults,  bool isSearching,  List<ProjectModel> cartItems,  Map<String, String?> itemErrors,  BeneficiaryModel? selectedBeneficiary,  String selectedForWhom,  String garmentType,  Map<String, double> itemMeasurements,  String measurementNotes,  double itemPrice,  List<String> itemPhotos,  String? fabricPhoto,  String fabricNote,  String? audioNotePath,  List<BeneficiaryModel> clientBeneficiaries,  double depositAmount,  DateTime? deliveryDate,  bool isCreatingOrder,  bool orderCreationAttempted,  bool showHistory)  $default,) {final _that = this;
switch (_that) {
case _NewOrderState():
return $default(_that.currentStep,_that.steps,_that.selectedClient,_that.searchQuery,_that.recentClients,_that.searchResults,_that.isSearching,_that.cartItems,_that.itemErrors,_that.selectedBeneficiary,_that.selectedForWhom,_that.garmentType,_that.itemMeasurements,_that.measurementNotes,_that.itemPrice,_that.itemPhotos,_that.fabricPhoto,_that.fabricNote,_that.audioNotePath,_that.clientBeneficiaries,_that.depositAmount,_that.deliveryDate,_that.isCreatingOrder,_that.orderCreationAttempted,_that.showHistory);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int currentStep,  List<String> steps,  ClientModel? selectedClient,  String searchQuery,  List<ClientModel> recentClients,  List<ClientModel> searchResults,  bool isSearching,  List<ProjectModel> cartItems,  Map<String, String?> itemErrors,  BeneficiaryModel? selectedBeneficiary,  String selectedForWhom,  String garmentType,  Map<String, double> itemMeasurements,  String measurementNotes,  double itemPrice,  List<String> itemPhotos,  String? fabricPhoto,  String fabricNote,  String? audioNotePath,  List<BeneficiaryModel> clientBeneficiaries,  double depositAmount,  DateTime? deliveryDate,  bool isCreatingOrder,  bool orderCreationAttempted,  bool showHistory)?  $default,) {final _that = this;
switch (_that) {
case _NewOrderState() when $default != null:
return $default(_that.currentStep,_that.steps,_that.selectedClient,_that.searchQuery,_that.recentClients,_that.searchResults,_that.isSearching,_that.cartItems,_that.itemErrors,_that.selectedBeneficiary,_that.selectedForWhom,_that.garmentType,_that.itemMeasurements,_that.measurementNotes,_that.itemPrice,_that.itemPhotos,_that.fabricPhoto,_that.fabricNote,_that.audioNotePath,_that.clientBeneficiaries,_that.depositAmount,_that.deliveryDate,_that.isCreatingOrder,_that.orderCreationAttempted,_that.showHistory);case _:
  return null;

}
}

}

/// @nodoc


class _NewOrderState implements NewOrderState {
  const _NewOrderState({this.currentStep = 0, final  List<String> steps = const ['Client', 'Articles', 'Paiement'], this.selectedClient, this.searchQuery = '', final  List<ClientModel> recentClients = const [], final  List<ClientModel> searchResults = const [], this.isSearching = false, final  List<ProjectModel> cartItems = const [], final  Map<String, String?> itemErrors = const {}, this.selectedBeneficiary, this.selectedForWhom = 'Cliente', this.garmentType = '', final  Map<String, double> itemMeasurements = const {}, this.measurementNotes = '', this.itemPrice = 0.0, final  List<String> itemPhotos = const [], this.fabricPhoto, this.fabricNote = '', this.audioNotePath, final  List<BeneficiaryModel> clientBeneficiaries = const [], this.depositAmount = 0.0, this.deliveryDate, this.isCreatingOrder = false, this.orderCreationAttempted = false, this.showHistory = false}): _steps = steps,_recentClients = recentClients,_searchResults = searchResults,_cartItems = cartItems,_itemErrors = itemErrors,_itemMeasurements = itemMeasurements,_itemPhotos = itemPhotos,_clientBeneficiaries = clientBeneficiaries;
  

@override@JsonKey() final  int currentStep;
 final  List<String> _steps;
@override@JsonKey() List<String> get steps {
  if (_steps is EqualUnmodifiableListView) return _steps;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_steps);
}

// Step 1: Client Selection
@override final  ClientModel? selectedClient;
@override@JsonKey() final  String searchQuery;
 final  List<ClientModel> _recentClients;
@override@JsonKey() List<ClientModel> get recentClients {
  if (_recentClients is EqualUnmodifiableListView) return _recentClients;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_recentClients);
}

 final  List<ClientModel> _searchResults;
@override@JsonKey() List<ClientModel> get searchResults {
  if (_searchResults is EqualUnmodifiableListView) return _searchResults;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_searchResults);
}

@override@JsonKey() final  bool isSearching;
// Step 2: Item Building
 final  List<ProjectModel> _cartItems;
// Step 2: Item Building
@override@JsonKey() List<ProjectModel> get cartItems {
  if (_cartItems is EqualUnmodifiableListView) return _cartItems;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_cartItems);
}

 final  Map<String, String?> _itemErrors;
@override@JsonKey() Map<String, String?> get itemErrors {
  if (_itemErrors is EqualUnmodifiableMapView) return _itemErrors;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_itemErrors);
}

@override final  BeneficiaryModel? selectedBeneficiary;
@override@JsonKey() final  String selectedForWhom;
@override@JsonKey() final  String garmentType;
 final  Map<String, double> _itemMeasurements;
@override@JsonKey() Map<String, double> get itemMeasurements {
  if (_itemMeasurements is EqualUnmodifiableMapView) return _itemMeasurements;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_itemMeasurements);
}

@override@JsonKey() final  String measurementNotes;
@override@JsonKey() final  double itemPrice;
 final  List<String> _itemPhotos;
@override@JsonKey() List<String> get itemPhotos {
  if (_itemPhotos is EqualUnmodifiableListView) return _itemPhotos;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_itemPhotos);
}

@override final  String? fabricPhoto;
@override@JsonKey() final  String fabricNote;
@override final  String? audioNotePath;
 final  List<BeneficiaryModel> _clientBeneficiaries;
@override@JsonKey() List<BeneficiaryModel> get clientBeneficiaries {
  if (_clientBeneficiaries is EqualUnmodifiableListView) return _clientBeneficiaries;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_clientBeneficiaries);
}

// Step 3: Payment
@override@JsonKey() final  double depositAmount;
@override final  DateTime? deliveryDate;
// UI State
@override@JsonKey() final  bool isCreatingOrder;
@override@JsonKey() final  bool orderCreationAttempted;
@override@JsonKey() final  bool showHistory;

/// Create a copy of NewOrderState
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NewOrderStateCopyWith<_NewOrderState> get copyWith => __$NewOrderStateCopyWithImpl<_NewOrderState>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NewOrderState&&(identical(other.currentStep, currentStep) || other.currentStep == currentStep)&&const DeepCollectionEquality().equals(other._steps, _steps)&&(identical(other.selectedClient, selectedClient) || other.selectedClient == selectedClient)&&(identical(other.searchQuery, searchQuery) || other.searchQuery == searchQuery)&&const DeepCollectionEquality().equals(other._recentClients, _recentClients)&&const DeepCollectionEquality().equals(other._searchResults, _searchResults)&&(identical(other.isSearching, isSearching) || other.isSearching == isSearching)&&const DeepCollectionEquality().equals(other._cartItems, _cartItems)&&const DeepCollectionEquality().equals(other._itemErrors, _itemErrors)&&(identical(other.selectedBeneficiary, selectedBeneficiary) || other.selectedBeneficiary == selectedBeneficiary)&&(identical(other.selectedForWhom, selectedForWhom) || other.selectedForWhom == selectedForWhom)&&(identical(other.garmentType, garmentType) || other.garmentType == garmentType)&&const DeepCollectionEquality().equals(other._itemMeasurements, _itemMeasurements)&&(identical(other.measurementNotes, measurementNotes) || other.measurementNotes == measurementNotes)&&(identical(other.itemPrice, itemPrice) || other.itemPrice == itemPrice)&&const DeepCollectionEquality().equals(other._itemPhotos, _itemPhotos)&&(identical(other.fabricPhoto, fabricPhoto) || other.fabricPhoto == fabricPhoto)&&(identical(other.fabricNote, fabricNote) || other.fabricNote == fabricNote)&&(identical(other.audioNotePath, audioNotePath) || other.audioNotePath == audioNotePath)&&const DeepCollectionEquality().equals(other._clientBeneficiaries, _clientBeneficiaries)&&(identical(other.depositAmount, depositAmount) || other.depositAmount == depositAmount)&&(identical(other.deliveryDate, deliveryDate) || other.deliveryDate == deliveryDate)&&(identical(other.isCreatingOrder, isCreatingOrder) || other.isCreatingOrder == isCreatingOrder)&&(identical(other.orderCreationAttempted, orderCreationAttempted) || other.orderCreationAttempted == orderCreationAttempted)&&(identical(other.showHistory, showHistory) || other.showHistory == showHistory));
}


@override
int get hashCode => Object.hashAll([runtimeType,currentStep,const DeepCollectionEquality().hash(_steps),selectedClient,searchQuery,const DeepCollectionEquality().hash(_recentClients),const DeepCollectionEquality().hash(_searchResults),isSearching,const DeepCollectionEquality().hash(_cartItems),const DeepCollectionEquality().hash(_itemErrors),selectedBeneficiary,selectedForWhom,garmentType,const DeepCollectionEquality().hash(_itemMeasurements),measurementNotes,itemPrice,const DeepCollectionEquality().hash(_itemPhotos),fabricPhoto,fabricNote,audioNotePath,const DeepCollectionEquality().hash(_clientBeneficiaries),depositAmount,deliveryDate,isCreatingOrder,orderCreationAttempted,showHistory]);

@override
String toString() {
  return 'NewOrderState(currentStep: $currentStep, steps: $steps, selectedClient: $selectedClient, searchQuery: $searchQuery, recentClients: $recentClients, searchResults: $searchResults, isSearching: $isSearching, cartItems: $cartItems, itemErrors: $itemErrors, selectedBeneficiary: $selectedBeneficiary, selectedForWhom: $selectedForWhom, garmentType: $garmentType, itemMeasurements: $itemMeasurements, measurementNotes: $measurementNotes, itemPrice: $itemPrice, itemPhotos: $itemPhotos, fabricPhoto: $fabricPhoto, fabricNote: $fabricNote, audioNotePath: $audioNotePath, clientBeneficiaries: $clientBeneficiaries, depositAmount: $depositAmount, deliveryDate: $deliveryDate, isCreatingOrder: $isCreatingOrder, orderCreationAttempted: $orderCreationAttempted, showHistory: $showHistory)';
}


}

/// @nodoc
abstract mixin class _$NewOrderStateCopyWith<$Res> implements $NewOrderStateCopyWith<$Res> {
  factory _$NewOrderStateCopyWith(_NewOrderState value, $Res Function(_NewOrderState) _then) = __$NewOrderStateCopyWithImpl;
@override @useResult
$Res call({
 int currentStep, List<String> steps, ClientModel? selectedClient, String searchQuery, List<ClientModel> recentClients, List<ClientModel> searchResults, bool isSearching, List<ProjectModel> cartItems, Map<String, String?> itemErrors, BeneficiaryModel? selectedBeneficiary, String selectedForWhom, String garmentType, Map<String, double> itemMeasurements, String measurementNotes, double itemPrice, List<String> itemPhotos, String? fabricPhoto, String fabricNote, String? audioNotePath, List<BeneficiaryModel> clientBeneficiaries, double depositAmount, DateTime? deliveryDate, bool isCreatingOrder, bool orderCreationAttempted, bool showHistory
});




}
/// @nodoc
class __$NewOrderStateCopyWithImpl<$Res>
    implements _$NewOrderStateCopyWith<$Res> {
  __$NewOrderStateCopyWithImpl(this._self, this._then);

  final _NewOrderState _self;
  final $Res Function(_NewOrderState) _then;

/// Create a copy of NewOrderState
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? currentStep = null,Object? steps = null,Object? selectedClient = freezed,Object? searchQuery = null,Object? recentClients = null,Object? searchResults = null,Object? isSearching = null,Object? cartItems = null,Object? itemErrors = null,Object? selectedBeneficiary = freezed,Object? selectedForWhom = null,Object? garmentType = null,Object? itemMeasurements = null,Object? measurementNotes = null,Object? itemPrice = null,Object? itemPhotos = null,Object? fabricPhoto = freezed,Object? fabricNote = null,Object? audioNotePath = freezed,Object? clientBeneficiaries = null,Object? depositAmount = null,Object? deliveryDate = freezed,Object? isCreatingOrder = null,Object? orderCreationAttempted = null,Object? showHistory = null,}) {
  return _then(_NewOrderState(
currentStep: null == currentStep ? _self.currentStep : currentStep // ignore: cast_nullable_to_non_nullable
as int,steps: null == steps ? _self._steps : steps // ignore: cast_nullable_to_non_nullable
as List<String>,selectedClient: freezed == selectedClient ? _self.selectedClient : selectedClient // ignore: cast_nullable_to_non_nullable
as ClientModel?,searchQuery: null == searchQuery ? _self.searchQuery : searchQuery // ignore: cast_nullable_to_non_nullable
as String,recentClients: null == recentClients ? _self._recentClients : recentClients // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,searchResults: null == searchResults ? _self._searchResults : searchResults // ignore: cast_nullable_to_non_nullable
as List<ClientModel>,isSearching: null == isSearching ? _self.isSearching : isSearching // ignore: cast_nullable_to_non_nullable
as bool,cartItems: null == cartItems ? _self._cartItems : cartItems // ignore: cast_nullable_to_non_nullable
as List<ProjectModel>,itemErrors: null == itemErrors ? _self._itemErrors : itemErrors // ignore: cast_nullable_to_non_nullable
as Map<String, String?>,selectedBeneficiary: freezed == selectedBeneficiary ? _self.selectedBeneficiary : selectedBeneficiary // ignore: cast_nullable_to_non_nullable
as BeneficiaryModel?,selectedForWhom: null == selectedForWhom ? _self.selectedForWhom : selectedForWhom // ignore: cast_nullable_to_non_nullable
as String,garmentType: null == garmentType ? _self.garmentType : garmentType // ignore: cast_nullable_to_non_nullable
as String,itemMeasurements: null == itemMeasurements ? _self._itemMeasurements : itemMeasurements // ignore: cast_nullable_to_non_nullable
as Map<String, double>,measurementNotes: null == measurementNotes ? _self.measurementNotes : measurementNotes // ignore: cast_nullable_to_non_nullable
as String,itemPrice: null == itemPrice ? _self.itemPrice : itemPrice // ignore: cast_nullable_to_non_nullable
as double,itemPhotos: null == itemPhotos ? _self._itemPhotos : itemPhotos // ignore: cast_nullable_to_non_nullable
as List<String>,fabricPhoto: freezed == fabricPhoto ? _self.fabricPhoto : fabricPhoto // ignore: cast_nullable_to_non_nullable
as String?,fabricNote: null == fabricNote ? _self.fabricNote : fabricNote // ignore: cast_nullable_to_non_nullable
as String,audioNotePath: freezed == audioNotePath ? _self.audioNotePath : audioNotePath // ignore: cast_nullable_to_non_nullable
as String?,clientBeneficiaries: null == clientBeneficiaries ? _self._clientBeneficiaries : clientBeneficiaries // ignore: cast_nullable_to_non_nullable
as List<BeneficiaryModel>,depositAmount: null == depositAmount ? _self.depositAmount : depositAmount // ignore: cast_nullable_to_non_nullable
as double,deliveryDate: freezed == deliveryDate ? _self.deliveryDate : deliveryDate // ignore: cast_nullable_to_non_nullable
as DateTime?,isCreatingOrder: null == isCreatingOrder ? _self.isCreatingOrder : isCreatingOrder // ignore: cast_nullable_to_non_nullable
as bool,orderCreationAttempted: null == orderCreationAttempted ? _self.orderCreationAttempted : orderCreationAttempted // ignore: cast_nullable_to_non_nullable
as bool,showHistory: null == showHistory ? _self.showHistory : showHistory // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
