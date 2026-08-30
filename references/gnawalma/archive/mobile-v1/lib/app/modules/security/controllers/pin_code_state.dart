import 'package:freezed_annotation/freezed_annotation.dart';

part 'pin_code_state.freezed.dart';

@freezed
abstract class PinCodeState with _$PinCodeState {
  const factory PinCodeState({
    @Default('') String pin,
    @Default('Entrez votre code PIN') String title,
    @Default(false) bool isConfirming,
    @Default('') String firstPin,
    @Default(false) bool isOldVerified,
    @Default('auth') String mode,
    @Default(0) int failedAttempts,
    DateTime? lockedUntil,
  }) = _PinCodeState;
}
