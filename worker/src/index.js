import { SignJWT, importPKCS8, jwtVerify, createRemoteJWKSet } from "jose";

const FIREBASE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com"));
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function cors(env, extra = {}) {
  return {
    "Access-Control-Allow-Origin": env.APP_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Expose-Headers": "Content-Length,Content-Range,Accept-Ranges,Content-Disposition",
    "Vary": "Origin",
    ...extra,
  };
}
function json(env, body, status = 200, extra = {}) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(env, extra) } }); }
function tokenFromRequest(request){const h=request.headers.get("Authorization")||"";return h.startsWith("Bearer ")?h.slice(7).trim():"";}
async function verifyFirebaseToken(token, env){
  if(!token)throw Object.assign(new Error("Authentication is required."),{code:"AUTH_REQUIRED"});
  const {payload}=await jwtVerify(token,FIREBASE_JWKS,{issuer:`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,audience:env.FIREBASE_PROJECT_ID});
  if(payload.exp && payload.exp < Math.floor(Date.now()/1000))throw Object.assign(new Error("Session expired."),{code:"AUTH_EXPIRED"});
  if(!payload.user_id)throw Object.assign(new Error("Invalid Firebase token."),{code:"AUTH_INVALID"});
  return payload;
}
function serviceAccount(env){
  if(!env.GOOGLE_SERVICE_ACCOUNT_JSON)throw Object.assign(new Error("Google Drive service account is not configured."),{code:"DRIVE_CONFIG_MISSING"});
  let value;
  try { value = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON); }
  catch { throw Object.assign(new Error("Google service-account JSON is invalid."),{code:"DRIVE_CONFIG_MISSING"}); }
  if(!value?.client_email || !value?.private_key) throw Object.assign(new Error("Google service-account credentials are incomplete."),{code:"DRIVE_CONFIG_MISSING"});
  return value;
}
function b64url(data){const bytes=typeof data==="string"?new TextEncoder().encode(data):new Uint8Array(data);let s="";for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
async function driveAccessToken(env){
  const sa=serviceAccount(env);const now=Math.floor(Date.now()/1000);const key=await importPKCS8(sa.private_key,"RS256");
  const assertion=await new SignJWT({scope:DRIVE_SCOPE}).setProtectedHeader({alg:"RS256",typ:"JWT"}).setIssuer(sa.client_email).setAudience("https://oauth2.googleapis.com/token").setIssuedAt(now).setExpirationTime(now+3500).sign(key);
  const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error_description||"Could not get Google access token."),{code:"DRIVE_AUTH_FAILED"});return data.access_token;
}
async function driveFile(env,fileId){
  const token=await driveAccessToken(env);const u=new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);u.searchParams.set("fields","id,name,mimeType,size,trashed");u.searchParams.set("supportsAllDrives","true");
  const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error?.message||"Drive file could not be read."),{code:"DRIVE_FILE_ERROR",status:r.status});return data;
}
async function dbPath(path){
  return path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).map((part)=>encodeURIComponent(part)).join("/");
}
async function dbGet(env,path,firebaseIdToken){
  const u=`${env.FIREBASE_DATABASE_URL.replace(/\/$/,"")}/${dbPath(path)}.json?auth=${encodeURIComponent(firebaseIdToken)}`;
  const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw Object.assign(new Error("Firebase database request failed."),{code:"DB_ERROR",status:r.status});return r.json();
}
async function authorizePublishedMaterial(env,claims,materialId){
  const user=await dbGet(env,`users/${claims.user_id}`,claims.rawToken);if(!user||user.role!=="student"||user.active!==true)throw Object.assign(new Error("Student account is not active."),{code:"PDF_ACCESS_DENIED"});
  const cls=Number(user.class);if(![6,7,8,9,10].includes(cls))throw Object.assign(new Error("Student class is not assigned."),{code:"PDF_ACCESS_DENIED"});
  const material=await dbGet(env,`publishedCatalog/class-${cls}/${materialId}`,claims.rawToken);if(!material||material.active!==true)throw Object.assign(new Error("Material is not available for this class."),{code:"PDF_ACCESS_DENIED"});
  if(!material.driveFileId)throw Object.assign(new Error("Material is missing its Drive file ID."),{code:"PDF_NOT_CONFIGURED"});
  return {user,material};
}

async function firebaseServiceAccessToken(env){
  if(!env.GOOGLE_SERVICE_ACCOUNT_JSON)throw Object.assign(new Error("Google service account is not configured."),{code:"SERVICE_ACCOUNT_MISSING"});
  const sa=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now=Math.floor(Date.now()/1000);
  const key=await importPKCS8(sa.private_key,"RS256");
  const assertion=await new SignJWT({scope:"https://www.googleapis.com/auth/firebase.database"})
    .setProtectedHeader({alg:"RS256",typ:"JWT"}).setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token").setIssuedAt(now).setExpirationTime(now+3500).sign(key);
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  const data=await r.json();
  if(!r.ok)throw Object.assign(new Error(data.error_description||"Could not get Firebase service token."),{code:"SERVICE_AUTH_FAILED"});
  return data.access_token;
}
async function dbDeleteWithServiceToken(env,path,serviceToken){
  const u=`${env.FIREBASE_DATABASE_URL.replace(/\/$/,"")}/${dbPath(path)}.json`;
  const r=await fetch(u,{method:"DELETE",headers:{Authorization:`Bearer ${serviceToken}`}});
  if(!r.ok)throw Object.assign(new Error("Firebase database deletion failed."),{code:"DB_DELETE_ERROR",status:r.status});
}
async function deleteFirebaseAuthAccount(env,idToken){
  if(!env.FIREBASE_WEB_API_KEY)throw Object.assign(new Error("Firebase Web API key is not configured on the deletion gateway."),{code:"AUTH_DELETE_CONFIG_MISSING"});
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data.error?.message||"Firebase account deletion failed."),{code:(data.error?.message||"AUTH_DELETE_ERROR").toLowerCase().replace(/[^a-z0-9]+/g,"_"),status:r.status});
}

function cleanError(error){return {code:error?.code||"GATEWAY_ERROR",message:error?.message||"Drive Gateway request failed."};}

export default {
  async fetch(request, env) {
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(env)});
    const url=new URL(request.url); const path=url.pathname.replace(/\/+$/,"/");
    if(path==="/health/")return json(env,{ok:true,service:"ezee-vision-drive-gateway",time:new Date().toISOString()});
    try{
      if(path==="/account/delete/" && request.method==="POST"){
        const firebaseToken=tokenFromRequest(request);
        const claims=await verifyFirebaseToken(firebaseToken,env);
        if(String(claims.email||"").toLowerCase()===String(env.ADMIN_EMAIL||"").toLowerCase())throw Object.assign(new Error("Admin accounts cannot be deleted from the student portal."),{code:"ACCOUNT_DELETE_NOT_ALLOWED"});
        const user=await dbGet(env,`users/${claims.user_id}`,firebaseToken);
        if(!user || String(user.role||"").toLowerCase()!=="student")throw Object.assign(new Error("Only student accounts can be deleted here."),{code:"ACCOUNT_DELETE_NOT_ALLOWED"});
        const serviceToken=await firebaseServiceAccessToken(env);
        const studentId=String(user.studentId||"").trim();
        await dbDeleteWithServiceToken(env,`users/${claims.user_id}`,serviceToken);
        await dbDeleteWithServiceToken(env,`recent/${claims.user_id}`,serviceToken);
        await dbDeleteWithServiceToken(env,`materialSeen/${claims.user_id}`,serviceToken);
        await dbDeleteWithServiceToken(env,`notifications/${claims.user_id}`,serviceToken);
        await dbDeleteWithServiceToken(env,`practiceAttempts/${claims.user_id}`,serviceToken);
        await dbDeleteWithServiceToken(env,`studyPlans/${claims.user_id}`,serviceToken);
        if(studentId) await dbDeleteWithServiceToken(env,`studentIndex/${encodeURIComponent(studentId)}`,serviceToken);
        await deleteFirebaseAuthAccount(env,firebaseToken);
        return json(env,{success:true,code:"ACCOUNT_DELETED",message:"Account and associated personal data were deleted."});
      }
      if(path==="/admin/check-file/" && request.method==="POST"){
        const raw=await request.json();const id=String(raw?.driveFileId||"").trim();const token=tokenFromRequest(request);const claims=await verifyFirebaseToken(token,env);if(String(claims.email||"").toLowerCase()!==String(env.ADMIN_EMAIL).toLowerCase())throw Object.assign(new Error("Admin permission is required."),{code:"ADMIN_REQUIRED"});if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw Object.assign(new Error("Invalid Google Drive file ID."),{code:"INVALID_DRIVE_ID"});
        const meta=await driveFile(env,id);if(meta.trashed||meta.mimeType!=="application/pdf")throw Object.assign(new Error("The selected Drive file must be a non-trashed PDF."),{code:"DRIVE_NOT_PDF"});return json(env,{success:true,id:meta.id,name:meta.name,size:Number(meta.size||0),mimeType:meta.mimeType});
      }
      const match=path.match(/^\/(pdf|worksheet)\/([^/]+)\/?$/);
      if(match && request.method==="GET"){
        const firebaseToken=tokenFromRequest(request);const rawClaims=await verifyFirebaseToken(firebaseToken,env);const claims={...rawClaims,rawToken:firebaseToken};const {material}=await authorizePublishedMaterial(env,claims,match[2]);
        const serviceToken=await driveAccessToken(env);const driveUrl=new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(material.driveFileId)}`);driveUrl.searchParams.set("alt","media");driveUrl.searchParams.set("supportsAllDrives","true");
        const range=request.headers.get("Range");const headers={Authorization:`Bearer ${serviceToken}`};if(range)headers.Range=range;const driveResponse=await fetch(driveUrl,{headers});if(!driveResponse.ok)throw Object.assign(new Error("The Drive PDF could not be streamed."),{code:"DRIVE_STREAM_ERROR",status:driveResponse.status});
        const outHeaders=cors(env,{"Content-Type":"application/pdf","Cache-Control":"private, no-store, max-age=0","Content-Disposition":`inline; filename="${String(material.fileName||material.title||"material").replace(/[\\"]+/g,"_")}"`});
        ["Content-Length","Content-Range","Accept-Ranges"].forEach(h=>{const v=driveResponse.headers.get(h);if(v)outHeaders[h]=v;});
        return new Response(driveResponse.body,{status:driveResponse.status,headers:outHeaders});
      }
      return json(env,{ok:false,code:"NOT_FOUND",message:"Endpoint not found."},404);
    }catch(error){const e=cleanError(error);const status=e.code==="AUTH_REQUIRED"||e.code==="AUTH_INVALID"||e.code==="AUTH_EXPIRED"?401:(e.code.includes("DENIED")||e.code==="ADMIN_REQUIRED"?403:(error?.status||400));return json(env,e,status);}
  }
};
