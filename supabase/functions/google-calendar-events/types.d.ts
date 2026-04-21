declare namespace Deno {
  const env: {
    get(key: string): string | undefined
  }

  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void
}

declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: any): any
}
