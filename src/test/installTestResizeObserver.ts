class TestResizeObserver implements ResizeObserver {
  public disconnect(): void {
    // JSDOM does not perform layout.
  }

  public observe(): void {
    // JSDOM does not perform layout.
  }

  public unobserve(): void {
    // JSDOM does not perform layout.
  }
}

export function installTestResizeObserver(target: Window = window): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, 'ResizeObserver');
  Object.defineProperty(target, 'ResizeObserver', {
    configurable: true,
    value: TestResizeObserver,
    writable: true
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, 'ResizeObserver', descriptor);
      return;
    }
    delete (target as unknown as Record<string, unknown>).ResizeObserver;
  };
}
