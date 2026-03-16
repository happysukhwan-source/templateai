import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_KEY_LENGTH: process.env.ANTHROPIC_API_KEY?.length ?? 0,
    ANTHROPIC_KEY_PREFIX: process.env.ANTHROPIC_API_KEY?.substring(0, 10) ?? 'NOT SET',
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
}
