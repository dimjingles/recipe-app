'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import RecipeEditor from '@/components/recipe-editor'
import type { RecipeEditorValues } from '@/components/recipe-editor'

export default function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>
}) {
  // Resolve the async searchParams (Next.js 16) before mounting RecipeEditor
  // so its initial state is correct from the start.
  const [initialValues, setInitialValues] = useState<RecipeEditorValues | undefined>()
  const [autoLookup, setAutoLookup] = useState(false)

  useEffect(() => {
    searchParams.then(params => {
      setInitialValues(params.name ? { name: params.name } : {})
      setAutoLookup(!!params.name)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Hold render until params are resolved to ensure RecipeEditor initialises
  // with the correct name (avoids the editor ignoring a late-arriving prop).
  if (initialValues === undefined) return null

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recipes" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">New Recipe</h1>
      </div>
      <RecipeEditor initialValues={initialValues} showLookup autoLookup={autoLookup} />
    </div>
  )
}
