import '@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from '@supabase/supabase-js'

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
    const { ref, commits, repository } = await req.json()

    if (ref === 'refs/heads/main') {
      return new Response(JSON.stringify({ message: 'Ignoring main branch' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const branch = ref.replace('refs/heads/', '')
    const repoOwner = repository.owner.login
    const repoName = repository.name

    for (const commit of commits) {
      const data = {
        sha: commit.id,
        shortSha: commit.id.slice(0, 7),
        repoOwner,
        repoName,
        branch,
        message: commit.message,
        commitUrl: commit.url,
        authorName: commit.author.name,
        committedAt: new Date(commit.timestamp),
      }
      await supabase.from('LiveCommit').insert(data)
    }

    const { data: allCommits } = await supabase
      .from('LiveCommit')
      .select('id')
      .order('committedAt', { ascending: false })

    if (allCommits && allCommits.length > 10) {
      const toDelete = allCommits.slice(10).map((c) => c.id)
      await supabase.from('LiveCommit').delete().in('id', toDelete)
    }

    return new Response(JSON.stringify({ message: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
