export interface MockMapOptions {
  readonly container: HTMLElement | string;
  readonly style?: unknown;
  readonly center?: [number, number];
  readonly zoom?: number;
}

export interface FlyToOptions {
  readonly center: [number, number];
  readonly zoom?: number;
  readonly speed?: number;
}

export class MockNavigationControl {}

export class MockPopup {
  public htmlContent: string = '';
  public readonly offset?: number | undefined;

  constructor(options?: { offset?: number }) {
    this.offset = options?.offset;
  }

  public setHTML(html: string): this {
    this.htmlContent = html;
    return this;
  }
}

export class MockMarker {
  public readonly element?: HTMLElement | undefined;
  public coordinates: [number, number] = [0, 0];
  public popup: MockPopup | null = null;
  public attachedMap: MockMap | null = null;

  constructor(options?: { element?: HTMLElement }) {
    this.element = options?.element;
  }

  public setLngLat(coords: [number, number]): this {
    this.coordinates = coords;
    return this;
  }

  public setPopup(popup: MockPopup): this {
    this.popup = popup;
    return this;
  }

  public addTo(map: MockMap): this {
    this.attachedMap = map;
    map.markers.push(this);
    if (this.element && map.containerElement) {
      map.containerElement.appendChild(this.element);
    }
    return this;
  }
}

export class MockMap {
  public readonly options: MockMapOptions;
  public readonly containerElement: HTMLElement | null = null;
  public readonly eventListeners = new globalThis.Map<string, Array<() => void>>();
  public readonly controls: MockNavigationControl[] = [];
  public readonly markers: MockMarker[] = [];
  public readonly flyToCalls: FlyToOptions[] = [];
  public isRemoved: boolean = false;

  constructor(options: MockMapOptions) {
    this.options = options;
    if (typeof options.container === 'object' && options.container !== null) {
      this.containerElement = options.container as HTMLElement;
    }
    MockMapRegistry.register(this);
  }

  public addControl(control: MockNavigationControl, _position?: string): void {
    this.controls.push(control);
  }

  public on(event: string, callback: () => void): void {
    const list = this.eventListeners.get(event) ?? [];
    list.push(callback);
    this.eventListeners.set(event, list);
  }

  public trigger(event: string): void {
    const list = this.eventListeners.get(event) ?? [];
    for (const cb of list) {
      cb();
    }
  }

  public flyTo(opts: FlyToOptions): void {
    this.flyToCalls.push(opts);
  }

  public remove(): void {
    this.isRemoved = true;
  }
}

export class MockMapRegistry {
  private static activeInstances: MockMap[] = [];

  public static register(map: MockMap): void {
    this.activeInstances.push(map);
  }

  public static getLatest(): MockMap | undefined {
    return this.activeInstances[this.activeInstances.length - 1];
  }

  public static getAll(): readonly MockMap[] {
    return this.activeInstances;
  }

  public static clear(): void {
    this.activeInstances = [];
  }
}

export const Map = MockMap;
export const Marker = MockMarker;
export const Popup = MockPopup;
export const NavigationControl = MockNavigationControl;
