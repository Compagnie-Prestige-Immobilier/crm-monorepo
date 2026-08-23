import 'dart:async';

import 'push_message.dart';

abstract interface class PushTransport {
  Stream<PushMessage> get foregroundMessages;

  Stream<PushMessage> get openedMessages;

  Future<PushMessage?> initialMessage();
}

class NullPushTransport implements PushTransport {
  const NullPushTransport();

  @override
  Stream<PushMessage> get foregroundMessages =>
      const Stream<PushMessage>.empty();

  @override
  Stream<PushMessage> get openedMessages => const Stream<PushMessage>.empty();

  @override
  Future<PushMessage?> initialMessage() async => null;
}

class FakePushTransport implements PushTransport {
  FakePushTransport({PushMessage? launchMessage})
    : _launchMessage = launchMessage;

  PushMessage? _launchMessage;

  bool initialMessageConsumed = false;

  final StreamController<PushMessage> _foreground =
      StreamController<PushMessage>.broadcast();
  final StreamController<PushMessage> _opened =
      StreamController<PushMessage>.broadcast();

  void emitForeground(PushMessage message) => _foreground.add(message);

  void emitOpened(PushMessage message) => _opened.add(message);

  Future<void> dispose() async {
    await _foreground.close();
    await _opened.close();
  }

  @override
  Stream<PushMessage> get foregroundMessages => _foreground.stream;

  @override
  Stream<PushMessage> get openedMessages => _opened.stream;

  @override
  Future<PushMessage?> initialMessage() async {
    initialMessageConsumed = true;
    final PushMessage? message = _launchMessage;
    _launchMessage = null;
    return message;
  }
}
