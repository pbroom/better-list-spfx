import * as React from 'react';
import {
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  SelectTabData,
  SelectTabEvent,
  Spinner,
  Tab,
  TabList,
  Text,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens
} from '@fluentui/react-components';
import { ImageRegular, SearchRegular } from '@fluentui/react-icons';

import {
  BetterListGroupIconLibrary,
  BetterListGroupIconOverride,
  normalizeBetterListGroupIconColor,
  normalizeBetterListGroupImageUrl
} from '../../../shared';
import {
  BetterListGroupIconVisual
} from './GroupIconCatalog';
import {
  IBetterListGroupIconCatalogEntry,
  loadBetterListGroupIconPickerCatalog
} from './GroupIconPickerCatalog';
import type { ISharePointImageAssetProvider } from '../services';
import { SharePointImageBrowser } from './SharePointImageBrowser';

type PickerView = BetterListGroupIconLibrary | 'image';

export interface IGroupIconPickerDialogProps {
  current: BetterListGroupIconOverride | undefined;
  groupTitle: string;
  open: boolean;
  imageAssetProvider?: ISharePointImageAssetProvider;
  onApply: (override: BetterListGroupIconOverride | undefined) => void;
  onOpenChange: (open: boolean) => void;
}

const useStyles = makeStyles({
  surface: {
    width: 'min(760px, calc(100vw - 32px))',
    maxWidth: '760px',
    maxHeight: 'calc(100vh - 32px)'
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '16px',
    minHeight: '0'
  },
  search: {
    width: '100%'
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: '12px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
    gap: '8px'
  },
  results: {
    minHeight: '240px',
    maxHeight: '340px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    ...shorthands.padding('2px')
  },
  tile: {
    width: '100%',
    minWidth: 0,
    minHeight: '104px',
    height: '104px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '8px',
    overflow: 'hidden',
    fontWeight: tokens.fontWeightRegular,
    ...shorthands.padding('8px')
  },
  tileSelected: {
    outlineColor: tokens.colorBrandStroke1,
    outlineOffset: '-2px',
    outlineStyle: 'solid',
    outlineWidth: '2px',
    backgroundColor: tokens.colorBrandBackground2
  },
  tileIconFrame: {
    width: '32px',
    height: '32px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tileIcon: {
    width: '100%',
    height: '100%',
    display: 'block',
    flexShrink: 0,
    fontSize: '32px'
  },
  tileLabel: {
    width: '100%',
    minWidth: 0,
    maxHeight: '32px',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
    textAlign: 'center',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase200
  },
  preview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '112px',
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2)
  },
  previewIcon: {
    width: '64px',
    height: '64px',
    fontSize: '64px',
    objectFit: 'contain'
  },
  colorControl: {
    display: 'grid',
    rowGap: '6px'
  },
  colorRow: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) auto',
    alignItems: 'center',
    columnGap: '8px'
  },
  swatchButton: {
    width: '32px',
    minWidth: '32px',
    height: '32px',
    padding: '0'
  },
  swatch: {
    display: 'block',
    width: '24px',
    height: '24px',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 45%)'
  },
  colorPopover: {
    boxSizing: 'border-box',
    display: 'grid',
    width: 'min(240px, calc(100vw - 32px))',
    rowGap: '12px',
    ...shorthands.padding('12px')
  },
  colorArea: {
    width: '100%',
    minWidth: 0,
    height: '200px'
  },
  colorSlider: {
    width: '100%',
    minWidth: 0
  },
  colorHelp: {
    color: tokens.colorNeutralForeground3
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
    ...shorthands.padding('32px')
  },
  loading: {
    minHeight: '240px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageHelp: {
    color: tokens.colorNeutralForeground3,
    marginTop: '4px'
  },
  actionStart: {
    marginRight: 'auto'
  }
});

