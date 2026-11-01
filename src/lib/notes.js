import { create } from 'zustand';
import { api } from './api';
import { useStore } from './store';

const fail = (e) => useStore.getState().toast(e.message, { tone: 'error' });

/** Notes from the Notes tab, newest edit first. */
export const useNotes = create((set, get) => ({
  notes: [],
  loaded: false,
  load: async () => {
    try {
      set({ notes: await api.notes(), loaded: true });
    } catch (e) {
      set({ loaded: true });
      fail(e);
    }
  },
  create: async (data = {}) => {
    try {
      const note = await api.createNote(data);
      set((s) => ({ notes: [note, ...s.notes] }));
      return note;
    } catch (e) {
      fail(e);
    }
  },
  update: async (id, patch) => {
    const before = get().notes;
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)) }));
    try {
      await api.updateNote(id, patch);
    } catch (e) {
      set({ notes: before });
      fail(e);
    }
  },
  remove: async (id) => {
    const before = get().notes;
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    try {
      await api.removeNote(id);
    } catch (e) {
      set({ notes: before });
      fail(e);
    }
  },
}));

export const noteTitle = (n) => n.title?.trim() || 'Untitled note';
