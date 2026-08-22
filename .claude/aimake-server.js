const http=require('http'),fs=require('fs'),path=require('path');
const root='C:/Users/gilau/AppData/Local/Temp/claude/C--Users-gilau-Documents------/0e7d7028-94d0-4b0f-9cbb-65491a668153/scratchpad/ai-make';
const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p.endsWith('/'))p+='index.html';
  const fp=path.join(root,p);
  fs.stat(fp,(e,st)=>{
    if(e||st.isDirectory()){res.writeHead(404);return res.end('404');}
    res.writeHead(200,{'Content-Type':mimes[path.extname(fp).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(fp).pipe(res);
  });
}).listen(8811,()=>console.log('ai-make preview on 8811'));
