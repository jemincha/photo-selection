import {handleRequest} from '../_shared/handler.ts';
Deno.serve(req=>handleRequest(req,true));
