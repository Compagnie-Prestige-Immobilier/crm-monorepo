import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';

/// A widget that manages a GetIt scope for dependency injection.
///
/// Pushes a new scope when initialized and pops it when disposed.
/// Use [init] to register dependencies specific to this scope.
class GetItScope extends StatefulWidget {
  final Widget child;
  final void Function(GetIt getIt)? init;
  final void Function(GetIt getIt)? dispose;

  const GetItScope({super.key, required this.child, this.init, this.dispose});

  @override
  State<GetItScope> createState() => _GetItScopeState();
}

class _GetItScopeState extends State<GetItScope> {
  @override
  void initState() {
    super.initState();
    GetIt.I.pushNewScope();
    widget.init?.call(GetIt.I);
  }

  @override
  void dispose() {
    widget.dispose?.call(GetIt.I);
    GetIt.I.popScope();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
