var http = require('http');
var mdns = require('mdns');
var querystring = require('querystring');
var exec = require('child_process').exec;

// Adapted from "backwards/forwards compatible Deferred function" on MDN.
// https://goo.gl/G5Mioi 
function Deferred() {
  this.resolve = null;
  this.reject = null;
  this.promise = new Promise(function(resolve, reject) {
    this.resolve = resolve;
    this.reject = reject;
  }.bind(this));
  Object.freeze(this);
}

let localHostName;
exec('scutil --get LocalHostName', (err, stdout, stderr) => {
  localHostName = `${stdout.trim()}.local.`;
});

var services = {};
var advertisedServices = {};
var ports = [];
for (var i = 3030; i < 3130; i++) { ports.push(i); }

function reservePort() {
  if (ports.length === 0) {
    throw 'Ran out of ports';
  }
  return ports.pop();
}

function releasePort(number) {
  ports.push(number);
}

function advertise(name, port) {
  let deferred = new Deferred();
  let promise = deferred.promise;
  const callback = (error, service) => {
    if (service) {
      deferred.resolve(service);
    } else if (error) {
      deferred.reject(error);
    }
  };
  const advertisement = mdns.createAdvertisement(
    mdns.tcp('flyweb'), port, { name }, callback
  );
  advertisedServices[name] = advertisement;
  advertisement.start();
  return promise;
}

function serve(port) {
  let server = http.createServer((request, response) => {
  });
  server.listen(port, () => {});
  return server;
}

function createServer(name) {
  let port = reservePort();
  let server = serve(port);
  return advertise(name, port)
    .then((ad) => {
      let entry = { ad, server, port }
      advertisedServices[name] = entry;
      return entry;
    });
}

var server = http.createServer((request, response) => {
  let options = { headers: { 'Content-Type': 'text/json' } };

  if (request.url === '/' && request.method === 'GET') {
    response.writeHead(200, options);
    response.end(JSON.stringify({ services }));
  }
  if (request.url === '/publishServer' && request.method === 'POST') {
    let body = '';
    request.on('data', (data) => {
      body += data;
    });
    request.on('end', () => {
      const params = querystring.parse(body);
      createServer(params.name).then((serverInfo) => {
        console.log('>>>', serverInfo, '<<<');
        let json = {
          name: serverInfo.ad.name,
          uiUrl: `${localHostName}:${serverInfo.port}`
        };
        response.writeHead(200, options);
        response.end(JSON.stringify(json));
      });
    });
  }
});

server.listen(8888, () => {
  let browser = mdns.createBrowser(mdns.tcp('flyweb'));

  browser.on('serviceUp', (service) => {
    console.log('service up: ', service);
    services[service.name] = service;
  });

  browser.on('serviceDown', (service) => {
    console.log('service down: ', service);
    delete services[service.name];
  });

  browser.start();
});
