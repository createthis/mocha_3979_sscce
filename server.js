import Boom from "boom";
import SystemService from "~/services/system"
const NODE_ENV = SystemService.get_node_env();
if (NODE_ENV !== 'test') {
  require('dotenv').config();
}
import '@babel/register';
import '@babel/polyfill';

const Hapi = require('hapi');
const Hoek = require('hoek');
const Inert = require('inert');
const Vision = require('vision');
const Models = require('~/models');
const AuthBearer = require('hapi-auth-bearer-token');
const AuthCookie = require('hapi-auth-cookie');
const AuthBasic = require('hapi-auth-basic');
const WebpackPlugin = require('hapi-webpack-plugin');
// Create a server with a host and port
const server = new Hapi.Server({
  host: process.env.host ? process.env.host : 'localhost',
  port: SystemService.get_port(),
  router: { stripTrailingSlash: true },
  debug: { request: ['info'] },
});

const register_strategies = async () => {
  const cache = server.cache({ segment: 'sessions', expiresIn: 3 * 24 * 60 * 60 * 1000 });

  server.app.cache = cache;
}

const register_routes = async (err) => {
  await server.register(Inert);
  server.route({
    method: 'GET',
    path: '/node_modules/{param*}',
    options: {
      handler: {
        directory: {
          path: './node_modules',
          redirectToSlash: true,
          index: true
        }
      },
    }
  });

  if (!module.parent) {
    // do not use webpack inside mocha / npm test
    await server.register({
      plugin: WebpackPlugin,
      options: './webpack.config.js'
    });
    await server.register({
      plugin: require('good'),
      options: {
        includes: {
          request: ['headers','payload'],
          response: ['payload']
        },
        reporters: {
          console: [
            {
              module: 'good-squeeze',
              name: 'Squeeze',
              args: [{ error: '*', log: '*', request: '*', response: '*' }]
            },
            {
              module: 'good-console',
              args: [{color: (NODE_ENV === 'development')}],
            },
            'stdout'
          ]
        }
      }
    });
  }

  // Add routes
  let routes = [
    Vision,
    {
      plugin: require('./routes/root.js'),
      options: {
        database: Models
      }
    },
  ];

  await server.register(routes);

  server.views({
    engines: {
      hbs: require('handlebars')
    },
    relativeTo: __dirname,
    path: './views',
  });

  if (!module.parent) {
    // Start the server, but only if not running inside mocha / npm test
    server.start(async (err) => {
      if (err) {
        throw err;
      }
      console.log('Server running at:', server.info.uri);
    });
  }
}

const initialize = async () => {
  await server.register([AuthBearer, AuthCookie, AuthBasic]);
  await register_strategies();
  await register_routes();

  console.log('server initialized');
}

const main = async ()  => {
  await initialize();
}

if (!module.parent) {
  // if we're not running inside mocha / npm test, auto initialize the server.
  // inside mocha, we need to do this via a beforeEach in order to assure synchrony.
  main();
}

export default {
  server,
  initialize,
}
process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error.message);
  console.log(error.stack);
});
/*process.on('warning', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error.message);
  console.log(error.stack);
});*/
