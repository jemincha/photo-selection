// Compile-time boundary only. Runtime behavior is checked on deployed Supabase before release.
declare const Deno:{env:{get:(name:string)=>string|undefined};serve:(handler:(request:Request)=>Promise<Response>)=>void};
