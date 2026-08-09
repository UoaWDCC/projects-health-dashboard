import { z } from 'zod'
import { AUTHORISED_ROLES } from '@/lib/admin/authorised-users'

// Deliberately kept out of ./admin.ts: that module imports the formula
// validator, which pulls mathjs (~200 kB) into any client bundle that touches
// it. The Authorised Users page validates on the client, so it imports here.
//
// The Authorised Users page grants exactly one role at a time, unlike the older
// /roles page which toggles ADMIN and EXEC independently.

export const addAuthorisedUserSchema = z.object({
  email: z.email('Enter a valid email address'),
  role: z.enum(AUTHORISED_ROLES, { error: 'Select a role' }),
})

export const changeAuthorisedRoleSchema = z.object({
  role: z.enum(AUTHORISED_ROLES, { error: 'Select a role' }),
})
