package services

import (
	"vectile/backend/db"
	"vectile/backend/search"
)

// SearchService exposes hybrid search to the frontend.
type SearchService struct{ core *Core }

// NewSearchService creates a SearchService bound to the shared core.
func NewSearchService(core *Core) *SearchService { return &SearchService{core: core} }

// Search runs hybrid vector + FTS search with the given filters.
func (s *SearchService) Search(query string, filters search.Filters) ([]search.SearchResult, error) {
	return search.Search(db.DB, query, filters, s.core.Embedder, s.core.Cfg.SearchDefaults)
}
