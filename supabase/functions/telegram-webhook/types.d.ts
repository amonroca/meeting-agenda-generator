declare namespace Deno {
    const env: {
        get(key: string): string | undefined
    }

    function serve(
        handler: (request: Request) => Response | Promise<Response>,
    ): void
}
