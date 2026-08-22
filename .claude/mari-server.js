const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','mari');
const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.pdf':'application/pdf'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p.endsWith('/'))p+='index.html';
  let fp=path.join(root,p);
  fs.stat(fp,(e,st)=>{
    if(e||st.isDirectory()){res.writeHead(404);return res.end('404');}
    res.writeHead(200,{'Content-Type':mimes[path.extname(fp).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(fp).pipe(res);
  });
}).listen(8802,()=>console.log('mari server on 8802'));
