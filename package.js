Package.describe({
  summary: "CAS support for accounts",
  version: "0.0.10",
  name: "jackstone:accounts-cas",
  git: "https://github.com/jackstonedev/meteor-accounts-cas"
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1.3.5.1');
  api.use('routepolicy', 'server');
  api.use('webapp', 'server');
  api.use('accounts-base', ['client', 'server']);
  // Export Accounts (etc) to packages using this one.
  api.imply('accounts-base', ['client', 'server']);
  api.use('underscore');

  api.add_files('cas_client.js', 'web.browser');
  api.add_files('cas_client_cordova.js', 'web.cordova');
  api.add_files('cas_server.js', 'server');

});

Npm.depends({
  cas: "0.0.3",
  xml2js: "0.4.19"
});

Cordova.depends({
  'cordova-plugin-inappbrowser': '1.2.0'
});
