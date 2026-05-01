import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'

const encoder = new TextEncoder()

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const len = hex.length / 2
  const bytes = new Uint8Array(new ArrayBuffer(len))
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

async function verifySignature(secret: string, header: string, payload: string): Promise<boolean> {
  const sigHex = header.split('=')[1]
  const algorithm = { name: 'HMAC', hash: { name: 'SHA-256' } }
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), algorithm, false, [
    'sign',
    'verify',
  ])
  const sigBytes = hexToBytes(sigHex)
  const dataBytes = encoder.encode(payload)
  return crypto.subtle.verify(algorithm.name, key, sigBytes, dataBytes)
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const rawBody = await req.text()

    const secret = Deno.env.get('GITHUB_WEBHOOK_SECRET')!

    const signature = req.headers.get('x-hub-signature-256')

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const valid = await verifySignature(secret, signature, rawBody)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { ref, commits, repository } = JSON.parse(rawBody)

    if (!ref || !repository) {
      return new Response(JSON.stringify({ error: 'Missing required fields: ref, repository' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (ref === `refs/heads/${repository.default_branch}`) {
      return new Response(JSON.stringify({ message: 'Ignoring default branch' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!commits || commits.length === 0) {
      return new Response(JSON.stringify({ message: 'No commits in payload' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const branch = ref.replace('refs/heads/', '')
    const repoOwner = repository.owner.login
    const repoName = repository.name

    const { data: repoRecord } = await supabase
      .from('GitHubRepository')
      .select('projectId')
      .eq('owner', repoOwner)
      .eq('name', repoName)
      .single()

    const projectId = repoRecord?.projectId ?? null

    for (const commit of commits) {
      const data = {
        id: crypto.randomUUID(),
        sha: commit.id,
        shortSha: commit.id.slice(0, 7),
        repoOwner,
        repoName,
        branch,
        message: commit.message,
        commitUrl: commit.url,
        projectId,
        authorName: commit.author.name,
        authorUsername: commit.author.username ?? null,
        committedAt: new Date(commit.timestamp).toISOString(),
      }
      const { error } = await supabase.from('LiveCommit').insert(data)
      // ignore duplicate commits (same sha + repo already exists)
      if (error && error.code !== '23505') {
        throw new Error(error.message)
      }
    }

    return new Response(JSON.stringify({ message: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('github-webhook error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
