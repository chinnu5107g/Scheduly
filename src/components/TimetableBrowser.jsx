import { useMemo, useState } from 'react'
import { FolderOpen, LayoutGrid, List, Plus, SearchX } from 'lucide-react'
import TimetableCard from './TimetableCard.jsx'
import { EmptyState, Segmented } from './ui.jsx'
import { STATUSES } from '../utils/timetableModel.js'
import { TIMETABLE_TYPES, TYPE_ORDER, getType } from '../utils/timetableTypes.js'

const SORTS = {
  updated: { label: 'Recently updated', fn: (a, b) => b.updatedAt - a.updatedAt },
  name: { label: 'Name (A–Z)', fn: (a, b) => a.name.localeCompare(b.name) },
  created: { label: 'Newest first', fn: (a, b) => b.createdAt - a.createdAt },
}

/**
 * Searchable, filterable collection of timetable cards (grid or list view).
 * Shared by the Dashboard and the My Timetables page.
 */
export default function TimetableBrowser({
  timetables,
  query,
  onQuery,
  view,
  onView,
  onCreate,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onToggleArchive,
}) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('updated')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return timetables
      .filter((t) => typeFilter === 'all' || t.type === typeFilter)
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => !q || `${t.name} ${t.category} ${getType(t.type).label}`.toLowerCase().includes(q))
      .sort(SORTS[sort].fn)
  }, [timetables, query, typeFilter, statusFilter, sort])

  const filtersActive = Boolean(query.trim()) || typeFilter !== 'all' || statusFilter !== 'all'
  const clearFilters = () => {
    onQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  return (
    <section aria-label="Your timetables">
      <div className="toolbar">
        <div className="toolbar-filters">
          <div className="field-inline">
            <label htmlFor="flt-type">Type</label>
            <select id="flt-type" className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {TYPE_ORDER.map((id) => (
                <option key={id} value={id}>
                  {TIMETABLE_TYPES[id].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-inline">
            <label htmlFor="flt-status">Status</label>
            <select id="flt-status" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field-inline">
            <label htmlFor="flt-sort">Sort</label>
            <select id="flt-sort" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="toolbar-end">
          <span className="muted result-count" aria-live="polite">
            {filtered.length} of {timetables.length}
          </span>
          <Segmented
            label="Layout"
            value={view}
            onChange={onView}
            options={[
              { value: 'grid', label: 'Grid', icon: <LayoutGrid size={15} aria-hidden="true" /> },
              { value: 'list', label: 'List', icon: <List size={15} aria-hidden="true" /> },
            ]}
          />
        </div>
      </div>

      {timetables.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={26} aria-hidden="true" />}
          title="No timetables yet"
          action={
            <button type="button" className="btn btn-primary" onClick={() => onCreate()}>
              <Plus size={17} aria-hidden="true" /> Create your first timetable
            </button>
          }
        >
          Pick a school, college, personal, study or work template, or start from scratch.
        </EmptyState>
      ) : (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<SearchX size={26} aria-hidden="true" />}
              title="No timetables match"
              action={
                filtersActive ? (
                  <button type="button" className="btn btn-soft" onClick={clearFilters}>
                    Clear search and filters
                  </button>
                ) : null
              }
            >
              Try a different search term or filter.
            </EmptyState>
          ) : null}
          <div className={view === 'list' ? 'tt-list' : 'tt-grid-cards'}>
            {filtered.map((t) => (
              <TimetableCard
                key={t.id}
                timetable={t}
                view={view}
                onOpen={onOpen}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onToggleArchive={onToggleArchive}
              />
            ))}
            {!filtersActive ? (
              <button type="button" className={`create-card${view === 'list' ? ' is-list' : ''}`} onClick={() => onCreate()}>
                <span className="create-card-icon">
                  <Plus size={22} aria-hidden="true" />
                </span>
                <strong>Create New Timetable</strong>
                <span className="muted">School, college, personal, study, work or custom</span>
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
