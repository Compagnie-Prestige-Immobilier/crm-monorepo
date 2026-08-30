abstract class AppRoutes {
  AppRoutes._();

  // Atelier shell
  static const shell = _Paths.shell;
  static const dashboard = _Paths.shell;
  static const orders = _Paths.orders;
  static const clients = _Paths.clients;
  static const more = _Paths.more;

  // Client shell
  static const clientShell = _Paths.clientShell;
  static const clientHome = _Paths.clientShell;
  static const clientSearch = _Paths.clientSearch;
  static const clientMap = _Paths.clientMap;
  static const clientRanking = _Paths.clientRanking;
  static const clientFavorites = _Paths.clientFavorites;
  static const clientActivity = _Paths.clientActivity;
  static const clientProfile = _Paths.clientProfile;
  static const clientAtelierDetail = _Paths.clientAtelierDetail;

  // Shared
  static const auth = _Paths.auth;
  static const preferences = _Paths.preferences;
  static const clientPreferences = _Paths.clientPreferences;
  static const businessProfile = _Paths.businessProfile;
  static const addEditProject = _Paths.addEditProject;
  static const addEditClient = _Paths.addEditClient;
  static const addEditMeasurement = _Paths.addEditMeasurement;
  static const projectDetail = _Paths.projectDetail;
  static const clientDetail = _Paths.clientDetail;
  static const addEditOrder = _Paths.addEditOrder;
  static const orderDetail = _Paths.orderDetail;
  static const pinCode = _Paths.pinCode;
  static const newOrder = _Paths.newOrder;
  static const onboarding = _Paths.onboarding;
  static const setupWizard = _Paths.setupWizard;
  static const spaceSelector = _Paths.spaceSelector;
  static const invoiceLive = _Paths.invoiceLive;
}

abstract class _Paths {
  _Paths._();

  // Atelier
  static const shell = '/shell';
  static const orders = '/orders';
  static const clients = '/clients';
  static const more = '/more';

  // Client
  static const clientShell = '/client';
  static const clientSearch = '/client/recherche';
  static const clientMap = '/client/carte';
  static const clientRanking = '/client/classement';
  static const clientFavorites = '/client/favoris';
  static const clientActivity = '/client/activite';
  static const clientProfile = '/client/profil';
  static const clientAtelierDetail = '/client/atelier';

  // Shared
  static const auth = '/auth';
  static const preferences = '/preferences';
  static const clientPreferences = '/client/preferences';
  static const businessProfile = '/business-profile';
  static const addEditProject = '/add-edit-project';
  static const addEditClient = '/add-edit-client';
  static const addEditMeasurement = '/add-edit-measurement';
  static const projectDetail = '/project-detail';
  static const clientDetail = '/client-detail';
  static const addEditOrder = '/add-edit-order';
  static const orderDetail = '/order-detail';
  static const pinCode = '/pin-code';
  static const newOrder = '/new-order';
  static const invoiceLive = '/invoice-live';
  static const onboarding = '/onboarding';
  static const setupWizard = '/setup-wizard';
  static const spaceSelector = '/space-selector';
}

/// Compatibility aliases for older modules that still import `Routes`.
abstract class Routes {
  Routes._();

  static const auth = _Paths.auth;
  static const clientShell = _Paths.clientShell;
  static const clientSearch = _Paths.clientSearch;
  static const clientRanking = _Paths.clientRanking;
  static const clientMap = _Paths.clientMap;
  static const clientFavorites = _Paths.clientFavorites;
  static const clientActivity = _Paths.clientActivity;
  static const clientProfile = _Paths.clientProfile;
  static const clientAtelierDetail = _Paths.clientAtelierDetail;
  static const shell = _Paths.shell;
  static const dashboard = _Paths.shell;
  static const orders = _Paths.orders;
  static const clients = _Paths.clients;
  static const more = _Paths.more;
  static const preferences = _Paths.preferences;
  static const clientPreferences = _Paths.clientPreferences;
  static const businessProfile = _Paths.businessProfile;
  static const addEditProject = _Paths.addEditProject;
  static const addEditClient = _Paths.addEditClient;
  static const addEditMeasurement = _Paths.addEditMeasurement;
  static const projectDetail = _Paths.projectDetail;
  static const clientDetail = _Paths.clientDetail;
  static const addEditOrder = _Paths.addEditOrder;
  static const orderDetail = _Paths.orderDetail;
  static const pinCode = _Paths.pinCode;
  static const newOrder = _Paths.newOrder;
  static const onboarding = _Paths.onboarding;
  static const setupWizard = _Paths.setupWizard;
  static const spaceSelector = _Paths.spaceSelector;
  static const invoiceLive = _Paths.invoiceLive;
}
