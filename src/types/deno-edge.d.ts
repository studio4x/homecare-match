declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.45.0" {
  export function createClient(url: string, key: string): any;
}

declare module "https://deno.land/x/postgres@v0.17.0/mod.ts" {
  export class Client {
    constructor(connectionString: string);
    connect(): Promise<void>;
    end(): Promise<void>;
    queryObject(sql: string): Promise<any>;
  }
}

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};