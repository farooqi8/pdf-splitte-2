import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Owner } from '@/types'
import { ReferenceUploader } from './ReferenceUploader.client'

type OwnerStatus = { uploadedAt: string | null; rowCount: number }

async function getOwnerStatus(owner: Owner): Promise<OwnerStatus | null> {
  const supabase = createSupabaseServerClient()

  const [{ data: latest }, { count, error: countError }] = await Promise.all([
    supabase
      .from('reference_files')
      .select('uploaded_at')
      .eq('owner', owner)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('reference_files').select('*', { count: 'exact', head: true }).eq('owner', owner),
  ])

  if (countError) return null
  const uploadedAt =
    latest && typeof latest.uploaded_at === 'string' ? latest.uploaded_at : null

  return { uploadedAt, rowCount: count ?? 0 }
}

export default async function ReferencesPage() {
  const [saad, gorman] = await Promise.all([
    getOwnerStatus('saad'),
    getOwnerStatus('gorman'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Manage Reference Files
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Upload and store the two reference Excel files in Supabase. Matching
          uses permit number only (exact match after normalisation).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReferenceUploader owner="saad" current={saad} />
        <ReferenceUploader owner="gorman" current={gorman} />
      </div>
    </div>
  )
}

