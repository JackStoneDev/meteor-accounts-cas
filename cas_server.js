var Fiber = Npm.require('fibers');
var url = Npm.require('url');
var CAS = Npm.require('cas');
var https = Npm.require('https');
var xml2js = Npm.require('xml2js');

var _casCredentialTokens = {};

RoutePolicy.declare('/_cas/', 'network');

// Listen to incoming OAuth http requests
WebApp.connectHandlers.use(function(req, res, next) {
  // Need to create a Fiber since we're using synchronous http calls and nothing
  // else is wrapping this in a fiber automatically
  Fiber(function () {
    middleware(req, res, next);
  }).run();
});

middleware = function (req, res, next) {
  // Make sure to catch any exceptions because otherwise we'd crash
  // the runner
  try {
    var barePath = req.url.substring(0, req.url.indexOf('?'));
    var splitPath = barePath.split('/');

    // Any non-cas request will continue down the default
    // middlewares.
    if (splitPath[1] !== '_cas') {
      next();
      return;
    }

    // get auth token
    var credentialToken = splitPath[2];
    if (!credentialToken) {
      closePopup(res);
      return;
    }

    // validate ticket
    casTicket(req, credentialToken, function() {
      closePopup(res);
    });

  } catch (err) {
    console.log("account-cas: unexpected error : " + err.message);
    closePopup(res);
  }
};

var casTicket = function (req, token, callback) {
  // get configuration
  if (!Meteor.settings.cas && !Meteor.settings.cas.validate) {
    console.log("accounts-cas: unable to get configuration");
    callback();
  }

  // get ticket and validate.
  var parsedUrl = url.parse(req.url, true);
  var ticketId = parsedUrl.query.ticket;

  var cas = new CAS({
    base_url: Meteor.settings.cas.baseUrl,
    service: 'http://localhost:3000/_cas/' + token
  });

  validate(cas, ticketId, function(err, status, username) {
    if (err) {
      console.log("accounts-cas: error when trying to validate " + JSON.stringify(err));
    } else {
      if (status) {
        console.log("accounts-cas: user validated " + username);
        _casCredentialTokens[token] = { id: username };
      } else {
        console.log("accounts-cas: unable to validate " + ticketId);
      }
    }

    callback();
  });

  return;
};

var validate = function(cas, ticket, callback) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  var req = https.get({
    host: cas.hostname,
    path: url.format({
      pathname: cas.base_path + '/validate',
      query: {
        ticket: ticket, service: cas.service
      }
    })
  }, function(res) {
    // Handle server errors
    res.on('error', function(e) {
      callback(e);
    });

    // Read result
    res.setEncoding('utf8');
    var response = '';

    res.on('data', function(chunk) {
      response += chunk;
    });

    res.on('end', function() {
      xml2js.parseString(response, (error, result) => {
        if (error) {
          callback({message: 'Bad response format.'});
          return;
        }

        try {
          var user = result['cas:serviceResponse']['cas:authenticationSuccess'][0]['cas:user'][0];

          if (user) {
            callback(undefined, true, user);
            return;
          }
          else {
            callback(undefined, false);
            return;
          }
        }
        catch (e) {
          callback({message: 'Bad response format.'});
        }

        // Format was not correct, error
        callback({message: 'Bad response format.'});
      });
    });
  });
};

/*
 * Register a server-side login handle.
 * It is call after Accounts.callLoginMethod() is call from client.
 *
 */
 Accounts.registerLoginHandler(function (options) {
  if (!options.cas)
    return undefined;

  if (!_hasCredential(options.cas.credentialToken)) {
    throw new Meteor.Error(Accounts.LoginCancelledError.numericError,
      'no matching login attempt found');
  }

  var result = _retrieveCredential(options.cas.credentialToken);
  var options = { profile: { name: result.id } };
  var user = Accounts.updateOrCreateUserFromExternalService("cas", result, options);

  return user;
});

var _hasCredential = function(credentialToken) {
  return _.has(_casCredentialTokens, credentialToken);
}

/*
 * Retrieve token and delete it to avoid replaying it.
 */
var _retrieveCredential = function(credentialToken) {
  var result = _casCredentialTokens[credentialToken];
  delete _casCredentialTokens[credentialToken];
  return result;
}

var closePopup = function(res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  var content = '<html><body><div id="popupCanBeClosed"></div></body></html>';
  res.end(content, 'utf-8');
}
