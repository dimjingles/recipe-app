'use client'

import { useSearchParams } from 'next/navigation'
import { getWeekStart } from '@/lib/week'
import GroceryList from '@/components/grocery-list'

export default function GroceryClient() {
  const weekStart = useSearchParams().get('week_start') || getWeekStart()
  return <GroceryList weekStart={weekStart} />
}
