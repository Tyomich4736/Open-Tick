import { Tag } from 'lucide-react'
import type { Tag as TagEntity } from '@shared/entities'
import { Collapse } from '@/components/ui/Collapse'
import { SectionHeader, SidebarItem } from './SidebarItem'

interface SidebarTagsProps {
  tags: TagEntity[]
  tagsExpanded: boolean
  onToggleTagsSection: () => void
}

export function SidebarTags({ tags, tagsExpanded, onToggleTagsSection }: SidebarTagsProps) {
  return (
    <div className="mt-5">
      <SectionHeader
        label="Tags"
        expanded={tagsExpanded}
        onToggle={onToggleTagsSection}
      />
      <Collapse open={tagsExpanded}>
        <ul className="space-y-0.5">
          {tags.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">No tags yet</li>
          ) : (
            tags.map((tag) => (
              <li key={tag.id}>
                <SidebarItem
                  to={`/tag/${encodeURIComponent(tag.name)}`}
                  label={tag.name}
                  icon={Tag}
                />
              </li>
            ))
          )}
        </ul>
      </Collapse>
    </div>
  )
}
