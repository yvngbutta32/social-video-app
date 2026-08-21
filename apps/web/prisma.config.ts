import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasources: {
    db: {
      url: 'postgresql://social_video:UMTaRcFvsVRFfnRGQxxDSfCmDKIjS2B2@localhost:5432/social_video',
    },
  },
})