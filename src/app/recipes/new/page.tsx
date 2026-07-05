'use client'

import { use } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import RecipeEditor from '@/components/recipe-editor'
import type { RecipeEditorValues } from '@/components/recipe-editor'

export default function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; cuisine?: string; description?: string; cook_time_minutes?: string }>
}) {
  const params = use(searchParams)
  const initialValues: RecipeEditorValues = {
    name: params.name,
    cuisine: params.cuisine,
    description: params.description,
    cookTime: params.cook_time_minutes,
  }
  const autoLookup = !!params.name && !params.description

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
