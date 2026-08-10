const DEFAULT_BASE_URL = 'http://localhost:11434/v1'
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 500

export interface AiClientConfig {
  baseUrl: string
  model: string
  apiKey?: string
  maxRetries?: number
  retryDelayMs?: number
}

export interface AiRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  promptVersion: string
}

export interface AiResult<T> {
  data: T
  provenance: {
    model: string
    promptVersion: string
  }
}

export interface AiClientDependencies {
  fetch?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
}

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiConfigurationError'
  }
}

export class AiRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AiRequestError'
    this.status = status
  }
}

export class AiResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiResponseError'
  }
}

function isLocalUrl(baseUrl: string): boolean {
  let url: URL

  try {
    url = new URL(baseUrl)
  } catch {
    throw new AiConfigurationError(`AI_BASE_URL is not a valid URL: ${baseUrl}`)
  }

  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
}

export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiClientConfig {
  const baseUrl = env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL
  const model = env.AI_MODEL?.trim()
  const apiKey = env.OPENAI_API_KEY?.trim()

  if (!model) {
    throw new AiConfigurationError(
      'AI_MODEL is required (for example, set AI_MODEL=llama3.1 when using Ollama)'
    )
  }

  if (!isLocalUrl(baseUrl) && !apiKey) {
    throw new AiConfigurationError('OPENAI_API_KEY is required when AI_BASE_URL is not local')
  }

  return { baseUrl, model, apiKey }
}

function retryDelay(response: Response | undefined, fallbackMs: number): number {
  const retryAfter = response?.headers.get('retry-after')
  if (!retryAfter) return fallbackMs

  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000

  const date = Date.parse(retryAfter)
  return Number.isNaN(date) ? fallbackMs : Math.max(0, date - Date.now())
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

async function responseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string }; message?: string }
    return body.error?.message || body.message || response.statusText || 'Unknown error'
  } catch {
    return response.statusText || 'Unknown error'
  }
}

export function createAiClient(
  config: AiClientConfig = loadAiConfig(),
  dependencies: AiClientDependencies = {}
) {
  const fetchImplementation = dependencies.fetch ?? globalThis.fetch
  const sleep =
    dependencies.sleep ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
  const initialDelay = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  if (!config.model.trim()) throw new AiConfigurationError('AI model must not be empty')
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new AiConfigurationError('maxRetries must be a non-negative integer')
  }
  if (!isLocalUrl(config.baseUrl) && !config.apiKey) {
    throw new AiConfigurationError('An API key is required for non-local AI endpoints')
  }

  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`

  return {
    async request<T>(request: AiRequest): Promise<AiResult<T>> {
      if (!request.promptVersion.trim()) {
        throw new AiConfigurationError('promptVersion must not be empty')
      }

      let lastError: unknown

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        let response: Response | undefined

        try {
          response = await fetchImplementation(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: config.model,
              messages: request.messages,
              response_format: { type: 'json_object' },
            }),
          })

          if (response.ok) {
            const body = (await response.json()) as {
              choices?: Array<{ message?: { content?: string } }>
            }
            const content = body.choices?.[0]?.message?.content

            if (!content) throw new AiResponseError('AI response did not contain message content')

            try {
              return {
                data: JSON.parse(content) as T,
                provenance: { model: config.model, promptVersion: request.promptVersion },
              }
            } catch (error) {
              if (error instanceof AiResponseError) throw error
              throw new AiResponseError('AI response content was not valid JSON')
            }
          }

          const message = await responseErrorMessage(response)
          lastError = new AiRequestError(
            `AI request failed with HTTP ${response.status}: ${message}`,
            response.status
          )

          if (!isRetryableStatus(response.status)) throw lastError
        } catch (error) {
          if (error instanceof AiResponseError) throw error
          if (error instanceof AiRequestError && response && !isRetryableStatus(response.status))
            throw error
          lastError = error
        }

        if (attempt < maxRetries) {
          await sleep(retryDelay(response, initialDelay * 2 ** attempt))
        }
      }

      if (lastError instanceof AiRequestError) throw lastError
      const reason = lastError instanceof Error ? lastError.message : String(lastError)
      throw new AiRequestError(`AI request failed after ${maxRetries + 1} attempts: ${reason}`)
    },
  }
}
