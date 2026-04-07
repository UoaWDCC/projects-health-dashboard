/**
 * Project creation page — only should be accessible to administrators.
 * Should take in the necessary information to create a new project (e.g., project name, GitHub repository link, Discord Channel link, etc.)
 * and store it in the database.
 *
 * TODO: Implement the design
 */

'use client'

import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateProjectPage() {
  const router = useRouter()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const response = await fetch('/api/project', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      alert('Failed to create project')
      console.error('Failed to create project:', await response.text())
      return
    }

    router.replace('/dashboard')
  }

  return (
    <main>
      <h1>Create New Project</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Project Name:
          <input type="text" style={{ border: '1px solid #ccc' }} name="projectName" required />
        </label>
        <br />
        <label>
          GitHub Repository Link:
          <input type="url" style={{ border: '1px solid #ccc' }} name="githubLink" required />
        </label>
        <br />
        <label>
          Discord Channel Link:
          <input type="url" style={{ border: '1px solid #ccc' }} name="discordLink" required />
        </label>
        <br />
        <button type="submit">Create Project (Button)</button>
      </form>
    </main>
  )
}
