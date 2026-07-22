import { createClient } from '@ali/oneday-frontend-sdk';
import type { Database } from './types';

// 数据库 / Auth / Storage / Realtime 客户端。用法与 supabase client 完全一致，直接引入 supabase 使用：
//   import { supabase } from 'src/onedaycloud/client';
//   const { data } = await supabase.from('todos').select('*');
//   await supabase.auth.signInWithBUC();
export const oneday = createClient<Database>({ appId: "02vyt6ZK" });

// 直接可用的 supabase client（等价于 oneday.supabase）。推荐业务代码直接 import { supabase } 使用。
// ⚠️ oneday 是包装对象、不是 client，没有 .from()：请用 supabase.from() 或 oneday.supabase.from()。
export const supabase = oneday.supabase;
