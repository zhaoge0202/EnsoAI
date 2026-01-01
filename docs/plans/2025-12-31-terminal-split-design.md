# Terminal Split Design

## Overview

Add split terminal functionality: right-click menu → "Split" to divide the terminal panel into multiple resizable regions, each with its own independent tab system.

## Requirements

- **Split Model**: Each split region has independent tab management (VS Code style)
- **Split Direction**: Horizontal only (left/right)
- **Close Behavior**: Auto-remove split region when last tab closes
- **Ratio Persistence**: None, default 50:50 each time

## Data Structure

```typescript
interface TerminalGroup {
  id: string;
  tabs: TerminalTab[];
  activeTabId: string | null;
}

interface TerminalPanelState {
  groups: TerminalGroup[];
  activeGroupId: string;
}
```

- Initial state: single group (equivalent to current behavior)
- On split: add new group to `groups` array

## Component Structure

```
TerminalPanel (container, maintains existing interface)
├── TerminalGroupContainer (manages multiple groups + resize)
│   ├── TerminalGroup (single split region)
│   │   ├── TabBar (region's tab bar)
│   │   └── ShellTerminal (terminal instance)
│   ├── ResizeHandle (drag handle)
│   └── TerminalGroup (another split region)
│       ├── TabBar
│       └── ShellTerminal
```

### Responsibilities

- `TerminalPanel`: Thin wrapper, delegates to `TerminalGroupContainer`
- `TerminalGroupContainer`: Split layout, resize logic, group ratio management
- `TerminalGroup`: Extracted from current `TerminalPanel` core logic (tab management, terminal rendering)
- `ResizeHandle`: Drag handle between splits, reuses existing project resize patterns

## Split Operation

### Context Menu Extension

Add to `ShellTerminal.tsx` `handleContextMenu`:

```typescript
{ id: 'split', label: t('Split Terminal') },
{ id: 'separator-2', label: '', type: 'separator' },
```

### Split Flow

1. User right-clicks in terminal → selects "Split"
2. `ShellTerminal` notifies parent via new `onSplit` callback
3. `TerminalGroupContainer` inserts new group to the right of current group
4. New group auto-creates a terminal tab and activates it

### Close Flow

1. User closes last tab in a group
2. Detect `group.tabs.length === 0`
3. Remove group from `groups` array
4. If removed group was `activeGroupId`, switch to adjacent group

## Resize Logic

### Layout

Flexbox + percentage width:

```tsx
<div className="flex h-full w-full">
  {groups.map((group, index) => (
    <>
      <div style={{ flex: `1 1 ${100 / groups.length}%` }}>
        <TerminalGroup ... />
      </div>
      {index < groups.length - 1 && <ResizeHandle />}
    </>
  ))}
</div>
```

### Interaction

- On drag: calculate mouse position percentage relative to container
- Dynamically adjust flex values of adjacent groups
- On release: ratio fixed (not persisted)
- Min width constraint: each group at least 20% width

### Visual Style

- Handle width: 4px, highlight on hover
- Reuse existing `cursor-col-resize` and `bg-accent` styles

## Focus & Active State

### Focus Management

- `activeGroupId`: marks currently active split region
- Clicking any terminal or tab updates `activeGroupId`
- Only `activeGroupId` group receives keyboard input

### Visual Differentiation

- Active group: normal tab bar display
- Inactive group: reduced contrast (`opacity-70` or `text-muted-foreground`)

### Terminal Activation Logic

```typescript
const isTerminalActive =
  panelIsActive &&
  group.id === activeGroupId &&
  tab.id === group.activeTabId;
```

## Implementation Steps

1. Define new types (`TerminalGroup`, updated state interface)
2. Extract `TerminalGroup` component from current `TerminalPanel`
3. Create `TerminalGroupContainer` with single-group support
4. Add `ResizeHandle` component
5. Implement split functionality (context menu + state logic)
6. Add focus management between groups
7. Handle auto-remove on last tab close
