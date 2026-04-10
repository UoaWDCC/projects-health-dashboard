'use client'

export default function ManageRolesPage() {
  const handleSubmit = async (formData: FormData, method: 'POST' | 'DELETE') => {
    try {
      const response = await fetch('/api/roles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          adminRole: formData.get('adminRole') === 'on',
          execRole: formData.get('execRole') === 'on',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert('Failed: ' + (data?.error ?? 'Unknown error'))
        return
      }

      alert('Success, current user roles:' + (data.roles?.join(', ') || ' none'))
    } catch {
      alert('Failed, server error or response failed to parse')
    }
  }

  return (
    <main>
      <h1>Add role</h1>
      <form action={(formData) => handleSubmit(formData, 'POST')}>
        <label>
          Email:
          <input type="email" style={{ border: '1px solid #000000' }} name="email" required />
        </label>
        <br />
        <label>
          <input type="checkbox" name="adminRole" />
          Admin
        </label>
        <br />
        <label>
          <input type="checkbox" name="execRole" />
          Exec
        </label>
        <br />
        <button type="submit">Add Role(s)</button>
      </form>

      <br />

      <h1>Remove role</h1>
      <form action={(formData) => handleSubmit(formData, 'DELETE')}>
        <label>
          Email:
          <input type="email" style={{ border: '1px solid #000000' }} name="email" required />
        </label>
        <br />
        <label>
          <input type="checkbox" name="adminRole" />
          Admin
        </label>
        <br />
        <label>
          <input type="checkbox" name="execRole" />
          Exec
        </label>
        <br />
        <button type="submit">Remove Role(s)</button>
      </form>
    </main>
  )
}
