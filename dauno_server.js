'use strict';

var fs = require('fs');
var https = require('https');

https.createServer(
    {
        key: fs.readFileSync('./key'),
        cert: fs.readFileSync('./crt'),
    },
    function (req, res) {
        console.log(String(
            req.method
        ));
        console.log(String(
            req.url
        ));
        console.log(String(
            JSON.stringify(req.headers)
        ));
        console.log(String(
            JSON.stringify(req.trailers)
        ));

        res.writeHead(200);
        res.end("hello world\n");
    }
).listen(8001);
