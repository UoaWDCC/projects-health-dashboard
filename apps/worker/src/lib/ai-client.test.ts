import { AiConfigurationError, AiResponseError, createAiClient, loadAiConfig } from './ai-client'

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers(headers),
    json: async () => body,
  } as Response
}

const request = {
  messages: [
    { role: 'system' as const, content: 'Return a health summary as JSON.' },
    { role: 'user' as const, content: 'Summarise this project.' },
  ],
  promptVersion: 'weekly-summary-v1',
}

describe('AI client', () => {
  it('sends an OpenAI-compatible request and returns structured data with provenance', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ choices: [{ message: { content: '{"summary":"Healthy"}' } }] }))
    const client = createAiClient(
      { baseUrl: 'https://ai.example.com/v1/', model: 'gpt-4.1-mini', apiKey: 'secret' },
      { fetch: fetchMock }
    )

    await expect(client.request<{ summary: string }>(request)).resolves.toEqual({
      data: { summary: 'Healthy' },
      provenance: { model: 'gpt-4.1-mini', promptVersion: 'weekly-summary-v1' },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ai.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer secret' },
      })
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: 'gpt-4.1-mini',
      messages: request.messages,
      response_format: { type: 'json_object' },
    })
  })

  it('supports a local Ollama endpoint without an API key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ choices: [{ message: { content: '{"ok":true}' } }] }))
    const client = createAiClient(
      { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
      { fetch: fetchMock }
    )

    await client.request(request)

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'content-type': 'application/json' })
  })

  it('reports clear configuration errors', async () => {
    expect(() => loadAiConfig({ AI_BASE_URL: 'http://localhost:11434/v1' })).toThrow(
      /AI_MODEL is required/
    )
    expect(() =>
      loadAiConfig({ AI_BASE_URL: 'https://api.openai.com/v1', AI_MODEL: 'gpt-4.1-mini' })
    ).toThrow(/AI_API_KEY is required/)
    await expect(() =>
      createAiClient({ baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' }).request({
        ...request,
        promptVersion: ' ',
      })
    ).rejects.toBeInstanceOf(AiConfigurationError)
  })

  it('retries temporary failures and respects retry-after', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ error: { message: 'busy' } }, 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(response({ choices: [{ message: { content: '{"ok":true}' } }] }))
    const sleep = vi.fn().mockResolvedValue(undefined)
    const client = createAiClient(
      { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1', maxRetries: 2 },
      { fetch: fetchMock, sleep }
    )

    await expect(client.request(request)).resolves.toMatchObject({ data: { ok: true } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(2000)
  })

  it('retries network failures and stops at the configured limit', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connection refused'))
    const sleep = vi.fn().mockResolvedValue(undefined)
    const client = createAiClient(
      { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1', maxRetries: 2 },
      { fetch: fetchMock, sleep }
    )

    await expect(client.request(request)).rejects.toThrow(/after 3 attempts: connection refused/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('does not retry permanent HTTP errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ error: { message: 'bad request' } }, 400))
    const sleep = vi.fn()
    const client = createAiClient(
      { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
      { fetch: fetchMock, sleep }
    )

    await expect(client.request(request)).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it.each([
    [{ choices: [] }, 'did not contain message content'],
    [{ choices: [{ message: { content: 'not json' } }] }, 'was not valid JSON'],
  ])('rejects malformed successful responses', async (body, message) => {
    const client = createAiClient(
      { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
      { fetch: vi.fn().mockResolvedValue(response(body)) }
    )

    await expect(client.request(request)).rejects.toThrow(message)
    await expect(client.request(request)).rejects.toBeInstanceOf(AiResponseError)
  })
})
