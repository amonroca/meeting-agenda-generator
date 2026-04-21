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

interface GenerateMinutesPayload {
    googleEventId: string
    title: string
    meetingType: string
    meetingAt: string
    transcript: string
    organizationId: string
    attendees?: string[]
}

interface AzureOpenAIChoice {
    message: {
        content: string
    }
}

interface AzureOpenAIResponse {
    choices: AzureOpenAIChoice[]
}

interface GoogleDocsCreateResponse {
    documentId: string
    title: string
}

interface GoogleDriveFile {
    id: string
    webViewLink: string
}
