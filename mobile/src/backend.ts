import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const cloudEnabled=Boolean(url&&key);
export const supabase=cloudEnabled?createClient(url!,key!,{auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}}):null;
export async function identity(){if(!supabase)return 'local-me';const {data:{session},error}=await supabase.auth.getSession();if(error)throw error;if(session)return session.user.id;const result=await supabase.auth.signInAnonymously();if(result.error)throw result.error;return result.data.user!.id;}
export function checked<T>(result:{data:T,error:unknown}):NonNullable<T>{if(result.error)throw result.error;return result.data as NonNullable<T>;}
