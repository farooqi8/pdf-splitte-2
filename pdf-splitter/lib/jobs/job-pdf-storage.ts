import type { SupabaseClient } from '@supabase/supabase-js'

import type { Group } from '@/types'

export async function ensureJobsBucket(supabase: SupabaseClient) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error('Failed to access Supabase Storage buckets.')
  const exists = buckets.some((b) => b.name === 'jobs')
  if (exists) return

  const { error: createError } = await supabase.storage.createBucket('jobs', {
    public: false,
  })
  if (createError) {
    throw new Error(
      'Storage bucket "jobs" is missing. Create it in Supabase Storage and try again.',
    )
  }
}

export async function uploadJobPdfToStorage(params: {
  supabase: SupabaseClient
  jobId: string
  type: Group
  buffer: Buffer
}): Promise<string> {
  const filename = `${params.type}.pdf`
  const objectPath = `${params.jobId}/${filename}`

  const { error } = await params.supabase.storage
    .from('jobs')
    .upload(objectPath, params.buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) {
    throw new Error(`Failed to upload ${params.type.toUpperCase()} PDF to storage.`)
  }

  return objectPath
}
