const http=require('http'),fs=require('fs'),path=require('path');
const types={'.js':'text/javascript','.html':'text/html','.png':'image/png','.json':'application/json'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
const f=path.join(__dirname,p);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}
r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d);});}).listen(8123);
