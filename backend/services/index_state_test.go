package services

import "testing"

// TestGetIndexingState verifies the live index-run snapshot: it starts empty,
// reflects an active run + per-collection progress, drops a collection when it
// finishes, and returns to all-zero when the run ends. This is the state a
// (re)connecting frontend uses to rebuild the indexing UI on load.
func TestGetIndexingState(t *testing.T) {
	s := &IndexService{core: &Core{}}

	// Idle: no run running.
	if st := s.GetIndexingState(); st.Active || st.All || len(st.Collections) != 0 {
		t.Fatalf("idle state = %+v, want all zero", st)
	}

	// Simulate an in-progress IndexAll run (lockIndex sets indexing=true in the
	// real flow; resetIndexRun(true) sets the all flag and clears progress).
	s.core.indexMu.Lock()
	s.core.indexing = true
	s.core.indexMu.Unlock()
	s.core.resetIndexRun(true)

	st := s.GetIndexingState()
	if !st.Active || !st.All || len(st.Collections) != 0 {
		t.Fatalf("fresh all-run state = %+v, want active + all", st)
	}

	// Progress recorded for two collections.
	s.core.recordIndexProgress(IndexFileProgress{Collection: "notes", File: "a.md", Indexed: 3, Total: 10})
	s.core.recordIndexProgress(IndexFileProgress{Collection: "calibre", File: "b.epub", Indexed: 7, Total: 20})
	st = s.GetIndexingState()
	if len(st.Collections) != 2 {
		t.Fatalf("want 2 collections in snapshot, got %d", len(st.Collections))
	}
	if p := st.Collections["notes"]; p.Indexed != 3 || p.Total != 10 {
		t.Fatalf("notes progress = %+v, want 3/10", p)
	}

	// One collection finishes -> dropped from the snapshot.
	s.core.clearIndexProgress("notes")
	st = s.GetIndexingState()
	if _, ok := st.Collections["notes"]; ok {
		t.Fatal("notes still in snapshot after clearIndexProgress")
	}

	// Run ends (unlockIndex + clearIndexRun in the real flow) -> all-zero.
	s.core.indexMu.Lock()
	s.core.indexing = false
	s.core.indexMu.Unlock()
	s.core.clearIndexRun()
	st = s.GetIndexingState()
	if st.Active || st.All || len(st.Collections) != 0 {
		t.Fatalf("state after clear = %+v, want all zero", st)
	}
}
