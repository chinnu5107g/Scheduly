import { BookOpenCheck, Briefcase, GraduationCap, LayoutGrid, School, Sun } from 'lucide-react'
import { getType } from '../utils/timetableTypes.js'

const ICONS = { School, GraduationCap, Sun, BookOpenCheck, Briefcase, LayoutGrid }

export default function TypeIcon({ type, size = 18 }) {
  const Icon = ICONS[getType(type).icon] || LayoutGrid
  return <Icon size={size} aria-hidden="true" />
}
