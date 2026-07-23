import type { IReadonlyTheme } from '@microsoft/sp-component-base';

jest.mock('@microsoft/sp-core-library', () => ({
  DisplayMode: { Edit: 2 },
  Version: { parse: jest.fn() }
}));

jest.mock('@microsoft/sp-property-pane', () => ({
  PropertyPaneFieldType: { Custom: 1 }
}));

jest.mock('@microsoft/sp-http', () => ({
  SPHttpClient: { configurations: { v1: {} } }
}));

jest.mock('@microsoft/sp-webpart-base', () => ({
  BaseClientSideWebPart: class {
    protected get renderedOnce(): boolean {
      return Boolean((this as unknown as { _renderedOnce?: boolean })._renderedOnce);
    }
  }
}));

jest.mock('WebPartStrings', () => ({}), { virtual: true });

import BetterListWebPart from './BetterList';

class TestableBetterListWebPart extends BetterListWebPart {
  public applyTheme(theme: IReadonlyTheme | undefined): void {
    this.onThemeChanged(theme);
  }
}

interface IBetterListThemeState {
  _isDarkTheme: boolean;
  _themeColors: readonly {
    key: string;
    label: string;
    color: string;
  }[];
  _renderedOnce: boolean;
}

describe('BetterListWebPart theme changes', () => {
  const createWebPart = (): TestableBetterListWebPart => (
    Object.create(TestableBetterListWebPart.prototype) as TestableBetterListWebPart
  );

  it('stores theme state without rendering before the initial web part render', () => {
    const webPart = createWebPart();
    const renderSpy = jest.spyOn(webPart, 'render').mockImplementation(() => undefined);

    expect(() => webPart.applyTheme({
      isInverted: true,
      palette: {
        themePrimary: '#0078D4'
      }
    } as IReadonlyTheme)).not.toThrow();

    const state = webPart as unknown as IBetterListThemeState;
    expect(state._isDarkTheme).toBe(true);
    expect(state._themeColors).toEqual([
      { key: 'themePrimary', label: 'Theme Primary', color: '#0078d4' }
    ]);
    expect(renderSpy).not.toHaveBeenCalled();
  });

  it('rerenders and refreshes an open property pane after the initial render', () => {
    const webPart = createWebPart();
    const renderSpy = jest.spyOn(webPart, 'render').mockImplementation(() => undefined);
    const isPropertyPaneOpen = jest.fn(() => true);
    const refresh = jest.fn();
    const state = webPart as unknown as IBetterListThemeState;
    state._renderedOnce = true;
    Object.defineProperty(webPart, 'context', {
      configurable: true,
      value: {
        propertyPane: {
          isPropertyPaneOpen,
          refresh
        }
      }
    });

    webPart.applyTheme({
      isInverted: false,
      palette: {
        themeDark: '#005A9E'
      }
    } as IReadonlyTheme);

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(isPropertyPaneOpen).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(state._isDarkTheme).toBe(false);
    expect(state._themeColors).toEqual([
      { key: 'themeDark', label: 'Theme Dark', color: '#005a9e' }
    ]);
  });

  it('does not refresh a closed property pane', () => {
    const webPart = createWebPart();
    const renderSpy = jest.spyOn(webPart, 'render').mockImplementation(() => undefined);
    const refresh = jest.fn();
    const state = webPart as unknown as IBetterListThemeState;
    state._renderedOnce = true;
    Object.defineProperty(webPart, 'context', {
      configurable: true,
      value: {
        propertyPane: {
          isPropertyPaneOpen: () => false,
          refresh
        }
      }
    });

    webPart.applyTheme(undefined);

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});
