'use client';

import { useCallback, useState } from 'react';
import type { ProcoreProject } from '@/types/procore';

interface DrawingFiltersProps {
  projects: ProcoreProject[];
  selectedProjectId: number | undefined;
  searchQuery: string;
  onProjectChange: (projectId: number | undefined) => void;
  onSearchChange: (search: string) => void;
  isLoading?: boolean;
}

export function DrawingFilters({
  projects,
  selectedProjectId,
  searchQuery,
  onProjectChange,
  onSearchChange,
  isLoading = false,
}: DrawingFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearchChange(localSearch);
    },
    [localSearch, onSearchChange]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        onSearchChange(localSearch);
      }
    },
    [localSearch, onSearchChange]
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Project Filter */}
        <div className="flex-1">
          <label
            htmlFor="project-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Project
          </label>
          <select
            id="project-filter"
            value={selectedProjectId ?? ''}
            onChange={(e) =>
              onProjectChange(e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.projectNumber ? ` (${project.projectNumber})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="flex-1">
          <label
            htmlFor="drawing-search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search
          </label>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              id="drawing-search"
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by drawing number or title..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Search
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
