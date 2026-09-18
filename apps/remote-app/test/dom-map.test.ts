import './support/register-next-resolution.ts';
import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { setupDomEnvironment } from './support/dom-environment.ts';
import type { DomEnvironment } from './support/dom-environment.ts';
import { MockMapRegistry } from './support/mock-maplibre.ts';
import type { MapMarker, RemoteMapProps } from '../types';

let RemoteMap: React.FC<RemoteMapProps>;

before(async () => {
  const mod = await import('../components/RemoteMap.tsx');
  RemoteMap = mod.RemoteMap;
});

describe('DOM: RemoteMap (MapLibre GL Integration)', () => {
  let dom: DomEnvironment;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    dom = setupDomEnvironment();
    MockMapRegistry.clear();
    container = dom.document.createElement('div');
    dom.document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    dom.cleanup();
    MockMapRegistry.clear();
  });

  it('initializes map instance and handles map load event', async () => {
    // Arrange & Act
    await act(async () => {
      root.render(React.createElement(RemoteMap, { zoom: 4 }));
    });

    // Verify map instance was created
    const mapInstance = MockMapRegistry.getLatest();
    assert.ok(mapInstance, 'Map instance should be registered');
    assert.equal(mapInstance.controls.length, 1, 'NavigationControl should be added');

    // Loading overlay is visible before load event
    const loadingOverlayBefore = container.querySelector('.map-loading-overlay');
    assert.ok(loadingOverlayBefore, 'Loading overlay should be shown initially');

    // Act: trigger the load event
    await act(async () => {
      mapInstance.trigger('load');
    });

    // Assert: loading overlay is gone and pins are created
    const loadingOverlayAfter = container.querySelector('.map-loading-overlay');
    assert.equal(loadingOverlayAfter, null, 'Loading overlay should be removed after load');

    const pinElements = container.querySelectorAll('.map-custom-pin');
    assert.ok(pinElements.length >= 4, 'Pins should be created for sample markers');
  });

  it('selects marker, calls flyTo and emits events when clicking quick jump pill', async () => {
    // Arrange
    const selectedEvents: MapMarker[] = [];
    const toastEvents: Array<{ title: string; message: string }> = [];

    dom.window.addEventListener('mfe:map-select', (event: unknown) => {
      selectedEvents.push((event as CustomEvent<MapMarker>).detail);
    });

    dom.window.addEventListener('mfe:toast', (event: unknown) => {
      toastEvents.push((event as CustomEvent<{ title: string; message: string }>).detail);
    });

    await act(async () => {
      root.render(React.createElement(RemoteMap, { selectedCity: 'tokyo' }));
    });

    const mapInstance = MockMapRegistry.getLatest();
    assert.ok(mapInstance);

    await act(async () => {
      mapInstance.trigger('load');
    });

    // Initially Tokyo banner is displayed
    const bannerTitle = container.querySelector('.selected-marker-banner h4');
    assert.equal(bannerTitle?.textContent, 'Tokyo Datacenter');

    // Act: Click "São" pill to fly to São Paulo
    const pills = Array.from(container.querySelectorAll<HTMLButtonElement>('.city-pill'));
    const saoPauloPill = pills.find((p) => p.textContent?.includes('São'));
    assert.ok(saoPauloPill, 'São Paulo pill button should exist');

    await act(async () => {
      saoPauloPill.click();
    });

    // Assert: flyTo was called with SP coords [-46.6333, -23.5505]
    assert.equal(mapInstance.flyToCalls.length, 1);
    const [lng, lat] = mapInstance.flyToCalls[0].center;
    assert.ok(Math.abs(lng - -46.6333) < 0.01, 'Target longitude should match São Paulo');
    assert.ok(Math.abs(lat - -23.5505) < 0.01, 'Target latitude should match São Paulo');

    // Banner updated to São Paulo
    const updatedBannerTitle = container.querySelector('.selected-marker-banner h4');
    assert.equal(updatedBannerTitle?.textContent, 'São Paulo Fleet Center');

    // Events emitted
    assert.equal(selectedEvents.length, 1);
    assert.equal(selectedEvents[0].id, 'sao-paulo');
    assert.ok(toastEvents.some((t) => t.title === 'Map Navigated'));
  });

  it('cleans up map instance upon unmount', async () => {
    // Arrange
    await act(async () => {
      root.render(React.createElement(RemoteMap, { zoom: 2 }));
    });

    const mapInstance = MockMapRegistry.getLatest();
    assert.ok(mapInstance);
    assert.equal(mapInstance.isRemoved, false);

    // Act: Unmount component
    await act(async () => {
      root.unmount();
    });

    // Assert: map.remove() was invoked
    assert.equal(mapInstance.isRemoved, true, 'map.remove() must be called on unmount');
  });
});
