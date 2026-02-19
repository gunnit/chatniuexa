import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        const user = await prisma.user.findUnique({
          where: { email },
          include: { profile: true },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
          return null
        }

        // Auto-repair: Create tenant and profile if missing or invalid
        let tenantId = user.profile?.tenantId || null

        // Verify the tenant exists if we have a tenantId
        if (tenantId) {
          const tenantExists = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true },
          })
          if (!tenantExists) {
            logger.warn('Tenant not found, will recreate', { tenantId, userId: user.id })
            tenantId = null
          }
        }

        // Create tenant and profile if missing
        if (!tenantId) {
          try {
            const result = await prisma.$transaction(async (tx) => {
              // Create tenant for user
              const tenant = await tx.tenant.create({
                data: {
                  name: `${user.name || user.email}'s Organization`,
                },
              })

              // Delete existing profile if any (with invalid tenant)
              await tx.profile.deleteMany({
                where: { userId: user.id },
              })

              // Create profile linking user to tenant
              await tx.profile.create({
                data: {
                  userId: user.id,
                  tenantId: tenant.id,
                  fullName: user.name,
                },
              })

              return tenant.id
            })
            tenantId = result
            logger.info('Auto-created tenant', { tenantId, userId: user.id })
          } catch (error) {
            logger.error('Failed to auto-create tenant', { userId: user.id, error: String(error) })
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.tenantId = (user as { tenantId?: string | null }).tenantId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.tenantId = token.tenantId as string | null
      }
      return session
    },
  },
})
