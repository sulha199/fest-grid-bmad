import { create } from 'zustand';

interface PostSelectionState {
  selectedPostIds: string[];
  togglePost: (postId: string) => void;
  clearSelection: () => void;
}

export const usePostSelectionStore = create<PostSelectionState>((set) => ({
  selectedPostIds: [],
  togglePost: (postId) =>
    set((state) => ({
      selectedPostIds: state.selectedPostIds.includes(postId)
        ? state.selectedPostIds.filter((id) => id !== postId)
        : [...state.selectedPostIds, postId],
    })),
  clearSelection: () => set({ selectedPostIds: [] }),
}));
