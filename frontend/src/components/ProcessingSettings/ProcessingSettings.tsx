'use client';

import type { ProcessingSettings } from '@/types/procore';

interface ProcessingSettingsProps {
  settings: ProcessingSettings;
  onChange: (settings: ProcessingSettings) => void;
  disabled?: boolean;
}

export function ProcessingSettingsPanel({
  settings,
  onChange,
  disabled = false,
}: ProcessingSettingsProps) {
  const handleDpiChange = (value: number) => {
    onChange({ ...settings, dpi: value });
  };

  const handleTileSizeChange = (value: number) => {
    onChange({ ...settings, tileSize: value });
  };

  const handleOverlapChange = (value: number) => {
    onChange({ ...settings, overlap: value });
  };

  const handleNoTilesChange = (checked: boolean) => {
    onChange({ ...settings, noTiles: checked });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Processing Settings</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* DPI */}
        <div>
          <label htmlFor="dpi" className="block text-xs font-medium text-gray-700 mb-1">
            DPI (Resolution)
          </label>
          <select
            id="dpi"
            value={settings.dpi}
            onChange={(e) => handleDpiChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value={150}>150 DPI (Draft)</option>
            <option value={300}>300 DPI (Standard)</option>
            <option value={600}>600 DPI (High Quality)</option>
            <option value={1200}>1200 DPI (Very High)</option>
          </select>
        </div>

        {/* No Tiles Toggle */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Output Mode
          </label>
          <div className="flex items-center mt-1.5">
            <button
              type="button"
              onClick={() => handleNoTilesChange(false)}
              disabled={disabled}
              className={`px-3 py-1.5 text-sm rounded-l-md border ${
                !settings.noTiles
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Tiles
            </button>
            <button
              type="button"
              onClick={() => handleNoTilesChange(true)}
              disabled={disabled}
              className={`px-3 py-1.5 text-sm rounded-r-md border-t border-r border-b ${
                settings.noTiles
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Full Image
            </button>
          </div>
        </div>

        {/* Tile Size - only shown when tiles enabled */}
        {!settings.noTiles && (
          <div>
            <label htmlFor="tileSize" className="block text-xs font-medium text-gray-700 mb-1">
              Tile Size (px)
            </label>
            <select
              id="tileSize"
              value={settings.tileSize}
              onChange={(e) => handleTileSizeChange(Number(e.target.value))}
              disabled={disabled}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value={640}>640 x 640</option>
              <option value={1024}>1024 x 1024</option>
              <option value={1920}>1920 x 1920</option>
              <option value={2048}>2048 x 2048</option>
            </select>
          </div>
        )}

        {/* Overlap - only shown when tiles enabled */}
        {!settings.noTiles && (
          <div>
            <label htmlFor="overlap" className="block text-xs font-medium text-gray-700 mb-1">
              Overlap (px)
            </label>
            <select
              id="overlap"
              value={settings.overlap}
              onChange={(e) => handleOverlapChange(Number(e.target.value))}
              disabled={disabled}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value={0}>No overlap</option>
              <option value={64}>64 px</option>
              <option value={128}>128 px</option>
              <option value={250}>250 px (13%)</option>
              <option value={384}>384 px (20%)</option>
            </select>
          </div>
        )}
      </div>

      {/* Info text */}
      <p className="mt-3 text-xs text-gray-500">
        {settings.noTiles ? (
          <>
            Full Image mode converts each drawing page to a single PNG at {settings.dpi} DPI.
          </>
        ) : (
          <>
            Tiles mode splits each page into {settings.tileSize}x{settings.tileSize}px tiles
            with {settings.overlap}px overlap at {settings.dpi} DPI.
          </>
        )}
      </p>
    </div>
  );
}
