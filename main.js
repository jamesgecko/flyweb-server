var http = require('http');
var mdns = require('mdns');

var services = {};

var server = http.createServer((request, response) => {
  let url = request.url;
  let options = { headers: { 'Content-Type': 'text/json' } };

  if (url === '/') {
    response.writeHead(200, options);
    response.end(JSON.stringify({ services }));
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
