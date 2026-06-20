const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const API_KEY = import.meta.env.VITE_API_KEY || '';

interface QueryBuilder {
  select: (columns: string, options?: { count?: 'exact' }) => any;
  eq: (col: string, val: any) => QueryBuilder;
  neq: (col: string, val: any) => QueryBuilder;
  in: (col: string, vals: any[]) => QueryBuilder;
  gt: (col: string, val: any) => QueryBuilder;
  gte: (col: string, val: any) => QueryBuilder;
  lt: (col: string, val: any) => QueryBuilder;
  lte: (col: string, val: any) => QueryBuilder;
  ilike: (col: string, pattern: string) => QueryBuilder;
  is: (col: string, val: any) => QueryBuilder;
  order: (col: string, opts?: { ascending?: boolean }) => QueryBuilder;
  range: (start: number, end: number) => QueryBuilder;
  limit: (n: number) => QueryBuilder;
  offset: (n: number) => QueryBuilder;
  single: () => Promise<{ data: any; error: any }>;
  maybeSingle: () => Promise<{ data: any; error: any }>;
  then: (resolve: any, reject?: any) => Promise<any>;
}

class ApiQueryBuilder implements QueryBuilder {
  private tableName: string;
  private params: URLSearchParams;
  private _single = false;
  private _count: 'exact' | null = null;

  constructor(table: string) {
    this.tableName = table;
    this.params = new URLSearchParams();
  }

  select(columns: string, options?: { count?: 'exact' }) {
    this.params.set('select', columns);
    if (options?.count) this._count = options.count;
    return this;
  }

  eq(col: string, val: any) { this.params.set(`eq_${col}`, String(val)); return this; }
  neq(col: string, val: any) { this.params.set(`neq_${col}`, String(val)); return this; }
  in(col: string, vals: any[]) { this.params.set(`in_${col}`, vals.join(',')); return this; }
  gt(col: string, val: any) { this.params.set(`gt_${col}`, String(val)); return this; }
  gte(col: string, val: any) { this.params.set(`gte_${col}`, String(val)); return this; }
  lt(col: string, val: any) { this.params.set(`lt_${col}`, String(val)); return this; }
  lte(col: string, val: any) { this.params.set(`lte_${col}`, String(val)); return this; }
  ilike(col: string, pattern: string) { this.params.set(`ilike_${col}`, pattern); return this; }
  is(col: string, val: any) { this.params.set(`is_${col}`, val === null ? 'null' : String(val)); return this; }

  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? 'desc' : 'asc';
    const existing = this.params.get('order');
    this.params.set('order', existing ? `${existing},${col}.${dir}` : `${col}.${dir}`);
    return this;
  }

  range(start: number, end: number) {
    this.params.set('range_start', String(start));
    this.params.set('range_end', String(end));
    return this;
  }

  limit(n: number) { this.params.set('limit', String(n)); return this; }
  offset(n: number) { this.params.set('offset', String(n)); return this; }

  single() { this._single = true; return this.execute(); }
  maybeSingle() { this._single = true; return this.execute(); }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    if (this._single) this.params.set('single', 'true');
    if (this._count) this.params.set('count', this._count);

    return request('GET', `${API_URL}/api/data/${this.tableName}?${this.params.toString()}`);
  }

  then(resolve: any, reject?: any) {
    return this.execute().then(resolve, reject);
  }
}

async function request(method: string, url: string, body?: any): Promise<{ data: any; error: any; count?: number }> {
  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${API_KEY}`,
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!json.ok) {
      return { data: null, error: new Error(json.error || 'request failed') };
    }
    return { data: json.data, error: null, count: json.count };
  } catch (e: any) {
    return { data: null, error: e };
  }
}

export const api = {
  from(table: string): QueryBuilder {
    return new ApiQueryBuilder(table);
  },

  async insert(table: string, body: any, options?: { select?: boolean }) {
    let url = `${API_URL}/api/data/${table}`;
    if (options?.select) url += '?select=true';
    return request('POST', url, body);
  },

  async update(table: string, id: string | number, body: any, idCol = 'id') {
    return request('PATCH', `${API_URL}/api/data/${table}/${id}?id_col=${idCol}`, body);
  },

  async remove(table: string, id: string | number, idCol = 'id') {
    return request('DELETE', `${API_URL}/api/data/${table}/${id}?id_col=${idCol}`);
  },
};
