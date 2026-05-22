import { z } from 'zod'

// --- Shared primitives ---

export const githubRepoUrl = z
  .string()
  .min(1, 'GitHub URL is required')
  .regex(
    /^https:\/\/github\.com\/[^/]+\/[^/]+$/,
    'Must be a valid GitHub repo URL (https://github.com/owner/repo)'
  )

export const discordSnowflake = z
  .string()
  .min(1, 'Snowflake ID is required')
  .regex(/^\d{17,19}$/, 'Must be a 17-19 digit snowflake ID')

// --- Project ---

export const createProjectSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  projectDescription: z.string().optional(),
  projectStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Must be in YYYY-MM format')
    .or(z.literal('')),
  githubLinks: z.array(githubRepoUrl).min(1, 'At least one repository is required'),
  discordSnowflakeIds: z.array(discordSnowflake).min(1, 'At least one Discord channel is required'),
})

// --- Member ---

const optionalUrl = z.union([z.url('Must be a valid URL'), z.literal('')]).optional()

export const addMemberSchema = z
  .object({
    personId: z.string().optional(),
    displayName: z.string().optional(),
    discordId: z.string().optional(),
    githubId: z.string().optional(),
    imageUrl: optionalUrl,
  })
  .superRefine((data, ctx) => {
    if (!data.personId && !data.displayName?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Display name is required when creating a new person',
        path: ['displayName'],
      })
    }
  })

export const editMembershipSchema = z.object({
  displayName: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
})

// --- Person ---

export const updatePersonSchema = z.object({
  displayName: z.string().min(1, 'Display name cannot be empty').optional(),
  imageUrl: z.union([z.url('Must be a valid URL'), z.literal(''), z.null()]).optional(),
  forceCascade: z.boolean().optional(),
})

export const addIdentitySchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('DISCORD'),
    externalId: discordSnowflake,
    username: z.string().optional(),
  }),
  z.object({
    provider: z.literal('GITHUB'),
    externalId: z.string().min(1, 'External ID is required'),
    username: z.string().optional(),
  }),
])

export const editIdentitySchema = z.object({
  externalId: z.string().trim().min(1, 'External ID cannot be empty').optional(),
  username: z.string().trim().nullable().optional(),
})

// --- Roles ---

export const rolesSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .refine((val) => z.email().safeParse(val).success, 'Invalid email address'),
    adminRole: z.boolean().optional(),
    execRole: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.adminRole && !data.execRole) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select at least one role',
        path: ['adminRole'],
      })
    }
  })
