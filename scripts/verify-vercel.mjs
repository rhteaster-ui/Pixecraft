// Local validation with Vercel's own Node builder. No login or deployment.
import {build} from '@vercel/node';
import {glob} from '@vercel/build-utils';
import {writeFileSync,mkdirSync} from 'node:fs';
const root=process.cwd();const files={...await glob('api/**',root),...await glob('server/**',root),...await glob('package*.json',root),...await glob('tsconfig.json',root)};
const results=[];
for(const entrypoint of ['api/health.ts','api/auth.ts','api/images.ts','api/ai.ts']){
 const result=await build({files,entrypoint,workPath:root,config:{zeroConfig:true},meta:{isDev:true}});
 const output=result.output,paths=Object.keys(output.files||{});const compiled=paths.some(p=>p.endsWith('server/core.js'));const sharp=paths.some(p=>p.endsWith('.node'));
 if(!compiled||!sharp)throw new Error(`Incomplete function trace: ${entrypoint}`);
 results.push({entrypoint,handler:output.handler,runtime:output.runtime,files:paths.length,compiledServer:compiled,nativeSharp:sharp});console.log(`PASS ${entrypoint} (${paths.length} traced files, ${output.runtime})`);
}
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/vercel-builder.json',JSON.stringify({created:new Date().toISOString(),results},null,2));
