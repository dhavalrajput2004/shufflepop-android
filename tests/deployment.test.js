const test=require('node:test'),assert=require('node:assert/strict');
const {createApi}=require('../server/http.js');const {verifyDeployment,origin}=require('../scripts/verify-deployment.js');
test('deployment smoke test exercises real API and removes temporary sessions',async t=>{
 const server=createApi();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;const result=await verifyDeployment(base);
 assert.equal(result.ok,true);assert.ok(result.checks.includes('private hands'));
});
test('build API origin validation rejects insecure paths and embedded credentials',()=>{
 assert.equal(origin('https://example.com'),'https://example.com');
 for(const value of ['http://example.com','https://example.com/','https://user:pass@example.com','https://example.com?q=x','https://example.com/api','https://example.com#x'])assert.throws(()=>origin(value));
});
