import { create } from 'zustand'

export interface ExampleUIState {
  isPanelOpen: boolean
  activeTab: string
}

export interface ExampleUIActions {
  setPanelOpen: (isOpen: boolean) => void
  setActiveTab: (tab: string) => void
}

/**
 * Example UI Store for ephemeral client global state (e.g., cross-component UI state).
 * 
 * IMPORTANT: This is a reference implementation. 
 * Follow AD-4 tier 3 rule: "Interface-driven with strictly defined states and actions."
 * 
 * Usage with multiple fields should use `useShallow` to prevent unnecessary re-renders:
 * ```tsx
 * import { useShallow } from 'zustand/react/shallow'
 * 
 * const { isPanelOpen, setPanelOpen } = useExampleUIStore(
 *   useShallow((state) => ({
 *     isPanelOpen: state.isPanelOpen,
 *     setPanelOpen: state.setPanelOpen,
 *   }))
 * )
 * ```
 */
export const useExampleUIStore = create<ExampleUIState & ExampleUIActions>()((set) => ({
  isPanelOpen: false,
  activeTab: 'overview',
  setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))