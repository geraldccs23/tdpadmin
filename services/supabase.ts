import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function mockSubscription() {
  return { unsubscribe: () => {} };
}

const DISABLED_ERR = new Error('Supabase disabled');

class MockQueryBuilder {
  then(resolve: any, _reject?: any) {
    return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
  }
  select(_cols: string, _opts?: any) { return this; }
  eq(_col: string, _val: any) { return this; }
  neq(_col: string, _val: any) { return this; }
  in(_col: string, _vals: any[]) { return this; }
  gt(_col: string, _val: any) { return this; }
  gte(_col: string, _val: any) { return this; }
  lt(_col: string, _val: any) { return this; }
  lte(_col: string, _val: any) { return this; }
  ilike(_col: string, _pattern: string) { return this; }
  not(_col: string, _op: string, _val: any) { return this; }
  is(_col: string, _val: any) { return this; }
  contains(_col: string, _val: any) { return this; }
  containedBy(_col: string, _val: any) { return this; }
  overlaps(_col: string, _vals: any[]) { return this; }
  textSearch(_col: string, _query: string, _opts?: any) { return this; }
  filter(_col: string, _op: string, _val: any) { return this; }
  match(_query: Record<string, any>) { return this; }
  order(_col: string, _opts?: any) { return this; }
  range(_start: number, _end: number) { return this; }
  limit(_n: number) { return this; }
  offset(_n: number) { return this; }
  single() { return this; }
  maybeSingle() { return this; }
}

const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: DISABLED_ERR }),
    onAuthStateChange: (_cb: any) => ({ data: { subscription: mockSubscription() } }),
  },
  from: (_table: string) => new MockQueryBuilder(),
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ data: null, error: DISABLED_ERR }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
      list: async () => ({ data: [], error: null }),
      remove: async () => ({ data: null, error: null }),
    }),
  },
  channel: (_name: string) => ({
    on: (_type: string, _filter: any, _cb: any) => ({ subscribe: () => 'mock', unsubscribe: () => {} }),
    subscribe: (_cb?: any) => 'mock',
    unsubscribe: () => {},
  }),
  removeChannel: (_ch: any) => {},
  rpc: (_fn: string, _params?: any) => ({ data: null, error: DISABLED_ERR }),
};

const hasSupabase = !!(supabaseUrl && supabaseAnonKey);
const instance = hasSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (console.warn('[supabase] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no definidas — usando mock'), mockSupabase);

export const supabase = instance;
