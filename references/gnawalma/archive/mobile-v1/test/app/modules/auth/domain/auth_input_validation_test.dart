import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/app/modules/auth/domain/auth_input_validation.dart';

void main() {
  group('AuthInputValidation', () {
    test('accepts Senegalese local and international phone numbers', () {
      expect(AuthInputValidation.isIdentifierValid('77 000 00 00'), isTrue);
      expect(AuthInputValidation.isIdentifierValid('+221770000000'), isTrue);
      expect(AuthInputValidation.isIdentifierValid('221 77 000 00 00'), isTrue);
    });

    test('accepts a plausible email and rejects malformed identifiers', () {
      expect(AuthInputValidation.isIdentifierValid('awa@example.sn'), isTrue);
      expect(AuthInputValidation.isIdentifierValid('awa@'), isFalse);
      expect(AuthInputValidation.isIdentifierValid('123'), isFalse);
    });

    test('enforces the four to eight digit PIN contract', () {
      expect(AuthInputValidation.isPinValid('1234'), isTrue);
      expect(AuthInputValidation.isPinValid('12345678'), isTrue);
      expect(AuthInputValidation.isPinValid('123'), isFalse);
      expect(AuthInputValidation.isPinValid('1234a'), isFalse);
    });

    test('requires a useful display name', () {
      expect(AuthInputValidation.isDisplayNameValid('Awa'), isTrue);
      expect(AuthInputValidation.isDisplayNameValid(' A '), isFalse);
    });
  });
}
