'use client';

import { useState, useCallback } from 'react';
import type { ConversionSettings as ConversionSettingsType } from '@/types/api';
import { DEFAULT_CONVERSION_SETTINGS } from '@/types/api';

interface ConversionSettingsProps {
  settings: ConversionSettingsType;
  onChange: (settings: ConversionSettingsType) => void;
  disabled?: boolean;
}

const DPI_PRESETS = [
  { label: '150 DPI (Draft)', value: 150 },
  { label: '300 DPI (Standard)', value: 300 },
  { label: '600 DPI (High Quality)', value: 600 },
  { label: '1200 DPI (Maximum)', value: 1200 },
];

const TILE_SIZE_PRESETS = [
  { label: '640 px', value: 640 },
  { label: '1280 px', value: 1280 },
  { label: '1920 px (Default)', value: 1920 },
  { label: '2560 px', value: 2560 },
];

export function ConversionSettings({
  settings,
  onChange,
  disabled = false,
}: ConversionSettingsProps) {
  const [customDpi, setCustomDpi] = useState<string>('');
  const [customTileSize, setCustomTileSize] = useState<string>('');
  const [showCustomDpi, setShowCustomDpi] = useState(
    !DPI_PRESETS.some((p) => p.value === settings.dpi)
  );
  const [showCustomTileSize, setShowCustomTileSize] = useState(
    !TILE_SIZE_PRESETS.some((p) => p.value === settings.tileSize)
  );

  const handleDpiChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        setShowCustomDpi(true);
        setCustomDpi(String(settings.dpi));
      } else {
        setShowCustomDpi(false);
        onChange({ ...settings, dpi: parseInt(value, 10) });
      }
    },
    [settings, onChange]
  );

  const handleCustomDpiChange = useCallback(
    (value: string) => {
      setCustomDpi(value);
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 72 && num <= 2400) {
        onChange({ ...settings, dpi: num });
      }
    },
    [settings, onChange]
  );

  const handleTileSizeChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        setShowCustomTileSize(true);
        setCustomTileSize(String(settings.tileSize));
      } else {
        setShowCustomTileSize(false);
        onChange({ ...settings, tileSize: parseInt(value, 10) });
      }
    },
    [settings, onChange]
  );

  const handleCustomTileSizeChange = useCallback(
    (value: string) => {
      setCustomTileSize(value);
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 256 && num <= 4096) {
        onChange({ ...settings, tileSize: num });
      }
    },
    [settings, onChange]
  );

  const handleOverlapChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0 && num <= settings.tileSize / 2) {
        onChange({ ...settings, overlap: num });
      }
    },
    [settings, onChange]
  );

  const handleReset = useCallback(() => {
    setShowCustomDpi(false);
    setShowCustomTileSize(false);
    setCustomDpi('');
    setCustomTileSize('');
    onChange(DEFAULT_CONVERSION_SETTINGS);
  }, [onChange]);

  const overlapPercentage = ((settings.overlap / settings.tileSize) * 100).toFixed(1);

  const isDefault =
    settings.dpi === DEFAULT_CONVERSION_SETTINGS.dpi &&
    settings.tileSize === DEFAULT_CONVERSION_SETTINGS.tileSize &&
    settings.overlap === DEFAULT_CONVERSION_SETTINGS.overlap;

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">Conversion Settings</h3>
        {!isDefault && (
          <button
            onClick={handleReset}
            disabled={disabled}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset to defaults
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DPI */}
        <div>
          <label
            htmlFor="dpi-select"
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            DPI (Resolution)
          </label>
          {!showCustomDpi ? (
            <select
              id="dpi-select"
              value={settings.dpi}
              onChange={(e) => handleDpiChange(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {DPI_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                value={customDpi}
                onChange={(e) => handleCustomDpiChange(e.target.value)}
                disabled={disabled}
                min={72}
                max={2400}
                placeholder="72-2400"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={() => setShowCustomDpi(false)}
                disabled={disabled}
                className="px-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Use preset"
              >
                &times;
              </button>
            </div>
          )}
        </div>

        {/* Tile Size */}
        <div>
          <label
            htmlFor="tile-size-select"
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            Tile Size
          </label>
          {!showCustomTileSize ? (
            <select
              id="tile-size-select"
              value={settings.tileSize}
              onChange={(e) => handleTileSizeChange(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {TILE_SIZE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                value={customTileSize}
                onChange={(e) => handleCustomTileSizeChange(e.target.value)}
                disabled={disabled}
                min={256}
                max={4096}
                placeholder="256-4096"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={() => setShowCustomTileSize(false)}
                disabled={disabled}
                className="px-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Use preset"
              >
                &times;
              </button>
            </div>
          )}
        </div>

        {/* Overlap */}
        <div>
          <label
            htmlFor="overlap-input"
            className="block text-sm font-medium text-gray-600 mb-1"
          >
            Overlap (px)
          </label>
          <input
            id="overlap-input"
            type="number"
            value={settings.overlap}
            onChange={(e) => handleOverlapChange(e.target.value)}
            disabled={disabled}
            min={0}
            max={Math.floor(settings.tileSize / 2)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">{overlapPercentage}% of tile size</p>
        </div>
      </div>
    </div>
  );
}