export const GroupIconPickerDialog: React.FunctionComponent<IGroupIconPickerDialogProps> = ({
  current,
  groupTitle,
  open,
  imageAssetProvider,
  onApply,
  onOpenChange
}) => {
  const classes = useStyles();
  const [view, setView] = React.useState<PickerView>('solar-duotone');
  const [query, setQuery] = React.useState('');
  const [draft, setDraft] = React.useState<BetterListGroupIconOverride | undefined>(current);
  const [draftColor, setDraftColor] = React.useState<string | undefined>(
    current?.kind === 'icon' ? current.color : undefined
  );
  const [imageUrl, setImageUrl] = React.useState('');
  const [catalog, setCatalog] = React.useState<readonly IBetterListGroupIconCatalogEntry[]>([]);
  const [catalogStatus, setCatalogStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [catalogAttempt, setCatalogAttempt] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(80);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(current);
    setDraftColor(current?.kind === 'icon' ? current.color : undefined);
    setQuery('');
    setImageUrl(current?.kind === 'image' ? current.url : '');
    setView(current?.kind === 'image' ? 'image' : current?.kind === 'icon' ? current.library : 'solar-duotone');
  }, [current, open]);

  React.useEffect(() => {
    if (!open || view === 'image') {
      setCatalogStatus('idle');
      return;
    }
    let active = true;
    setCatalog([]);
    setCatalogStatus('loading');
    loadBetterListGroupIconPickerCatalog(view)
      .then((entries) => {
        if (!active) return;
        setCatalog(entries);
        setCatalogStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setCatalogStatus('error');
      });
    return () => { active = false; };
  }, [catalogAttempt, open, view]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = React.useMemo(
    () =>
      catalog.filter(
        (entry) =>
          !normalizedQuery || entry.searchText.includes(normalizedQuery)
      ),
    [catalog, normalizedQuery]
  );
  const visibleResults = results.slice(0, visibleCount);

  React.useEffect(() => {
    setVisibleCount(80);
    if (resultsRef.current) resultsRef.current.scrollTop = 0;
  }, [normalizedQuery, view]);
  const normalizedImageUrl = view === 'image' ? normalizeBetterListGroupImageUrl(imageUrl) : undefined;
  const activeCatalogIcon =
    draft?.kind === 'icon' && draft.library === view ? draft : undefined;
  const previewOverride =
    view === 'image' && normalizedImageUrl
      ? ({ kind: 'image', url: normalizedImageUrl } as const)
      : activeCatalogIcon;
  const canApply = view === 'image' ? Boolean(normalizedImageUrl) : Boolean(activeCatalogIcon);

  const updateDraftColor = (color: string | undefined): void => {
    setDraftColor(color);
    setDraft((currentDraft) => {
      if (currentDraft?.kind !== 'icon') {
        return currentDraft;
      }
      return {
        kind: 'icon',
        library: currentDraft.library,
        name: currentDraft.name,
        ...(color ? { color } : {})
      };
    });
  };

  const apply = (): void => {
    if (view === 'image' && normalizedImageUrl) {
      onApply({ kind: 'image', url: normalizedImageUrl });
    } else if (activeCatalogIcon) {
      onApply(activeCatalogIcon);
    } else {
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog modalType="modal" open={open} onOpenChange={(_event, data) => onOpenChange(data.open)}>
      <DialogSurface className={classes.surface}>
        <DialogBody>
          <DialogTitle>{`Icon for “${groupTitle}”`}</DialogTitle>
          <DialogContent className={classes.content}>
            <div className={classes.preview} aria-label="Selected icon preview">
              {previewOverride ? (
                <BetterListGroupIconVisual className={classes.previewIcon} override={previewOverride} />
              ) : (
                <ImageRegular className={classes.previewIcon} aria-hidden="true" />
              )}
            </div>
            {view === 'fluent-color' ? (
              <Text className={classes.colorHelp} size={200}>
                Fluent color icons keep their built-in palette.
              </Text>
            ) : view !== 'image' ? (
              <GroupIconColorField value={draftColor} onChange={updateDraftColor} />
            ) : null}
            <TabList
              aria-label="Icon source"
              selectedValue={view}
              onTabSelect={(_event: SelectTabEvent, data: SelectTabData) => setView(data.value as PickerView)}
            >
              <Tab value="solar-duotone">Solar duotone</Tab>
              <Tab value="fluent">Fluent</Tab>
              <Tab value="fluent-color">Fluent color</Tab>
              <Tab value="image">Image</Tab>
            </TabList>
            {view === 'image' ? (
              <div>
                <Field
                  label="Image URL"
                  validationMessage={imageUrl && !normalizedImageUrl ? 'Use an HTTPS or SharePoint-relative image URL.' : undefined}
                  validationState={imageUrl && !normalizedImageUrl ? 'error' : 'none'}
                >
                  <Input
                    value={imageUrl}
                    placeholder="/sites/example/SiteAssets/group-icon.png"
                    onChange={(event) => setImageUrl(event.currentTarget.value)}
                  />
                </Field>
                <div className={classes.imageHelp}>Use an HTTPS URL or a path beginning with / for a SharePoint-hosted image.</div>
                <SharePointImageBrowser provider={imageAssetProvider} onSelect={setImageUrl} />
              </div>
            ) : (
              <>
                <Input
                  aria-label="Search icons"
                  className={classes.search}
                  contentBefore={<SearchRegular aria-hidden="true" />}
                  placeholder="Search icons"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                />
                <div className={classes.resultsHeader}>
                  <Text weight="semibold">Choose an icon</Text>
                  <Text aria-live="polite" size={200}>
                    {catalogStatus === 'ready'
                      ? `Showing ${visibleResults.length} of ${results.length} icons`
                      : catalogStatus === 'loading' ? 'Loading icons' : ''}
                  </Text>
                </div>
                {catalogStatus === 'loading' ? (
                  <div className={classes.loading} role="status">
                    <Spinner label={`Loading ${libraryLabel(view)} icons`} />
                  </div>
                ) : catalogStatus === 'error' ? (
                  <div className={classes.empty} role="alert">
                    <Text block>Icons could not be loaded.</Text>
                    <Button appearance="secondary" onClick={() => setCatalogAttempt((value) => value + 1)}>Retry</Button>
                  </div>
                ) : results.length ? (
                  <div
                    aria-label={`${libraryLabel(view)} icons`}
                    className={classes.results}
                    ref={resultsRef}
                    role="group"
                    tabIndex={-1}
                    onScroll={(event) => {
                      const target = event.currentTarget;
                      if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) {
                        setVisibleCount((count) => Math.min(count + 80, results.length));
                      }
                    }}
                  >
                    <div className={classes.grid}>
                    {visibleResults.map((entry) => {
                      const icon = toOverride(entry, draftColor);
                      const selected = sameCatalogIcon(draft, icon);
                      return (
                        <Button
                          appearance="subtle"
                          aria-label={entry.label}
                          aria-pressed={selected}
                          className={mergeClasses(classes.tile, selected && classes.tileSelected)}
                          key={`${entry.library}:${entry.name}`}
                          title={entry.label}
                          onClick={() => setDraft(icon)}
                        >
                          <span className={classes.tileIconFrame}>
                            <BetterListGroupIconVisual
                              className={classes.tileIcon}
                              fallback={<ImageRegular aria-hidden="true" className={classes.tileIcon} />}
                              override={icon}
                            />
                          </span>
                          <span className={classes.tileLabel}>{entry.label}</span>
                        </Button>
                      );
                    })}
                    </div>
                  </div>
                ) : (
                  <div className={classes.empty} role="status">{`No icons match “${query}”.`}</div>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions fluid>
            <Button
              appearance="subtle"
              className={classes.actionStart}
              onClick={() => {
                onApply(undefined);
                onOpenChange(false);
              }}
            >
              Use automatic icon
            </Button>
            <Button
              appearance="subtle"
              onClick={() => {
                onApply({ kind: 'none' });
                onOpenChange(false);
              }}
            >
              No icon
            </Button>
            <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!canApply} onClick={apply}>Apply</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

interface IGroupIconColorFieldProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

interface IHsvColor {
  h: number;
  s: number;
  v: number;
  a?: number;
}

const DEFAULT_PICKER_COLOR = '#0f6cbd';

function GroupIconColorField({ value, onChange }: IGroupIconColorFieldProps): JSX.Element {
  const classes = useStyles();
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value || '');
  const normalizedInput = normalizeBetterListGroupIconColor(inputValue);
  const invalid = Boolean(inputValue && !normalizedInput);
  const pickerValue = value || DEFAULT_PICKER_COLOR;

  React.useEffect(() => setInputValue(value || ''), [value]);

  const commitColor = (color: string): void => {
    const normalized = normalizeBetterListGroupIconColor(color);
    if (!normalized) {
      return;
    }
    setInputValue(normalized);
    onChange(normalized);
  };

  return (
    <div className={classes.colorControl}>
      <Text size={200} weight="semibold">Icon color</Text>
      <div className={classes.colorRow}>
        <Popover
          open={isOpen}
          positioning={{ position: 'below', align: 'start' }}
          withArrow
          onOpenChange={(_event, data) => setIsOpen(data.open)}
        >
          <PopoverTrigger disableButtonEnhancement>
            <Button
              appearance="outline"
              aria-label="Open icon color picker"
              className={classes.swatchButton}
              type="button"
            >
              <span aria-hidden="true" className={classes.swatch} style={{ backgroundColor: pickerValue }} />
            </Button>
          </PopoverTrigger>
          <PopoverSurface className={classes.colorPopover}>
            <ColorPicker
              color={hexToHsv(pickerValue)}
              onColorChange={(_event, data) => commitColor(hsvToHex(data.color))}
            >
              <ColorArea aria-label="Icon color saturation and brightness" className={classes.colorArea} />
              <ColorSlider aria-label="Icon color hue" className={classes.colorSlider} />
            </ColorPicker>
          </PopoverSurface>
        </Popover>
        <Input
          aria-label="Icon color value"
          placeholder="Automatic"
          value={inputValue}
          onBlur={() => {
            if (invalid) {
              setInputValue(value || '');
            }
          }}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            const normalized = normalizeBetterListGroupIconColor(nextValue);
            setInputValue(nextValue);
            if (!nextValue) {
              onChange(undefined);
            } else if (normalized) {
              onChange(normalized);
            }
          }}
        />
        <Button appearance="subtle" disabled={!value} size="small" onClick={() => onChange(undefined)}>
          Automatic
        </Button>
      </div>
      {invalid ? (
        <Text role="alert" size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          Use a hex color such as #245a8d.
        </Text>
      ) : null}
    </div>
  );
}

function toOverride(
  entry: IBetterListGroupIconCatalogEntry,
  color?: string
): BetterListGroupIconOverride {
  return {
    kind: 'icon',
    library: entry.library,
    name: entry.name,
    ...(entry.library !== 'fluent-color' && color ? { color } : {})
  };
}

function sameCatalogIcon(
  left: BetterListGroupIconOverride | undefined,
  right: BetterListGroupIconOverride
): boolean {
  return Boolean(
    left?.kind === 'icon' &&
      right.kind === 'icon' &&
      left.library === right.library &&
      left.name === right.name
  );
}

function libraryLabel(value: PickerView): string {
  return value === 'solar-duotone' ? 'Solar duotone' : value === 'fluent-color' ? 'Fluent color' : 'Fluent';
}

function hexToHsv(hex: string): IHsvColor {
  const normalized = normalizeBetterListGroupIconColor(hex) || DEFAULT_PICKER_COLOR;
  const red = parseInt(normalized.slice(1, 3), 16) / 255;
  const green = parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: Math.round(hue < 0 ? hue + 360 : hue),
    s: max === 0 ? 0 : delta / max,
    v: max,
    a: 1
  };
}

function hsvToHex(color: IHsvColor): string {
  const hue = (((color.h || 0) % 360) + 360) % 360;
  const saturation = clampUnit(color.s);
  const value = clampUnit(color.v);
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return `#${toHexChannel(red + m)}${toHexChannel(green + m)}${toHexChannel(blue + m)}`;
}

function clampUnit(value: number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

function toHexChannel(value: number): string {
  const channel = Math.round(clampUnit(value) * 255).toString(16);
  return channel.length === 1 ? `0${channel}` : channel;
}
